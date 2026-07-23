/* 瀏覽器端 OCR（用 Tesseract.js，完全在使用者的瀏覽器裡執行，不需要伺服器）。對應 ocr.py */
const Ocr = (() => {
  async function imageToText(file, onProgress) {
    if (location.protocol === "file:") {
      throw new Error(
        "偵測到你是用「開啟檔案」的方式打開這個頁面（網址開頭是 file://）。" +
        "照片辨識需要瀏覽器的 Web Worker 功能，在這種開啟方式下通常會被瀏覽器擋掉。" +
        "請改用實際的網址（例如 GitHub Pages 給你的 https:// 網址，或用 start.sh/start.bat 啟動本機版）來開啟這個頁面再試一次。"
      );
    }
    if (typeof Tesseract === "undefined") {
      throw new Error(
        "OCR 元件載入失敗（可能是網路問題、瀏覽器擋住了外部資源，或廣告攔截套件擋住了 cdn.jsdelivr.net）。" +
        "請確認網路連線、暫時關閉廣告攔截套件後重新整理頁面再試一次；或先改用「貼上文字」/「上傳單字表檔案」新增單字。"
      );
    }
    let result;
    try {
      result = await Tesseract.recognize(file, "eng", {
        logger: (m) => {
          if (onProgress && m.status === "recognizing text") {
            onProgress(Math.round(m.progress * 100));
          }
        },
      });
    } catch (err) {
      throw new Error("辨識過程發生錯誤：" + (err && err.message ? err.message : err));
    }
    return result.data.text;
  }

  return { imageToText };
})();
