/* 自動排版：把貼上的文字 / OCR 辨識出的文字拆解成「英文 - 中文」單字清單。對應 parser.py */
const WordParser = (() => {
  const BULLET_RE = /^[\-*•\d]+[.)、]?\s*/;
  const ENGLISH_WORD_RE = /[A-Za-z][A-Za-z'\-]*/g;
  const ENGLISH_ONLY_RE = /^[A-Za-z][A-Za-z .'\-]*$/;
  const CJK_RE = /[一-鿿]/;
  const SEPARATOR_STRIP = " \t　:：,，－\-–—=";
  const PURE_NUMBER_RE = /^\d+\.?$/;
  const SEPARATOR_ROW_RE = /^:?-{2,}:?$/;

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

  // ---- Markdown 表格（| 欄位 | 欄位 | ... |）支援：片語/多字詞組常出現在表格裡 ----
  function splitCells(line) {
    return line.split("|").map((c) => c.trim()).filter((c) => c !== "");
  }

  function isTableLine(line) {
    return line.includes("|") && splitCells(line).length >= 2;
  }

  function isSeparatorRow(cells) {
    return cells.length > 0 && cells.every((c) => SEPARATOR_ROW_RE.test(c));
  }

  function extractRowEntry(cells) {
    let chiCell = null;
    let engCell = null;
    for (const c of cells) {
      if (PURE_NUMBER_RE.test(c)) continue; // 跳過編號欄
      if (!chiCell && CJK_RE.test(c)) { chiCell = c; continue; }
      if (!engCell && /[A-Za-z]/.test(c) && ENGLISH_ONLY_RE.test(c)) engCell = c;
    }
    if (engCell && chiCell) return { english: engCell, chinese: cleanChinese(chiCell) };
    return null;
  }

  function extractTableBlocks(rawLines) {
    const entries = [];
    const consumed = new Set();
    let i = 0;
    while (i < rawLines.length) {
      if (!isTableLine(rawLines[i])) { i++; continue; }
      const block = [];
      let j = i;
      while (j < rawLines.length && isTableLine(rawLines[j])) { block.push(j); j++; }

      let sepIdx = -1;
      for (const idx of block) {
        if (isSeparatorRow(splitCells(rawLines[idx]))) { sepIdx = idx; break; }
      }
      const dataIdxs = sepIdx >= 0 ? block.filter((idx) => idx > sepIdx) : block;
      block.forEach((idx) => consumed.add(idx));

      dataIdxs.forEach((idx) => {
        const entry = extractRowEntry(splitCells(rawLines[idx]));
        if (entry) entries.push(entry);
      });
      i = j;
    }
    return { entries, consumed };
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

    const rawLines = rawText.split("\n");
    const { entries: tableEntries, consumed } = extractTableBlocks(rawLines);
    tableEntries.forEach((e) => add(e.english, e.chinese));

    const lines = rawLines
      .map((l, idx) => ({ idx, text: l.trim() }))
      .filter((l) => l.text && !consumed.has(l.idx));

    for (const { text: rawLine } of lines) {
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
