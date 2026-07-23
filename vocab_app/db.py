import sqlite3
from datetime import datetime
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
    created_at TEXT NOT NULL,
    UNIQUE(english COLLATE NOCASE, tag)
);
"""


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_connection()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def list_tags(conn):
    rows = conn.execute("SELECT DISTINCT tag FROM words ORDER BY tag").fetchall()
    return [r["tag"] for r in rows]


def list_words(conn, tag=None):
    if tag:
        rows = conn.execute(
            "SELECT * FROM words WHERE tag = ? ORDER BY id DESC", (tag,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM words ORDER BY id DESC").fetchall()
    return [dict(r) for r in rows]


def save_entries(conn, entries, tag):
    """新增或更新單字。回傳 (新增數量, 更新數量, 跳過數量)"""
    added = updated = skipped = 0
    now = datetime.utcnow().isoformat()
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
            "INSERT INTO words (english, chinese, tag, created_at) VALUES (?, ?, ?, ?)",
            (english, chinese, tag, now),
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


def delete_word(conn, word_id):
    conn.execute("DELETE FROM words WHERE id = ?", (word_id,))
    conn.commit()


def record_result(conn, word_id, correct):
    col = "correct_count" if correct else "wrong_count"
    conn.execute(f"UPDATE words SET {col} = {col} + 1 WHERE id = ?", (word_id,))
    conn.commit()


def pick_quiz_words(conn, tag, count):
    """優先挑選答錯較多、還不熟的單字，其餘隨機補滿。"""
    if tag:
        rows = conn.execute(
            """SELECT * FROM words WHERE tag = ? AND chinese != ''
               ORDER BY (wrong_count - correct_count) DESC, RANDOM() LIMIT ?""",
            (tag, count),
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT * FROM words WHERE chinese != ''
               ORDER BY (wrong_count - correct_count) DESC, RANDOM() LIMIT ?""",
            (count,),
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
