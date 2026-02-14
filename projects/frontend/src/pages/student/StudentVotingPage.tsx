import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { getLocalVotes, markLocalVote } from '../../lib/storage'
import type { Poll, PollListResponse, TxStatus as TxStatusModel } from '../../types/api'

export const StudentVotingPage = () => {
  const { enqueueSnackbar } = useSnackbar()
  const { currentRound } = useCurrentRound()
  const { notifyTxLifecycle } = useTxToast()
  const { algodClient, transactionSigner, activeAddress } = useWallet()

  const [selectedPollId, setSelectedPollId] = useState<number | null>(null)
  const [selectedOption, setSelectedOption] = useState<number>(0)
  const [resultCounts, setResultCounts] = useState<number[]>([])
  const [votedPolls, setVotedPolls] = useState<number[]>(() => getLocalVotes())
  const [txStatus, setTxStatus] = useState<TxStatusModel | null>(null)
  const [txPending, setTxPending] = useState(false)

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

  useEffect(() => {
    const load = async (): Promise<void> => {
      if (!selectedPoll || !activeAddress) {
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
    if (!selectedPoll || !activeAddress) {
      enqueueSnackbar('Select a poll and connect wallet first.', { variant: 'warning' })
      return
    }

    if (votedPolls.includes(selectedPoll.poll_id)) {
      enqueueSnackbar('You already voted in this local session.', { variant: 'info' })
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
    ? computeRoundStatus(selectedPoll.start_round, selectedPoll.end_round, currentRound ?? undefined)
    : 'upcoming'

  return (
    <div className="page-grid">
      <Card title="Active Polls" right={<button type="button" className="btn btn-ghost" onClick={() => void polls.refresh()}>Refresh</button>}>
        {polls.loading ? <LoadingSkeleton rows={4} /> : null}
        {polls.error ? <p className="error-text">{polls.error}</p> : null}

        {!polls.loading && polls.data && polls.data.count === 0 ? (
          <EmptyState title="No polls yet" body="Faculty has not created any polls." />
        ) : null}

        {!polls.loading && polls.data && polls.data.count > 0 ? (
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
              {polls.data.polls.map((poll) => (
                <option key={poll.poll_id} value={poll.poll_id}>
                  #{poll.poll_id} - {poll.question}
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
              {txPending ? 'Submitting...' : 'Cast Vote'}
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
