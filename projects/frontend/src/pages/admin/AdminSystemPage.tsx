import { Card } from '../../components/Card'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAsyncData } from '../../hooks/useAsyncData'
import { ApiError, apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import type { AnalyticsSummary, HealthResponse } from '../../types/api'

interface SystemHealthView {
  status: string
  source: string
  service?: string
  analytics?: AnalyticsSummary
}

const loadSystemHealth = async (): Promise<SystemHealthView> => {
  try {
    const payload = await apiRequest<HealthResponse>(endpoints.systemHealth)
    return {
      status: payload.status,
      source: endpoints.systemHealth,
      service: payload.service,
    }
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) {
      throw error
    }
  }

  const [health, analytics] = await Promise.all([
    apiRequest<HealthResponse>(endpoints.health, { auth: false }),
    apiRequest<AnalyticsSummary>(endpoints.analyticsSummary),
  ])

  return {
    status: health.status,
    source: `${endpoints.health} + ${endpoints.analyticsSummary}`,
    service: health.service,
    analytics,
  }
}

export const AdminSystemPage = () => {
  const health = useAsyncData(loadSystemHealth, [])

  return (
    <div className="page-grid single">
      <Card title="System Health">
        {health.loading ? <LoadingSkeleton rows={4} /> : null}
        {health.error ? <p className="error-text">{health.error}</p> : null}
        {health.data ? (
          <>
            <div className="kv">
              <span>Status</span>
              <span>{health.data.status}</span>
            </div>
            <div className="kv">
              <span>Route Source</span>
              <code>{health.data.source}</code>
            </div>
            <div className="kv">
              <span>Service</span>
              <span>{health.data.service ?? 'algocampus-bff'}</span>
            </div>

            {health.data.analytics ? (
              <>
                <h4>Connectivity Indicators</h4>
                <p>Algod/Indexer/KMD are considered reachable when analytics and health both respond.</p>
                <div className="pill-row">
                  <span className="badge">polls: {health.data.analytics.total_polls}</span>
                  <span className="badge">votes: {health.data.analytics.total_votes}</span>
                  <span className="badge">sessions: {health.data.analytics.total_sessions}</span>
                  <span className="badge">check-ins: {health.data.analytics.total_checkins}</span>
                  <span className="badge">certs: {health.data.analytics.total_certs}</span>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </Card>
    </div>
  )
}
