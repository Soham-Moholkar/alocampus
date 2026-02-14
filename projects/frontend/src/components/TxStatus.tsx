import { CopyButton } from './CopyButton'
import type { TxStatus as TxStatusModel } from '../types/api'

interface TxStatusProps {
  tx: TxStatusModel | null
  loading?: boolean
  title?: string
}

export const TxStatus = ({ tx, loading = false, title = 'Transaction Status' }: TxStatusProps) => {
  if (!tx && !loading) {
    return null
  }

  return (
    <div className="card tx-status">
      <div className="card-header">
        <h3>{title}</h3>
        {loading ? <span className="badge badge-pending">Pending</span> : null}
      </div>
      {tx ? (
        <>
          <div className="inline-row">
            <strong>TX ID</strong>
            <code>{tx.tx_id}</code>
            <CopyButton value={tx.tx_id} />
          </div>
          <div className="inline-row">
            <strong>Status</strong>
            <span className={`badge badge-${tx.status}`}>{tx.status}</span>
          </div>
          {tx.confirmed_round ? (
            <div className="inline-row">
              <strong>Round</strong>
              <span>{tx.confirmed_round}</span>
            </div>
          ) : null}
        </>
      ) : (
        <p>Waiting for transaction submission.</p>
      )}
    </div>
  )
}
