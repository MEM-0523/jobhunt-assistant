import { useState, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  AlertCircle,
  MapPin,
  Building2,
  Calendar,
  ChevronDown,
  Clock,
  Trash2,
  MessageSquare,
  ExternalLink,
  Filter,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  BarChart3,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import client from '../api/client';
import type { Application } from '../types';

const STATUS_FLOW: Record<string, string[]> = {
  '待投递': ['已投递'],
  '已投递': ['初筛通过', '初筛拒绝', '面试邀约', '无回应'],
  '初筛通过': ['面试邀约'],
  '初筛拒绝': [],
  '面试邀约': ['面试中', '无回应'],
  '无回应': [],
  '面试中': ['面试通过', '面试拒绝'],
  '面试通过': ['offer'],
  '面试拒绝': [],
  'offer': ['接受', '拒绝'],
  '接受': [],
  '拒绝': [],
};

const FILTER_TABS = [
  { key: '', label: '全部', icon: Filter },
  { key: '待投递', label: '待投递', icon: Clock },
  { key: '已投递', label: '已投递', icon: Send },
  { key: '面试中', label: '面试中', icon: Eye },
  { key: 'Offer', label: 'Offer', icon: TrendingUp },
  { key: '已拒绝', label: '已拒绝', icon: XCircle },
];

const STATUS_LABELS: Record<string, { color: string; icon: ReactNode }> = {
  '待投递': { color: 'bg-gray-100 text-gray-700', icon: <Clock size={12} /> },
  '已投递': { color: 'bg-blue-100 text-blue-700', icon: <Send size={12} /> },
  '初筛通过': { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={12} /> },
  '初筛拒绝': { color: 'bg-red-100 text-red-700', icon: <XCircle size={12} /> },
  '面试邀约': { color: 'bg-yellow-100 text-yellow-700', icon: <Calendar size={12} /> },
  '无回应': { color: 'bg-gray-100 text-gray-500', icon: <Clock size={12} /> },
  '面试中': { color: 'bg-yellow-100 text-yellow-700', icon: <Eye size={12} /> },
  '面试通过': { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={12} /> },
  '面试拒绝': { color: 'bg-red-100 text-red-700', icon: <XCircle size={12} /> },
  'offer': { color: 'bg-purple-100 text-purple-700', icon: <TrendingUp size={12} /> },
  '接受': { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={12} /> },
  '拒绝': { color: 'bg-red-100 text-red-700', icon: <XCircle size={12} /> },
};

export default function Applications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [allApps, setAllApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesText, setNotesText] = useState('');
  const [savingStatus, setSavingStatus] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchAllApps = async () => {
    try {
      const { data } = await client.get('/applications');
      setAllApps(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  };

  const fetchApps = async () => {
    try {
      setLoading(true);
      setError('');
      const params = activeTab ? { status: activeTab } : {};
      const { data } = await client.get('/applications', { params });
      setApps(Array.isArray(data) ? data : []);
    } catch {
      setError('加载投递记录失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllApps();
    fetchApps();
  }, [activeTab]);

  const handleStatusChange = async (appId: number, newStatus: string) => {
    try {
      setSavingStatus(appId);
      await client.put(`/applications/${appId}`, { status: newStatus });
      fetchApps();
    } catch {
      setError('更新状态失败');
    } finally {
      setSavingStatus(null);
    }
  };

  const handleSaveNotes = async (appId: number) => {
    try {
      await client.put(`/applications/${appId}`, { notes: notesText });
      setEditingNotes(null);
      fetchApps();
    } catch {
      setError('保存备注失败');
    }
  };

  const handleDelete = async (appId: number) => {
    if (!confirm('确定删除这条投递记录？')) return;
    try {
      setDeleting(appId);
      await client.delete(`/applications/${appId}`);
      fetchApps();
    } catch {
      setError('删除失败');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const RESUME_PASSED_STATUSES = ['初筛通过', '面试邀约', '面试中', '面试通过', '面试拒绝', 'offer', '接受', '拒绝'];
  const INTERVIEW_STATUSES = ['面试邀约', '面试中', '面试通过', '面试拒绝'];
  const OFFER_STATUSES = ['offer', '接受'];

  const funnel = {
    total: allApps.length,
    resumePassed: allApps.filter((a) => RESUME_PASSED_STATUSES.includes(a.status)).length,
    interview: allApps.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length,
    offer: allApps.filter((a) => OFFER_STATUSES.includes(a.status)).length,
  };

  const resumePassRate = funnel.total > 0 ? Math.round((funnel.resumePassed / funnel.total) * 100) : 0;
  const interviewRate = funnel.resumePassed > 0 ? Math.round((funnel.interview / funnel.resumePassed) * 100) : 0;
  const offerRate = funnel.interview > 0 ? Math.round((funnel.offer / funnel.interview) * 100) : 0;

  const diagnosis = (() => {
    if (funnel.total < 10) return null;
    if (funnel.offer > 0) return { type: 'offer' as const };
    if (interviewRate < 30 && funnel.resumePassed > 0) return { type: 'interview' as const };
    if (resumePassRate < 20) return { type: 'resume' as const };
    return { type: 'normal' as const };
  })();

  const DIAGNOSIS_CONFIG: Record<string, { bg: string; text: string; icon: ReactNode; actionLabel: string; actionTo: string }> = {
    resume: { bg: 'bg-yellow-50 border-yellow-300', text: '简历通过率偏低，建议优化简历', icon: <AlertTriangle size={18} className="text-yellow-600" />, actionLabel: '优化简历', actionTo: '/resume' },
    interview: { bg: 'bg-orange-50 border-orange-300', text: '面试转化率偏低，建议强化面试准备', icon: <AlertTriangle size={18} className="text-orange-600" />, actionLabel: '面试准备', actionTo: '/interview-prep' },
    offer: { bg: 'bg-green-50 border-green-300', text: '恭喜！已获得offer，请继续复盘', icon: <CheckCircle size={18} className="text-green-600" />, actionLabel: '复盘求职', actionTo: '/dashboard' },
    normal: { bg: 'bg-blue-50 border-blue-300', text: '当前进展正常，继续保持', icon: <BarChart3 size={18} className="text-blue-600" />, actionLabel: '查看面板', actionTo: '/dashboard' },
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">投递追踪</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
          <button onClick={fetchApps} className="ml-auto underline text-xs">重试</button>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Funnel Stats */}
      {allApps.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: '投递总数', value: funnel.total, rate: null, color: 'text-gray-700' },
            { label: '简历通过', value: funnel.resumePassed, rate: resumePassRate, color: 'text-blue-600' },
            { label: '面试', value: funnel.interview, rate: interviewRate, color: 'text-indigo-600' },
            { label: 'Offer', value: funnel.offer, rate: offerRate, color: 'text-green-600' },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-3xl font-bold mb-1" style={{ color: item.value > 0 ? undefined : '#9ca3af' }}>
                {item.value}
              </p>
              <p className="text-xs text-gray-500">{item.label}</p>
              {item.rate !== null && (
                <p className="text-xs mt-1" style={{ color: item.value > 0 ? undefined : '#9ca3af' }}>
                  {item.label}率 {item.rate}%
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottleneck Diagnosis */}
      {diagnosis && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${DIAGNOSIS_CONFIG[diagnosis.type].bg} mb-4`}>
          <div className="flex items-center gap-2">
            {DIAGNOSIS_CONFIG[diagnosis.type].icon}
            <span className="text-sm font-medium">{DIAGNOSIS_CONFIG[diagnosis.type].text}</span>
          </div>
          <Link
            to={DIAGNOSIS_CONFIG[diagnosis.type].actionTo}
            className="text-xs font-medium px-3 py-1.5 bg-white rounded-lg border border-gray-200 hover:shadow transition-shadow"
          >
            {DIAGNOSIS_CONFIG[diagnosis.type].actionLabel} →
          </Link>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
        </div>
      )}

      {/* Empty state */}
      {!loading && apps.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          {allApps.length === 0 ? (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Send size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">还没有投递记录？去找合适的岗位吧</h3>
              <Link
                to="/search"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
              >
                搜索岗位
              </Link>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <Send size={28} className="text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                暂无「{activeTab}」状态的岗位
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                在搜索页找到心仪的岗位后，点击投递即可开始追踪
              </p>
              <Link
                to="/search"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700"
              >
                去搜索岗位
              </Link>
            </>
          )}
        </div>
      )}

      {/* Application list */}
      {!loading && apps.length > 0 && (
        <div className="space-y-3">
          {apps.map((app) => {
            const statusInfo = STATUS_LABELS[app.status] || STATUS_LABELS['待投递'];
            const nextStatuses = STATUS_FLOW[app.status] || [];
            const isSaving = savingStatus === app.id;
            const isDeleting = deleting === app.id;

            return (
              <div
                key={app.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Job info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {app.job_title || app.job?.title || '未知岗位'}
                      </h3>
                      {app.job?.jd_url && (
                        <a
                          href={app.job.jd_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-indigo-500 flex-shrink-0"
                          title="查看原始职位"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Building2 size={13} />
                        {app.company || app.job?.company || '未知公司'}
                      </span>
                      {app.job?.city && (
                        <span className="flex items-center gap-1">
                          <MapPin size={13} />
                          {app.job.city}
                        </span>
                      )}
                      {app.applied_at && (
                        <span className="flex items-center gap-1">
                          <Calendar size={13} />
                          投递于 {formatDate(app.applied_at)}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {editingNotes === app.id ? (
                      <div className="flex items-start gap-2 mt-2">
                        <textarea
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                          rows={2}
                          placeholder="添加备注..."
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleSaveNotes(app.id)}
                            className="px-2.5 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingNotes(null)}
                            className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : app.notes ? (
                      <p
                        className="text-sm text-gray-600 mt-1 flex items-center gap-1 cursor-pointer hover:text-indigo-600"
                        onClick={() => { setEditingNotes(app.id); setNotesText(app.notes || ''); }}
                      >
                        <MessageSquare size={12} />
                        {app.notes}
                      </p>
                    ) : (
                      <button
                        onClick={() => { setEditingNotes(app.id); setNotesText(''); }}
                        className="text-xs text-gray-400 hover:text-indigo-600 mt-1 flex items-center gap-1"
                      >
                        <MessageSquare size={12} />
                        添加备注
                      </button>
                    )}
                  </div>

                  {/* Right: Status + Actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                      {statusInfo.icon}
                      {app.status}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Status change dropdown */}
                      {nextStatuses.length > 0 && (
                        <div className="relative">
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) handleStatusChange(app.id, e.target.value);
                            }}
                            disabled={isSaving}
                            className="appearance-none text-xs border border-gray-200 rounded px-2 py-1 pr-6 bg-white hover:border-indigo-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                          >
                            <option value="" disabled>状态 →</option>
                            {nextStatuses.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      )}

                      {isSaving && <Loader2 size={14} className="animate-spin text-indigo-500" />}

                      <button
                        onClick={() => handleDelete(app.id)}
                        disabled={isDeleting}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        {isDeleting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>

                    {app.job?.id && (
                      <Link
                        to={`/jobs/${app.job.id}`}
                        className="text-xs text-indigo-500 hover:text-indigo-700"
                      >
                        查看详情 →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}