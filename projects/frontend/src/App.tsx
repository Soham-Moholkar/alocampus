import { Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { useAuth } from './context/AuthContext'
import { AppShell } from './layout/AppShell'
import { PublicLayout } from './layout/PublicLayout'
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminRolesPage } from './pages/admin/AdminRolesPage'
import { AdminSystemPage } from './pages/admin/AdminSystemPage'
import { FacultyAnalyticsPage } from './pages/faculty/FacultyAnalyticsPage'
import { FacultyAttendancePage } from './pages/faculty/FacultyAttendancePage'
import { FacultyCertificatesPage } from './pages/faculty/FacultyCertificatesPage'
import { FacultyDashboardPage } from './pages/faculty/FacultyDashboardPage'
import { FacultyProfilePage } from './pages/faculty/FacultyProfilePage'
import { FacultyVotingPage } from './pages/faculty/FacultyVotingPage'
import { ActivityPage } from './pages/shared/ActivityPage'
import { ConnectPage } from './pages/shared/ConnectPage'
import { SettingsPage } from './pages/shared/SettingsPage'
import { VerifyCertificatePage } from './pages/shared/VerifyCertificatePage'
import { StudentAttendancePage } from './pages/student/StudentAttendancePage'
import { StudentCertificatesPage } from './pages/student/StudentCertificatesPage'
import { StudentDashboardPage } from './pages/student/StudentDashboardPage'
import { StudentFeedbackPage } from './pages/student/StudentFeedbackPage'
import { StudentProfilePage } from './pages/student/StudentProfilePage'
import { StudentVotingPage } from './pages/student/StudentVotingPage'

const HomeRedirect = () => {
  const { isAuthenticated, role, isLoading } = useAuth()

  if (isLoading) {
    return <div className="center-page">Loading session...</div>
  }

  if (!isAuthenticated || !role) {
    return <Navigate to="/connect" replace />
  }

  if (role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />
  }
  if (role === 'faculty') {
    return <Navigate to="/faculty/dashboard" replace />
  }
  return <Navigate to="/student/dashboard" replace />
}

const RequireAuth = () => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return <div className="center-page">Loading session...</div>
  }
  if (!isAuthenticated) {
    return <Navigate to="/connect" replace />
  }
  return <Outlet />
}

const FacultyGuard = () => {
  const { role } = useAuth()
  if (role === 'faculty' || role === 'admin') {
    return <Outlet />
  }
  return <Navigate to="/student/dashboard" replace />
}

const AdminGuard = () => {
  const { role } = useAuth()
  if (role === 'admin') {
    return <Outlet />
  }
  if (role === 'faculty') {
    return <Navigate to="/faculty/dashboard" replace />
  }
  return <Navigate to="/student/dashboard" replace />
}

export const App = () => (
  <Routes>
    <Route path="/connect" element={<ConnectPage />} />

    <Route element={<PublicLayout />}>
      <Route path="/verify/certificate" element={<VerifyCertificatePage />} />
    </Route>

    <Route path="/" element={<HomeRedirect />} />

    <Route element={<RequireAuth />}>
      <Route element={<AppShell />}>
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/student/dashboard" element={<StudentDashboardPage />} />
        <Route path="/student/voting" element={<StudentVotingPage />} />
        <Route path="/student/attendance" element={<StudentAttendancePage />} />
        <Route path="/student/certificates" element={<StudentCertificatesPage />} />
        <Route path="/student/feedback" element={<StudentFeedbackPage />} />
        <Route path="/student/profile" element={<StudentProfilePage />} />

        <Route element={<FacultyGuard />}>
          <Route path="/faculty/dashboard" element={<FacultyDashboardPage />} />
          <Route path="/faculty/voting" element={<FacultyVotingPage />} />
          <Route path="/faculty/attendance" element={<FacultyAttendancePage />} />
          <Route path="/faculty/certificates" element={<FacultyCertificatesPage />} />
          <Route path="/faculty/analytics" element={<FacultyAnalyticsPage />} />
          <Route path="/faculty/profile" element={<FacultyProfilePage />} />
        </Route>

        <Route element={<AdminGuard />}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/roles" element={<AdminRolesPage />} />
          <Route path="/admin/system" element={<AdminSystemPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        </Route>
      </Route>
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)
