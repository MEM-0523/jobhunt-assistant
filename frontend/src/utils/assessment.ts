export interface AssessmentQuestion {
  id: string;
  text: string;
  dimension: string;
  section: 'holland' | 'big5' | 'caas';
  reverse?: boolean;
}

export interface AssessmentResult {
  holland: { R: number; I: number; A: number; S: number; E: number; C: number };
  big5: { N: number; E: number; O: number; A: number; C: number };
  caas: { concern: number; control: number; curiosity: number; confidence: number };
  recommendations: CareerRecommendation[];
}

export interface CareerRecommendation {
  role: string;
  fit_score: number;
  reason: string;
  suggested_keywords: string[];
}

export const QUESTIONS: AssessmentQuestion[] = [
  // ===== 霍兰德 RIASEC (60题) =====
  { id: 'R01', text: '我喜欢动手修理家里的电器或家具', dimension: 'R', section: 'holland' },
  { id: 'R02', text: '我擅长使用工具完成具体任务', dimension: 'R', section: 'holland' },
  { id: 'R03', text: '我对机械设备的原理和工作方式感兴趣', dimension: 'R', section: 'holland' },
  { id: 'R04', text: '我喜欢户外活动和体力劳动', dimension: 'R', section: 'holland' },
  { id: 'R05', text: '我能快速掌握新工具或新设备的使用方法', dimension: 'R', section: 'holland' },
  { id: 'R06', text: '我做事注重实干，喜欢看到具体成果', dimension: 'R', section: 'holland' },
  { id: 'R07', text: '我喜欢动手制作东西的成就感', dimension: 'R', section: 'holland' },
  { id: 'R08', text: '我对工程和制造类工作有天然兴趣', dimension: 'R', section: 'holland' },
  { id: 'R09', text: '我更擅长处理具体事物而非抽象概念', dimension: 'R', section: 'holland', reverse: true },
  { id: 'R10', text: '我对需要精细手工操作的工作感到不耐烦', dimension: 'R', section: 'holland', reverse: true },

  { id: 'I01', text: '我喜欢研究和分析问题的本质原因', dimension: 'I', section: 'holland' },
  { id: 'I02', text: '我能长时间专注于解决一个复杂问题', dimension: 'I', section: 'holland' },
  { id: 'I03', text: '我对科学研究和学术讨论有浓厚兴趣', dimension: 'I', section: 'holland' },
  { id: 'I04', text: '我喜欢用数据和事实来支撑我的判断', dimension: 'I', section: 'holland' },
  { id: 'I05', text: '我经常思考事物的底层逻辑和规律', dimension: 'I', section: 'holland' },
  { id: 'I06', text: '我享受独立思考和自主学习的过程', dimension: 'I', section: 'holland' },
  { id: 'I07', text: '我对新理论和新知识有强烈好奇心', dimension: 'I', section: 'holland' },
  { id: 'I08', text: '我擅长从复杂信息中归纳出核心结论', dimension: 'I', section: 'holland' },
  { id: 'I09', text: '我对抽象的学术研究感到枯燥', dimension: 'I', section: 'holland', reverse: true },
  { id: 'I10', text: '比起独自研究，我更喜欢与人一起做事', dimension: 'I', section: 'holland', reverse: true },

  { id: 'A01', text: '我对艺术、设计和美学有强烈的敏感度', dimension: 'A', section: 'holland' },
  { id: 'A02', text: '我喜欢通过创作来表达自己的想法和情感', dimension: 'A', section: 'holland' },
  { id: 'A03', text: '我经常有新颖的创意和想法', dimension: 'A', section: 'holland' },
  { id: 'A04', text: '我享受不受约束的自由创作过程', dimension: 'A', section: 'holland' },
  { id: 'A05', text: '我对色彩、造型和空间有独特的审美', dimension: 'A', section: 'holland' },
  { id: 'A06', text: '我喜欢用不同的视角看待同一件事', dimension: 'A', section: 'holland' },
  { id: 'A07', text: '我愿意尝试新的表达方式和媒介', dimension: 'A', section: 'holland' },
  { id: 'A08', text: '我在设计类工作中能发挥出最好的状态', dimension: 'A', section: 'holland' },
  { id: 'A09', text: '我很难接受没有明确标准的工作任务', dimension: 'A', section: 'holland', reverse: true },
  { id: 'A10', text: '我的创意更适合用在解决问题上而非纯艺术表达', dimension: 'A', section: 'holland', reverse: true },

  { id: 'S01', text: '我喜欢帮助他人解决困难和问题', dimension: 'S', section: 'holland' },
  { id: 'S02', text: '我能敏锐地察觉他人的情绪和需求', dimension: 'S', section: 'holland' },
  { id: 'S03', text: '我享受在团队中协作和沟通的过程', dimension: 'S', section: 'holland' },
  { id: 'S04', text: '我对教育、培训或咨询类工作有天然兴趣', dimension: 'S', section: 'holland' },
  { id: 'S05', text: '我善于调解矛盾，促进团队和谐', dimension: 'S', section: 'holland' },
  { id: 'S06', text: '我在与人打交道的工作中感到充实', dimension: 'S', section: 'holland' },
  { id: 'S07', text: '我乐意花时间倾听他人的想法和感受', dimension: 'S', section: 'holland' },
  { id: 'S08', text: '我擅长向他人解释和传达信息', dimension: 'S', section: 'holland' },
  { id: 'S09', text: '我更喜欢独立完成任务而非帮助他人', dimension: 'S', section: 'holland', reverse: true },
  { id: 'S10', text: '我对他人的情绪问题感到压力', dimension: 'S', section: 'holland', reverse: true },

  { id: 'E01', text: '我喜欢带领团队完成任务', dimension: 'E', section: 'holland' },
  { id: 'E02', text: '我善于说服他人接受我的观点', dimension: 'E', section: 'holland' },
  { id: 'E03', text: '我对商业运作和市场竞争有浓厚兴趣', dimension: 'E', section: 'holland' },
  { id: 'E04', text: '我能在压力下做出果断的决策', dimension: 'E', section: 'holland' },
  { id: 'E05', text: '我追求成就和影响力，喜欢设定并达成目标', dimension: 'E', section: 'holland' },
  { id: 'E06', text: '我善于洞察机会并敢于承担风险', dimension: 'E', section: 'holland' },
  { id: 'E07', text: '我在社交活动中充满能量，乐于结识新朋友', dimension: 'E', section: 'holland' },
  { id: 'E08', text: '我喜欢博弈和竞争带来的刺激感', dimension: 'E', section: 'holland' },
  { id: 'E09', text: '我不喜欢承担管理他人的责任', dimension: 'E', section: 'holland', reverse: true },
  { id: 'E10', text: '我对销售和商务谈判缺乏兴趣', dimension: 'E', section: 'holland', reverse: true },

  { id: 'C01', text: '我按计划和流程做事时感到踏实', dimension: 'C', section: 'holland' },
  { id: 'C02', text: '我注重细节，追求工作的准确和规范', dimension: 'C', section: 'holland' },
  { id: 'C03', text: '我喜欢井然有序的工作环境和流程', dimension: 'C', section: 'holland' },
  { id: 'C04', text: '我擅长整理和归档各类信息和文件', dimension: 'C', section: 'holland' },
  { id: 'C05', text: '我倾向于遵循既定的规章制度', dimension: 'C', section: 'holland' },
  { id: 'C06', text: '我在需要高效执行和记录的工作中表现出色', dimension: 'C', section: 'holland' },
  { id: 'C07', text: '我能够坚持完成重复性但重要的工作', dimension: 'C', section: 'holland' },
  { id: 'C08', text: '我对财务、数据管理或行政事务有耐心', dimension: 'C', section: 'holland' },
  { id: 'C09', text: '我对过多条条框框和文书工作感到厌倦', dimension: 'C', section: 'holland', reverse: true },
  { id: 'C10', text: '我更喜欢灵活多变而非按部就班的工作', dimension: 'C', section: 'holland', reverse: true },

  // ===== 大五人格 CBF-PI-15 (15题) =====
  { id: 'N01', text: '我经常感到焦虑或紧张', dimension: 'N', section: 'big5' },
  { id: 'N02', text: '我容易因为小事而心情低落', dimension: 'N', section: 'big5' },
  { id: 'N03', text: '我面对压力时能保持冷静', dimension: 'N', section: 'big5', reverse: true },

  { id: 'E04', text: '我喜欢成为众人关注的焦点', dimension: 'E', section: 'big5', reverse: true },
  { id: 'E05', text: '我在社交场合中充满活力', dimension: 'E', section: 'big5' },
  { id: 'E06', text: '我更喜欢独处而非社交活动', dimension: 'E', section: 'big5', reverse: true },

  { id: 'O07', text: '我对新事物和新观念保持开放态度', dimension: 'O', section: 'big5' },
  { id: 'O08', text: '我喜欢尝试不同的方法和途径', dimension: 'O', section: 'big5' },
  { id: 'O09', text: '我对艺术和文化活动有浓厚兴趣', dimension: 'O', section: 'big5' },

  { id: 'A10', text: '我乐于相信他人的善意', dimension: 'A', section: 'big5' },
  { id: 'A11', text: '我愿意为他人妥协和让步', dimension: 'A', section: 'big5' },
  { id: 'A12', text: '我倾向于合作而非竞争', dimension: 'A', section: 'big5' },

  { id: 'C13', text: '我做事情总是有条不紊', dimension: 'C', section: 'big5' },
  { id: 'C14', text: '我坚持完成任务直到满意为止', dimension: 'C', section: 'big5' },
  { id: 'C15', text: '我经常制定计划并严格执行', dimension: 'C', section: 'big5' },

  // ===== CAAS-SF 职业适应力 (12题) =====
  { id: 'CA01', text: '我会思考我的未来职业会是什么样子', dimension: 'concern', section: 'caas' },
  { id: 'CA02', text: '我意识到现在的选择会塑造我的未来', dimension: 'concern', section: 'caas' },
  { id: 'CA03', text: '我为未来的职业发展做准备', dimension: 'concern', section: 'caas' },

  { id: 'CA04', text: '我对自己的决定负责', dimension: 'control', section: 'caas' },
  { id: 'CA05', text: '我坚持自己的信念', dimension: 'control', section: 'caas' },
  { id: 'CA06', text: '我做我认为正确的事', dimension: 'control', section: 'caas' },

  { id: 'CA07', text: '我寻找成长的机会', dimension: 'curiosity', section: 'caas' },
  { id: 'CA08', text: '在做选择前我会调查各种可能性', dimension: 'curiosity', section: 'caas' },
  { id: 'CA09', text: '我观察做事的不同方式', dimension: 'curiosity', section: 'caas' },

  { id: 'CA10', text: '我能高效地完成任务', dimension: 'confidence', section: 'caas' },
  { id: 'CA11', text: '我会认真把事情做好', dimension: 'confidence', section: 'caas' },
  { id: 'CA12', text: '我有能力解决问题', dimension: 'confidence', section: 'caas' },
];

const HOLLAND_ROLES: Record<string, string[]> = {
  'R': ['工程师', '技术专家', '建造师', '建筑师', '质量管理'],
  'I': ['研究员', '数据分析师', 'AI算法工程师', '战略分析师', '科学家'],
  'A': ['设计师', '创意总监', '用户体验设计师', '产品设计师', '内容创作者'],
  'S': ['教师', '咨询顾问', 'HR', '客户成功经理', '社区运营'],
  'E': ['管理者', '创业者', '销售总监', '商务拓展', '投资经理'],
  'C': ['财务', '审计', '法务', '项目经理', '运营管理'],
};

const BIG5_ROLE_FIT: Record<string, string[]> = {
  'high_O': ['AI产品经理', '创新顾问', '设计策略师'],
  'high_C': ['项目经理', '运营总监', '质量管理'],
  'high_E': ['商务拓展', '解决方案顾问', '销售总监'],
  'high_A': ['客户成功', 'HRBP', '社区运营'],
  'low_N': ['应急管理', '高压决策岗', '危机公关'],
};

export function scoreAssessment(answers: Record<string, number>): AssessmentResult {
  const holland: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  const big5: Record<string, number> = { N: 0, E: 0, O: 0, A: 0, C: 0 };
  const caas: Record<string, number> = { concern: 0, control: 0, curiosity: 0, confidence: 0 };

  for (const q of QUESTIONS) {
    const raw = answers[q.id] || 3;
    const score = q.reverse ? (6 - raw) : raw;

    if (q.section === 'holland') {
      holland[q.dimension] = (holland[q.dimension] || 0) + score;
    } else if (q.section === 'big5') {
      big5[q.dimension] = (big5[q.dimension] || 0) + score;
    } else if (q.section === 'caas') {
      caas[q.dimension] = (caas[q.dimension] || 0) + score;
    }
  }

  const recommendations = generateRecommendations(holland, big5, caas);

  return {
    holland: holland as AssessmentResult['holland'],
    big5: big5 as AssessmentResult['big5'],
    caas: caas as AssessmentResult['caas'],
    recommendations,
  };
}

function generateRecommendations(
  holland: Record<string, number>,
  big5: Record<string, number>,
  caas: Record<string, number>,
): CareerRecommendation[] {
  const sortedHolland = Object.entries(holland)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const recs: CareerRecommendation[] = [];

  for (const [code, score] of sortedHolland) {
    const roles = HOLLAND_ROLES[code] || [];
    const maxScore = QUESTIONS.filter(q => q.dimension === code && q.section === 'holland').length * 5;
    const fit = Math.round((score / maxScore) * 100);

    recs.push({
      role: roles[0],
      fit_score: fit,
      reason: `你的${getHollandLabel(code)}倾向显著（${fit}%），适合${roles.slice(0, 3).join('、')}等方向`,
      suggested_keywords: roles.slice(0, 3),
    });
  }

  // Add Big5-based insights
  if (big5['O'] >= 12) {
    recs.push({
      role: '创新/设计类岗位',
      fit_score: Math.round((big5['O'] / 15) * 100),
      reason: '你对新事物开放度高，适合需要创意和不断学习的工作',
      suggested_keywords: BIG5_ROLE_FIT['high_O'],
    });
  }
  if (big5['E'] >= 12) {
    recs.push({
      role: '商务/沟通类岗位',
      fit_score: Math.round((big5['E'] / 15) * 100),
      reason: '你外向活跃，适合需要大量人际沟通和社交的工作',
      suggested_keywords: BIG5_ROLE_FIT['high_E'],
    });
  }

  const caasAvg = Object.values(caas).reduce((a, b) => a + b, 0) / Object.keys(caas).length;
  if (caasAvg >= 4) {
    recs.push({
      role: '快速变化的行业',
      fit_score: Math.round((caasAvg / 5) * 100),
      reason: '你的职业适应力强，适合快速发展和变化的行业（如AI、互联网）',
      suggested_keywords: ['AI产品经理', '数字化转型', '新兴行业'],
    });
  }

  return recs.slice(0, 6);
}

function getHollandLabel(code: string): string {
  const labels: Record<string, string> = {
    R: '现实型（动手操作）',
    I: '研究型（分析思考）',
    A: '艺术型（创意表达）',
    S: '社会型（助人服务）',
    E: '企业型（领导影响）',
    C: '常规型（组织规范）',
  };
  return labels[code] || code;
}