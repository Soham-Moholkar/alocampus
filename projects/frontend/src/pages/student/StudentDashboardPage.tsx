import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { Card } from '../../components/Card'
import { DataTableCard } from '../../components/DataTableCard'
import { DemoChecklist } from '../../components/DemoChecklist'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { MetricTile } from '../../components/MetricTile'
import { ProgressRing } from '../../components/ProgressRing'
import { WidgetList } from '../../components/WidgetList'
import { useAuth } from '../../context/AuthContext'
import { useDemoMode } from '../../context/DemoModeContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useCurrentRound } from '../../hooks/useCurrentRound'
import { fetchActivityFeed } from '../../lib/activity'
import { ApiError, apiRequest } from '../../lib/api'
import { computeRoundStatus } from '../../lib/abi'
import { demoCertificates, demoTimetableXYZ, getPollPurpose, isDemoPoll, mergePolls } from '../../lib/demoData'
import { endpoints } from '../../lib/endpoints'
import { formatDateTime, formatRelative } from '../../lib/utils'
import type { CertListResponse, PollContextResponse, PollListResponse, SessionListResponse } from '../../types/api'

import studentAvatar from '../../assets/ui/avatar-student.svg'

export const StudentDashboardPage = () => {
  const { address, isAuthenticated } = useAuth()
  const { enabled } = useDemoMode()
  const { currentRound } = useCurrentRound()

  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])
  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])
  const certs = useAsyncData(
    () =>
      isAuthenticated
        ? apiRequest<CertListResponse>(endpoints.certList)
        : Promise.resolve({ certs: [], count: 0 }),
    [isAuthenticated],
  )
  const activity = useAsyncData(
    () => fetchActivityFeed({ address: address ?? undefined, limit: 10, includeSynthetic: !isAuthenticated }),
    [address, isAuthenticated],
  )
  const [pollContexts, setPollContexts] = useState<Record<number, PollContextResponse>>({})

  const mergedPolls = mergePolls(polls.data?.polls)
  const livePollIds = useMemo(() => (polls.data?.polls ?? []).map((poll) => poll.poll_id), [polls.data?.polls])

  useEffect(() => {
    let active = true

    const loadContexts = async (): Promise<void> => {
      if (livePollIds.length === 0) {
        if (active) {
          setPollContexts({})
        }
        return
      }

      const entries = await Promise.all(
        livePollIds.map(async (pollId) => {
          try {
            const context = await apiRequest<PollContextResponse>(endpoints.pollContext(pollId), { auth: false })
            return [pollId, context] as const
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
              return null
            }
            return null
          }
        }),
      )

      if (!active) {
        return
      }

      const next: Record<number, PollContextResponse> = {}
      entries.forEach((entry) => {
        if (entry) {
          next[entry[0]] = entry[1]
        }
      })
      setPollContexts(next)
    }

    void loadContexts()
    return () => {
      active = false
    }
  }, [livePollIds])

  const activePolls = mergedPolls.filter((poll) => {
    if (isDemoPoll(poll)) {
      return true
    }
    return computeRoundStatus(poll.start_round, poll.end_round, currentRound ?? undefined) === 'active'
  })

  const openSessions =
    sessions.data?.sessions.filter(
      (session) => computeRoundStatus(session.open_round, session.close_round, currentRound ?? undefined) === 'active',
    ) ?? []

  const progressItems = activePolls.slice(0, 5)

  const timetableRows = [
    ...demoTimetableXYZ.map((entry) => [entry.time, entry.room, `${entry.subject} (${entry.faculty})`, `${entry.status.toUpperCase()} · DEMO XYZ`]),
    ...(sessions.data?.sessions ?? []).slice(0, 4).map((session) => [
      formatDateTime(session.session_ts),
      `#${session.session_id}`,
      session.course_code,
      computeRoundStatus(session.open_round, session.close_round, currentRound ?? undefined),
    ]),
  ]

  const trend = activePolls.slice(0, 6).map((poll, index) => ({
    label: `P${poll.poll_id}`,
    value: 58 + ((poll.poll_id + index * 5) % 37),
  }))

  const peak = Math.max(...trend.map((item) => item.value), 1)

  const activityItems = (activity.data ?? []).slice(0, 6).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? item.kind,
    meta: formatRelative(item.created),
    avatar: studentAvatar,
  }))

  const certCount = isAuthenticated ? certs.data?.count ?? 0 : demoCertificates.length

  return (
    <div className="page-grid dashboard-grid">
      <Card className="hero-card" title="Student Experience Dashboard" subtitle="Hello XYZ. Your local + on-chain campus activity view.">
        <div className="hero-row">
          <div className="profile-chip">
            <img src={studentAvatar} alt="Student" />
            <div>
              <strong>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'XYZ Student'}</strong>
              <span>Round {currentRound ?? '--'} · Status Active</span>
            </div>
          </div>

          <div className="hero-actions">
            <Link className="btn btn-primary" to="/student/voting" data-tour="student-vote">
              Vote Now
            </Link>
            <Link className="btn" to="/student/attendance" data-tour="student-attendance">
              View Attendance
            </Link>
            <Link className="btn" to="/student/certificates" data-tour="student-certs">
              Certificates
            </Link>
          </div>
        </div>
      </Card>

      <section className="metric-strip">
        <MetricTile title="Active Polls" value={activePolls.length} caption="Live + demo ballots" tone="indigo" />
        <MetricTile title="Sessions Open" value={openSessions.length} caption="Attendance window" tone="teal" />
        <MetricTile title="My Certificates" value={certCount} caption="On-chain + synthetic preview" tone="amber" />
      </section>

      <section className="progress-strip">
        {progressItems.length > 0 ? (
          progressItems.map((poll, index) => (
            <ProgressRing
              key={`progress-${poll.poll_id}`}
              label={poll.question}
              subtitle={isDemoPoll(poll) ? 'Demo poll' : 'Live poll'}
              value={66 + ((poll.poll_id + index * 7) % 28)}
              tone={index % 4 === 0 ? 'indigo' : index % 4 === 1 ? 'teal' : index % 4 === 2 ? 'amber' : 'violet'}
              compact
            />
          ))
        ) : (
          <LoadingSkeleton rows={3} compact />
        )}
      </section>

      <Card title="Voting Context" subtitle="Why these polls are taking place and why your vote matters.">
        {activePolls.length === 0 ? (
          <EmptyState title="No active polls" body="Faculty or council polls will appear here when open." />
        ) : (
          <div className="poll-card-grid">
            {activePolls.map((poll) => (
              <article key={poll.poll_id} className="poll-context-card">
                <h4>#{poll.poll_id} {poll.question}</h4>
                <p>{pollContexts[poll.poll_id]?.purpose ?? getPollPurpose(poll.poll_id)}</p>
                {pollContexts[poll.poll_id] ? (
                  <small>
                    {pollContexts[poll.poll_id].category} · audience {pollContexts[poll.poll_id].audience}
                  </small>
                ) : null}
                <div className="inline-row">
                  <span className={`badge badge-${isDemoPoll(poll) ? 'warning' : 'success'}`}>{isDemoPoll(poll) ? 'Demo Poll' : 'Live Poll'}</span>
                  <Link className="btn btn-primary" to={`/student/voting?pollId=${poll.poll_id}`}>
                    Open & Vote
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Card title="Voting Trend Graph" subtitle="Participation trend snapshot for current active polls.">
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

      <DataTableCard
        title="Today's Timetable (Demo User XYZ + Live Sessions)"
        headers={['Time', 'Room', 'Subject', 'Status']}
        rows={timetableRows}
        emptyText="No sessions available right now."
      />

      {activity.loading ? <LoadingSkeleton rows={4} /> : null}
      {activity.error ? <p className="error-text">{activity.error}</p> : null}
      {!activity.loading && activityItems.length === 0 ? (
        <EmptyState title="No recent updates" body="Poll updates and your actions will appear here." />
      ) : null}
      {!activity.loading && activityItems.length > 0 ? <WidgetList title="Updates (Including Poll Updates)" items={activityItems} /> : null}

      {enabled ? (
        <DemoChecklist
          title="Student Demo Flow"
          items={[
            { label: 'Connect wallet or enter student preview', done: Boolean(address) || enabled },
            { label: 'Open an active poll and cast vote', done: activePolls.length > 0 },
            { label: 'Review attendance and timetable cards', done: timetableRows.length > 0 },
            { label: 'Verify certificate hash', done: certCount > 0 },
          ]}
        />
      ) : null}
    </div>
  )
}
