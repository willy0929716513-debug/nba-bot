let cards = [];
let idx = 0;
let flipped = false;
let knownCount = 0;

document.getElementById("f-tag").innerHTML =
  `<option value="">全部單字</option>` + Store.listTags().map((t) => `<option value="${t}">${t}</option>`).join("");

const setupCard = document.getElementById("setup-card");
const playCard = document.getElementById("play-card");
const doneCard = document.getElementById("done-card");
const flashcard = document.getElementById("flashcard");
const actions = document.getElementById("f-actions");

document.getElementById("btn-start-flashcards").addEventListener("click", () => {
  const tagVal = document.getElementById("f-tag").value || null;
  const dueOnly = document.getElementById("f-due-only").checked;
  const count = Number(document.getElementById("f-count").value) || 20;

  cards = Store.pickQuizWords(tagVal, count, dueOnly);
  if (!cards.length && dueOnly) {
    cards = Store.pickQuizWords(tagVal, count, false);
  }

  if (!cards.length) {
    const err = document.getElementById("f-error");
    err.textContent = "這個範圍內沒有可以複習的單字（需要已經有中文意思的單字）。";
    err.classList.remove("hidden");
    return;
  }

  idx = 0;
  knownCount = 0;
  setupCard.classList.add("hidden");
  doneCard.classList.add("hidden");
  playCard.classList.remove("hidden");
  showCard();
});

function showCard() {
  const c = cards[idx];
  flipped = false;
  flashcard.classList.remove("flipped");
  actions.classList.add("hidden");
  document.getElementById("f-front-word").textContent = c.english;
  document.getElementById("f-back-word").textContent = c.chinese;
  document.getElementById("f-progress").textContent = `第 ${idx + 1} / ${cards.length} 張`;
}

flashcard.addEventListener("click", () => {
  flipped = !flipped;
  flashcard.classList.toggle("flipped", flipped);
  if (flipped) actions.classList.remove("hidden");
});

document.getElementById("f-speak-front").addEventListener("click", (e) => {
  e.stopPropagation();
  speakWord(cards[idx].english);
});
document.getElementById("f-speak-back").addEventListener("click", (e) => {
  e.stopPropagation();
  speakWord(cards[idx].english);
});

function answer(known) {
  const c = cards[idx];
  if (known) knownCount += 1;
  Store.recordResult(c.word_id ?? c.id, known);
  idx += 1;
  if (idx < cards.length) showCard();
  else finish();
}

document.getElementById("f-know").addEventListener("click", () => answer(true));
document.getElementById("f-dont-know").addEventListener("click", () => answer(false));

document.addEventListener("keydown", (e) => {
  if (playCard.classList.contains("hidden")) return;
  if (e.code === "Space") { e.preventDefault(); flashcard.click(); }
  if (!flipped) return;
  if (e.code === "ArrowRight") answer(true);
  if (e.code === "ArrowLeft") answer(false);
});

function finish() {
  playCard.classList.add("hidden");
  doneCard.classList.remove("hidden");
  document.getElementById("f-summary").textContent = `這一輪複習了 ${cards.length} 張，記得 ${knownCount} 張。`;
}

document.getElementById("btn-restart").addEventListener("click", () => {
  doneCard.classList.add("hidden");
  setupCard.classList.remove("hidden");
});
