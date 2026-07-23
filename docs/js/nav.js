/* 共用的頁首導覽列 + 深色模式切換。放一個 <div id="topbar-root"></div> 在 body 開頭即可。 */
(function () {
  const links = [
    ["index.html", "總覽"],
    ["words.html", "單字庫"],
    ["flashcards.html", "單字卡"],
    ["quiz.html", "測驗"],
    ["match.html", "配對遊戲"],
  ];
  const here = location.pathname.split("/").pop() || "index.html";

  const nav = links
    .map(([href, label]) => `<a href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a>`)
    .join("");

  const root = document.getElementById("topbar-root");
  root.innerHTML = `
    <header class="topbar">
      <a class="brand" href="index.html">📚 背單字</a>
      <nav>
        ${nav}
        <button class="theme-toggle" id="theme-toggle" title="切換深色/淺色模式">🌙</button>
      </nav>
    </header>
    ${location.protocol === "file:" ? `
    <div class="status error" style="margin:12px 16px 0; border-radius:8px;">
      ⚠️ 你是用「開啟檔案」的方式打開這個頁面（網址開頭是 file://）。部分功能（例如照片辨識）在這種開法下會被瀏覽器擋住。
      請改用 GitHub Pages 給你的 https:// 網址，或用 vocab_app 資料夾裡的 start.sh / start.bat 啟動本機版。
    </div>` : ""}
  `;

  const btn = document.getElementById("theme-toggle");
  function currentTheme() {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr) return attr;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
})();
