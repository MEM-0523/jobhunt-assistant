import io


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text.strip() or "[PDF文本提取失败，请手动输入或上传Markdown格式]"
    except Exception:
        return "[PDF文本提取失败，请手动输入或上传Markdown格式]"


def extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        text = ""
        for para in doc.paragraphs:
            if para.text.strip():
                if para.style.name.startswith('Heading 1'):
                    text += f"\n# {para.text}\n"
                elif para.style.name.startswith('Heading 2'):
                    text += f"\n## {para.text}\n"
                elif para.style.name.startswith('Heading 3'):
                    text += f"\n### {para.text}\n"
                else:
                    text += para.text + "\n"
        return text.strip() or "[DOCX文本提取失败，请手动输入或上传Markdown格式]"
    except Exception:
        return "[DOCX文本提取失败，请手动输入或上传Markdown格式]"