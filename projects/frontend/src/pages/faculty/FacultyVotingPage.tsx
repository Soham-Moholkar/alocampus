import { useEffect, useMemo, useState } from 'react'
import { useSnackbar } from 'notistack'
import { useWallet } from '@txnlab/use-wallet-react'

import { getPollResult } from '../../contracts/votingActions'
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
import { endpoints } from '../../lib/endpoints'
import { downloadCsv, downloadJson } from '../../lib/export'
import type {
  AiExecuteResponse,
  AiPlanResponse,
  Poll,
  PollListResponse,
  TxStatus as TxStatusModel,
} from '../../types/api'

const createDefaultOptions = (): string[] => ['Option 1', 'Option 2']

export const FacultyVotingPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { address, isAuthenticated } = useAuth()
  const { canFacultyWrite, chainRole } = useRoleAccess()
  const { notifyTxLifecycle } = useTxToast()
  const { algodClient, transactionSigner, activeAddress } = useWallet()

  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>(createDefaultOptions())
  const [startRound, setStartRound] = useState('')
  const [endRound, setEndRound] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null)
  const [resultCounts, setResultCounts] = useState<number[]>([])
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)
  const [aiPrompt, setAiPrompt] = useState('Create a faculty poll with balanced options and valid round window.')
  const [aiPlan, setAiPlan] = useState<AiPlanResponse | null>(null)
  const [aiExec, setAiExec] = useState<AiExecuteResponse | null>(null)
  const [aiBusy, setAiBusy] = useState(false)

  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])

  useEffect(() => {
    if (!selectedPollId && polls.data?.polls.length) {
      setSelectedPollId(polls.data.polls[0].poll_id)
    }
  }, [polls.data?.polls, selectedPollId])

  const selectedPoll = useMemo<Poll | null>(() => {
    if (!selectedPollId || !polls.data) {
      return null
    }
    return polls.data.polls.find((poll) => poll.poll_id === selectedPollId) ?? null
  }, [polls.data, selectedPollId])

  const myPolls = polls.data?.polls.filter((poll) => poll.creator === address) ?? []

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!selectedPoll || !activeAddress) {
        setResultCounts([])
        return
      }

      const values = await Promise.all(
        selectedPoll.options.map(async (_, idx) => {
          try {
            return await getPollResult(
              {
                algodClient,
                transactionSigner,
                sender: activeAddress,
                appId: selectedPoll.app_id,
              },
              selectedPoll.poll_id,
              idx,
            )
          } catch {
            return 0
          }
        }),
      )
      setResultCounts(values)
    }

    void load()
  }, [activeAddress, algodClient, selectedPoll, transactionSigner])

  const updateOption = (index: number, value: string): void => {
    setOptions((previous) => previous.map((entry, idx) => (idx === index ? value : entry)))
  }

  const addOption = (): void => {
    setOptions((previous) => [...previous, `Option ${previous.length + 1}`])
  }

  const removeOption = (index: number): void => {
    setOptions((previous) => previous.filter((_, idx) => idx !== index))
  }

  const createPoll = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required to create polls.', { variant: 'warning' })
      return
    }

    const cleanedOptions = options.map((option) => option.trim()).filter(Boolean)
    if (!question.trim() || cleanedOptions.length < 2) {
      enqueueSnackbar('Provide a question and at least 2 options.', { variant: 'warning' })
      return
    }

    const start = Number(startRound)
    const end = Number(endRound)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      enqueueSnackbar('Provide valid start/end rounds with end > start.', { variant: 'warning' })
      return
    }

    setSubmitting(true)
    try {
      const created = await apiRequest<Poll>(endpoints.facultyPolls, {
        method: 'POST',
        body: {
          question: question.trim(),
          options: cleanedOptions,
          start_round: start,
          end_round: end,
        },
      })

      enqueueSnackbar(`Poll #${created.poll_id} created`, { variant: 'success' })
      setQuestion('')
      setOptions(createDefaultOptions())
      setStartRound('')
      setEndRound('')
      await polls.refresh()
      setSelectedPollId(created.poll_id)

      if (created.tx_id) {
        const tracked = await notifyTxLifecycle({
          txId: created.tx_id,
          kind: 'other',
          pendingLabel: `Tracking poll create tx ${created.tx_id}`,
        })
        setTxStatus(tracked)
      }
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Create poll failed', { variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const planPollWithAi = async (): Promise<void> => {
    if (!canFacultyWrite) {
      enqueueSnackbar('Faculty or admin chain role is required for AI automation.', { variant: 'warning' })
      return
    }

    setAiBusy(true)
    try {
      const plan = await apiRequest<AiPlanResponse>(endpoints.aiFacultyPollPlan, {
        method: 'POST',
        body: {
          prompt: aiPrompt,
          auto_execute: true,
          context: {
            payload: {
              question: question.trim() || 'Faculty generated poll',
              options: options.map((item) => item.trim()).filter(Boolean).slice(0, 10),
              start_round: Number(startRound || 0),
              end_round: Number(endRound || 0),
            },
          },
        },
      })
      setAiPlan(plan)
      setAiExec(null)
      enqueueSnackbar(plan.message, { variant: 'success' })
      await polls.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'AI planning failed', { variant: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  const executeAiPollPlan = async (): Promise<void> => {
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
      await polls.refresh()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'AI execute failed', { variant: 'error' })
    } finally {
      setAiBusy(false)
    }
  }

  const turnout = resultCounts.reduce((sum, value) => sum + value, 0)
  const peak = resultCounts.length ? Math.max(...resultCounts) : 0
  const suspicious = turnout > 0 && peak / turnout > 0.9

  return (
    <div className="page-grid">
      {!isAuthenticated ? (
        <LiveAccessNotice body="Poll creation and admin writes require live wallet sign-in. You can still explore existing poll analytics in demo mode." />
      ) : null}
      {isAuthenticated && !canFacultyWrite ? <ChainRoleNotice required="faculty" chainRole={chainRole} /> : null}

      <Card title="Create Poll">
        <div className="form-grid">
          <label htmlFor="poll-question">Question</label>
          <input
            id="poll-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Enter poll question"
          />

          <label>Options</label>
          <div className="option-editor">
            {options.map((option, idx) => (
              <div className="inline-row" key={`${idx}-${option}`}>
                <input value={option} onChange={(event) => updateOption(idx, event.target.value)} />
                <button type="button" className="btn btn-ghost" onClick={() => removeOption(idx)} disabled={options.length <= 2}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-ghost" onClick={addOption}>
              Add Option
            </button>
          </div>

          <label htmlFor="start-round">Start Round</label>
          <input id="start-round" value={startRound} onChange={(event) => setStartRound(event.target.value)} />

          <label htmlFor="end-round">End Round</label>
          <input id="end-round" value={endRound} onChange={(event) => setEndRound(event.target.value)} />

          <button type="button" className="btn btn-primary" onClick={() => void createPoll()} disabled={submitting || !canFacultyWrite}>
            {submitting ? 'Creating...' : 'Create Poll'}
          </button>
        </div>
      </Card>

      <Card title="AI Poll Automation">
        <p>Low-risk poll creation can auto-execute through on-chain AI intent flow.</p>
        {!isAuthenticated ? (
          <LiveAccessNotice body="AI plan and execution require live authenticated session." />
        ) : null}
        <div className="form-grid">
          <label htmlFor="faculty-poll-ai-prompt">Prompt</label>
          <textarea
            id="faculty-poll-ai-prompt"
            rows={3}
            value={aiPrompt}
            onChange={(event) => setAiPrompt(event.target.value)}
          />
          <div className="inline-row">
            <button type="button" className="btn btn-primary" onClick={() => void planPollWithAi()} disabled={aiBusy || !canFacultyWrite}>
              {aiBusy ? 'Planning...' : 'AI Plan + Auto Execute'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void executeAiPollPlan()}
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

      <Card title="Manage Polls" right={<button type="button" className="btn btn-ghost" onClick={() => void polls.refresh()}>Refresh</button>}>
        {polls.loading ? <LoadingSkeleton rows={4} /> : null}
        {polls.error ? <p className="error-text">{polls.error}</p> : null}
        {!polls.loading && polls.data && polls.data.count === 0 ? (
          <EmptyState title="No polls" body="Create your first poll above." />
        ) : null}

        {!polls.loading && polls.data && polls.data.count > 0 ? (
          <>
            <div className="list-select">
              <label htmlFor="faculty-poll-select">Select Poll</label>
              <select
                id="faculty-poll-select"
                value={selectedPollId ?? ''}
                onChange={(event) => setSelectedPollId(Number(event.target.value))}
              >
                {polls.data.polls.map((poll) => (
                  <option key={poll.poll_id} value={poll.poll_id}>
                    #{poll.poll_id} - {poll.question}
                  </option>
                ))}
              </select>
            </div>
            <p>Polls created by me: {myPolls.length}</p>
          </>
        ) : null}
      </Card>

      {selectedPoll ? (
        <Card title={`Results: Poll #${selectedPoll.poll_id}`}>
          <div className="inline-row">
            <CopyButton value={String(selectedPoll.poll_id)} label="Copy Poll ID" />
            <CopyButton
              value={`${window.location.origin}/student/voting?pollId=${selectedPoll.poll_id}`}
              label="Share Link"
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                downloadJson(`poll-${selectedPoll.poll_id}-results.json`, {
                  poll: selectedPoll,
                  counts: resultCounts,
                  turnout,
                })
              }
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const rows = selectedPoll.options.map((option, idx) => {
                  const count = resultCounts[idx] ?? 0
                  const share = turnout === 0 ? 0 : Math.round((count / turnout) * 100)
                  return [option, count, share]
                })
                downloadCsv(`poll-${selectedPoll.poll_id}-results.csv`, ['option', 'votes', 'share_percent'], rows)
              }}
            >
              Export CSV
            </button>
          </div>

          <div className="kv">
            <span>Turnout</span>
            <span>{turnout}</span>
          </div>
          <div className="kv">
            <span>Participation Rate</span>
            <span>{turnout > 0 ? `${turnout} votes recorded` : 'No votes yet'}</span>
          </div>
          <div className="kv">
            <span>Anomaly</span>
            <span>{suspicious ? 'Suspicious spike detected' : 'No spike'}</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Votes</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {selectedPoll.options.map((option, idx) => {
                  const count = resultCounts[idx] ?? 0
                  const share = turnout === 0 ? 0 : Math.round((count / turnout) * 100)
                  return (
                    <tr key={option}>
                      <td>{option}</td>
                      <td>{count}</td>
                      <td>
                        <div className="bar-wrap">
                          <div className="bar" style={{ width: `${share}%` }} />
                          <span>{share}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <TxStatus tx={txStatus} loading={submitting} />
    </div>
  )
}
