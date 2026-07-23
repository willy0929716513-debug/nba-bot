/* 瀏覽器端 OCR（用 Tesseract.js，完全在使用者的瀏覽器裡執行，不需要伺服器）。對應 ocr.py */
const Ocr = (() => {
  async function imageToText(file, onProgress) {
    if (typeof Tesseract === "undefined") {
      throw new Error("OCR 元件載入失敗，請確認網路連線後重新整理頁面再試一次。");
    }
    const result = await Tesseract.recognize(file, "eng", {
      logger: (m) => {
        if (onProgress && m.status === "recognizing text") {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    return result.data.text;
  }

  return { imageToText };
})();
