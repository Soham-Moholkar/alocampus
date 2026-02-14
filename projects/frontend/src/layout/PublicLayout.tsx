import { Link, Outlet } from 'react-router-dom'

import campusIcon from '../assets/ui/icon-campus.svg'

export const PublicLayout = () => (
  <div className="public-layout hybrid-public">
    <header className="public-header">
      <div className="public-brand">
        <img src={campusIcon} alt="AlgoCampus" />
        <div>
          <h1>AlgoCampus</h1>
          <p>Certificate verification and public proof view</p>
        </div>
      </div>
      <Link className="btn btn-primary" to="/connect">
        Connect Wallet
      </Link>
    </header>
    <main className="public-content">
      <Outlet />
    </main>
  </div>
)
