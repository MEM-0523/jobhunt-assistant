# autocli 搜索功能异常系统诊断报告

**诊断时间**: 2026-05-30 11:35  
**诊断脚本**: `diagnose_autocli.py`  
**诊断人**: 自动化诊断系统

---

## 1. 诊断结论摘要

| 项目 | 状态 | 说明 |
|------|------|------|
| autocli 二进制 | ✅ 正常 | v0.3.8, 6.0MB, 可执行 |
| autocli 搜索 | ❌ 不可用 | 返回 "您的环境存在异常，请登录后使用." |
| BOSS直聘网络 | ✅ 可达 | zhipin.com:443 连通正常 |
| 搜索算法链路 | ⚠️ 有缺陷 | 分词粒度偏粗，扩展词覆盖不足 |
| 额外 API 需求 | ✅ 不需要 | Mock 降级方案足够 |
| **整体评估** | **⚠️ 降级运行** | autocli 不可用，系统使用 Mock 数据 |

---

## 2. autocli 连通性诊断详情

### 2.1 二进制检测

```
路径: /Users/wutianya/Desktop/我的AI工作系统/50-本地工具/autocli-mac
存在: 是
大小: 6.0 MB
可执行: 是
```

### 2.2 搜索测试

```
命令: autocli-mac boss search "AI产品经理" --format json --limit 3 --city 杭州
耗时: 5646ms
返回码: 0 (成功执行)
返回数据量: 1 条
```

**实际返回内容**:
```json
[
  {
    "name": "Error",
    "url": "您的环境存在异常，请登录后使用."
  }
]
```

### 2.3 根因分析

autocli v0.3.8 调用BOSS直聘搜索接口时，被BOSS直聘的反爬/风控系统拦截。可能原因：

1. **设备指纹检测**: BOSS直聘对请求来源设备做指纹校验，autocli 请求特征不同
2. **Cookie/Session 缺失**: BOSS直聘要求登录态，autocli 可能未正确传递或模拟登录信息  
3. **请求频率限制**: 短时间内频繁请求触发了风控
4. **autocli 版本过旧**: v0.3.8 的请求特征已被BOSS直聘反爬规则覆盖

### 2.4 网络状态

| 目标 | 状态 |
|------|------|
| zhipin.com:443 | ✅ 可达 |
| www.zhipin.com:443 | ✅ 可达 |
| api.zhipin.com:443 | ✅ 可达 |

网络层面无问题，问题出在应用层风控拦截。

---

## 3. 搜索算法链路分析

### 3.1 完整链路: "AI产品经理" → 输入 → 分词 → 匹配打分 → 过滤 → 返回

```
输入: "AI产品经理"
  ↓
Step 1: _tokenize("AI产品经理")
  处理: 替换特殊字符(无) → split(无分隔符) → filter(len≥2)
  ⚠️ 问题: "AI产品经理" 作为整体1个Token，未拆分为 "AI" + "产品经理"
  输出: ['AI产品经理']
  ↓
Step 2: _ARCH_EXPANSION 扩展查询
  'AI产品经理' → 小写 → 'ai产品经理' → 查扩展表 → 无匹配项
  ⚠️ 问题: 扩展表中无 "ai产品经理" 条目，只有 "ai" 和 "产品经理"
  扩展结果: ['ai产品经理'] (原词小写)
  ↓
Step 3: _keyword_match_score
  对每条Mock数据遍历:
    - "ai产品经理" in title? → AI产品经理 ✅ 60分
    - "ai产品经理" in jd_text? → 产品经理(AI方向) ❌
  匹配结果: 1条 (AI产品经理, 60分)
  ↓
Step 4: filter_jobs (硬约束: 杭州, 薪资≥25K)
  AI产品经理: 杭州✅, 30K✅ → 保留
  过滤后: 1条
  ↓
返回: [{title: "AI产品经理", match_score: 60, ...}]
```

### 3.2 识别的问题

| 问题 | 影响 | 严重度 |
|------|------|--------|
| 中文分词粒度粗 | "AI产品经理"未拆分为"AI""产品经理"，无法利用扩展词库 | 高 |
| _ARCH_EXPANSION 缺少组合词 | "ai产品经理"无对应扩展，无法关联"产品"类岗位 | 中 |
| 仅匹配完全包含 | "ai产品经理"在"产品经理(AI方向)"标题中不匹配 | 中 |
| Mock数据量有限 | 30条静态数据覆盖场景不足 | 低 |

### 3.3 改进建议

```python
# 建议: 使用 jieba 分词替代简单空格分词
import jieba

def _tokenize_v2(text: str) -> list[str]:
    words = jieba.lcut(text)
    return [w for w in words if len(w) >= 2]

# "AI产品经理" → ['AI', '产品经理'] ✅ 正确拆分
```

---

## 4. 外部 API 需求分析

| API/方案 | 可用性 | 适用性 | 成本 | 结论 |
|----------|--------|--------|------|------|
| Google Custom Search | 可用 | 低 — 不结构化 | 免费100次/天 | ❌ 不需要 |
| Bing Search API | 可用 | 低 — 不结构化 | 免费1000次/月 | ❌ 不需要 |
| Indeed API | 不可用 | — | — | 2023年已关闭 |
| Glassdoor API | 不可用 | — | — | 未提供公开API |
| BOSS直聘官方API | 不可用 | — | — | 不提供第三方API |
| 爬虫替代方案 | 可行 | 高 | 500-2000元/月 | ⚠️ 最后兜底 |

### 明确结论

**当前 autocli + Mock 降级方案足够**，理由：

1. 搜索引擎API无法结构化解析国内招聘平台职位数据，返回的是非结构化网页，无法提取salary/city/jd等字段
2. BOSS直聘/猎聘等国内主流平台不提供公开API
3. Mock数据覆盖了用户的核心求职方向（AI产品/建筑科技/数字化转型），可作为降级数据源
4. 爬虫方案成本高（服务器+IP代理）且有法律合规风险，不推荐

---

## 5. autocli 修复方案

### 5.1 优先级: P0 — 修复 autocli 登录态

autocli 返回 "请登录后使用" 说明需要有效的登录Session。可能的修复路径：

1. **更新 autocli 版本**: 检查是否有新版 autocli 修复了反爬问题
2. **配置登录Cookie**: 通过 autocli 的登录命令获取有效Session
3. **换用雷大竞品**: 如 `leida` 或其他BOSS直聘搜索CLI工具

### 5.2 操作步骤

```bash
# 尝试1: 检查 autocli 是否有 login 命令
autocli-mac --help

# 尝试2: 如果有 login 命令，尝试登录
autocli-mac login

# 尝试3: 更新 autocli 到最新版本
# (取决于 autocli 的发布渠道)
```

### 5.3 降级保护

当前系统已正确实现降级逻辑:

```python
# jobs.py L781-798
raw_jobs = try_autocli_search(kw, req.city, req.platform)
if raw_jobs is None:
    # 自动降级到 Mock 数据 + 关键字匹配
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
```

降级行为：
- autocli 失败 → 自动使用 MOCK_JOBS（30条预置数据）
- 对Mock数据执行关键词匹配打分
- 返回结果标注 `data_source: "mock"`
- 前端可据此提示用户"当前展示示例数据，实时搜索暂不可用"

---

## 6. 行动计划

| 优先级 | 任务 | 预计工时 |
|--------|------|----------|
| P0 | 修复 autocli 登录态（更新版本/配置Cookie） | 1h |
| P1 | 引入 jieba 分词优化 `_tokenize` 函数 | 0.5h |
| P1 | 扩展 `_ARCH_EXPANSION` 补充组合词映射 | 0.5h |
| P2 | 增加 Mock 数据量至50-100条 | 1h |
| P3 | 调研 leida 等替代CLI工具 | 1h |
| P3 | 添加前端 "当前使用示例数据" 提示 | 0.5h |