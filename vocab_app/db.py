import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

DB_PATH = Path(__file__).parent / "vocab.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    english TEXT NOT NULL,
    chinese TEXT NOT NULL DEFAULT '',
    tag TEXT NOT NULL DEFAULT '未分類',
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    starred INTEGER NOT NULL DEFAULT 0,
    box_level INTEGER NOT NULL DEFAULT 1,
    next_review_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(english COLLATE NOCASE, tag)
);
"""

# Leitner box system：答對就晉級（下次複習間隔變長），答錯就退回第 1 盒。
MAX_BOX = 5
BOX_INTERVAL_DAYS = {1: 0, 2: 1, 3: 3, 4: 7, 5: 14}


def _now():
    return datetime.utcnow().isoformat()


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.execute(
        "UPDATE words SET next_review_at = ? WHERE next_review_at = ''", (_now(),)
    )
    conn.commit()
    conn.close()


def list_tags(conn):
    rows = conn.execute("SELECT DISTINCT tag FROM words ORDER BY tag").fetchall()
    return [r["tag"] for r in rows]


def list_words(conn, tag=None, search=None, status=None):
    clauses, params = [], []
    if tag:
        clauses.append("tag = ?")
        params.append(tag)
    if search:
        clauses.append("(english LIKE ? OR chinese LIKE ?)")
        like = f"%{search}%"
        params += [like, like]
    if status == "starred":
        clauses.append("starred = 1")
    elif status == "mastered":
        clauses.append(f"box_level >= {MAX_BOX}")
    elif status == "learning":
        clauses.append(f"box_level < {MAX_BOX}")
    elif status == "due":
        clauses.append("next_review_at <= ?")
        params.append(_now())

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"SELECT * FROM words {where} ORDER BY id DESC", params
    ).fetchall()
    return [dict(r) for r in rows]


def save_entries(conn, entries, tag):
    """新增或更新單字。回傳 (新增數量, 更新數量, 跳過數量)"""
    added = updated = skipped = 0
    now = _now()
    for e in entries:
        english = (e.get("english") or "").strip()
        chinese = (e.get("chinese") or "").strip()
        if not english:
            skipped += 1
            continue
        existing = conn.execute(
            "SELECT id, chinese FROM words WHERE english = ? COLLATE NOCASE AND tag = ?",
            (english, tag),
        ).fetchone()
        if existing:
            if chinese and not existing["chinese"]:
                conn.execute(
                    "UPDATE words SET chinese = ? WHERE id = ?", (chinese, existing["id"])
                )
                updated += 1
            else:
                skipped += 1
            continue
        conn.execute(
            "INSERT INTO words (english, chinese, tag, created_at, next_review_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (english, chinese, tag, now, now),
        )
        added += 1
    conn.commit()
    return added, updated, skipped


def update_word(conn, word_id, english=None, chinese=None, tag=None):
    fields, params = [], []
    if english is not None:
        fields.append("english = ?")
        params.append(english.strip())
    if chinese is not None:
        fields.append("chinese = ?")
        params.append(chinese.strip())
    if tag is not None:
        fields.append("tag = ?")
        params.append(tag.strip() or "未分類")
    if not fields:
        return
    params.append(word_id)
    conn.execute(f"UPDATE words SET {', '.join(fields)} WHERE id = ?", params)
    conn.commit()


def set_starred(conn, word_id, starred):
    conn.execute("UPDATE words SET starred = ? WHERE id = ?", (1 if starred else 0, word_id))
    conn.commit()


def delete_word(conn, word_id):
    conn.execute("DELETE FROM words WHERE id = ?", (word_id,))
    conn.commit()


def bulk_delete(conn, ids):
    if not ids:
        return 0
    qmarks = ",".join("?" * len(ids))
    cur = conn.execute(f"DELETE FROM words WHERE id IN ({qmarks})", ids)
    conn.commit()
    return cur.rowcount


def bulk_set_tag(conn, ids, tag):
    if not ids:
        return 0
    tag = tag.strip() or "未分類"
    qmarks = ",".join("?" * len(ids))
    cur = conn.execute(
        f"UPDATE words SET tag = ? WHERE id IN ({qmarks})", [tag] + list(ids)
    )
    conn.commit()
    return cur.rowcount


def record_result(conn, word_id, correct):
    row = conn.execute("SELECT box_level FROM words WHERE id = ?", (word_id,)).fetchone()
    if not row:
        return
    box = row["box_level"]
    if correct:
        box = min(box + 1, MAX_BOX)
    else:
        box = 1
    next_review = (datetime.utcnow() + timedelta(days=BOX_INTERVAL_DAYS[box])).isoformat()
    col = "correct_count" if correct else "wrong_count"
    conn.execute(
        f"UPDATE words SET {col} = {col} + 1, box_level = ?, next_review_at = ? WHERE id = ?",
        (box, next_review, word_id),
    )
    conn.commit()


def get_stats(conn):
    total = conn.execute("SELECT COUNT(*) c FROM words").fetchone()["c"]
    mastered = conn.execute(
        f"SELECT COUNT(*) c FROM words WHERE box_level >= {MAX_BOX}"
    ).fetchone()["c"]
    due = conn.execute(
        "SELECT COUNT(*) c FROM words WHERE next_review_at <= ? AND chinese != ''", (_now(),)
    ).fetchone()["c"]
    starred = conn.execute("SELECT COUNT(*) c FROM words WHERE starred = 1").fetchone()["c"]
    totals = conn.execute(
        "SELECT COALESCE(SUM(correct_count),0) c, COALESCE(SUM(wrong_count),0) w FROM words"
    ).fetchone()
    attempts = totals["c"] + totals["w"]
    accuracy = round(100 * totals["c"] / attempts) if attempts else None
    box_counts = {i: 0 for i in range(1, MAX_BOX + 1)}
    for row in conn.execute("SELECT box_level, COUNT(*) c FROM words GROUP BY box_level"):
        if row["box_level"] in box_counts:
            box_counts[row["box_level"]] = row["c"]
    return {
        "total": total,
        "mastered": mastered,
        "due": due,
        "starred": starred,
        "accuracy": accuracy,
        "box_counts": box_counts,
    }


def pick_quiz_words(conn, tag, count, due_only=False):
    """優先挑選到期複習、答錯較多的單字，其餘隨機補滿。"""
    clauses = ["chinese != ''"]
    params = []
    if tag:
        clauses.append("tag = ?")
        params.append(tag)
    if due_only:
        clauses.append("next_review_at <= ?")
        params.append(_now())
    where = " AND ".join(clauses)
    params.append(count)
    rows = conn.execute(
        f"""SELECT *, (next_review_at <= '{_now()}') AS is_due FROM words
            WHERE {where}
            ORDER BY is_due DESC, (wrong_count - correct_count) DESC, RANDOM() LIMIT ?""",
        params,
    ).fetchall()
    return [dict(r) for r in rows]


def random_distractors(conn, exclude_id, tag, field, limit):
    if tag:
        rows = conn.execute(
            f"""SELECT {field} FROM words WHERE id != ? AND tag = ? AND {field} != ''
                ORDER BY RANDOM() LIMIT ?""",
            (exclude_id, tag, limit),
        ).fetchall()
        if len(rows) < limit:
            more = conn.execute(
                f"""SELECT {field} FROM words WHERE id != ? AND {field} != ''
                    ORDER BY RANDOM() LIMIT ?""",
                (exclude_id, limit),
            ).fetchall()
            rows = list({r[field]: r for r in (rows + more)}.values())[:limit]
    else:
        rows = conn.execute(
            f"""SELECT {field} FROM words WHERE id != ? AND {field} != ''
                ORDER BY RANDOM() LIMIT ?""",
            (exclude_id, limit),
        ).fetchall()
    return [r[field] for r in rows]
