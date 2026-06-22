import { useState, useEffect } from 'react';
import {
  Sparkles, Loader2, AlertCircle, Trash2, Award, ArrowDown,
  CheckCircle2, AlertTriangle, Target, Zap,
} from 'lucide-react';
import client from '../api/client';
import type { Strength } from '../types';

const CLASSIFICATION_MAP: Record<string, { label: string; color: string }> = {
  fact: { label: '事实', color: 'bg-green-100 text-green-700' },
  assumption: { label: '假设', color: 'bg-amber-100 text-amber-700' },
  inference: { label: '推断', color: 'bg-blue-100 text-blue-700' },
};

const CONFIDENCE_MAP: Record<string, { label: string; color: string; dot: string }> = {
  high: { label: '高置信度', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  medium: { label: '中置信度', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  low: { label: '低置信度', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

export default function StrengthAnalysis() {
  const [strengths, setStrengths] = useState<Strength[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [experienceCount, setExperienceCount] = useState<number>(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadStrengths = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await client.get('/strengths');
      setStrengths(Array.isArray(data) ? data : []);
    } catch {
      setError('加载优势列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadExperienceCount = async () => {
    try {
      const { data } = await client.get('/experiences');
      setExperienceCount(Array.isArray(data) ? data.length : 0);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadStrengths();
    loadExperienceCount();
  }, []);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      const { data } = await client.post('/strengths/generate');
      const newStrengths = Array.isArray(data) ? data : [];
      setStrengths(newStrengths);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || '生成优势分析失败，请重试'
          : '生成优势分析失败，请重试';
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条优势吗？')) return;
    try {
      setDeletingId(id);
      await client.delete(`/strengths/${id}`);
      setStrengths((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError('删除失败，请重试');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">优势分析</h1>
        <button
          onClick={handleGenerate}
          disabled={generating || experienceCount === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? 'AI生成中...' : 'AI生成优势分析'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Empty experience warning */}
      {experienceCount === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-2 text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">请先在经历资产库中录入经历</p>
            <p className="text-amber-700 mt-0.5">优势分析需要基于你的经历资产来生成</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Loader2 size={28} className="animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-gray-500 text-sm">加载中...</p>
        </div>
      ) : generating ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="relative inline-block mb-4">
            <Sparkles size={40} className="text-indigo-600 animate-pulse" />
          </div>
          <p className="text-gray-700 font-medium mb-1">AI正在分析你的经历资产</p>
          <p className="text-sm text-gray-400">提取证据链、识别能力、匹配岗位信号...</p>
        </div>
      ) : strengths.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Award size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-1">暂无优势分析</p>
          <p className="text-sm text-gray-400">
            {experienceCount > 0
              ? '点击"AI生成优势分析"，基于你的经历资产生成证据链'
              : '请先在经历资产库中录入经历'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {strengths.map((s) => {
            const cls = CLASSIFICATION_MAP[s.classification] || CLASSIFICATION_MAP.fact;
            const conf = CONFIDENCE_MAP[s.confidence] || CONFIDENCE_MAP.medium;
            return (
              <div key={s.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Card header */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls.color}`}>
                          {cls.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${conf.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                          {conf.label}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">{s.name}</h3>
                    </div>
                    <button
                      onClick={() => handleDelete(s.id)}
                      disabled={deletingId === s.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
                      aria-label="删除"
                    >
                      {deletingId === s.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>

                  {/* Evidence Chain */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">证据链</p>
                    <div className="space-y-0">
                      <ChainStep
                        icon={<CheckCircle2 size={14} className="text-green-600" />}
                        label="证据"
                        value={s.evidence}
                        color="border-green-300 bg-green-50"
                      />
                      <ChainConnector />
                      <ChainStep
                        icon={<Zap size={14} className="text-amber-500" />}
                        label="行为"
                        value={s.behavior}
                        color="border-amber-300 bg-amber-50"
                      />
                      <ChainConnector />
                      <ChainStep
                        icon={<Award size={14} className="text-indigo-500" />}
                        label="能力"
                        value={s.ability}
                        color="border-indigo-300 bg-indigo-50"
                      />
                      <ChainConnector />
                      <ChainStep
                        icon={<Target size={14} className="text-purple-500" />}
                        label="岗位信号"
                        value={s.job_signal}
                        color="border-purple-300 bg-purple-50"
                      />
                    </div>
                  </div>

                  {/* Missing proof */}
                  {s.missing_proof && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-800 mb-0.5">缺失证据</p>
                        <p className="text-sm text-amber-700">{s.missing_proof}</p>
                      </div>
                    </div>
                  )}

                  {/* Next action */}
                  {s.next_action && (
                    <div className="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-start gap-2">
                      <Target size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-indigo-800 mb-0.5">补证行动</p>
                        <p className="text-sm text-indigo-700">{s.next_action}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChainStep({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`border-l-2 ${color} pl-3 py-2 rounded-r-md`}>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon}
        <span className="text-xs font-semibold text-gray-600">{label}</span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{value || '—'}</p>
    </div>
  );
}

function ChainConnector() {
  return (
    <div className="flex justify-start pl-3 py-0.5">
      <ArrowDown size={14} className="text-gray-300" />
    </div>
  );
}
