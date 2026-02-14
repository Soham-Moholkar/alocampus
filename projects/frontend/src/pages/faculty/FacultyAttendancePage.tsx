import { useEffect, useMemo, useState } from 'react'
import { useSnackbar } from 'notistack'
import { useWallet } from '@txnlab/use-wallet-react'

import { isPresent } from '../../contracts/attendanceActions'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { StatusPill } from '../../components/StatusPill'
import { TxStatus } from '../../components/TxStatus'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useTxToast } from '../../hooks/useTxToast'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { formatDateTime } from '../../lib/utils'
import type {
  AnalyticsSummary,
  Session,
  SessionListResponse,
  TxStatus as TxStatusModel,
} from '../../types/api'

export const FacultyAttendancePage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { notifyTxLifecycle } = useTxToast()
  const { algodClient, transactionSigner, activeAddress } = useWallet()

  const [courseCode, setCourseCode] = useState('')
  const [sessionTs, setSessionTs] = useState('')
  const [openRound, setOpenRound] = useState('')
  const [closeRound, setCloseRound] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [verifyAddress, setVerifyAddress] = useState('')
  const [presence, setPresence] = useState<boolean | null>(null)
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)

  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])
  const analytics = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])

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

  const createSession = async (): Promise<void> => {
    const ts = Number(sessionTs)
    const open = Number(openRound)
    const close = Number(closeRound)

    if (!courseCode.trim() || !Number.isFinite(ts) || !Number.isFinite(open) || !Number.isFinite(close) || close <= open) {
      enqueueSnackbar('Fill valid course, timestamp, and round window.', { variant: 'warning' })
      return
    }

    setBusy(true)
    try {
      const session = await apiRequest<Session>(endpoints.facultySessions, {
        method: 'POST',
        body: {
          course_code: courseCode.trim(),
          session_ts: ts,
          open_round: open,
          close_round: close,
        },
      })

      enqueueSnackbar(`Session #${session.session_id} created`, { variant: 'success' })
      setCourseCode('')
      setSessionTs('')
      setOpenRound('')
      setCloseRound('')
      await sessions.refresh()
      setSelectedSessionId(session.session_id)

      if (session.tx_id) {
        const tracked = await notifyTxLifecycle({
          txId: session.tx_id,
          kind: 'other',
          pendingLabel: `Tracking session create tx ${session.tx_id}`,
        })
        setTxStatus(tracked)
      }
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Session creation failed', { variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const verifyPresence = async (): Promise<void> => {
    if (!selectedSession || !activeAddress) {
      enqueueSnackbar('Select a session and connect wallet.', { variant: 'warning' })
      return
    }
    if (verifyAddress.trim().length !== 58) {
      enqueueSnackbar('Enter a valid Algorand address.', { variant: 'warning' })
      return
    }

    try {
      const value = await isPresent(
        {
          algodClient,
          transactionSigner,
          sender: activeAddress,
          appId: selectedSession.app_id,
        },
        selectedSession.session_id,
        verifyAddress.trim(),
      )
      setPresence(value)
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Presence verification failed', { variant: 'error' })
      setPresence(null)
    }
  }

  const lateSurge =
    analytics.data && analytics.data.total_sessions > 0
      ? analytics.data.total_checkins / analytics.data.total_sessions > 50
      : false

  return (
    <div className="page-grid">
      <Card title="Create Attendance Session">
        <div className="form-grid">
          <label htmlFor="course-code">Course Code</label>
          <input id="course-code" value={courseCode} onChange={(event) => setCourseCode(event.target.value)} />

          <label htmlFor="session-ts">Session Timestamp (unix)</label>
          <input id="session-ts" value={sessionTs} onChange={(event) => setSessionTs(event.target.value)} />

          <label htmlFor="open-round">Open Round</label>
          <input id="open-round" value={openRound} onChange={(event) => setOpenRound(event.target.value)} />

          <label htmlFor="close-round">Close Round</label>
          <input id="close-round" value={closeRound} onChange={(event) => setCloseRound(event.target.value)} />

          <button type="button" className="btn btn-primary" onClick={() => void createSession()} disabled={busy}>
            {busy ? 'Creating...' : 'Create Session'}
          </button>
        </div>
      </Card>

      <Card title="Session Detail" right={<button type="button" className="btn btn-ghost" onClick={() => void sessions.refresh()}>Refresh</button>}>
        {sessions.loading ? <LoadingSkeleton rows={4} /> : null}
        {!sessions.loading && sessions.data?.count === 0 ? (
          <EmptyState title="No sessions" body="Create a session to manage attendance." />
        ) : null}

        {sessions.data?.count ? (
          <>
            <div className="list-select">
              <label htmlFor="session-selector">Session</label>
              <select
                id="session-selector"
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

            {selectedSession ? (
              <>
                <div className="kv">
                  <span>Course</span>
                  <span>{selectedSession.course_code}</span>
                </div>
                <div className="kv">
                  <span>Session Time</span>
                  <span>{formatDateTime(selectedSession.session_ts)}</span>
                </div>
                <div className="kv">
                  <span>Round Window</span>
                  <span>
                    {selectedSession.open_round} - {selectedSession.close_round}
                  </span>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </Card>

      {selectedSession ? (
        <Card title="Verify Student Presence">
          <div className="inline-row">
            <input
              value={verifyAddress}
              onChange={(event) => setVerifyAddress(event.target.value)}
              placeholder="Student address"
            />
            <button type="button" className="btn btn-primary" onClick={() => void verifyPresence()}>
              Verify
            </button>
          </div>
          {presence !== null ? (
            <StatusPill label={presence ? 'present' : 'not present'} tone={presence ? 'success' : 'warning'} />
          ) : null}
        </Card>
      ) : null}

      <Card title="Attendance Analytics">
        {analytics.loading ? <LoadingSkeleton rows={3} compact /> : null}
        {analytics.data ? (
          <>
            <div className="pill-row">
              <span className="badge">Sessions: {analytics.data.total_sessions}</span>
              <span className="badge">Check-ins: {analytics.data.total_checkins}</span>
            </div>
            <p>{lateSurge ? 'Late surge anomaly indicator: elevated check-ins per session.' : 'No late surge anomaly from available summary.'}</p>
          </>
        ) : null}
      </Card>

      <TxStatus tx={txStatus} loading={busy} />
    </div>
  )
}
