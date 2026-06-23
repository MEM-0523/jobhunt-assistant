import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FileText,
  File,
  Sparkles,
  Download,
  AlertCircle,
  Loader2,
  ChevronDown,
  CheckCircle2,
  Award,
  } from 'lucide-react';
import client from '../api/client';
import type { Resume, Job, ResumeSuggestion, ResumeLabel } from '../types';
import { transitionCases } from '../data/transitionCases';

const SUGGESTION_LABEL_CONFIG: Record<ResumeLabel, { text: string; className: string }> = {
  use_as_is: { text: '可用', className: 'bg-green-100 text-green-700' },
  rewrite: { text: '需改写', className: 'bg-blue-100 text-blue-700' },
  needs_proof: { text: '缺证据', className: 'bg-yellow-100 text-yellow-700' },
  remove: { text: '建议删除', className: 'bg-red-100 text-red-700' },
  ask_user: { text: '需追问', className: 'bg-gray-100 text-gray-700' },
};

function renderMarkdown(content: string): string {
  const lines = content.split('\n');
  let html = '';
  let inList: string | false = false;
  let listType: 'ul' | 'ol' = 'ul';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Heading
    const h3Match = line.match(/^### (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h1Match = line.match(/^# (.+)$/);

    if (h3Match) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h3 class="text-lg font-semibold text-gray-800 mt-4 mb-2">${escapeHtml(h3Match[1])}</h3>`;
      continue;
    }
    if (h2Match) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h2 class="text-xl font-bold text-gray-900 mt-5 mb-3">${escapeHtml(h2Match[1])}</h2>`;
      continue;
    }
    if (h1Match) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h1 class="text-2xl font-bold text-gray-900 mt-6 mb-4">${escapeHtml(h1Match[1])}</h1>`;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^[\-\*] (.+)$/);
    if (ulMatch) {
      if (!inList || listType !== 'ul') {
        if (inList) html += '</ol>';
        html += '<ul class="list-disc ml-5 space-y-1 text-gray-700">';
        inList = listType;
        listType = 'ul';
      }
      html += `<li>${inlineMarkdown(ulMatch[1])}</li>`;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\. (.+)$/);
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        if (inList) html += '</ul>';
        html += '<ol class="list-decimal ml-5 space-y-1 text-gray-700">';
        inList = listType;
        listType = 'ol';
      }
      html += `<li>${inlineMarkdown(olMatch[1])}</li>`;
      continue;
    }

    // End list if non-list line
    if (inList) {
      html += inList === 'ol' ? '</ol>' : '</ul>';
      inList = false;
    }

    // Empty line → paragraph break
    if (line.trim() === '') {
      continue;
    }

    // Regular paragraph
    html += `<p class="text-gray-700 mb-2">${inlineMarkdown(line)}</p>`;
  }

  if (inList) {
    html += listType === 'ol' ? '</ol>' : '</ul>';
  }

  return html;
}

function inlineMarkdown(text: string): string {
  let result = escapeHtml(text);
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function ResumePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'my' | 'optimize'>('my');
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [optimizeError, setOptimizeError] = useState('');
  const [pipelineResult, setPipelineResult] = useState<{
    stages: Array<{ stage: number; name: string; description: string; content: string }>;
    overall_score: number;
    final_content: string;
    summary: string;
    suggestions?: ResumeSuggestion[];
  } | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // 经历资产导入相关状态
  const [showImportModal, setShowImportModal] = useState(false);
  const [experiences, setExperiences] = useState<Array<{
    id: number;
    type: string;
    title: string;
    background: string;
    task: string;
    action: string;
    method_tool: string;
    result: string;
    evidence: string;
  }>>([]);
  const [selectedExpIds, setSelectedExpIds] = useState<Set<number>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  const fetchResumes = useCallback(async () => {
    try {
      setLoadingResumes(true);
      setFetchError('');
      const { data } = await client.get('/resumes/');
      setResumes(data);
      if (data.length > 0 && !selectedResumeId) {
        setSelectedResumeId(data[0].id);
      }
    } catch {
      setFetchError('获取简历列表失败');
    } finally {
      setLoadingResumes(false);
    }
  }, [selectedResumeId]);

  const fetchJobs = useCallback(async () => {
    try {
      setLoadingJobs(true);
      const { data } = await client.get('/jobs/favorites');
      setJobs(data.results || []);
    } catch {
      // ignore
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
    fetchJobs();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedResume = resumes.find(r => r.id === selectedResumeId);

  const handleFileChange = async (file: File) => {
    const allowedExtensions = ['.md', '.pdf', '.docx'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      setUploadError('不支持的文件格式，请上传 .md、.pdf 或 .docx 文件');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setUploadError('文件大小不能超过5MB');
      return;
    }

    setUploadError('');
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await client.post('/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResumes(prev => [data, ...prev]);
      setSelectedResumeId(data.id);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || '上传失败，请重试'
          : '上传失败，请重试';
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
  };

  // 打开经历资产导入弹窗
  const handleOpenImportModal = async () => {
    setShowImportModal(true);
    setImportError('');
    setSelectedExpIds(new Set());
    try {
      setImportLoading(true);
      const { data } = await client.get('/experiences');
      setExperiences(Array.isArray(data) ? data : []);
    } catch {
      setImportError('加载经历资产失败');
    } finally {
      setImportLoading(false);
    }
  };

  // 切换经历选中状态
  const toggleExpSelect = (id: number) => {
    setSelectedExpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 确认导入：将选中经历转为markdown，生成文件上传
  const handleConfirmImport = async () => {
    if (selectedExpIds.size === 0) {
      setImportError('请至少选择一条经历');
      return;
    }

    const typeLabels: Record<string, string> = {
      project: '项目经历',
      internship: '实习经历',
      course: '课程项目',
      club: '社团活动',
      self_study: '自主学习',
      part_time: '兼职经历',
    };

    const selectedExps = experiences.filter(e => selectedExpIds.has(e.id));
    const mdContent = selectedExps.map(exp => {
      const sections = [`## ${exp.title || '未命名经历'}`];
      sections.push(`**类型**：${typeLabels[exp.type] || exp.type}`);
      if (exp.background) sections.push(`**背景**：${exp.background}`);
      if (exp.task) sections.push(`**任务**：${exp.task}`);
      if (exp.action) sections.push(`**行动**：${exp.action}`);
      if (exp.method_tool) sections.push(`**方法/工具**：${exp.method_tool}`);
      if (exp.result) sections.push(`**结果**：${exp.result}`);
      if (exp.evidence) sections.push(`**证据**：${exp.evidence}`);
      return sections.join('\n\n');
    }).join('\n\n---\n\n');

    const header = `# 个人简历（从经历资产导入）\n\n> 生成时间：${new Date().toLocaleString('zh-CN')}\n\n---\n\n`;
    const fullContent = header + mdContent;

    try {
      setImportLoading(true);
      const blob = new Blob([fullContent], { type: 'text/markdown' });
      const formData = new FormData();
      formData.append('file', blob, `resume_from_experiences_${Date.now()}.md`);
      const { data } = await client.post('/resumes/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResumes(prev => [data, ...prev]);
      setSelectedResumeId(data.id);
      setShowImportModal(false);
      setUploadError('');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || '导入失败，请重试'
          : '导入失败，请重试';
      setImportError(message);
    } finally {
      setImportLoading(false);
    }
  };

  const handlePipelineOptimize = async () => {
    if (!selectedResumeId || !selectedJobId) return;

    setOptimizeError('');
    setPipelineRunning(true);
    setPipelineResult(null);
    setActiveStage(0);

    const animateStages = () => {
      let s = 0;
      const interval = setInterval(() => {
        s++;
        setActiveStage(s);
        if (s >= 6) clearInterval(interval);
      }, 400);
      return interval;
    };

    const interval = animateStages();

    try {
      const { data } = await client.post(`/resumes/${selectedResumeId}/optimize-pipeline`, {
        job_id: selectedJobId,
      });
      setPipelineResult(data);
      if (data.stages) {
        setActiveStage(6);
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Pipeline优化失败'
          : 'Pipeline优化失败';
      setOptimizeError(message);
      setActiveStage(0);
    } finally {
      clearInterval(interval);
      setPipelineRunning(false);
    }
  };

  const handleDownload = () => {
    if (!selectedResume) return;
    const blob = new Blob([selectedResume.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-v${selectedResume.version}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportWord = async (content: string) => {
    if (!selectedResumeId) return;
    try {
      const response = await client.post(
        `/resumes/${selectedResumeId}/export`,
        { content, filename: '优化简历' },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '优化简历.docx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // silently fail
    }
  };

  const getFileTypeLabel = (ft: string) => {
    switch (ft) {
      case 'pdf': return 'PDF';
      case 'docx': return 'Word';
      default: return 'MD';
    }
  };

  const getFileTypeColor = (ft: string) => {
    switch (ft) {
      case 'pdf': return 'bg-red-100 text-red-700';
      case 'docx': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getFileTypeIcon = (ft: string) => {
    if (ft === 'pdf') return <File size={12} />;
    return <FileText size={12} />;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">简历管理</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('my')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'my'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText size={16} className="inline mr-1.5" />
          我的简历
        </button>
        <button
          onClick={() => setActiveTab('optimize')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'optimize'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles size={16} className="inline mr-1.5" />
          简历优化
        </button>
      </div>

      {/* ========== Tab 1: My Resume ========== */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {/* Upload Area */}
          <div
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
              dragOver
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-300 bg-white'
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="text-indigo-600 animate-spin" />
                <p className="text-gray-600">正在上传解析...</p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                <p className="text-gray-600 mb-1">拖拽简历文件到此处，或点击上传</p>
                <p className="text-sm text-gray-400 mb-4">支持 Markdown (.md)、PDF (.pdf)、Word (.docx) 格式</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".md,.pdf,.docx"
                  onChange={handleInputChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  选择文件
                </button>
              </>
            )}
          </div>

          {/* Bridge to Experiences */}
          <button
            onClick={handleOpenImportModal}
            className="flex items-center justify-center gap-2 w-full py-2 mt-2 bg-amber-50 text-amber-700 rounded-md text-sm font-medium hover:bg-amber-100 border border-amber-200 transition-colors"
          >
            <Award size={16} />
            从经历资产导入
          </button>

          {/* Upload Error */}
          {uploadError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md">
              <AlertCircle size={18} />
              <span className="text-sm">{uploadError}</span>
            </div>
          )}

          {/* Fetch Error */}
          {fetchError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md">
              <AlertCircle size={18} />
              <span className="text-sm">{fetchError}</span>
              <button onClick={fetchResumes} className="text-sm underline ml-auto">重试</button>
            </div>
          )}

          {/* Version History & Preview */}
          {loadingResumes ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-indigo-600 mb-2" />
              <p className="text-gray-500 text-sm">加载中...</p>
            </div>
          ) : resumes.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <FileText size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">暂无简历，请上传</p>
            </div>
          ) : (
            <>
              {/* Version Selector + Download */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600">选择版本：</span>
                    <div className="relative">
                      <select
                        value={selectedResumeId ?? ''}
                        onChange={(e) => setSelectedResumeId(Number(e.target.value))}
                        className="appearance-none border border-gray-300 rounded-md pl-3 pr-8 py-1.5 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {resumes.map((r) => (
                          <option key={r.id} value={r.id}>
                            版本 {r.version} — {new Date(r.created_at).toLocaleDateString('zh-CN')} [{getFileTypeLabel(r.file_type || 'md')}]
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      共 {resumes.length} 个版本
                    </span>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-md px-3 py-1.5 hover:bg-indigo-50 transition-colors"
                    >
                      <Download size={14} />
                      下载
                    </button>
                  </div>
                </div>
              </div>

              {/* Markdown Preview */}
              {selectedResume && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    简历预览
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getFileTypeColor(selectedResume.file_type || 'md')}`}>
                      {getFileTypeIcon(selectedResume.file_type || 'md')}
                      {getFileTypeLabel(selectedResume.file_type || 'md')}
                    </span>
                  </h2>
                  <div
                    className="prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedResume.content) }}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========== Tab 2: Resume Optimization ========== */}
      {activeTab === 'optimize' && (
        <div className="space-y-6">
          {/* Selection Controls */}
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-4">
              选择简历版本和目标职位，启动6阶段Pipeline优化
            </p>

            {loadingResumes || loadingJobs ? (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">加载数据中...</span>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">简历版本</label>
                  {resumes.length === 0 ? (
                    <p className="text-sm text-orange-600 flex items-center gap-1.5">
                      <AlertCircle size={14} /> 暂无简历，请先在「我的简历」页面上传
                    </p>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedResumeId ?? ''}
                        onChange={(e) => setSelectedResumeId(Number(e.target.value))}
                        className="appearance-none w-full border border-gray-300 rounded-md pl-3 pr-8 py-2 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {resumes.map((r) => (
                          <option key={r.id} value={r.id}>
                            版本 {r.version} — {new Date(r.created_at).toLocaleDateString('zh-CN')} [{getFileTypeLabel(r.file_type || 'md')}]
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">目标职位</label>
                  {jobs.length === 0 ? (
                    <p className="text-sm text-orange-600 flex items-center gap-1.5">
                      <AlertCircle size={14} /> 暂无收藏的职位，请先在职位搜索中收藏职位
                    </p>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedJobId ?? ''}
                        onChange={(e) => setSelectedJobId(Number(e.target.value))}
                        className="appearance-none w-full border border-gray-300 rounded-md pl-3 pr-8 py-2 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="" disabled>请选择职位</option>
                        {jobs.map((j) => (
                          <option key={j.id} value={j.id}>
                            {j.title} — {j.company} ({j.city})
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  )}
                </div>

                <button
                  onClick={handlePipelineOptimize}
                  disabled={!selectedResumeId || !selectedJobId || pipelineRunning}
                  className="w-full bg-indigo-600 text-white px-6 py-2.5 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {pipelineRunning ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Pipeline优化中...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      启动6阶段Pipeline优化
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Pipeline Progress */}
          {(pipelineRunning || pipelineResult) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">优化进程</h3>
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                {[1, 2, 3, 4, 5, 6].map((s) => {
                  const stageNames = ['能力评估', '人岗匹配', '故事生成', '简历组装', 'ATS优化', '人工把关'];
                  const completed = activeStage >= s;
                  const current = activeStage === s - 1 || (pipelineRunning && s === activeStage + 1);
                  return (
                    <div key={s} className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                          completed
                            ? 'bg-indigo-600 text-white'
                            : current
                            ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-400'
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          {completed ? <CheckCircle2 size={16} /> : s}
                        </div>
                        <span className={`text-[10px] mt-1 whitespace-nowrap ${
                          completed ? 'text-indigo-600' : current ? 'text-indigo-500' : 'text-gray-400'
                        }`}>
                          {stageNames[s - 1]}
                        </span>
                      </div>
                      {s < 6 && (
                        <div className={`w-6 h-0.5 mt-[-12px] ${
                          completed ? 'bg-indigo-400' : 'bg-gray-200'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {pipelineResult && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl font-bold text-indigo-600">{pipelineResult.overall_score}</span>
                  <span className="text-sm text-gray-400">分</span>
                  <span className="text-sm text-gray-600">{pipelineResult.summary}</span>
                  <button
                    onClick={() => handleExportWord(pipelineResult.final_content)}
                    className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Download size={14} />
                    导出Word
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pipeline Stage Results */}
          {pipelineResult && pipelineResult.stages && (
            <div className="space-y-3">
              {pipelineResult.stages.map((stage) => (
                <details key={stage.stage} className="bg-white rounded-lg shadow overflow-hidden" open={stage.stage <= 2}>
                  <summary className="px-5 py-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                        {stage.stage}
                      </span>
                      <span className="font-medium text-gray-800 text-sm">{stage.name}</span>
                    </div>
                    <span className="text-xs text-gray-400">{stage.description}</span>
                  </summary>
                  <div className="px-5 pb-4 pt-1">
                    <div className="prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {stage.content}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}

          {/* 优化建议明细（带标签系统） */}
          {pipelineResult && pipelineResult.suggestions && pipelineResult.suggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900 px-1">优化建议明细</h3>
              {pipelineResult.suggestions.map((suggestion, idx) => {
                const labelKey = (suggestion.label as ResumeLabel) || 'rewrite';
                const labelConfig = SUGGESTION_LABEL_CONFIG[labelKey] || SUGGESTION_LABEL_CONFIG.rewrite;
                const isNeedsProof = labelKey === 'needs_proof';
                return (
                  <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${labelConfig.className}`}>
                        {labelConfig.text}
                      </span>
                      {suggestion.section && (
                        <span className="text-xs text-gray-500">板块：{suggestion.section}</span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="text-gray-500">原文：</span>
                        <span className="text-gray-700">{suggestion.original}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">建议：</span>
                        <span className="text-gray-900 font-medium">{suggestion.suggestion}</span>
                      </div>
                    </div>
                    {suggestion.reason && !isNeedsProof && (
                      <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded">
                        {suggestion.reason}
                      </p>
                    )}
                    {isNeedsProof && suggestion.reason && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-xs text-yellow-800">
                        ⚠️ 缺少证据：{suggestion.reason}。建议补充相关项目经历或修改表述。
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Transition Case Resume Tips */}
          {transitionCases.length > 0 && transitionCases.some((c) => c.resume_tips.length > 0) && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">参考案例：转型简历技巧</h3>
              <div className="space-y-4">
                {transitionCases.filter((c) => c.resume_tips.length > 0).map((c) => (
                  <div key={c.id} className="border-l-4 border-blue-400 pl-4">
                    <p className="text-xs font-medium text-gray-700 mb-1">{c.title}</p>
                    <ul className="space-y-1.5">
                      {c.resume_tips.map((tip, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="text-blue-400 mt-0.5">{i + 1}.</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {optimizeError && (
            <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-md">
              <AlertCircle size={18} />
              <span className="text-sm">{optimizeError}</span>
            </div>
          )}

          {/* Empty State */}
          {!pipelineResult && !pipelineRunning && !optimizeError && !loadingResumes && !loadingJobs && (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Sparkles size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">选择简历和目标职位后，点击「启动6阶段Pipeline优化」</p>
            </div>
          )}
        </div>
      )}

      {/* ========== 经历资产导入 Modal ========== */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Award size={20} className="text-amber-600" />
                从经历资产导入
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {importLoading && experiences.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-indigo-600" />
                  <span className="ml-2 text-gray-500 text-sm">加载经历资产中...</span>
                </div>
              ) : experiences.length === 0 ? (
                <div className="text-center py-12">
                  <Award size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">暂无经历资产</p>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      navigate('/experience-assets');
                    }}
                    className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    去添加经历资产 →
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-3">
                    勾选要导入的经历，将生成Markdown格式简历并保存为新版本
                  </p>
                  <div className="space-y-2">
                    {experiences.map(exp => {
                      const checked = selectedExpIds.has(exp.id);
                      return (
                        <label
                          key={exp.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            checked ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleExpSelect(exp.id)}
                            className="mt-1 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {exp.title || '未命名经历'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {exp.background && <span>背景：{exp.background.slice(0, 60)}{exp.background.length > 60 ? '...' : ''}</span>}
                            </p>
                            {exp.result && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                结果：{exp.result.slice(0, 60)}{exp.result.length > 60 ? '...' : ''}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}

              {importError && (
                <div className="mt-3 flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-md text-sm">
                  <AlertCircle size={16} />
                  <span>{importError}</span>
                </div>
              )}
            </div>

            {experiences.length > 0 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  已选 {selectedExpIds.size} 条
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={selectedExpIds.size === 0 || importLoading}
                    className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                  >
                    {importLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        导入中...
                      </>
                    ) : (
                      <>
                        <Award size={14} />
                        确认导入
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}