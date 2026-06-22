"""猎聘 MCP 官方 API 客户端

通过猎聘官方 MCP 服务搜索岗位、获取简历，无需爬虫，零反爬风险。
MCP 服务地址：https://open-agent.liepin.com/mcp/user
认证方式：HTTP Header x-user-token
"""

import httpx
import json
import time
from typing import Optional


class LiepinMCPClient:
    """猎聘 MCP 客户端"""

    MCP_URL = "https://open-agent.liepin.com/mcp/user"

    def __init__(self, token: str):
        self.token = token
        self.headers = {
            "x-user-token": token,
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }
        self._id_counter = 0

    def _next_id(self) -> int:
        """生成 JSON-RPC 请求 ID"""
        self._id_counter += 1
        return self._id_counter

    def _call_mcp_tool(self, tool_name: str, arguments: dict) -> Optional[dict]:
        """调用 MCP 工具的底层方法

        MCP 使用 JSON-RPC 2.0 协议
        1. 先调用 tools/list 获取可用工具列表（可选，用于验证连接）
        2. 调用 tools/call 执行具体工具

        返回工具结果字典；失败返回 None。
        """
        payload = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
            },
        }

        return self._post_with_retry(payload)

    def _call_mcp_method(self, method: str, params: Optional[dict] = None) -> Optional[dict]:
        """调用 MCP 通用方法（如 tools/list）"""
        payload = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": method,
            "params": params or {},
        }
        return self._post_with_retry(payload)

    def _post_with_retry(self, payload: dict, retry_on_429: bool = True) -> Optional[dict]:
        """发送 POST 请求，处理限流重试

        - Token 无效：返回 None
        - 限流（429）：等待 1 秒后重试一次
        - 网络错误：返回 None
        """
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(self.MCP_URL, headers=self.headers, json=payload)

                # 限流：等待 1 秒后重试一次
                if resp.status_code == 429 and retry_on_429:
                    time.sleep(1)
                    return self._post_with_retry(payload, retry_on_429=False)

                # Token 无效 / 其他错误
                if resp.status_code in (401, 403):
                    return None
                if resp.status_code != 200:
                    return None

                return self._parse_response(resp)

        except (httpx.RequestError, httpx.HTTPError) as e:
            print(f"[LiepinMCP] 网络错误: {e}")
            return None
        except Exception as e:
            print(f"[LiepinMCP] 未知错误: {e}")
            return None

    def _parse_response(self, resp: httpx.Response) -> Optional[dict]:
        """解析响应，支持 JSON 和 SSE 格式

        MCP 响应可能是：
        1. 标准 JSON：直接解析
        2. SSE（text/event-stream）：解析 `data:` 行获取 JSON
        """
        content_type = resp.headers.get("content-type", "")

        # SSE 格式
        if "text/event-stream" in content_type:
            return self._parse_sse(resp.text)

        # 标准 JSON
        try:
            data = resp.json()
            # JSON-RPC 错误
            if isinstance(data, dict) and data.get("error"):
                err = data["error"]
                print(f"[LiepinMCP] JSON-RPC 错误: code={err.get('code')} message={err.get('message')}")
                return None
            return data
        except json.JSONDecodeError as e:
            # 可能是 SSE 格式但 Content-Type 不规范
            if "data:" in resp.text:
                return self._parse_sse(resp.text)
            print(f"[LiepinMCP] JSON 解析失败: {e}")
            return None

    def _parse_sse(self, text: str) -> Optional[dict]:
        """解析 SSE 响应

        从 `data:` 行提取 JSON 内容，合并为完整响应。
        """
        last_data = None
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                data_str = line[5:].strip()
                if not data_str:
                    continue
                try:
                    parsed = json.loads(data_str)
                    last_data = parsed
                except json.JSONDecodeError:
                    continue

        if last_data is None:
            print("[LiepinMCP] SSE 响应无有效 data 行")
            return None

        # JSON-RPC 错误
        if isinstance(last_data, dict) and last_data.get("error"):
            err = last_data["error"]
            print(f"[LiepinMCP] JSON-RPC 错误: code={err.get('code')} message={err.get('message')}")
            return None

        return last_data

    def _extract_tool_result(self, response: Optional[dict]) -> Optional[dict]:
        """从 tools/call 响应中提取工具返回结果

        MCP 工具结果通常在 result.content[0].text 中，是 JSON 字符串。
        如果 result.isError 为 true，表示工具执行失败（如 401 Unauthorized），返回 None。
        """
        if not response:
            return None

        result = response.get("result")
        if not result:
            return None

        # 工具执行失败（Token 无效、参数错误等）
        if result.get("isError"):
            print(f"[LiepinMCP] 工具执行失败: {result.get('content')}")
            return None

        # 标准 MCP 格式：result.content 是数组，每个元素有 type 和 text
        content = result.get("content")
        if isinstance(content, list) and content:
            for item in content:
                if not isinstance(item, dict):
                    continue
                if item.get("type") == "text":
                    text = item.get("text", "")
                    try:
                        return json.loads(text)
                    except json.JSONDecodeError:
                        return {"raw_text": text}
            # 没有 text 类型，返回第一个元素
            return content[0]

        # 直接返回 result
        return result

    def validate_token(self) -> bool:
        """验证 Token 是否有效

        通过调用 my-resume 工具检查 Token 有效性。
        tools/list 是公开接口，无法验证 Token，必须调用需要身份认证的工具。
        """
        response = self._call_mcp_tool("my-resume", {})
        if not response:
            return False
        result = response.get("result")
        if not result:
            return False
        # isError 为 true 表示工具执行失败（如 401 Unauthorized）
        if result.get("isError"):
            return False
        return True

    def search_jobs(
        self, keyword: str, city: str = "", page: int = 1, page_size: int = 20
    ) -> list[dict]:
        """搜索猎聘岗位

        调用 MCP 工具 user-search-job
        返回标准化的岗位列表：
        [
            {
                "title": "产品经理",
                "company": "某某公司",
                "salary": "15-25K",
                "city": "杭州",
                "platform": "猎聘",
                "jd_text": "岗位描述...",
                "jd_url": "https://www.liepin.com/job/xxx.shtml",
                "experience": "3-5年",
                "degree": "本科",
                "job_id": "xxx",
                "job_kind": "xxx",
            }
        ]
        """
        arguments = {
            "jobName": keyword,
            "address": city,
            "pageNum": page,
            "pageSize": page_size,
        }

        response = self._call_mcp_tool("user-search-job", arguments)
        tool_result = self._extract_tool_result(response)

        if not tool_result:
            return []

        # 兼容多种返回结构
        raw_jobs = self._extract_job_list(tool_result)
        if not raw_jobs:
            return []

        return [self._normalize_job(j) for j in raw_jobs]

    def _extract_job_list(self, tool_result) -> list[dict]:
        """从工具返回中提取岗位列表，兼容多种字段命名"""
        # 常见字段名：jobs / list / data / jobList / result
        candidates = ["jobs", "list", "data", "jobList", "result", "items"]
        for key in candidates:
            value = tool_result.get(key) if isinstance(tool_result, dict) else None
            if isinstance(value, list):
                return value
            # 嵌套一层：{data: {list: [...]}}
            if isinstance(value, dict):
                for sub_key in candidates:
                    sub_value = value.get(sub_key)
                    if isinstance(sub_value, list):
                        return sub_value

        # 直接是列表
        if isinstance(tool_result, list):
            return tool_result

        return []

    def _normalize_job(self, raw: dict) -> dict:
        """将猎聘原始岗位数据标准化为统一格式

        猎聘 MCP API 实际返回字段（2026-06 实测）：
        - jobId: 岗位ID
        - jobType: "1"（猎头）或 "2"（企业直招）
        - jobName: 岗位名称
        - company: 公司名
        - location: 工作地点（如 "杭州-彭埠"）
        - salary: 薪资（如 "30-60k·16薪"）
        - education: 学历要求
        - workYears: 工作年限
        - industry: 行业
        - companyTags: 公司标签列表
        - financingStage: 融资阶段
        - companySize: 公司规模
        - companyLogo: 公司logo
        - jobDetailUrl: 岗位详情页完整URL
        """
        title = raw.get("jobName") or raw.get("title") or ""
        company = raw.get("company") or raw.get("companyName") or ""
        salary = raw.get("salary") or raw.get("salaryShow") or ""
        city = raw.get("location") or raw.get("city") or raw.get("address") or ""
        # MCP API 不返回 JD 文本，用行业+标签拼接简介
        industry = raw.get("industry") or ""
        work_years = raw.get("workYears") or raw.get("experience") or ""
        education = raw.get("education") or raw.get("degree") or ""
        jd_url = raw.get("jobDetailUrl") or raw.get("jdUrl") or raw.get("url") or ""
        job_id = str(raw.get("jobId") or raw.get("job_id") or raw.get("id") or "")
        job_kind = raw.get("jobType") or raw.get("jobKind") or ""

        # 拼接岗位简介（MCP不返回JD正文）
        tags = raw.get("companyTags") or []
        company_size = raw.get("companySize") or ""
        financing = raw.get("financingStage") or ""
        summary_parts = []
        if industry:
            summary_parts.append(f"行业：{industry}")
        if work_years:
            summary_parts.append(f"经验：{work_years}")
        if education:
            summary_parts.append(f"学历：{education}")
        if company_size:
            summary_parts.append(f"规模：{company_size}")
        if financing:
            summary_parts.append(f"融资：{financing}")
        if tags:
            summary_parts.append(f"福利：{'、'.join(tags)}")
        jd_text = " | ".join(summary_parts) if summary_parts else "暂无岗位描述"

        # 如果没有 jd_url 但有 job_id，构造猎聘标准 URL
        if not jd_url and job_id:
            jd_url = f"https://www.liepin.com/job/{job_id}.shtml"

        return {
            "title": title,
            "company": company,
            "salary": salary,
            "city": city,
            "platform": "猎聘",
            "jd_text": jd_text,
            "jd_url": jd_url,
            "experience": work_years,
            "degree": education,
            "job_id": job_id,
            "job_kind": job_kind,
        }

    def get_resume(self) -> Optional[dict]:
        """获取当前用户简历

        调用 MCP 工具 my-resume
        """
        response = self._call_mcp_tool("my-resume", {})
        return self._extract_tool_result(response)

    def apply_job(self, job_id: str, job_kind: str) -> bool:
        """投递岗位

        调用 MCP 工具 user-apply-job
        """
        arguments = {
            "jobId": job_id,
            "jobKind": job_kind,
        }
        response = self._call_mcp_tool("user-apply-job", arguments)
        if response is None:
            return False

        # 检查是否有错误
        if response.get("error"):
            return False

        # 检查 result 是否存在且非错误
        result = response.get("result")
        if result is None:
            return False

        # 某些实现会在 content 中返回 success 状态
        tool_result = self._extract_tool_result(response)
        if isinstance(tool_result, dict):
            # 显式 success 字段
            if "success" in tool_result:
                return bool(tool_result["success"])
            # code/message 判断
            code = tool_result.get("code")
            if code is not None:
                return str(code) == "0" or str(code) == "200"

        return True


if __name__ == "__main__":
    # 测试（需要真实 Token）
    token = input("请输入猎聘 Token: ")
    client = LiepinMCPClient(token)

    # 验证 Token
    if client.validate_token():
        print("Token 有效")
    else:
        print("Token 无效")
        exit()

    # 搜索岗位
    jobs = client.search_jobs("产品经理", "杭州")
    print(f"找到 {len(jobs)} 个岗位")
    for job in jobs[:3]:
        print(f"  {job['title']} @ {job['company']} ({job['salary']})")
