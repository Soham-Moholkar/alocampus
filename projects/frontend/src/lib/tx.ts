import { apiRequest } from './api'
import { endpoints } from './endpoints'
import type { TrackTxRequestPayload, TxKind, TxStatus } from '../types/api'

interface TrackOptions {
  intervalMs?: number
  maxAttempts?: number
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

export const registerTx = async (
  txId: string,
  kind: TxKind,
  metadata?: Omit<TrackTxRequestPayload, 'tx_id' | 'kind'>,
): Promise<TxStatus> =>
  apiRequest<TxStatus>(endpoints.txTrack, {
    method: 'POST',
    body: {
      tx_id: txId,
      kind,
      ...(metadata ?? {}),
    },
  })

export const getTxStatus = async (txId: string): Promise<TxStatus> =>
  apiRequest<TxStatus>(endpoints.txStatus(txId), { auth: true })

export const trackTxToFinalState = async (
  txId: string,
  kind: TxKind,
  options: TrackOptions = {},
  metadata?: Omit<TrackTxRequestPayload, 'tx_id' | 'kind'>,
): Promise<TxStatus> => {
  await registerTx(txId, kind, metadata)
  const attempts = options.maxAttempts ?? 20
  const interval = options.intervalMs ?? 2000

  let last: TxStatus = {
    tx_id: txId,
    kind,
    status: 'pending',
  }

  for (let i = 0; i < attempts; i += 1) {
    await sleep(interval)
    last = await getTxStatus(txId)
    if (last.status === 'confirmed' || last.status === 'failed') {
      return last
    }
  }

  return last
}
