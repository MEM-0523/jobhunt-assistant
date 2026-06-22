import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Zap, ArrowRight, Target, AlertTriangle, TrendingUp, Search, FileText,
  ChevronDown, Briefcase, Building2, Brain, Clock, Shield, BarChart3, BookOpen,
  Lightbulb, CheckCircle2, ChevronRight,
} from 'lucide-react'
import client from '../api/client'

interface Skill {
  skill: string
  level: string
  description?: string
  reason?: string
}

interface SkillGap {
  gap: string
  severity: 'high' | 'medium' | 'low'
  suggestion: string
  estimated_hours?: number
}

interface Archetype {
  archetype: string
  fit_score: number
  reason: string
}

interface PathItem {
  to: string
  to_industry: string
  overlap_score: number
  adjusted_score: number
  adjustments?: {
    risk_tolerance: number
    industry_preference: number
    gap_penalty: number
  }
  archetypes: Archetype[]
}

interface TimelineData {
  total_hours: number
  daily_hours: number
  estimated_weeks: number
  timeline_feasible: boolean
  risk_strategy: string
  learning_pace_label: string
  phases: { phase: number; name: string; hours: number; weeks: number; suggestion: string; severity: string }[]
  message: string
}

interface AIPersonalization {
  personalized_strategy?: string
  milestones?: { phase: number; name: string; duration: string; actions: string[]; checkpoint: string }[]
  risk_mitigation?: { risk: string; likelihood: string; mitigation: string }[]
  quick_wins?: string[]
  alternative_paths?: { path: string; when_to_consider: string; trade_off: string }[]
  resources?: { name: string; type: string; why: string; priority: string }[]
}

interface TransitionResult {
  matched: boolean
  data_source?: string
  message?: string
  from_industry?: string
  from_role?: string
  core_skills?: Skill[]
  all_paths?: PathItem[]
  best_path?: {
    to: string
    to_industry: string
    overlap_score: number
    overlap_skills: string[]
    gaps: SkillGap[]
    archetypes: Archetype[]
  }
  timeline?: TimelineData
  ai_personalization?: AIPersonalization
  // Legacy fields
  transferable_skills?: Skill[]
  skill_gaps?: SkillGap[]
  recommended_archetypes?: Archetype[]
}

const PRESETS = [
  { label: '建筑设计师 → AI产品经理', industry: '建筑设计', role: '建筑设计师', targetIndustry: 'AI/互联网', targetRole: 'AI产品经理' },
  { label: '会计师 → 产品经理', industry: '财务/会计', role: '会计', targetIndustry: 'AI/互联网', targetRole: '产品经理' },
  { label: '教师 → 运营经理', industry: '教育培训', role: '教师/培训师', targetIndustry: 'AI/互联网', targetRole: '运营经理' },
]

const INDUSTRY_OPTIONS = [
  '建筑设计', '城市规划', '房地产', '工程施工',
  'AI/互联网', '云计算/SaaS', '大数据', '物联网',
  '教育培训', '财务/会计', '金融/银行', '医疗健康',
  '电商/零售', '制造业', '媒体/广告', '咨询服务',
  '政府/公共事业', '物流/供应链', '能源/环保', '其他',
  '新能源', '半导体', '汽车', '游戏',
  '文娱/影视', '法律', '餐饮/酒店', '农业',
  '航空/航天', '保险', '电信/通信', '建材/家居',
  '服装/纺织', '生物医药', '化工', '矿业',
  '体育', '母婴/亲子', '宠物', '区块链/Web3',
  '智能硬件', '企业服务', '社交网络', '信息安全',
]

const ROLE_OPTIONS = [
  '建筑设计师', '结构工程师', '项目经理', 'BIM经理',
  '产品经理', 'AI产品经理', '技术产品经理', '产品总监',
  '后端开发', '前端开发', '全栈开发', 'AI工程师',
  '数据分析师', 'AI训练师', '运营经理', '市场经理',
  '销售总监', '人力资源', '行政经理', '总经理助理',
  'UX设计师', '解决方案架构师', '数字化转型顾问', '其他',
  '总经理', '副总经理', '财务总监', '市场总监',
  '技术总监', 'CTO', 'CFO', 'COO',
  '内容运营', '用户运营', '社区运营', '增长经理',
  '品牌经理', '公关经理', '法务', '合规',
  '采购经理', '供应链经理', '质量经理', '测试工程师',
  '运维工程师', '算法工程师', '数据工程师', '机器学习工程师',
  'UI设计师', '交互设计师', '插画师', '文案策划',
  '编导', '摄影师', '教师/培训师', '咨询师',
  '研究员', '投资经理', '风控经理', '产品助理',
  '运营助理', '管培生', '实习生', '会计',
]

const levelBadge = (level: string) => {
  if (level === '精通') return 'bg-green-100 text-green-700'
  if (level === '熟练') return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

const severityBadge = (severity: string) => {
  if (severity === 'high') return 'bg-red-100 text-red-700'
  if (severity === 'medium') return 'bg-orange-100 text-orange-700'
  return 'bg-yellow-100 text-yellow-700'
}

interface DropdownInputProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder: string
  icon: React.ReactNode
}

function DropdownInput({ value, onChange, options, placeholder, icon }: DropdownInputProps) {
  const [open, setOpen] = useState(false)
  const [filtered, setFiltered] = useState<string[]>(options)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleInputChange = (val: string) => {
    onChange(val)
    setFiltered(options.filter(o => o.toLowerCase().includes(val.toLowerCase())))
    if (!open) setOpen(true)
  }

  const handleSelect = (opt: string) => {
    onChange(opt)
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {icon}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { setFiltered(options.filter(o => o.toLowerCase().includes(value.toLowerCase()))); setOpen(true) }}
          placeholder={placeholder}
          className="block w-full pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelect(opt)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 transition-colors ${
                opt === value ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-700'
              }`}
            >
              {opt}
            </button>
          ))}
          {filtered.length === 0 && value.trim() && (
            <div className="px-3 py-2 text-xs text-gray-500">
              无匹配项，按回车使用"{value}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CareerTransition() {
  const navigate = useNavigate()
  const resultRef = useRef<HTMLDivElement>(null)

  const [currentIndustry, setCurrentIndustry] = useState('')
  const [currentRole, setCurrentRole] = useState('')
  const [targetIndustry, setTargetIndustry] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [result, setResult] = useState<TransitionResult | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'paths' | 'timeline' | 'ai'>('overview')
  const [error, setError] = useState('')

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setCurrentIndustry(p.industry)
    setCurrentRole(p.role)
    setTargetIndustry(p.targetIndustry)
    setTargetRole(p.targetRole)
    setResult(null)
    setError('')
  }

  const handleAnalyze = async () => {
    if (!currentRole.trim()) {
      setError('请填写当前职位')
      return
    }
    if (!targetRole.trim()) {
      setError('请填写目标职位')
      return
    }
    setError('')
    setAnalyzing(true)
    setResult(null)

    try {
      const res = await client.post('/career/analyze-transition', {
        current_industry: currentIndustry.trim(),
        current_role: currentRole.trim(),
        target_industry: targetIndustry.trim(),
        target_role: targetRole.trim(),
      })
      setResult(res.data)
      setActiveTab('overview')
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch {
      setError('分析失败，请稍后重试')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleAiAnalyze = async () => {
    if (!currentRole.trim()) {
      setError('请填写当前职位')
      return
    }
    if (!targetRole.trim()) {
      setError('请填写目标职位')
      return
    }
    setError('')
    setAiAnalyzing(true)
    setResult(null)

    try {
      const res = await client.post('/career/analyze-transition-ai', {
        current_industry: currentIndustry.trim(),
        current_role: currentRole.trim(),
        target_industry: targetIndustry.trim(),
        target_role: targetRole.trim(),
      })
      setResult(res.data)
      setActiveTab('ai')
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch {
      setError('AI分析失败，请稍后重试')
    } finally {
      setAiAnalyzing(false)
    }
  }

  const getTransferableSkills = (): Skill[] => {
    return result?.core_skills || result?.transferable_skills || []
  }

  const getSkillGaps = (): SkillGap[] => {
    return result?.best_path?.gaps || result?.skill_gaps || []
  }

  const getArchetypes = (): Archetype[] => {
    return result?.best_path?.archetypes || result?.recommended_archetypes || []
  }

  const isNewFormat = result?.best_path !== undefined

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Zap size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">能力迁移分析</h1>
          <p className="text-sm text-gray-500">发现你的可迁移能力，找到匹配的转型方向</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-gray-400 self-center mr-1">快捷填充：</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 mb-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-1.5 mb-3">
              <Building2 size={16} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">我当前是</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">所在行业</label>
                <DropdownInput
                  value={currentIndustry}
                  onChange={setCurrentIndustry}
                  options={INDUSTRY_OPTIONS}
                  placeholder="选择或输入行业，如：建筑设计"
                  icon={<Building2 size={14} />}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">当前职业</label>
                <DropdownInput
                  value={currentRole}
                  onChange={setCurrentRole}
                  options={ROLE_OPTIONS}
                  placeholder="选择或输入职位，如：建筑设计师"
                  icon={<Briefcase size={14} />}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="hidden md:flex bg-indigo-100 rounded-full p-2">
              <ArrowRight size={20} className="text-indigo-600" />
            </div>
            <div className="md:hidden text-center text-gray-400 text-sm py-1">↓ 转型为 ↓</div>
          </div>

          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
            <div className="flex items-center gap-1.5 mb-3">
              <Target size={16} className="text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-700">我想转行做</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">目标行业</label>
                <DropdownInput
                  value={targetIndustry}
                  onChange={setTargetIndustry}
                  options={INDUSTRY_OPTIONS}
                  placeholder="选择或输入行业，如：AI/互联网"
                  icon={<Building2 size={14} />}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">目标职业</label>
                <DropdownInput
                  value={targetRole}
                  onChange={setTargetRole}
                  options={ROLE_OPTIONS}
                  placeholder="选择或输入职位，如：AI产品经理"
                  icon={<Briefcase size={14} />}
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 mb-4">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleAnalyze}
            disabled={analyzing || aiAnalyzing}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {analyzing && <Loader2 size={16} className="animate-spin" />}
            {analyzing ? '分析中...' : '基础知识库分析'}
          </button>
          <button
            onClick={handleAiAnalyze}
            disabled={analyzing || aiAnalyzing}
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {aiAnalyzing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Brain size={16} />
            )}
            {aiAnalyzing ? 'AI分析中...' : 'AI个性化分析'}
          </button>
        </div>
      </div>

      {result && (
        <div ref={resultRef} className="space-y-6">
          {/* Data source badge */}
          <div className="flex items-center gap-2">
            <span className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium',
              result.data_source === 'ai_personalized'
                ? 'bg-purple-100 text-purple-700'
                : result.data_source === 'knowledge_base'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600'
            )}>
              {result.data_source === 'ai_personalized' ? 'AI个性化分析' : result.data_source === 'knowledge_base' ? '知识库匹配' : '通用建议'}
            </span>
          </div>

          {!result.matched && result.message && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              {result.message}
            </div>
          )}

          {/* Tab Navigation */}
          {isNewFormat && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: 'overview', label: '能力概览', icon: <BarChart3 size={14} /> },
                { key: 'paths', label: '转型路径', icon: <Target size={14} /> },
                { key: 'timeline', label: '时间线', icon: <Clock size={14} /> },
                { key: 'ai', label: 'AI建议', icon: <Brain size={14} /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center',
                    activeTab === tab.key
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Tab: 能力概览 */}
          {(activeTab === 'overview' || !isNewFormat) && (
            <>
              {/* Core Skills */}
              {getTransferableSkills().length > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
                  <h2 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                    <TrendingUp size={18} className="text-green-600" />
                    可迁移能力
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {getTransferableSkills().map((s, i) => (
                      <div key={i} className="bg-white rounded-lg border border-green-100 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-gray-900 text-sm">{s.skill}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelBadge(s.level)}`}>
                            {s.level}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{s.reason || s.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skill Gaps */}
              {getSkillGaps().length > 0 && (
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200 p-6">
                  <h2 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-orange-600" />
                    能力差距分析
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {getSkillGaps().map((g, i) => (
                      <div key={i} className="bg-white rounded-lg border border-orange-100 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-medium text-gray-900 text-sm">{g.gap}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityBadge(g.severity)}`}>
                            {g.severity === 'high' ? '高' : g.severity === 'medium' ? '中' : '低'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{g.suggestion}</p>
                        {g.estimated_hours && (
                          <p className="text-xs text-gray-400 mt-1">预计学习 {g.estimated_hours} 小时</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archetypes */}
              {getArchetypes().length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-6">
                  <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                    <Target size={18} className="text-purple-600" />
                    推荐岗位原型
                  </h2>
                  <div className="space-y-3">
                    {getArchetypes().map((a, i) => (
                      <div key={i} className="bg-white rounded-lg border border-purple-100 p-4 flex items-start gap-4">
                        <span className="w-10 h-10 rounded-lg bg-purple-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                          {a.fit_score}
                        </span>
                        <div>
                          <h4 className="font-medium text-gray-900">{a.archetype}</h4>
                          <p className="text-sm text-gray-500 mt-0.5">{a.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Tab: 转型路径 */}
          {activeTab === 'paths' && isNewFormat && result.all_paths && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target size={18} className="text-indigo-500" />
                所有可选路径（按匹配度排序）
              </h2>
              <div className="space-y-3">
                {result.all_paths.map((p, i) => (
                  <div key={i} className={cn(
                    'rounded-lg border p-4',
                    i === 0 ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {i === 0 && <CheckCircle2 size={16} className="text-indigo-600" />}
                        <span className="font-medium text-gray-900">{p.to}</span>
                        <span className="text-xs text-gray-500">{p.to_industry}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-indigo-600 font-medium">
                          匹配度 {Math.round(p.adjusted_score * 100)}%
                        </span>
                        {p.adjustments && (
                          <span className="text-xs text-gray-400">
                            (基础 {Math.round(p.overlap_score * 100)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    {p.adjustments && (
                      <div className="flex gap-2 mb-2">
                        {p.adjustments.industry_preference > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-600">行业偏好 +{Math.round(p.adjustments.industry_preference * 100)}%</span>
                        )}
                        {p.adjustments.risk_tolerance < 0 && (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-600">风险调整 {Math.round(p.adjustments.risk_tolerance * 100)}%</span>
                        )}
                      </div>
                    )}
                    {p.archetypes && p.archetypes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.archetypes.map((a, j) => (
                          <span key={j} className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-200">
                            {a.archetype} ({a.fit_score})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: 时间线 */}
          {activeTab === 'timeline' && isNewFormat && result.timeline && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock size={18} className="text-indigo-500" />
                学习时间线
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: '总学习时长', value: `${result.timeline.total_hours}小时`, icon: <Clock size={16} /> },
                  { label: '预计周数', value: `${result.timeline.estimated_weeks}周`, icon: <Target size={16} /> },
                  { label: '风险策略', value: result.timeline.risk_strategy, icon: <Shield size={16} /> },
                  { label: '学习节奏', value: result.timeline.learning_pace_label, icon: <TrendingUp size={16} /> },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="flex justify-center text-gray-400 mb-1">{item.icon}</div>
                    <div className="text-sm text-gray-500">{item.label}</div>
                    <div className="text-lg font-semibold text-gray-900">{item.value}</div>
                  </div>
                ))}
              </div>
              <p className={`text-sm mb-4 ${result.timeline.timeline_feasible ? 'text-green-600' : 'text-amber-600'}`}>
                {result.timeline.message}
              </p>
              {result.timeline.phases && result.timeline.phases.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">分阶段计划</h3>
                  {result.timeline.phases.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {p.phase}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">{p.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${severityBadge(p.severity)}`}>
                            {p.severity === 'high' ? '高优' : p.severity === 'medium' ? '中' : '低'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{p.suggestion}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{p.hours}小时 · {p.weeks}周</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: AI建议 */}
          {activeTab === 'ai' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              {result.ai_personalization ? (
                <div className="space-y-6">
                  {/* Strategy */}
                  {result.ai_personalization.personalized_strategy && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Brain size={18} className="text-purple-500" />
                        个性化转型策略
                      </h2>
                      <div className="bg-purple-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
                        {result.ai_personalization.personalized_strategy}
                      </div>
                    </div>
                  )}

                  {/* Quick Wins */}
                  {result.ai_personalization.quick_wins && result.ai_personalization.quick_wins.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Lightbulb size={16} className="text-amber-500" />
                        本周可开始的行动
                      </h3>
                      <div className="space-y-2">
                        {result.ai_personalization.quick_wins.map((w, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 rounded-lg">
                            <CheckCircle2 size={14} className="text-amber-500 mt-0.5 shrink-0" />
                            <span className="text-sm text-gray-700">{w}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Milestones */}
                  {result.ai_personalization.milestones && result.ai_personalization.milestones.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Target size={16} className="text-indigo-500" />
                        阶段里程碑
                      </h3>
                      <div className="space-y-3">
                        {result.ai_personalization.milestones.map((m, i) => (
                          <div key={i} className="border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900 text-sm">阶段{m.phase}: {m.name}</span>
                              <span className="text-xs text-gray-500">{m.duration}</span>
                            </div>
                            <div className="space-y-1">
                              {m.actions.map((a, j) => (
                                <div key={j} className="flex items-start gap-1.5 text-xs text-gray-600">
                                  <ChevronRight size={12} className="mt-0.5 shrink-0 text-gray-400" />
                                  {a}
                                </div>
                              ))}
                            </div>
                            {m.checkpoint && (
                              <p className="text-xs text-indigo-600 mt-2 font-medium">
                                验收标准: {m.checkpoint}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Risk Mitigation */}
                  {result.ai_personalization.risk_mitigation && result.ai_personalization.risk_mitigation.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Shield size={16} className="text-red-500" />
                        风险预案
                      </h3>
                      <div className="space-y-2">
                        {result.ai_personalization.risk_mitigation.map((r, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg">
                            <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-sm font-medium text-gray-900">{r.risk}</span>
                              <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${severityBadge(r.likelihood)}`}>
                                {r.likelihood === 'high' ? '高' : r.likelihood === 'medium' ? '中' : '低'}
                              </span>
                              <p className="text-xs text-gray-600 mt-0.5">{r.mitigation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resources */}
                  {result.ai_personalization.resources && result.ai_personalization.resources.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-500" />
                        推荐学习资源
                      </h3>
                      <div className="space-y-2">
                        {result.ai_personalization.resources.map((r, i) => (
                          <div key={i} className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                            <BookOpen size={14} className="text-blue-500 mt-0.5 shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{r.name}</span>
                                <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-600">{r.type}</span>
                                <span className={`px-1.5 py-0.5 rounded text-xs ${r.priority === 'high' ? 'bg-red-100 text-red-600' : r.priority === 'medium' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                                  {r.priority === 'high' ? '高优' : r.priority === 'medium' ? '中' : '低'}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 mt-0.5">{r.why}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Alternative Paths */}
                  {result.ai_personalization.alternative_paths && result.ai_personalization.alternative_paths.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Target size={16} className="text-gray-500" />
                        备选路径
                      </h3>
                      <div className="space-y-2">
                        {result.ai_personalization.alternative_paths.map((p, i) => (
                          <div key={i} className="border border-gray-200 rounded-lg p-3">
                            <span className="font-medium text-gray-900 text-sm">{p.path}</span>
                            <p className="text-xs text-gray-500 mt-0.5">适用场景: {p.when_to_consider}</p>
                            <p className="text-xs text-gray-400 mt-0.5">权衡: {p.trade_off}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Brain size={40} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">点击「AI个性化分析」获取更多建议</p>
                  <p className="text-xs mt-1">AI将根据你的风险偏好、学习节奏和目标时间线生成个性化方案</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                const keywords = getArchetypes().map(a => a.archetype).join(',')
                navigate(`/search?keywords=${encodeURIComponent(keywords)}`)
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              <Search size={16} />
              搜索匹配岗位
            </button>
            <button
              onClick={() => navigate('/resume')}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <FileText size={16} />
              优化转型简历
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}