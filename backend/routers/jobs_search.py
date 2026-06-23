import re
import subprocess
import json
import platform as _platform
from typing import Optional
from fastapi import APIRouter, Depends, Body, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Job, JobFavorite, Profile, Application
from auth import get_current_user
from datetime import datetime, timedelta
from job_sources import fetch_international_jobs
import httpx

from .jobs_data import MOCK_JOBS, parse_salary_min, _tokenize, _keyword_match_score, filter_jobs, validate_jd_urls

router = APIRouter(tags=["jobs"])


_AUTOCLI_PATH = (
    "/Users/wutianya/Desktop/我的AI工作系统/50-本地工具/autocli-mac"
    if _platform.system() == "Darwin"
    else "/Users/wutianya/Desktop/我的AI工作系统/50-本地工具/autocli.exe"
)


def try_autocli_search(keyword: str, city: str, platform: str) -> Optional[list[dict]]:
    """Try to search via autocli subprocess. Scrapes 3 pages (45 results). Falls back to variant queries."""
    # 构建搜索词：在城市有效时，把城市名加到关键词前面（autocli --city参数无效，但关键词搜索有效）
    search_query = keyword.strip()
    if not search_query:
        return None
    # autocli的--city参数不生效（默认返回北京），但关键词里加城市名可以过滤
    if city and city != "全部":
        search_query = f"{city} {search_query}"

    all_data = []
    for page in [1, 2, 3]:
        cmd = [
            _AUTOCLI_PATH, "boss", "search", search_query,
            "--format", "json", "--limit", "15", "--page", str(page)
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
            if result.returncode != 0:
                break
            # autocli outputs log lines to stdout before JSON; strip them
            stdout = result.stdout.strip()
            # Remove lines that look like log messages (start with timestamp)
            lines = stdout.split('\n')
            json_start = 0
            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped.startswith('[') or stripped.startswith('{'):
                    json_start = i
                    break
            cleaned_stdout = '\n'.join(lines[json_start:])
            try:
                data = json.loads(cleaned_stdout)
            except json.JSONDecodeError:
                break
            if not data or len(data) == 0:
                break
            if "Error" in data[0].get("name", ""):
                break
            all_data.extend(data)
            if len(data) < 15:
                break
        except subprocess.TimeoutExpired:
            break

    if all_data:
        normalized = []
        seen_urls = set()
        for item in all_data:
            url = item.get("url", "")
            if url in seen_urls:
                continue
            seen_urls.add(url)
            raw_city = item.get("area", "") or city
            normalized_city = raw_city.split("·")[0].strip() if "·" in raw_city else raw_city
            normalized.append({
                "title": item.get("name", ""),
                "company": item.get("company", ""),
                "salary": item.get("salary", ""),
                "city": normalized_city,
                "platform": "BOSS直聘",
                "jd_text": item.get("description", "") or item.get("skills", "") or item.get("name", ""),
                "jd_url": item.get("url", ""),
                "boss": item.get("boss", ""),
                "degree": item.get("degree", ""),
                "experience": item.get("experience", ""),
                "company_scale": item.get("company_scale", ""),
                "company_industry": item.get("company_industry", ""),
                "security_id": item.get("security_id", ""),
            })
        for job in normalized:
            if len(job.get("jd_text", "")) < 50:
                job["jd_text_incomplete"] = True
        return normalized

    return None


def try_liepin_search(keyword: str, city: str) -> Optional[list[dict]]:
    """Search Liepin via HTTP scraping. Returns None if unavailable."""
    try:
        import urllib.parse
        search_url = f"https://www.liepin.com/zhaopin/?key={urllib.parse.quote(keyword)}&dqs={urllib.parse.quote(city)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
        import httpx
        with httpx.Client(timeout=15, follow_redirects=True, headers=headers) as client:
            resp = client.get(search_url)
            if resp.status_code != 200:
                return None

            html = resp.text
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, 'html.parser')
            jobs = []
            for card in soup.select('.job-list-item, .job-card, [class*="job"]'):
                title_el = card.select_one('[class*="title"], [class*="name"], h3')
                company_el = card.select_one('[class*="company"], [class*="co-name"]')
                salary_el = card.select_one('[class*="salary"], [class*="pay"]')
                city_el = card.select_one('[class*="area"], [class*="city"], [class*="dqs"]')
                link_el = card.select_one('a[href*="job"]')

                if title_el:
                    title = title_el.get_text(strip=True)
                    company = company_el.get_text(strip=True) if company_el else ""
                    salary = salary_el.get_text(strip=True) if salary_el else ""
                    job_city = city_el.get_text(strip=True) if city_el else city
                    job_url = link_el.get("href", "") if link_el else ""
                    if job_url and not job_url.startswith("http"):
                        job_url = f"https://www.liepin.com{job_url}"

                    jobs.append({
                        "title": title,
                        "company": company,
                        "salary": salary,
                        "city": job_city,
                        "platform": "猎聘",
                        "jd_text": "",  # Liepin detail page needs separate fetch
                        "jd_url": job_url,
                        "boss": "",
                        "degree": "",
                        "experience": "",
                        "company_scale": "",
                        "company_industry": "",
                    })
            if jobs:
                return jobs
            return None
    except ImportError:
        pass
    except Exception as e:
        print(f"[liepin scrape error] {e}")
    return None


def try_boss_playwright_search(keyword: str, city: str, db: Session, user_id: int) -> Optional[list[dict]]:
    """使用 Cookie 搜索 BOSS直聘（优先 httpx，回退 Playwright）"""
    try:
        from models import PlatformAuth
        auth = db.query(PlatformAuth).filter(
            PlatformAuth.user_id == user_id,
            PlatformAuth.platform == "boss",
            PlatformAuth.status == "active"
        ).first()
        if not auth or not auth.cookies:
            return None  # 未登录，跳过

        # 检查过期
        if auth.expires_at and auth.expires_at < datetime.utcnow():
            auth.status = "expired"
            db.commit()
            return None

        cookies = auth.cookies

        # 判断 Cookie 格式：JSON 列表（旧 Playwright）还是原始字符串（新粘贴）
        is_raw_string = not cookies.strip().startswith("[")

        if is_raw_string:
            # 新格式：原始 Cookie 字符串，用 httpx 搜索（云端可用）
            from playwright_crawler import search_with_cookie_string
            jobs = search_with_cookie_string("boss", keyword, city, cookies)
        else:
            # 旧格式：JSON Cookie 列表，用 Playwright 搜索（仅本地）
            cookie_list = json.loads(cookies)
            from playwright_crawler import search_with_cookies
            jobs = search_with_cookies("boss", keyword, city, cookie_list)

        if jobs:
            for j in jobs:
                j["data_source"] = "boss"
            return jobs
    except Exception as e:
        print(f"[boss search error] {e}")
    return None


def try_liepin_mcp_search(keyword: str, city: str, db: Session, user_id: int) -> Optional[list[dict]]:
    """使用猎聘 MCP API 搜索猎聘岗位"""
    try:
        from models import PlatformAuth
        auth = db.query(PlatformAuth).filter(
            PlatformAuth.user_id == user_id,
            PlatformAuth.platform == "liepin",
            PlatformAuth.status == "active"
        ).first()
        if not auth or not auth.token:
            return None  # 未配置 Token，跳过

        # 检查过期
        if auth.expires_at and auth.expires_at < datetime.utcnow():
            auth.status = "expired"
            db.commit()
            return None

        from liepin_mcp_client import LiepinMCPClient
        client = LiepinMCPClient(auth.token)
        jobs = client.search_jobs(keyword, city)
        if jobs:
            for j in jobs:
                j["data_source"] = "liepin"
            return jobs
    except Exception as e:
        print(f"[liepin mcp search error] {e}")
    return None


def try_51job_playwright_search(keyword: str, city: str, db: Session, user_id: int) -> Optional[list[dict]]:
    """使用 Cookie 搜索前程无忧（优先 httpx，回退 Playwright）"""
    try:
        from models import PlatformAuth
        auth = db.query(PlatformAuth).filter(
            PlatformAuth.user_id == user_id,
            PlatformAuth.platform == "51job",
            PlatformAuth.status == "active"
        ).first()
        if not auth or not auth.cookies:
            return None

        if auth.expires_at and auth.expires_at < datetime.utcnow():
            auth.status = "expired"
            db.commit()
            return None

        cookies = auth.cookies

        # 判断 Cookie 格式
        is_raw_string = not cookies.strip().startswith("[")

        if is_raw_string:
            from playwright_crawler import search_with_cookie_string
            jobs = search_with_cookie_string("51job", keyword, city, cookies)
        else:
            cookie_list = json.loads(cookies)
            from playwright_crawler import search_with_cookies
            jobs = search_with_cookies("51job", keyword, city, cookie_list)

        if jobs:
            for j in jobs:
                j["data_source"] = "51job"
            return jobs
    except Exception as e:
        print(f"[51job search error] {e}")
    return None


class JobResponse(BaseModel):
    id: int
    title: str
    company: str
    salary: str
    city: str
    platform: str
    jd_text: str
    match_score: Optional[float] = None
    rating: Optional[int] = None
    status: str
    jd_url: str
    created_at: str

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    id: int
    title: str
    company: str
    salary: str
    city: str
    platform: str
    jd_text: str
    match_score: Optional[float] = None
    rating: Optional[int] = None
    status: str
    jd_url: str
    created_at: str

    class Config:
        from_attributes = True


class SearchRequest(BaseModel):
    keyword: str = ""
    keywords: list[str] = []
    city: str = "杭州"
    platform: str = ""
    include_international: bool = False  # Include Himalayas/Remotive results


@router.post("/jobs/search")
async def search_jobs(
    req: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Get user profile for filtering
    user_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()

    # Determine keywords to search: batch mode uses `keywords`, single mode uses `keyword`
    search_keywords: list[str] = req.keywords if req.keywords else ([req.keyword] if req.keyword else [])

    # Collect results per keyword with matched_keyword tag
    keyword_results: dict[str, list[dict]] = {}

    for kw in search_keywords:
        if not kw.strip():
            continue

        raw_jobs = []
        is_autocli = False
        is_liepin = False
        is_international = False

        # Determine which platforms to search
        want_boss = not req.platform or req.platform in ("", "BOSS直聘")
        want_liepin = not req.platform or req.platform == "猎聘"
        want_international = req.include_international or req.platform in ("", "Himalayas", "Remotive", "international")

        # Try international APIs (Himalayas + Remotive)
        if want_international:
            try:
                intl_jobs = await fetch_international_jobs(db, kw)
                if intl_jobs:
                    for j in intl_jobs:
                        j["data_source"] = j.get("data_source", "himalayas")
                    raw_jobs.extend(intl_jobs)
                    is_international = True
            except Exception as e:
                print(f"[international API error] {e}")

        # Try BOSS via Playwright + Cookie
        if want_boss:
            boss_jobs = try_boss_playwright_search(kw, req.city, db, current_user.id)
            if boss_jobs:
                # Fix URL: add securityId param so link doesn't break
                for j in boss_jobs:
                    sid = j.get("security_id", "")
                    if sid and j.get("jd_url", "").startswith("https://www.zhipin.com/job_detail/") and "securityId" not in j["jd_url"]:
                        j["jd_url"] = f"{j['jd_url']}?securityId={sid}"
                raw_jobs.extend(boss_jobs)
                is_autocli = True

        # Try Liepin via MCP API
        if want_liepin:
            liepin_jobs = try_liepin_mcp_search(kw, req.city, db, current_user.id)
            if liepin_jobs:
                raw_jobs.extend(liepin_jobs)
                is_liepin = True

        # Try 51job via Playwright + Cookie
        if not req.platform or req.platform in ("", "前程无忧"):
            jb_jobs = try_51job_playwright_search(kw, req.city, db, current_user.id)
            if jb_jobs:
                raw_jobs.extend(jb_jobs)

        # 如果国内源全部失败且未指定特定平台，自动补充国际搜索
        if not want_international and not raw_jobs and (not req.platform or req.platform in ("", "BOSS直聘", "猎聘")):
            try:
                intl_jobs = await fetch_international_jobs(db, kw)
                if intl_jobs:
                    for j in intl_jobs:
                        j["data_source"] = j.get("data_source", "himalayas")
                    raw_jobs.extend(intl_jobs)
                    is_international = True
            except Exception:
                pass

        # 始终搜索mock数据作为基础结果（不受真实源是否成功影响）
        kw_stripped = kw.strip()
        search_terms = _tokenize(kw_stripped)
        if search_terms:
            scored = []
            for job in MOCK_JOBS:
                score = _keyword_match_score(job, search_terms)
                if score > 0:
                    job_copy = dict(job)
                    job_copy["match_score"] = round(score, 0)
                    job_copy["data_source"] = "mock"
                    scored.append((score, job_copy))
            scored.sort(key=lambda x: x[0], reverse=True)
            mock_results = [job for _, job in scored]
        else:
            mock_results = []

        # 如果真实源无结果，用mock数据填充
        if not raw_jobs and mock_results:
            raw_jobs = mock_results
        elif raw_jobs and mock_results:
            # 真实结果和mock结果合并
            raw_jobs.extend(mock_results)

        # 对所有未评分的岗位（国际源、autocli、猎聘）进行关键词匹配评分
        if search_terms:
            for job in raw_jobs:
                src = job.get("data_source", "")
                if not job.get("match_score"):
                    score = _keyword_match_score(job, search_terms)
                    job["match_score"] = round(score, 0) if score > 0 else 0
                # BOSS直聘真实结果加10分奖励，确保优先于mock数据
                if src in ("autocli", "boss") and job.get("match_score", 0) > 0:
                    job["match_score"] = min(job["match_score"] + 10, 100)

        # 如果存在匹配分数>0的岗位，过滤掉0分岗位（不相关的国际岗位）
        scored_jobs = [j for j in raw_jobs if j.get("match_score", 0) > 0]
        if scored_jobs:
            raw_jobs = scored_jobs

        # 按匹配分数降序排序
        raw_jobs.sort(key=lambda x: x.get("match_score", 0), reverse=True)

        # Apply hard constraint filtering
        filtered = filter_jobs(raw_jobs, user_profile, req.city)
        keyword_results[kw.strip()] = filtered

    # Deduplicate by (title, company), tracking which keywords matched each job
    seen: dict[tuple[str, str], dict] = {}
    all_jobs: list[dict] = []
    for kw, jobs in keyword_results.items():
        for job_data in jobs:
            key = (job_data["title"], job_data["company"])
            if key in seen:
                # Append keyword to existing entry
                existing_keywords = seen[key].get("_matched_keywords", [])
                if kw not in existing_keywords:
                    existing_keywords.append(kw)
                    seen[key]["_matched_keywords"] = existing_keywords
            else:
                job_data["_matched_keywords"] = [kw]
                seen[key] = job_data
                all_jobs.append(job_data)

    # Save results to DB
    saved_jobs = []
    by_keyword: dict[str, int] = {}
    for job_data in all_jobs:
        existing = (
            db.query(Job)
            .filter(
                Job.user_id == current_user.id,
                Job.title == job_data["title"],
                Job.company == job_data["company"],
            )
            .first()
        )
        if existing:
            # 更新匹配分数（每次搜索关键词不同，分数可能变化）
            existing.match_score = job_data.get("match_score") or 0.0
            db.commit()
            db.refresh(existing)
            saved_jobs.append(existing)
        else:
            new_job = Job(
                user_id=current_user.id,
                title=job_data["title"],
                company=job_data["company"],
                salary=job_data["salary"],
                city=job_data["city"],
                platform=job_data["platform"],
                jd_text=job_data["jd_text"],
                jd_url=job_data.get("jd_url", ""),
                match_score=job_data.get("match_score") or 0.0,
                status="new",
            )
            db.add(new_job)
            db.commit()
            db.refresh(new_job)
            saved_jobs.append(new_job)

        # Count per keyword
        for kw in job_data.get("_matched_keywords", []):
            by_keyword[kw] = by_keyword.get(kw, 0) + 1

    # Build keyword mapping for results: job id -> matched keyword string
    job_keyword_map: dict[int, str] = {}
    job_source_map: dict[int, str] = {}
    job_scale_map: dict[int, str] = {}
    job_industry_map: dict[int, str] = {}
    for job_data, saved_job in zip(all_jobs, saved_jobs):
        keywords_list = job_data.get("_matched_keywords", [])
        job_keyword_map[saved_job.id] = ", ".join(keywords_list) if keywords_list else ""
        job_source_map[saved_job.id] = job_data.get("data_source", "")
        job_scale_map[saved_job.id] = job_data.get("company_scale", "")
        job_industry_map[saved_job.id] = job_data.get("company_industry", "")

    # Query favorites for current user's jobs
    saved_job_ids = [j.id for j in saved_jobs]
    favorites = (
        db.query(JobFavorite)
        .filter(JobFavorite.user_id == current_user.id, JobFavorite.job_id.in_(saved_job_ids))
        .all()
    ) if saved_job_ids else []
    favorited_job_ids = {fav.job_id: fav.created_at for fav in favorites}

    results = [
        {
            "id": j.id,
            "title": j.title,
            "company": j.company,
            "salary": j.salary,
            "city": j.city,
            "platform": j.platform,
            "jd_text": j.jd_text,
            "match_score": j.match_score if j.match_score else None,
            "rating": j.rating if j.rating else None,
            "status": j.status,
            "jd_url": j.jd_url,
            "created_at": j.created_at.isoformat() if isinstance(j.created_at, datetime) else str(j.created_at),
            "matched_keyword": job_keyword_map.get(j.id, ""),
            "data_source": job_source_map.get(j.id, ""),
            "company_scale": job_scale_map.get(j.id, ""),
            "company_industry": job_industry_map.get(j.id, ""),
            "favorited_at": favorited_job_ids[j.id].isoformat() if isinstance(favorited_job_ids.get(j.id), datetime) else str(favorited_job_ids[j.id]) if j.id in favorited_job_ids else None,
        }
        for j in saved_jobs
    ]

    # 最终按匹配分数降序排序（高分在前，无分数在后）
    results.sort(key=lambda x: x.get("match_score") or 0, reverse=True)

    display_keyword = req.keyword if req.keyword else (", ".join(req.keywords) if req.keywords else "")

    return {
        "results": results,
        "keyword": display_keyword,
        "city": req.city,
        "total": len(results),
        "by_keyword": by_keyword if req.keywords else None,
    }

@router.get("/jobs/international")
async def search_international_jobs(
    keyword: str = "",
    country: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search international job boards (Himalayas + Remotive) with caching."""
    if not keyword:
        return {"results": [], "total": 0, "sources": []}

    jobs = await fetch_international_jobs(db, keyword, country)

    # Deduplicate by (title, company)
    seen: dict[tuple[str, str], dict] = {}
    for job in jobs:
        key = (job.get("title", ""), job.get("company", ""))
        if key not in seen:
            seen[key] = job

    results = list(seen.values())

    # Count by source
    source_counts: dict[str, int] = {}
    for j in results:
        src = j.get("data_source", "unknown")
        source_counts[src] = source_counts.get(src, 0) + 1

    return {
        "results": results,
        "total": len(results),
        "sources": source_counts,
    }
