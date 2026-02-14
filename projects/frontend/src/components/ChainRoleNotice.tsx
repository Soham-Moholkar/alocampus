import type { Role } from '../types/api'

interface ChainRoleNoticeProps {
  required: 'faculty' | 'admin'
  chainRole: Role | null
}

export const ChainRoleNotice = ({ required, chainRole }: ChainRoleNoticeProps) => (
  <section className="live-access-notice">
    <strong>Permission Limited By Chain Role</strong>
    <p>
      This dashboard is visible from selected role mode, but protected writes require chain role{' '}
      <code>{required}</code>. Current chain role: <code>{chainRole ?? 'none'}</code>.
    </p>
  </section>
)
