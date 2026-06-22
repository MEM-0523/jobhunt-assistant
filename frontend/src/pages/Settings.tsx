import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Check, X, ChevronLeft, ChevronRight, Save, AlertCircle, Download, Upload } from 'lucide-react';
import client from '../api/client';
import type { Profile } from '../types';

const STEPS = [
  { label: '基本信息', key: 'basic' },
  { label: '硬性要求', key: 'constraints' },
  { label: '软偏好', key: 'preferences' },
  { label: '能力盘点', key: 'skills' },
  { label: '转型策略', key: 'transition' },
];

interface SkillItem {
  name: string;
  level: string;
}

const PROFICIENCY_LEVELS = ['入门', '熟练', '精通', '专家'];

const SKILL_PRESETS = [
  '建筑设计', '项目管理', 'BIM', 'Revit', 'AutoCAD', 'SketchUp',
  'Python', 'AI产品设计', '数据分析', '需求分析', '跨部门协调',
  '英语沟通', '方案汇报', '用户研究', 'Figma',
];

const CITY_OPTIONS = ['杭州', '北京', '上海', '深圳', '广州', '成都', '南京', '苏州', '武汉', '西安', '其他'];

const DEAL_BREAKER_OPTIONS = [
  { value: '外包公司', label: '不接受外包公司' },
  { value: '强制加班(996)', label: '不接受强制996加班' },
  { value: '大小周', label: '不接受大小周' },
  { value: '通勤超过1小时', label: '不接受通勤>1小时' },
  { value: '其他', label: '其他不接受的条件' },
];

const COMPANY_SIZE_OPTIONS = ['不限', '初创（<50人）', '中小型（50-500人）', '中大型（500-2000人）', '大型（2000人以上）'];

const OVERTIME_OPTIONS = ['不接受加班', '偶尔加班可接受', '适度加班可接受', '不限'];

const CULTURE_OPTIONS = ['结果导向', '扁平化管理', '技术驱动', '注重工作生活平衡', '学习型组织', '人文关怀'];

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const parseResumeFields = (text: string) => {
  const fields: Record<string, string> = {};
  const nameMatch = text.match(/姓名[：:]\s*(.+)/i) || text.match(/^(.{2,4})$/m);
  if (nameMatch) fields.name = nameMatch[1].trim().substring(0, 20);
  const phoneMatch = text.match(/(1[3-9]\d{9})/);
  if (phoneMatch) fields.phone = phoneMatch[1];
  const cityMatch = text.match(/杭州|北京|上海|深圳|广州|成都|南京|苏州|武汉|西安/);
  if (cityMatch) fields.city = cityMatch[0];
  return fields;
};

export default function Settings() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isWizard = searchParams.get('wizard') === '1';
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [fetchError, setFetchError] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [otherCity, setOtherCity] = useState('');
  const [currentJobTitle, setCurrentJobTitle] = useState('');
  const [salaryMin, setSalaryMin] = useState(25);
  const [salaryMax, setSalaryMax] = useState(35);
  const [constraintCity, setConstraintCity] = useState('杭州');
  const [dealBreakers, setDealBreakers] = useState<string[]>(['大小周']);
  const [customDealBreaker, setCustomDealBreaker] = useState('');
  const [companySize, setCompanySize] = useState('中小型（50-500人）');
  const [overtimePolicy, setOvertimePolicy] = useState('偶尔加班可接受');
  const [remoteOk, setRemoteOk] = useState(false);
  const [companyCulture, setCompanyCulture] = useState<string[]>(['注重工作生活平衡']);
  const [skills, setSkills] = useState<SkillItem[]>([{ name: '', level: '熟练' }]);
  // Transition strategy
  const [riskTolerance, setRiskTolerance] = useState('medium');
  const [learningPace, setLearningPace] = useState('part-time');
  const [targetTimeline, setTargetTimeline] = useState('6months');
  const [targetIndustries, setTargetIndustries] = useState<string[]>([]);

  // Load profile on mount
  useEffect(() => {
    client.get<Profile>('/profile')
      .then(({ data }) => {
        if (data.name) setName(data.name);
        if (data.phone) setPhone(data.phone);
        if (data.city) {
          if (CITY_OPTIONS.slice(0, -1).includes(data.city)) {
            setCity(data.city);
          } else if (data.city) {
            setCity('其他');
            setOtherCity(data.city);
          }
        }
        if (data.salary_min) setSalaryMin(data.salary_min);
        if (data.salary_max) setSalaryMax(data.salary_max);
        if (data.deal_breakers?.length) setDealBreakers(data.deal_breakers);

        const prefs = data.preferences || {};
        if (typeof prefs.current_job_title === 'string') setCurrentJobTitle(prefs.current_job_title);
        if (typeof prefs.constraint_city === 'string') setConstraintCity(prefs.constraint_city);
        if (typeof prefs.company_size === 'string') setCompanySize(prefs.company_size);
        if (typeof prefs.overtime_policy === 'string') setOvertimePolicy(prefs.overtime_policy);
        if (typeof prefs.remote_ok === 'boolean') setRemoteOk(prefs.remote_ok);
        if (Array.isArray(prefs.company_culture)) setCompanyCulture(prefs.company_culture);
        if (Array.isArray(prefs.skills)) setSkills(prefs.skills as SkillItem[]);
        if (data.risk_tolerance) setRiskTolerance(data.risk_tolerance);
        if (data.learning_pace) setLearningPace(data.learning_pace);
        if (data.target_timeline) setTargetTimeline(data.target_timeline);
        if (data.target_industries?.length) setTargetIndustries(data.target_industries);
      })
      .catch(() => { /* profile not found, use defaults */ })
      .finally(() => setLoading(false));
  }, []);

  const buildPayload = (): Record<string, unknown> => {
    const preferences: Record<string, unknown> = {
      current_job_title: currentJobTitle,
      constraint_city: constraintCity,
      company_size: companySize,
      overtime_policy: overtimePolicy,
      remote_ok: remoteOk,
      company_culture: companyCulture,
      skills: skills.filter((s) => s.name.trim()),
    };

    return {
      name,
      phone,
      city: city === '其他' ? otherCity : city,
      salary_min: salaryMin,
      salary_max: salaryMax,
      deal_breakers: dealBreakers.filter((v) => v !== '其他'),
      preferences,
      risk_tolerance: riskTolerance,
      learning_pace: learningPace,
      target_timeline: targetTimeline,
      target_industries: targetIndustries,
    };
  };

  const saveCurrentStep = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      await client.put('/profile', buildPayload());
      setSuccessMsg('保存成功');
      setTimeout(() => setSuccessMsg(''), 2000);
      return true;
    } catch {
      setSuccessMsg('保存失败');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const ok = await saveCurrentStep();
    if (ok && step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleFinish = async () => {
    const ok = await saveCurrentStep();
    if (ok) {
      navigate('/dashboard');
    }
  };

  const handleResumeImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await client.post('/resumes/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const text = data.text || data.content || '';
      const parsed = parseResumeFields(text);
      let count = 0;
      if (parsed.name) { setName(parsed.name); count++; }
      if (parsed.phone) { setPhone(parsed.phone); count++; }
      if (parsed.city) {
        if (CITY_OPTIONS.slice(0, -1).includes(parsed.city)) {
          setCity(parsed.city);
        } else {
          setCity('其他');
          setOtherCity(parsed.city);
        }
        setConstraintCity(parsed.city);
        count++;
      }
      setStep(0);
      setSuccessMsg(`已从简历填充 ${count} 个字段`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setFetchError('简历解析失败，请检查文件格式');
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportFromConfig = async () => {
    setImportLoading(true);
    try {
      const { data } = await client.get('/profile/import-from-config');
      if (data.data) {
        const d = data.data;
        if (d.name) setName(d.name);
        if (d.city) {
          setCity(d.city);
          setConstraintCity(d.city);
        }
        if (d.salary_min) setSalaryMin(d.salary_min);
        if (d.salary_max) setSalaryMax(d.salary_max);
        if (d.deal_breakers && Array.isArray(d.deal_breakers)) {
          setDealBreakers(d.deal_breakers);
        }
        if (d.preferences) {
          const prefs = d.preferences;
          if (prefs.headline) setCurrentJobTitle(prefs.headline);
          if (prefs.superpowers && Array.isArray(prefs.superpowers)) {
            setSkills(
              prefs.superpowers.map((sp: string) => ({ name: sp, level: '精通' }))
            );
          }
        }
        setStep(0);
        setSuccessMsg(`已从求职系统配置导入 (来源: ${data.source})`);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch {
      setFetchError('导入失败，请检查求职系统配置是否存在');
    } finally {
      setImportLoading(false);
    }
  };

  const toggleDealBreaker = (value: string) => {
    setDealBreakers((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const toggleCulture = (value: string) => {
    setCompanyCulture((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const toggleTargetIndustry = (value: string) => {
    setTargetIndustries((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const updateSkill = (index: number, field: keyof SkillItem, value: string) => {
    const updated = [...skills];
    updated[index] = { ...updated[index], [field]: value };
    setSkills(updated);
  };

  const addSkill = () => {
    setSkills([...skills, { name: '', level: '熟练' }]);
  };

  const addPresetSkill = (name: string) => {
    if (skills.some((s) => s.name === name)) return;
    const emptyIndex = skills.findIndex((s) => !s.name.trim());
    if (emptyIndex >= 0) {
      const updated = [...skills];
      updated[emptyIndex] = { name, level: '熟练' };
      setSkills(updated);
    } else {
      setSkills([...skills, { name, level: '熟练' }]);
    }
  };

  const removeSkill = (index: number) => {
    if (skills.length <= 1) return;
    setSkills(skills.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isWizard ? '完善个人资料' : '个人设置'}
      </h1>
      {isWizard && (
        <p className="text-sm text-gray-500 -mt-4 mb-6">
          填写以下信息，帮助我们为你精准匹配职位
        </p>
      )}

      {/* Import section */}
      <div className="mb-6 flex flex-wrap gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.docx,.pdf"
          onChange={handleResumeImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
        >
          {importLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          从简历智能填充
        </button>
        <button
          onClick={handleImportFromConfig}
          disabled={importLoading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
        >
          {importLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          一键导入求职系统配置
        </button>
        {successMsg && (
          <p className="w-full mt-1 text-sm text-green-600 flex items-center gap-1">
            <Check size={14} />
            {successMsg}
          </p>
        )}
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    i < step
                      ? 'bg-green-500 text-white'
                      : i === step
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                        : 'bg-gray-200 text-gray-500'
                  )}
                >
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-xs whitespace-nowrap',
                    i <= step ? 'text-indigo-600 font-medium' : 'text-gray-400'
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    'w-12 sm:w-20 h-0.5 mx-1 mt-[-1.25rem]',
                    i < step ? 'bg-green-500' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 max-w-2xl">
        {/* Fetch Error */}
        {fetchError && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md mb-5">
            <AlertCircle size={18} />
            <span className="text-sm">{fetchError}</span>
            <button
              onClick={() => { setFetchError(''); setLoading(true); window.location.reload(); }}
              className="text-sm underline ml-auto flex-shrink-0"
            >
              重试
            </button>
          </div>
        )}

        {/* Step 0: 基本信息 */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">基本信息</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">当前城市</label>
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (e.target.value !== '其他') setOtherCity('');
                }}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                <option value="" disabled>请选择城市</option>
                {CITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {city === '其他' && (
                <input
                  type="text"
                  value={otherCity}
                  onChange={(e) => setOtherCity(e.target.value)}
                  placeholder="请输入城市名称"
                  className="mt-2 block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">当前职位</label>
              <input
                type="text"
                value={currentJobTitle}
                onChange={(e) => setCurrentJobTitle(e.target.value)}
                placeholder="例如：建筑设计师"
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Step 1: 硬性要求 */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">硬性要求</h2>
            <p className="text-sm text-gray-500 -mt-3">设定薪资、城市和不可接受的工作条件，不满足的岗位将被自动过滤</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">期望城市</label>
              <input
                type="text"
                value={constraintCity}
                onChange={(e) => setConstraintCity(e.target.value)}
                placeholder="例如：杭州"
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最低薪资期望（K）
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(Number(e.target.value))}
                  placeholder="期望最低薪资(K)"
                  className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {salaryMin < 10 && (
                  <p className="text-xs text-red-500 mt-1">最低薪资至少10K</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最高薪资期望（K）
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(Number(e.target.value))}
                  placeholder="期望最高薪资(K)"
                  className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                {salaryMin > 0 && salaryMax > 0 && salaryMax <= salaryMin && (
                  <p className="text-xs text-red-500 mt-1">最高薪资必须高于最低薪资</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">不接受的工作条件</label>
              <p className="text-xs text-gray-400 mb-2">勾选后，匹配到这些条件的岗位将被自动过滤</p>
              {dealBreakers.filter((v) => v !== '其他').length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {dealBreakers.filter((v) => v !== '其他').map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-red-50 border border-red-300 text-red-700"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => toggleDealBreaker(item)}
                        className="ml-0.5 text-red-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {DEAL_BREAKER_OPTIONS.filter((opt) => !dealBreakers.includes(opt.value) || opt.value === '其他').map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleDealBreaker(opt.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm border transition-colors',
                      dealBreakers.includes(opt.value)
                        ? 'bg-red-50 border-red-300 text-red-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {dealBreakers.includes(opt.value) && <X className="w-3 h-3 inline mr-1" />}
                    {opt.label}
                  </button>
                ))}
              </div>
              {dealBreakers.includes('其他') && (
                <div className="flex gap-2 mt-3">
                  <input
                    type="text"
                    value={customDealBreaker}
                    onChange={(e) => setCustomDealBreaker(e.target.value)}
                    placeholder="请输入自定义约束"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = customDealBreaker.trim();
                      if (trimmed && !dealBreakers.includes(trimmed)) {
                        setDealBreakers((prev) => [...prev.filter((v) => v !== '其他'), trimmed]);
                        setCustomDealBreaker('');
                      }
                    }}
                    disabled={!customDealBreaker.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    添加
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: 软偏好 */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">软性偏好</h2>
            <p className="text-sm text-gray-500 -mt-3">这些是你的偏好，不强制但会优先推荐</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">公司规模偏好</label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                {COMPANY_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">加班政策</label>
              <select
                value={overtimePolicy}
                onChange={(e) => setOvertimePolicy(e.target.value)}
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                {OVERTIME_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">企业文化偏好</label>
              <div className="flex flex-wrap gap-2">
                {CULTURE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleCulture(opt)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm border transition-colors',
                      companyCulture.includes(opt)
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {companyCulture.includes(opt) && <Check className="w-3 h-3 inline mr-1" />}
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={remoteOk}
                onChange={(e) => setRemoteOk(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">接受远程办公</span>
                <p className="text-xs text-gray-500">勾选后优先推荐支持远程岗位</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: 能力盘点 */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">能力盘点</h2>
            <p className="text-sm text-gray-500 -mt-3">填写你的核心技能和熟练度</p>

            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">常用技能参考（点击添加）：</p>
              <div className="flex flex-wrap gap-2">
                {SKILL_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => addPresetSkill(preset)}
                    className="px-3 py-1 rounded-full text-sm border border-gray-200 bg-gray-50 text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {skills.map((skill, i) => (
                <div key={i} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={skill.name}
                    onChange={(e) => updateSkill(i, 'name', e.target.value)}
                    placeholder="技能名称，例如：建筑设计"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                  <select
                    value={skill.level}
                    onChange={(e) => updateSkill(i, 'level', e.target.value)}
                    className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
                  >
                    {PROFICIENCY_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                  {skills.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSkill(i)}
                      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addSkill}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              + 添加技能
            </button>

            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
              <p className="font-medium text-gray-700 mb-1">能力等级说明：</p>
              <p>· 精通（5-10年专业经验）</p>
              <p>· 熟练（2-5年使用经验）</p>
              <p>· 了解（1年以内或基础了解）</p>
            </div>
          </div>
        )}

        {/* Step 4: 转型策略 */}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">转型策略</h2>
            <p className="text-sm text-gray-500 -mt-3">设定你的转型偏好，系统将据此个性化推荐路径</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">风险偏好</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'low', label: '稳健型', desc: '先补技能再求职' },
                  { value: 'medium', label: '平衡型', desc: '学习求职并行' },
                  { value: 'high', label: '激进型', desc: '以战代练' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRiskTolerance(opt.value)}
                    className={cn(
                      'p-3 rounded-lg border text-center transition-colors',
                      riskTolerance === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    )}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">学习节奏</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'full-time', label: '全职学习', desc: '每天6-8小时' },
                  { value: 'part-time', label: '在职学习', desc: '每天2-3小时' },
                  { value: 'intensive', label: '集中冲刺', desc: '每天10+小时' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLearningPace(opt.value)}
                    className={cn(
                      'p-3 rounded-lg border text-center transition-colors',
                      learningPace === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    )}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">目标时间线</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: '3months', label: '3个月', desc: '快速切入' },
                  { value: '6months', label: '6个月', desc: '稳步过渡' },
                  { value: '12months', label: '12个月', desc: '深度转型' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetTimeline(opt.value)}
                    className={cn(
                      'p-3 rounded-lg border text-center transition-colors',
                      targetTimeline === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    )}
                  >
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">感兴趣的目标行业</label>
              <div className="flex flex-wrap gap-2">
                {['AI/互联网', '建筑科技', '智慧城市', 'SaaS', '云计算', '金融科技', '在线教育', '企业服务', '电商', '其他'].map((ind) => (
                  <button
                    key={ind}
                    type="button"
                    onClick={() => toggleTargetIndustry(ind)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm border transition-colors',
                      targetIndustries.includes(ind)
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                  >
                    {targetIndustries.includes(ind) && <Check className="w-3 h-3 inline mr-1" />}
                    {ind}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={handlePrev}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            上一步
          </button>

          <div className="flex items-center gap-3">
            {successMsg && (
              <span className={cn(
                'text-sm',
                successMsg === '保存成功' ? 'text-green-600' : 'text-red-500'
              )}>
                {successMsg}
              </span>
            )}
            {saving && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={saving}
                className="flex items-center gap-1 px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '下一步'}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="flex items-center gap-1 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : '完成'}
                <Save className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}