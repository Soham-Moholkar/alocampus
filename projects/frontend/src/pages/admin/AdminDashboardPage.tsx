import { Card } from '../../components/Card'
import { DemoChecklist } from '../../components/DemoChecklist'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useDemoMode } from '../../context/DemoModeContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchActivityFeed } from '../../lib/activity'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { formatRelative } from '../../lib/utils'
import type { AnalyticsSummary, HealthResponse } from '../../types/api'

export const AdminDashboardPage = () => {
  const { enabled } = useDemoMode()

  const analytics = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])
  const health = useAsyncData(() => apiRequest<HealthResponse>(endpoints.health, { auth: false }), [])
  const activity = useAsyncData(() => fetchActivityFeed({ limit: 10 }), [])

  const roleChangeItems = activity.data?.filter((item) => item.kind.includes('role')) ?? []

  return (
    <div className="page-grid">
      <section className="card-grid three">
        <Card title="Total Polls / Votes">
          <div className="metric">{analytics.data ? `${analytics.data.total_polls} / ${analytics.data.total_votes}` : '--'}</div>
        </Card>
        <Card title="Total Sessions / Check-ins">
          <div className="metric">{analytics.data ? `${analytics.data.total_sessions} / ${analytics.data.total_checkins}` : '--'}</div>
        </Card>
        <Card title="Total Certificates">
          <div className="metric">{analytics.data?.total_certs ?? '--'}</div>
        </Card>
      </section>

      <Card title="System Health Summary">
        {health.loading ? <LoadingSkeleton rows={2} compact /> : null}
        {health.data ? (
          <>
            <div className="kv">
              <span>Status</span>
              <span>{health.data.status}</span>
            </div>
            <div className="kv">
              <span>Service</span>
              <span>{health.data.service ?? 'algocampus-bff'}</span>
            </div>
          </>
        ) : null}
      </Card>

      <Card title="Role Changes History">
        {activity.loading ? <LoadingSkeleton rows={4} /> : null}
        {roleChangeItems.length > 0 ? (
          <ul className="timeline">
            {roleChangeItems.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
                <span>{formatRelative(item.created)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No explicit role-change entries in current activity feed.</p>
        )}
      </Card>

      {enabled ? (
        <DemoChecklist
          title="Admin Demo Flow"
          items={[
            { label: 'Check platform totals dashboard', done: Boolean(analytics.data) },
            { label: 'Assign a faculty/admin role', done: roleChangeItems.length > 0 },
            { label: 'Show system health checks', done: Boolean(health.data) },
          ]}
        />
      ) : null}
    </div>
  )
}
