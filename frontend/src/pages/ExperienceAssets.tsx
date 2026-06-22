import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Briefcase, Users, BookOpen, Coffee, X, Save, Award,
} from 'lucide-react';
import client from '../api/client';
import type { Experience } from '../types';

const EXPERIENCE_TYPES = [
  { value: 'project', label: '项目经历', icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  { value: 'internship', label: '实习经历', icon: Coffee, color: 'bg-green-100 text-green-700' },
  { value: 'course', label: '课程项目', icon: BookOpen, color: 'bg-purple-100 text-purple-700' },
  { value: 'club', label: '社团活动', icon: Users, color: 'bg-amber-100 text-amber-700' },
  { value: 'self_study', label: '自学经历', icon: BookOpen, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'part_time', label: '兼职工作', icon: Briefcase, color: 'bg-pink-100 text-pink-700' },
] as const;

const TYPE_MAP = EXPERIENCE_TYPES.reduce<Record<string, typeof EXPERIENCE_TYPES[number]>>((acc, t) => {
  acc[t.value] = t;
  return acc;
}, {});

interface FormState {
  type: string;
  title: string;
  background: string;
  task: string;
  action: string;
  method_tool: string;
  result: string;
  evidence: string;
}

const EMPTY_FORM: FormState = {
  type: 'project',
  title: '',
  background: '',
  task: '',
  action: '',
  method_tool: '',
  result: '',
  evidence: '',
};

export default function ExperienceAssets() {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadExperiences = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await client.get('/experiences');
      setExperiences(Array.isArray(data) ? data : []);
    } catch {
      setError('加载经历列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExperiences();
  }, []);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOpenAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  };

  const handleOpenEdit = (exp: Experience) => {
    setForm({
      type: exp.type,
      title: exp.title,
      background: exp.background,
      task: exp.task,
      action: exp.action,
      method_tool: exp.method_tool,
      result: exp.result,
      evidence: exp.evidence,
    });
    setEditingId(exp.id);
    setFormError(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setFormError('请输入标题');
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      const payload = {
        type: form.type,
        title: form.title.trim(),
        background: form.background.trim(),
        task: form.task.trim(),
        action: form.action.trim(),
        method_tool: form.method_tool.trim(),
        result: form.result.trim(),
        evidence: form.evidence.trim(),
      };

      if (editingId) {
        const { data } = await client.put(`/experiences/${editingId}`, payload);
        setExperiences((prev) => prev.map((e) => (e.id === editingId ? data : e)));
      } else {
        const { data } = await client.post('/experiences', payload);
        setExperiences((prev) => [data, ...prev]);
      }
      handleCloseForm();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || '保存失败，请重试'
          : '保存失败，请重试';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条经历吗？')) return;
    try {
      setDeletingId(id);
      await client.delete(`/experiences/${id}`);
      setExperiences((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError('删除失败，请重试');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">经历资产库</h1>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          添加经历
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Loader2 size={28} className="animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-gray-500 text-sm">加载中...</p>
        </div>
      ) : experiences.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Award size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-1">暂无经历资产</p>
          <p className="text-sm text-gray-400 mb-4">录入你的项目、实习、课程等经历，构建个人经历资产库</p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus size={16} />
            添加第一条经历
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {experiences.map((exp) => {
            const typeInfo = TYPE_MAP[exp.type] || EXPERIENCE_TYPES[0];
            const TypeIcon = typeInfo.icon;
            const isExpanded = expanded.has(exp.id);
            return (
              <div key={exp.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Card header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                          <TypeIcon size={12} />
                          {typeInfo.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(exp.updated_at || exp.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 mb-1">{exp.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{exp.background}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleOpenEdit(exp)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        aria-label="编辑"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        disabled={deletingId === exp.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                        aria-label="删除"
                      >
                        {deletingId === exp.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => toggleExpand(exp.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                        aria-label={isExpanded ? '折叠' : '展开'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
                    <DetailField label="背景" value={exp.background} />
                    <DetailField label="任务" value={exp.task} />
                    <DetailField label="个人行动" value={exp.action} />
                    <DetailField label="方法/工具" value={exp.method_tool} />
                    <DetailField label="结果" value={exp.result} />
                    <DetailField label="证据" value={exp.evidence} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseForm} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? '编辑经历' : '添加经历'}
              </h2>
              <button
                onClick={handleCloseForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPERIENCE_TYPES.map((t) => {
                    const Icon = t.icon;
                    const selected = form.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm({ ...form, type: t.value })}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm transition-colors ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <Icon size={14} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <FormField label="标题" required>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="例如：校园二手交易平台"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </FormField>

              <FormField label="背景" hint="项目背景、所处环境、面临的挑战">
                <textarea
                  value={form.background}
                  onChange={(e) => setForm({ ...form, background: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                />
              </FormField>

              <FormField label="任务" hint="你需要完成什么、目标是什么">
                <textarea
                  value={form.task}
                  onChange={(e) => setForm({ ...form, task: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                />
              </FormField>

              <FormField label="个人行动" hint="你具体做了什么（动词开头）">
                <textarea
                  value={form.action}
                  onChange={(e) => setForm({ ...form, action: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                />
              </FormField>

              <FormField label="方法/工具" hint="使用的方法论、工具、技术栈">
                <textarea
                  value={form.method_tool}
                  onChange={(e) => setForm({ ...form, method_tool: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                />
              </FormField>

              <FormField label="结果" hint="量化成果、影响、收获">
                <textarea
                  value={form.result}
                  onChange={(e) => setForm({ ...form, result: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                />
              </FormField>

              <FormField label="证据" hint="链接、截图、数据、第三方评价等">
                <textarea
                  value={form.evidence}
                  onChange={(e) => setForm({ ...form, evidence: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
                />
              </FormField>

              {formError && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle size={14} />
                  {formError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200">
              <button
                onClick={handleCloseForm}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editingId ? '保存修改' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <p className="text-sm text-gray-700 leading-relaxed mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
