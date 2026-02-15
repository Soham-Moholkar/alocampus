import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSnackbar } from 'notistack'

import { CopyButton } from '../../components/CopyButton'
import { Card } from '../../components/Card'
import { ApiError, apiRequest, withQuery } from '../../lib/api'
import {
  extractFromJsonOrTextFile,
  extractFromPdfFile,
  extractFromQrImage,
  extractHashFromUrl,
  type CertExtractResult,
} from '../../lib/certUpload'
import { endpoints } from '../../lib/endpoints'
import { formatDateTime } from '../../lib/utils'
import type { CertUploadVerifyResult, CertVerifyResponse } from '../../types/api'

type VerifyTab = 'manual' | 'upload' | 'qr' | 'pdf'

export const VerifyCertificatePage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<VerifyTab>('manual')
  const [certHash, setCertHash] = useState(searchParams.get('cert_hash') ?? '')
  const [result, setResult] = useState<CertVerifyResponse | null>(null)
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadInfo, setUploadInfo] = useState<CertExtractResult | CertUploadVerifyResult | null>(null)
  const [qrLink, setQrLink] = useState('')

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
      setCertHash(hash)

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

  const verifyFromExtract = async (extract: CertExtractResult | CertUploadVerifyResult): Promise<void> => {
    setUploadInfo(extract)
    if (extract.cert_hash) {
      await verify(extract.cert_hash)
      return
    }
    enqueueSnackbar(extract.message || 'No cert hash extracted from upload.', { variant: 'warning' })
  }

  const handleJsonTextUpload = async (file: File): Promise<void> => {
    setUploadBusy(true)
    try {
      const extract = await extractFromJsonOrTextFile(file)
      await verifyFromExtract(extract)
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to parse uploaded file', { variant: 'error' })
    } finally {
      setUploadBusy(false)
    }
  }

  const handleQrUpload = async (file: File): Promise<void> => {
    setUploadBusy(true)
    try {
      const extract = await extractFromQrImage(file)
      await verifyFromExtract(extract)
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to decode QR image', { variant: 'error' })
    } finally {
      setUploadBusy(false)
    }
  }

  const handlePdfUpload = async (file: File): Promise<void> => {
    setUploadBusy(true)
    try {
      const extract = await extractFromPdfFile(file)
      await verifyFromExtract(extract)
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Unable to parse PDF upload', { variant: 'error' })
    } finally {
      setUploadBusy(false)
    }
  }

  const handleServerFallback = async (file: File): Promise<void> => {
    setUploadBusy(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const extract = await apiRequest<CertUploadVerifyResult>(endpoints.certVerifyUpload, {
        method: 'POST',
        auth: false,
        body: formData,
      })
      await verifyFromExtract(extract)
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Server-side upload parse failed', { variant: 'error' })
    } finally {
      setUploadBusy(false)
    }
  }

  const verifyQrLink = async (): Promise<void> => {
    const extractedHash = extractHashFromUrl(qrLink)
    if (!extractedHash) {
      enqueueSnackbar('No certificate hash found in provided link/text.', { variant: 'warning' })
      return
    }
    setUploadInfo({
      source: 'link',
      hash: extractedHash,
      candidates: [extractedHash],
      message: 'Hash extracted from link',
    })
    await verify(extractedHash)
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
      <Card title="Public Certificate Verification" subtitle="Manual hash, JSON/Text upload, QR decode, and PDF best-effort extraction.">
        <div className="inline-row">
          <button type="button" className={`btn ${tab === 'manual' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('manual')}>
            Manual
          </button>
          <button type="button" className={`btn ${tab === 'upload' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('upload')}>
            Upload JSON/Text
          </button>
          <button type="button" className={`btn ${tab === 'qr' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('qr')}>
            QR Link/Image
          </button>
          <button type="button" className={`btn ${tab === 'pdf' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('pdf')}>
            PDF (Best Effort)
          </button>
        </div>

        {tab === 'manual' ? (
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
        ) : null}

        {tab === 'upload' ? (
          <div className="form-grid">
            <label htmlFor="cert-upload-file">Upload JSON or Text</label>
            <input
              id="cert-upload-file"
              type="file"
              accept=".json,.txt,application/json,text/plain"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void handleJsonTextUpload(file)
                }
              }}
            />
            <p className="muted-text">If no explicit <code>cert_hash</code> field exists, SHA-256 is computed from canonical JSON/text.</p>
          </div>
        ) : null}

        {tab === 'qr' ? (
          <div className="form-grid">
            <label htmlFor="qr-link">QR Link/Text</label>
            <input
              id="qr-link"
              value={qrLink}
              onChange={(event) => setQrLink(event.target.value)}
              placeholder="Paste QR payload URL or text"
            />
            <div className="inline-row">
              <button type="button" className="btn btn-primary" onClick={() => void verifyQrLink()} disabled={uploadBusy}>
                Extract + Verify
              </button>
            </div>

            <label htmlFor="cert-qr-file">Or Upload QR Image</label>
            <input
              id="cert-qr-file"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void handleQrUpload(file)
                }
              }}
            />
          </div>
        ) : null}

        {tab === 'pdf' ? (
          <div className="form-grid">
            <label htmlFor="cert-pdf-file">Upload Certificate PDF</label>
            <input
              id="cert-pdf-file"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void handlePdfUpload(file)
                }
              }}
            />
            <label htmlFor="cert-pdf-server">Server-side parser fallback</label>
            <input
              id="cert-pdf-server"
              type="file"
              accept=".json,.txt,.pdf,image/*,application/json,text/plain,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void handleServerFallback(file)
                }
              }}
            />
            <p className="muted-text">PDF extraction is best-effort. If no candidate is found, confirm hash manually.</p>
          </div>
        ) : null}

        {uploadBusy ? <p className="muted-text">Processing upload...</p> : null}
        {uploadInfo ? (
          <div className="empty-state">
            <strong>Upload Parse Result</strong>
            <p>{uploadInfo.message}</p>
            <p>Source: <code>{uploadInfo.source}</code></p>
            {'cert_hash' in uploadInfo && uploadInfo.cert_hash ? <p>Extracted: <code>{uploadInfo.cert_hash}</code></p> : null}
            {'hash' in uploadInfo && uploadInfo.hash ? <p>Extracted: <code>{uploadInfo.hash}</code></p> : null}
            {uploadInfo.candidates && uploadInfo.candidates.length > 0 ? (
              <div className="hash-list">
                {uploadInfo.candidates.map((candidate) => (
                  <button
                    key={candidate}
                    type="button"
                    className="btn btn-ghost btn-compact"
                    onClick={() => void verify(candidate)}
                  >
                    Verify {candidate.slice(0, 10)}...
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
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

