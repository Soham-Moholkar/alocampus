import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useSnackbar } from 'notistack'

import { useAuth } from '../../context/AuthContext'
import { usePreview } from '../../context/PreviewContext'
import { demoProfiles } from '../../lib/demoData'
import {
  clearRoleEntryProfile,
  loadRoleEntryProfile,
  saveRoleEntryProfile,
} from '../../lib/storage'
import type { Role } from '../../types/api'

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

export const ConnectPage = () => {
  const navigate = useNavigate()
  const {
    isAuthenticated,
    isLoading,
    wallets,
    connectWallet,
    signIn,
  } = useAuth()
  const preview = usePreview()
  const { enqueueSnackbar } = useSnackbar()

  const [savedProfile, setSavedProfile] = useState(() => loadRoleEntryProfile())
  const [selectedWallet, setSelectedWallet] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [displayName, setDisplayName] = useState(savedProfile?.displayName ?? '')
  const [identifier, setIdentifier] = useState(savedProfile?.identifier ?? '')

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

  const autoEnableLiveChainAccess = async (): Promise<void> => {
    const walletId = selectedWallet || walletOptions[0]?.id
    if (!walletId) {
      enqueueSnackbar('No wallet provider found. Start LocalNet and refresh.', { variant: 'warning' })
      return
    }

    try {
      await connectWallet(walletId)
      await signIn({ redirect: false, clearPreview: false, notify: false })
      enqueueSnackbar('Live chain access enabled.', { variant: 'success' })
    } catch (err) {
      enqueueSnackbar(err instanceof Error ? err.message : 'Live chain access failed. Continuing in role mode.', {
        variant: 'warning',
      })
    }
  }

  const enterPreviewRole = async (role: Role): Promise<void> => {
    if (!displayName.trim() || !identifier.trim()) {
      enqueueSnackbar('Enter your name and ID before selecting a role.', { variant: 'warning' })
      return
    }

    setBusy(true)
    try {
      preview.enterPreview(role)
      const nextProfile = {
        role,
        displayName: displayName.trim(),
        identifier: identifier.trim(),
        updatedAt: Date.now(),
      }
      saveRoleEntryProfile(nextProfile)
      setSavedProfile(nextProfile)

      await autoEnableLiveChainAccess()

      enqueueSnackbar(`Signed in as ${role} (${displayName.trim()})`, { variant: 'success' })
      navigate(roleHome[role], { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card auth-card-wide auth-grid">
        <div className="auth-intro">
          <h1>AlgoCampus Login</h1>
          <p>Select your role, enter your details, and continue. Live chain access is enabled automatically in the background.</p>
        </div>

        <div className="card auth-block">
          <div className="card-header">
            <div className="card-heading">
              <h3>Role-Based Entry</h3>
              <p>This is the default user flow for role dashboards and live LocalNet access.</p>
            </div>
          </div>

          <div className="form-grid">
            <label htmlFor="display-name">Full Name</label>
            <input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="e.g. XYZ Student"
            />

            <label htmlFor="identifier">Registration / Employee ID</label>
            <input
              id="identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="e.g. 12413287 or FAC-0091"
            />
          </div>

          <div className="role-card-grid">
            {(Object.keys(demoProfiles) as Role[]).map((role) => {
              const profile = demoProfiles[role]
              return (
                <article key={role} className="role-card role-card-image">
                  <img src={roleImage[role]} alt={`${role} role`} />
                  <h4>{role.toUpperCase()}</h4>
                  <p>{profile.department}</p>
                  <small>{role === 'student' ? 'Learner dashboard' : role === 'faculty' ? 'Academic operations' : 'Platform governance'}</small>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void enterPreviewRole(role)}>
                    Enter {role}
                  </button>
                </article>
              )
            })}
          </div>

          {savedProfile ? (
            <div className="inline-row">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDisplayName(savedProfile.displayName)
                  setIdentifier(savedProfile.identifier)
                  enqueueSnackbar('Loaded previously used details.', { variant: 'info' })
                }}
              >
                Use Last Saved Details
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  clearRoleEntryProfile()
                  setSavedProfile(null)
                  enqueueSnackbar('Saved details cleared.', { variant: 'info' })
                }}
              >
                Clear Saved Details
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
