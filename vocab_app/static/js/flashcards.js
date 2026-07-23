let cards = [];
let idx = 0;
let flipped = false;
let knownCount = 0;

const setupCard = document.getElementById("setup-card");
const playCard = document.getElementById("play-card");
const doneCard = document.getElementById("done-card");
const flashcard = document.getElementById("flashcard");
const actions = document.getElementById("f-actions");

function speak(word) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  utter.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

document.getElementById("btn-start-flashcards").addEventListener("click", async () => {
  const tag = document.getElementById("f-tag").value;
  const dueOnly = document.getElementById("f-due-only").checked ? "1" : "0";
  const count = document.getElementById("f-count").value;
  const params = new URLSearchParams({ tag, due_only: dueOnly, count });
  const res = await fetch("/api/study/cards?" + params.toString());
  const data = await res.json();
  cards = data.cards || [];

  if (!cards.length && dueOnly === "1") {
    // 沒有到期的單字，改成不限定到期，抓全部
    const params2 = new URLSearchParams({ tag, due_only: "0", count });
    const res2 = await fetch("/api/study/cards?" + params2.toString());
    cards = (await res2.json()).cards || [];
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
  speak(cards[idx].english);
});
document.getElementById("f-speak-back").addEventListener("click", (e) => {
  e.stopPropagation();
  speak(cards[idx].english);
});

async function answer(known) {
  const c = cards[idx];
  if (known) knownCount += 1;
  await fetch("/api/quiz/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results: [{ word_id: c.word_id, correct: known }] }),
  });
  idx += 1;
  if (idx < cards.length) {
    showCard();
  } else {
    finish();
  }
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
  document.getElementById("f-summary").textContent =
    `這一輪複習了 ${cards.length} 張，記得 ${knownCount} 張。`;
}

document.getElementById("btn-restart").addEventListener("click", () => {
  doneCard.classList.add("hidden");
  setupCard.classList.remove("hidden");
});
