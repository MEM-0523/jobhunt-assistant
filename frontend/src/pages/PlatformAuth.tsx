import { useState, useEffect, useRef } from 'react';
import {
  Link2,
  Unlink,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  KeyRound,
  Briefcase,
  Globe,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import client from '../api/client';

interface PlatformStatus {
  platform: string;
  status: 'active' | 'expired' | 'disconnected';
  expires_at: string | null;
}

const PLATFORM_NAMES: Record<string, string> = {
  boss: 'BOSS直聘',
  liepin: '猎聘',
  '51job': '前程无忧',
  himalayas: 'Himalayas',
  remotive: 'Remotive',
};

const PLATFORM_ICONS: Record<string, typeof Briefcase> = {
  boss: Briefcase,
  liepin: KeyRound,
  '51job': Briefcase,
  himalayas: Globe,
  remotive: Globe,
};

const STATUS_LABELS: Record<string, string> = {
  active: '已连接',
  expired: '已过期',
  disconnected: '未连接',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-orange-100 text-orange-700',
  disconnected: 'bg-gray-100 text-gray-600',
};

function getPlatformName(platform: string): string {
  return PLATFORM_NAMES[platform] || platform;
}

function getErrorMessage(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { detail?: string } }; message?: string };
  return err?.response?.data?.detail || err?.message || fallback;
}

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return null;
  const now = Date.now();
  const diff = d.getTime() - now;
  if (diff <= 0) return '已过期';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}天${hours}小时后过期`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}小时${mins}分钟后过期`;
}

export default function PlatformAuth() {
  const [statuses, setStatuses] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [liepinToken, setLiepinToken] = useState('');
  const [liepinSaving, setLiepinSaving] = useState(false);
  const [liepinValidating, setLiepinValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cookieInputs, setCookieInputs] = useState<Record<string, string>>({});
  const [cookieSaving, setCookieSaving] = useState<string | null>(null);
  const [cookieValidating, setCookieValidating] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStatus = async (): Promise<PlatformStatus[]> => {
    try {
      const { data } = await client.get<{ platforms: PlatformStatus[] }>('/platform-auth/status');
      setStatuses(data.platforms);
      return data.platforms;
    } catch (e) {
      setError(getErrorMessage(e, '加载状态失败'));
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    client
      .get<{ platforms: PlatformStatus[] }>('/platform-auth/status')
      .then(({ data }) => {
        if (!cancelled) setStatuses(data.platforms);
      })
      .catch((e) => {
        if (!cancelled) setError(getErrorMessage(e, '加载状态失败'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const getStatus = (platform: string): PlatformStatus | undefined =>
    statuses.find((s) => s.platform === platform);

  const handleDisconnect = async (platform: string) => {
    setError('');
    setSuccess('');
    try {
      await client.delete(`/platform-auth/${platform}`);
      await loadStatus();
      setSuccess(`${getPlatformName(platform)} 已断开`);
    } catch (e) {
      setError(`断开失败: ${getErrorMessage(e, '未知错误')}`);
    }
  };

  const handleSaveLiepinToken = async () => {
    if (!liepinToken.trim()) {
      setError('请输入猎聘 Token');
      return;
    }
    setLiepinSaving(true);
    setError('');
    setSuccess('');
    try {
      await client.post('/platform-auth/liepin/token', { token: liepinToken.trim() });
      setSuccess('猎聘 Token 保存成功');
      setLiepinToken('');
      await loadStatus();
    } catch (e) {
      setError(`保存失败: ${getErrorMessage(e, '未知错误')}`);
    } finally {
      setLiepinSaving(false);
    }
  };

  const handleValidateLiepin = async () => {
    setLiepinValidating(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await client.get<{ valid: boolean }>('/platform-auth/liepin/validate');
      if (data.valid) {
        setSuccess('猎聘 Token 有效');
      } else {
        setError('猎聘 Token 无效，请重新生成');
      }
    } catch (e) {
      setError(`验证失败: ${getErrorMessage(e, '未知错误')}`);
    } finally {
      setLiepinValidating(false);
    }
  };

  const handleSaveCookie = async (platform: string) => {
    const cookie = (cookieInputs[platform] || '').trim();
    if (!cookie) {
      setError(`请输入${getPlatformName(platform)}的 Cookie`);
      return;
    }
    setCookieSaving(platform);
    setError('');
    setSuccess('');
    try {
      await client.post(`/platform-auth/${platform}/cookie`, { cookie });
      setSuccess(`${getPlatformName(platform)} Cookie 保存成功`);
      setCookieInputs({ ...cookieInputs, [platform]: '' });
      await loadStatus();
    } catch (e) {
      setError(`保存失败: ${getErrorMessage(e, '未知错误')}`);
    } finally {
      setCookieSaving(null);
    }
  };

  const handleValidateCookie = async (platform: string) => {
    setCookieValidating(platform);
    setError('');
    setSuccess('');
    try {
      const { data } = await client.get<{ valid: boolean }>(`/platform-auth/${platform}/validate`);
      if (data.valid) {
        setSuccess(`${getPlatformName(platform)} Cookie 有效`);
      } else {
        setError(`${getPlatformName(platform)} Cookie 已失效，请重新获取`);
      }
    } catch (e) {
      setError(`验证失败: ${getErrorMessage(e, '未知错误')}`);
    } finally {
      setCookieValidating(null);
    }
  };

  const renderStatusBadge = (status: string) => (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.disconnected}`}
    >
      {status === 'active' && <CheckCircle size={12} />}
      {status === 'expired' && <Clock size={12} />}
      {status === 'disconnected' && <XCircle size={12} />}
      {STATUS_LABELS[status] || '未连接'}
    </span>
  );

  const renderBrowserCard = (platform: string) => {
    const s = getStatus(platform);
    const status = s?.status || 'disconnected';
    const Icon = PLATFORM_ICONS[platform] || Briefcase;
    const isSaving = cookieSaving === platform;
    const isValidating = cookieValidating === platform;
    const expiry = formatExpiry(s?.expires_at || null);
    const guideOpen = showGuide === platform;
    const loginUrl = platform === 'boss' ? 'https://www.zhipin.com/' : 'https://login.51job.com/';

    return (
      <div key={platform} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Icon size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{getPlatformName(platform)}</h3>
              <p className="text-xs text-gray-400">Cookie 授权</p>
            </div>
          </div>
          {renderStatusBadge(status)}
        </div>

        {status === 'active' && expiry && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Clock size={12} />
            <span>{expiry}</span>
          </div>
        )}

        {status !== 'active' && (
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1.5">Cookie 字符串</label>
            <textarea
              value={cookieInputs[platform] || ''}
              onChange={(e) => setCookieInputs({ ...cookieInputs, [platform]: e.target.value })}
              placeholder={`粘贴从${getPlatformName(platform)}复制的 Cookie 字符串`}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-xs"
            />
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={() => setShowGuide(guideOpen ? null : platform)}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
              >
                {guideOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                获取 Cookie 指引
              </button>
              <a
                href={loginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <ExternalLink size={12} />
                打开{getPlatformName(platform)}
              </a>
            </div>
            {guideOpen && (
              <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs text-gray-600 space-y-2">
                <p className="font-medium text-gray-700">操作步骤：</p>
                <p>1. 点击上方链接打开{getPlatformName(platform)}并登录</p>
                <p>2. 按 <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">F12</kbd> 打开开发者工具
                  <span className="text-gray-400">（Mac: <kbd className="px-1 bg-white border border-gray-300 rounded">Cmd+Option+I</kbd>）</span>
                </p>
                <p>3. 切换到 <span className="font-medium">Network</span>（网络）标签
                  <span className="text-gray-400">（若中文界面为"网络"标签）</span>
                </p>
                <p>4. 刷新页面（<kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">F5</kbd> 或 <kbd className="px-1 py-0.5 bg-white border border-gray-300 rounded text-xs">Ctrl+R</kbd>），点击列表中任意一个请求</p>
                <p>5. 在右侧 <span className="font-medium">Headers</span>（标头）→ <span className="font-medium">Request Headers</span>（请求标头）中找到 <code className="text-indigo-600">Cookie:</code> 字段</p>
                <p>6. 复制 Cookie 后面的整段值，粘贴到上方输入框</p>

                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="font-medium text-gray-700">Cookie 格式示例：</p>
                  <code className="block mt-1 p-2 bg-white border border-gray-200 rounded text-[10px] text-gray-500 overflow-x-auto">
                    wt2=ABC123...; __cf_bm=DEF456...; token=XYZ789...
                  </code>
                  <p className="text-gray-400 mt-1">多个键值对用分号+空格分隔，通常数百字符</p>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="font-medium text-gray-700">浏览器差异：</p>
                  <ul className="list-disc ml-4 space-y-0.5 text-gray-500">
                    <li><span className="font-medium">Chrome/Edge</span>：F12 → Network → 点击请求 → Headers → Request Headers</li>
                    <li><span className="font-medium">Firefox</span>：F12 → 网络 → 点击请求 → 标头 → 请求标头</li>
                    <li><span className="font-medium">Safari</span>：需先在"开发"菜单中启用Web检查器</li>
                  </ul>
                </div>

                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="font-medium text-gray-700">常见错误排查：</p>
                  <ul className="list-disc ml-4 space-y-0.5 text-gray-500">
                    <li>粘贴后无响应 → 检查是否包含 <code className="text-indigo-600">wt2</code>（BOSS）或 <code className="text-indigo-600">guid</code>（51job）等关键键</li>
                    <li>验证失败 → Cookie 已过期，重新登录后获取新的 Cookie</li>
                    <li>搜索无结果 → Cookie 有效但权限不足，尝试在浏览器中先搜索一次再复制</li>
                    <li>复制不完整 → 双击 Cookie 值全选后 Ctrl+C，避免手动拖选</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-auto pt-2 flex-wrap">
          {status !== 'active' && (
            <button
              onClick={() => handleSaveCookie(platform)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <KeyRound size={14} />
                  保存 Cookie
                </>
              )}
            </button>
          )}
          {status === 'active' && (
            <>
              <button
                onClick={() => handleValidateCookie(platform)}
                disabled={isValidating}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isValidating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    验证中...
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    验证
                  </>
                )}
              </button>
              <button
                onClick={() => handleDisconnect(platform)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
              >
                <Unlink size={14} />
                断开
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderLiepinCard = () => {
    const s = getStatus('liepin');
    const status = s?.status || 'disconnected';
    const expiry = formatExpiry(s?.expires_at || null);

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <KeyRound size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">猎聘</h3>
              <p className="text-xs text-gray-400">Token 授权</p>
            </div>
          </div>
          {renderStatusBadge(status)}
        </div>

        {status === 'active' && expiry && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Clock size={12} />
            <span>{expiry}</span>
          </div>
        )}

        {status !== 'active' && (
          <div className="mb-3">
            <label className="block text-xs text-gray-500 mb-1.5">猎聘 Token</label>
            <input
              type="text"
              value={liepinToken}
              onChange={(e) => setLiepinToken(e.target.value)}
              placeholder="粘贴你的猎聘 Token"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <a
              href="https://www.liepin.com/mcp/server"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-2"
            >
              <ExternalLink size={12} />
              获取 Token：https://www.liepin.com/mcp/server
            </a>
          </div>
        )}

        <div className="flex gap-2 mt-auto pt-2 flex-wrap">
          {status !== 'active' && (
            <button
              onClick={handleSaveLiepinToken}
              disabled={liepinSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {liepinSaving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <KeyRound size={14} />
                  保存
                </>
              )}
            </button>
          )}
          {status === 'active' && (
            <>
              <button
                onClick={handleValidateLiepin}
                disabled={liepinValidating}
                className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {liepinValidating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    验证中...
                  </>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    验证
                  </>
                )}
              </button>
              <button
                onClick={() => handleDisconnect('liepin')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
              >
                <Unlink size={14} />
                断开
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderPublicApiCard = (platform: string) => {
    const Icon = PLATFORM_ICONS[platform] || Globe;
    return (
      <div key={platform} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Icon size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{getPlatformName(platform)}</h3>
              <p className="text-xs text-gray-400">公开 API</p>
            </div>
          </div>
          {renderStatusBadge('active')}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-auto pt-2">
          <CheckCircle size={12} className="text-green-500" />
          <span>无需登录，直接使用公开 API 获取岗位</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Link2 size={24} className="text-indigo-600" />
          平台连接
        </h1>
        <p className="text-gray-500 mt-2 text-sm">
          管理招聘平台的登录状态。BOSS直聘、前程无忧通过 Cookie 授权（从浏览器开发者工具复制）；猎聘通过 Token 授权；Himalayas、Remotive 为公开 API，无需登录。
        </p>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <XCircle size={14} />
          </button>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600">
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* 平台卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderBrowserCard('boss')}
        {renderLiepinCard()}
        {renderBrowserCard('51job')}
        {renderPublicApiCard('himalayas')}
        {renderPublicApiCard('remotive')}
      </div>
    </div>
  );
}
