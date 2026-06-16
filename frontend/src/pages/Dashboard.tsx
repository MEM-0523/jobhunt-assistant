import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Target,
  Search,
  FileText,
  ArrowRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Settings,
  CheckCircle2,
  FileBarChart,
  Lightbulb,
  Hash,
  Star,
  Send,
  Users,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import client from '../api/client';
import type { DashboardStats, Profile, WeeklyReport } from '../types';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek}周前`;
}

const FUNNEL_STAGES = [
  { key: '待投递', label: '搜索', short: '搜' },
  { key: '已投递', label: '已投递', short: '投' },
  { key: '面试邀约', label: '面试邀约', short: '面' },
  { key: '面试中', label: '面试通过', short: '通' },
  { key: 'offer', label: 'Offer', short: 'O' },
];

const statCards = [
  { key: 'total_jobs_searched', label: '搜索岗位数', icon: Search, color: 'blue' },
  { key: 'total_applications', label: '已投递', icon: Send, color: 'green' },
  { key: 'in_interview', label: '面试中', icon: Users, color: 'yellow' },
  { key: 'offers', label: 'Offer', icon: Trophy, color: 'purple' },
] as const;

const colorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' },
  green: { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' },
};

const STEPS = [
  {
    icon: Target,
    title: '发现可迁移能力',
    desc: '了解你现有的能力可以匹配哪些岗位',
    btn: '开始分析',
    to: '/career-transition',
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    icon: Search,
    title: '搜索转型岗位',
    desc: '找到适合转型者的工作岗位',
    btn: '搜索岗位',
    to: '/search',
    gradient: 'from-purple-500 to-purple-600',
  },
  {
    icon: FileText,
    title: '打造转型简历',
    desc: '把现有经验包装成目标岗位的竞争力',
    btn: '优化简历',
    to: '/resume',
    gradient: 'from-green-500 to-green-600',
  },
];

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    Promise.all([
      client.get('/applications/stats'),
      client.get('/profile'),
    ])
      .then(([statsRes, profileRes]) => {
        setStats(statsRes.data);
        setProfile(profileRes.data);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || '加载数据失败');
      })
      .finally(() => setLoading(false));
  }, []);

  const generateWeeklyReport = async () => {
    try {
      setReportLoading(true);
      setShowReport(true);
      const { data } = await client.get<WeeklyReport>('/jobs/weekly-report');
      setWeeklyReport(data);
    } catch {
      setWeeklyReport(null);
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  const isEmpty =
    !stats ||
    (stats.total_jobs_searched === 0 && stats.total_applications === 0);

  const hasNoProfile = !profile || (!profile.name && profile.salary_min === 0 && profile.salary_max === 0);
  const onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true';

  if (!onboardingCompleted && isEmpty && hasNoProfile) {
    return (
      <OnboardingWizard onComplete={() => localStorage.setItem('onboarding_completed', 'true')} />
    );
  }

  const displayName = profile?.name || user?.email || '用户';

  const transitionTarget = (() => {
    const prefs = profile?.preferences;
    if (!prefs) return null;
    const current = prefs.current_industry as string | undefined;
    const target = prefs.target_position as string | undefined;
    if (current && target) return `${current} → ${target}`;
    if (target) return `目标：${target}`;
    return null;
  })();

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            你好，{displayName}
          </h1>
          <p className="text-gray-500 mt-1">你的转型求职进度</p>
        </div>
        {transitionTarget && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium">
            <Target size={16} />
            {transitionTarget}
          </div>
        )}
      </div>

      {/* Three-step guide cards */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-0">
        {STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center flex-1 gap-0">
            <div
              className={`flex-1 bg-gradient-to-br ${step.gradient} rounded-xl p-6 text-white cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl`}
              onClick={() => navigate(step.to)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <step.icon size={22} />
                </div>
                <h3 className="text-lg font-bold">{step.title}</h3>
              </div>
              <p className="text-white/80 text-sm mb-4">{step.desc}</p>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                onClick={(e) => { e.stopPropagation(); navigate(step.to); }}
              >
                {step.btn}
                <ArrowRight size={14} />
              </button>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="hidden md:flex items-center justify-center px-1 shrink-0">
                <ArrowRight size={24} className="text-gray-300" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent activity section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stat Cards */}
        {!isEmpty && (
          <div className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const c = colorMap[card.color];
              const value = stats[card.key as keyof DashboardStats] as number;
              return (
                <div
                  key={card.key}
                  className={`bg-white rounded-lg shadow-sm border ${c.border} p-5`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${c.bg}`}>
                      <card.icon className={`h-5 w-5 ${c.text}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{value}</p>
                      <p className="text-sm text-gray-500">{card.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Funnel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">投递漏斗</h2>
          {isEmpty ? (
            <div className="text-center py-4 text-gray-400">
              <p className="text-sm">开始你的第一次分析</p>
              <Link
                to="/search"
                className="text-indigo-600 hover:text-indigo-700 text-sm mt-2 inline-block"
              >
                去搜索岗位 →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                const breakdown = stats.status_breakdown || {};
                const funnelData = FUNNEL_STAGES.map((stage) => ({
                  ...stage,
                  count: breakdown[stage.key] || 0,
                }));
                const maxFunnel = Math.max(...funnelData.map((f) => f.count), 1);
                const gradientColors = [
                  'bg-blue-500', 'bg-blue-400', 'bg-indigo-400',
                  'bg-green-400', 'bg-green-500',
                ];
                return funnelData.map((stage, i) => {
                  const pct = Math.round((stage.count / maxFunnel) * 100);
                  return (
                    <div key={stage.key} className="flex items-center gap-3">
                      <span className="w-16 text-sm text-gray-500 text-right shrink-0">
                        {stage.label}
                      </span>
                      <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${gradientColors[i]} flex items-center justify-end px-3 transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        >
                          <span className="text-white text-sm font-medium">
                            {stage.count}
                          </span>
                        </div>
                      </div>
                      <span className="w-10 text-xs text-gray-400 shrink-0">
                        {pct}%
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Weekly Changes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">本周新增</h2>
          {isEmpty ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              暂无数据
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">搜索</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">
                    {stats.weekly_change.searches}
                  </span>
                  <span className="text-xs text-gray-400">次</span>
                  {stats.weekly_change.searches > 0 ? (
                    <TrendingUp size={16} className="text-green-500" />
                  ) : (
                    <TrendingDown size={16} className="text-gray-300" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <span className="text-sm text-gray-600">投递</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">
                    {stats.weekly_change.applications}
                  </span>
                  <span className="text-xs text-gray-400">份</span>
                  {stats.weekly_change.applications > 0 ? (
                    <TrendingUp size={16} className="text-green-500" />
                  ) : (
                    <TrendingDown size={16} className="text-gray-300" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-gray-600">面试</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-900">
                    {stats.weekly_change.interviews}
                  </span>
                  <span className="text-xs text-gray-400">个</span>
                  {stats.weekly_change.interviews > 0 ? (
                    <TrendingUp size={16} className="text-green-500" />
                  ) : (
                    <TrendingDown size={16} className="text-gray-300" />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Activities */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">最近活动</h2>
          {!stats?.recent_activities || stats.recent_activities.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              {isEmpty ? '开始你的第一次分析' : '暂无活动'}
            </div>
          ) : (
            <div className="space-y-4">
              {stats.recent_activities.map((act, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2" />
                    {i < stats.recent_activities.length - 1 && (
                      <div className="w-px flex-1 bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">
                      {act.description}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                      <Clock size={12} />
                      <span>{timeAgo(act.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly Report */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileBarChart size={20} className="text-indigo-500" />
              本周周报
            </h2>
            <button
              onClick={generateWeeklyReport}
              disabled={reportLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {reportLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  生成中...
                </>
              ) : (
                '生成本周周报'
              )}
            </button>
          </div>

          {showReport && (
            weeklyReport ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-indigo-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-indigo-600">{weeklyReport.searches_this_week}</p>
                    <p className="text-xs text-gray-500">本周搜索</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{weeklyReport.new_jobs_found}</p>
                    <p className="text-xs text-gray-500">新岗位发现</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600">{weeklyReport.new_applications}</p>
                    <p className="text-xs text-gray-500">新增投递</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {Object.values(weeklyReport.status_changes || {}).reduce((a, b) => a + b, 0)}
                    </p>
                    <p className="text-xs text-gray-500">状态变化</p>
                  </div>
                </div>

                {Object.keys(weeklyReport.status_changes).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Star size={14} className="text-yellow-500" />
                      本周状态变化
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(weeklyReport.status_changes).map(([status, count]) => (
                        <span key={status} className="px-2.5 py-1 bg-yellow-50 border border-yellow-200 rounded-full text-xs text-yellow-700">
                          {status}：{count}个
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {weeklyReport.hot_keywords.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Hash size={14} className="text-indigo-500" />
                      热门搜索关键词
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {weeklyReport.hot_keywords.map((kw, i) => (
                        <span key={i} className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-xs text-indigo-600">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {weeklyReport.suggestions.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Lightbulb size={14} className="text-amber-500" />
                      建议
                    </h3>
                    <div className="space-y-1.5">
                      {weeklyReport.suggestions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                          <span>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : reportLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                加载周报失败，请稍后重试
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

const ONBOARDING_STEPS = [
  {
    num: 1,
    title: '完善个人画像',
    desc: '告诉系统你的求职偏好，让我们更懂你',
    to: '/settings?wizard=1',
    label: '去设置',
    icon: Settings,
  },
  {
    num: 2,
    title: '上传简历',
    desc: '上传你的简历，获取个性化优化建议',
    to: '/resume',
    label: '上传简历',
    icon: FileText,
  },
  {
    num: 3,
    title: '搜索岗位',
    desc: '输入关键词，发现匹配你的职位',
    to: '/search',
    label: '开始搜索',
    icon: Search,
  },
  {
    num: 4,
    title: '投递追踪',
    desc: '记录投递进度，实时掌握求职状态',
    to: '',
    label: '自动完成',
    icon: CheckCircle2,
    done: true,
  },
];

function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          🎉 欢迎使用转型导航！
        </h1>
        <p className="text-gray-500">只需4步，开启你的智能求职之旅：</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {ONBOARDING_STEPS.map((step) => (
          <div
            key={step.num}
            className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col items-center text-center ${
              step.done ? 'opacity-60' : ''
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-3 ${
                step.done
                  ? 'bg-green-100 text-green-600'
                  : 'bg-indigo-100 text-indigo-600'
              }`}
            >
              {step.num}
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
            <p className="text-sm text-gray-500 mb-4 flex-1">{step.desc}</p>
            {step.done ? (
              <span className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-green-50 text-green-600 text-sm font-medium">
                <CheckCircle2 size={14} />
                {step.label}
              </span>
            ) : (
              <Link
                to={step.to}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                {step.label}
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="text-center">
        <button
          onClick={onComplete}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          跳过引导，直接进入主页
        </button>
      </div>
    </div>
  );
}