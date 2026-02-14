import { useMemo, useState } from 'react'
import { useSnackbar } from 'notistack'
import { useWallet } from '@txnlab/use-wallet-react'

import { Card } from '../../components/Card'
import { EmptyState } from '../../components/EmptyState'
import { TxStatus } from '../../components/TxStatus'
import { useAuth } from '../../context/AuthContext'
import { useTxToast } from '../../hooks/useTxToast'
import { submitPaymentTxn } from '../../lib/abi'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { formatDateTime } from '../../lib/utils'
import type { FeedbackCommitResponse, TxStatus as TxStatusModel } from '../../types/api'

interface FeedbackEntry {
  id: string
  course: string
  message: string
  hash: string
  txId: string
  created: number
}

const STORAGE_KEY = 'algocampus.feedback.entries'

const loadEntries = (): FeedbackEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return []
    }
    return JSON.parse(raw) as FeedbackEntry[]
  } catch {
    return []
  }
}

const saveEntries = (entries: FeedbackEntry[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

const bytesToHex = (bytes: Uint8Array): string => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')

const hashFeedback = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

export const StudentFeedbackPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { notifyTxLifecycle } = useTxToast()
  const { address, isAuthenticated } = useAuth()
  const { algodClient, signTransactions, activeAddress } = useWallet()

  const [course, setCourse] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [entries, setEntries] = useState<FeedbackEntry[]>(() => loadEntries())
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)

  const sortedEntries = useMemo(
    () => [...entries].sort((a, b) => b.created - a.created),
    [entries],
  )

  const submit = async (): Promise<void> => {
    if (!activeAddress || !address) {
      enqueueSnackbar('Connect wallet first', { variant: 'warning' })
      return
    }
    if (!course.trim() || !message.trim()) {
      enqueueSnackbar('Course and feedback are required', { variant: 'warning' })
      return
    }

    setBusy(true)
    try {
      const payload = JSON.stringify({ course: course.trim(), message: message.trim(), created: Date.now() })
      const hash = await hashFeedback(payload)
      const note = new TextEncoder().encode(`feedback:${hash}`)

      const txId = await submitPaymentTxn({
        algodClient,
        signTransactions,
        sender: activeAddress,
        receiver: activeAddress,
        amountMicroAlgos: 0,
        note,
      })

      const tracked = await notifyTxLifecycle({
        txId,
        kind: 'other',
        pendingLabel: `Feedback commit submitted (${txId})`,
      })
      setTxStatus(tracked)

      if (isAuthenticated) {
        await apiRequest<FeedbackCommitResponse>(endpoints.feedbackCommit, {
          method: 'POST',
          body: {
            feedback_hash: hash,
            course_code: course.trim(),
            tx_id: txId,
            metadata: {
              source: 'student_feedback',
              client_ts: Date.now(),
            },
          },
        })
      }

      const nextEntry: FeedbackEntry = {
        id: `${Date.now()}-${hash.slice(0, 8)}`,
        course: course.trim(),
        message: message.trim(),
        hash,
        txId,
        created: Date.now(),
      }

      const next = [nextEntry, ...entries]
      setEntries(next)
      saveEntries(next)
      setCourse('')
      setMessage('')
      enqueueSnackbar('Feedback saved locally + hash committed on-chain', { variant: 'success' })
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Feedback submit failed', { variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-grid">
      <Card title="Submit Feedback">
        <p>Plaintext stays in local browser storage. Only the SHA-256 commitment hash is sent on-chain.</p>
        <div className="form-grid">
          <label htmlFor="feedback-course">Course or Event</label>
          <input
            id="feedback-course"
            value={course}
            onChange={(event) => setCourse(event.target.value)}
            placeholder="e.g. CSE101"
          />

          <label htmlFor="feedback-message">Feedback</label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={5}
            placeholder="Share your feedback"
          />

          <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Submitting...' : 'Submit + Commit Hash'}
          </button>
        </div>
      </Card>

      <TxStatus tx={txStatus} loading={busy} title="Commit Receipt" />

      <Card title="Local Feedback History">
        {sortedEntries.length === 0 ? (
          <EmptyState title="No feedback yet" body="Submit your first feedback item to create a receipt." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Hash</th>
                  <th>TX ID</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.course}</td>
                    <td>
                      <code>{entry.hash}</code>
                    </td>
                    <td>
                      <code>{entry.txId}</code>
                    </td>
                    <td>{formatDateTime(entry.created)}</td>
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
