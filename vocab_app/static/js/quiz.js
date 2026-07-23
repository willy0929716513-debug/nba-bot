const params = new URLSearchParams(window.location.search);
const tag = params.get("tag") || "";
const mode = params.get("mode") || "en2zh";
const count = params.get("count") || 10;
const dueOnly = params.get("due_only") === "1";

let questions = [];
let current = 0;
let results = [];

const bodyEl = document.getElementById("quiz-body");
const progressEl = document.getElementById("quiz-progress");

async function loadQuiz() {
  progressEl.textContent = "載入題目中...";
  const res = await fetch("/api/quiz/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag, mode, count: Number(count), due_only: dueOnly }),
  });
  const data = await res.json();
  if (data.error) {
    bodyEl.innerHTML = `<p class="status error">${data.error}</p>`;
    progressEl.textContent = "";
    return;
  }
  questions = data.questions;
  showQuestion();
}

function showQuestion() {
  const q = questions[current];
  progressEl.textContent = `第 ${current + 1} / ${questions.length} 題`;

  if (q.mode === "en2zh" || q.mode === "zh2en") {
    bodyEl.innerHTML = `
      <div class="quiz-prompt">${escapeHtml(q.prompt)}</div>
      <div class="quiz-options">
        ${q.options.map((o, i) => `<div class="quiz-option" data-i="${i}">${escapeHtml(o)}</div>`).join("")}
      </div>
      <div class="quiz-feedback"></div>
    `;
    bodyEl.querySelectorAll(".quiz-option").forEach((el) => {
      el.addEventListener("click", () => handleChoice(el, q));
    });
  } else if (q.mode === "spelling" || q.mode === "listening") {
    bodyEl.innerHTML = `
      <div class="quiz-prompt">${q.mode === "listening" ? "🔊 點下方按鈕聽發音" : escapeHtml(q.prompt)}</div>
      ${q.mode === "listening" ? `<button class="btn" id="btn-speak">▶️ 播放發音</button>` : ""}
      <input type="text" class="quiz-answer-input" id="answer-input" placeholder="輸入英文拼字" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
      <button class="btn primary" id="btn-submit-answer">送出</button>
      <div class="quiz-feedback"></div>
    `;
    if (q.mode === "listening") {
      const speak = () => speakWord(q.speak);
      document.getElementById("btn-speak").addEventListener("click", speak);
      speak();
    }
    const input = document.getElementById("answer-input");
    input.focus();
    const submit = () => handleTyped(input.value, q);
    document.getElementById("btn-submit-answer").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  }
}

function speakWord(word) {
  if (!("speechSynthesis" in window)) return;
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  utter.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

function handleChoice(el, q) {
  if (bodyEl.dataset.answered) return;
  bodyEl.dataset.answered = "1";
  const correct = el.textContent.trim() === q.answer;
  el.classList.add(correct ? "correct" : "wrong");
  if (!correct) {
    bodyEl.querySelectorAll(".quiz-option").forEach((o) => {
      if (o.textContent.trim() === q.answer) o.classList.add("correct");
    });
  }
  const fb = bodyEl.querySelector(".quiz-feedback");
  fb.textContent = correct ? "答對了！" : `答錯了，正確答案是：${q.answer}`;
  fb.classList.add(correct ? "correct" : "wrong");
  recordAndNext(q, correct);
}

function handleTyped(value, q) {
  if (bodyEl.dataset.answered) return;
  bodyEl.dataset.answered = "1";
  const correct = value.trim().toLowerCase() === q.answer.trim().toLowerCase();
  const fb = bodyEl.querySelector(".quiz-feedback");
  fb.textContent = correct ? "答對了！" : `答錯了，正確答案是：${q.answer}`;
  fb.classList.add(correct ? "correct" : "wrong");
  document.getElementById("answer-input").disabled = true;
  recordAndNext(q, correct);
}

function recordAndNext(q, correct) {
  results.push({ word_id: q.word_id, correct, prompt: q.prompt, answer: q.answer });
  delete bodyEl.dataset.answered;
  setTimeout(() => {
    current += 1;
    if (current < questions.length) {
      showQuestion();
    } else {
      finishQuiz();
    }
  }, 1000);
}

async function finishQuiz() {
  document.getElementById("quiz-card").classList.add("hidden");
  const resultCard = document.getElementById("result-card");
  resultCard.classList.remove("hidden");
  const correctCount = results.filter((r) => r.correct).length;
  document.getElementById("result-summary").textContent =
    `答對 ${correctCount} / ${results.length} 題`;
  document.getElementById("result-detail").innerHTML = results
    .map((r) => `<div>${r.correct ? "✅" : "❌"} ${escapeHtml(r.prompt)} → ${escapeHtml(r.answer)}</div>`)
    .join("");

  await fetch("/api/quiz/grade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results }),
  });
}

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

loadQuiz();
