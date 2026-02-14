import { Link } from 'react-router-dom'

import { Card } from '../../components/Card'
import { DemoChecklist } from '../../components/DemoChecklist'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../context/AuthContext'
import { useDemoMode } from '../../context/DemoModeContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchActivityFeed } from '../../lib/activity'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { formatRelative } from '../../lib/utils'
import type { AnalyticsSummary, CertListResponse, PollListResponse, SessionListResponse } from '../../types/api'

export const FacultyDashboardPage = () => {
  const { address } = useAuth()
  const { enabled } = useDemoMode()

  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])
  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])
  const certs = useAsyncData(() => apiRequest<CertListResponse>(endpoints.certList), [])
  const analytics = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])
  const activity = useAsyncData(() => fetchActivityFeed({ address: address ?? undefined, limit: 8 }), [address])

  const myPolls = polls.data?.polls.filter((item) => item.creator === address) ?? []
  const mySessions = sessions.data?.sessions.filter((item) => item.creator === address) ?? []

  return (
    <div className="page-grid">
      <section className="card-grid three">
        <Card title="Polls Created by Me">
          <div className="metric">{myPolls.length}</div>
          <p>Total votes (platform): {analytics.data?.total_votes ?? 0}</p>
        </Card>
        <Card title="Sessions Created by Me">
          <div className="metric">{mySessions.length}</div>
          <p>Total check-ins (platform): {analytics.data?.total_checkins ?? 0}</p>
        </Card>
        <Card title="Certificates Issued">
          <div className="metric">{certs.data?.count ?? 0}</div>
          <p>Recent cert activity in LocalNet cache.</p>
        </Card>
      </section>

      <Card title="Quick Actions">
        <div className="button-grid">
          <Link className="btn btn-primary" to="/faculty/voting">
            Create Poll
          </Link>
          <Link className="btn btn-primary" to="/faculty/attendance">
            Create Session
          </Link>
          <Link className="btn btn-primary" to="/faculty/certificates">
            Issue Certificate
          </Link>
        </div>
      </Card>

      <Card title="Analytics Teaser + Anomalies">
        {!analytics.data ? <LoadingSkeleton rows={3} compact /> : null}
        {analytics.data ? (
          <>
            <div className="pill-row">
              <span className="badge">Polls: {analytics.data.total_polls}</span>
              <span className="badge">Votes: {analytics.data.total_votes}</span>
              <span className="badge">Sessions: {analytics.data.total_sessions}</span>
              <span className="badge">Check-ins: {analytics.data.total_checkins}</span>
              <span className="badge">Certs: {analytics.data.total_certs}</span>
            </div>
            <p>
              {analytics.data.total_votes > analytics.data.total_polls * 100
                ? 'Suspicious spike indicator: vote volume is unusually high.'
                : 'No suspicious spikes detected from available summary data.'}
            </p>
          </>
        ) : null}
      </Card>

      <Card title="Recent Faculty Activity">
        {activity.loading ? <LoadingSkeleton rows={4} /> : null}
        {activity.data?.length ? (
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
          title="Faculty Demo Flow"
          items={[
            { label: 'Create a poll with options and window', done: myPolls.length > 0 },
            { label: 'Create attendance session', done: mySessions.length > 0 },
            { label: 'Issue certificate to a student', done: (certs.data?.count ?? 0) > 0 },
            { label: 'Show analytics and anomalies', done: Boolean(analytics.data) },
          ]}
        />
      ) : null}
    </div>
  )
}
