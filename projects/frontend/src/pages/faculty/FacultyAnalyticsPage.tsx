import { Card } from '../../components/Card'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAsyncData } from '../../hooks/useAsyncData'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import type { AnalyticsSummary, FeedbackAggregateResponse, PollListResponse, SessionListResponse } from '../../types/api'

export const FacultyAnalyticsPage = () => {
  const summary = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])
  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])
  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])
  const feedback = useAsyncData(() => apiRequest<FeedbackAggregateResponse>(endpoints.feedbackAggregate), [])

  const bars = summary.data
    ? [
        { label: 'Polls', value: summary.data.total_polls },
        { label: 'Votes', value: summary.data.total_votes },
        { label: 'Sessions', value: summary.data.total_sessions },
        { label: 'Check-ins', value: summary.data.total_checkins },
        { label: 'Certs', value: summary.data.total_certs },
      ]
    : []

  const peak = bars.reduce((max, entry) => Math.max(max, entry.value), 1)

  return (
    <div className="page-grid">
      <Card title="Summary Counts" right={<button type="button" className="btn btn-ghost" onClick={() => void summary.refresh()}>Refresh</button>}>
        {summary.loading ? <LoadingSkeleton rows={3} /> : null}
        {summary.error ? <p className="error-text">{summary.error}</p> : null}
        {summary.data ? (
          <section className="card-grid five">
            {bars.map((item) => (
              <div className="mini-card" key={item.label}>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
            ))}
          </section>
        ) : null}
      </Card>

      <Card title="Simple Chart">
        {!summary.data ? <LoadingSkeleton rows={3} compact /> : null}
        {summary.data ? (
          <div className="chart-list">
            {bars.map((item) => (
              <div key={item.label} className="chart-row">
                <span>{item.label}</span>
                <div className="chart-bar-wrap">
                  <div className="chart-bar" style={{ width: `${Math.round((item.value / peak) * 100)}%` }} />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card title="Anomalies Widget">
        <p>
          {summary.data && summary.data.total_votes > summary.data.total_polls * 100
            ? 'Suspicious vote spike: votes/poll ratio exceeds threshold.'
            : 'No suspicious voting spikes from current summary.'}
        </p>
        <p>
          {summary.data && summary.data.total_checkins > summary.data.total_sessions * 50
            ? 'Late surge indicator: high check-ins per session.'
            : 'No late surge from current summary.'}
        </p>
      </Card>

      <Card title="Feedback Aggregates (hash-only)">
        {feedback.loading ? <LoadingSkeleton rows={2} compact /> : null}
        {feedback.error ? <p className="error-text">{feedback.error}</p> : null}
        {feedback.data ? (
          <>
            <p>Total commits: {feedback.data.total_commits}</p>
            <p>Unique authors: {feedback.data.unique_authors}</p>
            {feedback.data.recent.length > 0 ? (
              <ul className="hash-list">
                {feedback.data.recent.slice(0, 10).map((item, index) => (
                  <li key={`${item.id ?? index}`}>
                    <code>{String(item.hash ?? '--')}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No feedback commitments found.</p>
            )}
          </>
        ) : null}
      </Card>

      <Card title="Dataset Sizes">
        <p>Poll rows: {polls.data?.count ?? 0}</p>
        <p>Session rows: {sessions.data?.count ?? 0}</p>
      </Card>
    </div>
  )
}
