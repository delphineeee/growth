"""文件处理工具：PDF/DOCX 解析、图片 OCR"""

import io
from pathlib import Path
from typing import Optional


class FileHandler:
    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes) -> str:
        """从 PDF 字节流提取文本（使用 PyPDF2）"""
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            text = ""
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
            return text.strip()
        except Exception as e:
            return f"[PDF 解析错误: {e}]"

    @staticmethod
    def extract_text_from_docx(file_bytes: bytes) -> str:
        """从 DOCX 字节流提取文本"""
        try:
            from docx import Document
            doc = Document(io.BytesIO(file_bytes))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
            return text.strip()
        except Exception as e:
            return f"[DOCX 解析错误: {e}]"

    @staticmethod
    def extract_text_from_txt(file_bytes: bytes) -> str:
        try:
            return file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            return file_bytes.decode("gbk", errors="ignore").strip()

    @staticmethod
    def ocr_image(file_bytes: bytes) -> str:
        """OCR 识别图片中的文字（课表截图）"""
        try:
            from PIL import Image
            import paddleocr
            ocr = paddleocr.PaddleOCR(lang="ch", use_angle_cls=True, show_log=False)
            img = Image.open(io.BytesIO(file_bytes))
            import numpy as np
            result = ocr.ocr(np.array(img), cls=True)
            if result and result[0]:
                return "\n".join(line[1][0] for line in result[0])
            return ""
        except ImportError:
            return "[PaddleOCR 未安装，请运行: pip install paddleocr]"
        except Exception as e:
            return f"[OCR 错误: {e}]"

    @staticmethod
    def parse_uploaded_file(uploaded_file) -> tuple[str, str]:
        """通用文件解析入口
        Returns: (text_content, file_type)
        """
        file_bytes = uploaded_file.read()
        name = getattr(uploaded_file, "name", "").lower()

        if name.endswith(".pdf"):
            return FileHandler.extract_text_from_pdf(file_bytes), "pdf"
        elif name.endswith(".docx"):
            return FileHandler.extract_text_from_docx(file_bytes), "docx"
        elif name.endswith((".txt", ".csv")):
            return FileHandler.extract_text_from_txt(file_bytes), "txt"
        elif name.endswith((".png", ".jpg", ".jpeg", ".bmp")):
            text = FileHandler.ocr_image(file_bytes)
            return text, "image"
        else:
            return file_bytes.decode("utf-8", errors="ignore"), "unknown"
