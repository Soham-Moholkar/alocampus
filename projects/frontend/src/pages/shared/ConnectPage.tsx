import { Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../../context/AuthContext'
import type { Role } from '../../types/api'

import roleAdmin from '../../assets/ui/role-admin.svg'
import roleFaculty from '../../assets/ui/role-faculty.svg'
import roleStudent from '../../assets/ui/role-student.svg'

const roleImage: Record<Role, string> = {
  student: roleStudent,
  faculty: roleFaculty,
  admin: roleAdmin,
}

const roleSummary: Record<Role, string> = {
  student: 'Learner dashboard with voting, attendance, and certificate views.',
  faculty: 'Academic operations workspace for polls, sessions, and certificates.',
  admin: 'Platform governance console for roles, audits, and system oversight.',
}

export const ConnectPage = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuth()

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

  return (
    <div className="auth-page">
      <section className="auth-card auth-card-wide role-select-shell">
        <div className="auth-intro">
          <h1>Select Your Portal</h1>
          <p>Choose a role to continue to credential login. Live chain wallet sign-in will auto-attempt after role login.</p>
        </div>

        <div className="role-card-grid role-card-grid-large">
          {(['student', 'faculty', 'admin'] as Role[]).map((role) => (
            <article key={role} className="role-card role-card-image role-select-card">
              <img src={roleImage[role]} alt={`${role} role`} />
              <h4>{role.toUpperCase()}</h4>
              <p>{roleSummary[role]}</p>
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/login/${role}`)}>
                Continue as {role}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

