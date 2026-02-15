export type Role = 'student' | 'faculty' | 'admin'

export interface NonceResponse {
  nonce: string
}

export interface VerifyResponse {
  jwt: string
}

export interface MeResponse {
  address: string
  role: Role
}

export interface DemoAuthLoginRequest {
  role: Role
  username: string
  password: string
  remember_me?: boolean
}

export interface DemoUserProfile {
  id: string
  role: Role
  username: string
  display_name: string
  identifier: string
  is_active: boolean
}

export interface DemoAuthLoginResponse {
  ok: boolean
  demo_token: string
  profile: DemoUserProfile
  message: string
}

export interface Poll {
  poll_id: number
  question: string
  options: string[]
  start_round: number
  end_round: number
  creator: string
  app_id: number
  tx_id?: string
  created?: number
}

export interface PollListResponse {
  polls: Poll[]
  count: number
}

export interface Session {
  session_id: number
  course_code: string
  session_ts: number
  open_round: number
  close_round: number
  creator: string
  app_id: number
  tx_id?: string
  created?: number
}

export interface SessionListResponse {
  sessions: Session[]
  count: number
}

export interface SessionUpdateRequest {
  course_code?: string
  session_ts?: number
  open_round?: number
  close_round?: number
}

export interface SessionCloseResponse {
  ok: boolean
  session_id: number
  close_round: number
  anchor_tx_id?: string
  message: string
}

export interface CertItem {
  cert_hash: string
  recipient: string
  asset_id?: number
  created?: number
  is_demo?: boolean
}

export interface CertListResponse {
  certs: CertItem[]
  count: number
}

export interface CertVerifyResponse {
  valid: boolean
  cert_hash: string
  recipient?: string
  asset_id?: number
  issued_ts?: number
  metadata_url?: string
  message?: string
}

export interface CertUploadVerifyResult {
  ok: boolean
  source: string
  cert_hash?: string
  candidates: string[]
  message: string
}

export interface AnalyticsSummary {
  total_polls: number
  total_votes: number
  total_sessions: number
  total_checkins: number
  total_certs: number
}

export interface SetRoleResponse {
  ok: boolean
  message: string
}

export type TxKind = 'vote' | 'checkin' | 'cert' | 'deposit' | 'feedback' | 'coordination' | 'ai' | 'other'

export interface TxStatus {
  tx_id: string
  kind: string
  status: 'pending' | 'confirmed' | 'failed' | string
  confirmed_round?: number
}

export interface TrackTxRequestPayload {
  tx_id: string
  kind: TxKind
  session_id?: number
  course_code?: string
  student_address?: string
}

export interface CertificateIssueResponse {
  cert_hash: string
  asset_id: number
  metadata_url: string
  tx_id: string
}

export interface ActivityItem {
  id: string
  kind: string
  title: string
  description?: string
  actor?: string
  tx_id?: string
  created: number
  status?: string
  confirmed_round?: number
  tags?: string[]
}

export interface ActivityListResponse {
  items: ActivityItem[]
  count: number
}

export interface HealthResponse {
  status: string
  service?: string
  algod?: string
  indexer?: string
  kmd?: string
}

export interface SystemHealthComponent {
  status: 'ok' | 'degraded' | 'error'
  detail: string
}

export interface SystemHealthResponse {
  status: 'ok' | 'degraded' | 'error'
  service: string
  backend: string
  bff: SystemHealthComponent
  db: SystemHealthComponent
  algod: SystemHealthComponent
  indexer: SystemHealthComponent
  kmd: SystemHealthComponent
}

export interface FeedbackCommitRequest {
  feedback_hash: string
  course_code?: string
  tx_id?: string
  metadata?: Record<string, unknown>
}

export interface FeedbackCommitResponse {
  ok: boolean
  id: string
  message: string
}

export interface FeedbackAggregateResponse {
  total_commits: number
  unique_authors: number
  recent: Array<Record<string, unknown>>
}

export interface CoordinationTask {
  task_id: string
  title: string
  description: string
  owner: string
  status: string
  payload_hash?: string
  anchor_tx_id?: string
  created: number
  updated: number
}

export interface CoordinationTaskListResponse {
  tasks: CoordinationTask[]
  count: number
}

export interface CoordinationVerifyResponse {
  task_id: string
  verified: boolean
  payload_hash?: string
  anchor_tx_id?: string
  message: string
}

export type AiRiskLevel = 'low' | 'medium' | 'high'
export type AiExecutionMode = 'auto' | 'approval_required'
export type AiActionType =
  | 'faculty_poll_plan'
  | 'faculty_session_plan'
  | 'faculty_certificate_plan'
  | 'admin_role_risk_plan'
  | 'admin_system_remediation_plan'
  | 'coordination_task_plan'

export interface AiPlanRequest {
  prompt: string
  context?: Record<string, unknown>
  auto_execute?: boolean
}

export interface AiPlanResponse {
  intent_id: string
  intent_hash: string
  action_type: AiActionType
  risk_level: AiRiskLevel
  execution_mode: AiExecutionMode
  plan: Record<string, unknown>
  message: string
}

export interface AiExecuteResponse {
  intent_id: string
  status: string
  risk_level: AiRiskLevel
  execution_mode: AiExecutionMode
  tx_id?: string
  confirmed_round?: number
  message: string
}

export interface UserProfileResponse {
  address: string
  display_name?: string
  avatar_url?: string
  avatar_hash?: string
  avatar_anchor_tx_id?: string
  updated?: number
}

export interface AvatarUploadResponse {
  ok: boolean
  message: string
  profile: UserProfileResponse
}

export interface AnnouncementItem {
  id: string
  title: string
  body: string
  poll_id?: number
  category: string
  audience: string
  author_address: string
  author_role: string
  is_pinned: boolean
  hash: string
  anchor_tx_id?: string
  created: number
  updated: number
}

export interface AnnouncementListResponse {
  items: AnnouncementItem[]
  count: number
}

export interface PollContextResponse {
  poll_id: number
  purpose: string
  audience: string
  category: string
  extra_note: string
  updated_by: string
  hash: string
  anchor_tx_id?: string
  updated: number
}

export interface AttendanceRecord {
  id: string
  session_id: number
  course_code: string
  student_address: string
  status: string
  tx_id?: string
  anchor_tx_id?: string
  attended_at: number
  created: number
}

export interface AttendanceRecordListResponse {
  records: AttendanceRecord[]
  count: number
}
