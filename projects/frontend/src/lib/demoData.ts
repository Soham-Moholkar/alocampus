import type { ActivityItem, CertItem, Poll, Role, Session } from '../types/api'

const now = Date.now()

export interface DemoTimetableEntry {
  id: string
  time: string
  room: string
  subject: string
  faculty: string
  status: 'lecture' | 'lab' | 'tutorial'
}

export interface DemoAttendanceSubject {
  id: string
  faculty: string
  subjectCode: string
  subjectName: string
  category: 'Theory' | 'Lab-2' | 'Tutorial-2'
  attended: number
  total: number
}

export interface DemoTrendPoint {
  label: string
  percentage: number
}

export interface DemoProfile {
  fullName: string
  registrationId: string
  department: string
  program: string
  semester: string
  contactEmail: string
  phone: string
  campusStatus: string
}

export const demoPolls: Poll[] = [
  {
    poll_id: 9101,
    question: 'Student Council Budget Allocation 2026',
    options: ['Lab Equipment', 'Innovation Club', 'Sports'],
    start_round: 1,
    end_round: 9_999_999_999,
    creator: 'demo:faculty-office',
    app_id: 0,
    created: now - 3600_000,
  },
  {
    poll_id: 9102,
    question: 'Festival Theme Selection',
    options: ['Tech Carnival', 'Sustainability Week', 'Cultural Fusion'],
    start_round: 1,
    end_round: 9_999_999_999,
    creator: 'demo:student-affairs',
    app_id: 0,
    created: now - 2 * 3600_000,
  },
  {
    poll_id: 9103,
    question: 'Extended Library Hours Pilot',
    options: ['Yes', 'No'],
    start_round: 1,
    end_round: 9_999_999_999,
    creator: 'demo:academic-council',
    app_id: 0,
    created: now - 4 * 3600_000,
  },
]

export const demoPollPurpose: Record<number, string> = {
  9101: 'Voting decides where this semester\'s co-curricular development fund gets deployed first.',
  9102: 'Students choose the flagship event direction so planning reflects broad campus preference.',
  9103: 'Feedback vote for trialing longer evening study access before policy finalization.',
}

export const demoTimetableXYZ: DemoTimetableEntry[] = [
  { id: 'xyz-1', time: '10:00 - 11:00', room: '33-309', subject: 'DBMS130', faculty: 'Mr. Mandar P. Diwakar', status: 'lecture' },
  { id: 'xyz-2', time: '11:00 - 12:00', room: '38-719', subject: 'CS200', faculty: 'Mrs. Gayatri G. Asalkar', status: 'lecture' },
  { id: 'xyz-3', time: '01:00 - 02:00', room: '33-309', subject: 'MTH166', faculty: 'Mr. Keshav G. Tambre', status: 'lecture' },
  { id: 'xyz-4', time: '02:00 - 04:00', room: 'Lab-2', subject: 'ML Lab', faculty: 'Dr. Ratnamala N. Bhimanpallewar', status: 'lab' },
]

export const demoAttendanceSubjects: DemoAttendanceSubject[] = [
  { id: 'att-1', faculty: '21086 / Mr. Mandar Pramod Diwakar', subjectCode: 'DS2009', subjectName: 'DMS', category: 'Theory', attended: 9, total: 12 },
  { id: 'att-2', faculty: '21086 / Mr. Mandar Pramod Diwakar', subjectCode: 'DS2009', subjectName: 'DMS', category: 'Lab-2', attended: 1, total: 2 },
  { id: 'att-3', faculty: '21086 / Mr. Mandar Pramod Diwakar', subjectCode: 'DS2009', subjectName: 'DMS', category: 'Tutorial-2', attended: 0, total: 5 },
  { id: 'att-4', faculty: '12174 / Mrs. Gayatri G. Asalkar', subjectCode: 'DS2010', subjectName: 'DAAOA', category: 'Theory', attended: 8, total: 13 },
  { id: 'att-5', faculty: '12097 / Mr. Keshav G. Tambre', subjectCode: 'DS2010', subjectName: 'DAAOA', category: 'Lab-2', attended: 3, total: 4 },
  { id: 'att-6', faculty: '12142 / Ms. Sayali P. Shinde', subjectCode: 'DS2011', subjectName: 'SPAOS', category: 'Theory', attended: 7, total: 12 },
]

export const demoAttendanceTrend: DemoTrendPoint[] = [
  { label: 'Mon', percentage: 78 },
  { label: 'Tue', percentage: 84 },
  { label: 'Wed', percentage: 69 },
  { label: 'Thu', percentage: 88 },
  { label: 'Fri', percentage: 82 },
  { label: 'Sat', percentage: 73 },
]

export const demoCertificates: CertItem[] = [
  {
    cert_hash: 'a1'.repeat(32),
    recipient: 'XYZ Student',
    asset_id: 770101,
    created: now - 10 * 24 * 3600_000,
  },
  {
    cert_hash: 'b2'.repeat(32),
    recipient: 'XYZ Student',
    asset_id: 770102,
    created: now - 7 * 24 * 3600_000,
  },
  {
    cert_hash: 'c3'.repeat(32),
    recipient: 'XYZ Student',
    asset_id: 770103,
    created: now - 2 * 24 * 3600_000,
  },
]

export const demoCertificateMetadata: Record<string, Record<string, unknown>> = {
  [demoCertificates[0].cert_hash]: {
    standard: 'arc3',
    recipient: 'XYZ Student',
    title: 'Blockchain Fundamentals Completion',
    course: 'CSE401',
    issuer: 'AlgoCampus Faculty Council',
    asset_id: demoCertificates[0].asset_id,
    issued_ts: Math.floor((now - 10 * 24 * 3600_000) / 1000),
  },
  [demoCertificates[1].cert_hash]: {
    standard: 'arc3',
    recipient: 'XYZ Student',
    title: 'Attendance Excellence - Semester Midpoint',
    course: 'Campus Record',
    issuer: 'AlgoCampus Academic Cell',
    asset_id: demoCertificates[1].asset_id,
    issued_ts: Math.floor((now - 7 * 24 * 3600_000) / 1000),
  },
  [demoCertificates[2].cert_hash]: {
    standard: 'arc3',
    recipient: 'XYZ Student',
    title: 'Voting Participation Recognition',
    course: 'Governance Module',
    issuer: 'AlgoCampus Student Council',
    asset_id: demoCertificates[2].asset_id,
    issued_ts: Math.floor((now - 2 * 24 * 3600_000) / 1000),
  },
}

export const demoProfiles: Record<Role, DemoProfile> = {
  student: {
    fullName: 'XYZ Student',
    registrationId: '12413287',
    department: 'Computer Science and Engineering (Data Science)',
    program: 'BTech',
    semester: 'Semester 6',
    contactEmail: 'xyz.student@algocampus.local',
    phone: '+91 90000 00001',
    campusStatus: 'Active',
  },
  faculty: {
    fullName: 'Dr. Priya Mentor',
    registrationId: 'FAC-0091',
    department: 'Computer Science and Engineering',
    program: 'Faculty Lead - Academic Operations',
    semester: 'N/A',
    contactEmail: 'priya.mentor@algocampus.local',
    phone: '+91 90000 00002',
    campusStatus: 'On Campus',
  },
  admin: {
    fullName: 'Ops Admin',
    registrationId: 'ADM-0007',
    department: 'Platform Governance',
    program: 'System Administration',
    semester: 'N/A',
    contactEmail: 'ops.admin@algocampus.local',
    phone: '+91 90000 00003',
    campusStatus: 'Monitoring',
  },
}

export const demoActivitySeed: ActivityItem[] = [
  {
    id: 'demo-activity-1',
    kind: 'vote_update',
    title: 'Council Budget Poll is Live',
    description: 'Cast your vote before the governance round closes.',
    actor: 'demo:student-affairs',
    created: now - 35 * 60_000,
    tags: ['poll:9101'],
  },
  {
    id: 'demo-activity-2',
    kind: 'vote_update',
    title: 'Festival Theme Poll Opened',
    description: 'Choose one theme for annual festival planning.',
    actor: 'demo:student-affairs',
    created: now - 2 * 3600_000,
    tags: ['poll:9102'],
  },
]

export const isDemoPoll = (poll: Poll): boolean => poll.app_id === 0 || poll.creator.startsWith('demo:')

export const getPollPurpose = (pollId: number): string =>
  demoPollPurpose[pollId] ?? 'This poll helps faculty and student bodies prioritize campus-level decisions.'

export const mergePolls = (livePolls: Poll[] | undefined): Poll[] => {
  const map = new Map<number, Poll>()
  ;[...(livePolls ?? []), ...demoPolls].forEach((poll) => {
    if (!map.has(poll.poll_id)) {
      map.set(poll.poll_id, poll)
    }
  })

  return [...map.values()].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
}

export const mergeSessionsWithDemo = (liveSessions: Session[] | undefined): Session[] => {
  if (!liveSessions || liveSessions.length === 0) {
    return []
  }
  return [...liveSessions]
}

export const mergeCertificates = (liveCerts: CertItem[] | undefined): (CertItem & { is_demo?: boolean })[] => {
  const map = new Map<string, CertItem & { is_demo?: boolean }>()

  ;(liveCerts ?? []).forEach((cert) => {
    map.set(cert.cert_hash, cert)
  })

  demoCertificates.forEach((cert) => {
    if (!map.has(cert.cert_hash)) {
      map.set(cert.cert_hash, { ...cert, is_demo: true })
    }
  })

  return [...map.values()].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
}

export const isDemoCertificateHash = (certHash: string): boolean => certHash in demoCertificateMetadata
