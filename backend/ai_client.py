"""AI client for calling Pinme LLM API (shared with 灵境 project)."""
import os
import httpx
from typing import Optional

# Pinme API config (shared with lingjing-e0c1 project)
# API Key must be provided via environment variable in production
PINME_BASE_URL = os.getenv("PINME_BASE_URL", "https://pinme.cloud")
PINME_API_KEY = os.getenv("PINME_API_KEY", "")
PINME_PROJECT_NAME = os.getenv("PINME_PROJECT_NAME", "lingjing-e0c1")


async def call_pinme_llm(
    system_prompt: str,
    user_message: str,
    model: str = "gpt-4o-mini",
    temperature: float = 0.7,
    max_tokens: int = 2000,
) -> Optional[str]:
    """Call Pinme chat/completions API and return the assistant's response text."""
    url = f"{PINME_BASE_URL}/api/v1/chat/completions?project_name={PINME_PROJECT_NAME}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                url,
                json=payload,
                headers={
                    "X-API-Key": PINME_API_KEY,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            # Extract assistant message
            choices = data.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")
            return None
        except Exception as e:
            print(f"[AI] Pinme API call failed: {e}")
            return None