import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../context/AuthContext'
import { fetchActivityFeed } from '../../lib/activity'
import { apiRequest, withQuery } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { formatRelative } from '../../lib/utils'
import { useAsyncData } from '../../hooks/useAsyncData'
import type { CoordinationTaskListResponse, CoordinationVerifyResponse } from '../../types/api'

export const ActivityPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { address, isAuthenticated, role } = useAuth()
  const [searchParams] = useSearchParams()
  const pollIdParam = searchParams.get('pollId')
  const onlyMine = searchParams.get('mine') === '1'
  const [kindFilter, setKindFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const pollId = useMemo(() => {
    if (!pollIdParam) {
      return undefined
    }
    const numeric = Number(pollIdParam)
    return Number.isFinite(numeric) ? numeric : undefined
  }, [pollIdParam])

  const { data, loading, error, refresh } = useAsyncData(
    () =>
      fetchActivityFeed({
        address: onlyMine ? address ?? undefined : undefined,
        pollId,
        limit: 100,
        kind: kindFilter.trim() || undefined,
        tag: tagFilter.trim() || undefined,
        includeSynthetic: !isAuthenticated,
      }),
    [address, kindFilter, onlyMine, pollId, tagFilter],
  )

  const canReadCoordination = isAuthenticated && (role === 'faculty' || role === 'admin')
  const coordination = useAsyncData(
    () =>
      canReadCoordination
        ? apiRequest<CoordinationTaskListResponse>(withQuery(endpoints.coordinationTasks, { limit: 20 }))
        : Promise.resolve({ tasks: [], count: 0 }),
    [canReadCoordination],
  )

  const verifyCoordinationTask = async (taskId: string): Promise<void> => {
    try {
      const result = await apiRequest<CoordinationVerifyResponse>(endpoints.coordinationVerify(taskId))
      enqueueSnackbar(result.message, { variant: result.verified ? 'success' : 'warning' })
      await coordination.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Task verification failed', { variant: 'error' })
    }
  }

  return (
    <div className="page-grid">
      <Card title="Activity Feed" right={<button type="button" className="btn btn-ghost" onClick={() => void refresh()}>Refresh</button>}>
        <p>Read-only audit activity from BFF `/activity` with optional filters.</p>
        <div className="inline-row">
          <input
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
            placeholder="Filter by kind (e.g. poll_created)"
          />
          <input
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            placeholder="Filter by tag (e.g. ai or poll:1)"
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setKindFilter('')
              setTagFilter('')
            }}
          >
            Clear Filters
          </button>
        </div>
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

      {canReadCoordination ? (
        <Card title="Coordination Tasks">
          {coordination.loading ? <LoadingSkeleton rows={3} compact /> : null}
          {coordination.error ? <p className="error-text">{coordination.error}</p> : null}
          {!coordination.loading && coordination.data && coordination.data.count === 0 ? (
            <EmptyState title="No coordination tasks" body="Create tasks from faculty or admin AI/coordinator tools." />
          ) : null}
          {!coordination.loading && coordination.data && coordination.data.count > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Anchor</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {coordination.data.tasks.map((task) => (
                    <tr key={task.task_id}>
                      <td>
                        <strong>{task.title}</strong>
                        <p>{task.description}</p>
                      </td>
                      <td>{task.status}</td>
                      <td>{task.owner}</td>
                      <td>{task.anchor_tx_id ? <CopyButton value={task.anchor_tx_id} label="Copy TX" /> : '--'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact"
                          onClick={() => void verifyCoordinationTask(task.task_id)}
                        >
                          Verify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  )
}
