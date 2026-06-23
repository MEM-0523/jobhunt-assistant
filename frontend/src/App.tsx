import { Routes, Route } from 'react-router-dom'
import { useEffect, Suspense } from 'react'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import PageSkeleton from './components/PageSkeleton'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import SearchPage from './pages/Search'
import JobDetail from './pages/JobDetail'
import JDDirectAnalyze from './pages/JDDirectAnalyze'
import CareerAssessment from './pages/CareerAssessment'
import CareerTransition from './pages/CareerTransition'
import ResumePage from './pages/Resume'
import Applications from './pages/Applications'
import InterviewPrep from './pages/InterviewPrep'
import InterviewPractice from './pages/InterviewPractice'
import ExperienceAssets from './pages/ExperienceAssets'
import StrengthAnalysis from './pages/StrengthAnalysis'
import Settings from './pages/Settings'
import Favorites from './pages/Favorites'
import PlatformAuth from './pages/PlatformAuth'
import client from './api/client'

function App() {
  // Health check heartbeat: keeps Render free tier awake (15min sleep → ping every 10min)
  useEffect(() => {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    if (isDev) return // Skip in dev mode

    const ping = () => {
      client.get('/health').catch(() => {})
    }
    // Initial ping after 30s, then every 10 minutes
    const initialTimer = setTimeout(ping, 30000)
    const interval = setInterval(ping, 10 * 60 * 1000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [])

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<Layout />}>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
            <Route path="/platform-auth" element={<ProtectedRoute><PlatformAuth /></ProtectedRoute>} />
            <Route path="/direct-analyze" element={<ProtectedRoute><JDDirectAnalyze /></ProtectedRoute>} />
            <Route path="/assessment" element={<ProtectedRoute><CareerAssessment /></ProtectedRoute>} />
            <Route path="/career-transition" element={<ProtectedRoute><CareerTransition /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
            <Route path="/resume" element={<ProtectedRoute><ResumePage /></ProtectedRoute>} />
            <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
            <Route path="/interview-prep" element={<ProtectedRoute><InterviewPrep /></ProtectedRoute>} />
            <Route path="/interview-practice" element={<ProtectedRoute><InterviewPractice /></ProtectedRoute>} />
            <Route path="/experience-assets" element={<ProtectedRoute><ExperienceAssets /></ProtectedRoute>} />
            <Route path="/strength-analysis" element={<ProtectedRoute><StrengthAnalysis /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App