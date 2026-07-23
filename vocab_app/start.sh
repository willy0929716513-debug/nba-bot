#!/usr/bin/env bash
# 一鍵設定並啟動「背單字」網站（macOS / Linux）。
# 用法：cd vocab_app && ./start.sh
set -e
cd "$(dirname "$0")"

echo "== 檢查 Tesseract OCR（照片辨識單字用）=="
if ! command -v tesseract >/dev/null 2>&1; then
  echo "找不到 tesseract，嘗試自動安裝..."
  if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y tesseract-ocr
  elif command -v brew >/dev/null 2>&1; then
    brew install tesseract
  else
    echo "⚠️  無法自動安裝 tesseract（找不到 apt-get 或 brew）。"
    echo "    照片辨識功能會暫時無法使用，其他功能不受影響。"
    echo "    手動安裝方式請看 README.md。"
  fi
else
  echo "已安裝：$(tesseract --version | head -1)"
fi

echo
echo "== 設定 Python 虛擬環境 =="
if [ ! -d venv ]; then
  python3 -m venv venv
fi
source venv/bin/activate

echo
echo "== 安裝 Python 套件 =="
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo
echo "== 啟動網站 =="
echo "打開瀏覽器到 http://127.0.0.1:5000"
echo "（按 Ctrl+C 可以停止網站）"
echo
python app.py
