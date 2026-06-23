import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Send, Loader2, AlertCircle, Play, RotateCcw,
  CheckCircle2, XCircle, AlertTriangle, Lightbulb, Target, Sparkles,
  Star, ChevronDown,
} from 'lucide-react';
import client from '../api/client';

interface Feedback {
  what_worked: string;
  what_unclear: string;
  what_not_to_say: string;
  star_improved: string;
  practice_drill: string;
}

interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
  feedback?: Feedback;
  questionType?: string;
}

interface HistorySession {
  id: number;
  target_role: string;
  created_at: string;
  follow_up_count: number;
}

interface FavoriteJob {
  id: number;
  job_id: number;
  job?: {
    id: number;
    title: string;
    company: string;
    jd_text: string;
  };
  created_at: string;
}

export default function InterviewPractice() {
  const [targetRole, setTargetRole] = useState('');
  const [jd, setJd] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showFavJobs, setShowFavJobs] = useState(false);
  const [favJobs, setFavJobs] = useState<FavoriteJob[]>([]);
  const [loadingFavJobs, setLoadingFavJobs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStart = async () => {
    if (!targetRole.trim()) {
      setError('请输入目标岗位');
      return;
    }
    try {
      setStarting(true);
      setError(null);
      setMessages([]);
      setEnded(false);
      setSessionId(null);

      const { data } = await client.post('/interviews/practice/start', {
        target_role: targetRole.trim(),
        job_description: jd.trim() || undefined,
      });

      setSessionId(data.session_id);
      setMessages([
        {
          role: 'ai',
          content: data.question,
          questionType: data.question_type,
        },
      ]);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || '开始练习失败，请重试'
          : '开始练习失败，请重试';
      setError(message);
    } finally {
      setStarting(false);
    }
  };

  const handleAnswer = async () => {
    if (!sessionId || !answer.trim()) return;
    try {
      setLoading(true);
      setError(null);

      const userMsg: ChatMessage = { role: 'user', content: answer.trim() };
      setMessages((prev) => [...prev, userMsg]);
      const currentAnswer = answer.trim();
      setAnswer('');

      const { data } = await client.post('/interviews/practice/answer', {
        session_id: sessionId,
        answer: currentAnswer,
      });

      // Add feedback to the user message
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, feedback: data } : m
        )
      );

      if (data.next_action === 'end') {
        setEnded(true);
      } else if (data.next_question) {
        setMessages((prev) => [
          ...prev,
          { role: 'ai', content: data.next_question },
        ]);
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || '提交回答失败，请重试'
          : '提交回答失败，请重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSessionId(null);
    setMessages([]);
    setAnswer('');
    setEnded(false);
    setError(null);
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data } = await client.get('/interviews/practice/history');
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadFavJobs = async () => {
    try {
      setLoadingFavJobs(true);
      const { data } = await client.get('/jobs/favorites');
      setFavJobs(Array.isArray(data?.results) ? data.results : []);
    } catch {
      // ignore
    } finally {
      setLoadingFavJobs(false);
    }
  };

  const handleSelectFavJob = (fav: FavoriteJob) => {
    if (fav.job) {
      setTargetRole(fav.job.title || '');
      setJd(fav.job.jd_text || '');
    }
    setShowFavJobs(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!loading && !ended && answer.trim()) {
        handleAnswer();
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">面试交互式训练</h1>
        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) loadHistory();
          }}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1.5"
        >
          <MessageSquare size={14} />
          历史记录
        </button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">历史练习会话</h3>
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-gray-400 py-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">暂无历史记录</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-md hover:bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.target_role}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.created_at).toLocaleString('zh-CN')} · 追问 {s.follow_up_count} 次
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Setup Panel */}
      {!sessionId && !starting && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="space-y-4">
            {/* 从收藏岗位导入 */}
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <button
                onClick={() => {
                  setShowFavJobs(!showFavJobs);
                  if (!showFavJobs) loadFavJobs();
                }}
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <Star size={14} />
                从收藏岗位导入
                <ChevronDown size={12} className={showFavJobs ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
            </div>

            {showFavJobs && (
              <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                {loadingFavJobs ? (
                  <div className="flex items-center gap-2 text-gray-400 py-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">加载收藏岗位...</span>
                  </div>
                ) : favJobs.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2 text-center">暂无收藏岗位</p>
                ) : (
                  <div className="space-y-1.5">
                    {favJobs.map(fav => (
                      <button
                        key={fav.id}
                        onClick={() => handleSelectFavJob(fav)}
                        className="w-full text-left p-2 rounded-md hover:bg-white transition-colors border border-transparent hover:border-indigo-200"
                      >
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {fav.job?.title || '未知岗位'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {fav.job?.company || '未知公司'}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                目标岗位 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="例如：产品经理、前端工程师、数据分析师"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                岗位描述（可选）
              </label>
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder="粘贴JD可以让AI提问更精准..."
                rows={5}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y"
              />
            </div>
            <button
              onClick={handleStart}
              disabled={!targetRole.trim()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-md font-medium text-sm hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={16} />
              开始练习
            </button>
          </div>
        </div>
      )}

      {/* Starting state */}
      {starting && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Loader2 size={32} className="animate-spin mx-auto text-indigo-600 mb-3" />
          <p className="text-gray-500">正在为你准备面试问题...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Chat Area */}
      {sessionId && (
        <div className="bg-white rounded-lg shadow flex flex-col" style={{ minHeight: '500px' }}>
          {/* Chat header */}
          <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-indigo-600" />
              <span className="text-sm font-medium text-gray-800">{targetRole}</span>
            </div>
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <RotateCcw size={14} />
              重新开始
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto" style={{ maxHeight: '600px' }}>
            {messages.map((msg, idx) => (
              <div key={idx}>
                {/* AI Message */}
                {msg.role === 'ai' && (
                  <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Sparkles size={16} className="text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      {msg.questionType && (
                        <span className="inline-block text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full mb-1.5">
                          {msg.questionType}
                        </span>
                      )}
                      <div className="bg-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-800 leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )}

                {/* User Message */}
                {msg.role === 'user' && (
                  <div className="flex flex-col items-end">
                    <div className="bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm leading-relaxed max-w-[80%]">
                      {msg.content}
                    </div>
                    {msg.feedback && (
                      <FeedbackCard feedback={msg.feedback} />
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={16} className="text-indigo-600" />
                </div>
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-gray-500" />
                </div>
              </div>
            )}

            {/* End message */}
            {ended && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2 text-green-700">
                <CheckCircle2 size={18} />
                <span className="text-sm font-medium">练习结束</span>
                <span className="text-sm text-green-600">— 你已完成本次面试训练，点击"重新开始"可再次练习</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          {!ended && (
            <div className="border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你的回答... (Enter发送，Shift+Enter换行)"
                  rows={2}
                  disabled={loading}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none disabled:bg-gray-50"
                />
                <button
                  onClick={handleAnswer}
                  disabled={!answer.trim() || loading}
                  className="self-end px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-sm font-medium"
                >
                  <Send size={14} />
                  提交回答
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: Feedback }) {
  return (
    <div className="mt-3 w-full bg-white border border-indigo-200 rounded-lg overflow-hidden shadow-sm">
      <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100 flex items-center gap-2">
        <Lightbulb size={16} className="text-indigo-600" />
        <span className="text-sm font-semibold text-indigo-800">AI 反馈</span>
      </div>
      <div className="p-4 space-y-3">
        <FeedbackItem
          icon={<CheckCircle2 size={14} className="text-green-600" />}
          label="做得好的"
          value={feedback.what_worked}
          color="green"
        />
        <FeedbackItem
          icon={<AlertTriangle size={14} className="text-amber-500" />}
          label="不够清晰的"
          value={feedback.what_unclear}
          color="amber"
        />
        <FeedbackItem
          icon={<XCircle size={14} className="text-red-500" />}
          label="不该说的"
          value={feedback.what_not_to_say}
          color="red"
        />
        <FeedbackItem
          icon={<Sparkles size={14} className="text-indigo-500" />}
          label="STAR优化建议"
          value={feedback.star_improved}
          color="indigo"
        />
        <FeedbackItem
          icon={<Target size={14} className="text-purple-500" />}
          label="练习建议"
          value={feedback.practice_drill}
          color="purple"
        />
      </div>
    </div>
  );
}

function FeedbackItem({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'green' | 'amber' | 'red' | 'indigo' | 'purple';
}) {
  const bgColors: Record<string, string> = {
    green: 'bg-green-50',
    amber: 'bg-amber-50',
    red: 'bg-red-50',
    indigo: 'bg-indigo-50',
    purple: 'bg-purple-50',
  };
  return (
    <div className={`rounded-md p-3 ${bgColors[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-xs font-semibold text-gray-700">{label}</span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}
