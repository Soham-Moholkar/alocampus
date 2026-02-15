import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { CopyButton } from '../components/CopyButton'
import { EditableAvatar } from '../components/EditableAvatar'
import { GuidedTour } from '../components/GuidedTour'
import { InfoPanel } from '../components/InfoPanel'
import { useAuth } from '../context/AuthContext'
import { usePreview } from '../context/PreviewContext'
import { useAsyncData } from '../hooks/useAsyncData'
import { useCurrentRound } from '../hooks/useCurrentRound'
import { fetchActivityFeed } from '../lib/activity'
import { computeRoundStatus } from '../lib/abi'
import { apiRequest, withQuery } from '../lib/api'
import { demoProfiles, isDemoPoll } from '../lib/demoData'
import { endpoints } from '../lib/endpoints'
import { clearDemoAuthToken, isTourCompleted, loadRoleEntryProfile, resetTourCompletion } from '../lib/storage'
import { formatRelative, shortenAddress } from '../lib/utils'
import { roleNav } from './nav'
import type {
  AnalyticsSummary,
  AnnouncementListResponse,
  PollListResponse,
  Role,
  SessionListResponse,
  SystemHealthResponse,
} from '../types/api'

import adminAvatar from '../assets/ui/avatar-admin.svg'
import campusIcon from '../assets/ui/icon-campus.svg'
import facultyAvatar from '../assets/ui/avatar-faculty.svg'
import roleAdmin from '../assets/ui/role-admin.svg'
import roleFaculty from '../assets/ui/role-faculty.svg'
import roleStudent from '../assets/ui/role-student.svg'
import studentAvatar from '../assets/ui/avatar-student.svg'

const RIGHT_RAIL_KEY = 'algocampus.ui.rightRail'

const roleArt: Record<Role, string> = {
  student: roleStudent,
  faculty: roleFaculty,
  admin: roleAdmin,
}

const pageTitle = (pathname: string): string => {
  if (pathname.includes('/dashboard')) return 'Dashboard'
  if (pathname.includes('/voting')) return 'Voting'
  if (pathname.includes('/attendance')) return 'Attendance'
  if (pathname.includes('/certificates')) return 'Certificates'
  if (pathname.includes('/analytics')) return 'Analytics'
  if (pathname.includes('/roles')) return 'Role Management'
  if (pathname.includes('/system')) return 'System Health'
  if (pathname.includes('/activity')) return 'Activity'
  if (pathname.includes('/settings')) return 'Settings'
  if (pathname.includes('/profile')) return 'Profile'
  return 'Workspace'
}

const roleContextItems: Record<Role, { id: string; title: string; detail: string; stamp?: string }[]> = {
  student: [
    { id: 'ctx-s1', title: 'Today', detail: 'Track poll deadlines, attendance windows, and certificate proofs.', stamp: 'student' },
    { id: 'ctx-s2', title: 'Tip', detail: 'Use attendance subject cards to quickly spot weak subjects.', stamp: 'focus' },
  ],
  faculty: [
    { id: 'ctx-f1', title: 'Polling', detail: 'Publish clear question context before opening vote windows.', stamp: 'faculty' },
    { id: 'ctx-f2', title: 'Attendance', detail: 'Set open/close rounds based on expected class timing.', stamp: 'ops' },
  ],
  admin: [
    { id: 'ctx-a1', title: 'Governance', detail: 'Validate role updates and audit history before demos.', stamp: 'admin' },
    { id: 'ctx-a2', title: 'Reliability', detail: 'Keep health and analytics indicators green.', stamp: 'system' },
  ],
}

export const AppShell = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, role: authRole, address, logout } = useAuth()
  const preview = usePreview()
  const { currentRound } = useCurrentRound()
  const entryProfile = loadRoleEntryProfile()

  const role = (preview.role ?? authRole) ?? 'student'
  const chainRole = isAuthenticated ? authRole : null
  const roleMismatch = Boolean(preview.role && authRole && preview.role !== authRole)
  const navItems = roleNav[role]

  const [open, setOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(() => localStorage.getItem(RIGHT_RAIL_KEY) !== '0')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourRunKey, setTourRunKey] = useState(0)

  const analytics = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary), [])
  const health = useAsyncData(() => apiRequest<SystemHealthResponse>(endpoints.systemHealth, { auth: false }), [])
  const announcements = useAsyncData(
    () => apiRequest<AnnouncementListResponse>(withQuery(endpoints.announcements, { audience: role, limit: 8 }), { auth: false }),
    [role],
  )
  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])
  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])
  const activity = useAsyncData(
    () =>
      fetchActivityFeed({
        address: isAuthenticated ? address ?? undefined : undefined,
        limit: 8,
        includeSynthetic: !isAuthenticated,
      }),
    [address, isAuthenticated],
  )

  const heading = pageTitle(location.pathname)

  useEffect(() => {
    setProfileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!isTourCompleted(role)) {
      setTourOpen(true)
    }
  }, [role])

  const announcementItems = useMemo(() => {
    if (announcements.data && announcements.data.count > 0) {
      return announcements.data.items.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.body,
        stamp: formatRelative(item.updated),
      }))
    }

    if (activity.data && activity.data.length > 0) {
      return activity.data.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.title,
        detail: item.description ?? item.kind,
        stamp: formatRelative(item.created),
      }))
    }

    return [
      {
        id: 'default-1',
        title: 'Announcements',
        detail: 'LocalNet mode active. Activity panels are sourced from BFF and synthetic updates.',
        stamp: 'just now',
      },
      {
        id: 'default-2',
        title: 'Polling',
        detail: 'Click active polls from dashboard cards to vote instantly.',
        stamp: 'always on',
      },
    ]
  }, [activity.data, announcements.data])

  const peopleItems = [
    {
      id: 'people-1',
      title: 'Prof. Rowan',
      detail: 'Faculty advisor',
      avatar: facultyAvatar,
      stamp: 'full day',
    },
    {
      id: 'people-2',
      title: 'Alex Student',
      detail: 'Peer lead',
      avatar: studentAvatar,
      stamp: 'online',
    },
    {
      id: 'people-3',
      title: 'Admin Desk',
      detail: 'System operations',
      avatar: adminAvatar,
      stamp: 'monitoring',
    },
  ]

  const activePollCount =
    polls.data?.polls.filter((poll) =>
      isDemoPoll(poll)
        ? true
        : computeRoundStatus(poll.start_round, poll.end_round, currentRound ?? undefined) === 'active',
    ).length ?? 0

  const openSessionCount =
    sessions.data?.sessions.filter(
      (session) => computeRoundStatus(session.open_round, session.close_round, currentRound ?? undefined) === 'active',
    ).length ?? 0

  const myPollCount = polls.data?.polls.filter((poll) => poll.creator === address).length ?? 0
  const mySessionCount = sessions.data?.sessions.filter((session) => session.creator === address).length ?? 0
  const recentRoleChanges = activity.data?.filter((item) => item.kind.includes('role')).length ?? 0

  const recommendedItems = useMemo(() => {
    if (role === 'student') {
      const items = [
        {
          id: 'rec-s1',
          title: activePollCount > 0 ? `Vote Now (${activePollCount} active)` : 'Watch Upcoming Polls',
          detail: activePollCount > 0 ? 'Open voting center and submit your ballot.' : 'No active polls currently. Check updates panel.',
          stamp: 'voting',
        },
        {
          id: 'rec-s2',
          title: openSessionCount > 0 ? `Check In (${openSessionCount} open)` : 'Attendance Review',
          detail: openSessionCount > 0 ? 'Open attendance and check in before window closes.' : 'Use attendance graphs to identify weak subjects.',
          stamp: 'attendance',
        },
        {
          id: 'rec-s3',
          title: 'Certificates',
          detail: 'Review your certificate records and verify metadata links.',
          stamp: 'proof',
        },
      ]

      if (!isAuthenticated) {
        items.push({
          id: 'rec-s4',
          title: 'Live Chain Status',
          detail: 'Using role mode. Protected live writes are unavailable until wallet auth succeeds.',
          stamp: 'offline',
        })
      }

      return items
    }

    if (role === 'faculty') {
      return [
        {
          id: 'rec-f1',
          title: myPollCount > 0 ? `My Polls (${myPollCount})` : 'Create New Poll',
          detail: myPollCount > 0 ? 'Review turnout and export results from voting admin.' : 'Launch a governance or class poll from faculty voting.',
          stamp: 'polls',
        },
        {
          id: 'rec-f2',
          title: mySessionCount > 0 ? `My Sessions (${mySessionCount})` : 'Open Attendance Window',
          detail: mySessionCount > 0 ? 'Verify presence and monitor late-surge indicators.' : 'Create attendance session with round windows.',
          stamp: 'attendance',
        },
        {
          id: 'rec-f3',
          title: 'Certificate Queue',
          detail: 'Issue certificates and track tx confirmations in certificate admin.',
          stamp: 'certs',
        },
        {
          id: 'rec-f4',
          title: 'Live Chain Status',
          detail: isAuthenticated ? 'Protected endpoints are available for writes.' : 'Using role mode. Protected writes are currently unavailable.',
          stamp: isAuthenticated ? 'live' : 'offline',
        },
      ]
    }

    return [
      {
        id: 'rec-a1',
        title: 'Role Governance',
        detail: recentRoleChanges > 0 ? `${recentRoleChanges} role-related activity items detected recently.` : 'Review role assignments and policy changes.',
        stamp: 'admin',
      },
      {
        id: 'rec-a2',
        title: 'System Health',
        detail: health.data?.status === 'ok' ? 'Health route reports stable LocalNet connectivity.' : 'Open system health and verify service status.',
        stamp: health.data?.status ?? 'check',
      },
      {
        id: 'rec-a3',
        title: 'Platform Throughput',
        detail: `Polls ${analytics.data?.total_polls ?? '--'} · Sessions ${analytics.data?.total_sessions ?? '--'} · Certs ${analytics.data?.total_certs ?? '--'}`,
        stamp: 'analytics',
      },
    ]
  }, [
    activePollCount,
    analytics.data?.total_certs,
    analytics.data?.total_polls,
    analytics.data?.total_sessions,
    health.data?.status,
    isAuthenticated,
    myPollCount,
    mySessionCount,
    openSessionCount,
    recentRoleChanges,
    role,
  ])

  const toggleRail = (): void => {
    const next = !railOpen
    setRailOpen(next)
    localStorage.setItem(RIGHT_RAIL_KEY, next ? '1' : '0')
  }

  const handleLogout = async (): Promise<void> => {
    preview.exitPreview()
    clearDemoAuthToken()
    if (isAuthenticated) {
      await logout(undefined, true)
      return
    }
    navigate('/connect', { replace: true })
  }

  const copyValue = isAuthenticated && address ? address : entryProfile?.identifier ?? demoProfiles[role].registrationId
  const displayIdentity = isAuthenticated && address
    ? shortenAddress(address)
    : entryProfile?.displayName ?? demoProfiles[role].fullName

  return (
    <div className={`hybrid-shell ${open ? 'nav-open' : ''} ${railOpen ? 'rail-open' : 'rail-hidden'}`}>
      <aside className="left-rail">
        <div className="brand-block">
          <img src={campusIcon} alt="AlgoCampus" />
          <div>
            <strong>AlgoCampus</strong>
            <p>LocalNet Control</p>
          </div>
        </div>

        <button type="button" className="btn btn-ghost mobile-only" onClick={() => setOpen(false)}>
          Close Menu
        </button>

        <nav className="left-nav" aria-label="Role navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="left-rail-footer">
          <article className="rail-role-card">
            <EditableAvatar fallbackSrc={roleArt[role]} alt={`${role} role`} className="rail-role-art" />
            <div className="rail-role-copy">
              <strong>{entryProfile?.displayName ?? demoProfiles[role].fullName}</strong>
              <span>{role.toUpperCase()} PORTAL</span>
            </div>
          </article>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace-top">
          <div className="workspace-top-left">
            <button type="button" className="btn btn-ghost mobile-only" onClick={() => setOpen(true)}>
              Menu
            </button>
            <div>
              <p className="workspace-kicker">{role.toUpperCase()} PORTAL</p>
              <h2>{heading}</h2>
            </div>
          </div>

          <div className="workspace-top-right">
            <span className={`badge badge-role badge-${role}`}>{role}</span>
            <span className="badge badge-neutral">Chain: {chainRole ?? 'none'}</span>
            {roleMismatch ? <span className="badge badge-warning">UI role override active</span> : null}

            <div className="address-chip">
              <code>{displayIdentity}</code>
              <CopyButton value={copyValue} label="Copy ID" />
              <button type="button" className="btn btn-ghost btn-compact" onClick={() => void handleLogout()}>
                Logout
              </button>
            </div>

            <button type="button" className="btn btn-ghost btn-compact" onClick={toggleRail}>
              {railOpen ? 'Hide Info' : 'Show Info'}
            </button>

            <div className="profile-menu-wrap">
              <button type="button" className="btn btn-ghost btn-compact" onClick={() => setProfileMenuOpen((prev) => !prev)}>
                Menu
              </button>
              {profileMenuOpen ? (
                <div className="profile-menu">
                  <button type="button" onClick={() => navigate('/activity')}>
                    Activity
                  </button>
                  <button type="button" onClick={() => navigate('/verify/certificate')}>
                    Verify Certificate
                  </button>
                  <button type="button" onClick={() => navigate('/settings')}>
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetTourCompletion(role)
                      setTourRunKey((prev) => prev + 1)
                      setTourOpen(true)
                    }}
                  >
                    Start Tour Again
                  </button>
                  <button type="button" onClick={() => void handleLogout()}>
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="workspace-content">
          <Outlet />
        </main>
      </div>

      <aside className="right-rail" aria-label="Context widgets">
        <InfoPanel title="Announcements & Poll Updates" items={announcementItems} />

        <InfoPanel
          title="Platform Snapshot"
          items={[
            {
              id: 'snap-polls',
              title: `Polls: ${analytics.data?.total_polls ?? '--'}`,
              detail: `Votes: ${analytics.data?.total_votes ?? '--'}`,
            },
            {
              id: 'snap-sessions',
              title: `Sessions: ${analytics.data?.total_sessions ?? '--'}`,
              detail: `Check-ins: ${analytics.data?.total_checkins ?? '--'}`,
            },
            {
              id: 'snap-certs',
              title: `Certificates: ${analytics.data?.total_certs ?? '--'}`,
              detail: analytics.loading ? 'Refreshing summary...' : 'Indexer-backed summary',
            },
          ]}
        />

        <InfoPanel title="Recommended Next Actions" items={recommendedItems} />
        <InfoPanel title="Role Context" items={roleContextItems[role]} />
        <InfoPanel title="People" items={peopleItems} />
      </aside>

      <GuidedTour role={role} open={tourOpen} runKey={tourRunKey} onClose={() => setTourOpen(false)} />

      <button type="button" className="overlay" onClick={() => setOpen(false)} aria-label="Close sidebar" />
    </div>
  )
}
