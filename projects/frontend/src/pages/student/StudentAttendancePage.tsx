import { useEffect, useMemo, useState } from 'react'
import { useSnackbar } from 'notistack'
import { useWallet } from '@txnlab/use-wallet-react'

import { checkIn } from '../../contracts/attendanceActions'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { StatusPill } from '../../components/StatusPill'
import { TxStatus } from '../../components/TxStatus'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useCurrentRound } from '../../hooks/useCurrentRound'
import { useTxToast } from '../../hooks/useTxToast'
import { computeRoundStatus } from '../../lib/abi'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { getLocalCheckins, markLocalCheckin } from '../../lib/storage'
import { formatDateTime } from '../../lib/utils'
import type { Session, SessionListResponse, TxStatus as TxStatusModel } from '../../types/api'

export const StudentAttendancePage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { currentRound } = useCurrentRound()
  const { notifyTxLifecycle } = useTxToast()
  const { algodClient, transactionSigner, activeAddress } = useWallet()

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [checkins, setCheckins] = useState<number[]>(() => getLocalCheckins())
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)
  const [txPending, setTxPending] = useState(false)

  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])

  useEffect(() => {
    if (!selectedSessionId && sessions.data?.sessions.length) {
      setSelectedSessionId(sessions.data.sessions[0].session_id)
    }
  }, [selectedSessionId, sessions.data?.sessions])

  const selectedSession = useMemo<Session | null>(() => {
    if (!selectedSessionId || !sessions.data) {
      return null
    }
    return sessions.data.sessions.find((session) => session.session_id === selectedSessionId) ?? null
  }, [selectedSessionId, sessions.data])

  const openSessions =
    sessions.data?.sessions.filter(
      (session) => computeRoundStatus(session.open_round, session.close_round, currentRound ?? undefined) === 'active',
    ) ?? []

  const upcomingSessions =
    sessions.data?.sessions.filter(
      (session) => computeRoundStatus(session.open_round, session.close_round, currentRound ?? undefined) === 'upcoming',
    ) ?? []

  const performCheckin = async (): Promise<void> => {
    if (!selectedSession || !activeAddress) {
      enqueueSnackbar('Select a session and connect wallet.', { variant: 'warning' })
      return
    }

    setTxPending(true)

    try {
      const submission = await checkIn(
        {
          algodClient,
          transactionSigner,
          sender: activeAddress,
          appId: selectedSession.app_id,
        },
        selectedSession.session_id,
      )

      if (!submission.txId) {
        throw new Error('Check-in submitted but tx id was not returned')
      }

      const tracked = await notifyTxLifecycle({
        txId: submission.txId,
        kind: 'checkin',
        pendingLabel: `Attendance check-in submitted (${submission.txId})`,
      })
      setTxStatus(tracked)

      if (tracked.status === 'confirmed') {
        markLocalCheckin(selectedSession.session_id)
        setCheckins(getLocalCheckins())
      }
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Check-in failed', { variant: 'error' })
    } finally {
      setTxPending(false)
    }
  }

  return (
    <div className="page-grid">
      <Card title="Open and Upcoming Sessions" right={<button type="button" className="btn btn-ghost" onClick={() => void sessions.refresh()}>Refresh</button>}>
        {sessions.loading ? <LoadingSkeleton rows={5} /> : null}
        {sessions.error ? <p className="error-text">{sessions.error}</p> : null}
        {!sessions.loading && sessions.data && sessions.data.count === 0 ? (
          <EmptyState title="No sessions" body="Faculty has not created attendance sessions yet." />
        ) : null}

        {!sessions.loading && sessions.data && sessions.data.count > 0 ? (
          <>
            <div className="list-select">
              <label htmlFor="session-select">Session</label>
              <select
                id="session-select"
                value={selectedSessionId ?? ''}
                onChange={(event) => setSelectedSessionId(Number(event.target.value))}
              >
                {sessions.data.sessions.map((session) => (
                  <option key={session.session_id} value={session.session_id}>
                    #{session.session_id} - {session.course_code}
                  </option>
                ))}
              </select>
            </div>

            <div className="pill-row">
              <StatusPill label={`Open now: ${openSessions.length}`} tone="success" />
              <StatusPill label={`Upcoming: ${upcomingSessions.length}`} tone="info" />
            </div>
          </>
        ) : null}
      </Card>

      {selectedSession ? (
        <Card title={`Session #${selectedSession.session_id}`}>
          <div className="kv">
            <span>Course</span>
            <span>{selectedSession.course_code}</span>
          </div>
          <div className="kv">
            <span>Session time</span>
            <span>{formatDateTime(selectedSession.session_ts)}</span>
          </div>
          <div className="kv">
            <span>Round window</span>
            <span>
              {selectedSession.open_round} - {selectedSession.close_round}
            </span>
          </div>
          <div className="kv">
            <span>Status</span>
            <StatusPill
              label={computeRoundStatus(selectedSession.open_round, selectedSession.close_round, currentRound ?? undefined)}
              tone="info"
            />
          </div>

          <button type="button" className="btn btn-primary" onClick={() => void performCheckin()} disabled={txPending}>
            {txPending ? 'Submitting...' : 'Check In'}
          </button>
        </Card>
      ) : null}

      <Card title="Attendance History">
        {sessions.data?.sessions.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Course</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.data.sessions.map((session) => (
                  <tr key={session.session_id}>
                    <td>#{session.session_id}</td>
                    <td>{session.course_code}</td>
                    <td>
                      {checkins.includes(session.session_id) ? (
                        <StatusPill label="present" tone="success" />
                      ) : (
                        <StatusPill label="absent" tone="warning" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No history yet" body="Your attendance record appears after sessions are created." />
        )}
      </Card>

      <TxStatus tx={txStatus} loading={txPending} />
    </div>
  )
}
