#!/usr/bin/env python3
"""Playwright 多平台爬虫命令行入口。

用法：
    python playwright_crawler_cli.py liepin "产品经理" "杭州"
    python playwright_crawler_cli.py 51job "产品经理" "杭州"
    python playwright_crawler_cli.py zhaopin "产品经理" "杭州"

输出：JSON 格式的岗位列表（stdout），错误信息输出到 stderr
"""
import sys
import json
import os

# 确保能导入 playwright_crawler
sys.path.insert(0, '/Users/wutianya/Desktop/我的AI工作系统/12-求职助手Web/backend')

# 重定向错误输出到 stderr
def _log_error(msg):
    print(msg, file=sys.stderr)

from playwright_crawler import search_liepin, search_51job, search_zhaopin


def main():
    if len(sys.argv) < 4:
        print(json.dumps([]))
        return

    platform = sys.argv[1]
    keyword = sys.argv[2]
    city = sys.argv[3]

    try:
        if platform == "liepin":
            jobs = search_liepin(keyword, city)
        elif platform == "51job":
            jobs = search_51job(keyword, city)
        elif platform == "zhaopin":
            jobs = search_zhaopin(keyword, city)
        else:
            jobs = []
    except Exception as e:
        _log_error(f"[{platform}] 异常: {e}")
        jobs = []

    # 确保 stdout 只输出 JSON
    print(json.dumps(jobs, ensure_ascii=False))


if __name__ == "__main__":
    main()
