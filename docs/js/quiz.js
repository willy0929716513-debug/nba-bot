const qparams = new URLSearchParams(window.location.search);
const tag = qparams.get("tag") || "";
const mode = qparams.get("mode") || "en2zh";
const count = Number(qparams.get("count")) || 10;
const dueOnly = qparams.get("due_only") === "1";

let questions = [];
let current = 0;
let results = [];

const bodyEl = document.getElementById("quiz-body");
const progressEl = document.getElementById("quiz-progress");

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildQuestions() {
  const words = Store.pickQuizWords(tag || null, count, dueOnly);
  if (!words.length) {
    bodyEl.innerHTML = `<p class="status error">這個範圍內沒有可以測驗的單字（需要已經有中文意思的單字）。</p>`;
    progressEl.textContent = "";
    return [];
  }
  const qs = words.map((w) => {
    const q = { word_id: w.id, mode };
    if (mode === "en2zh" || mode === "zh2en") {
      const field = mode === "en2zh" ? "chinese" : "english";
      const distractors = Store.randomDistractors(w.id, tag || null, field, 3);
      let options = [...new Set([...distractors, w[field]])];
      while (options.length < Math.min(4, words.length)) options.push(w[field]);
      shuffle(options);
      q.prompt = mode === "en2zh" ? w.english : w.chinese;
      q.options = options;
      q.answer = w[field];
    } else if (mode === "spelling") {
      q.prompt = w.chinese;
      q.answer = w.english;
    } else if (mode === "listening") {
      q.prompt = w.english;
      q.speak = w.english;
      q.answer = w.english;
    }
    return q;
  });
  return shuffle(qs);
}

function loadQuiz() {
  progressEl.textContent = "載入題目中...";
  questions = buildQuestions();
  if (questions.length) showQuestion();
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
  Store.recordResult(q.word_id, correct);
  delete bodyEl.dataset.answered;
  setTimeout(() => {
    current += 1;
    if (current < questions.length) showQuestion();
    else finishQuiz();
  }, 1000);
}

function finishQuiz() {
  document.getElementById("quiz-card").classList.add("hidden");
  const resultCard = document.getElementById("result-card");
  resultCard.classList.remove("hidden");
  const correctCount = results.filter((r) => r.correct).length;
  document.getElementById("result-summary").textContent = `答對 ${correctCount} / ${results.length} 題`;
  document.getElementById("result-detail").innerHTML = results
    .map((r) => `<div>${r.correct ? "✅" : "❌"} ${escapeHtml(r.prompt)} → ${escapeHtml(r.answer)}</div>`)
    .join("");
}

function escapeHtml(s) {
  return (s || "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

loadQuiz();
