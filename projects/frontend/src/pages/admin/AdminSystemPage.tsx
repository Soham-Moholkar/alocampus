import { useState } from 'react'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { ChainRoleNotice } from '../../components/ChainRoleNotice'
import { LiveAccessNotice } from '../../components/LiveAccessNotice'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useRoleAccess } from '../../hooks/useRoleAccess'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { useAuth } from '../../context/AuthContext'
import type { AiExecuteResponse, AiPlanResponse, SystemHealthResponse } from '../../types/api'

export const AdminSystemPage = () => {
  const { isAuthenticated } = useAuth()
  const { canAdminWrite, chainRole } = useRoleAccess()
  const { enqueueSnackbar } = useSnackbar()
  const health = useAsyncData(() => apiRequest<SystemHealthResponse>(endpoints.systemHealth, { auth: false }), [])
  const [aiPrompt, setAiPrompt] = useState(
    'Review system health and provide remediation steps for any degraded component.',
  )
  const [aiPlan, setAiPlan] = useState<AiPlanResponse | null>(null)
  const [aiExec, setAiExec] = useState<AiExecuteResponse | null>(null)
  const [aiBusy, setAiBusy] = useState(false)

  const requestPlan = async (): Promise<void> => {
    if (!canAdminWrite) {
      enqueueSnackbar('Admin chain role is required for AI system actions.', { variant: 'warning' })
      return
    }
    setAiBusy(true)
    try {
      const plan = await apiRequest<AiPlanResponse>(endpoints.aiAdminSystemPlan, {
        method: 'POST',
        body: {
          prompt: aiPrompt,
          context: { health: health.data ?? null },
          auto_execute: false,
        },
      })
      setAiPlan(plan)
      setAiExec(null)
      enqueueSnackbar('AI remediation plan created.', { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'AI plan failed', { variant: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  const executePlan = async (): Promise<void> => {
    if (!canAdminWrite) {
      enqueueSnackbar('Admin chain role is required for AI system actions.', { variant: 'warning' })
      return
    }
    if (!aiPlan) return
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
    <div className="page-grid single">
      <Card title="System Health">
        {health.loading ? <LoadingSkeleton rows={4} /> : null}
        {health.error ? <p className="error-text">{health.error}</p> : null}
        {health.data ? (
          <>
            <div className="kv">
              <span>Status</span>
              <span>{health.data.status}</span>
            </div>
            <div className="kv">
              <span>Route Source</span>
              <code>{endpoints.systemHealth}</code>
            </div>
            <div className="kv">
              <span>Service</span>
              <span>{health.data.service}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Status</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>BFF</td>
                    <td>{health.data.bff.status}</td>
                    <td>{health.data.bff.detail}</td>
                  </tr>
                  <tr>
                    <td>Database ({health.data.backend})</td>
                    <td>{health.data.db.status}</td>
                    <td>{health.data.db.detail}</td>
                  </tr>
                  <tr>
                    <td>Algod</td>
                    <td>{health.data.algod.status}</td>
                    <td>{health.data.algod.detail}</td>
                  </tr>
                  <tr>
                    <td>Indexer</td>
                    <td>{health.data.indexer.status}</td>
                    <td>{health.data.indexer.detail}</td>
                  </tr>
                  <tr>
                    <td>KMD</td>
                    <td>{health.data.kmd.status}</td>
                    <td>{health.data.kmd.detail}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Card>

      <Card title="AI System Remediation">
        {!isAuthenticated ? (
          <LiveAccessNotice body="AI execution and protected admin automation require live sign-in." />
        ) : null}
        {isAuthenticated && !canAdminWrite ? <ChainRoleNotice required="admin" chainRole={chainRole} /> : null}
        <div className="form-grid">
          <label htmlFor="admin-system-ai-prompt">Prompt</label>
          <textarea
            id="admin-system-ai-prompt"
            rows={4}
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
          />
          <div className="inline-row">
            <button type="button" className="btn btn-primary" onClick={() => void requestPlan()} disabled={aiBusy || !canAdminWrite}>
              {aiBusy ? 'Planning...' : 'Generate Plan'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void executePlan()}
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
            <span>{aiExec.status}{aiExec.tx_id ? ` (tx: ${aiExec.tx_id})` : ''}</span>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
