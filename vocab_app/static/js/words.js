let currentEntries = [];
let allWords = window.__INITIAL_WORDS__ || [];
let currentTag = window.__INITIAL_TAG__ || "";
let currentStatus = "";
let currentSearch = "";
let selectedIds = new Set();

// ---- tabs ----
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
  });
});

function showStatus(msg, isError) {
  const el = document.getElementById("parse-status");
  el.textContent = msg;
  el.classList.remove("hidden");
  el.classList.toggle("error", !!isError);
}

function renderPreview(entries, failed) {
  currentEntries = entries;
  const body = document.getElementById("preview-body");
  body.innerHTML = "";
  entries.forEach((e, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" data-i="${i}" data-field="english" value="${escapeHtml(e.english)}"></td>
      <td><input type="text" data-i="${i}" data-field="chinese" value="${escapeHtml(e.chinese || "")}"></td>
      <td><span class="status-tag ${e.status}">${statusLabel(e.status)}</span></td>
      <td><button class="btn danger small" data-remove="${i}">移除</button></td>
    `;
    body.appendChild(tr);
  });
  document.getElementById("preview-wrap").classList.remove("hidden");

  body.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      currentEntries[input.dataset.i][input.dataset.field] = input.value;
    });
  });
  body.querySelectorAll("[data-remove]").forEach((b) => {
    b.addEventListener("click", () => {
      currentEntries.splice(Number(b.dataset.remove), 1);
      renderPreview(currentEntries);
    });
  });

  if (entries.length === 0) {
    showStatus("沒有辨識出任何單字，請確認輸入內容或改用其他方式。", true);
  } else if (failed) {
    showStatus(`辨識出 ${entries.length} 個單字，其中 ${failed} 個查不到中文意思，請在下方手動補上。`);
  } else {
    showStatus(`辨識出 ${entries.length} 個單字，確認無誤後即可儲存。`);
  }
}

function statusLabel(status) {
  return { ok: "已有意思", auto: "自動查到", need_review: "需要確認" }[status] || "";
}

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

async function parseText(text) {
  const res = await fetch("/api/words/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

async function parseFormData(fd) {
  const res = await fetch("/api/words/parse", { method: "POST", body: fd });
  return res.json();
}

document.getElementById("btn-parse-paste").addEventListener("click", async () => {
  const text = document.getElementById("paste-text").value.trim();
  if (!text) { showStatus("請先輸入或貼上單字。", true); return; }
  showStatus("辨識中...");
  const data = await parseText(text);
  if (data.error) { showStatus(data.error, true); return; }
  renderPreview(data.entries, data.failed);
});

document.getElementById("btn-parse-file").addEventListener("click", async () => {
  const input = document.getElementById("file-input");
  if (!input.files.length) { showStatus("請先選擇檔案。", true); return; }
  const fd = new FormData();
  fd.append("file", input.files[0]);
  showStatus("辨識中...");
  const data = await parseFormData(fd);
  if (data.error) { showStatus(data.error, true); return; }
  renderPreview(data.entries, data.failed);
});

document.getElementById("btn-parse-image").addEventListener("click", async () => {
  const input = document.getElementById("image-input");
  if (!input.files.length) { showStatus("請先選擇或拍攝照片。", true); return; }
  const fd = new FormData();
  fd.append("image", input.files[0]);
  showStatus("照片辨識中，請稍候...");
  const data = await parseFormData(fd);
  if (data.error) { showStatus(data.error, true); return; }
  if (data.warning) showStatus(data.warning, true);
  renderPreview(data.entries, data.failed);
});

document.getElementById("btn-cancel-preview").addEventListener("click", () => {
  currentEntries = [];
  document.getElementById("preview-wrap").classList.add("hidden");
});

document.getElementById("btn-save-entries").addEventListener("click", async () => {
  if (!currentEntries.length) return;
  const tag = document.getElementById("target-tag").value.trim() || "未分類";
  const res = await fetch("/api/words/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entries: currentEntries, tag }),
  });
  const data = await res.json();
  showStatus(`已新增 ${data.added} 個、更新 ${data.updated} 個，跳過 ${data.skipped} 個重複的單字。`);
  document.getElementById("preview-wrap").classList.add("hidden");
  currentEntries = [];
  await reloadWords();
});

// ---- word bank table ----
function boxDots(level) {
  let out = "";
  for (let i = 1; i <= 5; i++) {
    out += `<span class="dot ${i <= level ? "filled" : ""}"></span>`;
  }
  return `<span class="dots" title="第 ${level} / 5 盒">${out}</span>`;
}

function renderTable() {
  const tbody = document.getElementById("word-table-body");
  tbody.innerHTML = "";
  document.getElementById("word-count").textContent = allWords.length;
  document.getElementById("empty-hint").classList.toggle("hidden", allWords.length > 0);

  allWords.forEach((w) => {
    const tr = document.createElement("tr");
    tr.dataset.id = w.id;
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select" ${selectedIds.has(w.id) ? "checked" : ""}></td>
      <td><button class="star-btn ${w.starred ? "on" : ""}" title="加星號" aria-label="加星號">${w.starred ? "⭐" : "☆"}</button></td>
      <td class="editable" data-field="english">${escapeHtml(w.english)} <button class="speaker-btn" title="播放發音" aria-label="播放發音">🔊</button></td>
      <td class="editable" data-field="chinese">${w.chinese ? escapeHtml(w.chinese) : "（尚未填寫）"}</td>
      <td class="editable" data-field="tag">${escapeHtml(w.tag)}</td>
      <td>${boxDots(w.box_level)}</td>
      <td>${w.correct_count} / ${w.wrong_count}</td>
      <td><button class="btn danger small btn-delete">刪除</button></td>
    `;
    tbody.appendChild(tr);
  });

  attachRowHandlers();
  updateBulkBar();
}

function speak(word) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  utter.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function attachRowHandlers() {
  document.querySelectorAll(".row-select").forEach((cb) => {
    cb.addEventListener("change", () => {
      const id = Number(cb.closest("tr").dataset.id);
      if (cb.checked) selectedIds.add(id); else selectedIds.delete(id);
      updateBulkBar();
    });
  });

  document.querySelectorAll(".speaker-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const english = btn.closest("td").textContent.trim();
      speak(english);
    });
  });

  document.querySelectorAll(".star-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = Number(tr.dataset.id);
      const w = allWords.find((x) => x.id === id);
      w.starred = w.starred ? 0 : 1;
      btn.classList.toggle("on", !!w.starred);
      btn.textContent = w.starred ? "⭐" : "☆";
      await fetch(`/api/words/${id}/star`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: !!w.starred }),
      });
    });
  });

  document.querySelectorAll(".word-table .editable").forEach((cell) => {
    cell.addEventListener("click", (e) => {
      if (e.target.classList.contains("speaker-btn")) return;
      if (cell.querySelector("input")) return;
      const field = cell.dataset.field;
      const id = Number(cell.closest("tr").dataset.id);
      const w = allWords.find((x) => x.id === id);
      const original = w[field] || "";
      cell.innerHTML = "";
      const input = document.createElement("input");
      input.type = "text";
      input.value = original;
      cell.appendChild(input);
      input.focus();
      const commit = async () => {
        const value = input.value.trim();
        w[field] = value;
        await fetch(`/api/words/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        });
        renderTable();
      };
      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e2) => { if (e2.key === "Enter") input.blur(); });
    });
  });

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = Number(tr.dataset.id);
      const w = allWords.find((x) => x.id === id);
      if (!confirm(`確定要刪除「${w.english}」嗎？`)) return;
      await fetch(`/api/words/${id}`, { method: "DELETE" });
      allWords = allWords.filter((x) => x.id !== id);
      selectedIds.delete(id);
      renderTable();
    });
  });
}

function updateBulkBar() {
  const bar = document.getElementById("bulk-bar");
  if (selectedIds.size === 0) {
    bar.classList.add("hidden");
    return;
  }
  bar.classList.remove("hidden");
  document.getElementById("bulk-count").textContent = `已選取 ${selectedIds.size} 個`;
}

document.getElementById("select-all").addEventListener("change", (e) => {
  if (e.target.checked) {
    allWords.forEach((w) => selectedIds.add(w.id));
  } else {
    selectedIds.clear();
  }
  renderTable();
});

document.getElementById("bulk-delete").addEventListener("click", async () => {
  if (!selectedIds.size) return;
  if (!confirm(`確定要刪除選取的 ${selectedIds.size} 個單字嗎？`)) return;
  await fetch("/api/words/bulk_delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [...selectedIds] }),
  });
  allWords = allWords.filter((w) => !selectedIds.has(w.id));
  selectedIds.clear();
  renderTable();
});

document.getElementById("bulk-move").addEventListener("click", async () => {
  const tag = document.getElementById("bulk-tag-input").value.trim();
  if (!tag || !selectedIds.size) return;
  await fetch("/api/words/bulk_tag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [...selectedIds], tag }),
  });
  document.getElementById("bulk-tag-input").value = "";
  selectedIds.clear();
  await reloadWords();
});

// ---- filters ----
async function reloadWords() {
  const params = new URLSearchParams();
  if (currentTag) params.set("tag", currentTag);
  if (currentSearch) params.set("q", currentSearch);
  if (currentStatus) params.set("status", currentStatus);
  const res = await fetch("/api/words/list?" + params.toString());
  const data = await res.json();
  allWords = data.words;
  renderTable();
}

document.getElementById("filter-tag").addEventListener("change", (e) => {
  currentTag = e.target.value;
  document.getElementById("export-link").href = "/api/words/export" + (currentTag ? `?tag=${encodeURIComponent(currentTag)}` : "");
  reloadWords();
});

let searchTimer = null;
document.getElementById("filter-search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentSearch = e.target.value.trim();
    reloadWords();
  }, 250);
});

document.querySelectorAll("#filter-status .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#filter-status .seg-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatus = btn.dataset.status;
    reloadWords();
  });
});

renderTable();
