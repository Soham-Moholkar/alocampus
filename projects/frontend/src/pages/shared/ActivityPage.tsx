import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../context/AuthContext'
import { fetchActivityFeed } from '../../lib/activity'
import { formatRelative } from '../../lib/utils'
import { useAsyncData } from '../../hooks/useAsyncData'

export const ActivityPage = () => {
  const { address } = useAuth()
  const [searchParams] = useSearchParams()
  const pollIdParam = searchParams.get('pollId')
  const onlyMine = searchParams.get('mine') === '1'

  const pollId = useMemo(() => {
    if (!pollIdParam) {
      return undefined
    }
    const numeric = Number(pollIdParam)
    return Number.isFinite(numeric) ? numeric : undefined
  }, [pollIdParam])

  const { data, loading, error, refresh } = useAsyncData(
    () => fetchActivityFeed({ address: onlyMine ? address ?? undefined : undefined, pollId, limit: 100 }),
    [address, onlyMine, pollId],
  )

  return (
    <div className="page-grid">
      <Card title="Activity Feed" right={<button type="button" className="btn btn-ghost" onClick={() => void refresh()}>Refresh</button>}>
        <p>Read-only audit activity from BFF. When `/activity` is unavailable, this page uses fallback list synthesis.</p>
        {loading ? <LoadingSkeleton rows={5} /> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!loading && data && data.length === 0 ? (
          <EmptyState title="No activity" body="No activity found for the selected filter." />
        ) : null}

        {!loading && data && data.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Title</th>
                  <th>Actor</th>
                  <th>Time</th>
                  <th>TX</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.kind}</td>
                    <td>{item.title}</td>
                    <td>{item.actor ?? '--'}</td>
                    <td>{formatRelative(item.created)}</td>
                    <td>{item.tx_id ? <CopyButton value={item.tx_id} label="Copy" /> : '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
