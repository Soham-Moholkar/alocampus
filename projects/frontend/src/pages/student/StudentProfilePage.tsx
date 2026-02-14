import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import type { CertListResponse } from '../../types/api'

export const StudentProfilePage = () => {
  const { address, role } = useAuth()
  const certs = useAsyncData(() => apiRequest<CertListResponse>(endpoints.certList), [])

  return (
    <div className="page-grid single">
      <Card title="Profile">
        <div className="kv">
          <span>Role</span>
          <span>{role}</span>
        </div>
        <div className="kv">
          <span>Address</span>
          <code>{address ?? '--'}</code>
        </div>
        {address ? <CopyButton value={address} label="Copy Address" /> : null}
        <div className="kv">
          <span>Certificates</span>
          <span>{certs.data?.count ?? 0}</span>
        </div>
      </Card>
    </div>
  )
}
