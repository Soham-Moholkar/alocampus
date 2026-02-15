import { useEffect, useMemo, useState } from 'react'
import { useSnackbar } from 'notistack'
import { useWallet } from '@txnlab/use-wallet-react'

import { isPresent } from '../../contracts/attendanceActions'
import { Card } from '../../components/Card'
import { ChainRoleNotice } from '../../components/ChainRoleNotice'
import { EmptyState } from '../../components/EmptyState'
import { LiveAccessNotice } from '../../components/LiveAccessNotice'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { StatusPill } from '../../components/StatusPill'
import { TxStatus } from '../../components/TxStatus'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useRoleAccess } from '../../hooks/useRoleAccess'
import { useTxToast } from '../../hooks/useTxToast'
import { apiRequest, withQuery } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { downloadCsv, downloadJson } from '../../lib/export'
import { formatDateTime } from '../../lib/utils'
import type {
  AttendanceRecordListResponse,
  AiExecuteResponse,
  AiPlanResponse,
  AnalyticsSummary,
  Session,
  SessionCloseResponse,
  SessionListResponse,
  SessionUpdateRequest,
  TxStatus as TxStatusModel,
} from '../../types/api'

type AttendanceTab = 'create' | 'manage' | 'review' | 'analytics'

export const FacultyAttendancePage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { notifyTxLifecycle } = useTxToast()
  const { algodClient, transactionSigner, activeAddress } = useWallet()
  const { isAuthenticated } = useAuth()
  const { canFacultyWrite, chainRole } = useRoleAccess()

  const [tab, setTab] = useState<AttendanceTab>('create')
  const [courseCode, setCourseCode] = useState('')
  const [sessionTs, setSessionTs] = useState('')
  const [openRound, setOpenRound] = useState('')
  const [closeRound, setCloseRound] = useState('')
  const [busy, setBusy] = useState(false)

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [editCourseCode, setEditCourseCode] = useState('')
  const [editSessionTs, setEditSessionTs] = useState('')
  const [editOpenRound, setEditOpenRound] = useState('')
  const [editCloseRound, setEditCloseRound] = useState('')
  const [manageBusy, setManageBusy] = useState(false)

  const [verifyAddress, setVerifyAddress] = useState('')
  const [presence, setPresence] = useState<boolean | null>(null)
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)
  const [aiPrompt, setAiPrompt] = useState('Create an attendance session for the next class slot with valid round window.')
  const [aiPlan, setAiPlan] = useState<AiPlanResponse | null>(null)
  const [aiExec, setAiExec] = useState<AiExecuteResponse | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [reviewBusy, setReviewBusy] = useState(false)

  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])
  const analytics = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])
  const records = useAsyncData(
    () =>
      selectedSessionId && canFacultyWrite
        ? apiRequest<AttendanceRecordListResponse>(
            withQuery(endpoints.attendanceRecordsSession(selectedSessionId), { limit: 200 }),
          )
        : Promise.resolve({ records: [], count: 0 }),
    [selectedSessionId, canFacultyWrite],
  )

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

  useEffect(() => {
    if (!selectedSession) return
    setEditCourseCode(selectedSession.course_code)
    setEditSessionTs(String(selectedSession.session_ts))
    setEditOpenRound(String(selectedSession.open_round))
    setEditCloseRound(String(selectedSession.close_round))
  }, [selectedSession])

  const createSession = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required to create sessions.', { variant: 'warning' })
      return
    }

    const ts = Number(sessionTs)
    const open = Number(openRound)
    const close = Number(closeRound)

    if (
      !courseCode.trim() ||
      !Number.isFinite(ts) ||
      !Number.isFinite(open) ||
      !Number.isFinite(close) ||
      close <= open
    ) {
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
      setTab('manage')

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

  const updateSession = async (): Promise<void> => {
    if (!canFacultyWrite || !selectedSessionId) {
      enqueueSnackbar('Select a session and ensure faculty/admin chain role is available.', { variant: 'warning' })
      return
    }

    const payload: SessionUpdateRequest = {}
    if (editCourseCode.trim()) payload.course_code = editCourseCode.trim()
    if (editSessionTs.trim()) payload.session_ts = Number(editSessionTs)
    if (editOpenRound.trim()) payload.open_round = Number(editOpenRound)
    if (editCloseRound.trim()) payload.close_round = Number(editCloseRound)

    if (Object.keys(payload).length === 0) {
      enqueueSnackbar('No update fields provided.', { variant: 'warning' })
      return
    }

    setManageBusy(true)
    try {
      await apiRequest<Session>(endpoints.facultySessionUpdate(selectedSessionId), {
        method: 'PATCH',
        body: payload,
      })
      enqueueSnackbar('Session metadata updated.', { variant: 'success' })
      await sessions.refresh()
      await records.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Session update failed', { variant: 'error' })
    } finally {
      setManageBusy(false)
    }
  }

  const closeSession = async (): Promise<void> => {
    if (!canFacultyWrite || !selectedSessionId) {
      enqueueSnackbar('Select a session and ensure faculty/admin chain role is available.', { variant: 'warning' })
      return
    }
    setManageBusy(true)
    try {
      const response = await apiRequest<SessionCloseResponse>(endpoints.facultySessionClose(selectedSessionId), {
        method: 'POST',
      })
      enqueueSnackbar(`Session closed at round ${response.close_round}`, { variant: 'success' })
      await sessions.refresh()
      await records.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Session close failed', { variant: 'error' })
    } finally {
      setManageBusy(false)
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

  const planSessionWithAi = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for AI automation.', { variant: 'warning' })
      return
    }

    setAiBusy(true)
    try {
      const plan = await apiRequest<AiPlanResponse>(endpoints.aiFacultySessionPlan, {
        method: 'POST',
        body: {
          prompt: aiPrompt,
          auto_execute: true,
          context: {
            payload: {
              course_code: courseCode.trim() || selectedSession?.course_code || 'CSE-AUTO',
              session_ts: Number(sessionTs || editSessionTs || Math.floor(Date.now() / 1000)),
              open_round: Number(openRound || editOpenRound || 0),
              close_round: Number(closeRound || editCloseRound || 0),
            },
          },
        },
      })
      setAiPlan(plan)
      setAiExec(null)
      enqueueSnackbar(plan.message, { variant: 'success' })
      await sessions.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'AI planning failed', { variant: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  const executeSessionIntent = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for AI execution.', { variant: 'warning' })
      return
    }
    if (!aiPlan) {
      return
    }
    setAiBusy(true)
    try {
      const response = await apiRequest<AiExecuteResponse>(endpoints.aiExecute(aiPlan.intent_id), { method: 'POST' })
      setAiExec(response)
      enqueueSnackbar(response.message, { variant: response.status === 'executed' ? 'success' : 'info' })
      if (response.tx_id) {
        const tracked = await notifyTxLifecycle({
          txId: response.tx_id,
          kind: 'ai',
          pendingLabel: `Tracking AI execution tx ${response.tx_id}`,
        })
        setTxStatus(tracked)
      }
      await sessions.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'AI execution failed', { variant: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  const updateRecordStatus = async (recordId: string, status: string): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for attendance reviews.', { variant: 'warning' })
      return
    }
    setReviewBusy(true)
    try {
      await apiRequest(endpoints.attendanceRecordStatus(recordId), {
        method: 'PUT',
        body: { status },
      })
      enqueueSnackbar('Attendance record updated.', { variant: 'success' })
      await records.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Attendance review update failed', { variant: 'error' })
    } finally {
      setReviewBusy(false)
    }
  }

  const lateSurge =
    analytics.data && analytics.data.total_sessions > 0
      ? analytics.data.total_checkins / analytics.data.total_sessions > 50
      : false

  return (
    <div className="page-grid">
      {!isAuthenticated ? (
        <LiveAccessNotice body="Session writes require live wallet sign-in. You can still inspect attendance analytics in role mode." />
      ) : null}
      {isAuthenticated && !canFacultyWrite ? <ChainRoleNotice required="faculty" chainRole={chainRole} /> : null}

      <Card title="Attendance Operations">
        <div className="inline-row">
          <button type="button" className={`btn ${tab === 'create' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('create')}>
            Create
          </button>
          <button type="button" className={`btn ${tab === 'manage' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('manage')}>
            Edit / Close
          </button>
          <button type="button" className={`btn ${tab === 'review' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('review')}>
            Review Overrides
          </button>
          <button type="button" className={`btn ${tab === 'analytics' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('analytics')}>
            Analytics
          </button>
        </div>
      </Card>

      {(tab === 'manage' || tab === 'review') ? (
        <Card
          title="Session Detail"
          right={(
            <div className="button-grid">
              <button type="button" className="btn btn-ghost" onClick={() => void sessions.refresh()}>Refresh</button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  downloadJson('faculty-attendance-sessions.json', {
                    sessions: sessions.data?.sessions ?? [],
                    selectedSession,
                  })
                }
              >
                Export JSON
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  downloadCsv(
                    'faculty-attendance-sessions.csv',
                    ['session_id', 'course_code', 'session_ts', 'open_round', 'close_round'],
                    (sessions.data?.sessions ?? []).map((session) => [
                      session.session_id,
                      session.course_code,
                      session.session_ts,
                      session.open_round,
                      session.close_round,
                    ]),
                  )
                }
              >
                Export CSV
              </button>
            </div>
          )}
        >
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
      ) : null}

      {tab === 'create' ? (
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

            <button type="button" className="btn btn-primary" onClick={() => void createSession()} disabled={busy || !canFacultyWrite}>
              {busy ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </Card>
      ) : null}

      {tab === 'create' ? (
        <Card title="AI Session Automation">
          <p>Low-risk attendance session creation can auto-execute via AI intent policy.</p>
          {!isAuthenticated ? (
            <LiveAccessNotice body="AI plan and execution require live authenticated session." />
          ) : null}
          <div className="form-grid">
            <label htmlFor="faculty-session-ai-prompt">Prompt</label>
            <textarea
              id="faculty-session-ai-prompt"
              rows={3}
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
            />
            <div className="inline-row">
              <button type="button" className="btn btn-primary" onClick={() => void planSessionWithAi()} disabled={aiBusy || !canFacultyWrite}>
                {aiBusy ? 'Planning...' : 'AI Plan + Auto Execute'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void executeSessionIntent()}
                disabled={aiBusy || !aiPlan || !canFacultyWrite}
              >
                Execute Intent
              </button>
            </div>
          </div>

          {aiPlan ? (
            <>
              <div className="kv">
                <span>Intent ID</span>
                <code>{aiPlan.intent_id}</code>
              </div>
              <div className="kv">
                <span>Intent Hash</span>
                <code>{aiPlan.intent_hash}</code>
              </div>
              <div className="kv">
                <span>Risk / Mode</span>
                <span>{aiPlan.risk_level} / {aiPlan.execution_mode}</span>
              </div>
            </>
          ) : null}
          {aiExec ? (
            <div className="kv">
              <span>Execution</span>
              <span>{aiExec.status}{aiExec.tx_id ? ` (${aiExec.tx_id})` : ''}</span>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === 'manage' ? (
        <Card title="Edit / Close Session">
          {!selectedSession ? (
            <EmptyState title="No session selected" body="Choose a session from Session Detail first." />
          ) : (
            <div className="form-grid">
              <label htmlFor="edit-course-code">Course Code</label>
              <input
                id="edit-course-code"
                value={editCourseCode}
                onChange={(event) => setEditCourseCode(event.target.value)}
              />

              <label htmlFor="edit-session-ts">Session Timestamp (unix)</label>
              <input
                id="edit-session-ts"
                value={editSessionTs}
                onChange={(event) => setEditSessionTs(event.target.value)}
              />

              <label htmlFor="edit-open-round">Open Round</label>
              <input
                id="edit-open-round"
                value={editOpenRound}
                onChange={(event) => setEditOpenRound(event.target.value)}
              />

              <label htmlFor="edit-close-round">Close Round</label>
              <input
                id="edit-close-round"
                value={editCloseRound}
                onChange={(event) => setEditCloseRound(event.target.value)}
              />

              <div className="inline-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void updateSession()}
                  disabled={!canFacultyWrite || manageBusy}
                >
                  {manageBusy ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void closeSession()}
                  disabled={!canFacultyWrite || manageBusy}
                >
                  Close Session Early
                </button>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {tab === 'manage' && selectedSession ? (
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

      {tab === 'review' && selectedSession ? (
        <Card title="Attendance Exception Review" subtitle="Review date-wise records and apply late/absent/excused overrides.">
          {records.loading ? <LoadingSkeleton rows={3} compact /> : null}
          {records.error ? <p className="error-text">{records.error}</p> : null}
          {records.data && records.data.count > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Tx</th>
                    <th>Anchor</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {records.data.records.map((record) => (
                    <tr key={record.id}>
                      <td><code>{record.student_address}</code></td>
                      <td><StatusPill label={record.status} tone={record.status === 'present' ? 'success' : 'warning'} /></td>
                      <td>{formatDateTime(record.attended_at)}</td>
                      <td><code>{record.tx_id ?? '--'}</code></td>
                      <td><code>{record.anchor_tx_id ?? '--'}</code></td>
                      <td>
                        <div className="inline-row">
                          <button type="button" className="btn btn-ghost btn-compact" onClick={() => void updateRecordStatus(record.id, 'present')} disabled={!canFacultyWrite || reviewBusy}>
                            Present
                          </button>
                          <button type="button" className="btn btn-ghost btn-compact" onClick={() => void updateRecordStatus(record.id, 'late')} disabled={!canFacultyWrite || reviewBusy}>
                            Late
                          </button>
                          <button type="button" className="btn btn-ghost btn-compact" onClick={() => void updateRecordStatus(record.id, 'absent')} disabled={!canFacultyWrite || reviewBusy}>
                            Absent
                          </button>
                          <button type="button" className="btn btn-ghost btn-compact" onClick={() => void updateRecordStatus(record.id, 'excused')} disabled={!canFacultyWrite || reviewBusy}>
                            Excused
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No check-ins tracked yet" body="Attendance records appear after confirmed check-in tracking." />
          )}
        </Card>
      ) : null}

      {tab === 'analytics' ? (
        <Card
          title="Attendance Analytics"
          right={(
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadJson('faculty-attendance-analytics.json', analytics.data)}
              disabled={!analytics.data}
            >
              Export JSON
            </button>
          )}
        >
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
      ) : null}

      <TxStatus tx={txStatus} loading={busy || aiBusy || manageBusy || reviewBusy} />
    </div>
  )
}

