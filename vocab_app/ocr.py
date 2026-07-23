"""從照片中辨識出英文單字（使用本機 Tesseract OCR，不需要外部 API）。"""
from PIL import Image, ImageOps
import pytesseract


class OcrUnavailableError(RuntimeError):
    pass


def image_to_text(file_storage):
    try:
        img = Image.open(file_storage.stream)
    except Exception as exc:
        raise ValueError(f"無法讀取圖片：{exc}") from exc

    img = ImageOps.exif_transpose(img)
    img = img.convert("L")
    # 圖片放大有助於辨識較小的手寫或印刷字體
    if img.width < 1200:
        scale = 1200 / img.width
        img = img.resize((int(img.width * scale), int(img.height * scale)))

    try:
        return pytesseract.image_to_string(img, lang="eng")
    except pytesseract.TesseractNotFoundError as exc:
        raise OcrUnavailableError(
            "伺服器尚未安裝 Tesseract OCR，請參考 README 安裝後再試一次。"
        ) from exc
