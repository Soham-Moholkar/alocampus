import { useState } from 'react'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { ChainRoleNotice } from '../../components/ChainRoleNotice'
import { LiveAccessNotice } from '../../components/LiveAccessNotice'
import { useRoleAccess } from '../../hooks/useRoleAccess'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchActivityFeed } from '../../lib/activity'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import type { AiExecuteResponse, AiPlanResponse, Role, SetRoleResponse } from '../../types/api'

export const AdminRolesPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { isAuthenticated, canAdminWrite, chainRole } = useRoleAccess()
  const [address, setAddress] = useState('')
  const [role, setRole] = useState<Role>('student')
  const [busy, setBusy] = useState(false)

  const [aiPrompt, setAiPrompt] = useState('Assess risk of assigning the selected role to this address.')
  const [aiPlan, setAiPlan] = useState<AiPlanResponse | null>(null)
  const [aiExec, setAiExec] = useState<AiExecuteResponse | null>(null)
  const [aiBusy, setAiBusy] = useState(false)

  const roleAudit = useAsyncData(() => fetchActivityFeed({ kind: 'role_change', limit: 50 }), [])

  const assignRole = async (): Promise<void> => {
    if (!canAdminWrite) {
      enqueueSnackbar('Admin chain role is required to update on-chain allowlists.', { variant: 'warning' })
      return
    }

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

      enqueueSnackbar(response.message || 'Role updated and on-chain allowlist updated.', { variant: 'success' })
      setAddress('')
      setRole('student')
      await roleAudit.refresh()
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Role update failed', { variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const planRoleRisk = async (): Promise<void> => {
    if (!canAdminWrite) {
      enqueueSnackbar('Admin chain role is required for AI governance actions.', { variant: 'warning' })
      return
    }

    setAiBusy(true)
    try {
      const plan = await apiRequest<AiPlanResponse>(endpoints.aiAdminRoleRiskPlan, {
        method: 'POST',
        body: {
          prompt: aiPrompt,
          context: {
            payload: {
              address: address.trim(),
              role,
            },
          },
          auto_execute: false,
        },
      })
      setAiPlan(plan)
      setAiExec(null)
      enqueueSnackbar('AI role-risk plan generated.', { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'AI planning failed', { variant: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  const executeRoleRisk = async (): Promise<void> => {
    if (!aiPlan) {
      return
    }

    setAiBusy(true)
    try {
      const result = await apiRequest<AiExecuteResponse>(endpoints.aiExecute(aiPlan.intent_id), { method: 'POST' })
      setAiExec(result)
      enqueueSnackbar(result.message, { variant: result.status === 'executed' ? 'success' : 'info' })
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'AI execution failed', { variant: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className="page-grid">
      {!isAuthenticated ? (
        <LiveAccessNotice body="Role management writes to protected admin endpoint and updates on-chain allowlists. Enable live chain access first." />
      ) : null}
      {!canAdminWrite ? <ChainRoleNotice required="admin" chainRole={chainRole} /> : null}

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

          <button type="button" className="btn btn-primary" onClick={() => void assignRole()} disabled={busy || !canAdminWrite}>
            {busy ? 'Updating...' : 'Update Role'}
          </button>
        </div>
      </Card>

      <Card title="AI Governance Assistant">
        <p>Generates a role-risk assessment intent. High-risk actions stay approval-gated by backend policy.</p>
        <div className="form-grid">
          <label htmlFor="admin-role-ai-prompt">Prompt</label>
          <textarea
            id="admin-role-ai-prompt"
            rows={3}
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
          />
          <div className="inline-row">
            <button type="button" className="btn btn-primary" onClick={() => void planRoleRisk()} disabled={aiBusy || !canAdminWrite}>
              {aiBusy ? 'Planning...' : 'Plan Risk'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void executeRoleRisk()}
              disabled={aiBusy || !aiPlan || !canAdminWrite}
            >
              Execute
            </button>
          </div>
        </div>

        {aiPlan ? (
          <>
            <div className="kv">
              <span>Intent ID</span>
              <code>{aiPlan.intent_id}</code>
            </div>
            <div className="kv">
              <span>Intent Hash</span>
              <code>{aiPlan.intent_hash}</code>
            </div>
            <div className="kv">
              <span>Risk / Mode</span>
              <span>{aiPlan.risk_level} / {aiPlan.execution_mode}</span>
            </div>
          </>
        ) : null}

        {aiExec ? (
          <div className="kv">
            <span>Execution</span>
            <span>{aiExec.status}{aiExec.tx_id ? ` (${aiExec.tx_id})` : ''}</span>
          </div>
        ) : null}
      </Card>

      <Card title="Role Change History (audit feed)">
        {roleAudit.loading ? <p>Loading audit entries...</p> : null}
        {roleAudit.error ? <p className="error-text">{roleAudit.error}</p> : null}
        {!roleAudit.loading && roleAudit.data && roleAudit.data.length > 0 ? (
          <ul className="timeline">
            {roleAudit.data.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.title}</strong>
                <p>{entry.description}</p>
                <span>{entry.actor ?? '--'}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  )
}
