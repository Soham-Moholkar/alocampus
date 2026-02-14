import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { EditableAvatar } from '../../components/EditableAvatar'
import { LiveAccessNotice } from '../../components/LiveAccessNotice'
import { MetricTile } from '../../components/MetricTile'
import { useAuth } from '../../context/AuthContext'
import { usePreview } from '../../context/PreviewContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { apiRequest } from '../../lib/api'
import { demoCertificates, demoProfiles } from '../../lib/demoData'
import { endpoints } from '../../lib/endpoints'
import { loadRoleEntryProfile } from '../../lib/storage'
import type { CertListResponse } from '../../types/api'

import studentAvatar from '../../assets/ui/avatar-student.svg'

export const StudentProfilePage = () => {
  const { address, role: authRole, isAuthenticated } = useAuth()
  const preview = usePreview()
  const role = (preview.role ?? authRole) ?? 'student'
  const profile = demoProfiles.student
  const entryProfile = loadRoleEntryProfile()

  const certs = useAsyncData(
    () =>
      isAuthenticated
        ? apiRequest<CertListResponse>(endpoints.certList)
        : Promise.resolve({ certs: [], count: 0 }),
    [isAuthenticated],
  )

  const displayIdentity = isAuthenticated && address ? address : entryProfile?.identifier ?? profile.registrationId
  const certCount = isAuthenticated ? certs.data?.count ?? 0 : demoCertificates.length

  return (
    <div className="page-grid single">
      <Card title="Student Profile" subtitle="Curated learner identity and participation overview">
        <div className="profile-layout">
          <EditableAvatar fallbackSrc={studentAvatar} alt="Student" className="profile-avatar" />
          <div className="profile-core">
            <h3>{entryProfile?.displayName ?? profile.fullName}</h3>
            <p>{profile.program} - {profile.department}</p>
            <div className="pill-row">
              <span className="badge badge-success">{profile.campusStatus}</span>
              <span className="badge badge-info">{profile.semester}</span>
              <span className="badge badge-neutral">{role}</span>
            </div>
          </div>
        </div>

        {!isAuthenticated ? <LiveAccessNotice body="Live wallet sign-in is optional. You can continue with role demo mode using synthetic records." /> : null}

        <div className="kv">
          <span>Registration No.</span>
          <span>{entryProfile?.identifier ?? profile.registrationId}</span>
        </div>
        <div className="kv">
          <span>Identity</span>
          <code>{displayIdentity}</code>
        </div>
        <CopyButton value={displayIdentity} label="Copy ID" />

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
        <MetricTile title="Certificates" value={certCount} caption="Issued records" tone="amber" />
        <MetricTile title="Voting Participation" value="88%" caption="Demo + live estimate" tone="indigo" />
        <MetricTile title="Attendance" value="79%" caption="Subject aggregate" tone="teal" />
        <MetricTile title="Campus Status" value={profile.campusStatus} caption="Current profile state" tone="violet" />
      </section>

      <Card title="Highlights">
        <ul>
          <li>Participates in council voting rounds and governance feedback.</li>
          <li>Maintains consistent attendance in theory and lab modules.</li>
          <li>Tracks verifiable certificate records through AlgoCampus registry.</li>
        </ul>
      </Card>
    </div>
  )
}
