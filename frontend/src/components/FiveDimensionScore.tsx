import { AlertCircle, Star } from 'lucide-react';

export interface FiveDimensionData {
  experience_fit?: number;
  hard_requirements?: number;
  interest_direction?: number;
  practical_constraints?: number;
  risk_screening?: number;
  total_score?: number;
  grade?: string;
  red_flags?: string[];
  reasoning?: string;
  // 兼容旧字段
  overall_score?: number;
  rating?: string;
}

const DIMENSIONS: Array<{
  key: keyof FiveDimensionData;
  label: string;
  max: number;
  color: string;
}> = [
  { key: 'experience_fit', label: '经历匹配', max: 40, color: 'bg-indigo-500' },
  { key: 'hard_requirements', label: '硬性条件', max: 20, color: 'bg-blue-500' },
  { key: 'interest_direction', label: '兴趣方向', max: 15, color: 'bg-purple-500' },
  { key: 'practical_constraints', label: '现实约束', max: 15, color: 'bg-teal-500' },
  { key: 'risk_screening', label: '风险筛查', max: 10, color: 'bg-amber-500' },
];

const GRADE_COLORS: Record<string, string> = {
  A: 'text-green-700 bg-green-100',
  B: 'text-blue-700 bg-blue-100',
  C: 'text-yellow-700 bg-yellow-100',
  D: 'text-red-700 bg-red-100',
  F: 'text-red-700 bg-red-100',
};

export default function FiveDimensionScore({ data }: { data: FiveDimensionData }) {
  const hasNewScoring =
    data.total_score !== undefined || data.experience_fit !== undefined;

  // 旧数据回退：仅显示 overall_score
  if (!hasNewScoring && data.overall_score !== undefined) {
    return (
      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
        <span className="text-2xl font-bold text-indigo-600">{data.overall_score}</span>
        <span className="text-sm text-gray-400">/100</span>
        {data.rating && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
            GRADE_COLORS[data.rating] || 'text-gray-600 bg-gray-100'
          }`}>
            <Star size={12} />
            {data.rating}级
          </span>
        )}
      </div>
    );
  }

  if (!hasNewScoring) return null;

  const totalScore = data.total_score ?? data.overall_score ?? 0;
  const grade = data.grade || data.rating || '';

  return (
    <div className="space-y-3">
      {/* 总分 + 分级 */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-indigo-600">{totalScore}</span>
          <span className="text-sm text-gray-400">/100</span>
        </div>
        {grade && (
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold ${
            GRADE_COLORS[grade] || 'text-gray-600 bg-gray-100'
          }`}>
            <Star size={14} />
            {grade}级
          </span>
        )}
        <span className="ml-auto text-xs text-gray-500">5维度综合评分</span>
      </div>

      {/* 5维度评分条 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">维度评分明细</h4>
        {DIMENSIONS.map((dim) => {
          const score = (data[dim.key] as number | undefined) ?? 0;
          const percent = Math.min(100, (score / dim.max) * 100);
          return (
            <div key={dim.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-700 font-medium">{dim.label}</span>
                <span className="text-gray-500">
                  <span className="font-semibold text-gray-800">{score}</span>
                  /{dim.max}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${dim.color} rounded-full transition-all duration-500`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 红旗警告 */}
      {data.red_flags && data.red_flags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-red-600" />
            <h4 className="text-sm font-semibold text-red-700">
              风险红旗（{data.red_flags.length}）
            </h4>
          </div>
          <ul className="space-y-1.5">
            {data.red_flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <span className="text-red-400 mt-0.5">•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 分析理由 */}
      {data.reasoning && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-800 mb-2">评分依据</h4>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {data.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
