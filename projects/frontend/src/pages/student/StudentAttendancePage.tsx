import { useEffect, useMemo, useState } from 'react'
import { useSnackbar } from 'notistack'
import { useWallet } from '@txnlab/use-wallet-react'

import { checkIn } from '../../contracts/attendanceActions'
import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { ProgressRing } from '../../components/ProgressRing'
import { StatusPill } from '../../components/StatusPill'
import { TxStatus } from '../../components/TxStatus'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useCurrentRound } from '../../hooks/useCurrentRound'
import { useTxToast } from '../../hooks/useTxToast'
import { computeRoundStatus } from '../../lib/abi'
import { apiRequest, withQuery } from '../../lib/api'
import { demoAttendanceSubjects, demoAttendanceTrend } from '../../lib/demoData'
import { endpoints } from '../../lib/endpoints'
import { downloadCsv, downloadJson } from '../../lib/export'
import { getLocalCheckins, markLocalCheckin } from '../../lib/storage'
import { formatDateTime } from '../../lib/utils'
import type {
  AttendanceRecord,
  AttendanceRecordListResponse,
  Session,
  SessionListResponse,
  TxStatus as TxStatusModel,
} from '../../types/api'

interface AttendanceCardItem {
  id: string
  faculty: string
  subjectCode: string
  subjectName: string
  category: string
  attended: number
  total: number
}

const syntheticRows = (subject: AttendanceCardItem): AttendanceRecord[] => {
  const rows: AttendanceRecord[] = []
  const today = Date.now()
  for (let index = 0; index < subject.total; index += 1) {
    const attended = index < subject.attended
    rows.push({
      id: `${subject.id}-${index}`,
      session_id: 9000 + index,
      course_code: subject.subjectCode,
      student_address: 'demo:student',
      status: attended ? 'present' : 'absent',
      attended_at: today - index * 24 * 3600 * 1000,
      created: today - index * 24 * 3600 * 1000,
    })
  }
  return rows
}

export const StudentAttendancePage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { currentRound } = useCurrentRound()
  const { notifyTxLifecycle } = useTxToast()
  const { algodClient, transactionSigner, activeAddress } = useWallet()
  const { isAuthenticated } = useAuth()

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [checkins, setCheckins] = useState<number[]>(() => getLocalCheckins())
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)
  const [txPending, setTxPending] = useState(false)
  const [dialogSubject, setDialogSubject] = useState<AttendanceCardItem | null>(null)

  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])
  const attendanceHistory = useAsyncData(
    () => {
      if (!dialogSubject || !isAuthenticated) {
        return Promise.resolve({ records: [], count: 0 })
      }
      return apiRequest<AttendanceRecordListResponse>(
        withQuery(endpoints.attendanceRecordsMe, {
          course_code: dialogSubject.subjectCode,
          limit: 60,
        }),
      )
    },
    [dialogSubject?.subjectCode, isAuthenticated],
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

  const openSessions =
    sessions.data?.sessions.filter(
      (session) => computeRoundStatus(session.open_round, session.close_round, currentRound ?? undefined) === 'active',
    ) ?? []

  const upcomingSessions =
    sessions.data?.sessions.filter(
      (session) => computeRoundStatus(session.open_round, session.close_round, currentRound ?? undefined) === 'upcoming',
    ) ?? []

  const attendanceCards: AttendanceCardItem[] = [
    ...demoAttendanceSubjects,
    ...((sessions.data?.sessions ?? []).slice(0, 4).map((session) => ({
      id: `live-${session.session_id}`,
      faculty: `Live Session #${session.session_id}`,
      subjectCode: session.course_code,
      subjectName: session.course_code,
      category: 'Theory',
      attended: checkins.includes(session.session_id) ? 1 : 0,
      total: 1,
    })) as AttendanceCardItem[]),
  ]

  const trend = demoAttendanceTrend.map((entry) => ({
    label: entry.label,
    value: entry.percentage,
  }))
  const peak = Math.max(...trend.map((item) => item.value), 1)

  const subjectComparison = attendanceCards
    .map((item) => {
      const percentage = item.total === 0 ? 0 : Math.round((item.attended / item.total) * 100)
      return {
        id: item.id,
        label: `${item.subjectCode} ${item.category}`,
        percentage,
        attended: item.attended,
        total: item.total,
      }
    })
    .sort((a, b) => b.percentage - a.percentage)

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
        metadata: {
          session_id: selectedSession.session_id,
          course_code: selectedSession.course_code,
          student_address: activeAddress,
        },
      })
      setTxStatus(tracked)

      if (tracked.status === 'confirmed') {
        markLocalCheckin(selectedSession.session_id)
        setCheckins(getLocalCheckins())
        if (dialogSubject) {
          await attendanceHistory.refresh()
        }
      }
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Check-in failed', { variant: 'error' })
    } finally {
      setTxPending(false)
    }
  }

  const dialogRows = useMemo<AttendanceRecord[]>(() => {
    if (!dialogSubject) return []
    if (attendanceHistory.data && attendanceHistory.data.count > 0) {
      return attendanceHistory.data.records
    }
    return syntheticRows(dialogSubject)
  }, [attendanceHistory.data, dialogSubject])

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

      <Card title="Attendance by Subject" subtitle="Click a subject card to view date-wise attendance details.">
        <div className="attendance-subject-grid">
          {attendanceCards.map((item, index) => {
            const ratio = item.total === 0 ? 0 : Math.round((item.attended / item.total) * 100)
            return (
              <article key={item.id} className="attendance-subject-card clickable" onClick={() => setDialogSubject(item)}>
                <strong>{item.faculty}</strong>
                <div className="attendance-subject-main">
                  <ProgressRing
                    label={`${ratio.toFixed(1)}%`}
                    subtitle={`${item.attended} / ${item.total}`}
                    value={ratio}
                    tone={index % 4 === 0 ? 'indigo' : index % 4 === 1 ? 'teal' : index % 4 === 2 ? 'amber' : 'violet'}
                    compact
                  />
                  <div className="attendance-subject-meta">
                    <h4>{item.subjectCode}</h4>
                    <p>{item.subjectName}</p>
                    <span className="badge badge-info">{item.category}</span>
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-compact">
                  View Date-wise
                </button>
              </article>
            )
          })}
        </div>
      </Card>

      <Card title="Subject Comparison Graph" subtitle="Quick comparison of attendance health by subject and class type.">
        <div className="attendance-comparison-grid">
          {subjectComparison.map((item) => (
            <article key={item.id} className="attendance-comparison-card">
              <h4>{item.label}</h4>
              <div className="bar-wrap">
                <div className="bar" style={{ width: `${item.percentage}%` }} />
                <strong>{item.percentage}%</strong>
              </div>
              <small>
                {item.attended} attended / {item.total} total
              </small>
            </article>
          ))}
        </div>
      </Card>

      <Card title="Attendance Trend Graph">
        <div className="chart-list">
          {trend.map((item) => (
            <div key={item.label} className="chart-row">
              <span>{item.label}</span>
              <div className="chart-bar-wrap">
                <div className="chart-bar" style={{ width: `${Math.round((item.value / peak) * 100)}%` }} />
              </div>
              <strong>{item.value}%</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Attendance History"
        right={(
          <div className="button-grid">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                downloadJson('student-attendance-history.json', {
                  sessions: sessions.data?.sessions ?? [],
                  checkins,
                  subjects: subjectComparison,
                  trend,
                })
              }
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const rows = (sessions.data?.sessions ?? []).map((session) => [
                  session.session_id,
                  session.course_code,
                  checkins.includes(session.session_id) ? 'present' : 'absent',
                ])
                downloadCsv('student-attendance-history.csv', ['session_id', 'course_code', 'status'], rows)
              }}
            >
              Export CSV
            </button>
          </div>
        )}
      >
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

      {dialogSubject ? (
        <div className="modal-overlay" onClick={() => setDialogSubject(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="card-header">
              <div className="card-heading">
                <h3>{dialogSubject.subjectCode} Date-wise Attendance</h3>
                <p>{dialogSubject.subjectName} · {dialogSubject.category}</p>
              </div>
              <button type="button" className="btn btn-ghost btn-compact" onClick={() => setDialogSubject(null)}>
                Close
              </button>
            </div>

            {attendanceHistory.loading ? <LoadingSkeleton rows={3} compact /> : null}
            {attendanceHistory.error ? <p className="error-text">{attendanceHistory.error}</p> : null}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Session</th>
                    <th>Status</th>
                    <th>Tx ID</th>
                    <th>Anchor</th>
                  </tr>
                </thead>
                <tbody>
                  {dialogRows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.attended_at)}</td>
                      <td>#{row.session_id}</td>
                      <td><StatusPill label={row.status} tone={row.status === 'present' ? 'success' : 'warning'} /></td>
                      <td><code>{row.tx_id ?? '--'}</code></td>
                      <td><code>{row.anchor_tx_id ?? '--'}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      <TxStatus tx={txStatus} loading={txPending} />
    </div>
  )
}
