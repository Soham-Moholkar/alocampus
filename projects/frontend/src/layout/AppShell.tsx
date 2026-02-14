import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useDemoMode } from '../context/DemoModeContext'
import { shortenAddress } from '../lib/utils'
import { roleNav } from './nav'
import { CopyButton } from '../components/CopyButton'

export const AppShell = () => {
  const { role, address, logout } = useAuth()
  const { enabled, toggle } = useDemoMode()
  const [open, setOpen] = useState(false)

  const navItems = role ? roleNav[role] : []

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <h1>AlgoCampus</h1>
          <button type="button" className="btn btn-ghost mobile-only" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="left">
            <button type="button" className="btn btn-ghost mobile-only" onClick={() => setOpen(true)}>
              Menu
            </button>
            <span className={`badge badge-role badge-${role ?? 'neutral'}`}>{role ?? 'guest'}</span>
            <code>{shortenAddress(address)}</code>
            {address ? <CopyButton value={address} label="Copy" /> : null}
          </div>
          <div className="right">
            <button type="button" className={`btn ${enabled ? 'btn-primary' : 'btn-ghost'}`} onClick={toggle}>
              Demo Mode: {enabled ? 'On' : 'Off'}
            </button>
            <button type="button" className="btn" onClick={() => void logout(undefined, true)}>
              Logout
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
