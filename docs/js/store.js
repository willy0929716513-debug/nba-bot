/* 純瀏覽器端的單字資料庫（用 localStorage 存），對應原本 Flask 版的 db.py。 */
const Store = (() => {
  const KEY = "vocab_words_v1";
  const MAX_BOX = 5;
  const BOX_INTERVAL_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };

  function now() {
    return new Date().toISOString();
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function persist(words) {
    localStorage.setItem(KEY, JSON.stringify(words));
  }

  function nextId(words) {
    return words.reduce((max, w) => Math.max(max, w.id), 0) + 1;
  }

  function listTags() {
    const words = load();
    return [...new Set(words.map((w) => w.tag))].sort();
  }

  function listWords({ tag, search, status } = {}) {
    let words = load();
    if (tag) words = words.filter((w) => w.tag === tag);
    if (search) {
      const s = search.toLowerCase();
      words = words.filter(
        (w) => w.english.toLowerCase().includes(s) || w.chinese.toLowerCase().includes(s)
      );
    }
    if (status === "starred") words = words.filter((w) => w.starred);
    else if (status === "mastered") words = words.filter((w) => w.box_level >= MAX_BOX);
    else if (status === "learning") words = words.filter((w) => w.box_level < MAX_BOX);
    else if (status === "due") words = words.filter((w) => w.next_review_at <= now());
    return words.sort((a, b) => b.id - a.id);
  }

  function saveEntries(entries, tag) {
    const words = load();
    let added = 0, updated = 0, skipped = 0;
    const ts = now();
    entries.forEach((e) => {
      const english = (e.english || "").trim();
      const chinese = (e.chinese || "").trim();
      if (!english) { skipped++; return; }
      const existing = words.find(
        (w) => w.english.toLowerCase() === english.toLowerCase() && w.tag === tag
      );
      if (existing) {
        if (chinese && !existing.chinese) {
          existing.chinese = chinese;
          updated++;
        } else {
          skipped++;
        }
        return;
      }
      words.push({
        id: nextId(words),
        english,
        chinese,
        tag,
        correct_count: 0,
        wrong_count: 0,
        starred: 0,
        box_level: 1,
        next_review_at: ts,
        created_at: ts,
      });
      added++;
    });
    persist(words);
    return { added, updated, skipped };
  }

  function updateWord(id, fields) {
    const words = load();
    const w = words.find((x) => x.id === id);
    if (!w) return;
    if (fields.english !== undefined) w.english = fields.english.trim();
    if (fields.chinese !== undefined) w.chinese = fields.chinese.trim();
    if (fields.tag !== undefined) w.tag = fields.tag.trim() || "未分類";
    persist(words);
  }

  function setStarred(id, starred) {
    const words = load();
    const w = words.find((x) => x.id === id);
    if (!w) return;
    w.starred = starred ? 1 : 0;
    persist(words);
  }

  function deleteWord(id) {
    persist(load().filter((w) => w.id !== id));
  }

  function bulkDelete(ids) {
    const idSet = new Set(ids);
    const words = load();
    const remaining = words.filter((w) => !idSet.has(w.id));
    persist(remaining);
    return words.length - remaining.length;
  }

  function bulkSetTag(ids, tag) {
    const idSet = new Set(ids);
    tag = (tag || "").trim() || "未分類";
    const words = load();
    let count = 0;
    words.forEach((w) => {
      if (idSet.has(w.id)) { w.tag = tag; count++; }
    });
    persist(words);
    return count;
  }

  function recordResult(id, correct) {
    const words = load();
    const w = words.find((x) => x.id === id);
    if (!w) return;
    let box = w.box_level;
    box = correct ? Math.min(box + 1, MAX_BOX) : 1;
    const next = new Date();
    next.setDate(next.getDate() + BOX_INTERVAL_DAYS[box]);
    w.box_level = box;
    w.next_review_at = next.toISOString();
    if (correct) w.correct_count += 1; else w.wrong_count += 1;
    persist(words);
  }

  function getStats() {
    const words = load();
    const total = words.length;
    const mastered = words.filter((w) => w.box_level >= MAX_BOX).length;
    const nowTs = now();
    const due = words.filter((w) => w.next_review_at <= nowTs && w.chinese).length;
    const starred = words.filter((w) => w.starred).length;
    const totalCorrect = words.reduce((s, w) => s + w.correct_count, 0);
    const totalWrong = words.reduce((s, w) => s + w.wrong_count, 0);
    const attempts = totalCorrect + totalWrong;
    const accuracy = attempts ? Math.round((100 * totalCorrect) / attempts) : null;
    const boxCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    words.forEach((w) => { boxCounts[w.box_level] = (boxCounts[w.box_level] || 0) + 1; });
    return { total, mastered, due, starred, accuracy, boxCounts };
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickQuizWords(tag, count, dueOnly = false) {
    const nowTs = now();
    let pool = load().filter((w) => w.chinese);
    if (tag) pool = pool.filter((w) => w.tag === tag);
    if (dueOnly) pool = pool.filter((w) => w.next_review_at <= nowTs);
    pool = shuffle(pool.slice());
    pool.sort((a, b) => {
      const aDue = a.next_review_at <= nowTs ? 1 : 0;
      const bDue = b.next_review_at <= nowTs ? 1 : 0;
      if (aDue !== bDue) return bDue - aDue;
      const aScore = a.wrong_count - a.correct_count;
      const bScore = b.wrong_count - b.correct_count;
      return bScore - aScore;
    });
    return pool.slice(0, count);
  }

  function randomDistractors(excludeId, tag, field, limit) {
    let pool = load().filter((w) => w.id !== excludeId && w[field]);
    if (tag) {
      let scoped = shuffle(pool.filter((w) => w.tag === tag)).slice(0, limit);
      if (scoped.length < limit) {
        const more = shuffle(pool.slice()).slice(0, limit);
        const seen = new Set();
        scoped = [...scoped, ...more].filter((w) => {
          if (seen.has(w[field])) return false;
          seen.add(w[field]);
          return true;
        }).slice(0, limit);
      }
      return scoped.map((w) => w[field]);
    }
    return shuffle(pool.slice()).slice(0, limit).map((w) => w[field]);
  }

  function exportCsv(tag) {
    const words = listWords({ tag });
    const rows = [["english", "chinese", "tag"]];
    words.forEach((w) => rows.push([w.english, w.chinese, w.tag]));
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vocab_${tag || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    MAX_BOX,
    listTags,
    listWords,
    saveEntries,
    updateWord,
    setStarred,
    deleteWord,
    bulkDelete,
    bulkSetTag,
    recordResult,
    getStats,
    pickQuizWords,
    randomDistractors,
    exportCsv,
  };
})();
