from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Application, Job, InterviewReview, Profile, InterviewPracticeSession
from auth import get_current_user
from datetime import datetime
from ai_client import call_pinme_llm
import re
import json

router = APIRouter(tags=["interviews"])


class GenerateRequest(BaseModel):
    application_id: int


@router.post("/interviews/generate")
def generate_interview_prep(
    req: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify application belongs to user and load job info
    app = (
        db.query(Application)
        .filter(
            Application.id == req.application_id,
            Application.user_id == current_user.id,
        )
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="投递记录不存在")

    job = app.job
    job_title = job.title if job else "目标岗位"
    company = job.company if job else "贵公司"

    return {
        "self_introduction": f"面试官好，我是谢忠鸿，国家一级注册建筑师，9年建筑全流程经验。擅长将复杂项目拆解为标准化流程，主导过30+产品的研发全周期。最近在系统学习AI工具链，已将AI融入日常工作流提升效率。这个{job_title}方向与我的建筑+AI复合背景高度契合，我希望将建筑行业的标准化方法论迁移到AI产品落地中。期待与您深入交流。",
        "qa_pairs": [
            {
                "category": "必答题",
                "question": "请简单介绍一下你自己",
                "answer": "我是谢忠鸿，国家一级注册建筑师，9年建筑行业经验。主导过30+产品的研发全周期，擅长将复杂项目拆解为标准化流程。近一年系统学习AI工具链（Python、LangChain、Prompt Engineering），已将AI融入日常工作流。我希望将建筑行业的系统化思维和标准化方法论应用到AI产品落地中。",
            },
            {
                "category": "必答题",
                "question": "为什么离开建筑行业转型AI？",
                "answer": "建筑行业正在经历数字化转型，我意识到AI对传统行业的重塑潜力巨大。在做建筑项目时，我发现大量重复性工作可以用AI自动化，这让我对AI产生了浓厚兴趣。我花了近一年时间系统学习，发现自己对AI产品的逻辑和建筑的系统化思维天然契合——都是在复杂约束下找到最优解。",
            },
            {
                "category": "技术问题",
                "question": "你如何理解AI解决方案工程师的职责？",
                "answer": "我认为AI解决方案工程师是连接技术和业务的桥梁。核心职责有三个：一是理解客户业务痛点，将模糊需求转化为可落地的技术方案；二是设计端到端的AI解决方案，包括数据流、模型选型、效果评估；三是推动方案落地，协调各方资源确保交付。这和我做建筑项目管理的逻辑一致——从需求到方案再到交付。",
            },
            {
                "category": "技术问题",
                "question": "你目前在AI方面的技术储备如何？",
                "answer": "我掌握了Python编程（数据处理、API开发）、Prompt Engineering（结构化提示词设计）、LangChain基础（Chain、Agent概念）、以及主流AI工具的使用（Cursor、Claude、GPT等）。目前正在深入学习RAG架构和Agent开发。虽然和专业的AI工程师有差距，但我的优势在于快速学习和将技术落地为实际解决方案的能力。",
            },
            {
                "category": "亮点问题",
                "question": "你最大的优势是什么？",
                "answer": "我最大的优势是系统化思维和执行力。作为一级注册建筑师，我习惯于在复杂多约束条件下找到最优解。主导30+产品的经验让我具备了完整的需求分析→方案设计→落地交付的能力。转AI后，我把这套方法论迁移过来，能快速理解业务、梳理需求、推动落地。我的执行力体现在：决定转型后，3个月内完成了Python和AI基础知识的学习。",
            },
            {
                "category": "亮点问题",
                "question": "你在建筑行业的经验如何迁移到AI领域？",
                "answer": "建筑和AI解决方案有三个核心共通点：第一是需求管理——和客户沟通、梳理需求、输出方案，这和我做建筑方案设计完全一致；第二是项目管理——协调多方资源、控制风险和进度，9年经验直接复用；第三是标准化思维——将复杂项目拆解为可复用的流程和模板，这正是AI产品规模化落地的关键。",
            },
            {
                "category": "行为问题",
                "question": "请分享一个你解决复杂问题的案例（STAR）",
                "answer": "【Situation】我主导的一个建筑产品研发项目中，需要在6个月内完成从概念到量产，涉及10+个专业协作。【Task】我的任务是建立高效的协作流程，确保各专业无缝衔接。【Action】我设计了一套标准化研发流程：将项目拆解为5个阶段、12个关键节点，每个节点明确输入输出和时间要求；建立了周例会+日站会制度；开发了共享进度看板。【Result】项目提前2周完成，产品上市后年销售额超过5000万。这个经验直接适用于AI项目交付管理。",
            },
            {
                "category": "行为问题",
                "question": "作为跨行业转型者，你如何弥补经验差距？",
                "answer": "我采取了三管齐下的策略：一是快速学习，每天投入3-4小时系统学习AI知识，建立知识体系而非零散记忆；二是实践驱动，用实际项目验证学习成果（如搭建了个人AI工作系统）；三是发挥长板，我不和AI科班生拼技术深度，而是发挥我的系统思维和业务理解优势。我相信团队需要多样化的人才组合，我的建筑+AI复合背景恰好是市场上的稀缺组合。",
            },
        ],
        "stories": [
            {
                "id": 1,
                "title": "主导30+产品研发全周期",
                "situation": "在某建筑科技公司担任产品研发负责人，需要同时推进多个产品线的研发工作，团队涉及建筑、结构、暖通等10+专业。",
                "task": "建立高效的产品研发管理体系，确保各项目按时按质交付。",
                "action": "1. 将产品研发流程标准化为5阶段12节点；2. 建立跨专业协作机制和共享信息平台；3. 实施敏捷迭代，每两周一个Sprint回顾。",
                "result": "30+产品全部按计划完成研发，其中3款成为行业爆款，年销售额超1亿。研发效率提升40%，跨专业返工率降低60%。",
                "reflection": "这次经历让我深刻认识到标准化流程和系统化思维的力量。这套方法论完全适用于AI产品交付管理——将复杂项目拆解为可控的节点，用流程保证质量。",
            },
            {
                "id": 2,
                "title": "从零学习AI并搭建个人工作系统",
                "situation": "2025年决定从建筑转型AI，但没有任何编程和AI背景，需要快速建立知识体系。",
                "task": "在6个月内掌握AI应用开发的基础知识和工具，并能独立完成实际项目。",
                "action": "1. 制定学习路线图：Python → API开发 → Prompt Engineering → LangChain → Agent；2. 每天3-4小时系统学习+实践；3. 搭建个人AI工作系统作为实战项目。",
                "result": "3个月内完成Python和AI基础知识学习，独立搭建了包含知识管理、任务管理、求职辅助等模块的个人AI工作系统，可运行。",
                "reflection": "这次转型学习验证了我的快速学习能力和执行力。更重要的是，我发现AI领域的逻辑思维和建筑的系统化思维高度一致——都是理解需求→设计方案→落地执行的闭环。",
            },
            {
                "id": 3,
                "title": "解决跨专业协作冲突",
                "situation": "一个大型建筑项目中，建筑方案和结构方案存在严重冲突，双方各执己见，项目进度停滞2周。",
                "task": "打破僵局，找到兼顾建筑效果和结构可行性的方案，推动项目继续。",
                "action": "1. 分别深入了解双方的核心诉求和底线；2. 组织3次联合工作坊，用可视化方式呈现每个方案的利弊；3. 提出了3个折中方案供决策层选择。",
                "result": "第2个方案获得通过，项目恢复推进。最终项目获得省级优秀设计奖，客户满意度评分9.2/10。",
                "reflection": "这个案例展示了我在复杂利益相关方中协调和推动的能力。AI解决方案工程师同样需要在客户需求、技术可行性和商业价值之间找到平衡点。",
            },
            {
                "id": 4,
                "title": "一级注册建筑师考试",
                "situation": "一级注册建筑师考试是全国通过率最低的职业资格考试之一（约8%），需要在9门科目中全部通过。",
                "task": "在正常工作的同时备考，合理分配时间，在2年内通过全部科目。",
                "action": "1. 制定详细的备考计划：按科目难度分配时间权重；2. 利用碎片时间（通勤、午休）刷题；3. 周末集中攻克难点科目；4. 考前2个月进入冲刺模式。",
                "result": "2年内通过全部9门考试，取得国家一级注册建筑师资格。目前全国持证人数约3万人。",
                "reflection": "这个经历证明了我的自律和持续学习能力。面对任何新的知识领域，我都有信心通过系统化的学习方法快速掌握。这也是我敢于从建筑转型AI的底气来源。",
            },
            {
                "id": 5,
                "title": "推动建筑产品数字化选型工具",
                "situation": "公司产品线复杂，销售人员需要记住上百个产品的参数和适用场景，选型效率低、错误率高。",
                "task": "开发一个智能选型工具，帮助销售人员快速匹配合适的产品方案。",
                "action": "1. 梳理产品参数和适用场景，建立知识库；2. 设计决策树逻辑，将复杂的选型规则结构化；3. 协调IT团队开发Web端工具；4. 用真实案例测试和迭代。",
                "result": "选型工具上线后，销售选型效率提升50%，错误率降低70%。这个工具后来被推广到全国所有办事处使用。",
                "reflection": "虽然不是用AI技术实现的，但这次经历让我第一次体验了'用技术手段解决业务问题'的全流程。这和我现在追求的AI解决方案方向精神一致——技术服务于业务价值。",
            },
        ],
        "questions_to_ask": [
            {
                "category": "团队与技术",
                "question": "目前AI团队的规模和组成是怎样的？工程师、产品、算法分别有多少人？",
            },
            {
                "category": "团队与技术",
                "question": "公司目前在哪些业务场景中应用了AI？效果如何？",
            },
            {
                "category": "团队与技术",
                "question": "团队目前用哪些技术栈和工具链？",
            },
            {
                "category": "业务与产品",
                "question": "这个岗位未来半年最重要的交付目标是什么？",
            },
            {
                "category": "业务与产品",
                "question": "目前公司AI产品的客户主要是哪些行业？客单价和交付周期大概是？",
            },
            {
                "category": "成长与发展",
                "question": "公司对新人的培养机制是怎样的？有没有导师制度？",
            },
            {
                "category": "成长与发展",
                "question": "这个岗位的晋升路径是怎样的？",
            },
            {
                "category": "文化与管理",
                "question": "团队的工作节奏是怎样的？加班情况如何？",
            },
            {
                "category": "文化与管理",
                "question": "公司的决策文化是怎样的？是自上而下还是更扁平？",
            },
            {
                "category": "其他",
                "question": "下一轮面试大概是什么时候？面试官是谁？",
            },
        ],
        "tips": [
            "携带纸质简历2份，准备电子版备用",
            "准备AI工作流演示截图或录屏（如个人AI工作系统）",
            "提前了解公司产品线和近期业务动态",
            "准备1-2个反问问题，体现你的思考深度",
            "面试前测试设备（如果是线上面试），确保网络和摄像头正常",
            "提前10-15分钟到达（线下面试）或进入会议室（线上面试）",
            "穿着得体，保持自信但不傲慢的态度",
            "准备好STAR故事的关键数据（30+产品、年销售额等）",
            "准备好'为什么转型'的真诚回答——这是面试官的必问问题",
            "面试结束后24小时内发送感谢邮件",
        ],
    }
    _MOCK_PREP.update(result_data)  # Store for reuse
    return result_data


def _get_profile_text(db: Session, user_id: int) -> str:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if not profile:
        return "国家一级注册建筑师，9年建筑全流程经验，AI转型中"
    parts = []
    if profile.name:
        parts.append(f"候选人: {profile.name}")
    if profile.city:
        parts.append(f"目标城市: {profile.city}")
    if profile.salary_min:
        parts.append(f"期望薪资: {profile.salary_min}K-{profile.salary_max}K")
    return "；".join(parts) if parts else "专业候选人"


_FULL_KIT_PROMPT = """你是一个大厂资深面试官兼转型导师。请为候选人生成完整面试全案。

## 语言约束（必须遵守）
1. 禁止使用「非常」「显著」「极大地」「卓有成效」等虚浮形容词
2. 每个策略必须说明选择依据（为什么选这个方案而非其他）
3. 每个成果必须量化到具体指标（TSH、pp、转化率、效率提升%等）
4. 每句话必须有信息增量，删除冗余表述
5. 候选人背景中的建筑行业经验要转化为产品/项目/策略语言

## 候选人背景
{profile_text}

## 目标职位
公司：{company}
岗位：{title}
JD：
{jd_text}

## 输出要求
{{
  "self_introduction": "3分钟自我介绍（750-850字，口语化），结构：【开场15s】姓名背景 → 【岗位匹配30s】与JD挂钩的核心能力 → 【Top3项目120s】每个项目说明与JD哪条对应+做了什么+为什么这么做+量化成果 → 【收尾15s】",
  "company_research": {{
    "product_analysis": "产品现状：用户画像（人口统计+行为特征+心理特征）、营收模式、优缺点（表格：功能/体验/内容/商业化/技术5维度）、未来方向判断（短/中/长期+判断依据）、营收策略",
    "competitor_analysis": "选择2-3个竞品，表格对比（用户画像/营收模式/优劣势/发展方向/营收策略），说明竞品选择依据",
    "historical_evolution": "产品历史阶段划分表格（阶段/时间/核心策略/关键事件/数据表现），各维度历史变化（用户/营收/优势/劣势/方向），演进逻辑分析（为什么从A到B、关键转折点、当前阶段判断）",
    "user_voices": "用户痛点Top3+赞誉Top3，来源标注"
  }},
  "qa_pairs": [
    {{"category": "产品Sense/策略逻辑/异常处理/用户心理/转型动机/行为问题", "question": "面试题", "examiner_intent": "面试官通过此题想考察什么", "answer": "高水平回答（含指标体系/漏斗归因/用户心理拆解，200-300字）", "key_points": ["回答要点1", "回答要点2"]}}
  ],
  "stories": [
    {{"id": 1, "jd_link": "对应JD哪条要求", "title": "故事标题", "situation": "S情境（业务痛点+问题规模+为什么不解决不行）", "task": "T任务（核心指标+目标值+时间节点）", "action": "A行动（策略一/二/三，每项含具体动作+实施细节+选择依据）", "result": "R结果（表格化：指标/变化幅度/绝对数值/业务价值）", "methodology": "可复用方法论"}}
  ],
  "questions_to_ask": [
    {{"category": "战略层/业务层/技术层/文化层", "question": "反问问题", "timing": "适合在什么环节提问", "value": "这个问题能体现什么深度"}}
  ],
  "salary_negotiation": "薪资谈判要点：1.期望薪资范围 2.谈判话术 3.了解总包构成（基本工资+绩效+年终+股票+五险一金基数） 4.谈判timing（什么时候谈薪资）5.应对压价话术",
  "weaknesses": [
    {{"weakness": "可能的弱点", "honest_answer": "诚实回答", "mitigation": "化解策略"}}
  ],
  "red_flags": [
    {{"flag": "面试中出现的红旗信号", "response": "应对策略"}}
  ],
  "gap_analysis": {{
    "hidden_skills": ["JD要求但简历未体现的能力"],
    "priority1_must_fill": [
      {{"gap": "差距内容", "action": "具体补课方式", "estimated_hours": 数字, "resource": "参考资源链接/书名/课程名", "checkpoints": ["检查点1", "检查点2"]}}
    ],
    "priority2_should_fill": [{{"gap": "...", "action": "...", "estimated_hours": 数字, "resource": "...", "checkpoints": ["..."]}}],
    "priority3_nice_to_have": [{{"gap": "...", "action": "...", "estimated_hours": 数字, "resource": "...", "checkpoints": ["..."]}}]
  }},
  "tips": ["面试准备清单（8-10项）"]
}}"""


@router.post("/interviews/generate-full-kit")
async def generate_full_kit(
    req: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    app = (
        db.query(Application)
        .filter(
            Application.id == req.application_id,
            Application.user_id == current_user.id,
        )
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="投递记录不存在")

    job = app.job
    job_title = job.title if job else "目标岗位"
    company = job.company if job else "贵公司"
    jd_text = job.jd_text if job else ""

    profile_text = _get_profile_text(db, current_user.id)

    system_prompt = _FULL_KIT_PROMPT.format(
        profile_text=profile_text,
        company=company,
        title=job_title,
        jd_text=jd_text[:3000],
    )
    user_message = f"请为{job_title}岗位生成完整面试全案。候选人：{profile_text}。"

    try:
        ai_response = await call_pinme_llm(system_prompt, user_message, temperature=0.7, max_tokens=4000)
    except Exception:
        return _build_mock_from_existing(job_title, company)

    if ai_response:
        try:
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                data = json.loads(json_match.group())
                if "self_introduction" in data or "qa_pairs" in data:
                    return data
        except (json.JSONDecodeError, KeyError):
            pass

    return _build_mock_from_existing(job_title, company)


def _build_mock_from_existing(job_title: str, company: str) -> dict:
    existing = _MOCK_PREP.copy()
    mock_salary = """薪资谈判要点：
1. 期望薪资：25K-35K
2. 话术：'基于我的专业背景和学习能力，以及杭州同类岗位的市场水平，我期望的薪资在25K-35K之间。我更看重的是成长机会和团队的潜力。'
3. 了解总包构成：询问基本工资、绩效比例、年终奖、五险一金基数
4. Timing：先了解对方薪资结构再报价"""
    mock_weaknesses = [
        {"weakness": "缺乏互联网行业经验", "honest_answer": "坦诚说，我之前在建筑行业，对互联网的快速迭代和devops流程还不太熟悉", "mitigation": "但我有9年复杂系统项目管理经验，快速学习和适应是我的核心能力。入职前我正在系统学习敏捷开发和AI工程化流程。"},
        {"weakness": "AI技术深度有限", "honest_answer": "我的AI技术背景来自自学，不需要伪装专家", "mitigation": "我的定位是AI解决方案工程师，核心价值是把AI技术落地为业务解决方案。我的建筑行业经验恰好让我在需求理解和项目管理上有独特优势。"},
        {"weakness": "行业经验差异", "honest_answer": "我对互联网行业的专业术语和运营逻辑还不够熟悉", "mitigation": "我正在加速学习，入职前每天阅读行业报告。我擅长快速上手新领域，过去在建筑行业也是跨多个项目类型。"},
    ]
    mock_red_flags = [
        {"flag": "面试官反复质疑你的行业经验不足", "response": "保持自信，用具体案例证明你的跨行业学习能力。'我完全理解您的顾虑。其实我刚才提到的30+产品管理经验中，有很多次是从零开始学习新领域——这恰好是我最擅长的事。'"},
        {"flag": "面试官问'你觉得你配得上这个薪资吗'", "response": "客观陈述：'我的一级注册建筑师资质是国家最高级别职业资格之一，通过率约8%。我的系统化思维和执行力是用9年时间证明的。我相信这些能力和这个岗位的价值匹配。'"},
        {"flag": "面试官全程看手机/心不在焉", "response": "继续保持专业态度，用简短有力的回答吸引注意。可能他们今天很忙，不代表否定你。结束后正常跟进。"},
    ]
    mock_props = [
        "个人AI工作系统演示截图（如已搭建）",
        "一级注册建筑师证书复印件",
        "项目管理案例精选（2-3个）",
        "AI学习笔记或项目文档",
    ]
    mock_company_research = {
        "product_analysis": "由于无法联网获取实时信息，建议面试前自行调研：\n1. 访问公司官网了解产品矩阵\n2. 搜索「公司名 2024 财报/战略」了解业务方向\n3. 在应用商店查看产品评价和最新版本更新日志\n4. 关注公司官方公众号/微博获取最新动态",
        "competitor_analysis": "建议自行搜索竞品对比：\n1. 搜索「产品名 vs 竞品名」查看对比评测\n2. 使用 SimilarWeb 查看流量对比\n3. 查看各竞品的应用商店评分和评价\n4. 关注行业报告（艾瑞/易观/QuestMobile）",
        "historical_evolution": "建议面试前了解产品演进：\n1. 搜索「产品名 发展历程」\n2. 查看产品版本更新记录\n3. 了解关键里程碑事件（融资/重大改版/战略转型）\n4. 分析产品当前所处的生命周期阶段",
        "user_voices": "建议面试前收集用户声音：\n1. 搜索 site:xiaohongshu.com 产品名\n2. 查看应用商店用户评价\n3. 关注知乎相关话题讨论\n4. 体验产品并记录自己的真实感受"
    }
    mock_gap_analysis = {
        "hidden_skills": ["跨行业经验迁移能力", "非传统背景的学习能力证明", "行业特定工具/平台经验"],
        "priority1_must_fill": [
            {"gap": "行业特定知识", "action": "面试前阅读目标公司所在行业的3份深度报告，了解行业格局、核心指标和常见术语", "estimated_hours": 6, "resource": "艾瑞咨询/易观分析/QuestMobile行业报告", "checkpoints": ["能说出行业Top3玩家及其差异", "能说出行业核心指标及合理范围", "能说出行业1-2个最新趋势"]},
            {"gap": "JD核心技能匹配", "action": "对照JD逐条检查自己的匹配度，准备每条要求的对应案例", "estimated_hours": 4, "resource": "JD原文", "checkpoints": ["每条JD要求都有对应案例", "案例包含背景+行动+量化成果", "能解释为什么选择这个案例"]}
        ],
        "priority2_should_fill": [
            {"gap": "目标公司产品深度体验", "action": "深度使用目标公司核心产品，从用户视角记录体验、发现问题和改进建议", "estimated_hours": 8, "resource": "产品App/网站", "checkpoints": ["能画出产品核心流程图", "能说出3个体验亮点和3个改进点", "能分析产品的商业模式"]}
        ],
        "priority3_nice_to_have": [
            {"gap": "技术基础了解", "action": "了解目标岗位涉及的技术栈基本概念（不需要精通，但要知道是什么）", "estimated_hours": 3, "resource": "技术入门文章/视频", "checkpoints": ["能解释关键技术名词的含义", "能理解技术选型的基本逻辑"]}
        ]
    }
    existing["salary_negotiation"] = mock_salary
    existing["weaknesses"] = mock_weaknesses
    existing["red_flags"] = mock_red_flags
    existing["props"] = mock_props
    existing["company_research"] = mock_company_research
    existing["gap_analysis"] = mock_gap_analysis
    return existing


# Store the mock data so it can be reused
_MOCK_PREP = {}
def list_interview_preps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from models import InterviewPrep

    preps = (
        db.query(InterviewPrep)
        .filter(InterviewPrep.user_id == current_user.id)
        .all()
    )
    return preps


class ReviewRequest(BaseModel):
    interview_date: str
    questions_review: str = ""
    self_rating: int = 3
    interviewer_feedback: str = ""
    improvements: str = ""


@router.post("/interviews/{application_id}/review")
def save_review(
    application_id: int,
    req: ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify application belongs to user
    app = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id,
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="投递记录不存在")

    interview_date = datetime.fromisoformat(req.interview_date.replace("Z", "+00:00"))

    review = InterviewReview(
        user_id=current_user.id,
        application_id=application_id,
        interview_date=interview_date,
        questions_review=req.questions_review,
        self_rating=req.self_rating,
        interviewer_feedback=req.interviewer_feedback,
        improvements=req.improvements,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return _serialize_review(review)


@router.get("/interviews/{application_id}/reviews")
def list_reviews(
    application_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify application belongs to user
    app = db.query(Application).filter(
        Application.id == application_id,
        Application.user_id == current_user.id,
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="投递记录不存在")

    reviews = (
        db.query(InterviewReview)
        .filter(
            InterviewReview.user_id == current_user.id,
            InterviewReview.application_id == application_id,
        )
        .order_by(InterviewReview.created_at.desc())
        .all()
    )
    return [_serialize_review(r) for r in reviews]


def _serialize_review(r: InterviewReview) -> dict:
    return {
        "id": r.id,
        "user_id": r.user_id,
        "application_id": r.application_id,
        "interview_date": r.interview_date.isoformat() if isinstance(r.interview_date, datetime) else str(r.interview_date),
        "questions_review": r.questions_review or "",
        "self_rating": r.self_rating,
        "interviewer_feedback": r.interviewer_feedback or "",
        "improvements": r.improvements or "",
        "created_at": r.created_at.isoformat() if isinstance(r.created_at, datetime) else str(r.created_at),
    }


# ============================================================
# 交互式面试训练（参考 JobOK interview-training.md）
# ============================================================

_PRACTICE_START_PROMPT = """你是一位资深面试官，正在对候选人进行模拟面试。请遵循以下原则：

## 面试规则
1. **一次只问一个问题**，不要一次抛出多个问题
2. 根据候选人的回答质量决定是否追问，**针对同一问题最多追问2次**（针对证据弱或表述模糊处）
3. 追问后若回答仍不清晰，转入下一题，不要纠缠
4. 态度专业、友好，像真实面试官一样

## 常见问题集（按需选择或基于JD生成）
- 自我介绍
- 为什么投这个岗位
- 讲一个项目经历
- 团队中具体做了什么
- 遇到的困难及解决方法
- 优势和短板
- 为什么选择这个城市/行业/公司
- 你有什么问题想问我们

## 输出要求
请以JSON格式返回（只返回JSON）：
{{
  "question": "面试问题（一次只问一个）",
  "question_type": "self_intro|motivation|project|teamwork|difficulty|strength_weakness|choice|reverse_question|jd_based",
  "intent": "这个问题想考察什么（一句话）"
}}
"""

_PRACTICE_ANSWER_PROMPT = """你是一位资深面试官，正在对候选人的回答进行反馈。请遵循以下原则：

## 反馈规则
1. **一次只问一个问题**，反馈后如果要追问，只问一个追问问题
2. 针对同一问题**最多追问2次**（针对证据弱或表述模糊处），超过2次或回答已充分则转入下一题
3. 反馈要具体、可执行，避免空泛的"很好"或"需要改进"

## 反馈结构
- what_worked：回答中好的点（具体到哪句话/哪个细节）
- what_unclear：不清楚或模糊的地方
- what_not_to_say：不该说的内容（如有）
- star_improved：用STAR结构改进后的回答
- practice_drill：一个具体的练习建议
- next_action：follow_up（追问）/ next_question（下一题）/ end（结束）
- next_question：如果next_action不是end，提供追问或下一题（一次只问一个）

## next_action 判断依据
- follow_up：回答有真实经历但证据弱/表述模糊/缺少量化，可追问细节
- next_question：回答已充分或追问已达2次上限，转入下一题
- end：已完成所有计划问题或候选人主动结束

## 输出要求
请以JSON格式返回（只返回JSON）：
{{
  "what_worked": "回答中好的点",
  "what_unclear": "不清楚的地方",
  "what_not_to_say": "不该说的内容（如无则留空字符串）",
  "star_improved": "STAR改进版回答",
  "practice_drill": "一个练习建议",
  "next_action": "follow_up | next_question | end",
  "next_question": "追问或下一题（如果next_action是end则留空字符串）"
}}
"""


class PracticeStartRequest(BaseModel):
    target_role: str
    job_description: str = ""


class PracticeAnswerRequest(BaseModel):
    session_id: int
    answer: str


def _serialize_practice_session(s: InterviewPracticeSession) -> dict:
    return {
        "id": s.id,
        "user_id": s.user_id,
        "target_role": s.target_role or "",
        "job_description": s.job_description or "",
        "status": s.status or "active",
        "current_question": s.current_question or "",
        "question_type": s.question_type or "general",
        "follow_up_count": s.follow_up_count or 0,
        "transcript": s.transcript or [],
        "created_at": s.created_at.isoformat() if isinstance(s.created_at, datetime) else str(s.created_at),
        "updated_at": s.updated_at.isoformat() if isinstance(s.updated_at, datetime) else str(s.updated_at),
    }


@router.post("/interviews/practice/start")
async def practice_start(
    req: PracticeStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """开始面试练习，AI生成第一个面试问题。"""
    if not req.target_role.strip():
        raise HTTPException(status_code=400, detail="target_role 不能为空")

    profile_text = _get_profile_text(db, current_user.id)

    user_message = (
        f"候选人背景：{profile_text}\n"
        f"目标岗位：{req.target_role}\n"
    )
    if req.job_description.strip():
        user_message += f"岗位JD：\n{req.job_description[:2000]}\n"
    user_message += "请生成第一个面试问题。"

    try:
        ai_response = await call_pinme_llm(
            _PRACTICE_START_PROMPT, user_message,
            temperature=0.7, max_tokens=800,
        )
    except Exception:
        ai_response = None

    question = "请简单介绍一下你自己。"
    question_type = "self_intro"
    intent = "考察候选人的自我认知和岗位匹配度"

    if ai_response:
        try:
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                data = json.loads(json_match.group())
                question = data.get("question", question)
                question_type = data.get("question_type", question_type)
                intent = data.get("intent", intent)
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

    session = InterviewPracticeSession(
        user_id=current_user.id,
        target_role=req.target_role,
        job_description=req.job_description,
        status="active",
        current_question=question,
        question_type=question_type,
        follow_up_count=0,
        transcript=[
            {"role": "interviewer", "content": question, "question_type": question_type, "intent": intent},
        ],
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "question": question,
        "question_type": question_type,
        "intent": intent,
    }


@router.post("/interviews/practice/answer")
async def practice_answer(
    req: PracticeAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交回答，AI返回反馈和下一步问题。"""
    session = (
        db.query(InterviewPracticeSession)
        .filter(
            InterviewPracticeSession.id == req.session_id,
            InterviewPracticeSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="练习会话不存在")

    if session.status == "ended":
        raise HTTPException(status_code=400, detail="该练习会话已结束")

    if not req.answer.strip():
        raise HTTPException(status_code=400, detail="回答内容不能为空")

    profile_text = _get_profile_text(db, current_user.id)
    transcript_text = _format_transcript(session.transcript or [])

    user_message = (
        f"候选人背景：{profile_text}\n"
        f"目标岗位：{session.target_role}\n"
    )
    if session.job_description:
        user_message += f"岗位JD：\n{session.job_description[:2000]}\n"
    user_message += (
        f"\n## 当前面试进度\n"
        f"已追问次数：{session.follow_up_count}/2\n"
        f"\n## 对话历史\n{transcript_text}\n"
        f"\n## 候选人最新回答\n{req.answer}\n"
        f"\n请对以上回答给出反馈，并决定下一步。"
    )

    try:
        ai_response = await call_pinme_llm(
            _PRACTICE_ANSWER_PROMPT, user_message,
            temperature=0.7, max_tokens=1500,
        )
    except Exception:
        ai_response = None

    feedback = {
        "what_worked": "",
        "what_unclear": "",
        "what_not_to_say": "",
        "star_improved": "",
        "practice_drill": "",
        "next_action": "next_question",
        "next_question": "请讲一个你遇到困难并解决的项目经历。",
    }

    if ai_response:
        try:
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                data = json.loads(json_match.group())
                for key in feedback:
                    if key in data:
                        feedback[key] = data[key]
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

    # Enforce follow-up limit: max 2 follow-ups per question
    next_action = feedback.get("next_action", "next_question")
    if next_action == "follow_up" and session.follow_up_count >= 2:
        next_action = "next_question"
        feedback["next_action"] = "next_question"
        if not feedback.get("next_question"):
            feedback["next_question"] = "请讲一个你遇到困难并解决的项目经历。"

    # Update session state
    transcript = session.transcript or []
    transcript.append({"role": "candidate", "content": req.answer})
    transcript.append({
        "role": "interviewer",
        "content": feedback.get("next_question", ""),
        "feedback": feedback,
    })

    if next_action == "follow_up":
        session.follow_up_count = (session.follow_up_count or 0) + 1
        session.current_question = feedback.get("next_question", session.current_question)
    elif next_action == "next_question":
        session.follow_up_count = 0
        session.current_question = feedback.get("next_question", "")
    else:  # end
        session.status = "ended"

    session.transcript = transcript
    session.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "feedback": feedback,
        "next_action": next_action,
        "next_question": feedback.get("next_question", ""),
        "follow_up_count": session.follow_up_count,
        "status": session.status,
    }


@router.get("/interviews/practice/history")
def practice_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的练习会话列表。"""
    sessions = (
        db.query(InterviewPracticeSession)
        .filter(InterviewPracticeSession.user_id == current_user.id)
        .order_by(InterviewPracticeSession.created_at.desc())
        .all()
    )
    return [_serialize_practice_session(s) for s in sessions]


def _format_transcript(transcript: list) -> str:
    """Format transcript list into readable text for AI context."""
    if not transcript:
        return "(无对话历史)"
    lines = []
    for item in transcript:
        role = item.get("role", "")
        content = item.get("content", "")
        if role == "interviewer":
            lines.append(f"面试官：{content}")
        elif role == "candidate":
            lines.append(f"候选人：{content}")
    return "\n".join(lines)