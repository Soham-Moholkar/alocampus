import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import type { PollListResponse, SessionListResponse } from '../../types/api'

export const FacultyProfilePage = () => {
  const { role, address } = useAuth()

  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])
  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])

  const myPollCount = polls.data?.polls.filter((poll) => poll.creator === address).length ?? 0
  const mySessionCount = sessions.data?.sessions.filter((session) => session.creator === address).length ?? 0

  return (
    <div className="page-grid single">
      <Card title="Faculty Profile">
        <div className="kv">
          <span>Role</span>
          <span>{role}</span>
        </div>
        <div className="kv">
          <span>Address</span>
          <code>{address ?? '--'}</code>
        </div>
        {address ? <CopyButton value={address} label="Copy Address" /> : null}
        <div className="kv">
          <span>Polls Created</span>
          <span>{myPollCount}</span>
        </div>
        <div className="kv">
          <span>Sessions Created</span>
          <span>{mySessionCount}</span>
        </div>
      </Card>
    </div>
  )
}
