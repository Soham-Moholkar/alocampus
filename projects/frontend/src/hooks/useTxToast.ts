import { useCallback } from 'react'
import { useSnackbar } from 'notistack'

import { getTxStatus, registerTx } from '../lib/tx'
import type { TxKind, TxStatus } from '../types/api'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

interface NotifyInput {
  txId: string
  kind: TxKind
  pendingLabel?: string
}

export const useTxToast = () => {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar()

  const notifyTxLifecycle = useCallback(
    async ({ txId, kind, pendingLabel }: NotifyInput): Promise<TxStatus> => {
      const pendingKey = enqueueSnackbar(pendingLabel ?? `Tracking tx ${txId}`, {
        variant: 'info',
        persist: true,
      })

      await registerTx(txId, kind)
      let latest: TxStatus = {
        tx_id: txId,
        kind,
        status: 'pending',
      }

      for (let i = 0; i < 25; i += 1) {
        await sleep(2000)
        latest = await getTxStatus(txId)
        if (latest.status === 'confirmed' || latest.status === 'failed') {
          break
        }
      }

      closeSnackbar(pendingKey)

      if (latest.status === 'confirmed') {
        enqueueSnackbar(`Transaction confirmed: ${txId}`, {
          variant: 'success',
        })
      } else if (latest.status === 'failed') {
        enqueueSnackbar(`Transaction failed: ${txId}`, {
          variant: 'error',
        })
      } else {
        enqueueSnackbar(`Transaction still pending: ${txId}`, {
          variant: 'warning',
        })
      }

      return latest
    },
    [closeSnackbar, enqueueSnackbar],
  )

  return { notifyTxLifecycle }
}
