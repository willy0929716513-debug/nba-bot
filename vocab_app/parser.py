"""將使用者貼上的文字 / OCR 辨識出的文字，自動拆解、排版成「英文 - 中文」單字清單。"""
import re

_BULLET_RE = re.compile(r"^[\-\*•\d]+[\.\)、]?\s*")
_ENGLISH_WORD_RE = re.compile(r"[A-Za-z][A-Za-z'\-]*")
_ENGLISH_ONLY_RE = re.compile(r"^[A-Za-z][A-Za-z .'\-]*$")
_CJK_RE = re.compile(r"[一-鿿]")
_SEPARATOR_STRIP = " \t　:：,，－-–—="
_PURE_NUMBER_RE = re.compile(r"^\d+\.?$")
_SEPARATOR_ROW_RE = re.compile(r"^:?-{2,}:?$")


def _clean_chinese(text):
    return text.strip(_SEPARATOR_STRIP + "。、；;.")


# ---- Markdown 表格（| 欄位 | 欄位 | ... |）支援：片語/多字詞組常出現在表格裡 ----

def _split_cells(line):
    return [c.strip() for c in line.split("|") if c.strip()]


def _is_table_line(line):
    return "|" in line and len(_split_cells(line)) >= 2


def _is_separator_row(cells):
    return bool(cells) and all(_SEPARATOR_ROW_RE.match(c) for c in cells)


def _extract_row_entry(cells):
    chi_cell = None
    eng_cell = None
    for c in cells:
        if _PURE_NUMBER_RE.match(c):
            continue  # 跳過編號欄
        if chi_cell is None and _CJK_RE.search(c):
            chi_cell = c
            continue
        if eng_cell is None and re.search(r"[A-Za-z]", c) and _ENGLISH_ONLY_RE.match(c):
            eng_cell = c
    if eng_cell and chi_cell:
        return eng_cell, _clean_chinese(chi_cell)
    return None


def _extract_table_blocks(raw_lines):
    entries = []
    consumed = set()
    i = 0
    n = len(raw_lines)
    while i < n:
        if not _is_table_line(raw_lines[i]):
            i += 1
            continue
        block = []
        j = i
        while j < n and _is_table_line(raw_lines[j]):
            block.append(j)
            j += 1

        sep_idx = None
        for idx in block:
            if _is_separator_row(_split_cells(raw_lines[idx])):
                sep_idx = idx
                break
        data_idxs = [idx for idx in block if sep_idx is not None and idx > sep_idx] if sep_idx is not None else block
        consumed.update(block)

        for idx in data_idxs:
            entry = _extract_row_entry(_split_cells(raw_lines[idx]))
            if entry:
                entries.append(entry)
        i = j
    return entries, consumed


def parse_bulk_words(raw_text):
    """
    輸入任意格式的貼上文字（每行一個字、每行「word 中文」、Markdown 表格、
    或用逗號/空白隔開的一大串單字），自動判斷格式並整理成
    [{"english": ..., "chinese": ...}, ...]。
    沒有偵測到中文意思的項目，chinese 會是空字串，交由呼叫端自動查詢或使用者手動補上。
    """
    entries = []
    seen = set()

    def add(english, chinese=""):
        english = english.strip().strip(".,;:").strip()
        if not english:
            return
        key = english.lower()
        if key in seen:
            # 若之前沒有中文意思，這次有補上，就更新
            if chinese:
                for e in entries:
                    if e["english"].lower() == key and not e["chinese"]:
                        e["chinese"] = _clean_chinese(chinese)
            return
        seen.add(key)
        entries.append({"english": english, "chinese": _clean_chinese(chinese) if chinese else ""})

    raw_lines = raw_text.splitlines()
    table_entries, consumed = _extract_table_blocks(raw_lines)
    for english, chinese in table_entries:
        add(english, chinese)

    lines = [
        raw_lines[idx].strip()
        for idx in range(len(raw_lines))
        if raw_lines[idx].strip() and idx not in consumed
    ]

    for raw_line in lines:
        line = _BULLET_RE.sub("", raw_line).strip()
        if not line:
            continue

        # 這行前段是英文、後段是中文意思：不管中間用什麼分隔（空白、全形空白、
        # 冒號、逗號、破折號，或完全沒有分隔如 "apple蘋果"），一律用「第一個中文字」
        # 當作分界點來切開。
        cjk_match = _CJK_RE.search(line)
        if cjk_match and cjk_match.start() > 0:
            eng_part = line[: cjk_match.start()].strip(_SEPARATOR_STRIP)
            chi_part = line[cjk_match.start():]
            if eng_part and _ENGLISH_ONLY_RE.match(eng_part):
                add(eng_part, chi_part)
                continue

        # 找不到明確的中文對照，整行可能是「一次貼上一堆英文單字」，用逗號/空白/分號切開
        tokens = _ENGLISH_WORD_RE.findall(line)
        for t in tokens:
            add(t)

    return entries
