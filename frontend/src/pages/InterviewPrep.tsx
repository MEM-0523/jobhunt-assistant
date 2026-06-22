import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target, MessageSquare, BookOpen, HelpCircle, ClipboardCheck, ChevronDown,
  ChevronUp, Loader2, AlertCircle, Check, ClipboardList, Star, Save, Calendar,
  DollarSign, AlertTriangle, Shield, Building2, TrendingUp, Zap, Clock, User,
  Briefcase, Link2, CheckSquare, Mic,
} from 'lucide-react';
import client from '../api/client';
import type { Application, InterviewPrepData, QAPair, Story, QuestionToAsk, InterviewReview } from '../types';
import { transitionCases } from '../data/transitionCases';

const TABS = [
  { key: 'self_introduction', label: '自我介绍', icon: User },
  { key: 'company_research', label: '公司调研', icon: Building2 },
  { key: 'stories', label: '项目解构', icon: Briefcase },
  { key: 'qa_pairs', label: '核心问答', icon: MessageSquare },
  { key: 'questions_to_ask', label: '反问清单', icon: HelpCircle },
  { key: 'salary_negotiation', label: '薪资谈判', icon: DollarSign },
  { key: 'weaknesses', label: '弱点应对', icon: Shield },
  { key: 'red_flags', label: '红旗信号', icon: AlertTriangle },
  { key: 'gap_analysis', label: '能力差距', icon: TrendingUp },
  { key: 'tips', label: '准备清单', icon: CheckSquare },
  { key: 'review', label: '面试复盘', icon: ClipboardList },
] as const;

type TabKey = typeof TABS[number]['key'];

const CATEGORY_COLORS: Record<string, string> = {
  '必答题': 'bg-red-100 text-red-700',
  '技术问题': 'bg-blue-100 text-blue-700',
  '亮点问题': 'bg-green-100 text-green-700',
  '行为问题': 'bg-purple-100 text-purple-700',
};

export default function InterviewPrep() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<number | null>(null);
  const [loadingApps, setLoadingApps] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prepData, setPrepData] = useState<InterviewPrepData | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('self_introduction');
  const [version, setVersion] = useState<'express' | 'standard' | 'deep'>('standard');

  // Editable self introduction
  const [selfIntro, setSelfIntro] = useState('');
  const [isEditingIntro, setIsEditingIntro] = useState(false);

  // Expanded Q&A items
  const [expandedQA, setExpandedQA] = useState<Set<number>>(new Set());

  // Expanded story cards
  const [expandedStories, setExpandedStories] = useState<Set<number>>(new Set());

  // Checked questions
  const [checkedQuestions, setCheckedQuestions] = useState<Set<number>>(new Set());

  // Checked tips
  const [checkedTips, setCheckedTips] = useState<Set<number>>(new Set());

  // Review state
  const [reviews, setReviews] = useState<InterviewReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewDate, setReviewDate] = useState('');
  const [reviewQuestions, setReviewQuestions] = useState('');
  const [reviewRating, setReviewRating] = useState(3);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewImprovements, setReviewImprovements] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Load applications
  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setLoadingApps(true);
      setError(null);
      const res = await client.get('/applications');
      setApplications(res.data);
    } catch {
      setError('加载投递记录失败');
    } finally {
      setLoadingApps(false);
    }
  };

  // When prepData changes, sync selfIntro
  useEffect(() => {
    if (prepData?.self_introduction) {
      setSelfIntro(prepData.self_introduction);
    }
  }, [prepData]);

  const handleGenerate = async () => {
    if (!selectedAppId) return;
    try {
      setGenerating(true);
      setError(null);
      const res = await client.post('/interviews/generate-full-kit', {
        application_id: selectedAppId,
      });
      setPrepData(res.data);
      setActiveTab('self_introduction');
      setExpandedQA(new Set());
      setExpandedStories(new Set());
      setCheckedQuestions(new Set());
      setCheckedTips(new Set());
      setIsEditingIntro(false);
    } catch {
      setError('生成面试准备失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const toggleQA = (index: number) => {
    setExpandedQA((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleStory = (id: number) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleQuestionCheck = (index: number) => {
    setCheckedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleTipCheck = (index: number) => {
    setCheckedTips((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  // Review functions
  const loadReviews = async () => {
    if (!selectedAppId) return;
    try {
      setReviewsLoading(true);
      setReviewError('');
      const { data } = await client.get<InterviewReview[]>(`/interviews/${selectedAppId}/reviews`);
      setReviews(Array.isArray(data) ? data : []);
    } catch {
      setReviewError('加载复盘记录失败');
    } finally {
      setReviewsLoading(false);
    }
  };

  const saveReview = async () => {
    if (!selectedAppId || !reviewDate) return;
    try {
      setReviewSaving(true);
      setReviewError('');
      await client.post(`/interviews/${selectedAppId}/review`, {
        interview_date: reviewDate,
        questions_review: reviewQuestions,
        self_rating: reviewRating,
        interviewer_feedback: reviewFeedback,
        improvements: reviewImprovements,
      });
      // Reset form
      setReviewDate('');
      setReviewQuestions('');
      setReviewRating(3);
      setReviewFeedback('');
      setReviewImprovements('');
      setShowReviewForm(false);
      loadReviews();
    } catch {
      setReviewError('保存失败，请重试');
    } finally {
      setReviewSaving(false);
    }
  };

  // Load reviews when tab switches to review
  useEffect(() => {
    if (activeTab === 'review' && selectedAppId) {
      loadReviews();
    }
  }, [activeTab]);

  // Group questions_to_ask by category
  const groupedQuestions = (prepData?.questions_to_ask ?? []).reduce<Record<string, QuestionToAsk[]>>((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">面试准备</h1>

      {/* Header: Select Application */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              选择投递记录
            </label>
            {loadingApps ? (
              <div className="flex items-center gap-2 text-gray-400 py-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">加载中...</span>
              </div>
            ) : applications.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">暂无投递记录，请先在岗位搜索中添加岗位并投递</p>
            ) : (
              <select
                value={selectedAppId ?? ''}
                onChange={(e) => setSelectedAppId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">请选择岗位...</option>
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.company} - {app.job_title} ({app.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 版本选择 */}
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-2">面试时间紧迫度</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'express', label: '极速版', desc: '3天内面试', icon: Zap, modules: '核心4模块' },
                { key: 'standard', label: '标准版', desc: '1周内面试', icon: Clock, modules: '完整10+模块' },
                { key: 'deep', label: '深度版', desc: '1周以上', icon: Target, modules: '完整+延伸' },
              ].map((v) => (
                <button
                  key={v.key}
                  onClick={() => setVersion(v.key as 'express' | 'standard' | 'deep')}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    version === v.key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <v.icon className={`h-5 w-5 mb-1 ${version === v.key ? 'text-blue-500' : 'text-gray-400'}`} />
                  <div className="font-medium text-sm">{v.label}</div>
                  <div className="text-xs text-gray-500">{v.desc}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{v.modules}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!selectedAppId || generating}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap"
          >
            {generating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                生成中...
              </>
            ) : (
              '生成面试准备'
            )}
          </button>
          <button
            onClick={() => navigate('/interview-practice')}
            className="flex items-center gap-2 px-5 py-2 bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 border border-purple-200 transition-colors text-sm font-medium whitespace-nowrap"
          >
            <Mic size={16} />
            开始模拟训练
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Transition Case Interview Tips */}
      {transitionCases.length > 0 && transitionCases.some((c) => c.interview_tips.length > 0) && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">参考案例：转型面试经验</h3>
          <div className="space-y-4">
            {transitionCases.filter((c) => c.interview_tips.length > 0).map((c) => (
              <div key={c.id} className="border-l-4 border-blue-400 pl-4">
                <p className="text-xs font-medium text-gray-700 mb-1">{c.title}</p>
                <ul className="space-y-1.5">
                  {c.interview_tips.map((tip, i) => (
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

      {/* Empty state */}
      {!prepData && !error && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-400 mb-3">
            <Target size={24} />
          </div>
          <p className="text-gray-500">选择上方投递记录后，点击"生成面试准备"开始</p>
        </div>
      )}

      {/* Tabbed Content */}
      {prepData && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto -mb-px">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Panels */}
          <div className="p-6">
            {/* Tab 1: 自我介绍 */}
            {activeTab === 'self_introduction' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">3分钟自我介绍</h2>
                  <button
                    onClick={() => setIsEditingIntro(!isEditingIntro)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {isEditingIntro ? '完成编辑' : '编辑'}
                  </button>
                </div>

                <p className="text-xs text-gray-400 mb-3">当前 {selfIntro.length || 0} / 800 字</p>

                <div className="mb-4 flex flex-wrap gap-2">
                  {['身份 10s', '核心能力 20s', '岗位匹配 20s', '收尾 10s'].map((label, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600"
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {isEditingIntro ? (
                  <textarea
                    value={selfIntro}
                    onChange={(e) => setSelfIntro(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-4 py-3 text-sm leading-relaxed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
                    rows={6}
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {selfIntro}
                  </div>
                )}
              </div>
            )}

            {/* Tab: 公司调研 */}
            {activeTab === 'company_research' && prepData.company_research && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-lg mb-3">产品现状分析</h3>
                  <div className="prose max-w-none text-gray-700 whitespace-pre-line">{prepData.company_research.product_analysis}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-lg mb-3">竞品对比分析</h3>
                  <div className="prose max-w-none text-gray-700 whitespace-pre-line">{prepData.company_research.competitor_analysis}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-lg mb-3">产品历史演进</h3>
                  <div className="prose max-w-none text-gray-700 whitespace-pre-line">{prepData.company_research.historical_evolution}</div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm">
                  <h3 className="font-semibold text-lg mb-3">多渠道用户声音</h3>
                  <div className="prose max-w-none text-gray-700 whitespace-pre-line">{prepData.company_research.user_voices}</div>
                </div>
              </div>
            )}

            {/* Tab 2: 核心问答 */}
            {activeTab === 'qa_pairs' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">核心问答 ({prepData.qa_pairs.length} 题)</h2>
                <div className="space-y-3">
                  {prepData.qa_pairs.map((qa: QAPair, index: number) => (
                    <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleQA(index)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[qa.category] || 'bg-gray-100 text-gray-600'}`}>
                            {qa.category}
                          </span>
                          <span className="text-sm font-medium text-gray-800 truncate">{qa.question}</span>
                        </div>
                        {expandedQA.has(index) ? (
                          <ChevronUp size={18} className="text-gray-400 flex-shrink-0 ml-2" />
                        ) : (
                          <ChevronDown size={18} className="text-gray-400 flex-shrink-0 ml-2" />
                        )}
                      </button>
                      {expandedQA.has(index) && (
                        <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                          {qa.examiner_intent && (
                            <div className="mb-2 mt-3 text-xs text-gray-400">
                              面试官意图：{qa.examiner_intent}
                            </div>
                          )}
                          <p className="text-sm text-gray-600 leading-relaxed mt-3">{qa.answer}</p>
                          {qa.key_points && qa.key_points.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs font-medium text-gray-500">回答要点：</span>
                              <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                                {qa.key_points.map((point, i) => (
                                  <li key={i}>{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: 故事库 */}
            {activeTab === 'stories' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">故事化表达故事库</h2>
                <p className="text-sm text-gray-500 mb-4">每个故事对应岗位要求，点击展开查看完整内容</p>
                <div className="space-y-4">
                  {prepData.stories.map((story: Story) => (
                    <div key={story.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleStory(story.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen size={16} className="text-blue-500 flex-shrink-0" />
                          <span className="text-sm font-medium text-gray-800">{story.title}</span>
                        </div>
                        {expandedStories.has(story.id) ? (
                          <ChevronUp size={18} className="text-gray-400 flex-shrink-0 ml-2" />
                        ) : (
                          <ChevronDown size={18} className="text-gray-400 flex-shrink-0 ml-2" />
                        )}
                      </button>
                      {expandedStories.has(story.id) && (
                        <div className="px-4 pb-4 border-t border-gray-100">
                          {story.jd_link && (
                            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mb-2 mt-3">
                              <Link2 size={12} /> 对应JD：{story.jd_link}
                            </span>
                          )}
                          <div className="mt-3 space-y-3">
                            <StoryField label="Situation 背景" value={story.situation} />
                            <StoryField label="Task 任务" value={story.task} />
                            <StoryField label="Action 行动" value={story.action} />
                            <StoryField label="Result 结果" value={story.result} />
                            <StoryField label="Reflection 反思" value={story.reflection} />
                          </div>
                          {story.methodology && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <span className="text-xs font-medium text-gray-500">可复用方法论</span>
                              <p className="text-sm text-gray-600 mt-1">{story.methodology}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: 反问清单 */}
            {activeTab === 'questions_to_ask' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">反问清单</h2>
                <p className="text-sm text-gray-500 mb-4">
                  已准备 {checkedQuestions.size}/{prepData.questions_to_ask.length} 个问题
                </p>
                <div className="space-y-5">
                  {Object.entries(groupedQuestions).map(([category, questions]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">{category}</h3>
                      <div className="space-y-1.5">
                        {questions.map((q) => {
                          const globalIndex = prepData.questions_to_ask.indexOf(q);
                          return (
                            <label
                              key={globalIndex}
                              className="flex items-start gap-3 p-2.5 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                              <button
                                onClick={() => toggleQuestionCheck(globalIndex)}
                                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                  checkedQuestions.has(globalIndex)
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'border-gray-300 hover:border-blue-400'
                                }`}
                                aria-label={checkedQuestions.has(globalIndex) ? `取消勾选: ${q.question}` : `勾选: ${q.question}`}
                              >
                                {checkedQuestions.has(globalIndex) && <Check size={12} className="text-white" />}
                              </button>
                              <span
                                className={`text-sm leading-relaxed ${
                                  checkedQuestions.has(globalIndex) ? 'text-gray-400 line-through' : 'text-gray-700'
                                }`}
                              >
                                {q.question}
                              </span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {q.timing && (
                                  <span className="inline-block text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                    提问时机：{q.timing}
                                  </span>
                                )}
                                {q.value && (
                                  <span className="inline-block text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                                    体现：{q.value}
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 5: 注意事项 */}
            {activeTab === 'tips' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">面试注意事项</h2>
                <p className="text-sm text-gray-500 mb-4">
                  已完成 {checkedTips.size}/{prepData.tips.length} 项准备
                </p>

                {/* Date reminder */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5">
                  <div className="flex items-start gap-2">
                    <ClipboardCheck size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">面试前提醒</p>
                      <p className="text-sm text-blue-600 mt-0.5">
                        请确认面试时间和地点，提前做好出行或设备准备
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {prepData.tips.map((tip: string, index: number) => (
                    <label
                      key={index}
                      className="flex items-start gap-3 p-2.5 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <button
                        onClick={() => toggleTipCheck(index)}
                        className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          checkedTips.has(index)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 hover:border-blue-400'
                        }`}
                        aria-label={checkedTips.has(index) ? `取消标记: ${tip}` : `标记完成: ${tip}`}
                      >
                        {checkedTips.has(index) && <Check size={12} className="text-white" />}
                      </button>
                      <span
                        className={`text-sm leading-relaxed ${
                          checkedTips.has(index) ? 'text-gray-400 line-through' : 'text-gray-700'
                        }`}
                      >
                        {tip}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: 薪资谈判 */}
            {activeTab === 'salary_negotiation' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">薪资谈判要点</h2>
                {prepData.salary_negotiation ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                      {prepData.salary_negotiation}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <DollarSign size={32} className="mx-auto mb-2 text-gray-300" />
                    <p>暂无薪资谈判建议，请先生成面试准备</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: 弱点应对 */}
            {activeTab === 'weaknesses' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">弱点应对策略</h2>
                {prepData.weaknesses && prepData.weaknesses.length > 0 ? (
                  <div className="space-y-4">
                    {prepData.weaknesses.map((w, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                          <span className="font-medium text-gray-800">{w.weakness}</span>
                        </div>
                        <div className="ml-7 space-y-2">
                          <p className="text-sm text-gray-600">
                            <span className="text-xs font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded">诚实回答</span>
                            {' '}{w.honest_answer}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">化解策略</span>
                            {' '}{w.mitigation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <AlertTriangle size={32} className="mx-auto mb-2 text-gray-300" />
                    <p>暂无弱点应对分析，请先生成面试准备</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: 红旗信号 */}
            {activeTab === 'red_flags' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">红旗信号应对</h2>
                {prepData.red_flags && prepData.red_flags.length > 0 ? (
                  <div className="space-y-3">
                    {prepData.red_flags.map((rf, i) => (
                      <div key={i} className="border border-red-100 bg-red-50 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs shrink-0">!</span>
                          <span className="font-medium text-red-800">{rf.flag}</span>
                        </div>
                        <div className="ml-7">
                          <p className="text-sm text-gray-700">
                            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">应对</span>
                            {' '}{rf.response}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Shield size={32} className="mx-auto mb-2 text-gray-300" />
                    <p>暂无红旗信号分析，请先生成面试准备</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: 能力差距 */}
            {activeTab === 'gap_analysis' && prepData.gap_analysis && (
              <div className="space-y-6">
                {prepData.gap_analysis.hidden_skills && prepData.gap_analysis.hidden_skills.length > 0 && (
                  <div className="bg-white p-6 rounded-lg shadow-sm">
                    <h3 className="font-semibold text-lg mb-3">简历未体现的隐性技能</h3>
                    <div className="flex flex-wrap gap-2">
                      {prepData.gap_analysis.hidden_skills.map((skill, i) => (
                        <span key={i} className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                {prepData.gap_analysis.priority1_must_fill && prepData.gap_analysis.priority1_must_fill.length > 0 && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-red-400">
                    <h3 className="font-semibold text-lg mb-3 text-red-700">Priority 1 — 必须补（面试高频 + JD核心）</h3>
                    <div className="space-y-4">
                      {prepData.gap_analysis.priority1_must_fill.map((item, i) => (
                        <div key={i} className="bg-red-50 p-4 rounded-lg">
                          <p className="font-medium text-red-800">{item.gap}</p>
                          <p className="text-sm text-gray-600 mt-1"><strong>行动：</strong>{item.action}</p>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>⏱ 预计{item.estimated_hours}小时</span>
                            <span>📚 {item.resource}</span>
                          </div>
                          {item.checkpoints && item.checkpoints.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs text-gray-500">检查点：</span>
                              <ul className="list-disc list-inside text-xs text-gray-500 mt-1">
                                {item.checkpoints.map((cp, j) => <li key={j}>{cp}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {prepData.gap_analysis.priority2_should_fill && prepData.gap_analysis.priority2_should_fill.length > 0 && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-400">
                    <h3 className="font-semibold text-lg mb-3 text-yellow-700">Priority 2 — 争取补（JD提及但非核心）</h3>
                    <div className="space-y-4">
                      {prepData.gap_analysis.priority2_should_fill.map((item, i) => (
                        <div key={i} className="bg-yellow-50 p-4 rounded-lg">
                          <p className="font-medium text-yellow-800">{item.gap}</p>
                          <p className="text-sm text-gray-600 mt-1"><strong>行动：</strong>{item.action}</p>
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>⏱ 预计{item.estimated_hours}小时</span>
                            <span>📚 {item.resource}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {prepData.gap_analysis.priority3_nice_to_have && prepData.gap_analysis.priority3_nice_to_have.length > 0 && (
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-400">
                    <h3 className="font-semibold text-lg mb-3 text-green-700">Priority 3 — 了解即可（加分项）</h3>
                    <div className="space-y-4">
                      {prepData.gap_analysis.priority3_nice_to_have.map((item, i) => (
                        <div key={i} className="bg-green-50 p-4 rounded-lg">
                          <p className="font-medium text-green-800">{item.gap}</p>
                          <p className="text-sm text-gray-600 mt-1"><strong>行动：</strong>{item.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: 面试复盘 */}
            {activeTab === 'review' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">面试复盘</h2>
                  {!showReviewForm && (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      disabled={!selectedAppId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save size={14} />
                      添加复盘
                    </button>
                  )}
                </div>

                {/* Review Form */}
                {showReviewForm && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3">新增复盘记录</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">面试日期</label>
                        <input
                          type="date"
                          value={reviewDate}
                          onChange={(e) => setReviewDate(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">回答质量自评</label>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                            >
                              <Star
                                size={24}
                                className={
                                  star <= reviewRating
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-gray-300'
                                }
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">面试问题回顾</label>
                        <textarea
                          value={reviewQuestions}
                          onChange={(e) => setReviewQuestions(e.target.value)}
                          rows={3}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                          placeholder="回顾面试中被问到的问题..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">面试官反馈</label>
                        <textarea
                          value={reviewFeedback}
                          onChange={(e) => setReviewFeedback(e.target.value)}
                          rows={2}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                          placeholder="面试官的反馈和评价..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">改进点</label>
                        <textarea
                          value={reviewImprovements}
                          onChange={(e) => setReviewImprovements(e.target.value)}
                          rows={2}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                          placeholder="需要改进的地方..."
                        />
                      </div>
                    </div>
                    {reviewError && (
                      <p className="text-red-500 text-xs mt-2">{reviewError}</p>
                    )}
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => { setShowReviewForm(false); setReviewError(''); }}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                      >
                        取消
                      </button>
                      <button
                        onClick={saveReview}
                        disabled={!reviewDate || reviewSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {reviewSaving && <Loader2 size={14} className="animate-spin" />}
                        保存
                      </button>
                    </div>
                  </div>
                )}

                {/* Reviews List */}
                {reviewsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={20} className="animate-spin text-indigo-500" />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardList size={36} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-400 text-sm">暂无复盘记录</p>
                    <p className="text-gray-400 text-xs mt-1">面试后记得复盘，持续改进</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {new Date(review.interview_date).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={16}
                                className={
                                  star <= review.self_rating
                                    ? 'text-amber-400 fill-amber-400'
                                    : 'text-gray-300'
                                }
                              />
                            ))}
                          </div>
                        </div>
                        {review.questions_review && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-gray-500 mb-0.5">面试问题回顾</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.questions_review}</p>
                          </div>
                        )}
                        {review.interviewer_feedback && (
                          <div className="mb-2">
                            <p className="text-xs font-medium text-gray-500 mb-0.5">面试官反馈</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.interviewer_feedback}</p>
                          </div>
                        )}
                        {review.improvements && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-0.5">改进点</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{review.improvements}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StoryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <p className="text-sm text-gray-700 leading-relaxed mt-0.5">{value}</p>
    </div>
  );
}