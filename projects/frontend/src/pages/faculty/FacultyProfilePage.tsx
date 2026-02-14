import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { EditableAvatar } from '../../components/EditableAvatar'
import { MetricTile } from '../../components/MetricTile'
import { useAuth } from '../../context/AuthContext'
import { usePreview } from '../../context/PreviewContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { apiRequest } from '../../lib/api'
import { demoProfiles } from '../../lib/demoData'
import { endpoints } from '../../lib/endpoints'
import type { PollListResponse, SessionListResponse } from '../../types/api'

import facultyAvatar from '../../assets/ui/avatar-faculty.svg'

export const FacultyProfilePage = () => {
  const { role: authRole, address, isAuthenticated } = useAuth()
  const preview = usePreview()
  const role = (preview.role ?? authRole) ?? 'faculty'
  const profile = demoProfiles.faculty

  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])
  const sessions = useAsyncData(() => apiRequest<SessionListResponse>(endpoints.sessions), [])

  const myPollCount = polls.data?.polls.filter((poll) => poll.creator === address).length ?? 0
  const mySessionCount = sessions.data?.sessions.filter((session) => session.creator === address).length ?? 0

  return (
    <div className="page-grid single">
      <Card title="Faculty Profile" subtitle="Academic operations and engagement overview">
        <div className="profile-layout">
          <EditableAvatar fallbackSrc={facultyAvatar} alt="Faculty" className="profile-avatar" />
          <div className="profile-core">
            <h3>{profile.fullName}</h3>
            <p>{profile.program} - {profile.department}</p>
            <div className="pill-row">
              <span className="badge badge-success">{profile.campusStatus}</span>
              <span className="badge badge-info">Faculty</span>
              <span className="badge badge-neutral">{role}</span>
            </div>
          </div>
        </div>

        <div className="kv">
          <span>Employee ID</span>
          <span>{profile.registrationId}</span>
        </div>
        <div className="kv">
          <span>Address</span>
          <code>{address ?? 'Preview user - wallet not connected'}</code>
        </div>
        {address ? <CopyButton value={address} label="Copy Address" /> : null}
        <div className="kv">
          <span>Email</span>
          <span>{profile.contactEmail}</span>
        </div>
        <div className="kv">
          <span>Phone</span>
          <span>{profile.phone}</span>
        </div>
      </Card>

      <section className="metric-strip metric-strip-four">
        <MetricTile title="Polls Created" value={myPollCount} caption="Live authored polls" tone="indigo" />
        <MetricTile title="Sessions Created" value={mySessionCount} caption="Attendance windows" tone="teal" />
        <MetricTile title="Student Reach" value="214" caption="Demo + live estimate" tone="amber" />
        <MetricTile title="Issuance Health" value="Stable" caption="Certificate operations" tone="violet" />
      </section>

      <Card title="Faculty Notes">
        <ul>
          <li>Coordinates voting campaigns with clear rationale and transparent outcomes.</li>
          <li>Tracks attendance trends and subject-level deviations across cohorts.</li>
          <li>Issues verifiable certificates integrated with on-chain proof and metadata service.</li>
        </ul>
      </Card>
    </div>
  )
}
