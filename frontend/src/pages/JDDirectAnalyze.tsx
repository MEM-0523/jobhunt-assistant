import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Loader2, AlertCircle, Heart, Send, FileText, CheckCircle, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import client from '../api/client';
import { transitionCases } from '../data/transitionCases';
import FiveDimensionScore from '../components/FiveDimensionScore';

interface BlockAnalysis {
  prototype?: string;
  block_a?: string;
  block_b?: string;
  block_c?: string;
  block_d?: string;
  block_e?: string;
  block_f?: string;
  block_g?: string;
  overall_score: number;
  rating?: string;
  summary?: string;
  suggestions?: string[];
  // 5维度评分（新）
  experience_fit?: number;
  hard_requirements?: number;
  interest_direction?: number;
  practical_constraints?: number;
  risk_screening?: number;
  total_score?: number;
  grade?: string;
  red_flags?: string[];
  reasoning?: string;
}

const BLOCK_LABELS: Record<string, string> = {
  block_a: 'A · 角色概述',
  block_b: 'B · 技能匹配',
  block_c: 'C · 职级策略',
  block_d: 'D · 薪酬评估',
  block_e: 'E · 简历定向方案',
  block_f: 'F · 面试准备',
  block_g: 'G · 岗位真实性评估',
};

const BLOCK_ORDER = ['block_a', 'block_b', 'block_c', 'block_d', 'block_e', 'block_f', 'block_g'];

function MarkdownTableRenderer({ content }: { content: string }) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return <p className="text-gray-700 whitespace-pre-wrap text-sm">{content}</p>;

  const headerLine = lines[0];
  const headerCells = headerLine.split('|').map((c) => c.trim()).filter(Boolean);
  const dataRows = lines.slice(2).filter((l) => l.startsWith('|'));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-200">
            {headerCells.map((cell, i) => (
              <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 bg-gray-50 first:rounded-tl-lg last:rounded-tr-lg">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => {
            const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
            return (
              <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50/50">
                {cells.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-gray-700">{cell}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BlockSection({ label, content }: { label: string; content: string }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
        <span className="text-xs text-gray-400">{expanded ? '收起' : '展开'}</span>
      </button>
      {expanded && (
        <div className="p-4 bg-white">
          {content.includes('|') && content.includes('---') ? (
            <MarkdownTableRenderer content={content} />
          ) : (
            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function JDDirectAnalyze() {
  const navigate = useNavigate();
  const [jdText, setJdText] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [analysis, setAnalysis] = useState<BlockAnalysis | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [caseExpanded, setCaseExpanded] = useState(false);

  const handleAnalyze = async () => {
    if (!jdText.trim()) {
      setError('请粘贴岗位描述文本');
      return;
    }
    setError('');
    setLoading(true);
    setAnalysis(null);

    try {
      const { data } = await client.post('/jobs/direct-analyze', {
        jd_text: jdText.trim(),
        company: company.trim(),
        title: title.trim(),
      });
      setAnalysis(data);
    } catch {
      setError('分析失败，请检查网络后重试');
    } finally {
      setLoading(false);
    }
  };

  const extractJobInfo = () => {
    const jdTitle = title.trim() || '未命名岗位';
    let jdCompany = company.trim();

    if (analysis?.block_a) {
      const companyMatch = analysis.block_a.match(/公司\s*[|：:]\s*(.+)/i);
      if (companyMatch) {
        const parsed = companyMatch[1].trim();
        if (parsed && parsed !== '未知' && parsed !== '待分析') {
          jdCompany = jdCompany || parsed;
        }
      }
    }

    if (!jdCompany && jdText.trim()) {
      const jdCompanyMatch = jdText.match(/公司名称[：:]\s*(.+)/i);
      if (jdCompanyMatch) {
        jdCompany = jdCompanyMatch[1].trim();
      }
    }

    return {
      title: jdTitle,
      company: jdCompany,
      jd_text: jdText.trim(),
    };
  };

  const handleSaveAndFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    setActionLoading('save');
    setError('');
    setSuccessMsg('');
    try {
      const jobInfo = extractJobInfo();
      const { data: saveData } = await client.post('/jobs/save-from-analysis', jobInfo);
      await client.post(`/jobs/${saveData.id}/favorite`);
      setSuccessMsg(saveData.duplicate ? '岗位已存在，已加入收藏' : '已收藏岗位');
    } catch (err: any) {
      setError(err.response?.data?.detail || '收藏失败，请重试');
    } finally {
      setActionLoading('');
    }
  };

  const handleTrackApplication = async (e: React.MouseEvent) => {
    e.preventDefault();
    setActionLoading('track');
    setError('');
    setSuccessMsg('');
    try {
      const jobInfo = extractJobInfo();
      const { data: saveData } = await client.post('/jobs/save-from-analysis', jobInfo);
      navigate(`/dashboard?job_id=${saveData.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || '保存失败，请重试');
      setActionLoading('');
    }
  };

  const handleOptimizeResume = async (e: React.MouseEvent) => {
    e.preventDefault();
    setActionLoading('resume');
    setError('');
    setSuccessMsg('');
    try {
      const jobInfo = extractJobInfo();
      const { data: saveData } = await client.post('/jobs/save-from-analysis', jobInfo);
      navigate(`/resume?job_id=${saveData.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || '保存失败，请重试');
      setActionLoading('');
    }
  };

  const handlePasteSample = () => {
    setJdText(`【岗位职责】
1. 负责AI产品线（智能对话、AI Agent、AI搜索等）的整体规划和设计
2. 深入理解用户场景，挖掘AI技术在产品中的创新应用机会
3. 制定产品路线图，平衡短期需求和长期战略
4. 主导产品关键里程碑的推进，协调多方资源确保按时交付

【任职要求】
1. 本科及以上学历，3年以上产品经验，有AI/智能化产品经验优先
2. 对LLM、多模态AI有理解，能判断技术可行性
3. 优秀的逻辑思维和抽象能力，能设计复杂产品系统`);
    setCompany('某AI创业公司');
    setTitle('AI产品经理');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Zap size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">JD直推分析</h1>
          <p className="text-sm text-gray-500">粘贴岗位描述，7-Block深度评估岗位匹配度</p>
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">公司名称（选填）</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="如：某AI创业公司"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">岗位名称（选填）</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：AI产品经理"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">岗位描述（从招聘网站复制粘贴）</label>
            <button
              onClick={handlePasteSample}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              填入示例JD
            </button>
          </div>
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="将从BOSS直聘/猎聘等平台看到的JD文本完整粘贴到这里..."
            rows={10}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y font-mono"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading || !jdText.trim()}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              7-Block深度分析中...
            </>
          ) : (
            <>
              <Zap size={16} />
              开始7-Block分析
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Score Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">分析结果</h2>
                {analysis.prototype && (
                  <p className="text-sm text-gray-500 mt-0.5">检测原型：{analysis.prototype}</p>
                )}
              </div>
            </div>

            {/* 5维度评分卡 */}
            <FiveDimensionScore data={analysis} />

            {analysis.summary && (
              <p className="text-gray-700 text-sm leading-relaxed bg-indigo-50 rounded-lg px-4 py-3 mt-4">
                {analysis.summary}
              </p>
            )}
          </div>

          {/* 7 Blocks */}
          <div className="space-y-3">
            {BLOCK_ORDER.map((key) => {
              const content = (analysis as any)[key];
              if (!content || typeof content !== 'string') return null;
              return (
                <BlockSection
                  key={key}
                  label={BLOCK_LABELS[key] || key}
                  content={content}
                />
              );
            })}
          </div>

          {/* Suggestions */}
          {analysis.suggestions && analysis.suggestions.length > 0 && (
            <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-3">行动建议</h3>
              <ul className="space-y-2">
                {analysis.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                    <span className="mt-0.5 text-amber-500 font-bold">{i + 1}.</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transition Cases Reference */}
          {transitionCases.length > 0 && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setCaseExpanded(!caseExpanded)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-100 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb size={16} className="text-blue-500" />
                  <span className="text-sm font-semibold text-gray-800">转型案例参考</span>
                  <span className="text-xs text-gray-400">({transitionCases.length}个案例)</span>
                </div>
                {caseExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>
              {caseExpanded && (
                <div className="px-5 pb-4 space-y-4">
                  {transitionCases.map((c) => (
                    <div key={c.id} className="border-l-4 border-blue-400 pl-4">
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">{c.title}</h4>
                      <p className="text-xs text-gray-500 mb-2">{c.from} → {c.to}</p>
                      <p className="text-xs text-gray-400 mb-2">{c.city} · {c.salary_range} · {c.transition_timeline}</p>
                      <ul className="space-y-1">
                        {c.key_learnings.map((item, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                            <span className="text-blue-400 mt-0.5">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-3 rounded-xl border border-green-200">
              <CheckCircle size={16} />
              {successMsg}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleSaveAndFavorite}
                disabled={!!actionLoading}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'save' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Heart size={16} />
                )}
                收藏此岗位
              </button>
              <button
                onClick={handleTrackApplication}
                disabled={!!actionLoading}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'track' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                记录投递
              </button>
              <button
                onClick={handleOptimizeResume}
                disabled={!!actionLoading}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'resume' ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileText size={16} />
                )}
                优化简历
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}