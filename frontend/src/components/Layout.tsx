import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  FileText,
  ListChecks,
  Target,
  Settings,
  X,
  MessageSquare,
  Loader2,
  CheckCircle2,
  Heart,
  Zap,
  ClipboardList,
  FileSearch,
} from 'lucide-react';
import Navbar from './Navbar';
import client from '../api/client';

const sidebarItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '首页' },
  { to: '/search', icon: Search, label: '搜索岗位' },
  { to: '/favorites', icon: Heart, label: '收藏岗位' },
  { to: '/direct-analyze', icon: FileSearch, label: 'JD直推' },
  { to: '/career-transition', icon: Zap, label: '能力迁移' },
  { to: '/assessment', icon: ClipboardList, label: '职业测评' },
  { to: '/resume', icon: FileText, label: '我的简历' },
  { to: '/applications', icon: ListChecks, label: '投递追踪' },
  { to: '/interview-prep', icon: Target, label: '面试准备' },
  { to: '/settings', icon: Settings, label: '设置' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('功能建议');
  const [feedbackContent, setFeedbackContent] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const feedbackTypes = ['功能建议', 'Bug报告', '使用体验', '其他'];

  const handleFeedbackSubmit = async () => {
    if (!feedbackContent.trim()) return;
    setFeedbackLoading(true);
    try {
      await client.post('/feedback', {
        type: feedbackType,
        content: feedbackContent.trim(),
      });
      setFeedbackSuccess(true);
      setTimeout(() => {
        setFeedbackOpen(false);
        setFeedbackSuccess(false);
        setFeedbackContent('');
        setFeedbackType('功能建议');
      }, 1500);
    } catch {
      // silently fail, user can retry
    } finally {
      setFeedbackLoading(false);
    }
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-600 font-medium'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 lg:border-none shrink-0">
          <span className="text-xl font-bold text-indigo-600">转型导航</span>
          <button
            className="lg:hidden p-1 rounded text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭菜单"
          >
            <X size={20} />
          </button>
        </div>

        {/* Sidebar nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={linkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Floating feedback button */}
      <button
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
      >
        <MessageSquare size={18} />
        <span className="text-sm font-medium">反馈</span>
      </button>

      {/* Feedback modal */}
      {feedbackOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !feedbackLoading && setFeedbackOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <button
              onClick={() => setFeedbackOpen(false)}
              disabled={feedbackLoading}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X size={20} />
            </button>

            <h2 className="text-lg font-semibold text-gray-900 mb-4">提交反馈</h2>

            {feedbackSuccess ? (
              <div className="flex flex-col items-center py-8 text-green-600">
                <CheckCircle2 size={48} className="mb-3" />
                <p className="text-lg font-medium">感谢你的反馈！</p>
              </div>
            ) : (
              <>
                {/* Feedback type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">反馈类型</label>
                  <div className="flex flex-wrap gap-2">
                    {feedbackTypes.map((t) => (
                      <button
                        key={t}
                        onClick={() => setFeedbackType(t)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          feedbackType === t
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback content */}
                <div className="mb-5">
                  <textarea
                    value={feedbackContent}
                    onChange={(e) => setFeedbackContent(e.target.value)}
                    placeholder="请描述你的使用体验或建议..."
                    rows={4}
                    className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={handleFeedbackSubmit}
                  disabled={feedbackLoading || !feedbackContent.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {feedbackLoading && <Loader2 size={16} className="animate-spin" />}
                  {feedbackLoading ? '提交中...' : '提交反馈'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}