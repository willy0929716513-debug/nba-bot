/* 瀏覽器端直接呼叫免費翻譯 API 查中文意思。對應 translate.py */
const Translate = (() => {
  const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
  const MAX_AUTO_LOOKUPS = 60;

  async function lookupChinese(word, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = `${MYMEMORY_URL}?q=${encodeURIComponent(word)}&langpair=en|zh-TW`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      const data = await res.json();
      const text = (data.responseData && data.responseData.translatedText || "").trim();
      if (!text || text.toLowerCase() === word.toLowerCase()) return null;
      return text;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fillMissingTranslations(entries, limit = MAX_AUTO_LOOKUPS, onProgress) {
    let attempts = 0;
    let failed = 0;
    for (const e of entries) {
      if (e.chinese) { e.status = "ok"; continue; }
      if (attempts >= limit) { e.status = "need_review"; continue; }
      attempts++;
      const result = await lookupChinese(e.english);
      if (result) {
        e.chinese = result;
        e.status = "auto";
      } else {
        e.status = "need_review";
        failed++;
      }
      if (onProgress) onProgress(attempts, Math.min(entries.length, limit));
    }
    return { entries, failed };
  }

  return { lookupChinese, fillMissingTranslations };
})();
