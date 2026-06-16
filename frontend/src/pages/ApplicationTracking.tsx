import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  ClipboardList,
  Trash2,
  ChevronDown,
  Loader2,
  X,
  Calendar,
  FileText,
  DollarSign,
  Lightbulb,
  MessageSquareText,
  CheckCircle2,
} from 'lucide-react';
import client from '../api/client';
import type { Application, ApplicationStats, Job, SalaryAdvice } from '../types';

const STATUS_ALL = [
  '待投递', '已投递', '初筛通过', '初筛拒绝',
  '面试邀约', '无回应', '面试中', '面试通过',
  '面试拒绝', 'offer', '接受', '拒绝',
];

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

const STATUS_COLOR: Record<string, string> = {
  '待投递': 'bg-gray-100 text-gray-700',
  '已投递': 'bg-blue-100 text-blue-700',
  '初筛通过': 'bg-blue-100 text-blue-700',
  '初筛拒绝': 'bg-red-100 text-red-700',
  '面试邀约': 'bg-yellow-100 text-yellow-700',
  '无回应': 'bg-gray-100 text-gray-700',
  '面试中': 'bg-yellow-100 text-yellow-700',
  '面试通过': 'bg-yellow-100 text-yellow-700',
  '面试拒绝': 'bg-red-100 text-red-700',
  'offer': 'bg-green-100 text-green-700',
  '接受': 'bg-green-100 text-green-700',
  '拒绝': 'bg-red-100 text-red-700',
};

const FILTER_TABS = [
  { key: '', label: '全部' },
  { key: '待投递', label: '待投递' },
  { key: '已投递', label: '已投递' },
  { key: '面试中', label: '面试中' },
  { key: 'Offer', label: 'Offer' },
  { key: '已拒绝', label: '已拒绝' },
];

const FUNNEL_STAGES = ['待投递', '已投递', '面试邀约', '面试中', 'offer'];
const FUNNEL_COLORS = ['bg-gray-400', 'bg-blue-400', 'bg-yellow-400', 'bg-orange-400', 'bg-green-400'];

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  } catch {
    return dateStr;
  }
}

export default function ApplicationTracking() {
  const navigate = useNavigate();

  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Form state
  const [jobs, setJobs] = useState<Job[]>([]);
  const [formJobId, setFormJobId] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState('待投递');
  const [formDate, setFormDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Update dropdown state per row
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  // Salary negotiation state
  const [salaryAppId, setSalaryAppId] = useState<number | null>(null);
  const [salaryAdvice, setSalaryAdvice] = useState<SalaryAdvice | null>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [salaryError, setSalaryError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = activeFilter ? { status: activeFilter } : {};
      const [appsRes, statsRes] = await Promise.all([
        client.get('/applications', { params }),
        client.get('/applications/stats'),
      ]);
      setApplications(appsRes.data);
      setStats(statsRes.data);
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchJobs = async () => {
    try {
      const { data } = await client.get('/jobs/');
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      setJobs([]);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormJobId(null);
    setFormStatus('待投递');
    setFormDate('');
    setFormNotes('');
    setShowModal(true);
    fetchJobs();
  };

  const handleSubmit = async () => {
    if (!formJobId) return;
    try {
      setModalLoading(true);
      const payload = {
        job_id: formJobId,
        status: formStatus,
        applied_at: formDate ? `${formDate}T00:00:00` : null,
        notes: formNotes,
      };

      if (editingId) {
        await client.put(`/applications/${editingId}`, {
          status: formStatus,
          notes: formNotes,
        });
      } else {
        await client.post('/applications', payload);
      }

      setShowModal(false);
      fetchData();
    } catch {
      alert('操作失败，请重试');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除这条投递记录？')) return;
    try {
      await client.delete(`/applications/${id}`);
      fetchData();
    } catch {
      alert('删除失败');
    }
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    try {
      await client.put(`/applications/${id}`, { status: newStatus });
      setOpenDropdownId(null);
      fetchData();
    } catch {
      alert('更新失败');
    }
  };

  const fetchSalaryAdvice = async (appId: number) => {
    try {
      setSalaryLoading(true);
      setSalaryError('');
      setSalaryAppId(appId);
      const { data } = await client.get(`/applications/${appId}/salary-advice`);
      setSalaryAdvice(data);
    } catch {
      setSalaryError('加载薪资建议失败');
    } finally {
      setSalaryLoading(false);
    }
  };

  const maxFunnel = stats ? Math.max(1, ...FUNNEL_STAGES.map(s => stats.funnel[s] || 0)) : 1;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">申请追踪</h1>
        <button
          onClick={openCreateModal}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2 text-sm"
        >
          <Plus size={18} />
          添加投递记录
        </button>
      </div>

      {/* Funnel Chart */}
      {stats && !loading && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">投递漏斗</h2>
          <div className="flex items-end gap-2">
            {FUNNEL_STAGES.map((stage, i) => {
              const count = stats.funnel[stage] || 0;
              const pct = Math.max(0, Math.round((count / maxFunnel) * 100));
              return (
                <div key={stage} className="flex-1 flex flex-col items-center">
                  <span className="text-2xl font-bold text-gray-800 mb-1">{count}</span>
                  <div
                    className={`w-full ${FUNNEL_COLORS[i]} rounded-t transition-all`}
                    style={{ height: `${Math.max(pct * 0.6, 8)}px`, minWidth: 0 }}
                  />
                  <span className="text-xs text-gray-500 mt-2 whitespace-nowrap">{stage}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {tab.label}
            {stats && tab.key !== '' && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                activeFilter === tab.key ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {tab.key === '已拒绝'
                  ? (stats.by_status['初筛拒绝'] || 0) + (stats.by_status['面试拒绝'] || 0) + (stats.by_status['拒绝'] || 0)
                  : tab.key === '面试中'
                  ? (stats.by_status['面试邀约'] || 0) + (stats.by_status['面试中'] || 0) + (stats.by_status['面试通过'] || 0) + (stats.by_status['面试拒绝'] || 0)
                  : tab.key === 'Offer'
                  ? (stats.by_status['offer'] || 0) + (stats.by_status['接受'] || 0) + (stats.by_status['拒绝'] || 0)
                  : (stats.by_status[tab.key] || 0)
                }
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Application List */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex items-center gap-2 text-gray-500 p-6 pb-4 border-b border-gray-100">
          <ClipboardList size={20} />
          <span className="font-medium">投递列表</span>
          {stats && (
            <span className="text-sm text-gray-400 ml-auto">共 {stats.total} 条</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-3">{error}</p>
            <button onClick={fetchData} className="text-indigo-600 hover:underline text-sm">
              重试
            </button>
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-16">
            <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">暂无投递记录</p>
            <button
              onClick={openCreateModal}
              className="mt-3 inline-flex items-center gap-1.5 text-indigo-600 hover:underline text-sm"
            >
              <Plus size={16} />
              添加第一条投递记录
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {applications.map((app) => {
              const nextStatuses = STATUS_FLOW[app.status] || [];
              return (
                <div key={app.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 truncate">
                          {app.company || '未知公司'}
                        </span>
                        <span className="text-gray-400 text-sm">·</span>
                        <span className="text-gray-700 truncate">{app.job_title || '未知岗位'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[app.status] || 'bg-gray-100 text-gray-600'}`}>
                          {app.status}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={13} />
                          {formatDate(app.applied_at)}
                        </span>
                        {app.notes && (
                          <span className="inline-flex items-center gap-1 text-gray-400 truncate max-w-[200px]">
                            <FileText size={13} />
                            {app.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      {/* Update Status Dropdown */}
                      {nextStatuses.length > 0 && (
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdownId(openDropdownId === app.id ? null : app.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                          >
                            更新状态
                            <ChevronDown size={14} />
                          </button>
                          {openDropdownId === app.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} aria-hidden="true" />
                              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[120px]">
                                {nextStatuses.map((ns) => (
                                  <button
                                    key={ns}
                                    onClick={() => handleStatusUpdate(app.id, ns)}
                                    className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    {ns}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Interview Prep */}
                      <button
                        onClick={() => navigate(`/interview-prep`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        面试准备
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(app.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        aria-label="删除投递记录"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Salary Negotiation */}
      {applications.some(a => a.status === 'offer') && (
        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign size={20} className="text-green-500" />
            薪资谈判助手
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            以下岗位已进入Offer阶段，可使用薪资谈判助手获取建议：
          </p>

          <div className="space-y-3">
            {applications.filter(a => a.status === 'offer').map((app) => (
              <div key={app.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-medium text-gray-900">{app.company}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="text-gray-700">{app.job_title}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (salaryAppId === app.id && salaryAdvice) {
                        setSalaryAppId(null);
                        setSalaryAdvice(null);
                      } else {
                        fetchSalaryAdvice(app.id);
                      }
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
                  >
                    {salaryLoading && salaryAppId === app.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : salaryAppId === app.id && salaryAdvice ? (
                      '收起'
                    ) : (
                      '薪资谈判建议'
                    )}
                  </button>
                </div>

                {/* Salary Advice Card */}
                {salaryAppId === app.id && salaryAdvice && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-3 space-y-4">
                    {/* Market Range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 mb-0.5">市场参考薪资</p>
                        <p className="text-lg font-bold text-green-600">{salaryAdvice.market_range}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center">
                        <p className="text-xs text-gray-500 mb-0.5">你的期望薪资</p>
                        <p className="text-lg font-bold text-indigo-600">{salaryAdvice.your_expectation}</p>
                      </div>
                    </div>

                    {/* Negotiation Tips */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Lightbulb size={14} className="text-amber-500" />
                        谈判要点
                      </h4>
                      <div className="space-y-1.5">
                        {salaryAdvice.negotiation_tips.map((tip, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Counter Offer Script */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <MessageSquareText size={14} className="text-blue-500" />
                        还价话术模板
                      </h4>
                      <div className="bg-white border border-blue-200 rounded-lg p-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {salaryAdvice.counter_offer_script}
                      </div>
                    </div>

                    {/* Checklist */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <CheckCircle2 size={14} className="text-green-500" />
                        签约前检查清单
                      </h4>
                      <div className="space-y-1.5">
                        {salaryAdvice.checklist.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <CheckCircle2 size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {salaryAppId === app.id && salaryError && (
                  <p className="text-red-500 text-xs mt-2">{salaryError}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? '编辑投递记录' : '添加投递记录'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                aria-label="关闭"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Job Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择岗位</label>
                <select
                  value={formJobId ?? ''}
                  onChange={(e) => setFormJobId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">请选择岗位</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.company} - {j.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">当前状态</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {STATUS_ALL.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Applied Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">投递时间</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  placeholder="添加备注信息..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formJobId || modalLoading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {modalLoading && <Loader2 size={16} className="animate-spin" />}
                {editingId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}