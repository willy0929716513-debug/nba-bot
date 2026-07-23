/* 共用的頁首 + 底部懸浮 Tab Bar + 深色模式切換。
   放一個 <div id="topbar-root"></div> 在 body 開頭即可，Tab Bar 會自動附加到 body 尾端。 */
(function () {
  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5a1 1 0 0 0 1 1H10v-6.5h4V20.5h3.5a1 1 0 0 0 1-1V10"/>',
    words: '<path d="M4 5.5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 1-2-2v-13z"/><path d="M20 5.5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 0 2-2v-13z"/>',
    cards: '<path d="M12 3l8.5 4.5L12 12 3.5 7.5 12 3z"/><path d="M3.5 12 12 16.5 20.5 12"/><path d="M3.5 16.5 12 21l8.5-4.5"/>',
    quiz: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    match: '<rect x="4" y="4" width="7" height="7" rx="1.8"/><rect x="13" y="4" width="7" height="7" rx="1.8"/><rect x="4" y="13" width="7" height="7" rx="1.8"/><rect x="13" y="13" width="7" height="7" rx="1.8"/>',
  };

  function icon(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
  }

  const links = [
    ["index.html", "總覽", "home"],
    ["words.html", "單字庫", "words"],
    ["flashcards.html", "單字卡", "cards"],
    ["quiz.html", "測驗", "quiz"],
    ["match.html", "配對", "match"],
  ];
  const here = location.pathname.split("/").pop() || "index.html";
  const isQuizFamily = here === "quiz.html" || here === "quiz-play.html";

  const root = document.getElementById("topbar-root");
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="index.html">📚 背單字</a>
      <nav>
        <button class="theme-toggle" id="theme-toggle" title="切換深色/淺色模式" aria-label="切換深色/淺色模式">🌙</button>
      </nav>
    </header>
    ${location.protocol === "file:" ? `
    <div class="status error" style="margin:0 0 12px;">
      ⚠️ 你是用「開啟檔案」的方式打開這個頁面（網址開頭是 file://）。部分功能（例如照片辨識）在這種開法下會被瀏覽器擋住。
      請改用 GitHub Pages 給你的 https:// 網址，或用 vocab_app 資料夾裡的 start.sh / start.bat 啟動本機版。
    </div>` : ""}
  `;

  const tabBar = document.createElement("nav");
  tabBar.className = "tab-bar";
  tabBar.setAttribute("aria-label", "主要導覽");
  tabBar.innerHTML = links
    .map(([href, label, iconName]) => {
      const active = href === here || (href === "quiz.html" && isQuizFamily);
      return `<a class="tab-item" href="${href}" ${active ? 'aria-current="page"' : ""}>${icon(iconName)}<span>${label}</span></a>`;
    })
    .join("");
  document.body.appendChild(tabBar);

  const btn = document.getElementById("theme-toggle");
  function currentTheme() {
    // Dark Mode First：沒有明確切換過的話一律視為深色，不看系統設定。
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }
  function updateIcon() {
    btn.textContent = currentTheme() === "dark" ? "☀️" : "🌙";
  }
  btn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("vocab-theme", next);
    updateIcon();
  });
  updateIcon();

  // 按鈕按壓漣漪效果（Apple Motion 風格的輕量互動回饋）
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".btn, .tab-item, .quiz-option, .tag-chip");
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const dot = document.createElement("span");
    const size = Math.max(rect.width, rect.height);
    dot.className = "ripple-dot";
    dot.style.width = dot.style.height = size + "px";
    dot.style.left = (e.clientX - rect.left - size / 2) + "px";
    dot.style.top = (e.clientY - rect.top - size / 2) + "px";
    const prevPosition = getComputedStyle(btn).position;
    if (prevPosition === "static") btn.style.position = "relative";
    btn.style.overflow = "hidden";
    btn.appendChild(dot);
    setTimeout(() => dot.remove(), 500);
  });
})();
