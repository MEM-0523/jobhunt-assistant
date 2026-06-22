"""多平台招聘网站爬虫（BOSS直聘 / 前程无忧 / 猎聘 / 智联招聘）。

使用 Playwright 独立 Chromium（不依赖用户系统 Chrome）：
- login_and_save_cookies: 非 headless 启动浏览器，用户手动登录后保存 Cookie 到 DB
- search_with_cookies: headless 启动浏览器，注入已保存 Cookie 后抓取岗位列表

注意：
- 所有异常均被捕获，失败时返回空列表 / False，不阻塞调用方。
- 每个平台搜索超时 20 秒；若页面要求登录，返回空列表。
"""
from __future__ import annotations

import json
import urllib.parse
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


# 单次搜索超时（毫秒）
SEARCH_TIMEOUT_MS = 20_000

# 登录轮询超时（秒）
LOGIN_TIMEOUT_SEC = 120

# 城市名 -> 各平台城市编码（仅列常用城市，未命中时传原名）
CITY_CODES = {
    "boss": {
        "杭州": "101210100", "北京": "101010100", "上海": "101020100",
        "深圳": "101280600", "广州": "101280101", "成都": "101270101",
        "南京": "101190101", "武汉": "101200101", "西安": "101110101",
        "苏州": "101190401", "厦门": "101230201", "长沙": "101250101",
    },
    "51job": {
        "杭州": "080200", "北京": "010000", "上海": "020000",
        "深圳": "040000", "广州": "030200", "成都": "090200",
        "南京": "070200", "武汉": "180200", "西安": "200200",
    },
}

# 旧版城市编码映射（保留供 deprecated 函数使用）
_CITY_CODE_LIEPIN = {
    "北京": "010", "上海": "020", "杭州": "050020",
    "深圳": "050090", "广州": "050020", "南京": "060020",
    "苏州": "060080", "成都": "280020", "武汉": "170020",
    "西安": "260010", "厦门": "090020", "长沙": "190010",
}
_CITY_CODE_51JOB = CITY_CODES["51job"]
_CITY_CODE_ZHAOPIN = {
    "北京": "530", "上海": "538", "杭州": "653",
    "深圳": "765", "广州": "763", "南京": "635",
    "苏州": "639", "成都": "801", "武汉": "736",
    "西安": "854", "厦门": "682", "长沙": "749",
}

# 各平台登录页 URL
LOGIN_URLS = {
    "boss": "https://www.zhipin.com/",
    "51job": "https://login.51job.com/",
}

# 各平台登录成功判定（URL 前缀 + 关键 Cookie 名）
LOGIN_SUCCESS = {
    "boss": {
        "url_prefix": "https://www.zhipin.com/",
        "cookie_keys": ["wt2", "wbg"],
    },
    "51job": {
        "url_prefix": "https://we.51job.com/",
        "cookie_keys": ["acw_tc", "51job_session"],
    },
}

# 各平台搜索页 URL 模板
SEARCH_URL_TEMPLATES = {
    "boss": "https://www.zhipin.com/web/geek/job?query={keyword}&city={city_code}",
    "51job": "https://we.51job.com/pc/search?keyword={keyword}&jobArea={city_code}",
}


# Stealth v2.0 反检测脚本（借鉴 Auto-JobHunter 项目）
STEALTH_SCRIPT = """
// 1. 抹除 webdriver 标志
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
});

// 2. 伪造 plugins
Object.defineProperty(navigator, 'plugins', {
    get: () => [
        {name: 'Chrome PDF Plugin'},
        {name: 'Chrome PDF Viewer'},
        {name: 'Native Client'}
    ]
});

// 3. 伪造 languages
Object.defineProperty(navigator, 'languages', {
    get: () => ['zh-CN', 'zh', 'en-US', 'en']
});

// 4. 伪造 platform
Object.defineProperty(navigator, 'platform', {
    get: () => 'MacIntel'
});

// 5. 伪造 chrome 对象
window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {},
};

// 6. 伪造 permissions
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

// 7. 抹除 Playwright 痕迹
delete window.__playwright__;
delete window.__pw_manual;

// 8. 伪造 WebGL
const getParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) {
        return 'Intel Inc.';
    }
    if (parameter === 37446) {
        return 'Intel Iris OpenGL Engine';
    }
    return getParameter.call(this, parameter);
};

// 9. 伪造 connection（BOSS直聘检测项）
if (!navigator.connection) {
    Object.defineProperty(navigator, 'connection', {
        get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false })
    });
}

// 10. 抹除 cdc_ 变量（ChromeDriver 痕迹）
for (const key of Object.keys(window)) {
    if (key.startsWith('cdc_')) {
        delete window[key];
    }
}
"""

# 伪装的 User-Agent（Chrome 120 / macOS）
STEALTH_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def apply_stealth(context):
    """对 Playwright context 应用反检测配置。

    在每个新页面加载前注入 STEALTH_SCRIPT，抹除 WebDriver 特征。
    User-Agent / viewport / locale / timezone 由 context 创建时配置，
    此函数仅负责脚本注入，避免覆盖调用方已设置的 context 参数。
    """
    # 注入反检测脚本（在每个新页面加载前执行）
    context.add_init_script(STEALTH_SCRIPT)


def launch_stealth_browser(headless: bool = True):
    """启动带反检测的 Playwright 浏览器。

    与 _get_browser_context 不同，本函数不复用 Chrome 登录态，
    而是启动一个全新的隐身浏览器，专门用于反检测场景。

    返回 (playwright, browser, context)
    """
    p = sync_playwright().start()
    browser = p.chromium.launch(
        headless=headless,
        args=[
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
        ]
    )
    context = browser.new_context(
        user_agent=STEALTH_USER_AGENT,
        viewport={'width': 1920, 'height': 1080},
        locale='zh-CN',
        timezone_id='Asia/Shanghai',
    )
    apply_stealth(context)
    return p, browser, context


def _get_browser_context(headless: bool = True):
    """启动 Playwright 独立 Chromium（不依赖用户系统 Chrome）。

    使用 p.chromium.launch 启动全新 Chromium，注入反检测脚本。
    不再使用 launch_persistent_context / connect_over_cdp / channel='chrome' / user_data_dir。

    Args:
        headless: 是否无头模式。登录流程需 False（用户要看到登录页），
                  搜索流程用 True。

    返回 (playwright, browser, context)。失败时抛出异常给调用方捕获。
    """
    p = sync_playwright().start()
    browser = p.chromium.launch(
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--disable-features=IsolateOrigins,site-per-process",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-infobars",
            "--window-size=1920,1080",
        ],
    )
    context = browser.new_context(
        user_agent=STEALTH_USER_AGENT,
        viewport={"width": 1920, "height": 1080},
        locale="zh-CN",
        timezone_id="Asia/Shanghai",
        extra_http_headers={
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        },
    )
    apply_stealth(context)
    return p, browser, context


def _close_browser(p, browser, context) -> None:
    """安全关闭 context / browser / playwright。"""
    try:
        context.close()
    except Exception:
        pass
    try:
        browser.close()
    except Exception:
        pass
    try:
        p.stop()
    except Exception:
        pass


def _safe_text(page, selector: str) -> str:
    """安全提取元素文本，失败返回空串。"""
    try:
        el = page.query_selector(selector)
        return el.inner_text().strip() if el else ""
    except Exception:
        return ""


def _looks_like_login_page(page) -> bool:
    """粗略判断当前是否落在登录页。"""
    try:
        url = page.url or ""
    except Exception:
        url = ""
    if any(kw in url.lower() for kw in ["login", "passport", "signin", "account/login"]):
        return True
    try:
        # 页面中存在明显的登录表单标志
        if page.query_selector("input[type=password]"):
            return True
    except Exception:
        pass
    return False


def _check_login_success(page, platform: str) -> bool:
    """检测指定平台是否已登录成功。

    判定规则：
    - BOSS：Cookie 中存在 wt2 或 wbg（登录后才设置）
    - 51job：URL 已跳转到 we.51job.com 且不在登录路径（登录前在 login.51job.com）
    """
    spec = LOGIN_SUCCESS.get(platform)
    if not spec:
        return False
    try:
        current_url = page.url or ""
    except Exception:
        current_url = ""

    if platform == "51job":
        # 51job 登录前在 login.51job.com，登录后跳转到 we.51job.com
        # 只检查 URL 是否已跳转到 we.51job.com 且不在登录路径
        if not current_url.startswith("https://we.51job.com/"):
            return False
        if "login" in current_url.lower() or "/user/" in current_url:
            return False
        # 已跳转到 we.51job.com 非登录路径，确认登录成功
        return True

    # BOSS：只用 Cookie 判定（从首页开始，URL 无法区分登录状态）
    try:
        cookies = page.context.cookies()
    except Exception:
        cookies = []
    cookie_names = {c.get("name", "") for c in cookies}
    for key in spec["cookie_keys"]:
        if key in cookie_names:
            return True
    return False


def login_and_save_cookies(platform: str, user_id: int, db) -> bool:
    """启动浏览器让用户手动登录，登录成功后保存 Cookie 到数据库。

    Args:
        platform: 平台标识，目前支持 'boss' / '51job'
        user_id: 用户 ID
        db: SQLAlchemy Session（需含 PlatformAuth 模型）

    Returns:
        True 表示登录成功并已保存 Cookie；False 表示超时或失败。
    """
    from models import PlatformAuth

    if platform not in LOGIN_URLS:
        print(f"[login] 不支持的平台: {platform}")
        return False

    login_url = LOGIN_URLS[platform]
    p = None
    browser = None
    context = None
    try:
        # 非 headless：用户需要看到登录页面并手动操作
        p, browser, context = _get_browser_context(headless=False)
        page = context.new_page()
        page.goto(login_url, wait_until="domcontentloaded", timeout=SEARCH_TIMEOUT_MS)

        # 轮询检测登录状态，最长等待 LOGIN_TIMEOUT_SEC 秒
        deadline = datetime.utcnow() + timedelta(seconds=LOGIN_TIMEOUT_SEC)
        logged_in = False
        while datetime.utcnow() < deadline:
            try:
                if _check_login_success(page, platform):
                    logged_in = True
                    break
            except Exception:
                pass
            page.wait_for_timeout(2000)  # 每 2 秒轮询一次

        if not logged_in:
            print(f"[login] {platform} 登录超时（{LOGIN_TIMEOUT_SEC}s）")
            return False

        # 登录成功，获取所有 Cookie
        cookies = context.cookies()
        cookies_json = json.dumps(cookies)

        # 保存到 PlatformAuth 表（upsert：先查再更新或插入）
        auth = db.query(PlatformAuth).filter(
            PlatformAuth.user_id == user_id,
            PlatformAuth.platform == platform,
        ).first()
        if auth:
            auth.cookies = cookies_json
            auth.status = "active"
            auth.expires_at = datetime.utcnow() + timedelta(days=7)
        else:
            auth = PlatformAuth(
                user_id=user_id,
                platform=platform,
                cookies=cookies_json,
                status="active",
                expires_at=datetime.utcnow() + timedelta(days=7),
            )
            db.add(auth)
        db.commit()
        print(f"[login] {platform} 登录成功，已保存 {len(cookies)} 条 Cookie")
        return True
    except Exception as e:
        print(f"[login] {platform} 登录流程异常: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return False
    finally:
        if p is not None and context is not None:
            _close_browser(p, browser, context)


def _extract_boss_jobs(page, city: str) -> list[dict]:
    """从 BOSS直聘搜索页提取岗位列表。"""
    results: list[dict] = []
    items = page.query_selector_all(".job-card-wrapper, .job-card-left, [class*=job-card]")
    for it in items:
        try:
            title_el = it.query_selector(".job-name, .job-title, [class*=job-name] a, a")
            title = title_el.inner_text().strip() if title_el else ""
            if not title:
                continue

            company_el = it.query_selector(".company-name, [class*=company-name] a, .company-info a")
            company = company_el.inner_text().strip() if company_el else ""

            salary_el = it.query_selector(".salary, .red, [class*=salary]")
            salary = salary_el.inner_text().strip() if salary_el else ""

            link_el = it.query_selector("a[href*='/job_detail/'], a[href*='/job/']")
            jd_url = ""
            if link_el:
                href = link_el.get_attribute("href") or ""
                if href.startswith("//"):
                    jd_url = "https:" + href
                elif href.startswith("/"):
                    jd_url = "https://www.zhipin.com" + href
                elif href.startswith("http"):
                    jd_url = href

            # BOSS 标签区：经验 / 学历
            tags_el = it.query_selector_all(".tag-list span, .job-info span, [class*=tag] span")
            tags = [t.inner_text().strip() for t in tags_el if t.inner_text().strip()]
            experience = ""
            degree = ""
            for t in tags:
                if "年" in t and not experience:
                    experience = t
                elif t in ("大专", "本科", "硕士", "博士") and not degree:
                    degree = t

            results.append({
                "title": title,
                "company": company,
                "salary": salary,
                "city": city,
                "platform": "BOSS直聘",
                "jd_text": "",
                "jd_url": jd_url,
                "experience": experience,
                "degree": degree,
            })
        except Exception:
            continue
    return results


def _extract_51job_jobs(page, city: str) -> list[dict]:
    """从前程无忧搜索页提取岗位列表。"""
    results: list[dict] = []
    items = page.query_selector_all(".joblist-box .el, .el, [class*=job]")
    for it in items:
        try:
            title_el = it.query_selector(".jname, .jobname, [class*=title] a, a.t")
            title = title_el.inner_text().strip() if title_el else ""
            if not title:
                continue

            company_el = it.query_selector(".cname, .company_name, [class*=company]")
            company = company_el.inner_text().strip() if company_el else ""

            salary_el = it.query_selector(".sal, .salary, [class*=salary]")
            salary = salary_el.inner_text().strip() if salary_el else ""

            link_el = it.query_selector("a[href*='/job/']")
            jd_url = ""
            if link_el:
                href = link_el.get_attribute("href") or ""
                if href.startswith("//"):
                    jd_url = "https:" + href
                elif href.startswith("/"):
                    jd_url = "https://we.51job.com" + href
                elif href.startswith("http"):
                    jd_url = href

            info_el = it.query_selector(".info, .d.at, [class*=info]")
            info_text = info_el.inner_text().strip() if info_el else ""
            experience = ""
            degree = ""
            for part in info_text.replace("|", " ").split():
                if "年" in part and not experience:
                    experience = part
                elif part in ("大专", "本科", "硕士", "博士") and not degree:
                    degree = part

            results.append({
                "title": title,
                "company": company,
                "salary": salary,
                "city": city,
                "platform": "前程无忧",
                "jd_text": "",
                "jd_url": jd_url,
                "experience": experience,
                "degree": degree,
            })
        except Exception:
            continue
    return results


def search_with_cookies(
    platform: str,
    keyword: str,
    city: str,
    cookies: list[dict],
) -> list[dict]:
    """使用已保存的 Cookie 搜索岗位（headless）。

    Args:
        platform: 平台标识，目前支持 'boss' / '51job'
        keyword: 搜索关键词，如 "产品经理"
        city: 城市名（中文），如 "杭州"
        cookies: Playwright 格式的 Cookie 列表（list[dict]）

    Returns:
        标准化岗位列表，失败返回空列表。
    """
    if platform not in SEARCH_URL_TEMPLATES:
        print(f"[search_with_cookies] 不支持的平台: {platform}")
        return []

    city_code = CITY_CODES.get(platform, {}).get(city, city)
    url = SEARCH_URL_TEMPLATES[platform].format(
        keyword=urllib.parse.quote(keyword),
        city_code=city_code,
    )

    p = None
    browser = None
    context = None
    try:
        p, browser, context = _get_browser_context(headless=True)

        # 注入已保存的 Cookie
        if cookies:
            context.add_cookies(cookies)

        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=SEARCH_TIMEOUT_MS)

        # SPA 渲染等待
        selectors = {
            "boss": [".job-card-wrapper", ".job-card-left", "[class*=job-card]"],
            "51job": [".joblist-box", ".el", "[class*=job]"],
        }.get(platform, [])
        loaded = False
        for sel in selectors:
            try:
                page.wait_for_selector(sel, timeout=SEARCH_TIMEOUT_MS)
                loaded = True
                break
            except PlaywrightTimeoutError:
                continue
        if not loaded:
            page.wait_for_timeout(2000)

        if _looks_like_login_page(page):
            print(f"[search_with_cookies] {platform} Cookie 已失效，跳转登录页")
            return []

        if platform == "boss":
            return _extract_boss_jobs(page, city)
        elif platform == "51job":
            return _extract_51job_jobs(page, city)
        return []
    except Exception as e:
        print(f"[search_with_cookies] {platform} 搜索失败: {e}")
        return []
    finally:
        if p is not None and context is not None:
            _close_browser(p, browser, context)


def search_liepin(keyword: str, city: str, page: int = 1) -> list[dict]:
    """搜索猎聘岗位。

    .. deprecated::
        改用 search_with_cookies(platform='liepin', ...)。本函数保留仅为兼容旧调用，
        仍使用独立 Chromium 但不注入已保存 Cookie，可能因未登录而返回空列表。

    Args:
        keyword: 搜索关键词，如 "产品经理"
        city: 城市名（中文），如 "杭州"
        page: 页码，从 1 开始

    Returns:
        标准化岗位列表，失败返回空列表。
    """
    city_code = _CITY_CODE_LIEPIN.get(city, city)
    url = (
        "https://www.liepin.com/zhaopin/?"
        f"key={urllib.parse.quote(keyword)}&dqs={city_code}&curPage={page}"
    )

    p = None
    browser = None
    context = None
    try:
        p, browser, context = _get_browser_context()
        page_obj = context.new_page()
        page_obj.goto(url, wait_until="domcontentloaded", timeout=SEARCH_TIMEOUT_MS)

        # SPA 渲染等待：优先等待岗位卡片
        selectors = [".job-list-item", "[class*=job-item]", ".jobcard"]
        loaded = False
        for sel in selectors:
            try:
                page_obj.wait_for_selector(sel, timeout=SEARCH_TIMEOUT_MS)
                loaded = True
                break
            except PlaywrightTimeoutError:
                continue
        if not loaded:
            # 兜底再等一会让 JS 渲染
            page_obj.wait_for_timeout(2000)

        if _looks_like_login_page(page_obj):
            return []

        # 抓取岗位卡片
        items = page_obj.query_selector_all(
            ".job-list-item, [class*=job-item], .jobcard"
        )
        results: list[dict] = []
        for it in items:
            try:
                title = it.query_selector(".job-title-box, .job-info h3, [class*=job-title]")
                title = title.inner_text().strip() if title else ""

                company = it.query_selector(".company-name, [class*=company-name], .comp-info a")
                company = company.inner_text().strip() if company else ""

                salary = it.query_selector(".text-warning, [class*=salary], .job-salary")
                salary = salary.inner_text().strip() if salary else ""

                # 详情链接
                link_el = it.query_selector("a[href*='/job/']")
                jd_url = ""
                job_id = ""
                if link_el:
                    href = link_el.get_attribute("href") or ""
                    if href.startswith("//"):
                        jd_url = "https:" + href
                    elif href.startswith("/"):
                        jd_url = "https://www.liepin.com" + href
                    elif href.startswith("http"):
                        jd_url = href
                    # 提取 job_id
                    if "/job/" in jd_url:
                        seg = jd_url.split("/job/")[-1]
                        job_id = seg.split(".")[0].split("?")[0]

                # 经验/学历通常在标签区
                tags_el = it.query_selector_all("[class*=labels] span, .job-labels span, .condition span")
                tags = [t.inner_text().strip() for t in tags_el if t.inner_text().strip()]
                experience = ""
                degree = ""
                for t in tags:
                    if "年" in t and not experience:
                        experience = t
                    elif t in ("大专", "本科", "硕士", "博士") and not degree:
                        degree = t

                if not title:
                    continue

                results.append({
                    "title": title,
                    "company": company,
                    "salary": salary,
                    "city": city,
                    "platform": "猎聘",
                    "jd_text": "",  # 列表页不含 JD 正文，需进入详情页
                    "jd_url": jd_url,
                    "experience": experience,
                    "degree": degree,
                })
            except Exception:
                continue

        return results
    except Exception as e:
        print(f"[liepin] 搜索失败: {e}")
        return []
    finally:
        if p is not None and context is not None:
            _close_browser(p, browser, context)


def search_51job(keyword: str, city: str, page: int = 1) -> list[dict]:
    """搜索前程无忧岗位。

    .. deprecated::
        改用 search_with_cookies(platform='51job', ...)。本函数保留仅为兼容旧调用，
        仍使用独立 Chromium 但不注入已保存 Cookie，可能因未登录而返回空列表。

    Args:
        keyword: 搜索关键词
        city: 城市名（中文）
        page: 页码，从 1 开始

    Returns:
        标准化岗位列表，失败返回空列表。
    """
    city_code = _CITY_CODE_51JOB.get(city, city)
    url = (
        "https://we.51job.com/pc/search?"
        f"keyword={urllib.parse.quote(keyword)}&jobArea={city_code}&pageNum={page}"
    )

    p = None
    browser = None
    context = None
    try:
        p, browser, context = _get_browser_context()
        page_obj = context.new_page()
        page_obj.goto(url, wait_until="domcontentloaded", timeout=SEARCH_TIMEOUT_MS)

        selectors = [".joblist-box", ".el", "[class*=job]", ".joblist"]
        loaded = False
        for sel in selectors:
            try:
                page_obj.wait_for_selector(sel, timeout=SEARCH_TIMEOUT_MS)
                loaded = True
                break
            except PlaywrightTimeoutError:
                continue
        if not loaded:
            page_obj.wait_for_timeout(2000)

        if _looks_like_login_page(page_obj):
            return []

        items = page_obj.query_selector_all(".joblist-box .el, .el, [class*=job]")
        results: list[dict] = []
        for it in items:
            try:
                title_el = it.query_selector(".jname, .jobname, [class*=title] a, a.t")
                title = title_el.inner_text().strip() if title_el else ""
                if not title:
                    continue

                company_el = it.query_selector(".cname, .company_name, [class*=company]")
                company = company_el.inner_text().strip() if company_el else ""

                salary_el = it.query_selector(".sal, .salary, [class*=salary]")
                salary = salary_el.inner_text().strip() if salary_el else ""

                link_el = it.query_selector("a[href*='/job/']")
                jd_url = ""
                job_id = ""
                if link_el:
                    href = link_el.get_attribute("href") or ""
                    if href.startswith("//"):
                        jd_url = "https:" + href
                    elif href.startswith("/"):
                        jd_url = "https://we.51job.com" + href
                    elif href.startswith("http"):
                        jd_url = href
                    if "/job/" in jd_url:
                        seg = jd_url.split("/job/")[-1]
                        job_id = seg.split(".")[0].split("?")[0]

                info_el = it.query_selector(".info, .d.at, [class*=info]")
                info_text = info_el.inner_text().strip() if info_el else ""
                experience = ""
                degree = ""
                # 51job 信息栏常见格式："杭州-西湖区 | 3-4年经验 | 本科 | 招1人"
                for part in info_text.replace("|", " ").split():
                    if "年" in part and not experience:
                        experience = part
                    elif part in ("大专", "本科", "硕士", "博士") and not degree:
                        degree = part

                results.append({
                    "title": title,
                    "company": company,
                    "salary": salary,
                    "city": city,
                    "platform": "前程无忧",
                    "jd_text": "",
                    "jd_url": jd_url,
                    "experience": experience,
                    "degree": degree,
                })
            except Exception:
                continue

        return results
    except Exception as e:
        print(f"[51job] 搜索失败: {e}")
        return []
    finally:
        if p is not None and context is not None:
            _close_browser(p, browser, context)


def search_zhaopin(keyword: str, city: str, page: int = 1) -> list[dict]:
    """搜索智联招聘岗位。

    .. deprecated::
        改用 search_with_cookies(platform='zhaopin', ...)。本函数保留仅为兼容旧调用，
        仍使用独立 Chromium 但不注入已保存 Cookie，可能因未登录而返回空列表。

    Args:
        keyword: 搜索关键词
        city: 城市名（中文）
        page: 页码，从 1 开始

    Returns:
        标准化岗位列表，失败返回空列表。
    """
    city_code = _CITY_CODE_ZHAOPIN.get(city, city)
    url = (
        "https://sou.zhaopin.com/?"
        f"jl={city_code}&kw={urllib.parse.quote(keyword)}&p={page}"
    )

    p = None
    browser = None
    context = None
    try:
        p, browser, context = _get_browser_context()
        page_obj = context.new_page()
        page_obj.goto(url, wait_until="domcontentloaded", timeout=SEARCH_TIMEOUT_MS)

        selectors = [".joblist-box__item", "[class*=joblist]", "[class*=positionitem]", ".joblist"]
        loaded = False
        for sel in selectors:
            try:
                page_obj.wait_for_selector(sel, timeout=SEARCH_TIMEOUT_MS)
                loaded = True
                break
            except PlaywrightTimeoutError:
                continue
        if not loaded:
            page_obj.wait_for_timeout(2000)

        if _looks_like_login_page(page_obj):
            return []

        items = page_obj.query_selector_all(
            ".joblist-box__item, [class*=positionitem], [class*=joblist] li"
        )
        results: list[dict] = []
        for it in items:
            try:
                title_el = it.query_selector(".jobinfo__name, .jobname, [class*=title] a, a")
                title = title_el.inner_text().strip() if title_el else ""
                if not title:
                    continue

                company_el = it.query_selector(".company__name, .company_name, [class*=company]")
                company = company_el.inner_text().strip() if company_el else ""

                salary_el = it.query_selector(".jobinfo__salary, .salary, [class*=salary]")
                salary = salary_el.inner_text().strip() if salary_el else ""

                link_el = it.query_selector("a[href*='zhaopin.com'], a[href*='/CC']")
                jd_url = ""
                job_id = ""
                if link_el:
                    href = link_el.get_attribute("href") or ""
                    if href.startswith("//"):
                        jd_url = "https:" + href
                    elif href.startswith("/"):
                        jd_url = "https://jobs.zhaopin.com" + href
                    elif href.startswith("http"):
                        jd_url = href
                    # 提取 CCxxxx.htm 形式的 job_id
                    if "/CC" in jd_url:
                        seg = jd_url.split("/CC")[-1]
                        job_id = "CC" + seg.split(".")[0].split("?")[0]

                info_el = it.query_selector(".jobinfo__detail, .info, [class*=info]")
                info_text = info_el.inner_text().strip() if info_el else ""
                experience = ""
                degree = ""
                for part in info_text.replace("|", " ").split():
                    if "年" in part and not experience:
                        experience = part
                    elif part in ("大专", "本科", "硕士", "博士") and not degree:
                        degree = part

                results.append({
                    "title": title,
                    "company": company,
                    "salary": salary,
                    "city": city,
                    "platform": "智联招聘",
                    "jd_text": "",
                    "jd_url": jd_url,
                    "experience": experience,
                    "degree": degree,
                })
            except Exception:
                continue

        return results
    except Exception as e:
        print(f"[zhaopin] 搜索失败: {e}")
        return []
    finally:
        if p is not None and context is not None:
            _close_browser(p, browser, context)


def fetch_jd_detail(jd_url: str) -> str:
    """抓取岗位详情页的 JD 正文（可选辅助函数）。

    Args:
        jd_url: 岗位详情页 URL

    Returns:
        JD 正文文本，失败返回空串。
    """
    if not jd_url:
        return ""
    p = None
    browser = None
    context = None
    try:
        p, browser, context = _get_browser_context()
        page_obj = context.new_page()
        page_obj.goto(jd_url, wait_until="domcontentloaded", timeout=SEARCH_TIMEOUT_MS)
        page_obj.wait_for_timeout(1500)

        if _looks_like_login_page(page_obj):
            return ""

        # 各平台 JD 容器选择器
        candidates = [
            ".job-intro-container", ".job-detail", "[class*=job-desc]",
            ".content content-word-break", ".job_description", ".des",
        ]
        for sel in candidates:
            try:
                el = page_obj.query_selector(sel)
                if el:
                    return el.inner_text().strip()
            except Exception:
                continue
        return ""
    except Exception as e:
        print(f"[jd_detail] 抓取失败: {e}")
        return ""
    finally:
        if p is not None and context is not None:
            _close_browser(p, browser, context)


if __name__ == "__main__":
    # 测试三个平台的搜索功能
    test_keyword = "产品经理"
    test_city = "杭州"

    print("=" * 60)
    print(f"测试关键词: {test_keyword} | 城市: {test_city}")
    print("=" * 60)

    print("\n[1/3] 猎聘搜索...")
    liepin_jobs = search_liepin(test_keyword, test_city)
    print(f"猎聘返回 {len(liepin_jobs)} 条岗位")
    for j in liepin_jobs[:3]:
        print(f"  - {j['title']} @ {j['company']} | {j['salary']} | {j['jd_url']}")

    print("\n[2/3] 前程无忧搜索...")
    jobs_51 = search_51job(test_keyword, test_city)
    print(f"前程无忧返回 {len(jobs_51)} 条岗位")
    for j in jobs_51[:3]:
        print(f"  - {j['title']} @ {j['company']} | {j['salary']} | {j['jd_url']}")

    print("\n[3/3] 智联招聘搜索...")
    zhaopin_jobs = search_zhaopin(test_keyword, test_city)
    print(f"智联招聘返回 {len(zhaopin_jobs)} 条岗位")
    for j in zhaopin_jobs[:3]:
        print(f"  - {j['title']} @ {j['company']} | {j['salary']} | {j['jd_url']}")

    print("\n" + "=" * 60)
    print("测试完成")
