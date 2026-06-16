import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Building2, Briefcase, ExternalLink, Heart, AlertTriangle, Users, Tag as TagIcon } from 'lucide-react';
import type { Job } from '../types';
import client from '../api/client';

interface JobCardProps {
  job: Job;
}

function MatchBadge({ score }: { score: number | null }) {
  if (score === null || score === 0) return null;

  let colorClass: string;
  let label: string;

  if (score >= 70) {
    colorClass = 'bg-green-100 text-green-800';
    label = '高匹配';
  } else if (score >= 40) {
    colorClass = 'bg-yellow-100 text-yellow-800';
    label = '中匹配';
  } else {
    colorClass = 'bg-red-100 text-red-800';
    label = '低匹配';
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label} {score}%
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const isBoss = platform === 'BOSS直聘';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        isBoss
          ? 'bg-blue-100 text-blue-700'
          : 'bg-orange-100 text-orange-700'
      }`}
    >
      {platform}
    </span>
  );
}

export default function JobCard({ job }: JobCardProps) {
  const navigate = useNavigate();
  const [favorited, setFavorited] = useState(!!job.favorited_at);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data } = await client.post(`/jobs/${job.id}/favorite`);
      setFavorited(data.favorited);
    } catch {
      // silently fail
    }
  };

  const hasCompanyInfo = job.company_scale || job.company_industry;
  const isMockData = job.data_source === 'mock';

  return (
    <div
      onClick={() => navigate(`/jobs/${job.id}`)}
      className="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer
        hover:shadow-md hover:border-indigo-200 transition-all duration-200"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-indigo-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {job.title || '未知职位'}
            </h3>
            <p className="text-sm text-gray-500 truncate">{job.company || '未知公司'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className="p-1 rounded hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label={favorited ? '取消收藏' : '收藏'}
          >
            <Heart
              size={18}
              className={favorited ? 'text-red-500 fill-red-500' : 'text-gray-400'}
            />
          </button>
          <MatchBadge score={job.match_score} />
        </div>
      </div>

      {hasCompanyInfo && (
        <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
          {job.company_scale && (
            <span className="inline-flex items-center gap-1">
              <Users size={12} />
              {job.company_scale}
            </span>
          )}
          {job.company_industry && (
            <span className="inline-flex items-center gap-1">
              <TagIcon size={12} />
              {job.company_industry}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
        <span className="inline-flex items-center gap-1">
          <Briefcase size={14} />
          <span className="text-indigo-600 font-medium">{job.salary || '薪资未提供'}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} />
          {job.city || '城市未知'}
        </span>
      </div>

      <p className="text-sm text-gray-600 line-clamp-5 mb-3 whitespace-pre-line">
        {job.jd_text || '暂无岗位描述'}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PlatformBadge platform={job.platform} />
          {isMockData && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
              离线数据
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {job._url_valid === false && job.jd_url && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600" title={job._url_status || '链接不可达'}>
              <AlertTriangle size={12} />
              链接已过期
            </span>
          )}
          {job.jd_url && job.jd_url.startsWith('http') ? (
            <a
              href={job.jd_url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
              aria-label={`查看${job.title}原始职位`}
            >
              <ExternalLink size={12} />
              查看原文
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <ExternalLink size={12} />
              此岗位为离线数据
            </span>
          )}
        </div>
      </div>
    </div>
  );
}