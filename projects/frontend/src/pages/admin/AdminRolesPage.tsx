import { useState } from 'react'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import type { Role, SetRoleResponse } from '../../types/api'

interface RoleChangeEntry {
  id: string
  address: string
  role: Role
  created: number
  message: string
}

export const AdminRolesPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const [address, setAddress] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<RoleChangeEntry[]>([])

  const assignRole = async (): Promise<void> => {
    if (address.trim().length !== 58) {
      enqueueSnackbar('Address must be 58 chars.', { variant: 'warning' })
      return
    }

    setBusy(true)
    try {
      const response = await apiRequest<SetRoleResponse>(endpoints.adminRole, {
        method: 'POST',
        body: {
          address: address.trim(),
          role,
        },
      })

      const entry: RoleChangeEntry = {
        id: `${Date.now()}-${address}`,
        address: address.trim(),
        role,
        created: Date.now(),
        message: response.message,
      }

      setHistory((prev) => [entry, ...prev])
      enqueueSnackbar('Role updated and on-chain allowlist updated.', { variant: 'success' })
      setAddress('')
      setRole('student')
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Role update failed', { variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-grid">
      <Card title="Assign Role">
        <div className="form-grid">
          <label htmlFor="role-address">Address</label>
          <input
            id="role-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Algorand address"
          />

          <label htmlFor="role-select">Role</label>
          <select id="role-select" value={role} onChange={(event) => setRole(event.target.value as Role)}>
            <option value="student">student</option>
            <option value="faculty">faculty</option>
            <option value="admin">admin</option>
          </select>

          <button type="button" className="btn btn-primary" onClick={() => void assignRole()} disabled={busy}>
            {busy ? 'Updating...' : 'Update Role'}
          </button>
        </div>
      </Card>

      <Card title="Role Change History (local view)">
        {history.length === 0 ? (
          <p>No role changes yet in this browser session.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Role</th>
                  <th>Time</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <code>{item.address}</code>
                    </td>
                    <td>{item.role}</td>
                    <td>{new Date(item.created).toLocaleString()}</td>
                    <td>{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
