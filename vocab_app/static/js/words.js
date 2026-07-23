let currentEntries = [];

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
  return (s || "").replace(/[&<>"']/g, (c) => ({
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
  setTimeout(() => window.location.reload(), 900);
});

// ---- word bank table: inline edit / delete ----
document.querySelectorAll(".word-table .editable").forEach((cell) => {
  cell.addEventListener("click", () => {
    if (cell.querySelector("input")) return;
    const original = cell.textContent.trim() === "（尚未填寫）" ? "" : cell.textContent.trim();
    const input = document.createElement("input");
    input.type = "text";
    input.value = original;
    cell.textContent = "";
    cell.appendChild(input);
    input.focus();
    const commit = async () => {
      const value = input.value.trim();
      cell.textContent = value || "（尚未填寫）";
      const id = cell.closest("tr").dataset.id;
      const field = cell.dataset.field;
      await fetch(`/api/words/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  });
});

document.querySelectorAll(".btn-delete").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const tr = btn.closest("tr");
    if (!confirm(`確定要刪除「${tr.children[0].textContent.trim()}」嗎？`)) return;
    await fetch(`/api/words/${tr.dataset.id}`, { method: "DELETE" });
    tr.remove();
  });
});
