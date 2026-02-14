import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { ChainRoleNotice } from '../../components/ChainRoleNotice'
import { DataTableCard } from '../../components/DataTableCard'
import { DemoChecklist } from '../../components/DemoChecklist'
import { LiveAccessNotice } from '../../components/LiveAccessNotice'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { MetricTile } from '../../components/MetricTile'
import { ProgressRing } from '../../components/ProgressRing'
import { WidgetList } from '../../components/WidgetList'
import { useAuth } from '../../context/AuthContext'
import { useDemoMode } from '../../context/DemoModeContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useRoleAccess } from '../../hooks/useRoleAccess'
import { fetchActivityFeed } from '../../lib/activity'
import { apiRequest, withQuery } from '../../lib/api'
import { demoCertificates } from '../../lib/demoData'
import { endpoints } from '../../lib/endpoints'
import { formatDateTime, formatRelative } from '../../lib/utils'
import type {
  AnnouncementItem,
  AnnouncementListResponse,
  AnalyticsSummary,
  CertListResponse,
  CoordinationTaskListResponse,
  CoordinationVerifyResponse,
  PollListResponse,
  PollContextResponse,
  SessionListResponse,
} from '../../types/api'

import facultyAvatar from '../../assets/ui/avatar-faculty.svg'

export const FacultyDashboardPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { address, isAuthenticated } = useAuth()
  const { canFacultyWrite, chainRole } = useRoleAccess()
  const { enabled } = useDemoMode()

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskBusy, setTaskBusy] = useState(false)
  const [announcementTitle, setAnnouncementTitle] = useState('')
  const [announcementBody, setAnnouncementBody] = useState('')
  const [announcementCategory, setAnnouncementCategory] = useState('academic')
  const [announcementAudience, setAnnouncementAudience] = useState('all')
  const [announcementPollId, setAnnouncementPollId] = useState('')
  const [announcementBusy, setAnnouncementBusy] = useState(false)
  const [contextPollId, setContextPollId] = useState<number | null>(null)
  const [contextPurpose, setContextPurpose] = useState('')
  const [contextAudience, setContextAudience] = useState('all')
  const [contextCategory, setContextCategory] = useState('governance')
  const [contextNote, setContextNote] = useState('')
  const [contextBusy, setContextBusy] = useState(false)

  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])
  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])
  const certs = useAsyncData(
    () =>
      isAuthenticated
        ? apiRequest<CertListResponse>(endpoints.certList)
        : Promise.resolve({ certs: [], count: 0 }),
    [isAuthenticated],
  )
  const analytics = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])
  const activity = useAsyncData(
    () => fetchActivityFeed({ address: address ?? undefined, limit: 8, includeSynthetic: !isAuthenticated }),
    [address, isAuthenticated],
  )
  const coordination = useAsyncData(
    () =>
      isAuthenticated
        ? apiRequest<CoordinationTaskListResponse>(endpoints.coordinationTasks)
        : Promise.resolve({ tasks: [], count: 0 }),
    [isAuthenticated],
  )
  const announcements = useAsyncData(
    () => apiRequest<AnnouncementListResponse>(withQuery(endpoints.announcements, { limit: 20 }), { auth: false }),
    [],
  )
  const pollContext = useAsyncData<PollContextResponse | null>(
    () =>
      contextPollId
        ? apiRequest<PollContextResponse>(endpoints.pollContext(contextPollId), { auth: false }).catch(() => null)
        : Promise.resolve(null),
    [contextPollId],
  )

  const myPolls = polls.data?.polls.filter((item) => item.creator === address) ?? []
  const mySessions = sessions.data?.sessions.filter((item) => item.creator === address) ?? []

  const scheduleRows = (mySessions.length > 0 ? mySessions : sessions.data?.sessions ?? []).slice(0, 6).map((session) => [
    formatDateTime(session.session_ts),
    session.course_code,
    `#${session.session_id}`,
    session.tx_id ? 'Synced' : 'Pending cache',
  ])

  const activityItems = (activity.data ?? []).slice(0, 6).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? item.kind,
    meta: formatRelative(item.created),
    avatar: facultyAvatar,
  }))

  const pollTurnout = analytics.data
    ? Math.min(100, Math.round((analytics.data.total_votes / Math.max(1, analytics.data.total_polls * 10)) * 100))
    : 0
  const attendanceFlow = analytics.data
    ? Math.min(100, Math.round((analytics.data.total_checkins / Math.max(1, analytics.data.total_sessions * 8)) * 100))
    : 0
  const certVelocity = analytics.data
    ? Math.min(100, Math.round((analytics.data.total_certs / Math.max(1, analytics.data.total_sessions || 1)) * 100))
    : 0

  const certCount = isAuthenticated ? certs.data?.count ?? 0 : demoCertificates.length

  const opsBars = [
    { label: 'Poll Turnout', value: pollTurnout },
    { label: 'Attendance Throughput', value: attendanceFlow },
    { label: 'Certificate Velocity', value: certVelocity },
  ]
  const peakBar = Math.max(...opsBars.map((item) => item.value), 1)

  useEffect(() => {
    if (!contextPollId && polls.data?.polls.length) {
      setContextPollId(polls.data.polls[0].poll_id)
    }
  }, [contextPollId, polls.data?.polls])

  useEffect(() => {
    if (!pollContext.data) {
      return
    }
    setContextPurpose(pollContext.data.purpose)
    setContextAudience(pollContext.data.audience)
    setContextCategory(pollContext.data.category)
    setContextNote(pollContext.data.extra_note)
  }, [pollContext.data])

  const createAnnouncement = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for announcement writes.', { variant: 'warning' })
      return
    }
    if (!announcementTitle.trim() || !announcementBody.trim()) {
      enqueueSnackbar('Announcement title and body are required.', { variant: 'warning' })
      return
    }

    setAnnouncementBusy(true)
    try {
      await apiRequest<AnnouncementItem>(endpoints.announcements, {
        method: 'POST',
        body: {
          title: announcementTitle.trim(),
          body: announcementBody.trim(),
          poll_id: announcementPollId ? Number(announcementPollId) : undefined,
          category: announcementCategory,
          audience: announcementAudience,
          is_pinned: false,
        },
      })
      enqueueSnackbar('Announcement published and anchored.', { variant: 'success' })
      setAnnouncementTitle('')
      setAnnouncementBody('')
      setAnnouncementPollId('')
      await announcements.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Announcement publish failed', { variant: 'error' })
    } finally {
      setAnnouncementBusy(false)
    }
  }

  const removeAnnouncement = async (announcementId: string): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for announcement moderation.', { variant: 'warning' })
      return
    }
    setAnnouncementBusy(true)
    try {
      await apiRequest(`${endpoints.announcements}/${announcementId}`, { method: 'DELETE' })
      enqueueSnackbar('Announcement removed.', { variant: 'success' })
      await announcements.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Announcement removal failed', { variant: 'error' })
    } finally {
      setAnnouncementBusy(false)
    }
  }

  const savePollContext = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for poll context updates.', { variant: 'warning' })
      return
    }
    if (!contextPollId) {
      enqueueSnackbar('Select a poll to update context.', { variant: 'warning' })
      return
    }
    if (!contextPurpose.trim()) {
      enqueueSnackbar('Purpose is required for poll context.', { variant: 'warning' })
      return
    }
    setContextBusy(true)
    try {
      await apiRequest<PollContextResponse>(endpoints.pollContext(contextPollId), {
        method: 'PUT',
        body: {
          purpose: contextPurpose.trim(),
          audience: contextAudience.trim(),
          category: contextCategory.trim(),
          extra_note: contextNote.trim(),
        },
      })
      enqueueSnackbar('Poll context updated and anchored.', { variant: 'success' })
      await pollContext.refresh()
      await announcements.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Poll context update failed', { variant: 'error' })
    } finally {
      setContextBusy(false)
    }
  }

  const createTask = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for coordination workflows.', { variant: 'warning' })
      return
    }
    if (!taskTitle.trim()) {
      enqueueSnackbar('Task title is required.', { variant: 'warning' })
      return
    }
    setTaskBusy(true)
    try {
      await apiRequest(endpoints.coordinationTasks, {
        method: 'POST',
        body: {
          title: taskTitle.trim(),
          description: taskDescription.trim(),
        },
      })
      enqueueSnackbar('Coordination task created.', { variant: 'success' })
      setTaskTitle('')
      setTaskDescription('')
      await coordination.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Task creation failed', { variant: 'error' })
    } finally {
      setTaskBusy(false)
    }
  }

  const anchorTask = async (taskId: string): Promise<void> => {
    if (!canFacultyWrite) {
      return
    }
    setTaskBusy(true)
    try {
      const result = await apiRequest<CoordinationVerifyResponse>(endpoints.coordinationAnchor(taskId), {
        method: 'POST',
        body: {
          payload: {
            task_id: taskId,
            owner: address ?? 'faculty',
            anchored_at: Date.now(),
          },
        },
      })
      enqueueSnackbar(result.message, { variant: result.verified ? 'success' : 'warning' })
      await coordination.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Task anchor failed', { variant: 'error' })
    } finally {
      setTaskBusy(false)
    }
  }

  const verifyTask = async (taskId: string): Promise<void> => {
    if (!canFacultyWrite) {
      return
    }
    setTaskBusy(true)
    try {
      const result = await apiRequest<CoordinationVerifyResponse>(endpoints.coordinationVerify(taskId))
      enqueueSnackbar(result.message, { variant: result.verified ? 'success' : 'warning' })
      await coordination.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Task verification failed', { variant: 'error' })
    } finally {
      setTaskBusy(false)
    }
  }

  return (
    <div className="page-grid dashboard-grid">
      <Card className="hero-card" title="Faculty Command" subtitle="Publish assessments, monitor sessions, and certify outcomes.">
        <div className="hero-row">
          <div className="profile-chip">
            <img src={facultyAvatar} alt="Faculty" />
            <div>
              <strong>{address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Faculty Workspace'}</strong>
              <span>Role workflow enabled</span>
            </div>
          </div>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/faculty/voting" data-tour="faculty-create-poll">
              Create Poll
            </Link>
            <Link className="btn" to="/faculty/attendance" data-tour="faculty-create-session">
              Create Session
            </Link>
            <Link className="btn" to="/faculty/certificates" data-tour="faculty-issue-cert">
              Issue Certificate
            </Link>
          </div>
        </div>
      </Card>

      {!isAuthenticated ? (
        <LiveAccessNotice body="You can explore analytics and workflow in preview mode. Enable live chain access to publish polls/sessions and issue certificates." />
      ) : null}
      {isAuthenticated && !canFacultyWrite ? <ChainRoleNotice required="faculty" chainRole={chainRole} /> : null}

      <section className="metric-strip metric-strip-four">
        <MetricTile title="Polls by Me" value={myPolls.length} caption={`Platform votes: ${analytics.data?.total_votes ?? 0}`} tone="indigo" />
        <MetricTile title="Sessions by Me" value={mySessions.length} caption={`Platform check-ins: ${analytics.data?.total_checkins ?? 0}`} tone="teal" />
        <MetricTile title="Certificates Issued" value={certCount} caption="BFF cache records" tone="amber" />
        <MetricTile title="Turnout Index" value={`${pollTurnout}%`} caption="Current participation score" tone="violet" />
      </section>

      <section className="progress-strip">
        {analytics.loading ? (
          <LoadingSkeleton rows={3} compact />
        ) : (
          <>
            <ProgressRing label="Poll Turnout" subtitle="Votes vs polls" value={pollTurnout} tone="indigo" compact />
            <ProgressRing label="Attendance Throughput" subtitle="Check-ins/session" value={attendanceFlow} tone="teal" compact />
            <ProgressRing label="Certificate Velocity" subtitle="Certs/session" value={certVelocity} tone="amber" compact />
          </>
        )}
      </section>

      <Card title="Faculty Operations Graph" subtitle="Role-specific operational trend snapshot.">
        <div className="chart-list">
          {opsBars.map((item) => (
            <div key={item.label} className="chart-row">
              <span>{item.label}</span>
              <div className="chart-bar-wrap">
                <div className="chart-bar" style={{ width: `${Math.round((item.value / peakBar) * 100)}%` }} />
              </div>
              <strong>{item.value}%</strong>
            </div>
          ))}
        </div>
      </Card>

      <DataTableCard
        title="Faculty Timetable / Operations"
        headers={['Time', 'Course', 'Session', 'Status']}
        rows={scheduleRows}
        emptyText="No faculty-created sessions yet."
      />

      <Card title="Anomalies Widget">
        {!analytics.data ? <LoadingSkeleton rows={3} compact /> : null}
        {analytics.data ? (
          <>
            <p>
              {analytics.data.total_votes > analytics.data.total_polls * 100
                ? 'Suspicious spike indicator: vote volume is unusually high.'
                : 'No suspicious voting spikes detected from available summary data.'}
            </p>
            <p>
              {analytics.data.total_checkins > analytics.data.total_sessions * 50
                ? 'Late-surge indicator: high check-in density per session.'
                : 'Attendance pattern remains within normal range.'}
            </p>
          </>
        ) : null}
      </Card>

      <Card title="Announcements Composer" subtitle="Faculty can publish class/poll updates. Admin can moderate globally.">
        {!isAuthenticated ? (
          <LiveAccessNotice body="Announcement create/remove requires live authenticated chain role." />
        ) : null}
        {isAuthenticated && !canFacultyWrite ? <ChainRoleNotice required="faculty" chainRole={chainRole} /> : null}
        <div className="form-grid">
          <label htmlFor="faculty-ann-title">Title</label>
          <input
            id="faculty-ann-title"
            value={announcementTitle}
            onChange={(event) => setAnnouncementTitle(event.target.value)}
            placeholder="Announcement title"
          />
          <label htmlFor="faculty-ann-body">Body</label>
          <textarea
            id="faculty-ann-body"
            rows={3}
            value={announcementBody}
            onChange={(event) => setAnnouncementBody(event.target.value)}
            placeholder="Write contextual update for students/faculty."
          />
          <label htmlFor="faculty-ann-category">Category</label>
          <select
            id="faculty-ann-category"
            value={announcementCategory}
            onChange={(event) => setAnnouncementCategory(event.target.value)}
          >
            <option value="academic">academic</option>
            <option value="poll">poll</option>
            <option value="attendance">attendance</option>
            <option value="certificate">certificate</option>
            <option value="operations">operations</option>
          </select>
          <label htmlFor="faculty-ann-audience">Audience</label>
          <select
            id="faculty-ann-audience"
            value={announcementAudience}
            onChange={(event) => setAnnouncementAudience(event.target.value)}
          >
            <option value="all">all</option>
            <option value="student">student</option>
            <option value="faculty">faculty</option>
            <option value="admin">admin</option>
          </select>
          <label htmlFor="faculty-ann-poll">Linked Poll (optional)</label>
          <select
            id="faculty-ann-poll"
            value={announcementPollId}
            onChange={(event) => setAnnouncementPollId(event.target.value)}
          >
            <option value="">none</option>
            {(polls.data?.polls ?? []).map((poll) => (
              <option key={poll.poll_id} value={poll.poll_id}>
                #{poll.poll_id} {poll.question}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void createAnnouncement()}
            disabled={announcementBusy || !canFacultyWrite}
          >
            {announcementBusy ? 'Publishing...' : 'Publish Announcement'}
          </button>
        </div>

        {announcements.loading ? <LoadingSkeleton rows={2} compact /> : null}
        {announcements.error ? <p className="error-text">{announcements.error}</p> : null}
        {announcements.data && announcements.data.count > 0 ? (
          <ul className="timeline">
            {announcements.data.items.slice(0, 8).map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <span>{item.category} · {item.audience} · {formatRelative(item.updated)}</span>
                <div className="inline-row">
                  <code>{item.anchor_tx_id ?? 'not anchored'}</code>
                  <button
                    type="button"
                    className="btn btn-ghost btn-compact"
                    onClick={() => void removeAnnouncement(item.id)}
                    disabled={!canFacultyWrite || announcementBusy}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title="Poll Context Editor" subtitle="Explain purpose, audience, and notes for each poll before voting.">
        <div className="form-grid">
          <label htmlFor="faculty-context-poll">Poll</label>
          <select
            id="faculty-context-poll"
            value={contextPollId ?? ''}
            onChange={(event) => setContextPollId(Number(event.target.value))}
          >
            {(polls.data?.polls ?? []).map((poll) => (
              <option key={poll.poll_id} value={poll.poll_id}>
                #{poll.poll_id} {poll.question}
              </option>
            ))}
          </select>
          <label htmlFor="faculty-context-purpose">Purpose</label>
          <textarea
            id="faculty-context-purpose"
            rows={2}
            value={contextPurpose}
            onChange={(event) => setContextPurpose(event.target.value)}
            placeholder="Why is this voting poll being conducted?"
          />
          <label htmlFor="faculty-context-audience">Audience</label>
          <input
            id="faculty-context-audience"
            value={contextAudience}
            onChange={(event) => setContextAudience(event.target.value)}
          />
          <label htmlFor="faculty-context-category">Category</label>
          <input
            id="faculty-context-category"
            value={contextCategory}
            onChange={(event) => setContextCategory(event.target.value)}
          />
          <label htmlFor="faculty-context-note">Extra Note</label>
          <textarea
            id="faculty-context-note"
            rows={2}
            value={contextNote}
            onChange={(event) => setContextNote(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void savePollContext()}
            disabled={contextBusy || !canFacultyWrite || !contextPollId}
          >
            {contextBusy ? 'Saving...' : 'Save Poll Context'}
          </button>
        </div>

        {pollContext.loading ? <LoadingSkeleton rows={2} compact /> : null}
        {pollContext.data ? (
          <>
            <div className="kv">
              <span>Context Hash</span>
              <code>{pollContext.data.hash}</code>
            </div>
            <div className="kv">
              <span>Anchor TX</span>
              <code>{pollContext.data.anchor_tx_id ?? '--'}</code>
            </div>
          </>
        ) : null}
      </Card>

      <Card title="Group Coordination">
        {!isAuthenticated ? (
          <LiveAccessNotice body="Coordination task create/anchor/verify requires live authenticated faculty access." />
        ) : null}
        <div className="form-grid">
          <label htmlFor="coord-title">Task Title</label>
          <input id="coord-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
          <label htmlFor="coord-desc">Description</label>
          <textarea id="coord-desc" rows={2} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} />
          <button type="button" className="btn btn-primary" onClick={() => void createTask()} disabled={taskBusy || !canFacultyWrite}>
            {taskBusy ? 'Working...' : 'Create Task'}
          </button>
        </div>

        {coordination.loading ? <LoadingSkeleton rows={2} compact /> : null}
        {coordination.error ? <p className="error-text">{coordination.error}</p> : null}
        {coordination.data && coordination.data.count > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Anchor</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coordination.data.tasks.slice(0, 8).map((task) => (
                  <tr key={task.task_id}>
                    <td>
                      <strong>{task.title}</strong>
                      <p>{task.description}</p>
                    </td>
                    <td>{task.status}</td>
                    <td>{task.anchor_tx_id ?? '--'}</td>
                    <td>
                      <div className="inline-row">
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact"
                          onClick={() => void anchorTask(task.task_id)}
                          disabled={!canFacultyWrite || taskBusy}
                        >
                          Anchor
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact"
                          onClick={() => void verifyTask(task.task_id)}
                          disabled={!canFacultyWrite || taskBusy}
                        >
                          Verify
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {activity.loading ? <LoadingSkeleton rows={4} /> : null}
      {!activity.loading && activityItems.length > 0 ? <WidgetList title="Recent Faculty Updates" items={activityItems} /> : null}

      {enabled ? (
        <DemoChecklist
          title="Faculty Demo Flow"
          items={[
            { label: 'Create a poll with options and window', done: myPolls.length > 0 || polls.data !== null },
            { label: 'Create attendance session', done: mySessions.length > 0 || sessions.data !== null },
            { label: 'Issue certificate to a student', done: certCount > 0 },
            { label: 'Show analytics and anomalies', done: Boolean(analytics.data) },
          ]}
        />
      ) : null}
    </div>
  )
}
