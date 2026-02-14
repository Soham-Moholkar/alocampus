import { Link, Outlet } from 'react-router-dom'

export const PublicLayout = () => (
  <div className="public-layout">
    <header className="public-header">
      <div>
        <h1>AlgoCampus</h1>
        <p>Certificate verification and public proof view</p>
      </div>
      <Link className="btn" to="/connect">
        Connect Wallet
      </Link>
    </header>
    <main className="public-content">
      <Outlet />
    </main>
  </div>
)
