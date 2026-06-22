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
  const [loginLoading, setLoginLoading] = useState<string | null>(null);
  const [liepinToken, setLiepinToken] = useState('');
  const [liepinSaving, setLiepinSaving] = useState(false);
  const [liepinValidating, setLiepinValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const handleLogin = async (platform: string) => {
    setLoginLoading(platform);
    setError('');
    setSuccess('');
    try {
      await client.post(`/platform-auth/${platform}/login`);
      setSuccess(`请在弹出的浏览器窗口中完成${getPlatformName(platform)}登录`);
      // 轮询状态
      pollRef.current = setInterval(async () => {
        const latest = await loadStatus();
        const s = latest.find((x) => x.platform === platform);
        if (s?.status === 'active') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setLoginLoading(null);
          setSuccess(`${getPlatformName(platform)} 登录成功`);
        }
      }, 3000);
      // 120秒超时
      timeoutRef.current = setTimeout(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        setLoginLoading(null);
        setError(`${getPlatformName(platform)} 登录超时，请重试`);
      }, 120000);
    } catch (e) {
      setError(`登录失败: ${getErrorMessage(e, '未知错误')}`);
      setLoginLoading(null);
    }
  };

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
    const isLoggingIn = loginLoading === platform;
    const expiry = formatExpiry(s?.expires_at || null);

    return (
      <div key={platform} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Icon size={20} className="text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{getPlatformName(platform)}</h3>
              <p className="text-xs text-gray-400">{platform === 'boss' ? '浏览器登录（点击首页登录按钮）' : '浏览器登录'}</p>
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

        <div className="flex gap-2 mt-auto pt-2">
          {status !== 'active' && (
            <button
              onClick={() => handleLogin(platform)}
              disabled={isLoggingIn}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <Link2 size={14} />
                  登录
                </>
              )}
            </button>
          )}
          {status === 'active' && (
            <button
              onClick={() => handleDisconnect(platform)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-md transition-colors"
            >
              <Unlink size={14} />
              断开
            </button>
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
          管理招聘平台的登录状态。BOSS直聘、前程无忧通过浏览器登录获取 Cookie（BOSS直聘需在弹出浏览器中点击「登录」按钮）；猎聘通过 Token 授权；Himalayas、Remotive 为公开 API，无需登录。
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
