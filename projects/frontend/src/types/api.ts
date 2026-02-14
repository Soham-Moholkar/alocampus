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

export interface CertItem {
  cert_hash: string
  recipient: string
  asset_id?: number
  created?: number
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

export type TxKind = 'vote' | 'checkin' | 'cert' | 'deposit' | 'other'

export interface TxStatus {
  tx_id: string
  kind: string
  status: 'pending' | 'confirmed' | 'failed' | string
  confirmed_round?: number
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

export interface HealthResponse {
  status: string
  service?: string
  algod?: string
  indexer?: string
  kmd?: string
}
