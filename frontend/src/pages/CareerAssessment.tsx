import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, CheckCircle2, BarChart3,
  Brain, Lightbulb, Target, Zap,
} from 'lucide-react';
import { QUESTIONS, scoreAssessment } from '../utils/assessment';

const TOTAL_QUESTIONS = QUESTIONS.length;
const LIKERT_LABELS = ['非常不符合', '不太符合', '一般', '比较符合', '非常符合'];

export default function CareerAssessment() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const currentQuestion = QUESTIONS[step];
  const currentAnswer = answers[currentQuestion.id] || 0;

  const progress = Object.keys(answers).length;

  const sectionLabel = useMemo(() => {
    if (step < 60) return '霍兰德RIASEC · 职业兴趣';
    if (step < 75) return 'CBF-PI-15 · 大五人格';
    return 'CAAS-SF · 职业适应力';
  }, [step]);

  const handleAnswer = (value: number) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleNext = () => {
    if (currentAnswer === 0) return;
    if (step < TOTAL_QUESTIONS - 1) {
      setStep(step + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const result = useMemo(() => {
    if (!submitted) return null;
    return scoreAssessment(answers);
  }, [submitted, answers]);

  if (submitted && result) {
    const topHolland = Object.entries(result.holland)
      .sort((a, b) => b[1] - a[1]);

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BarChart3 size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">职业测评报告</h1>
            <p className="text-sm text-gray-500">基于87题专业测评的综合分析</p>
          </div>
        </div>

        {/* Holland Results */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target size={18} className="text-indigo-500" />
            霍兰德职业兴趣
          </h2>
          <div className="space-y-3">
            {topHolland.map(([code, score]) => {
              const maxScore = 50;
              const pct = Math.round((score / maxScore) * 100);
              const labels: Record<string, string> = {
                R: '现实型', I: '研究型', A: '艺术型', S: '社会型', E: '企业型', C: '常规型',
              };
              const colors: Record<string, string> = {
                R: 'bg-orange-500', I: 'bg-blue-500', A: 'bg-purple-500',
                S: 'bg-green-500', E: 'bg-red-500', C: 'bg-gray-500',
              };
              return (
                <div key={code}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{labels[code]} ({code})</span>
                    <span className="text-gray-500">{score}/{maxScore}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${colors[code]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Big5 Results */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Brain size={18} className="text-purple-500" />
            大五人格
          </h2>
          <div className="grid grid-cols-5 gap-4 text-center">
            {Object.entries(result.big5).map(([dim, score]) => {
              const labels: Record<string, string> = { N: '神经质', E: '外向性', O: '开放性', A: '宜人性', C: '尽责性' };
              const pct = Math.round((score / 15) * 100);
              return (
                <div key={dim}>
                  <div className="text-xs text-gray-500 mb-1">{labels[dim]}</div>
                  <div className="text-2xl font-bold text-indigo-600">{pct}%</div>
                  <div className="text-xs text-gray-400">{score}/15</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CAAS Results */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-500" />
            职业适应力
          </h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            {Object.entries(result.caas).map(([dim, score]) => {
              const labels: Record<string, string> = { concern: '职业关注', control: '职业控制', curiosity: '职业好奇', confidence: '职业自信' };
              const pct = Math.round((score / 15) * 100);
              return (
                <div key={dim}>
                  <div className="text-xs text-gray-500 mb-1">{labels[dim]}</div>
                  <div className="text-2xl font-bold text-indigo-600">{pct}%</div>
                  <div className="text-xs text-gray-400">{score}/15</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">推荐方向</h2>
          <div className="space-y-3">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-indigo-50 rounded-lg">
                <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {rec.fit_score}
                </span>
                <div>
                  <h4 className="font-medium text-gray-900">{rec.role}</h4>
                  <p className="text-sm text-gray-600 mt-0.5">{rec.reason}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rec.suggested_keywords.map((kw, j) => (
                      <span key={j} className="px-2 py-0.5 bg-white text-indigo-600 text-xs rounded-full border border-indigo-200">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => { setSubmitted(false); setStep(0); setAnswers({}); }}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            重新测评
          </button>
          <button
            onClick={() => {
              const keywords = result.recommendations.flatMap(r => r.suggested_keywords);
              navigate(`/search?keywords=${encodeURIComponent(keywords.slice(0, 5).join(','))}`);
            }}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            用推荐方向搜索岗位
          </button>
        </div>
        <button
          onClick={() => navigate('/career-transition')}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 border border-purple-200"
        >
          <Zap size={16} />
          查看转型路径建议
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">职业测评</h1>
          <p className="text-sm text-gray-500 mt-0.5">{sectionLabel}</p>
        </div>
        <span className="text-sm text-gray-400">{progress}/{TOTAL_QUESTIONS} 题</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
          style={{ width: `${(progress / TOTAL_QUESTIONS) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
        <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full mb-4">
          第 {step + 1} 题
        </span>
        <h2 className="text-lg font-medium text-gray-900 mb-6">{currentQuestion.text}</h2>

        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => handleAnswer(value)}
              className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                currentAnswer === value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs ${
                  currentAnswer === value ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-gray-300'
                }`}>
                  {currentAnswer === value ? <CheckCircle2 size={12} /> : value}
                </span>
                {LIKERT_LABELS[value - 1]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={step === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
          上一题
        </button>

        {step < TOTAL_QUESTIONS - 1 ? (
          <button
            onClick={handleNext}
            disabled={currentAnswer === 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            下一题
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={progress < TOTAL_QUESTIONS}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle2 size={16} />
            {progress < TOTAL_QUESTIONS ? `还需回答 ${TOTAL_QUESTIONS - progress} 题` : '查看测评报告'}
          </button>
        )}
      </div>
    </div>
  );
}