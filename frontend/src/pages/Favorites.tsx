import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Heart, Trash2 } from 'lucide-react';
import client from '../api/client';
import JobCard from '../components/JobCard';
import type { Job } from '../types';

export default function Favorites() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await client.get('/jobs/favorites');
      setJobs(data.results || []);
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleRemoveAll = async () => {
    if (!confirm('确定要取消所有收藏吗？')) return;
    try {
      await Promise.all(jobs.map((job) => client.post(`/jobs/${job.id}/favorite`)));
      setJobs([]);
    } catch {
      alert('操作失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">收藏岗位</h1>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">收藏岗位</h1>
        {jobs.length > 0 && (
          <button
            onClick={handleRemoveAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 size={16} />
            全部取消收藏
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <Heart size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">还没有收藏任何岗位</h3>
          <Link
            to="/search"
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            去搜索页看看吧
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}