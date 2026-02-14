import { useState } from 'react'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { TxStatus } from '../../components/TxStatus'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useTxToast } from '../../hooks/useTxToast'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { formatDateTime } from '../../lib/utils'
import type {
  CertListResponse,
  CertificateIssueResponse,
  TxStatus as TxStatusModel,
} from '../../types/api'

export const FacultyCertificatesPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { notifyTxLifecycle } = useTxToast()

  const certs = useAsyncData(() => apiRequest<CertListResponse>(endpoints.certList), [])

  const [recipientAddress, setRecipientAddress] = useState('')
  const [recipientLabel, setRecipientLabel] = useState('')
  const [courseOrEvent, setCourseOrEvent] = useState('')
  const [grade, setGrade] = useState('')
  const [remarks, setRemarks] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<CertificateIssueResponse | null>(null)
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)

  const issueCertificate = async (): Promise<void> => {
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

  return (
    <div className="page-grid">
      <Card title="Issue Certificate (Faculty/Admin)">
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

          <button type="button" className="btn btn-primary" onClick={() => void issueCertificate()} disabled={submitting}>
            {submitting ? 'Issuing...' : 'Issue Certificate'}
          </button>
        </div>
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

      <Card title="Recent Issued Certificates" right={<button type="button" className="btn btn-ghost" onClick={() => void certs.refresh()}>Refresh</button>}>
        {certs.loading ? <LoadingSkeleton rows={4} /> : null}
        {certs.error ? <p className="error-text">{certs.error}</p> : null}
        {!certs.loading && certs.data?.count === 0 ? (
          <EmptyState title="No certificates" body="Issue one from the form above." />
        ) : null}
        {!certs.loading && certs.data && certs.data.count > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hash</th>
                  <th>Recipient</th>
                  <th>Asset</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {certs.data.certs.map((cert) => (
                  <tr key={cert.cert_hash}>
                    <td>
                      <code>{cert.cert_hash}</code>
                    </td>
                    <td>{cert.recipient}</td>
                    <td>{cert.asset_id ?? '--'}</td>
                    <td>{formatDateTime(cert.created)}</td>
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
