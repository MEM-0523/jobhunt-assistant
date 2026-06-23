"""JD图片OCR识别接口（百度云OCR）"""
import os
import base64
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from models import User
from auth import get_current_user

router = APIRouter(tags=["jd-ocr"])

# 百度云OCR配置（从环境变量读取）
BAIDU_API_KEY = os.getenv("BAIDU_OCR_API_KEY", "")
BAIDU_SECRET_KEY = os.getenv("BAIDU_OCR_SECRET_KEY", "")

# 内存缓存access_token（有效期30天）
_access_token_cache: dict = {"token": "", "expires_at": 0}


async def get_baidu_access_token() -> str:
    """获取百度云API的access_token"""
    import time
    now = time.time()
    if _access_token_cache["token"] and _access_token_cache["expires_at"] > now + 60:
        return _access_token_cache["token"]

    if not BAIDU_API_KEY or not BAIDU_SECRET_KEY:
        raise HTTPException(status_code=500, detail="百度云OCR未配置，请设置BAIDU_OCR_API_KEY和BAIDU_OCR_SECRET_KEY环境变量")

    url = "https://aip.baidubce.com/oauth/2.0/token"
    params = {
        "grant_type": "client_credentials",
        "client_id": BAIDU_API_KEY,
        "client_secret": BAIDU_SECRET_KEY,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    token = data.get("access_token")
    expires_in = data.get("expires_in", 2592000)
    if not token:
        raise HTTPException(status_code=500, detail="获取百度云access_token失败")

    _access_token_cache["token"] = token
    _access_token_cache["expires_at"] = now + expires_in
    return token


@router.post("/jd/ocr")
async def ocr_jd_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传JD图片，返回OCR识别文本"""
    # 验证文件类型
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise HTTPException(status_code=400, detail="仅支持 JPG/PNG/WebP/GIF 图片格式")

    # 读取图片
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="图片大小不能超过10MB")

    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    try:
        access_token = await get_baidu_access_token()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取OCR凭证失败: {str(e)}")

    # 调用百度云通用文字识别（高精度版）
    ocr_url = f"https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token={access_token}"
    data = {
        "image": image_base64,
        "language_type": "CHN_ENG",  # 中英文混合
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(ocr_url, data=data)
            resp.raise_for_status()
            result = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"OCR服务请求失败: {str(e)}")

    if "error_code" in result:
        raise HTTPException(
            status_code=502,
            detail=f"OCR识别失败: [{result.get('error_code')}] {result.get('error_msg', '未知错误')}"
        )

    # 提取文字
    words_list = [item.get("words", "") for item in result.get("words_result", [])]
    text = "\n".join(words_list)

    return {
        "text": text,
        "words_count": len(words_list),
        "log_id": result.get("log_id"),
    }
