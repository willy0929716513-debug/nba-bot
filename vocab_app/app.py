import random

from flask import Flask, jsonify, redirect, render_template, request, url_for

import db
import ocr
import parser as word_parser
import translate

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8MB，足夠一張單字照片

db.init_db()


@app.route("/")
def home():
    return redirect(url_for("words_page"))


@app.route("/words")
def words_page():
    conn = db.get_connection()
    tag = request.args.get("tag") or None
    words = db.list_words(conn, tag)
    tags = db.list_tags(conn)
    conn.close()
    return render_template("index.html", words=words, tags=tags, current_tag=tag)


@app.route("/quiz")
def quiz_setup_page():
    conn = db.get_connection()
    tags = db.list_tags(conn)
    tag_counts = {
        t: len(db.list_words(conn, t)) for t in tags
    }
    conn.close()
    return render_template("quiz_setup.html", tags=tags, tag_counts=tag_counts)


@app.route("/quiz/play")
def quiz_play_page():
    return render_template("quiz.html")


# ---------- API ----------

@app.route("/api/words/parse", methods=["POST"])
def api_parse():
    text = ""
    warning = None

    if "image" in request.files and request.files["image"].filename:
        try:
            text = ocr.image_to_text(request.files["image"])
            if not text.strip():
                warning = "沒有從照片中辨識出任何文字，請確認照片清晰、光線充足，或改用手動輸入。"
        except ocr.OcrUnavailableError as exc:
            return jsonify(error=str(exc)), 503
        except ValueError as exc:
            return jsonify(error=str(exc)), 400
    elif "file" in request.files and request.files["file"].filename:
        raw = request.files["file"].read()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("utf-8", errors="ignore")
    else:
        payload = request.get_json(silent=True) or {}
        text = payload.get("text", "")

    entries = word_parser.parse_bulk_words(text)
    entries, failed = translate.fill_missing_translations(entries)

    return jsonify(entries=entries, total=len(entries), failed=failed, warning=warning)


@app.route("/api/words/save", methods=["POST"])
def api_save():
    payload = request.get_json(force=True) or {}
    entries = payload.get("entries") or []
    tag = (payload.get("tag") or "未分類").strip() or "未分類"

    conn = db.get_connection()
    added, updated, skipped = db.save_entries(conn, entries, tag)
    conn.close()
    return jsonify(added=added, updated=updated, skipped=skipped)


@app.route("/api/words/<int:word_id>", methods=["PUT"])
def api_update_word(word_id):
    payload = request.get_json(force=True) or {}
    conn = db.get_connection()
    db.update_word(
        conn,
        word_id,
        english=payload.get("english"),
        chinese=payload.get("chinese"),
        tag=payload.get("tag"),
    )
    conn.close()
    return jsonify(ok=True)


@app.route("/api/words/<int:word_id>", methods=["DELETE"])
def api_delete_word(word_id):
    conn = db.get_connection()
    db.delete_word(conn, word_id)
    conn.close()
    return jsonify(ok=True)


@app.route("/api/lookup")
def api_lookup():
    word = request.args.get("word", "").strip()
    if not word:
        return jsonify(error="缺少 word 參數"), 400
    result = translate.lookup_chinese(word)
    if result is None:
        return jsonify(chinese=None, message="查不到，請手動輸入"), 200
    return jsonify(chinese=result)


@app.route("/api/quiz/generate", methods=["POST"])
def api_quiz_generate():
    payload = request.get_json(force=True) or {}
    tag = payload.get("tag") or None
    mode = payload.get("mode", "en2zh")
    count = max(1, min(int(payload.get("count", 10)), 50))

    conn = db.get_connection()
    words = db.pick_quiz_words(conn, tag, count)
    if len(words) < 1:
        conn.close()
        return jsonify(error="這個範圍內沒有可以測驗的單字（需要已經有中文意思的單字）。"), 400

    questions = []
    for w in words:
        q = {"word_id": w["id"], "mode": mode}
        if mode in ("en2zh", "zh2en"):
            field = "chinese" if mode == "en2zh" else "english"
            distractors = db.random_distractors(conn, w["id"], tag, field, 3)
            options = list(dict.fromkeys(distractors + [w[field]]))
            while len(options) < min(4, len(words)):
                options.append(w[field])
            random.shuffle(options)
            q["prompt"] = w["english"] if mode == "en2zh" else w["chinese"]
            q["options"] = options
            q["answer"] = w[field]
        elif mode == "spelling":
            q["prompt"] = w["chinese"]
            q["answer"] = w["english"]
        elif mode == "listening":
            q["prompt"] = w["english"]
            q["speak"] = w["english"]
            q["answer"] = w["english"]
        else:
            conn.close()
            return jsonify(error=f"不支援的測驗模式：{mode}"), 400
        questions.append(q)

    conn.close()
    random.shuffle(questions)
    return jsonify(questions=questions)


@app.route("/api/quiz/grade", methods=["POST"])
def api_quiz_grade():
    payload = request.get_json(force=True) or {}
    results = payload.get("results") or []
    conn = db.get_connection()
    for r in results:
        db.record_result(conn, r["word_id"], bool(r.get("correct")))
    conn.close()
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
