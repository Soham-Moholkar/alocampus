import { Card } from '../../components/Card'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchActivityFeed } from '../../lib/activity'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { downloadCsv, downloadJson } from '../../lib/export'
import { formatRelative } from '../../lib/utils'
import type { AnalyticsSummary } from '../../types/api'

export const AdminAnalyticsPage = () => {
  const { isAuthenticated } = useAuth()
  const summary = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])
  const activity = useAsyncData(() => fetchActivityFeed({ limit: 20, includeSynthetic: !isAuthenticated }), [isAuthenticated])

  const summaryRows = summary.data
    ? [
        ['polls', summary.data.total_polls],
        ['votes', summary.data.total_votes],
        ['sessions', summary.data.total_sessions],
        ['checkins', summary.data.total_checkins],
        ['certificates', summary.data.total_certs],
      ]
    : []

  return (
    <div className="page-grid">
      <Card
        title="Platform Counts"
        right={(
          <div className="button-grid">
            <button type="button" className="btn btn-ghost" onClick={() => void summary.refresh()}>Refresh</button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadJson('admin-analytics-summary.json', summary.data)}
              disabled={!summary.data}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadCsv('admin-analytics-summary.csv', ['metric', 'value'], summaryRows)}
              disabled={!summary.data}
            >
              Export CSV
            </button>
          </div>
        )}
      >
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

      <Card
        title="Recent Activity"
        right={(
          <div className="button-grid">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadJson('admin-recent-activity.json', activity.data ?? [])}
              disabled={!activity.data}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                downloadCsv(
                  'admin-recent-activity.csv',
                  ['id', 'kind', 'title', 'description', 'actor', 'created'],
                  (activity.data ?? []).map((item) => [
                    item.id,
                    item.kind,
                    item.title,
                    item.description ?? '',
                    item.actor ?? '',
                    new Date(item.created).toISOString(),
                  ]),
                )
              }
              disabled={!activity.data}
            >
              Export CSV
            </button>
          </div>
        )}
      >
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
