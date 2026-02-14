import { useState } from 'react'
import { useSnackbar } from 'notistack'

import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { EmptyState } from '../../components/EmptyState'
import { LiveAccessNotice } from '../../components/LiveAccessNotice'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAuth } from '../../context/AuthContext'
import { apiRequest, withQuery } from '../../lib/api'
import { demoCertificateMetadata, isDemoCertificateHash, mergeCertificates } from '../../lib/demoData'
import { endpoints } from '../../lib/endpoints'
import { downloadCsv, downloadJson } from '../../lib/export'
import { formatDateTime } from '../../lib/utils'
import { useAsyncData } from '../../hooks/useAsyncData'
import type { CertListResponse, CertVerifyResponse } from '../../types/api'

export const StudentCertificatesPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { isAuthenticated } = useAuth()
  const certs = useAsyncData(
    () =>
      isAuthenticated
        ? apiRequest<CertListResponse>(endpoints.certList)
        : Promise.resolve({ certs: [], count: 0 }),
    [isAuthenticated],
  )

  const [selectedHash, setSelectedHash] = useState<string>('')
  const [verifyResult, setVerifyResult] = useState<CertVerifyResponse | null>(null)
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  const [verifying, setVerifying] = useState(false)

  const mergedCerts = mergeCertificates(isAuthenticated ? certs.data?.certs : undefined)

  const runVerify = async (certHash: string): Promise<void> => {
    setVerifying(true)
    setMetadata(null)
    try {
      if (isDemoCertificateHash(certHash)) {
        const meta = demoCertificateMetadata[certHash]
        setVerifyResult({
          valid: true,
          cert_hash: certHash,
          recipient: String(meta.recipient ?? 'XYZ Student'),
          asset_id: Number(meta.asset_id ?? 0),
          issued_ts: Number(meta.issued_ts ?? Math.floor(Date.now() / 1000)),
          message: 'Synthetic demo certificate verified locally.',
        })
        setMetadata(meta)
        return
      }

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
      <Card
        title="My Certificates"
        subtitle="Live certificates plus synthetic demo records"
        right={isAuthenticated ? <button type="button" className="btn btn-ghost" onClick={() => void certs.refresh()}>Refresh</button> : null}
      >
        {!isAuthenticated ? (
          <LiveAccessNotice body="You are in role demo mode. Synthetic certificates are available below; enable live chain access to load your protected list from BFF." />
        ) : null}

        {mergedCerts.length > 0 ? (
          <div className="button-grid">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => downloadJson('student-certificates.json', mergedCerts)}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                downloadCsv(
                  'student-certificates.csv',
                  ['cert_hash', 'recipient', 'asset_id', 'created', 'type'],
                  mergedCerts.map((cert) => [
                    cert.cert_hash,
                    cert.recipient,
                    cert.asset_id ?? '',
                    formatDateTime(cert.created),
                    cert.is_demo ? 'demo' : 'live',
                  ]),
                )
              }
            >
              Export CSV
            </button>
          </div>
        ) : null}

        {isAuthenticated && certs.loading ? <LoadingSkeleton rows={4} /> : null}
        {isAuthenticated && certs.error ? <p className="error-text">{certs.error}</p> : null}

        {!certs.loading && mergedCerts.length === 0 ? (
          <EmptyState title="No certificates yet" body="Faculty-issued certificates will appear here." />
        ) : null}

        {!certs.loading && mergedCerts.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hash</th>
                  <th>Asset</th>
                  <th>Issued</th>
                  <th>Type</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mergedCerts.map((cert) => (
                  <tr key={cert.cert_hash}>
                    <td>
                      <code>{cert.cert_hash}</code>
                    </td>
                    <td>{cert.asset_id ?? '--'}</td>
                    <td>{formatDateTime(cert.created)}</td>
                    <td>
                      {cert.is_demo ? <span className="badge badge-warning">Demo</span> : <span className="badge badge-success">Live</span>}
                    </td>
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
              {isDemoCertificateHash(selectedHash) ? <p className="muted-text">Demo certificate verification path (local preview).</p> : null}
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
