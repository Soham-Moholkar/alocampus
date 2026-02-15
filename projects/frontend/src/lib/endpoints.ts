export const endpoints = {
  authNonce: '/auth/nonce',
  authVerify: '/auth/verify',
  me: '/me',
  demoAuthLogin: '/demo-auth/login',
  demoAuthLogout: '/demo-auth/logout',
  demoAuthProfile: '/demo-auth/profile',
  demoAuthUsers: '/demo-auth/users',

  polls: '/polls',
  pollById: (pollId: number | string) => `/polls/${pollId}`,
  pollContext: (pollId: number | string) => `/polls/${pollId}/context`,

  sessions: '/attendance/sessions',
  sessionById: (sessionId: number | string) => `/attendance/sessions/${sessionId}`,
  attendanceRecordsMe: '/attendance/records/me',
  attendanceRecordsSession: (sessionId: number | string) => `/attendance/records/session/${sessionId}`,
  attendanceRecordStatus: (recordId: string) => `/attendance/records/${recordId}/status`,

  certIssue: '/cert/issue',
  certVerify: '/cert/verify',
  certVerifyUpload: '/cert/verify/upload',
  certList: '/certs',
  certMetadata: (certHash: string) => `/metadata/cert/${certHash}.json`,

  facultyPolls: '/faculty/polls',
  facultySessions: '/faculty/sessions',
  facultySessionUpdate: (sessionId: number | string) => `/faculty/sessions/${sessionId}`,
  facultySessionClose: (sessionId: number | string) => `/faculty/sessions/${sessionId}/close`,

  analyticsSummary: '/analytics/summary',

  activity: '/activity',
  announcements: '/announcements',

  txTrack: '/tx/track',
  txStatus: (txId: string) => `/tx/track/${txId}`,

  adminRole: '/admin/role',

  systemHealth: '/system/health',
  health: '/health',

  feedbackCommit: '/feedback/commit',
  feedbackAggregate: '/feedback/aggregate',

  coordinationTasks: '/coordination/tasks',
  coordinationAnchor: (taskId: string) => `/coordination/tasks/${taskId}/anchor`,
  coordinationVerify: (taskId: string) => `/coordination/tasks/${taskId}/verify`,

  aiFacultyPollPlan: '/ai/faculty/poll-plan',
  aiFacultySessionPlan: '/ai/faculty/session-plan',
  aiFacultyCertificatePlan: '/ai/faculty/certificate-plan',
  aiAdminRoleRiskPlan: '/ai/admin/role-risk-plan',
  aiAdminSystemPlan: '/ai/admin/system-remediation-plan',
  aiCoordinationTaskPlan: '/ai/coordination/task-plan',
  aiExecute: (intentId: string) => `/ai/execute/${intentId}`,

  profileMe: '/profile/me',
  profileAvatar: '/profile/avatar',
}

export const integrationHighlights = [
  'Reads for lists and dashboards use BFF endpoints.',
  'Protected writes require wallet nonce-sign JWT session.',
  'AI planning and execution are proxied by BFF with deterministic fallback support.',
  'Activity and system widgets are driven by /activity and /system/health.',
]
