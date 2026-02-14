import { useState } from 'react'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { apiRequest, withQuery } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { formatDateTime } from '../../lib/utils'
import { useAsyncData } from '../../hooks/useAsyncData'
import type { CertListResponse, CertVerifyResponse } from '../../types/api'

export const StudentCertificatesPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const certs = useAsyncData(() => apiRequest<CertListResponse>(endpoints.certList), [])

  const [selectedHash, setSelectedHash] = useState<string>('')
  const [verifyResult, setVerifyResult] = useState<CertVerifyResponse | null>(null)
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  const [verifying, setVerifying] = useState(false)

  const runVerify = async (certHash: string): Promise<void> => {
    setVerifying(true)
    setMetadata(null)
    try {
      const result = await apiRequest<CertVerifyResponse>(withQuery(endpoints.certVerify, { cert_hash: certHash }), {
        auth: false,
      })
      setVerifyResult(result)
      if (result.valid) {
        const data = await apiRequest<Record<string, unknown>>(endpoints.certMetadata(certHash), { auth: false })
        setMetadata(data)
      }
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Failed to verify certificate', { variant: 'error' })
      setVerifyResult(null)
      setMetadata(null)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="page-grid">
      <Card title="My Certificates" right={<button type="button" className="btn btn-ghost" onClick={() => void certs.refresh()}>Refresh</button>}>
        {certs.loading ? <LoadingSkeleton rows={4} /> : null}
        {certs.error ? <p className="error-text">{certs.error}</p> : null}
        {!certs.loading && certs.data && certs.data.count === 0 ? (
          <EmptyState title="No certificates yet" body="Faculty-issued certificates will appear here." />
        ) : null}

        {!certs.loading && certs.data && certs.data.count > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hash</th>
                  <th>Asset</th>
                  <th>Issued</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {certs.data.certs.map((cert) => (
                  <tr key={cert.cert_hash}>
                    <td>
                      <code>{cert.cert_hash}</code>
                    </td>
                    <td>{cert.asset_id ?? '--'}</td>
                    <td>{formatDateTime(cert.created)}</td>
                    <td>
                      <div className="inline-row">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            setSelectedHash(cert.cert_hash)
                            void runVerify(cert.cert_hash)
                          }}
                        >
                          Verify
                        </button>
                        <CopyButton value={cert.cert_hash} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {selectedHash ? (
        <Card title={`Verify ${selectedHash}`}>
          <button type="button" className="btn btn-primary" onClick={() => void runVerify(selectedHash)} disabled={verifying}>
            {verifying ? 'Verifying...' : 'Re-verify'}
          </button>
          {verifyResult ? (
            <>
              <div className="kv">
                <span>Valid</span>
                <span>{String(verifyResult.valid)}</span>
              </div>
              <div className="kv">
                <span>Recipient</span>
                <span>{verifyResult.recipient ?? '--'}</span>
              </div>
              <div className="kv">
                <span>Asset ID</span>
                <span>{verifyResult.asset_id ?? '--'}</span>
              </div>
              <div className="kv">
                <span>Issued</span>
                <span>{formatDateTime(verifyResult.issued_ts)}</span>
              </div>
            </>
          ) : null}
        </Card>
      ) : null}

      {metadata ? (
        <Card title="Metadata Preview">
          <pre>{JSON.stringify(metadata, null, 2)}</pre>
        </Card>
      ) : null}
    </div>
  )
}
