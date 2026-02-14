import type { Role } from '../types/api'

export interface TourStep {
  id: string
  role: Role
  route: string
  selector: string
  title: string
  body: string
}

const tourByRole: Record<Role, TourStep[]> = {
  student: [
    {
      id: 'student-vote',
      role: 'student',
      route: '/student/dashboard',
      selector: '[data-tour="student-vote"]',
      title: 'Vote On Active Polls',
      body: 'Open voting directly from the dashboard and participate in active governance polls.',
    },
    {
      id: 'student-attendance',
      role: 'student',
      route: '/student/dashboard',
      selector: '[data-tour="student-attendance"]',
      title: 'Track Attendance',
      body: 'Jump to attendance to check in and monitor subject-wise attendance graphs.',
    },
    {
      id: 'student-certs',
      role: 'student',
      route: '/student/dashboard',
      selector: '[data-tour="student-certs"]',
      title: 'Verify Certificates',
      body: 'Open your certificate area and verify cert hashes with metadata previews.',
    },
  ],
  faculty: [
    {
      id: 'faculty-poll',
      role: 'faculty',
      route: '/faculty/dashboard',
      selector: '[data-tour="faculty-create-poll"]',
      title: 'Create Polls',
      body: 'Use this action to publish new polls and monitor turnout.',
    },
    {
      id: 'faculty-session',
      role: 'faculty',
      route: '/faculty/dashboard',
      selector: '[data-tour="faculty-create-session"]',
      title: 'Create Attendance Sessions',
      body: 'Open attendance admin to configure session windows and verify presence.',
    },
    {
      id: 'faculty-cert',
      role: 'faculty',
      route: '/faculty/dashboard',
      selector: '[data-tour="faculty-issue-cert"]',
      title: 'Issue Certificates',
      body: 'Issue certificates via BFF mint + on-chain registration flow.',
    },
  ],
  admin: [
    {
      id: 'admin-roles',
      role: 'admin',
      route: '/admin/dashboard',
      selector: '[data-tour="admin-manage-roles"]',
      title: 'Manage Roles',
      body: 'Assign student, faculty, and admin roles with on-chain allowlist updates.',
    },
    {
      id: 'admin-health',
      role: 'admin',
      route: '/admin/dashboard',
      selector: '[data-tour="admin-system-health"]',
      title: 'Check System Health',
      body: 'Review BFF and LocalNet health indicators before demos.',
    },
    {
      id: 'admin-analytics',
      role: 'admin',
      route: '/admin/dashboard',
      selector: '[data-tour="admin-analytics"]',
      title: 'Monitor Analytics',
      body: 'Open analytics to inspect platform trends, activity, and exports.',
    },
  ],
}

export const getTourSteps = (role: Role): TourStep[] => tourByRole[role]
