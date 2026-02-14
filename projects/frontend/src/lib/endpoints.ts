export const endpoints = {
  authNonce: '/auth/nonce',
  authVerify: '/auth/verify',
  me: '/auth/me',

  polls: '/polls',
  pollById: (pollId: number | string) => `/polls/${pollId}`,

  sessions: '/attendance/sessions',
  sessionById: (sessionId: number | string) => `/attendance/sessions/${sessionId}`,

  certIssue: '/faculty/cert/issue',
  certVerify: '/cert/verify',
  certList: '/certs',
  certMetadata: (certHash: string) => `/metadata/cert/${certHash}.json`,

  facultyPolls: '/faculty/polls',
  facultySessions: '/faculty/sessions',

  analyticsSummary: '/analytics/summary',

  activity: '/activity',

  txTrack: '/tx/track',
  txStatus: (txId: string) => `/tx/track/${txId}`,

  adminRole: '/admin/role',

  systemHealth: '/system/health',
  health: '/health',
}

export const endpointMismatches = [
  'Backend exposes /auth/me (not /me).',
  'Certificate issue route is /faculty/cert/issue (not /cert/issue).',
  'No /activity endpoint found: UI falls back to synthetic feed from /polls, /attendance/sessions, /certs, /tx/track/{id}.',
  'No /system/health endpoint found: UI falls back to /health + /analytics/summary.',
]
