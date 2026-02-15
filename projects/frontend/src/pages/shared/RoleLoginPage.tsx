import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useSnackbar } from 'notistack'

import { useAuth } from '../../context/AuthContext'
import { usePreview } from '../../context/PreviewContext'
import { apiRequest } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import { saveDemoAuthToken, saveRoleEntryProfile } from '../../lib/storage'
import type { DemoAuthLoginResponse, Role } from '../../types/api'

import roleAdmin from '../../assets/ui/role-admin.svg'
import roleFaculty from '../../assets/ui/role-faculty.svg'
import roleStudent from '../../assets/ui/role-student.svg'

const roleHome: Record<Role, string> = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  admin: '/admin/dashboard',
}

const roleImage: Record<Role, string> = {
  student: roleStudent,
  faculty: roleFaculty,
  admin: roleAdmin,
}

const roleDefaults: Record<Role, { username: string; password: string }> = {
  student: { username: 'student01', password: 'AlgoCampus@123' },
  faculty: { username: 'faculty01', password: 'AlgoCampus@123' },
  admin: { username: 'admin01', password: 'AlgoCampus@123' },
}

const parseRole = (value: string | undefined): Role | null => {
  if (value === 'student' || value === 'faculty' || value === 'admin') {
    return value
  }
  return null
}

export const RoleLoginPage = () => {
  const navigate = useNavigate()
  const { enqueueSnackbar } = useSnackbar()
  const params = useParams<{ role: string }>()
  const role = parseRole(params.role)
  const preview = usePreview()
  const {
    isLoading,
    isAuthenticated,
    wallets,
    connectWallet,
    signIn,
  } = useAuth()

  const walletOptions = useMemo(
    () => wallets.map((wallet) => ({ id: wallet.id, label: wallet.metadata.name })),
    [wallets],
  )

  const defaults = role ? roleDefaults[role] : roleDefaults.student
  const [username, setUsername] = useState(defaults.username)
  const [password, setPassword] = useState(defaults.password)
  const [rememberMe, setRememberMe] = useState(true)
  const [selectedWallet, setSelectedWallet] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setUsername(defaults.username)
    setPassword(defaults.password)
  }, [defaults.password, defaults.username])

  if (!role) {
    return <Navigate to="/connect" replace />
  }

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

  const autoEnableLiveChainAccess = async (): Promise<void> => {
    const walletId = selectedWallet || walletOptions[0]?.id
    if (!walletId) {
      enqueueSnackbar('No wallet provider found. Start LocalNet and refresh.', { variant: 'warning' })
      return
    }

    try {
      await connectWallet(walletId)
      await signIn({ redirect: false, clearPreview: false, notify: false })
      enqueueSnackbar('Live chain access enabled in background.', { variant: 'success' })
    } catch (err) {
      enqueueSnackbar(
        err instanceof Error
          ? err.message
          : 'Wallet sign-in failed. You are in role mode; protected writes remain disabled.',
        { variant: 'warning' },
      )
    }
  }

  const submit = async (): Promise<void> => {
    if (!username.trim() || !password.trim()) {
      enqueueSnackbar('Username and password are required.', { variant: 'warning' })
      return
    }

    setBusy(true)
    try {
      const response = await apiRequest<DemoAuthLoginResponse>(endpoints.demoAuthLogin, {
        method: 'POST',
        auth: false,
        body: {
          role,
          username: username.trim(),
          password,
          remember_me: rememberMe,
        },
      })

      saveDemoAuthToken(response.demo_token)
      preview.enterPreview(role)
      saveRoleEntryProfile({
        role,
        displayName: response.profile.display_name,
        identifier: response.profile.identifier,
        updatedAt: Date.now(),
      })

      enqueueSnackbar(`Logged in as ${response.profile.display_name}`, { variant: 'success' })
      navigate(roleHome[role], { replace: true })
      void autoEnableLiveChainAccess()
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Credential login failed', { variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card auth-card-wide login-shell">
        <div className="login-hero">
          <img src={roleImage[role]} alt={`${role} role`} />
          <div>
            <h1>{role.toUpperCase()} Login</h1>
            <p>Enter credentials to open the {role} dashboard. Wallet live-chain sign-in starts automatically after login.</p>
          </div>
        </div>

        <div className="form-grid">
          <label htmlFor="demo-username">Username or ID</label>
          <input
            id="demo-username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder={defaults.username}
          />

          <label htmlFor="demo-password">Password</label>
          <input
            id="demo-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
          />

          <label htmlFor="demo-wallet">Wallet Provider (for auto live chain)</label>
          <select id="demo-wallet" value={selectedWallet} onChange={(event) => setSelectedWallet(event.target.value)}>
            <option value="">auto-select default</option>
            {walletOptions.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.label}
              </option>
            ))}
          </select>

          <label className="inline-row">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span>Remember this role login</span>
          </label>

          <div className="inline-row">
            <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
              {busy ? 'Signing in...' : 'Sign In'}
            </button>
            <Link className="btn btn-ghost" to="/connect">
              Back
            </Link>
          </div>
        </div>

        <div className="status-block">
          <strong>Local demo credentials</strong>
          <p>
            Try <code>{defaults.username}</code> with password <code>{defaults.password}</code>.
          </p>
        </div>
      </section>
    </div>
  )
}
