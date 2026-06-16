#!/usr/bin/env python3
"""
autocli 连通性诊断脚本
用法: python diagnose_autocli.py
"""

import subprocess
import json
import os
import sys
import time
import re
import platform as _platform
from pathlib import Path

AUTOCLI_PATH = (
    "/Users/wutianya/Desktop/我的AI工作系统/50-本地工具/autocli-mac"
    if _platform.system() == "Darwin"
    else "/Users/wutianya/Desktop/我的AI工作系统/50-本地工具/autocli.exe"
)

TEST_KEYWORDS = ["AI产品经理"]
TEST_CITY = "杭州"
TEST_LIMIT = 3

EXPECTED_FIELDS = ["name", "company", "salary", "area", "description", "url", "boss", "degree", "experience"]


def print_section(title: str):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def check_binary():
    print_section("1. autocli 二进制检测")
    path = Path(AUTOCLI_PATH)
    print(f"  路径: {AUTOCLI_PATH}")
    print(f"  存在: {'是' if path.exists() else '否'}")
    if path.exists():
        stat = path.stat()
        print(f"  大小: {stat.st_size / 1024 / 1024:.1f} MB")
        print(f"  可执行: {'是' if os.access(AUTOCLI_PATH, os.X_OK) else '否'}")
    return path.exists() and os.access(AUTOCLI_PATH, os.X_OK)


def test_version():
    print_section("2. autocli 版本检测")
    try:
        result = subprocess.run([AUTOCLI_PATH, "--version"], capture_output=True, text=True, timeout=10)
        print(f"  返回码: {result.returncode}")
        print(f"  stdout: {result.stdout.strip() if result.stdout else '(空)'}")
        print(f"  stderr: {result.stderr.strip() if result.stderr else '(空)'}")
        return result.returncode == 0
    except Exception as e:
        print(f"  异常: {e}")
        return False


def test_search(keyword: str, city: str, limit: int):
    print_section(f"3. autocli 搜索测试: '{keyword}' city={city} limit={limit}")
    cmd = [AUTOCLI_PATH, "boss", "search", keyword, "--format", "json", "--limit", str(limit)]
    if city:
        cmd.extend(["--city", city])
    print(f"  命令: {' '.join(cmd)}")

    start_time = time.time()
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        elapsed_ms = (time.time() - start_time) * 1000
        print(f"  耗时: {elapsed_ms:.0f}ms")
        print(f"  返回码: {result.returncode}")

        if result.stderr:
            stderr_preview = result.stderr[:200]
            print(f"  stderr: {stderr_preview}")

        if result.returncode != 0:
            print("  结论: autocli 执行失败")
            return None, elapsed_ms

        data = json.loads(result.stdout)
        if not data or not isinstance(data, list):
            print("  结论: 返回数据格式异常（非列表）")
            print(f"  原始输出: {result.stdout[:300]}")
            return None, elapsed_ms

        print(f"  返回数据量: {len(data)} 条")

        error_detected = False
        for i, item in enumerate(data):
            item_name = item.get("name", "")
            if "Error" in item_name:
                error_msg = item.get("url", "")
                print(f"  第{i + 1}条: Error - {error_msg}")
                error_detected = True
                continue

        if error_detected and len(data) == 1 and "Error" in data[0].get("name", ""):
            print("  结论: autocli 返回错误响应，数据源不可用")
            return data, elapsed_ms

        return data, elapsed_ms

    except FileNotFoundError:
        print("  结论: autocli 二进制文件未找到")
        return None, 0
    except subprocess.TimeoutExpired:
        elapsed_ms = (time.time() - start_time) * 1000
        print(f"  结论: 超时 (>60s)，耗时 {elapsed_ms:.0f}ms")
        return None, elapsed_ms
    except json.JSONDecodeError as e:
        elapsed_ms = (time.time() - start_time) * 1000
        print(f"  结论: JSON 解析失败: {e}")
        return None, elapsed_ms
    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        print(f"  结论: 异常: {type(e).__name__}: {e}")
        return None, elapsed_ms


def analyze_field_completeness(data: list):
    print_section("4. 字段完整性分析")
    if not data or not isinstance(data, list):
        print("  无有效数据，跳过分析")
        return {}

    valid_entries = [item for item in data if "Error" not in item.get("name", "")]
    if not valid_entries:
        print("  无有效数据条目，跳过分析")
        return {}

    field_stats = {}
    for field in EXPECTED_FIELDS:
        present = sum(1 for item in valid_entries if item.get(field))
        rate = present / len(valid_entries) * 100
        field_stats[field] = {"present": present, "total": len(valid_entries), "rate": rate}
        status = "✅" if rate >= 80 else ("⚠️" if rate >= 50 else "❌")
        print(f"  {status} {field:15s}: {present}/{len(valid_entries)} ({rate:.0f}%)")

    field_names = [item.get("name", "") for item in valid_entries]
    companies = [item.get("company", "") for item in valid_entries]
    salaries = [item.get("salary", "") for item in valid_entries]
    areas = [item.get("area", "") for item in valid_entries]

    if field_names:
        print(f"\n  职位名称: {field_names}")
    if companies:
        print(f"  公司名:   {companies}")
    if salaries:
        print(f"  薪资:     {salaries}")
    if areas:
        print(f"  城市:     {areas}")

    return field_stats


def test_network_capability():
    print_section("5. 网络连通性检测")
    tests = [
        ("zhipin.com", 443),
        ("www.zhipin.com", 443),
        ("api.zhipin.com", 443),
    ]
    results = {}
    for host, port in tests:
        try:
            import socket
            s = socket.create_connection((host, port), timeout=5)
            s.close()
            results[host] = True
            print(f"  ✅ {host}:{port} - 可达")
        except Exception as e:
            results[host] = False
            print(f"  ❌ {host}:{port} - 不可达 ({type(e).__name__})")
    return results


def simulate_search_chain(keyword: str):
    """模拟 jobs.py 中的完整搜索链路"""
    print_section(f"6. 搜索算法链路模拟: '{keyword}'")

    # Step 1: _tokenize
    print("\n  Step 1: _tokenize (分词)")
    tokens = _tokenize(keyword)
    print(f"    输入: '{keyword}'")
    print(f"    输出: {tokens}")

    # Step 2: _keyword_match_score
    print("\n  Step 2: _keyword_match_score (匹配打分)")
    print(f"    搜索词: {tokens}")
    print(f"    _ARCH_EXPANSION 扩展映射:")
    for term in tokens:
        term_lower = term.lower()
        expanded = _ARCH_EXPANSION.get(term_lower, [term_lower])
        print(f"      '{term}' → {expanded}")

    # Step 3: 模拟 MOCK_JOB 匹配
    MOCK_JOBS = _get_mock_jobs()
    print(f"\n  Step 3: 对 {len(MOCK_JOBS)} 条 Mock 数据进行匹配打分")
    scored = []
    for job in MOCK_JOBS:
        score = _keyword_match_score(job, tokens)
        if score > 0:
            scored.append((score, job))

    scored.sort(key=lambda x: x[0], reverse=True)

    print(f"\n    匹配结果 (共 {len(scored)} 条, 仅显示 Top 10):")
    for i, (score, job) in enumerate(scored[:10]):
        title = job["title"]
        company = job["company"]
        salary = job["salary"]
        city = job.get("city", "")
        print(f"    {i + 1:2d}. [{score:.0f}分] {title} | {company} | {salary} | {city}")

    # Step 4: filter_jobs (模拟用户配置为杭州, 25K)
    print("\n  Step 4: filter_jobs (硬约束过滤: 城市=杭州, 薪资≥25K)")
    filtered = []
    excluded = []
    for _, job in scored:
        job_city = job.get("city", "")
        if job_city != "杭州" and job_city != "远程":
            excluded.append((job, f"城市不匹配({job_city})"))
            continue
        min_salary = _parse_salary_min(job.get("salary", ""))
        if min_salary < 25:
            excluded.append((job, f"薪资不达标(min={min_salary}K<25K)"))
            continue
        filtered.append(job)

    print(f"    过滤后: {len(filtered)} 条")
    print(f"    被排除: {len(excluded)} 条")
    for job, reason in excluded[:5]:
        print(f"      ✗ {job['title']} - {reason}")
    for job in filtered[:5]:
        print(f"      ✓ {job['title']} | {job['salary']} | {job['city']}")

    return {
        "tokens": tokens,
        "matched_count": len(scored),
        "filtered_count": len(filtered),
        "excluded_count": len(excluded),
    }


def _tokenize(text: str) -> list[str]:
    tokens = []
    for ch in "（）()/·,:：，":
        text = text.replace(ch, " ")
    for word in text.split():
        word = word.strip()
        if len(word) >= 2:
            tokens.append(word)
    return tokens


_ARCH_EXPANSION = {
    "建筑": ["建筑", "建设", "建造", "城投", "空间"],
    "设计": ["设计", "规划", "UI", "UX", "交互", "原型"],
    "bim": ["bim", "建筑", "设计"],
    "建造": ["建造", "建筑", "建设"],
    "产品": ["产品", "产品经理", "产品设计"],
    "产品经理": ["产品经理", "产品", "产品设计", "产品规划"],
    "经理": ["经理", "管理", "主管", "负责人"],
    "ai": ["ai", "人工智能", "大模型", "算法", "机器学习", "智能"],
    "人工智能": ["人工智能", "ai", "大模型", "智能"],
    "大模型": ["大模型", "ai", "人工智能"],
    "算法": ["算法", "ai", "机器学习"],
    "后端": ["后端", "python", "开发", "工程师"],
    "前端": ["前端", "react", "vue", "开发", "工程师"],
    "全栈": ["全栈", "前端", "后端", "开发"],
    "开发": ["开发", "工程师", "前端", "后端"],
    "运营": ["运营", "增长", "营销", "社群"],
    "销售": ["销售", "商务", "bd", "拓展"],
    "数据分析": ["数据分析", "数据", "分析"],
    "项目管理": ["项目管理", "项目", "管理"],
    "招聘": ["招聘", "hr", "人力资源"],
    "java": ["java", "后端", "开发"],
    "python": ["python", "后端", "ai", "开发"],
    "go": ["go", "后端", "开发"],
    "react": ["react", "前端", "开发"],
    "vue": ["vue", "前端", "开发"],
    "增长": ["增长", "运营", "用户"],
    "管理": ["管理", "经理", "主管"],
    "总监": ["总监", "经理", "管理"],
    "城市": ["城市", "建筑", "规划"],
    "数字": ["数字", "数字化", "ai", "智能"],
    "数字化": ["数字化", "数字", "ai"],
}


def _keyword_match_score(job: dict, search_terms: list[str]) -> float:
    title_lower = job["title"].lower()
    jd_lower = job.get("jd_text", "").lower()
    company_lower = job["company"].lower()
    city = job.get("city", "")

    matched_count = 0
    total_score = 0.0
    for term in search_terms:
        term_lower = term.lower()
        match_terms = _ARCH_EXPANSION.get(term_lower, [term_lower])

        best_score = 0.0
        for mt in match_terms:
            if mt in title_lower:
                best_score = max(best_score, 60)
            elif mt in jd_lower:
                best_score = max(best_score, 30)
            elif mt in company_lower:
                best_score = max(best_score, 20)
            elif mt in city:
                best_score = max(best_score, 20)

        if best_score > 0.0:
            matched_count += 1
            total_score += best_score

    if matched_count == 0:
        return 0.0
    return total_score / matched_count


def _parse_salary_min(salary_str: str) -> int:
    match = re.search(r'(\d+)', salary_str)
    if match:
        return int(match.group(1))
    return 0


def _get_mock_jobs():
    return [
        {"title": "AI产品经理", "company": "某AI科技公司", "salary": "30-50K·14薪", "city": "杭州",
         "jd_text": "负责AI产品的需求分析和产品规划"},
        {"title": "产品经理（AI方向）", "company": "某独角兽企业", "salary": "28-45K", "city": "杭州",
         "jd_text": "负责AI产品线的整体规划和设计"},
        {"title": "AI训练师/提示词工程师", "company": "某AI创业公司", "salary": "20-35K", "city": "杭州",
         "jd_text": "负责大语言模型的提示词设计"},
        {"title": "产品总监", "company": "某科技公司", "salary": "35-55K", "city": "杭州",
         "jd_text": "负责公司整体产品战略"},
        {"title": "高级产品经理", "company": "某中型科技公司", "salary": "28-45K", "city": "北京",
         "jd_text": "负责核心产品线的需求管理"},
        {"title": "产品助理", "company": "某小型创业公司", "salary": "8-15K", "city": "杭州",
         "jd_text": "协助产品经理完成需求文档"},
        {"title": "AI实习生", "company": "某AI公司", "salary": "3-6K", "city": "杭州",
         "jd_text": "参与AI产品的用户调研"},
        {"title": "项目经理（非产品）", "company": "某建设公司", "salary": "20-30K", "city": "杭州",
         "jd_text": "负责工程项目全流程管理"},
    ]


def analyze_need_for_external_api():
    print_section("7. 额外 API 需求分析")

    apis = [
        {
            "name": "Google Custom Search JSON API",
            "cost": "免费100次/天，超出$5/1000次",
            "relevance": "可搜索公开职位信息，但不针对国内招聘平台",
            "need": "不需要 — 搜索结果不结构化，不适合职位搜索场景",
        },
        {
            "name": "Bing Search API",
            "cost": "免费1000次/月，超出$3-7/1000次",
            "relevance": "同Google，可搜国内网页但结果质量差",
            "need": "不需要 — 同样无法结构化解构职位信息",
        },
        {
            "name": "Indeed API (已关闭)",
            "cost": "N/A",
            "relevance": "Indeed于2023年关闭了公开API",
            "need": "不可能使用",
        },
        {
            "name": "Glassdoor API (已关闭)",
            "cost": "N/A",
            "relevance": "Glassdoor未提供公开API",
            "need": "不可能使用",
        },
        {
            "name": "BOSS直聘官方API",
            "cost": "无公开API",
            "relevance": "BOSS直聘不提供第三方API",
            "need": "无法使用",
        },
        {
            "name": "爬虫方案（Selenium/Puppeteer）",
            "cost": "服务器+IP代理成本约500-2000元/月",
            "relevance": "模拟浏览器抓取BOSS直聘等平台页面",
            "need": "可作为autocli的替代方案，但有反爬风险和合规问题",
        },
    ]

    print(f"  {'API/方案':<30s} {'是否需要':<10s} {'原因'}")
    print(f"  {'-' * 30} {'-' * 10} {'-' * 50}")
    for api in apis:
        status = "不需要" if "不需要" in api["need"] else api["need"]
        print(f"  {api['name']:<30s} {status:<10s} {api.get('relevance', 'N/A')}")

    print(f"\n  结论: 搜索引擎类API无法结构化解析国内招聘平台数据，不适用于本场景。")
    print(f"  爬虫方案可作为autocli的最后兜底方案，但需要额外开发和运维成本。")


def main():
    print("=" * 60)
    print("  autocli 连通性诊断报告")
    print(f"  时间: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  平台: {_platform.system()} {_platform.release()}")
    print("=" * 60)

    # 1. 二进制检测
    binary_ok = check_binary()

    # 2. 版本检测
    if binary_ok:
        version_ok = test_version()
    else:
        version_ok = False

    # 3. 搜索测试
    if binary_ok:
        data, elapsed_ms = test_search("AI产品经理", "杭州", 3)
    else:
        data, elapsed_ms = None, 0

    # 4. 字段完整性
    field_stats = analyze_field_completeness(data)

    # 5. 网络检测
    network = test_network_capability()

    # 6. 搜索算法链路模拟
    chain_result = simulate_search_chain("AI产品经理")

    # 7. 额外API分析
    analyze_need_for_external_api()

    # ======================
    # 综合结论
    # ======================
    print_section("综合诊断结论")

    autocli_available = False
    has_error = False
    error_msg = ""

    if data and isinstance(data, list) and len(data) > 0:
        first = data[0]
        if "Error" in first.get("name", ""):
            has_error = True
            error_msg = first.get("url", "")

    if not binary_ok:
        status = "不可用 — autocli 二进制不存在或不可执行"
    elif has_error:
        status = f"不可用 — autocli 返回错误: {error_msg}"
    elif not data:
        status = "不可用 — autocli 搜索无有效返回"
    else:
        status = f"可用 — 成功获取 {len(data)} 条职位数据，耗时 {elapsed_ms:.0f}ms"
        autocli_available = True

    print(f"\n  autocli 状态: {status}")
    print(f"  Mock 降级方案: {'已就绪' if not autocli_available else '备用'} ({len(chain_result['tokens']) if chain_result else 0} 个分词, {chain_result['matched_count'] if chain_result else 0} 条匹配, {chain_result['filtered_count'] if chain_result else 0} 条过滤后)")

    if autocli_available:
        overall = "✅ 系统正常 — autocli 可用，可实时获取BOSS直聘数据"
    else:
        overall = "⚠️ 降级运行 — autocli 不可用，系统将使用 Mock 数据"

    print(f"\n  整体评估: {overall}")

    return {
        "autocli_available": autocli_available,
        "has_error": has_error,
        "error_msg": error_msg,
        "data_count": len(data) if data and isinstance(data, list) else 0,
        "elapsed_ms": elapsed_ms,
        "field_stats": field_stats,
        "network": network,
        "chain_result": chain_result,
    }


if __name__ == "__main__":
    main()