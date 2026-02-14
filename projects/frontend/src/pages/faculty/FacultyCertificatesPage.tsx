import { useState } from 'react'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { ChainRoleNotice } from '../../components/ChainRoleNotice'
import { CopyButton } from '../../components/CopyButton'
import { EmptyState } from '../../components/EmptyState'
import { LiveAccessNotice } from '../../components/LiveAccessNotice'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { TxStatus } from '../../components/TxStatus'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useRoleAccess } from '../../hooks/useRoleAccess'
import { useTxToast } from '../../hooks/useTxToast'
import { apiRequest } from '../../lib/api'
import { mergeCertificates } from '../../lib/demoData'
import { endpoints } from '../../lib/endpoints'
import { downloadCsv, downloadJson } from '../../lib/export'
import { formatDateTime } from '../../lib/utils'
import type {
  AiExecuteResponse,
  AiPlanResponse,
  CertListResponse,
  CertificateIssueResponse,
  TxStatus as TxStatusModel,
} from '../../types/api'

export const FacultyCertificatesPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { notifyTxLifecycle } = useTxToast()
  const { isAuthenticated } = useAuth()
  const { canFacultyWrite, chainRole } = useRoleAccess()

  const certs = useAsyncData(
    () =>
      isAuthenticated
        ? apiRequest<CertListResponse>(endpoints.certList)
        : Promise.resolve({ certs: [], count: 0 }),
    [isAuthenticated],
  )

  const [recipientAddress, setRecipientAddress] = useState('')
  const [recipientLabel, setRecipientLabel] = useState('')
  const [courseOrEvent, setCourseOrEvent] = useState('')
  const [grade, setGrade] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<CertificateIssueResponse | null>(null)
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)
  const [aiPrompt, setAiPrompt] = useState('Prepare a certificate issuance plan with privacy-minimal metadata.')
  const [aiPlan, setAiPlan] = useState<AiPlanResponse | null>(null)
  const [aiExec, setAiExec] = useState<AiExecuteResponse | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const mergedCerts = mergeCertificates(isAuthenticated ? certs.data?.certs : undefined)

  const issueCertificate = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required to issue certificates.', { variant: 'warning' })
      return
    }

    if (!recipientAddress.trim() || recipientAddress.trim().length !== 58) {
      enqueueSnackbar('Enter a valid recipient address.', { variant: 'warning' })
      return
    }
    if (!recipientLabel.trim() || !courseOrEvent.trim()) {
      enqueueSnackbar('Recipient label and course/event are required.', { variant: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      const response = await apiRequest<CertificateIssueResponse>(endpoints.certIssue, {
        method: 'POST',
        body: {
          recipient_address: recipientAddress.trim(),
          recipient_name: recipientLabel.trim(),
          course_code: courseOrEvent.trim(),
          title: grade.trim() ? `${courseOrEvent.trim()} (${grade.trim()})` : courseOrEvent.trim(),
          description: remarks.trim(),
        },
      })

      setIssued(response)
      enqueueSnackbar('Certificate issued successfully', { variant: 'success' })

      const tracked = await notifyTxLifecycle({
        txId: response.tx_id,
        kind: 'cert',
        pendingLabel: `Tracking cert issue tx ${response.tx_id}`,
      })
      setTxStatus(tracked)

      setRecipientAddress('')
      setRecipientLabel('')
      setCourseOrEvent('')
      setGrade('')
      setRemarks('')

      await certs.refresh()
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Certificate issue failed', { variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const planCertificateWithAi = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for AI certificate planning.', { variant: 'warning' })
      return
    }

    setAiBusy(true)
    try {
      const plan = await apiRequest<AiPlanResponse>(endpoints.aiFacultyCertificatePlan, {
        method: 'POST',
        body: {
          prompt: aiPrompt,
          auto_execute: false,
          context: {
            payload: {
              recipient_address: recipientAddress.trim(),
              recipient_name: recipientLabel.trim(),
              course_code: courseOrEvent.trim(),
              title: grade.trim() ? `${courseOrEvent.trim()} (${grade.trim()})` : courseOrEvent.trim(),
              description: remarks.trim(),
            },
          },
        },
      })
      setAiPlan(plan)
      setAiExec(null)
      enqueueSnackbar('AI certificate plan generated.', { variant: 'success' })
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'AI planning failed', { variant: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  const executeCertificateIntent = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for AI execution.', { variant: 'warning' })
      return
    }
    if (!aiPlan) {
      return
    }
    setAiBusy(true)
    try {
      const result = await apiRequest<AiExecuteResponse>(endpoints.aiExecute(aiPlan.intent_id), { method: 'POST' })
      setAiExec(result)
      enqueueSnackbar(result.message, { variant: result.status === 'executed' ? 'success' : 'info' })
      if (result.tx_id) {
        const tracked = await notifyTxLifecycle({
          txId: result.tx_id,
          kind: 'ai',
          pendingLabel: `Tracking AI execution tx ${result.tx_id}`,
        })
        setTxStatus(tracked)
      }
      await certs.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'AI execution failed', { variant: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <div className="page-grid">
      <Card title="Issue Certificate (Faculty/Admin)">
        {!isAuthenticated ? (
          <LiveAccessNotice body="Certificate issuance uses protected BFF mint + on-chain registry writes. Enable live chain access to issue real certificates." />
        ) : null}
        {isAuthenticated && !canFacultyWrite ? <ChainRoleNotice required="faculty" chainRole={chainRole} /> : null}

        <p>Local demo flow: BFF mints ASA/NFT via LocalNet dev issuer and registers cert hash on-chain.</p>
        <div className="form-grid">
          <label htmlFor="recipient-address">Recipient Address</label>
          <input
            id="recipient-address"
            value={recipientAddress}
            onChange={(event) => setRecipientAddress(event.target.value)}
            placeholder="Algorand address"
          />

          <label htmlFor="recipient-label">Recipient Label</label>
          <input
            id="recipient-label"
            value={recipientLabel}
            onChange={(event) => setRecipientLabel(event.target.value)}
            placeholder="Minimal label (avoid extra PII)"
          />

          <label htmlFor="course-event">Course / Event</label>
          <input
            id="course-event"
            value={courseOrEvent}
            onChange={(event) => setCourseOrEvent(event.target.value)}
            placeholder="e.g. CSE401 Blockchain"
          />

          <label htmlFor="grade">Grade (optional)</label>
          <input id="grade" value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="e.g. A+" />

          <label htmlFor="remarks">Remarks (optional)</label>
          <textarea id="remarks" rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} />

          <button type="button" className="btn btn-primary" onClick={() => void issueCertificate()} disabled={submitting || !canFacultyWrite}>
            {submitting ? 'Issuing...' : 'Issue Certificate'}
          </button>
        </div>
      </Card>

      <Card title="AI Certificate Automation">
        <p>Certificate actions are high-risk by policy and generally require explicit approval.</p>
        {!isAuthenticated ? (
          <LiveAccessNotice body="AI planning and execution require live authenticated session." />
        ) : null}
        <div className="form-grid">
          <label htmlFor="faculty-cert-ai-prompt">Prompt</label>
          <textarea
            id="faculty-cert-ai-prompt"
            rows={3}
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
          />
          <div className="inline-row">
            <button type="button" className="btn btn-primary" onClick={() => void planCertificateWithAi()} disabled={aiBusy || !canFacultyWrite}>
              {aiBusy ? 'Planning...' : 'Generate Plan'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void executeCertificateIntent()}
              disabled={aiBusy || !aiPlan || !canFacultyWrite}
            >
              Execute Intent
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

      {issued ? (
        <Card title="Issued Certificate Receipt">
          <div className="kv">
            <span>cert_hash</span>
            <code>{issued.cert_hash}</code>
          </div>
          <CopyButton value={issued.cert_hash} label="Copy cert_hash" />
          <div className="kv">
            <span>asset_id</span>
            <span>{issued.asset_id}</span>
          </div>
          <div className="kv">
            <span>tx_id</span>
            <code>{issued.tx_id}</code>
          </div>
          <CopyButton value={issued.tx_id} label="Copy tx_id" />
          <div className="kv">
            <span>metadata_url</span>
            <code>{issued.metadata_url}</code>
          </div>
        </Card>
      ) : null}

      <TxStatus tx={txStatus} loading={submitting} />

      <Card
        title="Recent Issued Certificates"
        right={(
          <div className="button-grid">
            {isAuthenticated ? <button type="button" className="btn btn-ghost" onClick={() => void certs.refresh()}>Refresh</button> : null}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadJson('faculty-certificate-list.json', mergedCerts)}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                downloadCsv(
                  'faculty-certificate-list.csv',
                  ['cert_hash', 'recipient', 'asset_id', 'created', 'type'],
                  mergedCerts.map((cert) => [
                    cert.cert_hash,
                    cert.recipient,
                    cert.asset_id ?? '',
                    cert.created ?? '',
                    cert.is_demo ? 'demo' : 'live',
                  ]),
                )
              }
            >
              Export CSV
            </button>
          </div>
        )}
      >
        {isAuthenticated && certs.loading ? <LoadingSkeleton rows={4} /> : null}
        {isAuthenticated && certs.error ? <p className="error-text">{certs.error}</p> : null}
        {!certs.loading && mergedCerts.length === 0 ? (
          <EmptyState title="No certificates" body="Issue one from the form above." />
        ) : null}
        {!certs.loading && mergedCerts.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hash</th>
                  <th>Recipient</th>
                  <th>Asset</th>
                  <th>Created</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {mergedCerts.map((cert) => (
                  <tr key={cert.cert_hash}>
                    <td>
                      <code>{cert.cert_hash}</code>
                    </td>
                    <td>{cert.recipient}</td>
                    <td>{cert.asset_id ?? '--'}</td>
                    <td>{formatDateTime(cert.created)}</td>
                    <td>{cert.is_demo ? <span className="badge badge-warning">Demo</span> : <span className="badge badge-success">Live</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
