import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { ChainRoleNotice } from '../../components/ChainRoleNotice'
import { DataTableCard } from '../../components/DataTableCard'
import { DemoChecklist } from '../../components/DemoChecklist'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { MetricTile } from '../../components/MetricTile'
import { ProgressRing } from '../../components/ProgressRing'
import { WidgetList } from '../../components/WidgetList'
import { useDemoMode } from '../../context/DemoModeContext'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useRoleAccess } from '../../hooks/useRoleAccess'
import { fetchActivityFeed } from '../../lib/activity'
import { apiRequest, withQuery } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { formatRelative } from '../../lib/utils'
import type {
  AnalyticsSummary,
  AnnouncementItem,
  AnnouncementListResponse,
  CoordinationTaskListResponse,
  DemoUserProfile,
  SystemHealthResponse,
} from '../../types/api'

import adminAvatar from '../../assets/ui/avatar-admin.svg'

export const AdminDashboardPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { enabled } = useDemoMode()
  const { isAuthenticated } = useAuth()
  const { canAdminWrite, chainRole } = useRoleAccess()
  const [moderationBusy, setModerationBusy] = useState(false)

  const analytics = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])
  const health = useAsyncData(() => apiRequest<SystemHealthResponse>(endpoints.systemHealth, { auth: false }), [])
  const activity = useAsyncData(() => fetchActivityFeed({ limit: 12, includeSynthetic: !isAuthenticated }), [isAuthenticated])
  const announcements = useAsyncData(
    () => apiRequest<AnnouncementListResponse>(withQuery(endpoints.announcements, { limit: 30 }), { auth: false }),
    [],
  )
  const coordination = useAsyncData(
    () =>
      isAuthenticated
        ? apiRequest<CoordinationTaskListResponse>(endpoints.coordinationTasks)
        : Promise.resolve({ tasks: [], count: 0 }),
    [isAuthenticated],
  )
  const demoStudents = useAsyncData(
    () => apiRequest<DemoUserProfile[]>(withQuery(endpoints.demoAuthUsers, { role: 'student' }), { auth: false }),
    [],
  )
  const demoFaculty = useAsyncData(
    () => apiRequest<DemoUserProfile[]>(withQuery(endpoints.demoAuthUsers, { role: 'faculty' }), { auth: false }),
    [],
  )

  const updateAnnouncement = async (item: AnnouncementItem): Promise<void> => {
    if (!canAdminWrite) {
      enqueueSnackbar('Admin chain role is required for moderation actions.', { variant: 'warning' })
      return
    }
    setModerationBusy(true)
    try {
      await apiRequest<AnnouncementItem>(`${endpoints.announcements}/${item.id}`, {
        method: 'PUT',
        body: {
          is_pinned: !item.is_pinned,
        },
      })
      enqueueSnackbar(item.is_pinned ? 'Announcement unpinned.' : 'Announcement pinned.', { variant: 'success' })
      await announcements.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Announcement update failed', { variant: 'error' })
    } finally {
      setModerationBusy(false)
    }
  }

  const deleteAnnouncement = async (announcementId: string): Promise<void> => {
    if (!canAdminWrite) {
      enqueueSnackbar('Admin chain role is required for moderation actions.', { variant: 'warning' })
      return
    }
    setModerationBusy(true)
    try {
      await apiRequest(`${endpoints.announcements}/${announcementId}`, { method: 'DELETE' })
      enqueueSnackbar('Announcement removed.', { variant: 'success' })
      await announcements.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Announcement remove failed', { variant: 'error' })
    } finally {
      setModerationBusy(false)
    }
  }

  const roleChangeItems = activity.data?.filter((item) => item.kind.includes('role')) ?? []

  const roleRows = roleChangeItems.slice(0, 8).map((item) => [
    item.actor ?? '--',
    item.title,
    item.description ?? '--',
    formatRelative(item.created),
  ])

  const panelItems = (activity.data ?? []).slice(0, 6).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? item.kind,
    meta: formatRelative(item.created),
    avatar: adminAvatar,
  }))

  const healthScore = health.data?.status === 'ok' ? 100 : 45
  const governanceScore = roleChangeItems.length > 0 ? 82 : 60
  const throughputScore = analytics.data
    ? Math.min(100, Math.round((analytics.data.total_votes + analytics.data.total_checkins) / Math.max(1, analytics.data.total_sessions * 8)))
    : 0

  const opsBars = [
    { label: 'Reliability', value: healthScore },
    { label: 'Governance Activity', value: governanceScore },
    { label: 'Platform Throughput', value: throughputScore },
  ]
  const peakBar = Math.max(...opsBars.map((item) => item.value), 1)

  return (
    <div className="page-grid dashboard-grid">
      <Card className="hero-card" title="Administration" subtitle="Govern platform roles, reliability, and auditability.">
        <div className="hero-row">
          <div className="profile-chip">
            <img src={adminAvatar} alt="Admin" />
            <div>
              <strong>System Console</strong>
              <span>{health.data?.status ?? 'checking status'}</span>
            </div>
          </div>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/admin/roles" data-tour="admin-manage-roles">
              Manage Roles
            </Link>
            <Link className="btn" to="/admin/system" data-tour="admin-system-health">
              System Health
            </Link>
            <Link className="btn" to="/admin/analytics" data-tour="admin-analytics">
              Analytics
            </Link>
          </div>
        </div>
      </Card>
      {isAuthenticated && !canAdminWrite ? <ChainRoleNotice required="admin" chainRole={chainRole} /> : null}

      <section className="metric-strip metric-strip-four">
        <MetricTile title="Total Polls" value={analytics.data?.total_polls ?? '--'} caption={`Votes: ${analytics.data?.total_votes ?? '--'}`} tone="indigo" />
        <MetricTile title="Total Sessions" value={analytics.data?.total_sessions ?? '--'} caption={`Check-ins: ${analytics.data?.total_checkins ?? '--'}`} tone="teal" />
        <MetricTile title="Certificates" value={analytics.data?.total_certs ?? '--'} caption="On-chain registry entries" tone="amber" />
        <MetricTile title="BFF Health" value={health.data?.status ?? '--'} caption={health.data?.service ?? 'algocampus-bff'} tone="violet" />
      </section>

      <Card title="Synthetic User Dataset" subtitle="Seeded credentials available for role login and demo routing.">
        <div className="pill-row">
          <span className="badge">Students: {demoStudents.data?.length ?? '--'}</span>
          <span className="badge">Faculty: {demoFaculty.data?.length ?? '--'}</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Name</th>
                <th>Username</th>
                <th>Identifier</th>
              </tr>
            </thead>
            <tbody>
              {(demoFaculty.data ?? []).slice(0, 5).map((user) => (
                <tr key={user.id}>
                  <td>faculty</td>
                  <td>{user.display_name}</td>
                  <td>{user.username}</td>
                  <td>{user.identifier}</td>
                </tr>
              ))}
              {(demoStudents.data ?? []).slice(0, 8).map((user) => (
                <tr key={user.id}>
                  <td>student</td>
                  <td>{user.display_name}</td>
                  <td>{user.username}</td>
                  <td>{user.identifier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="progress-strip">
        <ProgressRing label="Reliability" subtitle="Health route status" value={healthScore} tone="teal" compact />
        <ProgressRing label="Governance" subtitle="Role change rhythm" value={governanceScore} tone="violet" compact />
        <ProgressRing label="Throughput" subtitle="Ops performance" value={throughputScore} tone="indigo" compact />
      </section>

      <Card title="Platform Reliability Graph">
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

      <Card title="System Health Summary">
        {health.loading ? <LoadingSkeleton rows={2} compact /> : null}
        {health.data ? (
          <>
            <div className="kv">
              <span>Status</span>
              <span>{health.data.status}</span>
            </div>
            <div className="kv">
              <span>Backend DB</span>
              <span>{health.data.backend}</span>
            </div>
          </>
        ) : null}
      </Card>

      <Card title="Coordination Snapshot">
        {coordination.loading ? <LoadingSkeleton rows={2} compact /> : null}
        {coordination.error ? <p className="error-text">{coordination.error}</p> : null}
        {coordination.data ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {coordination.data.tasks.slice(0, 6).map((task) => (
                  <tr key={task.task_id}>
                    <td>{task.title}</td>
                    <td>{task.status}</td>
                    <td>{task.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card title="Announcements Moderation Queue" subtitle="Pin, review, and remove platform announcements.">
        {announcements.loading ? <LoadingSkeleton rows={3} compact /> : null}
        {announcements.error ? <p className="error-text">{announcements.error}</p> : null}
        {announcements.data && announcements.data.count > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Audience</th>
                  <th>Category</th>
                  <th>Pinned</th>
                  <th>Anchor</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {announcements.data.items.slice(0, 12).map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </td>
                    <td>{item.audience}</td>
                    <td>{item.category}</td>
                    <td>{item.is_pinned ? 'yes' : 'no'}</td>
                    <td><code>{item.anchor_tx_id ?? '--'}</code></td>
                    <td>
                      <div className="inline-row">
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact"
                          onClick={() => void updateAnnouncement(item)}
                          disabled={!canAdminWrite || moderationBusy}
                        >
                          {item.is_pinned ? 'Unpin' : 'Pin'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-compact"
                          onClick={() => void deleteAnnouncement(item.id)}
                          disabled={!canAdminWrite || moderationBusy}
                        >
                          Remove
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

      <DataTableCard
        title="Role Changes History"
        headers={['Actor', 'Action', 'Details', 'Time']}
        rows={roleRows}
        emptyText="No explicit role-change entries in the current activity feed."
      />

      {!activity.loading && panelItems.length > 0 ? <WidgetList title="Recent Governance Updates" items={panelItems} /> : null}

      {enabled ? (
        <DemoChecklist
          title="Admin Demo Flow"
          items={[
            { label: 'Check platform totals dashboard', done: Boolean(analytics.data) },
            { label: 'Assign a faculty/admin role', done: roleChangeItems.length > 0 },
            { label: 'Show system health checks', done: Boolean(health.data) },
          ]}
        />
      ) : null}
    </div>
  )
}
