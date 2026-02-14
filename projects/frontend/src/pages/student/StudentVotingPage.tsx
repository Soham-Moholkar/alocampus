import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useSnackbar } from 'notistack'
import { useWallet } from '@txnlab/use-wallet-react'

import { castVote, getPollResult } from '../../contracts/votingActions'
import { Card } from '../../components/Card'
import { CopyButton } from '../../components/CopyButton'
import { EmptyState } from '../../components/EmptyState'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { StatusPill } from '../../components/StatusPill'
import { TxStatus } from '../../components/TxStatus'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useCurrentRound } from '../../hooks/useCurrentRound'
import { useTxToast } from '../../hooks/useTxToast'
import { computeRoundStatus } from '../../lib/abi'
import { ApiError, apiRequest } from '../../lib/api'
import { appendSyntheticActivity, castDemoPollVote, getDemoPollResults, getLocalVotes, markLocalVote } from '../../lib/storage'
import { demoPollPurpose, isDemoPoll, mergePolls } from '../../lib/demoData'
import { endpoints } from '../../lib/endpoints'
import { downloadCsv, downloadJson } from '../../lib/export'
import type { Poll, PollContextResponse, PollListResponse, TxStatus as TxStatusModel } from '../../types/api'

const syntheticStatus = (): TxStatusModel => ({
  tx_id: `demo-vote-${Date.now()}`,
  kind: 'vote',
  status: 'confirmed',
  confirmed_round: 0,
})

export const StudentVotingPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { currentRound } = useCurrentRound()
  const { notifyTxLifecycle } = useTxToast()
  const { algodClient, transactionSigner, activeAddress } = useWallet()
  const [searchParams] = useSearchParams()

  const [selectedPollId, setSelectedPollId] = useState<number | null>(null)
  const [selectedOption, setSelectedOption] = useState<number>(0)
  const [resultCounts, setResultCounts] = useState<number[]>([])
  const [votedPolls, setVotedPolls] = useState<number[]>(() => getLocalVotes())
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)
  const [txPending, setTxPending] = useState(false)
  const [pollContexts, setPollContexts] = useState<Record<number, PollContextResponse>>({})

  const polls = useAsyncData(() => apiRequest<PollListResponse>(endpoints.polls), [])
  const mergedPolls = mergePolls(polls.data?.polls)
  const livePollIds = useMemo(() => (polls.data?.polls ?? []).map((poll) => poll.poll_id), [polls.data?.polls])

  useEffect(() => {
    const pollFromQuery = Number(searchParams.get('pollId'))
    if (Number.isFinite(pollFromQuery) && mergedPolls.some((poll) => poll.poll_id === pollFromQuery)) {
      setSelectedPollId(pollFromQuery)
      return
    }

    if (!selectedPollId && mergedPolls.length > 0) {
      setSelectedPollId(mergedPolls[0].poll_id)
    }
  }, [mergedPolls, searchParams, selectedPollId])

  useEffect(() => {
    let active = true

    const loadContexts = async (): Promise<void> => {
      if (livePollIds.length === 0) {
        if (active) {
          setPollContexts({})
        }
        return
      }

      const entries = await Promise.all(
        livePollIds.map(async (pollId) => {
          try {
            const context = await apiRequest<PollContextResponse>(endpoints.pollContext(pollId), { auth: false })
            return [pollId, context] as const
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
              return null
            }
            return null
          }
        }),
      )

      if (!active) {
        return
      }

      const next: Record<number, PollContextResponse> = {}
      entries.forEach((entry) => {
        if (entry) {
          next[entry[0]] = entry[1]
        }
      })
      setPollContexts(next)
    }

    void loadContexts()
    return () => {
      active = false
    }
  }, [livePollIds])

  const selectedPoll = useMemo<Poll | null>(() => {
    if (!selectedPollId) {
      return null
    }
    return mergedPolls.find((poll) => poll.poll_id === selectedPollId) ?? null
  }, [mergedPolls, selectedPollId])
  const selectedContext = selectedPoll ? pollContexts[selectedPoll.poll_id] : null

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!selectedPoll) {
        setResultCounts([])
        return
      }

      if (isDemoPoll(selectedPoll)) {
        setResultCounts(getDemoPollResults(selectedPoll.poll_id, selectedPoll.options.length))
        return
      }

      if (!activeAddress) {
        setResultCounts([])
        return
      }

      const counts = await Promise.all(
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

      setResultCounts(counts)
    }

    void load()
  }, [activeAddress, algodClient, selectedPoll, transactionSigner])

  const castVoteAction = async (): Promise<void> => {
    if (!selectedPoll) {
      enqueueSnackbar('Select a poll first.', { variant: 'warning' })
      return
    }

    if (votedPolls.includes(selectedPoll.poll_id)) {
      enqueueSnackbar('You already voted in this local session.', { variant: 'info' })
      return
    }

    if (isDemoPoll(selectedPoll)) {
      const counts = castDemoPollVote(selectedPoll.poll_id, selectedOption, selectedPoll.options.length)
      markLocalVote(selectedPoll.poll_id)
      setVotedPolls(getLocalVotes())
      setResultCounts(counts)
      const status = syntheticStatus()
      setTxStatus(status)
      appendSyntheticActivity({
        kind: 'vote_demo',
        title: `Demo vote recorded for poll #${selectedPoll.poll_id}`,
        description: `Selected option: ${selectedPoll.options[selectedOption]}`,
        actor: activeAddress ?? 'demo:student',
        tx_id: status.tx_id,
        tags: [`poll:${selectedPoll.poll_id}`],
      })
      enqueueSnackbar('Demo vote submitted locally. Live voting still uses Algorand tx flow.', { variant: 'success' })
      return
    }

    if (!activeAddress) {
      enqueueSnackbar('Connect wallet first for live poll voting.', { variant: 'warning' })
      return
    }

    setTxPending(true)
    try {
      const submission = await castVote(
        {
          algodClient,
          transactionSigner,
          sender: activeAddress,
          appId: selectedPoll.app_id,
        },
        selectedPoll.poll_id,
        selectedOption,
      )

      if (!submission.txId) {
        throw new Error('Vote submitted but tx id was not returned')
      }

      const tracked = await notifyTxLifecycle({
        txId: submission.txId,
        kind: 'vote',
        pendingLabel: `Vote submitted. Tracking ${submission.txId}`,
      })

      setTxStatus(tracked)
      if (tracked.status === 'confirmed') {
        markLocalVote(selectedPoll.poll_id)
        setVotedPolls(getLocalVotes())
        await polls.refresh()
      }
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Vote failed', { variant: 'error' })
    } finally {
      setTxPending(false)
    }
  }

  const pollStatus = selectedPoll
    ? isDemoPoll(selectedPoll)
      ? 'active'
      : computeRoundStatus(selectedPoll.start_round, selectedPoll.end_round, currentRound ?? undefined)
    : 'upcoming'

  const activePollCards = mergedPolls.filter((poll) => {
    if (isDemoPoll(poll)) {
      return true
    }
    return computeRoundStatus(poll.start_round, poll.end_round, currentRound ?? undefined) === 'active'
  })

  return (
    <div className="page-grid">
      <Card title="Voting Center" subtitle="Understand why each poll exists, then cast your vote.">
        <div className="poll-card-grid">
          {activePollCards.length === 0 ? (
            <EmptyState title="No active polls" body="There are currently no open voting polls." />
          ) : (
            activePollCards.map((poll) => (
              <article
                key={poll.poll_id}
                className={`poll-context-card ${selectedPollId === poll.poll_id ? 'selected' : ''}`}
              >
                <h4>#{poll.poll_id} {poll.question}</h4>
                <p>{pollContexts[poll.poll_id]?.purpose ?? demoPollPurpose[poll.poll_id] ?? 'This poll is part of ongoing governance and planning feedback.'}</p>
                {pollContexts[poll.poll_id] ? (
                  <small>
                    {pollContexts[poll.poll_id].category} · audience {pollContexts[poll.poll_id].audience}
                  </small>
                ) : null}
                <div className="inline-row">
                  <span className={`badge badge-${isDemoPoll(poll) ? 'warning' : 'success'}`}>{isDemoPoll(poll) ? 'Demo' : 'Live'}</span>
                  <button type="button" className="btn" onClick={() => setSelectedPollId(poll.poll_id)}>
                    Open Poll
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </Card>

      <Card title="All Polls" right={<button type="button" className="btn btn-ghost" onClick={() => void polls.refresh()}>Refresh</button>}>
        {polls.loading ? <LoadingSkeleton rows={4} /> : null}
        {polls.error ? <p className="error-text">{polls.error}</p> : null}

        {mergedPolls.length > 0 ? (
          <div className="list-select">
            <label htmlFor="poll-select">Poll</label>
            <select
              id="poll-select"
              value={selectedPollId ?? ''}
              onChange={(event) => {
                setSelectedPollId(Number(event.target.value))
                setSelectedOption(0)
              }}
            >
              {mergedPolls.map((poll) => (
                <option key={poll.poll_id} value={poll.poll_id}>
                  #{poll.poll_id} - {poll.question} {isDemoPoll(poll) ? '(demo)' : ''}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </Card>

      {selectedPoll ? (
        <Card
          title={`Poll #${selectedPoll.poll_id}`}
          right={<StatusPill label={pollStatus} tone={pollStatus === 'active' ? 'success' : pollStatus === 'upcoming' ? 'info' : 'warning'} />}
        >
          <p>{selectedPoll.question}</p>
          <p className="muted-text">
            {selectedContext?.purpose ?? demoPollPurpose[selectedPoll.poll_id] ?? 'Participation helps improve campus-level decision quality.'}
          </p>
          <div className="kv">
            <span>Type</span>
            <span>{isDemoPoll(selectedPoll) ? 'Synthetic demo poll' : 'Live Algorand poll'}</span>
          </div>
          {selectedContext ? (
            <>
              <div className="kv">
                <span>Audience</span>
                <span>{selectedContext.audience}</span>
              </div>
              <div className="kv">
                <span>Category</span>
                <span>{selectedContext.category}</span>
              </div>
              {selectedContext.extra_note ? (
                <div className="kv">
                  <span>Note</span>
                  <span>{selectedContext.extra_note}</span>
                </div>
              ) : null}
            </>
          ) : null}
          <div className="kv">
            <span>Start round</span>
            <span>{selectedPoll.start_round}</span>
          </div>
          <div className="kv">
            <span>End round</span>
            <span>{selectedPoll.end_round}</span>
          </div>
          <div className="kv">
            <span>Already voted</span>
            <span>{votedPolls.includes(selectedPoll.poll_id) ? 'Yes' : 'No'}</span>
          </div>

          <div className="option-list">
            {selectedPoll.options.map((option, idx) => (
              <label key={option} className="option-item">
                <input
                  type="radio"
                  checked={selectedOption === idx}
                  onChange={() => setSelectedOption(idx)}
                  disabled={pollStatus !== 'active' || votedPolls.includes(selectedPoll.poll_id) || txPending}
                />
                <span>{option}</span>
              </label>
            ))}
          </div>

          <div className="inline-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void castVoteAction()}
              disabled={pollStatus !== 'active' || votedPolls.includes(selectedPoll.poll_id) || txPending}
            >
              {txPending ? 'Submitting...' : isDemoPoll(selectedPoll) ? 'Cast Demo Vote' : 'Cast Live Vote'}
            </button>
            <Link className="btn btn-ghost" to={`/activity?pollId=${selectedPoll.poll_id}`}>
              View Audit
            </Link>
            <CopyButton
              value={`${window.location.origin}/student/voting?pollId=${selectedPoll.poll_id}`}
              label="Share Poll"
            />
          </div>
        </Card>
      ) : null}

      {selectedPoll ? (
        <Card title="Results">
          <div className="inline-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const turnout = resultCounts.reduce((sum, count) => sum + count, 0)
                downloadJson(`student-poll-${selectedPoll.poll_id}-results.json`, {
                  poll_id: selectedPoll.poll_id,
                  question: selectedPoll.question,
                  options: selectedPoll.options,
                  counts: resultCounts,
                  turnout,
                })
              }}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const turnout = resultCounts.reduce((sum, count) => sum + count, 0)
                const rows = selectedPoll.options.map((option, idx) => {
                  const votes = resultCounts[idx] ?? 0
                  const share = turnout === 0 ? 0 : Math.round((votes / turnout) * 100)
                  return [option, votes, share]
                })
                downloadCsv(`student-poll-${selectedPoll.poll_id}-results.csv`, ['option', 'votes', 'share_percent'], rows)
              }}
            >
              Export CSV
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Votes</th>
                </tr>
              </thead>
              <tbody>
                {selectedPoll.options.map((option, idx) => (
                  <tr key={option}>
                    <td>{option}</td>
                    <td>{resultCounts[idx] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <TxStatus tx={txStatus} loading={txPending} />
    </div>
  )
}
