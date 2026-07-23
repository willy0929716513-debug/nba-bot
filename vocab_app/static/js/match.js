let tiles = [];
let selected = [];
let matchedWordIds = new Set();
let mistakes = 0;
let timerHandle = null;
let seconds = 0;
let pairCount = 0;

const setupCard = document.getElementById("setup-card");
const playCard = document.getElementById("play-card");
const doneCard = document.getElementById("done-card");
const grid = document.getElementById("match-grid");

document.getElementById("btn-start-match").addEventListener("click", async () => {
  const tag = document.getElementById("m-tag").value;
  const count = document.getElementById("m-count").value;
  const res = await fetch("/api/study/match?" + new URLSearchParams({ tag, count }));
  const data = await res.json();
  if (data.error) {
    const err = document.getElementById("m-error");
    err.textContent = data.error;
    err.classList.remove("hidden");
    return;
  }

  pairCount = data.pairs.length;
  tiles = [];
  data.pairs.forEach((p) => {
    tiles.push({ word_id: p.word_id, text: p.english, type: "en" });
    tiles.push({ word_id: p.word_id, text: p.chinese, type: "zh" });
  });
  shuffle(tiles);

  selected = [];
  matchedWordIds = new Set();
  mistakes = 0;
  seconds = 0;
  document.getElementById("m-mistakes").textContent = "0";
  document.getElementById("m-timer").textContent = "0";

  setupCard.classList.add("hidden");
  doneCard.classList.add("hidden");
  playCard.classList.remove("hidden");
  renderGrid();

  clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    seconds += 1;
    document.getElementById("m-timer").textContent = seconds;
  }, 1000);
});

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function renderGrid() {
  grid.innerHTML = "";
  tiles.forEach((t, i) => {
    const el = document.createElement("button");
    el.className = "match-tile";
    el.textContent = t.text;
    el.dataset.i = i;
    if (matchedWordIds.has(t.word_id)) {
      el.classList.add("matched");
      el.disabled = true;
    }
    el.addEventListener("click", () => onTileClick(i));
    grid.appendChild(el);
  });
}

function onTileClick(i) {
  const t = tiles[i];
  if (matchedWordIds.has(t.word_id)) return;
  if (selected.some((s) => s.i === i)) return;
  if (selected.length === 2) return;

  const el = grid.querySelector(`[data-i="${i}"]`);
  el.classList.add("selected");
  selected.push({ i, ...t });

  if (selected.length === 2) {
    const [a, b] = selected;
    if (a.word_id === b.word_id && a.type !== b.type) {
      matchedWordIds.add(a.word_id);
      setTimeout(() => {
        renderGrid();
        selected = [];
        if (matchedWordIds.size === pairCount) finish();
      }, 250);
    } else {
      mistakes += 1;
      document.getElementById("m-mistakes").textContent = mistakes;
      setTimeout(() => {
        grid.querySelectorAll(".selected").forEach((n) => n.classList.remove("selected"));
        selected = [];
      }, 600);
    }
  }
}

async function finish() {
  clearInterval(timerHandle);
  playCard.classList.add("hidden");
  doneCard.classList.remove("hidden");
  document.getElementById("m-summary").textContent =
    `花了 ${seconds} 秒，配對錯誤 ${mistakes} 次。`;
  const results = [...matchedWordIds].map((id) => ({ word_id: id, correct: true }));
  await fetch("/api/quiz/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results }),
  });
}

document.getElementById("btn-restart").addEventListener("click", () => {
  clearInterval(timerHandle);
  doneCard.classList.add("hidden");
  setupCard.classList.remove("hidden");
});
