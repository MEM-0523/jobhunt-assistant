"""
Demo data seed script.
Called after user registration to populate initial job listings and applications.
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import Job, Application, Notification

# 30 demo jobs selected from MOCK_JOBS, covering 5 cities
DEMO_JOBS = [
    {
        "title": "AI产品经理",
        "company": "某AI科技公司",
        "salary": "30-50K·14薪",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责AI产品需求分析和产品规划，输出PRD文档；深入理解大模型技术能力边界，设计合理的产品体验和交互方案；与算法、工程团队紧密协作，推动产品从概念到上线的全流程落地。",
        "jd_url": "",
    },
    {
        "title": "AI解决方案工程师",
        "company": "某云计算公司",
        "salary": "25-45K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责AI行业解决方案的设计与落地，深入理解客户业务需求并转化为技术方案；主导售前技术交流、POC验证和方案演示。",
        "jd_url": "",
    },
    {
        "title": "Python后端开发",
        "company": "某互联网公司",
        "salary": "25-40K·15薪",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "负责核心业务后端服务的架构设计、开发和维护；设计高性能、高可用的RESTful API和微服务架构。",
        "jd_url": "",
    },
    {
        "title": "产品经理（AI方向）",
        "company": "某独角兽企业",
        "salary": "28-45K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责AI产品线的整体规划和设计；深入理解用户场景，挖掘AI技术在产品中的创新应用机会。",
        "jd_url": "",
    },
    {
        "title": "AI训练师/提示词工程师",
        "company": "某AI创业公司",
        "salary": "20-35K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责大语言模型的提示词设计和持续优化，提升模型输出质量；设计并维护高质量训练数据集。",
        "jd_url": "",
    },
    {
        "title": "技术产品经理",
        "company": "某SaaS公司",
        "salary": "30-50K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "负责技术中台/开发者工具类产品的规划和设计；深入理解开发者需求，设计API、SDK、CLI工具等开发者体验。",
        "jd_url": "",
    },
    {
        "title": "AI建筑设计师",
        "company": "某建筑科技公司",
        "salary": "20-35K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责AI辅助建筑方案设计，利用Stable Diffusion/Midjourney/ComfyUI等工具进行概念方案生成和效果图制作。",
        "jd_url": "",
    },
    {
        "title": "BIM产品经理",
        "company": "某建筑信息化公司",
        "salary": "25-40K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责BIM协同设计平台和管理系统的产品规划和迭代设计；深入调研建筑设计院、施工单位的BIM应用场景和痛点需求。",
        "jd_url": "",
    },
    {
        "title": "智慧城市产品经理",
        "company": "某城投科技公司",
        "salary": "25-45K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "负责智慧城市平台产品的规划设计，涵盖城市数字孪生、IoT数据融合、AI分析决策等模块。",
        "jd_url": "",
    },
    {
        "title": "数字化转型顾问",
        "company": "某咨询公司",
        "salary": "25-40K",
        "city": "上海",
        "platform": "BOSS直聘",
        "jd_text": "为建筑设计院、施工企业和地产开发商提供数字化转型战略咨询服务；开展企业现状诊断，梳理业务流程痛点。",
        "jd_url": "",
    },
    {
        "title": "产品总监",
        "company": "某科技公司",
        "salary": "35-55K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责公司整体产品战略制定，管理10人以上产品团队；主导核心产品线的方向决策。",
        "jd_url": "",
    },
    {
        "title": "项目总监",
        "company": "某建设集团",
        "salary": "30-50K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "负责大型工程项目的全流程管理，涵盖规划设计、施工管理和竣工验收；制定项目总体计划。",
        "jd_url": "",
    },
    {
        "title": "高级产品经理",
        "company": "某中型科技公司",
        "salary": "28-45K",
        "city": "北京",
        "platform": "BOSS直聘",
        "jd_text": "负责核心产品线的需求管理和产品设计，输出高质量的PRD和原型；深入用户调研和竞品分析。",
        "jd_url": "",
    },
    {
        "title": "产品专家",
        "company": "某大厂",
        "salary": "35-60K",
        "city": "深圳",
        "platform": "猎聘",
        "jd_text": "负责创新业务方向的产品探索和孵化，从0到1打造新产品；深入研究行业趋势和用户需求变化。",
        "jd_url": "",
    },
    {
        "title": "AI项目经理",
        "company": "某研究院",
        "salary": "25-40K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "管理AI科研和产品化项目的全生命周期，制定项目计划和里程碑；协调算法研究、工程开发、产品设计等多团队资源。",
        "jd_url": "",
    },
    {
        "title": "高级产品经理（远程）",
        "company": "某国际化公司",
        "salary": "30-50K",
        "city": "成都",
        "platform": "BOSS直聘",
        "jd_text": "远程负责国际产品线的需求管理和产品迭代；与海外团队进行日常沟通和协作；深入理解不同市场的用户需求。",
        "jd_url": "",
    },
    {
        "title": "远程全栈开发",
        "company": "某海外创业公司",
        "salary": "25-45K",
        "city": "成都",
        "platform": "猎聘",
        "jd_text": "远程负责公司核心产品的全栈开发，前后端技术选型和架构设计；使用React/TypeScript开发前端界面。",
        "jd_url": "",
    },
    {
        "title": "AI数据标注经理",
        "company": "某数据服务公司",
        "salary": "15-25K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "管理50人以上AI数据标注团队，制定标注产能和质量目标；建立和完善数据标注SOP、质量检验标准和培训体系。",
        "jd_url": "",
    },
    {
        "title": "UX设计师",
        "company": "某互联网公司",
        "salary": "25-40K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责B端SaaS产品的用户体验设计，输出交互原型和高保真设计稿；进行用户研究和可用性测试。",
        "jd_url": "",
    },
    {
        "title": "前端开发工程师",
        "company": "某科技公司",
        "salary": "25-45K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "负责公司核心产品的前端架构设计和开发；使用React/TypeScript/Next.js技术栈构建高性能Web应用。",
        "jd_url": "",
    },
    {
        "title": "全栈工程师",
        "company": "某创业公司",
        "salary": "30-50K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责创业公司核心产品的全栈开发，从0到1搭建技术架构；使用Node.js/Python构建后端API服务。",
        "jd_url": "",
    },
    {
        "title": "AI产品运营经理",
        "company": "某大模型公司",
        "salary": "25-38K",
        "city": "上海",
        "platform": "BOSS直聘",
        "jd_text": "负责AI产品的用户增长和社区运营；策划并执行用户增长策略，包括内容营销、社群运营、KOL合作等。",
        "jd_url": "",
    },
    {
        "title": "建筑科技BD经理",
        "company": "某建筑科技平台",
        "salary": "20-30K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责建筑科技产品和解决方案的商务拓展，开拓设计院和开发商客户；制定区域市场拓展策略。",
        "jd_url": "",
    },
    {
        "title": "技术产品经理（AI方向）",
        "company": "某头部互联网公司",
        "salary": "30-55K·16薪",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "负责AI中台产品的规划和落地，包括模型训练平台、推理服务和数据标注平台；深入理解算法工程师和业务方的需求。",
        "jd_url": "",
    },
    {
        "title": "数字化转型总监",
        "company": "某大型集团",
        "salary": "40-60K",
        "city": "成都",
        "platform": "猎聘",
        "jd_text": "主导集团数字化转型战略的制定和执行，推动业务流程的数字化再造；规划和建设企业级数据中台。",
        "jd_url": "",
    },
    {
        "title": "AI应用架构师",
        "company": "某互联网独角兽",
        "salary": "35-55K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "设计AI Native应用的技术架构，包括RAG系统、Agent框架和推理优化；主导技术选型，制定AI应用的技术规范。",
        "jd_url": "",
    },
    {
        "title": "智慧城市解决方案专家",
        "company": "某央企科技子公司",
        "salary": "30-45K",
        "city": "北京",
        "platform": "BOSS直聘",
        "jd_text": "负责智慧城市解决方案的售前技术支持和方案设计；基于AI、IoT、数字孪生等技术设计城市治理和公共安全解决方案。",
        "jd_url": "",
    },
    {
        "title": "BIM数字化经理",
        "company": "某建筑设计院",
        "salary": "25-35K",
        "city": "上海",
        "platform": "猎聘",
        "jd_text": "负责设计院BIM及数字化技术体系的建设和推广；制定BIM标准和流程规范，推动设计团队采用数字化工具。",
        "jd_url": "",
    },
    {
        "title": "AI产品运营专家",
        "company": "某AI SaaS公司",
        "salary": "25-40K",
        "city": "深圳",
        "platform": "BOSS直聘",
        "jd_text": "负责AI产品的用户增长和社区运营（to B/to C混合）；策划线上线下运营活动，提升产品活跃度和留存率。",
        "jd_url": "",
    },
    {
        "title": "建筑AI产品总监",
        "company": "某建筑科技独角兽",
        "salary": "40-60K·16薪",
        "city": "北京",
        "platform": "BOSS直聘",
        "jd_text": "负责建筑AI产品线的整体规划和管理；结合AI技术重塑建筑设计流程；带领产品团队完成产品Roadmap的制定和执行。",
        "jd_url": "",
    },
]


def seed_demo_data(user_id: int, db: Session):
    """Seed 30 demo jobs and 5 applications for a new user."""

    # Check if user already has jobs (avoid duplicate seeding)
    existing_count = db.query(Job).filter(Job.user_id == user_id).count()
    if existing_count > 0:
        return

    now = datetime.utcnow()
    created_jobs = []

    for job_data in DEMO_JOBS:
        job = Job(
            user_id=user_id,
            title=job_data["title"],
            company=job_data["company"],
            salary=job_data["salary"],
            city=job_data["city"],
            platform=job_data["platform"],
            jd_text=job_data["jd_text"],
            jd_url=job_data.get("jd_url", ""),
            data_source="demo",
            match_score=round(65 + (hash(job_data["title"]) % 30) + (hash(job_data["company"]) % 5), 1),
            rating=3 + (hash(job_data["title"]) % 3),
            status="new",
            created_at=now,
        )
        db.add(job)
        created_jobs.append(job)

    db.flush()  # Get job IDs without committing

    # Create 5 Application records with different statuses
    application_configs = [
        {
            "status": "saved",
            "applied_at": None,
            "notes": "已收藏，待进一步了解",
            "job_index": 0,  # AI产品经理
            "is_demo": True,
        },
        {
            "status": "applied",
            "applied_at": now - timedelta(days=3),
            "notes": "已投递简历，等待HR反馈",
            "job_index": 3,  # 产品经理（AI方向）
            "is_demo": True,
        },
        {
            "status": "interview",
            "applied_at": now - timedelta(days=7),
            "notes": "已通过初筛，安排了一面，准备技术面试",
            "job_index": 6,  # AI建筑设计师
            "is_demo": True,
        },
        {
            "status": "offer",
            "applied_at": now - timedelta(days=14),
            "notes": "已收到Offer，薪资30K·14薪，正在评估中",
            "job_index": 10,  # 产品总监
            "is_demo": True,
        },
        {
            "status": "rejected",
            "applied_at": now - timedelta(days=21),
            "notes": "岗位要求与个人背景匹配度不足，已收到拒信",
            "job_index": 13,  # 产品专家
            "is_demo": True,
        },
    ]

    for config in application_configs:
        app = Application(
            user_id=user_id,
            job_id=created_jobs[config["job_index"]].id,
            status=config["status"],
            applied_at=config["applied_at"],
            notes=config["notes"],
            is_demo=config["is_demo"],
            created_at=now,
            updated_at=now,
        )
        db.add(app)

    # Create demo notifications
    notifications = [
        Notification(
            user_id=user_id,
            type="success",
            title="演示数据已就绪",
            message="已为你生成30条岗位数据和5条投递记录，可以开始体验了！",
            link="/dashboard",
            created_at=now,
        ),
        Notification(
            user_id=user_id,
            type="info",
            title="发现3个AI产品经理岗位",
            message="根据你的画像，为你匹配到3个杭州地区的AI产品经理岗位",
            link="/search",
            created_at=now,
        ),
        Notification(
            user_id=user_id,
            type="warning",
            title="投递跟进提醒",
            message="你有2条投递超过7天未更新，建议跟进",
            link="/applications",
            created_at=now,
        ),
        Notification(
            user_id=user_id,
            type="info",
            title="完善你的转型画像",
            message="在设置中填写转型策略，获取更精准的岗位推荐和能力分析",
            link="/settings",
            created_at=now,
        ),
    ]
    db.add_all(notifications)

    db.commit()