import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ScopeType, useWallet } from '@txnlab/use-wallet-react'
import { useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'

import { ApiError, apiRequest, configureApiAuth } from '../lib/api'
import { endpoints } from '../lib/endpoints'
import { clearDemoAuthToken, clearPreviewSession, clearSession, loadSession, saveSession } from '../lib/storage'
import { toBase64 } from '../lib/utils'
import type { MeResponse, NonceResponse, Role, VerifyResponse } from '../types/api'

interface AuthContextValue {
  isLoading: boolean
  isAuthenticated: boolean
  jwt: string | null
  role: Role | null
  address: string | null
  wallets: ReturnType<typeof useWallet>['wallets']
  activeAddress: string | null
  activeWalletId: string | null
  connectWallet: (walletId: string) => Promise<void>
  disconnectWallet: () => Promise<void>
  signIn: (options?: { redirect?: boolean; clearPreview?: boolean; notify?: boolean }) => Promise<MeResponse>
  logout: (reason?: string, redirectToConnect?: boolean) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const nonceMessage = (nonce: string): string => `AlgoCampus auth nonce: ${nonce}`

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const {
    wallets,
    activeAddress,
    activeWallet,
    signData,
  } = useWallet()

  const [jwt, setJwt] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const jwtRef = useRef<string | null>(null)
  const unauthorizedToastAt = useRef(0)

  const logout = useCallback(
    async (reason?: string, redirectToConnect = true): Promise<void> => {
      clearSession()
      clearDemoAuthToken()
      setJwt(null)
      setRole(null)
      setAddress(null)
      jwtRef.current = null

      if (reason) {
        enqueueSnackbar(reason, { variant: 'warning' })
      }

      if (redirectToConnect) {
        navigate('/connect', { replace: true })
      }
    },
    [enqueueSnackbar, navigate],
  )

  const refreshProfile = useCallback(async (): Promise<void> => {
    const profile = await apiRequest<MeResponse>(endpoints.me)
    setRole(profile.role)
    setAddress(profile.address)
    if (jwtRef.current) {
      saveSession(jwtRef.current, profile.role, profile.address)
    }
  }, [])

  useEffect(() => {
    configureApiAuth(
      () => jwtRef.current,
      () => {
        const now = Date.now()
        if (now - unauthorizedToastAt.current < 2500) {
          return
        }
        unauthorizedToastAt.current = now
        void logout('Session expired. Please sign in again.', true)
      },
    )
  }, [logout])

  useEffect(() => {
    let mounted = true

    const bootstrap = async (): Promise<void> => {
      setIsLoading(true)
      const session = loadSession()
      if (!session.jwt || !session.role || !session.address) {
        if (mounted) {
          setIsLoading(false)
        }
        return
      }

      setJwt(session.jwt)
      setRole(session.role)
      setAddress(session.address)
      jwtRef.current = session.jwt

      try {
        await refreshProfile()
      } catch {
        await logout(undefined, false)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      mounted = false
    }
  }, [logout, refreshProfile])

  const connectWallet = useCallback(
    async (walletId: string): Promise<void> => {
      const wallet = wallets.find((entry) => entry.id === walletId)
      if (!wallet) {
        throw new Error('Selected wallet is unavailable')
      }
      await wallet.connect()
      wallet.setActive()
    },
    [wallets],
  )

  const disconnectWallet = useCallback(async (): Promise<void> => {
    if (activeWallet?.isConnected) {
      await activeWallet.disconnect()
    }
    await logout('Wallet disconnected', true)
  }, [activeWallet, logout])

  const signIn = useCallback(async (
    options?: { redirect?: boolean; clearPreview?: boolean; notify?: boolean },
  ): Promise<MeResponse> => {
    const redirect = options?.redirect ?? true
    const clearPreview = options?.clearPreview ?? true
    const notify = options?.notify ?? true

    if (!activeAddress) {
      throw new Error('Connect wallet first')
    }

    const nonceRes = await apiRequest<NonceResponse>(endpoints.authNonce, {
      method: 'POST',
      body: { address: activeAddress },
      auth: false,
    })

    const message = nonceMessage(nonceRes.nonce)
    let signResult
    try {
      signResult = await signData(message, {
        scope: ScopeType.AUTH,
        encoding: 'utf-8',
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown signing error'
      throw new Error(`Message signing failed: ${reason}`)
    }

    const signature = toBase64(signResult.signature)

    const verifyRes = await apiRequest<VerifyResponse>(endpoints.authVerify, {
      method: 'POST',
      body: {
        address: activeAddress,
        nonce: nonceRes.nonce,
        signature,
      },
      auth: false,
    })

    setJwt(verifyRes.jwt)
    jwtRef.current = verifyRes.jwt
    if (clearPreview) {
      clearPreviewSession()
    }

    const profile = await apiRequest<MeResponse>(endpoints.me)
    setRole(profile.role)
    setAddress(profile.address)

    saveSession(verifyRes.jwt, profile.role, profile.address)
    if (notify) {
      enqueueSnackbar('Signed in successfully', { variant: 'success' })
    }

    if (redirect) {
      if (profile.role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else if (profile.role === 'faculty') {
        navigate('/faculty/dashboard', { replace: true })
      } else {
        navigate('/student/dashboard', { replace: true })
      }
    }

    return profile
  }, [activeAddress, enqueueSnackbar, navigate, signData])

  useEffect(() => {
    if (!activeWallet || !activeWallet.isConnected) {
      return
    }
    if (!activeAddress) {
      enqueueSnackbar('Wallet connected but no active account selected.', {
        variant: 'warning',
      })
    }
  }, [activeAddress, activeWallet, enqueueSnackbar])

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: Boolean(jwt && role && address),
      jwt,
      role,
      address,
      wallets,
      activeAddress,
      activeWalletId: activeWallet?.id ?? null,
      connectWallet,
      disconnectWallet,
      signIn,
      logout,
      refreshProfile,
    }),
    [
      activeAddress,
      activeWallet?.id,
      address,
      connectWallet,
      disconnectWallet,
      isLoading,
      jwt,
      logout,
      refreshProfile,
      role,
      signIn,
      wallets,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}

export const isApiError = (err: unknown): err is ApiError => err instanceof ApiError
