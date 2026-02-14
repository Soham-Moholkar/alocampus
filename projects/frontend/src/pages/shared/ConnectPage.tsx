import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'

import { useAuth } from '../../context/AuthContext'

export const ConnectPage = () => {
  const {
    isAuthenticated,
    isLoading,
    wallets,
    activeAddress,
    activeWalletId,
    connectWallet,
    signIn,
    disconnectWallet,
  } = useAuth()
  const { enqueueSnackbar } = useSnackbar()
  const [selectedWallet, setSelectedWallet] = useState<string>('')
  const [busy, setBusy] = useState(false)

  const walletOptions = useMemo(
    () => wallets.map((wallet) => ({ id: wallet.id, label: wallet.metadata.name })),
    [wallets],
  )

  useEffect(() => {
    if (!selectedWallet && walletOptions.length > 0) {
      setSelectedWallet(walletOptions[0].id)
    }
  }, [selectedWallet, walletOptions])

  if (isLoading) {
    return (
      <div className="center-page">
        <p>Checking existing session...</p>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const onConnectAndSignIn = async (): Promise<void> => {
    if (!selectedWallet) {
      enqueueSnackbar('Select a wallet first.', { variant: 'warning' })
      return
    }

    setBusy(true)
    try {
      await connectWallet(selectedWallet)
      await signIn()
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Sign-in failed', {
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <h1>Connect Wallet</h1>
        <p>LocalNet login uses nonce signing against BFF auth endpoints.</p>

        <label htmlFor="wallet-select">Wallet</label>
        <select
          id="wallet-select"
          value={selectedWallet}
          onChange={(event) => setSelectedWallet(event.target.value)}
        >
          {walletOptions.map((wallet) => (
            <option key={wallet.id} value={wallet.id}>
              {wallet.label}
            </option>
          ))}
        </select>

        <div className="inline-row">
          <button type="button" className="btn btn-primary" onClick={() => void onConnectAndSignIn()} disabled={busy}>
            {busy ? 'Connecting...' : 'Connect + Sign In'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void disconnectWallet()}>
            Disconnect
          </button>
        </div>

        <div className="status-block">
          <p>
            <strong>Wallet status:</strong> {activeWalletId ?? 'none'}
          </p>
          <p>
            <strong>Active address:</strong> {activeAddress ?? 'not connected'}
          </p>
        </div>
      </section>
    </div>
  )
}
