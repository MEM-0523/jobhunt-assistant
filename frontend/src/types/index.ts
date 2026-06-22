export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Profile {
  id: number;
  user_id: number;
  name: string;
  phone: string;
  city: string;
  salary_min: number;
  salary_max: number;
  deal_breakers: string[];
  preferences: Record<string, unknown>;
  risk_tolerance: string;
  learning_pace: string;
  target_timeline: string;
  target_industries: string[];
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: number;
  user_id: number;
  title: string;
  company: string;
  salary: string;
  city: string;
  platform: string;
  jd_text: string;
  match_score: number | null;
  rating: number | null;
  status: 'new' | 'applied' | 'interview' | 'offer' | 'rejected' | 'saved';
  jd_url: string;
  _url_valid?: boolean;
  _url_status?: string;
  data_source?: string;
  company_scale?: string;
  company_industry?: string;
  created_at: string;
  matched_keyword?: string;
  favorited_at?: string;
}

export interface JobFavorite {
  id: number;
  job_id: number;
  job?: Job;
  created_at: string;
}

export interface JobSearchParams {
  keyword: string;
  city: string;
  platform: string;
}

export interface JobSearchResponse {
  results: Job[];
  keyword: string;
  city: string;
  total: number;
  by_keyword?: Record<string, number>;
}

export interface Application {
  id: number;
  user_id: number;
  job_id: number;
  job_title?: string;
  company?: string;
  status: string;
  applied_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
  job?: Job;
  is_demo?: boolean;
}

export interface ApplicationStats {
  total: number;
  by_status: Record<string, number>;
  funnel: Record<string, number>;
  recent_activities: { action: string; time: string }[];
}

export interface Resume {
  id: number;
  user_id: number;
  content: string;
  version: number;
  file_type: string;
  created_at: string;
}

export interface InterviewPrep {
  id: number;
  user_id: number;
  job_id: number;
  content: Record<string, unknown>;
  created_at: string;
}

export interface InterviewPrepData {
  self_introduction: string;
  qa_pairs: QAPair[];
  stories: Story[];
  questions_to_ask: QuestionToAsk[];
  tips: string[];
  salary_negotiation?: string;
  weaknesses?: WeaknessItem[];
  red_flags?: RedFlagItem[];
  props?: string[];
  company_research?: CompanyResearch;
  gap_analysis?: GapAnalysis;
}

export interface WeaknessItem {
  weakness: string;
  honest_answer: string;
  mitigation: string;
}

export interface RedFlagItem {
  flag: string;
  response: string;
}

export interface QAPair {
  category: string;
  question: string;
  answer: string;
  examiner_intent?: string;
  key_points?: string[];
}

export interface Story {
  id: number;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  jd_link?: string;
  methodology?: string;
}

export interface QuestionToAsk {
  category: string;
  question: string;
  timing?: string;
  value?: string;
}

export interface Feedback {
  id: number;
  user_id: number;
  type: string;
  content: string;
  created_at: string;
}

export interface KeywordSuggestion {
  original: string;
  replacement: string;
  reason: string;
  label?: string;
  label_reason?: string;
}

export interface ResumeOptimization {
  ats_score: number;
  keyword_suggestions: KeywordSuggestion[];
  improvement_suggestions: string[];
  optimized_content: string;
  suggestions?: ResumeSuggestion[];
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface AnalysisDimension {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface JobAnalysis {
  overall_score: number;
  rating: string;
  dimensions: AnalysisDimension[];
  summary: string;
  suggestions: string[];
  // 5维度评分（新）
  experience_fit?: number;
  hard_requirements?: number;
  interest_direction?: number;
  practical_constraints?: number;
  risk_screening?: number;
  total_score?: number;
  grade?: string;
  red_flags?: string[];
  reasoning?: string;
}

export interface RecentActivity {
  type: string;
  description: string;
  created_at: string;
}

export interface WeeklyChange {
  searches: number;
  applications: number;
  interviews: number;
}

export interface DashboardStats {
  total_jobs_searched: number;
  total_applications: number;
  in_interview: number;
  offers: number;
  status_breakdown: Record<string, number>;
  recent_activities: RecentActivity[];
  weekly_change: WeeklyChange;
}

export interface WeeklyReport {
  searches_this_week: number;
  new_jobs_found: number;
  new_applications: number;
  status_changes: Record<string, number>;
  hot_keywords: string[];
  suggestions: string[];
}

export interface InterviewReview {
  id: number;
  user_id: number;
  application_id: number;
  interview_date: string;
  questions_review: string;
  self_rating: number;
  interviewer_feedback: string;
  improvements: string;
  created_at: string;
}

export interface SalaryAdvice {
  market_range: string;
  your_expectation: string;
  negotiation_tips: string[];
  counter_offer_script: string;
  checklist: string[];
}

export interface CompanyResearch {
  product_analysis: string;
  competitor_analysis: string;
  historical_evolution: string;
  user_voices: string;
}

export interface GapItem {
  gap: string;
  action: string;
  estimated_hours: number;
  resource: string;
  checkpoints: string[];
}

export interface GapAnalysis {
  hidden_skills: string[];
  priority1_must_fill: GapItem[];
  priority2_should_fill: GapItem[];
  priority3_nice_to_have: GapItem[];
}

export interface Notification {
  id: number;
  user_id: number;
  type: 'info' | 'success' | 'warning' | 'reminder';
  title: string;
  message: string;
  is_read: boolean;
  link: string;
  created_at: string;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
  page: number;
  page_size: number;
}

// 经历资产库
export interface Experience {
  id: number;
  user_id: number;
  type: 'project' | 'internship' | 'course' | 'club' | 'self_study' | 'part_time';
  title: string;
  background: string;
  task: string;
  action: string;
  method_tool: string;
  result: string;
  evidence: string;
  created_at: string;
  updated_at: string;
}

// 优势证据链
export interface Strength {
  id: number;
  user_id: number;
  name: string;
  classification: 'fact' | 'assumption' | 'inference';
  evidence: string;
  behavior: string;
  ability: string;
  job_signal: string;
  confidence: 'high' | 'medium' | 'low';
  missing_proof: string;
  next_action: string;
  created_at: string;
}

// 面试练习会话
export interface InterviewPracticeSession {
  id: number;
  user_id: number;
  target_role: string;
  job_description: string;
  transcript: Array<{
    role: 'ai' | 'user';
    content: string;
    feedback?: {
      what_worked: string;
      what_unclear: string;
      what_not_to_say: string;
      star_improved: string;
      practice_drill: string;
    };
  }>;
  follow_up_count: number;
  created_at: string;
}

// 5维度评分
export interface FiveDimensionScore {
  experience_fit: number;      // 0-40
  hard_requirements: number;   // 0-20
  interest_direction: number;  // 0-15
  practical_constraints: number; // 0-15
  risk_screening: number;      // 0-10
  total_score: number;         // 0-100
  grade: 'A' | 'B' | 'C' | 'D';
  red_flags: string[];
  reasoning: string;
}

// 简历优化建议标签
export type ResumeLabel = 'use_as_is' | 'rewrite' | 'needs_proof' | 'remove' | 'ask_user';

export interface ResumeSuggestion {
  label: ResumeLabel;
  reason: string;
  original: string;
  suggestion: string;
  section?: string;
}