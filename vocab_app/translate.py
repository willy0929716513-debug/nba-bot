"""自動查詢英文單字的中文意思（用免費的 MyMemory 翻譯 API，不需要 API key）。
如果目前網路連不到外部服務，會回傳 None，讓使用者自行手動輸入。
"""
import requests

MYMEMORY_URL = "https://api.mymemory.translated.net/get"
MAX_AUTO_LOOKUPS_PER_REQUEST = 60


def lookup_chinese(word, timeout=5):
    try:
        resp = requests.get(
            MYMEMORY_URL,
            params={"q": word, "langpair": "en|zh-TW"},
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        text = (data.get("responseData") or {}).get("translatedText", "").strip()
        if not text or text.lower() == word.lower():
            return None
        return text
    except Exception:
        return None


def fill_missing_translations(entries, limit=MAX_AUTO_LOOKUPS_PER_REQUEST):
    """幫沒有中文意思的項目自動查詢，最多查 limit 個（避免大量清單卡住）。
    回傳 (entries, lookup_failed_count)，並在每個 entry 加上 status 欄位。
    """
    attempts = 0
    failed = 0
    for e in entries:
        if e.get("chinese"):
            e["status"] = "ok"
            continue
        if attempts >= limit:
            e["status"] = "need_review"
            continue
        attempts += 1
        result = lookup_chinese(e["english"])
        if result:
            e["chinese"] = result
            e["status"] = "auto"
        else:
            e["status"] = "need_review"
            failed += 1
    return entries, failed
