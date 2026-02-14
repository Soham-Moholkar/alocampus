import { useEffect, useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { WalletProvider } from '@txnlab/use-wallet-react'

import { App } from './App'
import { AuthProvider } from './context/AuthContext'
import { DemoModeProvider } from './context/DemoModeContext'
import { PreviewProvider } from './context/PreviewContext'
import { validateConfig } from './lib/config'
import { getWalletManager } from './lib/wallet'
import { ConfigMissingPage } from './pages/shared/ConfigMissingPage'

import './styles.css'

const Providers = () => {
  const walletManager = useMemo(() => getWalletManager(), [])

  useEffect(() => {
    void walletManager.resumeSessions()
  }, [walletManager])

  return (
    <WalletProvider manager={walletManager}>
      <SnackbarProvider maxSnack={4} autoHideDuration={3500}>
        <BrowserRouter>
          <AuthProvider>
            <PreviewProvider>
              <DemoModeProvider>
                <App />
              </DemoModeProvider>
            </PreviewProvider>
          </AuthProvider>
        </BrowserRouter>
      </SnackbarProvider>
    </WalletProvider>
  )
}

const AppRoot = () => {
  const validation = validateConfig()
  if (!validation.ok) {
    return <ConfigMissingPage missing={validation.missing} />
  }
  return <Providers />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<AppRoot />)
