import type { Role } from '../types/api'

export interface NavItem {
  label: string
  to: string
}

const shared: NavItem[] = [
  { label: 'Verify Certificate', to: '/verify/certificate' },
  { label: 'Activity', to: '/activity' },
  { label: 'Settings', to: '/settings' },
]

export const roleNav: Record<Role, NavItem[]> = {
  student: [
    { label: 'Dashboard', to: '/student/dashboard' },
    { label: 'Voting', to: '/student/voting' },
    { label: 'Attendance', to: '/student/attendance' },
    { label: 'Certificates', to: '/student/certificates' },
    { label: 'Feedback', to: '/student/feedback' },
    ...shared,
    { label: 'Profile', to: '/student/profile' },
  ],
  faculty: [
    { label: 'Dashboard', to: '/faculty/dashboard' },
    { label: 'Voting Admin', to: '/faculty/voting' },
    { label: 'Attendance Admin', to: '/faculty/attendance' },
    { label: 'Certificates Admin', to: '/faculty/certificates' },
    { label: 'Analytics', to: '/faculty/analytics' },
    ...shared,
    { label: 'Profile', to: '/faculty/profile' },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard' },
    { label: 'Role Management', to: '/admin/roles' },
    { label: 'System Health', to: '/admin/system' },
    { label: 'Analytics', to: '/admin/analytics' },
    ...shared,
  ],
}
