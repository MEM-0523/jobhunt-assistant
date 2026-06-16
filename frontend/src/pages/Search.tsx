import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Search, MapPin, Clock, X, Loader2, Tag, ToggleLeft, ToggleRight, Info, ChevronDown } from 'lucide-react';
import client from '../api/client';
import JobCard from '../components/JobCard';
import type { Job, JobSearchResponse } from '../types';

const PLATFORMS = [
  { key: '', label: '全部平台' },
  { key: 'BOSS直聘', label: 'BOSS直聘' },
  { key: '猎聘', label: '猎聘' },
];

const CITY_OPTIONS = [
  '杭州', '北京', '上海', '深圳', '广州', '成都', '武汉', '南京',
  '西安', '重庆', '苏州', '长沙', '天津', '郑州', '东莞', '青岛',
  '合肥', '宁波', '佛山', '厦门', '远程',
];

const SEARCH_HISTORY_KEY = 'job_search_history';

function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(keyword: string) {
  if (!keyword.trim()) return;
  const history = getSearchHistory().filter((h) => h !== keyword);
  history.unshift(keyword);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200" />
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-3 mb-3">
        <div className="h-4 bg-gray-200 rounded w-20" />
        <div className="h-4 bg-gray-200 rounded w-16" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-full mb-1" />
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-3" />
      <div className="h-5 bg-gray-200 rounded w-16" />
    </div>
  );
}

export default function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [city, setCity] = useState('杭州');
  const [cityOpen, setCityOpen] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const cityRef = useRef<HTMLDivElement>(null);
  const [platform, setPlatform] = useState('');
  const [results, setResults] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [history, setHistory] = useState<string[]>(getSearchHistory());
  const [byKeyword, setByKeyword] = useState<Record<string, number>>({});

  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setCityOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, []);

  const filteredCities = CITY_OPTIONS.filter(c =>
    c.toLowerCase().includes(cityFilter.toLowerCase())
  );

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const effectiveKeywords = batchMode ? tags : [keyword.trim()];
    if (effectiveKeywords.length === 0 || (effectiveKeywords.length === 1 && !effectiveKeywords[0])) return;

    setLoading(true);
    setError('');
    setSearched(true);

    if (!batchMode && keyword.trim()) {
      saveSearchHistory(keyword);
      setHistory(getSearchHistory());
    }

    try {
      const payload: Record<string, unknown> = { city, platform };
      if (batchMode) {
        payload.keywords = tags;
        payload.keyword = '';
      } else {
        payload.keyword = keyword.trim();
      }

      const { data } = await client.post<JobSearchResponse>('/jobs/search', payload);
      setResults(data.results || []);
      setByKeyword(data.by_keyword || {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '搜索失败，请稍后重试';
      setError(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const handleHistoryClick = (keyword: string) => {
    setKeyword(keyword);
    // Trigger search after state update
    setTimeout(() => {
      handleSearch();
    }, 0);
  };

  const clearHistory = () => {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    setHistory([]);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">职位搜索</h1>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Batch Toggle */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBatchMode(!batchMode)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                batchMode ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              {batchMode ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
              批量搜索
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              {batchMode ? (
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 p-2 border-2 border-indigo-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 min-h-[42px] bg-white">
                    {tags.length === 0 && (
                      <span className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 bg-gray-50 rounded">
                        <Info size={12} />
                        输入关键词后按 Enter 添加标签
                      </span>
                    )}
                    {tags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                      >
                        <Tag size={12} />
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(i)}
                          className="ml-0.5 hover:text-indigo-900"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      placeholder={tags.length > 0 ? '继续输入关键词...' : '输入关键词，按 Enter 添加'}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      className="flex-1 min-w-[150px] px-1 py-1 outline-none text-sm border-none"
                    />
                  </div>
                  {tags.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                      <Info size={12} />
                      已添加 {tags.length} 个关键词，可继续输入或点击搜索
                    </p>
                  )}
                </div>
              ) : (
                /* Single keyword input */
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="输入职位关键词，如 AI产品经理、Python后端"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1 sm:flex-none" ref={cityRef}>
                <div
                  onClick={() => { setCityOpen(!cityOpen); setCityFilter('') }}
                  className="flex items-center w-full sm:w-32 pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg cursor-pointer hover:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 outline-none"
                >
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <span className={city ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}>{city || '城市'}</span>
                  <ChevronDown size={14} className="ml-auto text-gray-400" />
                </div>
                {cityOpen && (
                  <div className="absolute z-30 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        type="text"
                        placeholder="搜索城市..."
                        value={cityFilter}
                        onChange={(e) => setCityFilter(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-44">
                      <button
                        type="button"
                        onClick={() => { setCity(''); setCityOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
                      >
                        不限城市
                      </button>
                      {filteredCities.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { setCity(c); setCityOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors ${
                            city === c ? 'bg-indigo-50 text-indigo-600 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                      {filteredCities.length === 0 && cityFilter && (
                        <button
                          type="button"
                          onClick={() => { setCity(cityFilter); setCityOpen(false) }}
                          className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                        >
                          使用 "{cityFilter}"
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || (batchMode ? tags.length === 0 : !keyword.trim())}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium flex-shrink-0"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                搜索
              </button>
            </div>
          </div>

          {/* Platform Tabs */}
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlatform(p.key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  platform === p.key
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Search History */}
      {!searched && history.length > 0 && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Clock size={14} />
              最近搜索
            </h3>
            <button
              onClick={clearHistory}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              清空
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((kw, i) => (
              <button
                key={i}
                onClick={() => handleHistoryClick(kw)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
              >
                <Clock size={12} />
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-2">
          <X size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && searched && !error && results.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Search size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">未找到匹配的职位</h3>
          <p className="text-gray-400">尝试更换关键词或调整筛选条件</p>
        </div>
      )}

      {/* Initial Empty State */}
      {!loading && !searched && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
            <Search size={32} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">输入关键词开始搜索职位</h3>
          <p className="text-gray-400 text-sm">
            支持按职位名称、公司名搜索，系统会自动过滤不满足薪资和城市条件的职位
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">
              共找到 <span className="font-medium text-gray-700">{results.length}</span> 个职位
            </p>
          </div>

          {/* Batch keyword summary */}
          {batchMode && Object.keys(byKeyword).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(byKeyword).map(([kw, count]) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-xs text-indigo-600"
                >
                  <Tag size={10} />
                  {kw}: {count}个
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((job) => (
              <div key={job.id} className="relative">
                {job.matched_keyword && (
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                      <Tag size={10} />
                      {job.matched_keyword}
                    </span>
                  </div>
                )}
                <JobCard job={job} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}