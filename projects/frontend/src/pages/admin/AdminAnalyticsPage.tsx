import { Card } from '../../components/Card'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchActivityFeed } from '../../lib/activity'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { formatRelative } from '../../lib/utils'
import type { AnalyticsSummary } from '../../types/api'

export const AdminAnalyticsPage = () => {
  const summary = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])
  const activity = useAsyncData(() => fetchActivityFeed({ limit: 20 }), [])

  return (
    <div className="page-grid">
      <Card title="Platform Counts" right={<button type="button" className="btn btn-ghost" onClick={() => void summary.refresh()}>Refresh</button>}>
        {summary.loading ? <LoadingSkeleton rows={3} compact /> : null}
        {summary.data ? (
          <section className="card-grid five">
            <div className="mini-card">
              <strong>Polls</strong>
              <span>{summary.data.total_polls}</span>
            </div>
            <div className="mini-card">
              <strong>Votes</strong>
              <span>{summary.data.total_votes}</span>
            </div>
            <div className="mini-card">
              <strong>Sessions</strong>
              <span>{summary.data.total_sessions}</span>
            </div>
            <div className="mini-card">
              <strong>Check-ins</strong>
              <span>{summary.data.total_checkins}</span>
            </div>
            <div className="mini-card">
              <strong>Certificates</strong>
              <span>{summary.data.total_certs}</span>
            </div>
          </section>
        ) : null}
      </Card>

      <Card title="Recent Activity">
        {activity.loading ? <LoadingSkeleton rows={5} /> : null}
        {activity.data ? (
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
    </div>
  )
}
