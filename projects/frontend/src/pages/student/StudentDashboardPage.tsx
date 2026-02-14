import { Link } from 'react-router-dom'

import { Card } from '../../components/Card'
import { DemoChecklist } from '../../components/DemoChecklist'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../context/AuthContext'
import { useDemoMode } from '../../context/DemoModeContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useCurrentRound } from '../../hooks/useCurrentRound'
import { fetchActivityFeed } from '../../lib/activity'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { computeRoundStatus } from '../../lib/abi'
import { formatRelative } from '../../lib/utils'
import type { CertListResponse, PollListResponse, SessionListResponse } from '../../types/api'

export const StudentDashboardPage = () => {
  const { address } = useAuth()
  const { enabled } = useDemoMode()
  const { currentRound } = useCurrentRound()

  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])
  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])
  const certs = useAsyncData(() => apiRequest<CertListResponse>(endpoints.certList), [])
  const activity = useAsyncData(() => fetchActivityFeed({ address: address ?? undefined, limit: 8 }), [address])

  const activePolls =
    polls.data?.polls.filter((poll) => computeRoundStatus(poll.start_round, poll.end_round, currentRound ?? undefined) === 'active') ?? []
  const openSessions =
    sessions.data?.sessions.filter(
      (session) => computeRoundStatus(session.open_round, session.close_round, currentRound ?? undefined) === 'active',
    ) ?? []

  return (
    <div className="page-grid">
      <section className="card-grid three">
        <Card title="Active Polls">
          <div className="metric">{activePolls.length}</div>
          <Link className="btn" to="/student/voting">
            Go vote
          </Link>
        </Card>
        <Card title="Sessions Open Now">
          <div className="metric">{openSessions.length}</div>
          <Link className="btn" to="/student/attendance">
            Check-in
          </Link>
        </Card>
        <Card title="My Certificates">
          <div className="metric">{certs.data?.count ?? 0}</div>
          <Link className="btn" to="/student/certificates">
            Verify
          </Link>
        </Card>
      </section>

      <Card title="Recent Activity (My Actions)">
        {activity.loading ? <LoadingSkeleton rows={4} /> : null}
        {activity.error ? <p className="error-text">{activity.error}</p> : null}
        {!activity.loading && activity.data && activity.data.length === 0 ? (
          <EmptyState title="No activity yet" body="Your on-chain and cached actions will appear here." />
        ) : null}
        {!activity.loading && activity.data && activity.data.length > 0 ? (
          <ul className="timeline">
            {activity.data.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <span>{formatRelative(item.created)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {enabled ? (
        <DemoChecklist
          title="Student Demo Flow"
          items={[
            { label: 'Connect wallet and sign in', done: Boolean(address) },
            { label: 'Cast a vote in an active poll', done: activePolls.length > 0 },
            { label: 'Submit attendance check-in', done: openSessions.length > 0 },
            { label: 'Verify your certificate hash', done: (certs.data?.count ?? 0) > 0 },
          ]}
        />
      ) : null}
    </div>
  )
}
