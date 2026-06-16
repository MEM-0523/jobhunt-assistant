export interface TransitionCase {
  id: string;
  title: string;
  from: string;
  to: string;
  city: string;
  salary_range: string;
  key_learnings: string[];
  resume_tips: string[];
  interview_tips: string[];
  transition_timeline: string;
}

export const transitionCases: TransitionCase[] = [
  {
    id: 'alex-architecture-to-ai',
    title: '建筑师转AI产品经理',
    from: '建筑设计 · 9年经验 · 国家一级注册建筑师',
    to: 'AI产品经理 / AI解决方案架构师',
    city: '杭州',
    salary_range: '25-35K',
    key_learnings: [
      "建筑设计师的'需求分析→方案设计→施工落地'流程与产品经理的'需求发现→原型设计→开发上线'高度对应",
      '跨专业协调能力（结构/暖通/电气）可映射为跨职能团队协作（设计/开发/测试）',
      '方案汇报经验直接转化为产品评审和Stakeholder沟通能力',
      '标准化经验（将30款产品设计规则化为通用规范）对应产品规模化思维',
    ],
    resume_tips: [
      "不要写'建筑设计师'，写'复杂项目交付负责人'",
      "用产品语言描述建筑项目：'主导30款产品的标准化设计，覆盖3个品牌线'",
      "强调数据：'将设计变更率降低40%，交付周期缩短25%'",
      '转型叙事放在简历summary第一句',
    ],
    interview_tips: [
      "'你为什么从建筑转AI？'——标准答案模板：不是转行，是延伸。建筑设计的本质是理解需求→设计方案→落地执行，和产品经理完全一致，只是载体从建筑变成了软件。",
      '准备2-3个STAR故事，用建筑经验但用产品语言讲',
      '展示学习能力：做了什么AI相关项目/课程',
    ],
    transition_timeline: '2026年3月启动准备 → 4月完成职业测评和定位 → 5月简历优化 → 5-6月集中投递和面试',
  },
];