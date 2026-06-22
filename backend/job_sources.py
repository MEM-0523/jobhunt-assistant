"""External job API integrations: Himalayas, Remotive, and public ATS feeds.

All sources are free, public APIs that do not require authentication.
Data is cached in job_cache table to reduce API calls.
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional, Union
from sqlalchemy.orm import Session
from models import JobCache


# Cache duration: 24 hours
CACHE_TTL_HOURS = 24


async def _fetch_json(url: str, timeout: float = 15.0) -> Optional[Union[dict, list]]:
    """Fetch JSON from a URL with error handling."""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        try:
            resp = await client.get(url, headers={"Accept": "application/json"})
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"[API] Fetch failed for {url}: {e}")
            return None


def _get_cached_jobs(db: Session, source: str, keyword: str = "") -> list[dict]:
    """Get cached jobs from database if not expired."""
    cutoff = datetime.utcnow() - timedelta(hours=CACHE_TTL_HOURS)
    query = db.query(JobCache).filter(
        JobCache.source == source,
        JobCache.fetched_at >= cutoff,
    )
    if keyword:
        query = query.filter(JobCache.title.ilike(f"%{keyword}%"))
    cached = query.all()
    return [_job_cache_to_dict(jc) for jc in cached]


def _save_to_cache(db: Session, source: str, jobs: list[dict]) -> None:
    """Save fetched jobs to cache, deduplicating by (source, source_id)."""
    for job in jobs:
        source_id = job.get("source_id", "")
        if not source_id:
            continue
        existing = db.query(JobCache).filter(
            JobCache.source == source,
            JobCache.source_id == source_id,
        ).first()
        if existing:
            # Update existing record
            for key, val in job.items():
                if hasattr(existing, key) and key not in ("id", "source", "source_id"):
                    setattr(existing, key, val)
            existing.fetched_at = datetime.utcnow()
        else:
            jc = JobCache(
                source=source,
                source_id=source_id,
                title=job.get("title", ""),
                company=job.get("company", ""),
                salary=job.get("salary", ""),
                city=job.get("city", ""),
                country=job.get("country", ""),
                platform=job.get("platform", source),
                jd_text=job.get("jd_text", ""),
                jd_url=job.get("jd_url", ""),
                remote=job.get("remote", False),
                employment_type=job.get("employment_type", ""),
                categories=job.get("categories", []),
                raw_data=job.get("raw_data", {}),
                fetched_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(hours=CACHE_TTL_HOURS),
            )
            db.add(jc)
    db.commit()


def _job_cache_to_dict(jc: JobCache) -> dict:
    """Convert JobCache model to dict matching job search result format."""
    return {
        "title": jc.title,
        "company": jc.company,
        "salary": jc.salary or "面议",
        "city": jc.city or ("远程" if jc.remote else ""),
        "platform": jc.platform,
        "jd_text": jc.jd_text,
        "jd_url": jc.jd_url,
        "data_source": jc.source,
        "remote": jc.remote,
        "country": jc.country,
        "employment_type": jc.employment_type,
        "categories": jc.categories or [],
    }


# ============================================================
# Himalayas Jobs API (free, no key required)
# Docs: https://himalayas.app/jobs/api
# ============================================================

async def fetch_himalayas_jobs(keyword: str, country: str = "") -> list[dict]:
    """Fetch jobs from Himalayas Jobs API.

    Args:
        keyword: Search keyword (e.g. "AI产品经理", "product manager")
        country: Country filter (e.g. "CN", "US", "" for all)

    Returns:
        List of normalized job dicts with source_id set.
    """
    import urllib.parse
    params = {"q": keyword}
    if country:
        params["country"] = country
    query_string = urllib.parse.urlencode(params)
    url = f"https://himalayas.app/jobs/api/search?{query_string}"

    data = await _fetch_json(url)
    if not data or not isinstance(data, dict):
        return []

    jobs_raw = data.get("jobs", [])
    normalized = []
    for j in jobs_raw:
        job_id = j.get("guid", "") or j.get("id", "") or ""
        title = j.get("title", "") or j.get("position_name", "")
        company = j.get("companyName", "") or j.get("company", "")
        if isinstance(company, dict):
            company = company.get("name", "")
        description = j.get("description", "") or j.get("excerpt", "")
        # Himalayas uses 'guid' and 'applicationLink' for job URLs
        url_val = j.get("applicationLink", "") or j.get("guid", "") or j.get("url", "") or j.get("apply_url", "")
        if url_val and not url_val.startswith("http"):
            url_val = f"https://himalayas.app{url_val}"

        # Location: Himalayas uses 'locationRestrictions' (list) or 'location' (string)
        location = j.get("location", "")
        if not location:
            loc_restrictions = j.get("locationRestrictions", [])
            if isinstance(loc_restrictions, list) and loc_restrictions:
                location = loc_restrictions[0] if isinstance(loc_restrictions[0], str) else str(loc_restrictions[0])

        categories = j.get("categories", [])
        if isinstance(categories, list):
            cat_names = [c.get("name", "") if isinstance(c, dict) else str(c) for c in categories]
        else:
            cat_names = []

        normalized.append({
            "source_id": job_id,
            "title": title,
            "company": company,
            "salary": j.get("salary", "") or "面议",
            "city": location or "",
            "country": j.get("country", ""),
            "platform": "Himalayas",
            "jd_text": description,
            "jd_url": url_val,
            "remote": j.get("is_remote", False),
            "employment_type": j.get("employment_type", ""),
            "categories": cat_names,
            "raw_data": j,
        })
    return normalized


# ============================================================
# Remotive API (free, no key required)
# Docs: https://remotive.com/api/remote-jobs
# ============================================================

async def fetch_remotive_jobs(keyword: str, category: str = "") -> list[dict]:
    """Fetch jobs from Remotive API.

    Args:
        keyword: Search keyword
        category: Category filter (e.g. "software", "product", "design")

    Returns:
        List of normalized job dicts with source_id set.
    """
    import urllib.parse
    params = {"search": keyword}
    if category:
        params["category"] = category
    query_string = urllib.parse.urlencode(params)
    url = f"https://remotive.com/api/remote-jobs?{query_string}"

    data = await _fetch_json(url)
    if not data or not isinstance(data, dict):
        return []

    jobs_raw = data.get("jobs", [])
    normalized = []
    for j in jobs_raw:
        job_id = str(j.get("id", ""))
        title = j.get("title", "")
        company = j.get("company_name", "")
        description = j.get("description", "")
        url_val = j.get("url", "")
        salary = j.get("salary", "")
        if salary:
            salary = f"${salary}" if not salary.startswith("$") else salary
        else:
            salary = "面议"

        normalized.append({
            "source_id": job_id,
            "title": title,
            "company": company,
            "salary": salary,
            "city": "远程",
            "country": "Global",
            "platform": "Remotive",
            "jd_text": description,
            "jd_url": url_val,
            "remote": True,
            "employment_type": j.get("job_type", ""),
            "categories": [j.get("category", "")] if j.get("category") else [],
            "raw_data": j,
        })
    return normalized


# ============================================================
# Unified fetch with caching
# ============================================================

async def fetch_international_jobs(
    db: Session,
    keyword: str,
    country: str = "",
    use_cache: bool = True,
) -> list[dict]:
    """Fetch international jobs from Himalayas + Remotive with caching.

    Args:
        db: Database session
        keyword: Search keyword
        country: Optional country filter
        use_cache: Whether to use cache (default True)

    Returns:
        Combined list of normalized job dicts.
    """
    # Check cache first
    if use_cache:
        cached_himalayas = _get_cached_jobs(db, "himalayas", keyword)
        cached_remotive = _get_cached_jobs(db, "remotive", keyword)
        if cached_himalayas or cached_remotive:
            return cached_himalayas + cached_remotive

    # Fetch from APIs
    all_jobs = []

    himalayas_jobs = await fetch_himalayas_jobs(keyword, country)
    if himalayas_jobs:
        _save_to_cache(db, "himalayas", himalayas_jobs)
        all_jobs.extend([_strip_cache_fields(j) for j in himalayas_jobs])

    remotive_jobs = await fetch_remotive_jobs(keyword)
    if remotive_jobs:
        _save_to_cache(db, "remotive", remotive_jobs)
        all_jobs.extend([_strip_cache_fields(j) for j in remotive_jobs])

    return all_jobs


def _strip_cache_fields(job: dict) -> dict:
    """Remove internal cache fields from job dict before returning to caller."""
    return {k: v for k, v in job.items() if k not in ("source_id", "raw_data")}
