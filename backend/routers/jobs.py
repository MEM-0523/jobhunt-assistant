import re
import subprocess
import json
from typing import Optional
from fastapi import APIRouter, Depends, Body, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, Job, JobFavorite, Profile, Application
from auth import get_current_user
from datetime import datetime, timedelta
from ai_client import call_pinme_llm
from job_sources import fetch_international_jobs
import httpx

router = APIRouter(tags=["jobs"])

MOCK_JOBS = [
    # AI/技术类
    {
        "title": "AI产品经理",
        "company": "某AI科技公司",
        "salary": "30-50K·14薪",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责AI产品（大模型应用、智能助手等）的需求分析和产品规划，输出PRD文档\n2. 深入理解大模型技术能力边界，设计合理的产品体验和交互方案\n3. 与算法、工程团队紧密协作，推动产品从概念到上线的全流程落地\n4. 持续跟踪产品数据和用户反馈，通过A/B测试和数据分析驱动产品迭代优化\n5. 研究竞品和行业趋势，为产品战略决策提供依据\n\n【任职要求】\n1. 本科及以上学历，3年以上互联网或AI产品经验\n2. 熟悉大模型应用场景（RAG、Agent、Fine-tuning等），有相关产品落地经验优先\n3. 具备优秀的数据分析能力，熟练使用SQL和常见数据分析工具\n4. 逻辑清晰，沟通表达能力强，能有效推动跨团队协作\n\n【加分项】\n- 有技术背景或编程基础（Python）优先\n- 有从0到1产品孵化经验",
        "jd_url": "",
    },
    {
        "title": "AI解决方案工程师",
        "company": "某云计算公司",
        "salary": "25-45K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责AI行业解决方案的设计与落地，深入理解客户业务需求并转化为技术方案\n2. 主导售前技术交流、POC验证和方案演示，推动项目签约\n3. 协调内部产品、算法、交付团队，确保方案高质量交付\n4. 沉淀标准化解决方案，建立行业标杆案例库\n5. 跟踪AI行业动态和竞品分析，持续优化解决方案竞争力\n\n【任职要求】\n1. 本科及以上学历，3年以上解决方案或售前技术支持经验\n2. 熟悉云计算、AI/ML产品生态，了解主流大模型平台能力\n3. 具备良好的客户沟通和方案呈现能力，有ToB项目经验\n4. 能适应短期出差，抗压能力强\n\n【加分项】\n- 有智能制造、金融、政务等行业经验\n- 有AWS/Azure/阿里云等云平台认证",
        "jd_url": "",
    },
    {
        "title": "Python后端开发",
        "company": "某互联网公司",
        "salary": "25-40K·15薪",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 负责核心业务后端服务的架构设计、开发和维护\n2. 设计高性能、高可用的RESTful API和微服务架构\n3. 参与数据库设计优化，负责慢查询分析和性能调优\n4. 编写单元测试和集成测试，保障代码质量和系统稳定性\n5. 参与技术方案评审和代码审查，推动团队技术成长\n\n【任职要求】\n1. 计算机相关专业本科及以上学历，3年以上Python后端开发经验\n2. 精通FastAPI/Django/Flask等主流框架，熟悉异步编程\n3. 熟练使用MySQL、PostgreSQL、Redis、Elasticsearch等数据存储\n4. 有高并发系统设计和调优经验，熟悉消息队列（Kafka/RabbitMQ）\n5. 良好的编码习惯和文档意识\n\n【加分项】\n- 有微服务治理和容器化部署（Docker/K8s）经验\n- 有AI/ML系统开发经验",
        "jd_url": "",
    },
    {
        "title": "产品经理（AI方向）",
        "company": "某独角兽企业",
        "salary": "28-45K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责AI产品线（智能对话、AI搜索、AI Agent等）的整体规划和设计\n2. 深入理解用户场景，挖掘AI技术在产品中的创新应用机会\n3. 制定产品路线图，平衡短期需求和长期战略\n4. 主导产品关键里程碑的推进，协调多方资源确保按时交付\n5. 建立产品数据指标体系，通过数据驱动产品决策\n\n【任职要求】\n1. 本科及以上学历，5年以上产品经验，其中2年以上AI/智能化产品经验\n2. 对大语言模型、多模态AI有深入理解，能判断技术可行性\n3. 优秀的逻辑思维和抽象能力，能设计复杂产品系统\n4. 有团队管理经验者优先\n\n【加分项】\n- 有出海产品经验，英语流利\n- 有技术背景（计算机相关专业或编程能力）",
        "jd_url": "",
    },
    {
        "title": "AI训练师/提示词工程师",
        "company": "某AI创业公司",
        "salary": "20-35K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责大语言模型的提示词（Prompt）设计和持续优化，提升模型输出质量\n2. 设计并维护高质量训练数据集，包括SFT数据、偏好数据等\n3. 建立AI能力评估体系和benchmark，定期输出模型能力评估报告\n4. 与算法团队协作，参与模型训练效果的反馈和迭代\n5. 探索新的训练方法论（RLHF、DPO等），提升模型对齐效果\n\n【任职要求】\n1. 本科及以上学历，1年以上AI训练或Prompt Engineering经验\n2. 深入理解LLM原理（Transformer、Attention机制等）\n3. 优秀的文字表达和逻辑分析能力，注重细节\n4. 熟悉Python，能编写数据处理脚本\n\n【加分项】\n- 有语言学、认知科学背景\n- 有大规模数据标注项目管理经验",
        "jd_url": "",
    },
    {
        "title": "技术产品经理",
        "company": "某SaaS公司",
        "salary": "30-50K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 负责技术中台/开发者工具类产品的规划和设计\n2. 深入理解开发者需求，设计API、SDK、CLI工具等开发者体验\n3. 与技术团队紧密协作，参与技术架构讨论和方案设计\n4. 制定产品技术指标（性能、可靠性、安全性），推动持续优化\n5. 撰写技术文档、产品白皮书，支持市场推广和客户落地\n\n【任职要求】\n1. 计算机相关专业本科及以上学历\n2. 3年以上产品经验，有技术背景或开发经验\n3. 熟悉软件开发流程和常见技术栈，能与工程师高效沟通\n4. 对开发者工具、云原生、开源生态有热情\n\n【加分项】\n- 有开发者社区运营经验\n- 有开源项目维护经验",
        "jd_url": "",
    },
    # 建筑/设计转型类
    {
        "title": "AI建筑设计师",
        "company": "某建筑科技公司",
        "salary": "20-35K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责AI辅助建筑方案设计，利用Stable Diffusion/Midjourney/ComfyUI等工具进行概念方案生成和效果图制作\n2. 探索AI技术在设计流程优化中的应用，建立标准化AI辅助设计工作流\n3. 与传统设计团队协作，推动AI工具在设计院的落地应用和培训推广\n4. 跟踪建筑科技行业前沿趋势，定期输出AI+建筑设计应用研究报告\n5. 参与AI设计工具的产品化讨论，为工具迭代提供设计师视角的专业建议\n\n【任职要求】\n1. 建筑学本科及以上学历，3年以上建筑设计经验，有建成项目经验\n2. 熟练掌握Rhino/Grasshopper、Revit等参数化设计工具\n3. 熟悉主流AI绘图和生成工具（SD、MJ、DALL-E等），有AI辅助设计实战经验\n4. 对新技术有强烈好奇心和学习能力，具备跨领域思维\n\n【加分项】\n- 有编程基础（Python/C#）优先，能编写Grasshopper脚本\n- 有BIM正向设计或数字化设计管理经验\n- 独立完成过AI+建筑设计创新项目并有实际成果",
        "jd_url": "",
    },
    {
        "title": "BIM产品经理",
        "company": "某建筑信息化公司",
        "salary": "25-40K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责BIM协同设计平台和管理系统的产品规划和迭代设计\n2. 深入调研建筑设计院、施工单位的BIM应用场景和痛点需求\n3. 与开发团队协作推动产品交付，制定版本发布计划和质量标准\n4. 跟踪国内外BIM标准和行业政策（IFC、BIM Level 2/3等），确保产品合规\n5. 参与客户试点项目的实施，收集反馈持续优化产品体验\n\n【任职要求】\n1. 建筑学、土木工程或相关专业本科及以上学历\n2. 3年以上BIM相关工作经验，熟悉Revit、Navisworks、ArchiCAD等主流BIM软件\n3. 了解BIM全生命周期管理理念和数字孪生技术\n4. 具备产品思维，能将从建筑专业经验转化为产品设计能力\n\n【加分项】\n- 有BIM产品设计或项目管理经验\n- 了解建筑信息化行业生态和主流厂商\n- 有PMP或BIM相关认证",
        "jd_url": "",
    },
    {
        "title": "智慧城市产品经理",
        "company": "某城投科技公司",
        "salary": "25-45K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 负责智慧城市平台产品的规划设计，涵盖城市数字孪生、IoT数据融合、AI分析决策等模块\n2. 深入理解城市规划、建筑设计和建设管理等业务场景，将建筑专业能力转化为产品设计\n3. 与政府客户、设计院、集成商多方沟通协调，输出可落地的产品方案\n4. 跟踪数字孪生城市、CIM（城市信息模型）等行业标准和技术趋势\n5. 主导产品演示和方案汇报，支撑项目招投标和商务拓展\n\n【任职要求】\n1. 城市规划、建筑学、GIS或相关专业本科及以上学历\n2. 3年以上智慧城市/BIM/CIM相关产品或项目经验\n3. 熟悉IoT、大数据、数字孪生等技术体系，了解3D可视化技术\n4. 有政府或大型企业项目经验，了解政府采购和招投标流程\n\n【加分项】\n- 有建筑规划设计背景优先\n- 了解UE/Unity等3D引擎在城市可视化中的应用\n- 有数据中台或数字孪生平台建设经验",
        "jd_url": "",
    },
    {
        "title": "数字化转型顾问",
        "company": "某咨询公司",
        "salary": "25-40K",
        "city": "上海",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 为建筑设计院、施工企业和地产开发商提供数字化转型战略咨询服务\n2. 开展企业现状诊断，梳理业务流程痛点，制定数字化转型路线图\n3. 设计建筑全产业链数字化解决方案，涵盖BIM协同设计、智慧工地、数字交付等场景\n4. 主导咨询项目的交付管理，把控项目质量、进度和客户满意度\n5. 沉淀行业方法论和最佳实践，输出行业白皮书和演讲内容\n\n【任职要求】\n1. 建筑学、土木工程、管理学或相关专业本科及以上学历\n2. 5年以上建筑行业工作经验，3年以上管理咨询或信息化咨询经验\n3. 熟悉建筑行业全产业链运作模式，了解BIM、智慧建造等技术\n4. 优秀的分析能力和结构化思维，能快速理解复杂业务问题\n\n【加分项】\n- 有建筑设计和项目管理经验优先\n- 有MBA或管理类硕士学位\n- 有建筑行业数字化转型成功案例",
        "jd_url": "",
    },
    # 通用产品/管理
    {
        "title": "产品总监",
        "company": "某科技公司",
        "salary": "35-55K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责公司整体产品战略制定，管理10人以上产品团队\n2. 主导核心产品线的方向决策，包括产品定位、商业模式和增长策略\n3. 建立产品管理体系，包括需求管理流程、产品评审机制和绩效考核标准\n4. 跨部门协调（技术、运营、市场、销售），推动重大产品项目落地\n5. 培养产品团队人才梯队，建立知识分享和文化建设机制\n\n【任职要求】\n1. 本科及以上学历，8年以上产品经验，3年以上产品团队管理经验\n2. 有成功的产品方法论沉淀，主导过百万级用户规模的B端或C端产品\n3. 优秀的商业思维和战略眼光，能从市场、用户、技术多维度做决策\n4. 强领导力和沟通能力，有跨部门复杂项目管理经验\n\n【加分项】\n- 有从0到1创业经历\n- 有AI/大数据产品经验",
        "jd_url": "",
    },
    {
        "title": "项目总监",
        "company": "某建设集团",
        "salary": "30-50K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 负责大型工程项目的全流程管理，涵盖规划设计、施工管理和竣工验收\n2. 制定项目总体计划，协调设计、施工、采购等多方资源确保按期交付\n3. 管控项目成本、质量和安全，建立风险预警和应急预案机制\n4. 与甲方、政府部门、分包商等外部单位沟通协调，维护项目利益\n5. 带领项目管理团队，培养项目骨干，提升团队整体执行力\n\n【任职要求】\n1. 建筑学、土木工程或工程管理相关专业本科及以上学历\n2. 10年以上大型项目管理经验，有独立负责5亿以上规模项目的经历\n3. 持有PMP或一级建造师证书\n4. 熟悉建筑行业法规和标准，了解招投标和合同管理流程\n5. 优秀的沟通协调能力和抗压能力\n\n【加分项】\n- 有EPC总承包项目管理经验\n- 擅长建筑设计和施工方案优化",
        "jd_url": "",
    },
    {
        "title": "高级产品经理",
        "company": "某中型科技公司",
        "salary": "28-45K",
        "city": "北京",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责核心产品线的需求管理和产品设计，输出高质量的PRD和原型\n2. 深入用户调研和竞品分析，发现产品机会并转化为可执行方案\n3. 与设计、研发、测试团队紧密协作，推动产品迭代交付\n4. 建立产品数据指标体系，通过数据分析指导产品优化方向\n5. 参与产品战略讨论，为产品线长期发展规划提供建议\n\n【任职要求】\n1. 本科及以上学历，5年以上互联网产品经验\n2. 有成功产品案例，主导过百万级DAU产品的核心模块设计\n3. 熟练掌握用户研究、需求分析、原型设计等产品基本功\n4. 数据驱动思维，熟练使用SQL进行数据分析\n5. 优秀的沟通表达和跨团队协作能力\n\n【加分项】\n- 有B端SaaS产品经验\n- 有设计或技术背景",
        "jd_url": "",
    },
    {
        "title": "产品专家",
        "company": "某大厂",
        "salary": "35-60K",
        "city": "深圳",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 负责创新业务方向的产品探索和孵化，从0到1打造新产品\n2. 深入研究行业趋势和用户需求变化，提出前瞻性产品战略建议\n3. 建立产品创新方法论，推动组织产品创新能力提升\n4. 指导产品团队解决复杂产品问题，输出高质量的产品方案\n5. 代表公司参与行业交流，提升产品品牌影响力\n\n【任职要求】\n1. 本科及以上学历，10年以上产品经验\n2. 有大厂核心产品线负责人经历，主导过行业标杆级产品\n3. 深厚的产品方法论功底，在某一领域有独到见解和行业影响力\n4. 优秀的战略思维和商业洞察力\n\n【加分项】\n- 有知名产品书籍/文章/专利产出\n- 有跨行业产品经验",
        "jd_url": "",
    },
    {
        "title": "AI项目经理",
        "company": "某研究院",
        "salary": "25-40K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 管理AI科研和产品化项目的全生命周期，制定项目计划和里程碑\n2. 协调算法研究、工程开发、产品设计等多团队资源，推动项目按时交付\n3. 管理项目风险和问题，建立问题升级和解决机制\n4. 维护产学研合作关系，推动技术成果转化和应用落地\n5. 输出项目进度报告和管理文档，确保各方信息同步\n\n【任职要求】\n1. 本科及以上学历，3年以上技术项目管理经验\n2. 了解AI/ML基本概念和技术流程，能理解算法团队的工作内容\n3. 熟悉敏捷开发和项目管理工具（Jira、Confluence等）\n4. 优秀的沟通协调能力，能管理多方利益相关者\n5. 持有PMP或Scrum Master认证优先\n\n【加分项】\n- 有AI/大数据相关项目经验\n- 有和高校、科研院所合作经验",
        "jd_url": "",
    },
    # 远程/全国
    {
        "title": "高级产品经理（远程）",
        "company": "某国际化公司",
        "salary": "30-50K",
        "city": "远程",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 远程负责国际产品线的需求管理和产品迭代\n2. 与海外团队（美国、欧洲、东南亚）进行日常沟通和协作\n3. 深入理解不同市场的用户需求和竞争格局，制定本地化产品策略\n4. 独立撰写英文PRD和产品文档，主持跨时区产品评审会议\n5. 推动产品国际化标准建设，包括多语言、多币种、合规等\n\n【任职要求】\n1. 本科及以上学历，5年以上产品经验\n2. 英语流利（听说读写），能与海外团队无障碍沟通\n3. 有跨国产品或出海产品经验\n4. 强大的自驱力和时间管理能力，适应远程办公模式\n5. 能适应跨时区协作（部分会议在非工作时间）\n\n【加分项】\n- 有海外工作或留学经历\n- 熟悉SaaS产品国际化",
        "jd_url": "",
    },
    {
        "title": "远程全栈开发",
        "company": "某海外创业公司",
        "salary": "25-45K",
        "city": "远程",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 远程负责公司核心产品的全栈开发，前后端技术选型和架构设计\n2. 使用React/TypeScript开发前端界面，Python/FastAPI构建后端服务\n3. 参与产品需求讨论，从技术角度提供方案建议\n4. 编写自动化测试，维护CI/CD流水线，确保代码质量\n5. 与海外团队进行异步沟通（Slack、Notion、GitHub），参与代码审查\n\n【任职要求】\n1. 计算机相关专业本科及以上学历，5年以上全栈开发经验\n2. 精通React生态（Next.js、TypeScript、Tailwind CSS）\n3. 精通Python后端开发（FastAPI/Django），熟悉PostgreSQL和Redis\n4. 英语读写流利，能进行基本的英语口语交流\n5. 有远程工作经验，自律性强，善于异步沟通\n\n【加分项】\n- 有AWS/GCP云服务使用经验\n- 熟悉Docker/K8s容器化部署",
        "jd_url": "",
    },
    # 低薪资岗位（会被用户25K底线过滤）
    {
        "title": "产品助理",
        "company": "某小型创业公司",
        "salary": "8-15K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 协助产品经理完成需求文档撰写、原型设计和用户调研\n2. 维护产品需求池，跟踪需求状态和优先级变化\n3. 收集和分析用户反馈，整理用户体验改进建议\n4. 协助产品上线前的验收测试，记录和跟踪Bug\n5. 参与产品数据分析和周报撰写\n\n【任职要求】\n1. 本科及以上学历，1年以内产品相关经验，欢迎优秀应届生\n2. 熟悉Axure/Sketch/Figma等原型工具\n3. 逻辑清晰，有一定的数据分析基础\n4. 积极主动，学习能力强\n\n【加分项】\n- 有产品实习经验\n- 有设计或技术背景",
        "jd_url": "",
    },
    {
        "title": "AI实习生",
        "company": "某AI公司",
        "salary": "3-6K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 参与AI产品的用户调研和竞品分析，协助输出调研报告\n2. 协助进行AI模型能力测试和评估，整理测试数据集\n3. 参与产品需求的讨论和文档整理\n4. 跟踪AI行业动态，整理行业资讯周报\n5. 完成导师安排的其他产品相关任务\n\n【任职要求】\n1. 在读本科或研究生，计算机、人工智能、设计等相关专业优先\n2. 对AI产品有浓厚兴趣，使用过ChatGPT、Midjourney等AI工具\n3. 每周至少实习4天，能连续实习3个月以上\n4. 积极主动，有良好的学习能力和沟通能力\n\n【加分项】\n- 有过产品实习或项目经验\n- 了解大模型基本原理",
        "jd_url": "",
    },
    # 更多杭州岗位
    {
        "title": "运营经理",
        "company": "某电商公司",
        "salary": "20-35K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责电商平台的整体运营策略制定和执行，对GMV和用户增长负责\n2. 策划和执行营销活动（大促、节日营销、品类活动等），优化活动ROI\n3. 分析用户行为数据，建立用户分层运营体系，提升用户留存和复购\n4. 管理商品运营，包括选品、定价、库存管理等\n5. 协调设计、产品、技术团队，推动运营需求和工具优化\n\n【任职要求】\n1. 本科及以上学历，3年以上电商运营经验\n2. 有成功运营案例，主导过百万级GMV的营销活动\n3. 精通数据分析，熟练使用Excel/SQL和数据可视化工具\n4. 优秀的项目管理和跨部门协调能力\n\n【加分项】\n- 有直播电商或内容电商经验\n- 有私域运营和社群运营经验",
        "jd_url": "",
    },
    {
        "title": "AI数据标注经理",
        "company": "某数据服务公司",
        "salary": "15-25K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 管理50人以上AI数据标注团队，制定标注产能和质量目标\n2. 建立和完善数据标注SOP、质量检验标准和培训体系\n3. 对接算法团队需求，理解标注规范并转化为可执行的标注任务\n4. 优化标注工具和工作流程，持续提升标注效率和质量\n5. 管理标注预算和成本，确保项目在预算内按时交付\n\n【任职要求】\n1. 本科及以上学历，3年以上数据标注或数据管理经验\n2. 了解AI训练数据流程（数据采集、清洗、标注、质检）\n3. 有团队管理经验，能有效管理远程或外包团队\n4. 熟练使用数据标注平台和项目管理工具\n5. 质量意识强，注重细节\n\n【加分项】\n- 有大语言模型数据标注经验\n- 了解RLHF数据标注方法",
        "jd_url": "",
    },
    {
        "title": "UX设计师",
        "company": "某互联网公司",
        "salary": "25-40K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责B端SaaS产品的用户体验设计，输出交互原型和高保真设计稿\n2. 进行用户研究和可用性测试，挖掘用户痛点并转化为设计方案\n3. 建立和维护设计规范和组件库，保证产品设计一致性\n4. 与产品经理和开发团队紧密协作，推动设计方案高质量落地\n5. 跟踪设计趋势，引入创新设计方法和工具提升团队设计能力\n\n【任职要求】\n1. 设计相关专业本科及以上学历，3年以上UX设计经验\n2. 精通Figma/Sketch等设计工具，有成熟的设计作品集\n3. 有B端产品设计经验，理解企业级产品的设计原则\n4. 具备用户研究能力，能独立完成用户访谈和可用性测试\n5. 良好的沟通和表达能力，能清晰阐述设计决策\n\n【加分项】\n- 有数据可视化设计经验\n- 了解前端技术（HTML/CSS）",
        "jd_url": "",
    },
    {
        "title": "前端开发工程师",
        "company": "某科技公司",
        "salary": "25-45K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 负责公司核心产品的前端架构设计和开发\n2. 使用React/TypeScript/Next.js技术栈构建高性能Web应用\n3. 参与前端工程化建设，包括构建工具优化、组件库维护、自动化测试\n4. 与后端工程师协作定义API接口，确保前后端高效对接\n5. 负责前端性能优化，包括首屏加载速度、渲染性能和包体积优化\n\n【任职要求】\n1. 计算机相关专业本科及以上学历，5年以上前端开发经验\n2. 精通React生态，熟悉TypeScript、Next.js、状态管理方案\n3. 深入了解浏览器原理，有丰富的性能优化实战经验\n4. 熟悉前端工程化（Webpack/Vite、CI/CD、监控体系）\n5. 良好的代码规范和文档习惯\n\n【加分项】\n- 有Node.js后端开发经验\n- 有开源项目或技术博客",
        "jd_url": "",
    },
    {
        "title": "全栈工程师",
        "company": "某创业公司",
        "salary": "30-50K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责创业公司核心产品的全栈开发，从0到1搭建技术架构\n2. 使用Node.js/Python构建后端API服务，React/TypeScript开发前端界面\n3. 设计数据库结构，编写高效的数据查询和处理逻辑\n4. 搭建CI/CD流水线和自动化测试体系\n5. 参与产品需求讨论，从技术视角提供创新方案\n\n【任职要求】\n1. 计算机相关专业本科及以上学历，5年以上全栈开发经验\n2. 精通至少一种后端语言（Node.js/Python/Go）和至少一种前端框架（React/Vue）\n3. 有从0到1的产品开发经验，能独立完成技术选型和架构设计\n4. 熟悉云服务（AWS/阿里云）和DevOps工具链\n5. 有创业心态，能接受快节奏和灵活变化\n\n【加分项】\n- 有AI/ML相关开发经验\n- 有开源项目维护经验",
        "jd_url": "",
    },
    {
        "title": "AI产品运营经理",
        "company": "某大模型公司",
        "salary": "25-38K",
        "city": "上海",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责AI产品（大模型应用）的用户增长和社区运营\n2. 策划并执行用户增长策略，包括内容营销、社群运营、KOL合作等\n3. 建立用户反馈收集和分析机制，将用户声音转化为产品改进建议\n4. 运营AI开发者社区，组织线上线下技术交流和分享活动\n5. 分析用户行为数据，建立用户画像和分群运营策略\n\n【任职要求】\n1. 本科及以上学历，3年以上产品运营或社区运营经验\n2. 熟悉AI/大模型产品生态，了解开发者社区文化\n3. 优秀的数据分析能力，能通过数据驱动运营决策\n4. 有活动策划和内容创作能力\n\n【加分项】\n- 有AI产品用户增长经验\n- 有技术社区运营经验（GitHub、知乎等）",
        "jd_url": "",
    },
    {
        "title": "建筑科技BD经理",
        "company": "某建筑科技平台",
        "salary": "20-30K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责建筑科技产品和解决方案的商务拓展，开拓设计院和开发商客户\n2. 制定区域市场拓展策略，完成销售目标和业绩指标\n3. 深入理解建筑行业客户痛点，输出定制化建筑科技方案\n4. 维护重点客户关系，推动建筑行业标杆案例的复制和推广\n5. 收集市场和竞品信息，为建筑科技产品迭代提供市场反馈\n\n【任职要求】\n1. 建筑学、土木工程或市场营销相关专业本科及以上学历\n2. 3年以上建筑行业商务拓展或销售经验\n3. 熟悉建筑设计行业运作模式和人脉网络\n4. 优秀的商务谈判和客户关系管理能力\n5. 能适应频繁出差\n\n【加分项】\n- 有建筑科技/SaaS产品销售经验\n- 具备建筑设计和建筑行业方案讲解能力",
        "jd_url": "",
    },
    # 新增岗位
    {
        "title": "技术产品经理（AI方向）",
        "company": "某头部互联网公司",
        "salary": "30-55K·16薪",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责AI中台产品的规划和落地，包括模型训练平台、推理服务和数据标注平台\n2. 深入理解算法工程师和业务方的需求，设计高效的AI研发工具链\n3. 制定产品Roadmap，推动产品从需求到上线的完整生命周期\n4. 协调算法、工程、运营等多团队资源，确保项目按时高质量交付\n5. 跟踪AI行业技术发展趋势，为产品战略规划提供前瞻性建议\n\n【任职要求】\n1. 本科及以上学历，5年以上产品经验，2年以上AI相关方向\n2. 扎实的技术背景，了解机器学习和大模型技术原理\n3. 优秀的逻辑思维和数据驱动决策能力\n4. 有从0到1的产品孵化成功经验\n\n【加分项】\n- 有技术背景（具备编程和算法能力）\n- 有成功的AI产品方法论沉淀",
        "jd_url": "",
    },
    {
        "title": "数字化转型总监",
        "company": "某大型集团",
        "salary": "40-60K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 主导集团数字化转型战略的制定和执行，推动业务流程的数字化再造\n2. 规划和建设企业级数据中台，打通数据孤岛实现数据资产化\n3. 带领AI团队探索大模型在企业场景的落地应用\n4. 管理跨部门的数字化项目（ERP/CRM/BI等），确保ROI达标\n5. 建设数字化人才梯队，培养业务与技术融合的复合型人才\n\n【任职要求】\n1. 硕士及以上学历，15年以上工作经验，其中5年以上数字化管理经验\n2. 有大型企业数字化转型成功案例\n3. 精通企业架构（TOGAF），了解主流数字化技术栈\n4. 优秀的战略思维和跨部门协调能力\n5. 有建筑/房地产行业背景优先",
        "jd_url": "",
    },
    {
        "title": "AI应用架构师",
        "company": "某互联网独角兽",
        "salary": "35-55K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 设计AI Native应用的技术架构，包括RAG系统、Agent框架和推理优化\n2. 主导技术选型，制定AI应用的技术规范和开发标准\n3. 解决AI应用中的技术难题：幻觉控制、延迟优化、成本管理\n4. 带领技术团队从概念验证到生产环境的完整落地\n5. 推动AI应用的可观测性和质量保障体系建设\n\n【任职要求】\n1. 计算机硕士及以上学历，8年以上软件开发经验，3年以上AI方向\n2. 精通至少一门后端语言（Go/Python），熟悉分布式系统设计\n3. 深入理解LLM技术栈（Prompt Engineering/Vector DB/Agent Framework）\n4. 有大型AI系统从0到1的架构经验\n5. 优秀的文档和技术分享能力\n\n【加分项】\n- 有开源AI项目贡献\n- 理解传统建筑工程行业痛点优先",
        "jd_url": "",
    },
    {
        "title": "智慧城市解决方案专家",
        "company": "某央企科技子公司",
        "salary": "30-45K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责智慧城市解决方案的售前技术支持和方案设计\n2. 基于AI、IoT、数字孪生（数字孪生）等技术设计城市治理和公共安全解决方案\n3. 输出智慧城市整体架构方案，撰写技术建议书和投标文件\n4. 与政府客户和渠道合作伙伴保持紧密沟通，推动项目落地\n5. 研究智慧城市行业趋势和标杆案例\n\n【任职要求】\n1. 城市规划、建筑学、计算机等相关专业硕士及以上学历\n2. 5年以上智慧城市或政企信息化解决方案设计经验\n3. 熟悉AI、大数据、物联网技术在城市的应用场景\n4. 优秀的方案撰写和客户沟通能力\n5. 有政府项目经验，了解政府采购流程\n\n【加分项】\n- 具备建筑行业背景，理解BIM/CIM技术\n- 有千万级以上项目的主导经验",
        "jd_url": "",
    },
    {
        "title": "BIM数字化经理",
        "company": "某建筑设计院",
        "salary": "25-35K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 负责设计院BIM及数字化技术体系的建设和推广\n2. 制定BIM标准和流程规范，推动设计团队采用数字化工具\n3. 探索AI辅助设计在建筑设计中的应用场景\n4. 管理BIM团队，培训设计师的数字化技能\n5. 与IT部门协作推动设计软件和云平台的选型与部署\n\n【任职要求】\n1. 建筑学或土木工程本科及以上学历，注册建筑师资格优先\n2. 8年以上建筑设计经验，其中3年以上BIM管理经验\n3. 精通Revit、Navisworks等BIM工具\n4. 了解AI/数字孪生技术，有应用探索经验\n5. 优秀的团队管理和变革推动能力",
        "jd_url": "",
    },
    {
        "title": "用户增长产品经理",
        "company": "某社交App公司",
        "salary": "28-45K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责用户增长产品的规划和设计，聚焦拉新和留存方向\n2. 设计增长实验（A/B测试），通过数据驱动优化增长策略\n3. 与市场、运营团队协作，整合渠道投放和内容营销等增长手段\n4. 建立用户增长数据监控体系，及时发现增长机会和风险\n5. 研究社交和内容产品的增长方法论\n\n【任职要求】\n1. 本科及以上学历，4年以上产品经验，2年以上增长方向\n2. 精通数据分析，熟练使用SQL和AB测试工具\n3. 有成功的用户增长案例（DAU/留存率提升）\n4. 逻辑清晰，执行力强，能快速验证假设",
        "jd_url": "",
    },
    {
        "title": "AI产品运营专家",
        "company": "某AI SaaS公司",
        "salary": "25-40K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责AI产品的用户增长和社区运营（to B/to C混合）\n2. 策划线上线下运营活动，提升产品活跃度和留存率\n3. 建立用户反馈闭环，将用户需求转化为产品改进建议\n4. 运营AI开发者社区（GitHub/Discord/微信群），打造技术品牌影响力\n5. 与产品团队合作制定GTM策略\n\n【任职要求】\n1. 本科及以上学历，3年以上产品运营经验\n2. 了解AI/大模型产品生态，理解开发者群体需求\n3. 有内容营销和社区运营成功经验\n4. 数据敏感度高，能通过数据指导运营策略\n\n【加分项】\n- 有2B SaaS产品运营经验\n- 有建筑行业客户运营经验优先",
        "jd_url": "",
    },
    {
        "title": "高级数据分析师",
        "company": "某电商平台",
        "salary": "30-50K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责业务数据分析和洞察，为运营和产品决策提供数据支持\n2. 构建核心业务指标体系和数据看板（BI Dashboard）\n3. 运用机器学习模型进行用户行为预测和业务趋势分析\n4. 设计和执行A/B测试，评估业务策略的效果\n5. 培训业务团队的数据分析能力，建设数据驱动文化\n\n【任职要求】\n1. 统计学、数学、计算机等相关专业硕士及以上学历\n2. 5年以上数据分析经验，电商或互联网行业优先\n3. 精通SQL、Python（Pandas/Scikit-learn），熟悉数据可视化工具\n4. 有机器学习建模和预测分析经验\n5. 优秀的业务理解和沟通能力",
        "jd_url": "",
    },
    {
        "title": "AI训练师/数据标注主管",
        "company": "某AI数据服务公司",
        "salary": "25-38K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 管理AI训练数据标注团队，制定标注标准和质量控制流程\n2. 设计高质量的数据标注规范（文本/图像/视频）\n3. 与算法团队协作，理解模型训练需求并优化标注策略\n4. 推动标注工具的自动化和智能化，提升标注效率\n5. 管理50人以上标注团队，控制成本和质量\n\n【任职要求】\n1. 本科及以上学历，3年以上数据标注或AI团队管理经验\n2. 了解机器学习基本原理，理解训练数据对模型性能的影响\n3. 有大规模数据标注项目管理经验\n4. 优秀的流程设计和管理能力\n\n【加分项】\n- 有NLP/CV相关标注经验\n- 了解建筑行业数据标注需求",
        "jd_url": "",
    },
    {
        "title": "AI合规与风险管理经理",
        "company": "某金融科技公司",
        "salary": "30-48K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 负责AI产品的合规和风险评估，确保产品符合监管要求\n2. 建立AI伦理审查流程，评估算法的公平性和透明度\n3. 跟踪AI法规政策动态（生成式AI管理办法等），制定内部合规策略\n4. 与法务团队合作处理AI相关的知识产权和数据隐私问题\n5. 输出合规培训材料，提升全员的AI合规意识\n\n【任职要求】\n1. 法学、计算机或公共管理硕士及以上学历\n2. 5年以上合规或风险管理经验，2年以上AI/科技方向\n3. 熟悉AI法规框架（个人信息保护法、生成式AI管理办法）\n4. 优秀的政策解读和跨部门协调能力\n\n【加分项】\n- 有CIPP/E等隐私认证\n- 有金融行业背景",
        "jd_url": "",
    },
    {
        "title": "AI测试开发工程师",
        "company": "某自动驾驶公司",
        "salary": "30-50K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责AI产品的质量保障，设计自动化测试方案和框架\n2. 构建模型评估体系，包括准确率、召回率、幻觉率等指标监控\n3. 开发测试工具和平台，提升测试效率\n4. 参与CI/CD流程，保障AI应用的持续交付质量\n5. 编写测试用例和测试报告\n\n【任职要求】\n1. 计算机本科及以上学历，4年以上测试开发经验\n2. 精通至少一门编程语言（Python/Go），熟悉自动化测试框架\n3. 了解ML/AI模型评估方法\n4. 有大型分布式系统测试经验\n5. 严谨细致，有强烈的问题驱动意识",
        "jd_url": "",
    },
    {
        "title": "SaaS产品销售总监",
        "company": "某HR SaaS公司",
        "salary": "35-55K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 建立和领导全国销售团队，达成年度销售目标\n2. 制定行业销售策略（金融/制造/互联网等），开拓重点客户\n3. 管理销售漏斗，从线索到签约的全流程精细化管理\n4. 与售前方案团队协作，推动复杂项目的商务谈判\n5. 收集市场反馈，为产品和定价策略提供输入\n\n【任职要求】\n1. 本科及以上学历，8年以上销售经验，3年以上SaaS销售管理经验\n2. 有带领20人以上销售团队的经历\n3. 熟悉企业级销售方法论（MEDDIC/Challenger等）\n4. 优秀的谈判、演讲和团队激励能力\n5. 有CRM系统使用和数据驱动管理的习惯\n\n【加分项】\n- 有HR/建筑/工程行业SaaS销售经验\n- 具备一定的解决方案设计能力",
        "jd_url": "",
    },
    {
        "title": "AI战略研究员",
        "company": "某智库/研究机构",
        "salary": "30-45K",
        "city": "杭州",
        "platform": "猎聘",
        "jd_text": "【岗位职责】\n1. 研究AI/大模型的技术趋势和产业应用前景\n2. 撰写AI行业研究报告和战略白皮书\n3. 为政府和企业客户提供AI战略咨询\n4. 组织行业研讨会和专家论坛，建立AI领域的专家网络\n5. 参与AI政策建议的撰写和推广\n\n【任职要求】\n1. 计算机、经济学或管理科学博士学历\n2. 3年以上科技行业研究或咨询经验\n3. 有高质量的研究报告产出\n4. 优秀的逻辑分析、数据分析和写作能力\n\n【加分项】\n- 有AI领域学术发表\n- 有传统行业数字化转型研究经验",
        "jd_url": "",
    },
    {
        "title": "建筑AI产品总监",
        "company": "某建筑科技独角兽",
        "salary": "40-60K·16薪",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责建筑AI产品线的整体规划和管理\n2. 结合AI技术（自动设计生成、BIM智能审核、能耗分析等）重塑建筑设计流程\n3. 带领产品团队完成产品Roadmap的制定和执行\n4. 与建筑设计师客户深度合作，将行业最佳实践转化为产品能力\n5. 管理产品团队（8-15人），培养产品经理\n\n【任职要求】\n1. 建筑学+计算机/产品管理双重背景优先\n2. 8年以上产品经验，3年以上AI/建筑科技方向\n3. 深刻理解建筑设计流程和行业痛点\n4. 有成功的企业级产品从0到1的经验\n5. 优秀的领导力和行业影响力\n\n【加分项】\n- 注册建筑师资质\n- 有成功的AI产品方法论沉淀",
        "jd_url": "",
    },
    {
        "title": "产品营销经理（PMM）",
        "company": "某企业服务公司",
        "salary": "25-40K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责企业级产品的市场定位、定价策略和GTM计划\n2. 制定产品营销内容（白皮书/案例研究/产品视频）\n3. 与销售团队合作，输出销售赋能工具（竞品分析/话术手册）\n4. 策划和执行产品发布会、行业展会等市场活动\n5. 分析市场和竞品动态，为产品迭代提供市场洞察\n\n【任职要求】\n1. 本科及以上学历，5年以上B2B产品营销经验\n2. 有企业级软件或SaaS产品的营销成功案例\n3. 优秀的内容创作和演讲能力\n4. 数据驱动的营销思维\n\n【加分项】\n- 有建筑/工程行业背景\n- 有技术社区运营经验",
        "jd_url": "",
    },
    # 总助/行政类
    {
        "title": "总经理助理",
        "company": "某集团公司",
        "salary": "15-25K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 协助总经理处理日常事务，安排会议日程和商务出行\n2. 起草公司文件、会议纪要和工作报告\n3. 协调各部门工作进度，跟进项目执行情况\n4. 接待重要客户和合作伙伴，维护对外关系\n5. 参与公司战略规划和重大决策的调研与论证\n\n【任职要求】\n1. 本科及以上学历，3年以上总助或行政管理工作经验\n2. 优秀的文字表达和沟通协调能力\n3. 具有较强的组织能力和时间管理能力\n4. 熟练使用办公软件，有一定的PPT和数据分析基础\n5. 责任心强，保密意识强，形象气质佳",
        "jd_url": "",
    },
    {
        "title": "行政经理",
        "company": "某科技公司",
        "salary": "12-20K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 全面负责公司行政管理工作，制定并优化行政管理流程和制度\n2. 管理办公环境、资产采购、供应商评估等行政事务\n3. 组织公司级会议、团建活动和员工关怀项目\n4. 负责行政预算编制和执行控制\n5. 协助HR完成招聘面试安排和入职手续办理\n\n【任职要求】\n1. 本科及以上学历，5年以上行政管理经验\n2. 熟悉企业行政管理体系和流程\n3. 优秀的跨部门协调和资源整合能力\n4. 有互联网或科技企业行政管理经验优先",
        "jd_url": "",
    },
    {
        "title": "总裁秘书",
        "company": "某上市公司",
        "salary": "18-28K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责总裁的日程管理和商务安排\n2. 处理总裁对外公文和商务函件\n3. 组织董事会会议并完成会议记录\n4. 协调跨部门沟通，传达总裁指令并跟踪落实\n5. 管理总裁办日常运作和文件归档\n\n【任职要求】\n1. 本科及以上学历，3年以上高管秘书经验\n2. 出色的文笔和口头表达能力\n3. 具备良好的商务礼仪和职业素养\n4. 英语流利，有涉外沟通经验优先",
        "jd_url": "",
    },
    # 运营类
    {
        "title": "运营总监",
        "company": "某互联网教育公司",
        "salary": "30-50K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 制定公司运营策略和年度规划，统筹各业务线运营工作\n2. 搭建数据驱动的用户增长体系，提升用户活跃度和留存率\n3. 优化运营流程和SOP，推动自动化运营工具建设\n4. 管理10人以上运营团队，制定绩效考核标准\n5. 协同产品和技术部门，推动运营需求的产品化落地\n\n【任职要求】\n1. 本科及以上学历，5年以上互联网运营经验\n2. 有成功的用户增长或商业变现项目经验\n3. 精通数据分析工具（SQL/BI），具备A/B测试能力\n4. 有团队管理经验，能独立带团队拿结果",
        "jd_url": "",
    },
    {
        "title": "内容运营",
        "company": "某新媒体公司",
        "salary": "12-20K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责公司微信公众号、小红书、抖音等内容平台的日常运营\n2. 制定内容日历，策划选题并独立完成图文和短视频创作\n3. 跟踪内容数据，优化选题方向和发布策略\n4. 维护粉丝社群，策划线上活动和裂变增长\n5. 研究竞品内容和行业热点，输出内容策略报告\n\n【任职要求】\n1. 本科及以上学历，2年以上新媒体内容运营经验\n2. 有优秀的文案功底和审美能力\n3. 熟悉主流内容平台的算法机制和运营规则\n4. 对热点敏感，有爆款内容创作经验优先",
        "jd_url": "",
    },
    {
        "title": "用户运营",
        "company": "某社交平台",
        "salary": "18-25K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责用户生命周期运营，制定拉新-激活-留存-转化的全链路策略\n2. 运营用户社群，建立核心用户分层体系和激励机制\n3. 分析用户行为数据，挖掘用户需求和痛点，推动产品体验优化\n4. 策划用户活动，提升用户活跃度和社区氛围\n5. 输出用户运营周报和运营策略优化建议\n\n【任职要求】\n1. 本科及以上学历，3年以上用户运营经验\n2. 掌握至少一种数据分析工具（SQL/Excel/Python）\n3. 有私域运营和社群管理经验\n4. 对数据敏感，能从数据中发现问题和机会",
        "jd_url": "",
    },
    # 市场/销售类
    {
        "title": "市场经理",
        "company": "某数字营销公司",
        "salary": "20-30K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 制定公司市场策略和年度营销计划\n2. 策划并执行线上线下营销活动，提升品牌影响力\n3. 管理和优化营销预算，提高ROI\n4. 带领市场团队，开展竞品分析和市场调研\n5. 建立媒体关系和合作渠道\n\n【任职要求】\n1. 本科及以上学历，5年以上市场营销经验\n2. 有成功品牌营销活动策划和执行经验\n3. 具备较强的数据分析能力和策略思维\n4. 有数字营销和社交媒体营销经验优先",
        "jd_url": "",
    },
    {
        "title": "销售总监",
        "company": "某企业服务公司",
        "salary": "25-40K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 制定销售策略和年度销售目标，分解到季度/月度\n2. 管理10人以上销售团队，制定激励和考核方案\n3. 主导大客户开发和维护，推动关键项目签约\n4. 建立销售管理体系，包括客户分级、商机管理、回款管理\n5. 分析销售数据，持续优化销售流程和话术\n\n【任职要求】\n1. 本科及以上学历，5年以上销售管理经验\n2. 有大客户销售和渠道管理经验\n3. 优秀的目标导向和抗压能力\n4. 有SaaS或B2B销售经验优先",
        "jd_url": "",
    },
    {
        "title": "商务拓展BD",
        "company": "某跨境电商平台",
        "salary": "18-28K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 拓展和维护KA客户关系，推动业务合作\n2. 挖掘客户需求，设计定制化合作方案\n3. 跟踪合作效果，定期输出业务复盘报告\n4. 参与行业展会，拓展商业合作网络\n5. 协同产品、运营团队推动项目落地\n\n【任职要求】\n1. 本科及以上学历，3年以上商务拓展经验\n2. 有跨行业合作和项目管理经验\n3. 出色的谈判能力和商业敏感度\n4. 有跨境电商或外贸行业经验优先",
        "jd_url": "",
    },
    # 数据分析类
    {
        "title": "数据分析师",
        "company": "某金融科技公司",
        "salary": "15-25K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责业务数据的采集、清洗和分析，建立数据指标体系\n2. 通过数据挖掘发现业务增长机会和风险点\n3. 搭建数据看板，支持业务决策和精细化运营\n4. 独立完成专题分析报告，向管理层汇报\n5. 与产品和运营团队协作，推动数据驱动的工作方式\n\n【任职要求】\n1. 本科及以上学历，统计学/数学/计算机等相关专业\n2. 熟练使用SQL，掌握Python或R进行数据分析\n3. 有BI工具（Tableau/PowerBI/DataWind）使用经验\n4. 具备良好的业务理解能力和逻辑思维能力",
        "jd_url": "",
    },
    # 技术/开发类
    {
        "title": "Python后端开发",
        "company": "某AI创业公司",
        "salary": "20-35K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责公司AI产品的后端服务开发和API设计\n2. 参与系统架构设计和技术方案评审\n3. 优化服务性能和系统稳定性\n4. 编写技术文档和接口规范\n5. 参与code review，保证代码质量\n\n【任职要求】\n1. 本科及以上学历，3年以上Python开发经验\n2. 熟悉FastAPI/Django等主流框架\n3. 有MySQL/Redis/消息队列等中间件使用经验\n4. 有大模型应用开发经验优先（RAG/Agent/LangChain）",
        "jd_url": "",
    },
    {
        "title": "前端开发工程师",
        "company": "某互联网公司",
        "salary": "18-30K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责公司核心产品的前端开发和迭代\n2. 与UI/UX设计师和后端工程师协作\n3. 优化前端性能和用户体验\n4. 编写可维护的组件代码和单元测试\n5. 参与前端技术选型和架构设计\n\n【任职要求】\n1. 本科及以上学历，3年以上前端开发经验\n2. 熟练掌握React/Vue等主流框架，精通TypeScript\n3. 有移动端适配和性能优化经验\n4. 了解Node.js和服务端渲染技术",
        "jd_url": "",
    },
    # 通用/其他
    {
        "title": "项目管理",
        "company": "某咨询公司",
        "salary": "18-30K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 负责客户项目的全流程管理，确保按时高质量交付\n2. 制定项目计划和里程碑，管理项目风险和变更\n3. 协调内外部资源和团队，解决项目推进中的问题\n4. 定期与客户沟通项目进展，管理客户预期\n5. 总结项目经验和最佳实践，优化项目管理流程\n\n【任职要求】\n1. 本科及以上学历，3年以上项目管理经验\n2. 持有PMP或PRINCE2认证优先\n3. 优秀的沟通协调能力和问题解决能力\n4. 有数字化项目或IT咨询项目经验优先",
        "jd_url": "",
    },
    {
        "title": "人力资源经理",
        "company": "某科技集团",
        "salary": "15-25K",
        "city": "杭州",
        "platform": "BOSS直聘",
        "jd_text": "【岗位职责】\n1. 制定并执行公司的人力资源战略规划\n2. 负责招聘全流程管理，搭建人才梯队\n3. 设计并优化薪酬绩效体系\n4. 推动企业文化和员工关系建设\n5. 组织员工培训和职业发展项目\n\n【任职要求】\n1. 本科及以上学历，5年以上HR工作经验\n2. 熟悉劳动法及人力资源管理六大模块\n3. 有互联网或科技企业HRBP经验优先\n4. 具备战略思维和业务敏感度",
        "jd_url": "",
    },
]


def parse_salary_min(salary_str: str) -> int:
    """Extract minimum salary in K from salary string like '25-40K', '30-50K·14薪'"""
    match = re.search(r'(\d+)', salary_str)
    if match:
        return int(match.group(1))
    return 0


def _tokenize(text: str) -> list[str]:
    """Split text into meaningful tokens for fuzzy matching."""
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


def filter_jobs(jobs: list[dict], user_profile, search_city: str = "") -> list[dict]:
    """Apply hard constraints: city, salary_min >= user salary_min. 远程 always accepted.
    search_city: user's input city in search box (takes priority over profile city)."""
    salary_min = user_profile.salary_min if user_profile and user_profile.salary_min else 0
    city = search_city or (user_profile.city if user_profile and user_profile.city else "")

    filtered = []
    for job in jobs:
        job_city = job.get("city", "")
        if city:
            city_match = (
                job_city == "远程"
                or job_city == city
                or city in job_city
                or job_city in city
            )
            if not city_match:
                continue

        min_salary = parse_salary_min(job.get("salary", ""))
        if min_salary == 0:
            filtered.append(job)
            continue
        if salary_min == 0 or min_salary >= salary_min:
            filtered.append(job)
    return filtered


import platform as _platform

_AUTOCLI_PATH = (
    "/Users/wutianya/Desktop/我的AI工作系统/50-本地工具/autocli-mac"
    if _platform.system() == "Darwin"
    else "/Users/wutianya/Desktop/我的AI工作系统/50-本地工具/autocli.exe"
)


def validate_jd_urls(jobs: list[dict]) -> list[dict]:
    """Validate jd_url accessibility via HEAD request. Marks unreachable URLs."""
    if not jobs:
        return jobs

    valid_jobs = []
    invalid_jobs = []

    with httpx.Client(timeout=5.0, follow_redirects=True) as client:
        for job in jobs:
            url = job.get("jd_url", "")
            if not url or not url.startswith("http"):
                job["_url_valid"] = False
                job["_url_status"] = "no_url"
                valid_jobs.append(job)
                continue
            try:
                resp = client.head(url)
                if resp.status_code < 400:
                    job["_url_valid"] = True
                    job["_url_status"] = str(resp.status_code)
                    valid_jobs.append(job)
                else:
                    job["_url_valid"] = False
                    job["_url_status"] = f"HTTP {resp.status_code}"
                    invalid_jobs.append(job)
            except Exception as e:
                job["_url_valid"] = False
                job["_url_status"] = "unreachable"
                invalid_jobs.append(job)

    return valid_jobs + invalid_jobs


def try_autocli_search(keyword: str, city: str, platform: str) -> Optional[list[dict]]:
    """Try to search via autocli subprocess. Scrapes 3 pages (45 results). Falls back to variant queries."""
    search_queries = []
    if city:
        search_queries.append(f"{city} {keyword}")
        search_queries.append(keyword)
    else:
        search_queries.append(keyword)

    for search_query in search_queries:
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
                try:
                    data = json.loads(result.stdout)
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
        want_international = req.include_international or req.platform in ("Himalayas", "Remotive", "international")

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

        # Try BOSS via autocli
        if want_boss:
            boss_jobs = try_autocli_search(kw, req.city, req.platform)
            if boss_jobs:
                for j in boss_jobs:
                    j["data_source"] = "autocli"
                    # Fix URL: add securityId param so link doesn't break
                    sid = j.get("security_id", "")
                    if sid and j.get("jd_url", "").startswith("https://www.zhipin.com/job_detail/") and "securityId" not in j["jd_url"]:
                        j["jd_url"] = f"{j['jd_url']}?securityId={sid}"
                raw_jobs.extend(boss_jobs)
                is_autocli = True

        # Try Liepin via HTTP scraping
        if want_liepin:
            liepin_jobs = try_liepin_search(kw, req.city)
            if liepin_jobs:
                for j in liepin_jobs:
                    j["data_source"] = "liepin"
                raw_jobs.extend(liepin_jobs)
                is_liepin = True

        # Fallback to mock data if nothing found
        if not raw_jobs:
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
                raw_jobs = [job for _, job in scored]
            else:
                mock_jobs = list(MOCK_JOBS)
                for j in mock_jobs:
                    j["data_source"] = "mock"
                raw_jobs = mock_jobs

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

    display_keyword = req.keyword if req.keyword else (", ".join(req.keywords) if req.keywords else "")

    return {
        "results": results,
        "keyword": display_keyword,
        "city": req.city,
        "total": len(results),
        "by_keyword": by_keyword if req.keywords else None,
    }


@router.get("/jobs/favorites")
def list_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    favorites = (
        db.query(JobFavorite)
        .filter(JobFavorite.user_id == current_user.id)
        .order_by(JobFavorite.created_at.desc())
        .all()
    )

    results = []
    for fav in favorites:
        job = fav.job
        if not job:
            db.delete(fav)
            db.commit()
            continue
        results.append({
            "id": job.id,
            "title": job.title,
            "company": job.company,
            "salary": job.salary,
            "city": job.city,
            "platform": job.platform,
            "jd_text": job.jd_text,
            "match_score": job.match_score if job.match_score else None,
            "rating": job.rating if job.rating else None,
            "status": job.status,
            "jd_url": job.jd_url,
            "created_at": job.created_at.isoformat() if isinstance(job.created_at, datetime) else str(job.created_at),
            "favorited_at": fav.created_at.isoformat() if isinstance(fav.created_at, datetime) else str(fav.created_at),
        })

    return {"results": results, "total": len(results)}


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


@router.get("/jobs/data-sources")
def get_data_source_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get statistics about job data sources for the current user."""
    from sqlalchemy import func

    user_jobs = db.query(Job).filter(Job.user_id == current_user.id).all()

    # Count by platform
    platform_counts: dict[str, int] = {}
    for job in user_jobs:
        p = job.platform or "unknown"
        platform_counts[p] = platform_counts.get(p, 0) + 1

    # Count cached jobs by source
    from models import JobCache
    cache_stats = db.query(
        JobCache.source, func.count(JobCache.id)
    ).group_by(JobCache.source).all()
    cache_counts = {src: cnt for src, cnt in cache_stats}

    return {
        "user_jobs_by_platform": platform_counts,
        "cached_jobs_by_source": cache_counts,
        "total_user_jobs": len(user_jobs),
    }


@router.get("/jobs/weekly-report")
def weekly_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Aggregate this week's job hunting data."""
    from collections import Counter
    from sqlalchemy import func

    now = datetime.utcnow()
    this_week_start = now - timedelta(days=now.weekday())
    this_week_start = this_week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    user_id = current_user.id

    # Searches this week (jobs created this week)
    searches_this_week = db.query(func.count(Job.id)).filter(
        Job.user_id == user_id,
        Job.created_at >= this_week_start
    ).scalar() or 0

    # New jobs found this week
    new_jobs_found = searches_this_week

    # New applications this week
    new_applications = db.query(func.count(Application.id)).filter(
        Application.user_id == user_id,
        Application.created_at >= this_week_start
    ).scalar() or 0

    # Status changes this week
    apps_updated_this_week = db.query(Application).filter(
        Application.user_id == user_id,
        Application.updated_at >= this_week_start
    ).all()

    status_changes: dict[str, int] = {}
    for app in apps_updated_this_week:
        if app.status in ("面试邀约", "面试通过", "offer"):
            status_changes[app.status] = status_changes.get(app.status, 0) + 1

    # Hot keywords: most common in job titles this week
    week_jobs = db.query(Job).filter(
        Job.user_id == user_id,
        Job.created_at >= this_week_start
    ).all()

    keyword_counter: Counter = Counter()
    for job in week_jobs:
        for word in job.title.replace("（", " ").replace("）", " ").replace("(", " ").replace(")", " ").split():
            if len(word) >= 2:
                keyword_counter[word] += 1
    hot_keywords = [kw for kw, _ in keyword_counter.most_common(5)]

    # Suggestions
    suggestions: list[str] = []
    interview_count = status_changes.get("面试邀约", 0)
    pass_count = status_changes.get("面试通过", 0)
    offer_count = status_changes.get("offer", 0)

    if interview_count > 0:
        suggestions.append(f"本周收到{interview_count}个面试邀约，建议重点准备面试")
    if searches_this_week == 0:
        suggestions.append("本周尚未搜索岗位，建议增加搜索频率以获取更多机会")
    if new_applications == 0 and searches_this_week > 0:
        suggestions.append("本周有搜索但未投递，建议对匹配度高的岗位尽快投递")
    if pass_count > 0:
        suggestions.append(f"本周{pass_count}个面试通过，建议及时跟进后续流程")
    if offer_count > 0:
        suggestions.append(f"恭喜！本周收到{offer_count}个Offer，请使用薪资谈判助手评估方案")
    if not suggestions:
        suggestions.append("本周暂无特别提醒，保持良好的求职节奏")
    if hot_keywords:
        suggestions.append(f"热门方向「{'、'.join(hot_keywords[:3])}」岗位活跃，建议增加相关搜索")

    return {
        "searches_this_week": searches_this_week,
        "new_jobs_found": new_jobs_found,
        "new_applications": new_applications,
        "status_changes": status_changes,
        "hot_keywords": hot_keywords,
        "suggestions": suggestions,
    }


@router.get("/jobs/{job_id}")
def get_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        return {"error": "Job not found"}

    fav = (
        db.query(JobFavorite)
        .filter(JobFavorite.user_id == current_user.id, JobFavorite.job_id == job_id)
        .first()
    )

    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "salary": job.salary,
        "city": job.city,
        "platform": job.platform,
        "jd_text": job.jd_text,
        "match_score": job.match_score if job.match_score else None,
        "rating": job.rating if job.rating else None,
        "status": job.status,
        "jd_url": job.jd_url,
        "created_at": job.created_at.isoformat() if isinstance(job.created_at, datetime) else str(job.created_at),
        "favorited_at": fav.created_at.isoformat() if isinstance(fav.created_at, datetime) else str(fav.created_at) if fav else None,
    }


# 10-dimension scoring system with weights from 求职工作流.md §4.1
DIMENSIONS_CONFIG = [
    {"name": "职责匹配度", "en_key": "responsibility_match", "weight": 15},
    {"name": "技能匹配度", "en_key": "skill_match", "weight": 15},
    {"name": "薪资竞争力", "en_key": "salary_competitiveness", "weight": 12},
    {"name": "成长空间", "en_key": "growth_potential", "weight": 12},
    {"name": "稳定性", "en_key": "stability", "weight": 10},
    {"name": "学习价值", "en_key": "learning_value", "weight": 10},
    {"name": "家庭平衡", "en_key": "work_life_balance", "weight": 8},
    {"name": "意义感", "en_key": "meaning", "weight": 6},
    {"name": "工作自由度", "en_key": "autonomy", "weight": 6},
    {"name": "创造性", "en_key": "creativity", "weight": 6},
]


def _get_rating(score: float) -> str:
    if score >= 4.5:
        return "A"
    elif score >= 4.0:
        return "B"
    elif score >= 3.5:
        return "C"
    elif score >= 3.0:
        return "D"
    return "F"


def _generate_mock_dimensions(overall_score: float) -> list[dict]:
    """Generate lightweight mock dimensions based on overall score, for fallback when AI omits dimensions."""
    import random
    rng = random.Random(int(overall_score * 100))
    base = overall_score / 20.0  # normalize 0-100 → 0-5
    dims = [
        ("职责匹配度", 15), ("技能匹配度", 15), ("薪资竞争力", 12),
        ("成长空间", 12), ("稳定性", 10), ("学习价值", 10),
        ("家庭平衡", 8), ("意义感", 6), ("工作自由度", 6), ("创造性", 6),
    ]
    result = []
    for name, weight in dims:
        score = round(min(5.0, max(2.0, base + rng.uniform(-0.5, 0.5))), 1)
        result.append({"name": name, "score": score, "weight": weight, "description": "基于综合评分估算"})
    return result


def _generate_mock_analysis(job: Job) -> dict:
    """Generate realistic mock analysis data based on job content."""
    import random

    # Seed RNG with job id for consistent results per job
    rng = random.Random(job.id * 7 + 13)

    jd_lower = job.jd_text.lower()

    # Adjust dimension scores based on JD keywords
    is_ai = any(kw in jd_lower for kw in ["ai", "人工智能", "大模型", "机器学习"])
    is_product = any(kw in jd_lower for kw in ["产品", "需求", "规划"])
    is_tech = any(kw in jd_lower for kw in ["开发", "python", "后端", "全栈", "算法"])
    is_management = any(kw in jd_lower for kw in ["总监", "管理", "团队", "合伙人"])
    is_remote = any(kw in jd_lower for kw in ["远程"])
    is_startup = any(kw in jd_lower for kw in ["创业", "从0到1", "合伙人"])

    # Parse salary min
    salary_min = parse_salary_min(job.salary)

    # Base scores with noise, then adjust
    base_score = rng.uniform(3.2, 4.5)

    responsibility = min(5.0, max(2.0, base_score + rng.uniform(-0.3, 0.8)))
    skill = min(5.0, max(2.0, base_score + rng.uniform(-0.5, 0.4)))
    salary_comp = min(5.0, max(2.0, 3.5 if salary_min >= 25 else 3.0))
    growth = min(5.0, max(2.0, base_score + (0.5 if is_ai else 0.0) + rng.uniform(-0.2, 0.5)))
    stability = min(5.0, max(1.5, 3.0 if is_startup else 4.0 - rng.uniform(0, 0.5)))
    learning = min(5.0, max(2.0, base_score + (0.5 if is_ai or is_tech else 0.0) + rng.uniform(-0.3, 0.3)))
    wlb = min(5.0, max(2.5, 4.0 if is_remote else 3.5 + rng.uniform(-0.3, 0.3)))
    meaning = min(5.0, max(2.5, base_score + rng.uniform(-0.4, 0.4)))
    autonomy = min(5.0, max(2.5, 4.0 if is_management else 3.5 + rng.uniform(-0.3, 0.5)))
    creativity = min(5.0, max(2.0, base_score + (0.3 if is_product else 0.0) + rng.uniform(-0.3, 0.4)))

    dimensions = [
        {"name": "职责匹配度", "score": round(responsibility, 1), "weight": 15,
         "description": "你的建筑项目管理经验与AI产品职责高度相关" if is_product else "职责要求与你的能力背景匹配度较好"},
        {"name": "技能匹配度", "score": round(skill, 1), "weight": 15,
         "description": "部分AI技能需补足，但核心能力匹配" if is_ai else "技术栈与你的技能体系有交集"},
        {"name": "薪资竞争力", "score": round(salary_comp, 1), "weight": 12,
         "description": "薪资在目标范围内" if salary_min >= 25 else "薪资偏低，需关注成长空间"},
        {"name": "成长空间", "score": round(growth, 1), "weight": 12,
         "description": "AI行业成长空间大" if is_ai else "有一定成长空间"},
        {"name": "稳定性", "score": round(stability, 1), "weight": 10,
         "description": "创业公司有一定风险" if is_startup else "公司发展稳定"},
        {"name": "学习价值", "score": round(learning, 1), "weight": 10,
         "description": "AI赛道学习机会多" if is_ai else "能学到新领域知识"},
        {"name": "家庭平衡", "score": round(wlb, 1), "weight": 8,
         "description": "远程办公更灵活" if is_remote else "工作时间较为合理"},
        {"name": "意义感", "score": round(meaning, 1), "weight": 6,
         "description": "产品有社会价值" if is_product else "工作有一定意义感"},
        {"name": "工作自由度", "score": round(autonomy, 1), "weight": 6,
         "description": "管理岗位有较高自主权" if is_management else "有一定自主权"},
        {"name": "创造性", "score": round(creativity, 1), "weight": 6,
         "description": "产品设计创意空间大" if is_product else "工作中有发挥创意的机会"},
    ]

    # Calculate weighted average
    overall_score = sum(d["score"] * d["weight"] for d in dimensions) / 100.0
    overall_score = round(overall_score, 1)
    rating = _get_rating(overall_score)

    # Generate summary and suggestions based on rating
    if rating in ("A", "B"):
        summary = f"该岗位与你的能力匹配度较高（整体评分{overall_score}），{'AI方向与你的建筑+AI复合背景契合' if is_ai else '岗位方向与你的职业规划一致'}。建议优先投递。"
        suggestions = [
            "面试时重点展示建筑项目管理到目标岗位的迁移能力",
            "准备1-2个相关领域的实际案例",
            "了解该公司产品和竞品情况",
        ]
    elif rating == "C":
        summary = f"该岗位匹配度中等（整体评分{overall_score}），可以作为备选方向。建议进一步了解公司和团队情况后再决定是否投递。"
        suggestions = [
            "确认薪资是否能满足期望",
            "了解团队规模和公司发展现状",
            "评估该岗位的长期发展路径",
        ]
    else:
        summary = f"该岗位整体匹配度偏低（整体评分{overall_score}），不建议优先投递。但如果岗位有特殊吸引力，可以考虑尝试。"
        suggestions = [
            "评估是否有其他更匹配的岗位可选",
            "如有特殊吸引力，可尝试投递但降低期望",
            "将该岗位作为市场调研参考",
        ]

    return {
        "overall_score": overall_score,
        "rating": rating,
        "dimensions": dimensions,
        "summary": summary,
        "suggestions": suggestions,
    }


@router.get("/jobs/{job_id}/analyze")
async def analyze_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        return {"error": "Job not found"}

    # Try real AI analysis via Pinme API
    user_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    profile_text = ""
    if user_profile:
        parts = []
        if user_profile.name:
            parts.append(f"候选人: {user_profile.name}")
        if user_profile.city:
            parts.append(f"目标城市: {user_profile.city}")
        if user_profile.salary_min:
            parts.append(f"期望薪资: {user_profile.salary_min}K-{user_profile.salary_max}K")
        parts.append(f"背景: 国家一级注册建筑师，9年建筑全流程经验，AI转型中")
        profile_text = "；".join(parts)

    system_prompt = _OCHO_BLOCK_PROMPT.format(profile_text=profile_text)

    user_message = f"公司：{job.company}\n岗位：{job.title}\n薪资：{job.salary}\n城市：{job.city}\n\n岗位描述：{job.jd_text}"

    ai_response = await call_pinme_llm(system_prompt, user_message, temperature=0.5, max_tokens=3000)

    if ai_response:
        try:
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                analysis = json.loads(json_match.group())
                if "overall_score" in analysis:
                    # Ensure dimensions field exists (AI may omit it)
                    if "dimensions" not in analysis or not analysis["dimensions"]:
                        mock = _generate_mock_analysis(job)
                        analysis["dimensions"] = mock["dimensions"]
                    job.match_score = analysis.get("overall_score", 0)
                    job.rating = analysis.get("rating", "C")
                    db.commit()
                    return analysis
        except (json.JSONDecodeError, KeyError):
            pass

    # Fallback to mock analysis
    analysis = _generate_mock_analysis(job)
    job.match_score = analysis.get("overall_score", 0)
    job.rating = analysis.get("rating")
    db.commit()
    return analysis


@router.get("/jobs/")
def list_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jobs = db.query(Job).filter(Job.user_id == current_user.id).order_by(Job.created_at.desc()).all()
    return [
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
        }
        for j in jobs
    ]


@router.post("/jobs/{job_id}/favorite")
def toggle_favorite(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id, Job.user_id == current_user.id).first()
    if not job:
        return {"error": "Job not found"}

    existing = (
        db.query(JobFavorite)
        .filter(JobFavorite.user_id == current_user.id, JobFavorite.job_id == job_id)
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()
        return {"favorited": False, "message": "已取消收藏"}
    else:
        fav = JobFavorite(user_id=current_user.id, job_id=job_id)
        db.add(fav)
        db.commit()
        return {"favorited": True, "message": "已收藏"}


@router.post("/jobs/save-from-analysis")
def save_job_from_analysis(
    data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    title = data.get("title") or data.get("职位名称", "")
    company = data.get("company") or data.get("公司名称", "")
    jd_text = data.get("jd_text") or data.get("岗位描述", "")
    salary = data.get("salary") or data.get("薪资范围", "面议")
    city = data.get("city") or data.get("城市", "")
    platform = data.get("platform", "JD直推")

    if not title:
        raise HTTPException(status_code=400, detail="缺少职位名称")

    existing = db.query(Job).filter(
        Job.user_id == current_user.id,
        Job.title == title,
        Job.company == company,
    ).first()
    if existing:
        return {
            "id": existing.id,
            "message": "岗位已存在",
            "duplicate": True,
        }

    job = Job(
        user_id=current_user.id,
        title=title,
        company=company,
        salary=salary,
        city=city,
        platform=platform,
        jd_text=jd_text,
        jd_url="",
        status="saved",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return {"id": job.id, "message": "岗位已保存", "duplicate": False}


# ============================================================
# JD直推入口：粘贴JD文本直接分析（入口A）
# ============================================================

_OCHO_BLOCK_PROMPT = """你是一个专业的求职顾问AI。请严格按照以下7-Block格式对岗位进行全面评估。

候选人背景：
{profile_text}

---

## Block A：角色概述
判断该岗位属于以下哪种原型：FDE(快速交付工程师)、SA(系统架构师)、PM(产品经理)、LLMOps、Agentic(智能体工程)、Transformation(变革管理)。如果是混合型，指出最接近的2个。

表格输出：领域、职能、职级、远程情况、团队规模、一句话概述。

## Block B：技能匹配
逐行映射JD要求与候选人能力，标注匹配度（✅强/⚠️中/❌弱）。对每个差距分析：是硬性门槛还是加分项？候选人能否展示相邻经验？具体缓解方案。

## Block C：职级策略
JD检测到的职级 vs 候选人自然职级。'卖资深不撒谎'方案。如被降级如何处理。

## Block D：薪酬评估
分析薪资竞争力（基于杭州市场），给出合理期望范围。

## Block E：简历定向方案
Top 5简历修改建议，最大化匹配度。每条包含：板块、当前状态、建议修改、原因。

## Block F：面试准备
5-6个STAR+R故事，映射到JD要求。每个故事标注：S(情境)、T(任务)、A(行动)、R(结果)、Reflection(反思)。还要包括1个推荐案例研究和红旗问题应对方式。

## Block G：岗位真实性评估
分析发布信号判断是否为真实有效招聘。三级之一：高置信度/谨慎推进/可疑。

---

输出格式：JSON，包含以下字段：
- prototype（检测到的原型）
- block_a（角色概述，markdown表格文本）
- block_b（技能匹配，markdown表格文本）
- block_c（职级策略，文本）
- block_d（薪酬评估，文本）
- block_e（简历定向方案，markdown表格文本）
- block_f（面试准备，markdown文本）
- block_g（真实性评估 + 等级，文本）
- overall_score（整数0-100）
- rating（A/B/C/D/F）
- dimensions（10维度评分数组，每项含name/score/weight/description，维度：职责匹配度15%/技能匹配度15%/薪资竞争力12%/成长空间12%/稳定性10%/学习价值10%/家庭平衡8%/意义感6%/工作自由度6%/创造性6%）
- summary（一句话总评）
- suggestions（3-5条行动建议）
"""


class DirectAnalyzeRequest(BaseModel):
    jd_text: str
    company: str = ""
    title: str = ""


@router.post("/jobs/direct-analyze")
async def direct_analyze(
    req: DirectAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_profile = db.query(Profile).filter(Profile.user_id == current_user.id).first()
    profile_text = "国家一级注册建筑师，9年建筑全流程经验，AI转型中"
    if user_profile:
        parts = []
        if user_profile.name:
            parts.append(f"候选人: {user_profile.name}")
        if user_profile.city:
            parts.append(f"目标城市: {user_profile.city}")
        if user_profile.salary_min:
            parts.append(f"期望薪资: {user_profile.salary_min}K-{user_profile.salary_max}K")
        profile_text = "；".join(parts) if parts else profile_text

    system_prompt = _OCHO_BLOCK_PROMPT.format(profile_text=profile_text)
    user_message = f"公司：{req.company or '未知'}\n岗位：{req.title or '未知'}\n\n岗位描述：\n{req.jd_text}"

    ai_response = await call_pinme_llm(system_prompt, user_message, temperature=0.5, max_tokens=3000)

    if ai_response:
        try:
            json_match = re.search(r'\{[\s\S]*\}', ai_response)
            if json_match:
                analysis = json.loads(json_match.group())
                if "overall_score" in analysis:
                    # Ensure dimensions field exists (AI may omit it)
                    if "dimensions" not in analysis or not analysis["dimensions"]:
                        analysis["dimensions"] = _generate_mock_dimensions(analysis.get("overall_score", 65))
                    return analysis
        except (json.JSONDecodeError, KeyError):
            pass

    return {
        "overall_score": 65,
        "rating": "C",
        "dimensions": _generate_mock_dimensions(65),
        "summary": "AI分析暂不可用，请稍后重试",
        "suggestions": ["尝试重新分析", "手动评估岗位匹配度"],
        "block_a": "| 字段 | 内容 |\n|------|------|\n| 原型 | 待分析 |\n| 领域 | 待分析 |\n| 职能 | 待分析 |\n| 职级 | 待分析 |\n| 远程 | 待分析 |\n| 团队规模 | 待分析 |\n| 概述 | 待AI分析 |",
        "prototype": "未知",
    }