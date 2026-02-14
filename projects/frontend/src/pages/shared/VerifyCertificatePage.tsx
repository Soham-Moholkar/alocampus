import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSnackbar } from 'notistack'

import { ApiError, apiRequest, withQuery } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { CopyButton } from '../../components/CopyButton'
import { Card } from '../../components/Card'
import { formatDateTime } from '../../lib/utils'
import type { CertVerifyResponse } from '../../types/api'

export const VerifyCertificatePage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const [searchParams, setSearchParams] = useSearchParams()
  const [certHash, setCertHash] = useState(searchParams.get('cert_hash') ?? '')
  const [result, setResult] = useState<CertVerifyResponse | null>(null)
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const verifyLink = useMemo(() => {
    const url = new URL(window.location.href)
    url.pathname = '/verify/certificate'
    url.search = certHash ? `cert_hash=${certHash}` : ''
    return url.toString()
  }, [certHash])

  const verify = async (hash: string): Promise<void> => {
    if (!hash || hash.length !== 64) {
      enqueueSnackbar('cert_hash must be a 64-char hex string', { variant: 'warning' })
      return
    }

    setLoading(true)
    setMetadata(null)

    try {
      const response = await apiRequest<CertVerifyResponse>(
        withQuery(endpoints.certVerify, { cert_hash: hash }),
        { auth: false },
      )
      setResult(response)
      setSearchParams({ cert_hash: hash })

      if (response.valid) {
        const meta = await apiRequest<Record<string, unknown>>(endpoints.certMetadata(hash), {
          auth: false,
        })
        setMetadata(meta)
      }
    } catch (err) {
      if (err instanceof ApiError) {
        enqueueSnackbar(`Verify failed (${err.status}): ${err.message}`, { variant: 'error' })
      } else {
        enqueueSnackbar('Verification failed', { variant: 'error' })
      }
      setResult(null)
      setMetadata(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const hash = searchParams.get('cert_hash')
    if (hash && hash.length === 64) {
      void verify(hash)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="page-grid single">
      <Card title="Public Certificate Verification">
        <div className="form-grid">
          <label htmlFor="cert_hash">Certificate Hash</label>
          <input
            id="cert_hash"
            value={certHash}
            onChange={(event) => setCertHash(event.target.value.trim())}
            placeholder="64-char cert hash"
          />
          <div className="inline-row">
            <button type="button" className="btn btn-primary" onClick={() => void verify(certHash)} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <CopyButton value={verifyLink} label="Copy Verify Link" />
          </div>
        </div>
      </Card>

      {result ? (
        <Card title="Verification Result" right={<span className={`badge badge-${result.valid ? 'success' : 'danger'}`}>{result.valid ? 'Valid' : 'Invalid'}</span>}>
          <div className="kv">
            <span>cert_hash</span>
            <code>{result.cert_hash}</code>
          </div>
          <div className="kv">
            <span>recipient</span>
            <span>{result.recipient ?? '--'}</span>
          </div>
          <div className="kv">
            <span>asset_id</span>
            <span>{result.asset_id ?? '--'}</span>
          </div>
          <div className="kv">
            <span>issued_ts</span>
            <span>{formatDateTime(result.issued_ts)}</span>
          </div>
          <p>{result.message}</p>
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
