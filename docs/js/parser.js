/* 自動排版：把貼上的文字 / OCR 辨識出的文字拆解成「英文 - 中文」單字清單。對應 parser.py */
const WordParser = (() => {
  const BULLET_RE = /^[\-*•\d]+[.)、]?\s*/;
  const ENGLISH_WORD_RE = /[A-Za-z][A-Za-z'\-]*/g;
  const ENGLISH_ONLY_RE = /^[A-Za-z][A-Za-z .'\-]*$/;
  const CJK_RE = /[一-鿿]/;
  const SEPARATOR_STRIP = " \t　:：,，－\-–—=";

  function stripChars(str, chars) {
    const set = new Set(chars.split(""));
    let start = 0, end = str.length;
    while (start < end && set.has(str[start])) start++;
    while (end > start && set.has(str[end - 1])) end--;
    return str.slice(start, end);
  }

  function cleanChinese(text) {
    return stripChars(text, SEPARATOR_STRIP + "。、；;.");
  }

  function parseBulkWords(rawText) {
    const entries = [];
    const seen = new Set();

    function add(english, chinese = "") {
      english = english.trim().replace(/[.,;:]+$/, "").trim();
      if (!english) return;
      const key = english.toLowerCase();
      if (seen.has(key)) {
        if (chinese) {
          const existing = entries.find((e) => e.english.toLowerCase() === key && !e.chinese);
          if (existing) existing.chinese = cleanChinese(chinese);
        }
        return;
      }
      seen.add(key);
      entries.push({ english, chinese: chinese ? cleanChinese(chinese) : "" });
    }

    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

    for (const rawLine of lines) {
      const line = rawLine.replace(BULLET_RE, "").trim();
      if (!line) continue;

      const cjkMatch = CJK_RE.exec(line);
      if (cjkMatch && cjkMatch.index > 0) {
        const engPart = stripChars(line.slice(0, cjkMatch.index), SEPARATOR_STRIP);
        const chiPart = line.slice(cjkMatch.index);
        if (engPart && ENGLISH_ONLY_RE.test(engPart)) {
          add(engPart, chiPart);
          continue;
        }
      }

      const tokens = line.match(ENGLISH_WORD_RE) || [];
      tokens.forEach((t) => add(t));
    }

    return entries;
  }

  return { parseBulkWords };
})();
