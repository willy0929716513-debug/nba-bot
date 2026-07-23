@echo off
REM 一鍵設定並啟動「背單字」網站（Windows）。
REM 用法：在這個資料夾雙擊 start.bat，或在 cmd 執行 start.bat

cd /d %~dp0

where tesseract >nul 2>nul
if errorlevel 1 (
  echo 找不到 tesseract，照片辨識功能需要它才能用。
  echo 請至 https://github.com/UB-Mannheim/tesseract/wiki 下載安裝後再重新執行這個腳本。
  echo （其他功能不受影響，可以先繼續。）
) else (
  echo 已偵測到 tesseract。
)

echo.
echo == 設定 Python 虛擬環境 ==
if not exist venv (
  python -m venv venv
)
call venv\Scripts\activate.bat

echo.
echo == 安裝 Python 套件 ==
pip install -q --upgrade pip
pip install -q -r requirements.txt

echo.
echo == 啟動網站 ==
echo 打開瀏覽器到 http://127.0.0.1:5000
echo （關閉這個視窗可以停止網站）
echo.
python app.py
