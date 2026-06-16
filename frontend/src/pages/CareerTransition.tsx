import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, Zap, ArrowRight, Target, AlertTriangle, TrendingUp, Search, FileText,
  ChevronDown, Briefcase, Building2,
} from 'lucide-react'
import client from '../api/client'

interface Skill {
  skill: string
  level: string
  reason: string
}

interface SkillGap {
  gap: string
  severity: 'high' | 'medium' | 'low'
  suggestion: string
}

interface Archetype {
  archetype: string
  fit_score: number
  reason: string
}

interface TransitionResult {
  matched: boolean
  message?: string
  from_industry?: string
  from_role?: string
  to_industry?: string
  to_role?: string
  transferable_skills: Skill[]
  skill_gaps: SkillGap[]
  recommended_archetypes: Archetype[]
  data_source: string
}

const PRESETS = [
  { label: '建筑设计师 → AI产品经理', industry: '建筑设计', role: '建筑设计师', targetIndustry: 'AI/互联网', targetRole: 'AI产品经理' },
  { label: '会计师 → 产品经理', industry: '财务/会计', role: '会计师', targetIndustry: '互联网', targetRole: '产品经理' },
  { label: '教师 → 运营经理', industry: '教育培训', role: '教师/培训师', targetIndustry: '互联网', targetRole: '运营经理' },
]

const INDUSTRY_OPTIONS = [
  '建筑设计', '城市规划', '房地产', '工程施工',
  'AI/互联网', '云计算/SaaS', '大数据', '物联网',
  '教育培训', '财务/会计', '金融/银行', '医疗健康',
  '电商/零售', '制造业', '媒体/广告', '咨询服务',
  '政府/公共事业', '物流/供应链', '能源/环保', '其他',
]

const ROLE_OPTIONS = [
  '建筑设计师', '结构工程师', '项目经理', 'BIM经理',
  '产品经理', 'AI产品经理', '技术产品经理', '产品总监',
  '后端开发', '前端开发', '全栈开发', 'AI工程师',
  '数据分析师', 'AI训练师', '运营经理', '市场经理',
  '销售总监', '人力资源', '行政经理', '总经理助理',
  'UX设计师', '解决方案架构师', '数字化转型顾问', '其他',
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
      {open && filtered.length > 0 && (
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
  const [result, setResult] = useState<TransitionResult | null>(null)
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
    if (!currentIndustry.trim() || !currentRole.trim()) {
      setError('请填写当前行业和职位')
      return
    }
    if (!targetIndustry.trim() || !targetRole.trim()) {
      setError('请填写目标行业和职位')
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
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch {
      setError('分析失败，请稍后重试')
    } finally {
      setAnalyzing(false)
    }
  }

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

        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {analyzing && <Loader2 size={16} className="animate-spin" />}
          {analyzing ? '分析中...' : '开始分析'}
        </button>
      </div>

      {result && (
        <div ref={resultRef} className="space-y-6">
          {!result.matched && result.message && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              {result.message}
            </div>
          )}

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
            <h2 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-600" />
              可迁移能力
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.transferable_skills.map((s, i) => (
                <div key={i} className="bg-white rounded-lg border border-green-100 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-gray-900 text-sm">{s.skill}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelBadge(s.level)}`}>
                      {s.level}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{s.reason}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200 p-6">
            <h2 className="text-lg font-semibold text-orange-900 mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-orange-600" />
              能力差距分析
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.skill_gaps.map((g, i) => (
                <div key={i} className="bg-white rounded-lg border border-orange-100 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-gray-900 text-sm">{g.gap}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityBadge(g.severity)}`}>
                      {g.severity === 'high' ? '高' : g.severity === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{g.suggestion}</p>
                </div>
              ))}
            </div>
          </div>

          {result.recommended_archetypes.length > 0 && (
            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl border border-purple-200 p-6">
              <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                <Target size={18} className="text-purple-600" />
                推荐岗位原型
              </h2>
              <div className="space-y-3">
                {result.recommended_archetypes.map((a, i) => (
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

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                const keywords = result.recommended_archetypes.map(a => a.archetype).join(',')
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