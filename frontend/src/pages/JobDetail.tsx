import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Building2,
  Briefcase,
  ExternalLink,
  Calendar,
  Loader2,
  Send,
  X,
  Heart,
  Sparkles,
} from 'lucide-react';
import client from '../api/client';
import type { Job } from '../types';
import FiveDimensionScore from '../components/FiveDimensionScore';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: '新职位', color: 'bg-blue-100 text-blue-700' },
  applied: { label: '已投递', color: 'bg-yellow-100 text-yellow-700' },
  interview: { label: '面试中', color: 'bg-purple-100 text-purple-700' },
  offer: { label: '已获Offer', color: 'bg-green-100 text-green-700' },
  rejected: { label: '不合适', color: 'bg-red-100 text-red-700' },
  saved: { label: '已收藏', color: 'bg-gray-100 text-gray-700' },
};

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 记录投递 modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyStatus, setApplyStatus] = useState('已投递');
  const [applyDate, setApplyDate] = useState(new Date().toISOString().slice(0, 10));
  const [applyNotes, setApplyNotes] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);

  const [favorited, setFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        const { data } = await client.get(`/jobs/${id}`);
        if (data.error) {
          setError('职位不存在或无权访问');
        } else {
          setJob(data);
          setFavorited(!!data.favorited_at);
        }
      } catch {
        setError('加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [id]);

  const handleApply = async () => {
    if (!job) return;
    try {
      setApplyLoading(true);
      await client.post('/applications', {
        job_id: job.id,
        status: applyStatus,
        applied_at: applyDate ? `${applyDate}T00:00:00` : null,
        notes: applyNotes,
      });
      setShowApplyModal(false);
      navigate('/applications');
    } catch {
      alert('操作失败，请重试');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!job) return;
    try {
      setFavLoading(true);
      const { data } = await client.post(`/jobs/${job.id}/favorite`);
      setFavorited(data.favorited);
    } catch {
      // silently fail
    } finally {
      setFavLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!job) return;
    setAnalyzeLoading(true);
    setAnalysis(null);
    try {
      const { data } = await client.get(`/jobs/${job.id}/analyze`);
      setAnalysis(data);
    } catch {
      setAnalysis({ error: true, summary: '分析失败，请稍后重试' });
    } finally {
      setAnalyzeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft size={18} />
          返回
        </button>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">{error || '职位不存在'}</p>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[job.status] || STATUS_MAP.new;

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={18} />
        返回
      </button>

      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={24} className="text-indigo-500" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">{job.title}</h1>
              <p className="text-lg text-gray-600">{job.company}</p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Briefcase size={16} />
              <span className="text-indigo-600 font-semibold text-base">{job.salary}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={16} />
              {job.city}
            </span>
            {job.platform && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                job.platform === 'BOSS直聘'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {job.platform}
              </span>
            )}
            {job.created_at && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} />
                {new Date(job.created_at).toLocaleDateString('zh-CN')}
              </span>
            )}
          </div>
        </div>

        {/* 职位描述 */}
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">职位描述</h2>
          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
            {job.jd_text}
          </div>
        </div>

        {/* AI 7-Block 分析 */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">AI 7-Block 分析</h2>
            <button
              onClick={handleAnalyze}
              disabled={analyzeLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              {analyzeLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {analyzeLoading ? '分析中...' : 'AI智能分析'}
            </button>
          </div>

          {analysis && !analysis.error && (
            <div className="space-y-3">
              {/* 5维度评分卡 + 总分 + 分级 */}
              <FiveDimensionScore data={analysis} />

              {analysis.prototype && (
                <p className="text-xs text-gray-500">检测原型：{analysis.prototype}</p>
              )}

              {analysis.summary && (
                <p className="text-sm text-gray-700 bg-white px-3 py-2 rounded border border-gray-100">{analysis.summary}</p>
              )}

              {/* 7 Blocks */}
              {(['block_a','block_b','block_c','block_d','block_e','block_f','block_g'] as const).map((key) => {
                const content = analysis[key];
                if (!content || typeof content !== 'string') return null;
                const labels: Record<string, string> = {
                  block_a: 'A · 角色概述', block_b: 'B · 技能匹配', block_c: 'C · 职级策略',
                  block_d: 'D · 薪酬评估', block_e: 'E · 简历定向方案', block_f: 'F · 面试准备',
                  block_g: 'G · 岗位真实性',
                };
                return (
                  <details key={key} className="border border-gray-200 rounded-lg" open>
                    <summary className="px-4 py-2.5 bg-gray-50 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
                      {labels[key] || key}
                    </summary>
                    <div className="p-4 bg-white text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {content}
                    </div>
                  </details>
                );
              })}

              {/* Suggestions */}
              {analysis.suggestions && analysis.suggestions.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-amber-800 mb-2">行动建议</h4>
                  <ul className="space-y-1.5">
                    {analysis.suggestions.map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                        <span className="text-amber-500 font-bold mt-0.5">{i + 1}.</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {analysis?.error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded">{analysis.summary}</p>
          )}

          {!analysis && !analyzeLoading && (
            <p className="text-sm text-gray-400">点击"AI智能分析"按钮，获取7-Block深度岗位评估</p>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 flex flex-wrap gap-3">
          <button
            onClick={() => {
              setApplyStatus('已投递');
              setApplyDate(new Date().toISOString().slice(0, 10));
              setApplyNotes('');
              setShowApplyModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Send size={16} />
            记录投递
          </button>
          <button
            onClick={handleToggleFavorite}
            disabled={favLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              favorited
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Heart
              size={16}
              className={favorited ? 'fill-red-500 text-red-500' : 'text-gray-400'}
            />
            {favLoading ? '...' : favorited ? '已收藏' : '收藏此岗位'}
          </button>
          {job.jd_url && job.jd_url.startsWith('http') && (
            <a
              href={job.jd_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              <ExternalLink size={16} />
              查看原始职位
            </a>
          )}
        </div>
      </div>

      {/* 记录投递 Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">记录投递</h2>
              <button
                onClick={() => setShowApplyModal(false)}
                className="text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                aria-label="关闭"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">岗位</label>
                <input
                  type="text"
                  value={`${job.company} - ${job.title}`}
                  disabled
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">当前状态</label>
                <select
                  value={applyStatus}
                  onChange={(e) => setApplyStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="待投递">待投递</option>
                  <option value="已投递">已投递</option>
                  <option value="初筛通过">初筛通过</option>
                  <option value="初筛拒绝">初筛拒绝</option>
                  <option value="面试邀约">面试邀约</option>
                  <option value="面试中">面试中</option>
                  <option value="面试通过">面试通过</option>
                  <option value="面试拒绝">面试拒绝</option>
                  <option value="offer">Offer</option>
                  <option value="接受">接受</option>
                  <option value="拒绝">拒绝</option>
                  <option value="无回应">无回应</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">投递时间</label>
                <input
                  type="date"
                  value={applyDate}
                  onChange={(e) => setApplyDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={applyNotes}
                  onChange={(e) => setApplyNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="添加备注信息..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowApplyModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                取消
              </button>
              <button
                onClick={handleApply}
                disabled={applyLoading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {applyLoading && <Loader2 size={16} className="animate-spin" />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}