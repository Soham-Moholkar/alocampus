import { Link } from 'react-router-dom'

import { Card } from '../../components/Card'
import { LoadingSkeleton } from '../../components/LoadingSkeleton'
import { useAsyncData } from '../../hooks/useAsyncData'
import { apiRequest, withQuery } from '../../lib/api'
import { endpoints } from '../../lib/endpoints'
import type { AnalyticsSummary, DemoUserProfile, SystemHealthResponse } from '../../types/api'

import roleAdmin from '../../assets/ui/role-admin.svg'
import roleFaculty from '../../assets/ui/role-faculty.svg'
import roleStudent from '../../assets/ui/role-student.svg'

export const LandingPage = () => {
  const analytics = useAsyncData(() => apiRequest<AnalyticsSummary>(endpoints.analyticsSummary, { auth: false }), [])
  const health = useAsyncData(() => apiRequest<SystemHealthResponse>(endpoints.systemHealth, { auth: false }), [])
  const students = useAsyncData(
    () => apiRequest<DemoUserProfile[]>(withQuery(endpoints.demoAuthUsers, { role: 'student' }), { auth: false }),
    [],
  )
  const faculty = useAsyncData(
    () => apiRequest<DemoUserProfile[]>(withQuery(endpoints.demoAuthUsers, { role: 'faculty' }), { auth: false }),
    [],
  )

  return (
    <div className="page-grid landing-grid">
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="workspace-kicker">AlgoKit + Algorand LocalNet</p>
          <h1>AlgoCampus</h1>
          <p>
            A local-first academic platform for voting, attendance, certificates, and audit trails with deterministic
            on-chain verifiability.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/connect">
              Enter Platform
            </Link>
            <Link className="btn" to="/verify/certificate">
              Verify Certificate
            </Link>
          </div>
        </div>
        <div className="landing-visual">
          <img src={roleStudent} alt="Student role" />
          <img src={roleFaculty} alt="Faculty role" />
          <img src={roleAdmin} alt="Admin role" />
        </div>
      </section>

      <section className="metric-strip metric-strip-four">
        <div className="metric-tile metric-indigo">
          <span className="metric-label">Total Polls</span>
          <strong className="metric-value">{analytics.data?.total_polls ?? '--'}</strong>
          <p>Indexer + BFF summary</p>
        </div>
        <div className="metric-tile metric-teal">
          <span className="metric-label">Attendance Check-ins</span>
          <strong className="metric-value">{analytics.data?.total_checkins ?? '--'}</strong>
          <p>LocalNet confirmation tracked</p>
        </div>
        <div className="metric-tile metric-amber">
          <span className="metric-label">Seeded Students</span>
          <strong className="metric-value">{students.data?.length ?? '--'}</strong>
          <p>Credential demo dataset</p>
        </div>
        <div className="metric-tile metric-violet">
          <span className="metric-label">Seeded Faculty</span>
          <strong className="metric-value">{faculty.data?.length ?? '--'}</strong>
          <p>Role login dataset</p>
        </div>
      </section>

      <Card title="Core Modules" subtitle="Built on ARC-4 contracts + FastAPI orchestration.">
        <div className="card-grid three">
          <article className="mini-card">
            <strong>Voting & Polling</strong>
            <p>Faculty/admin create polls on-chain; students vote with one-address deduplication.</p>
          </article>
          <article className="mini-card">
            <strong>Attendance</strong>
            <p>Session windows and check-ins with tx tracking, records, and faculty overrides.</p>
          </article>
          <article className="mini-card">
            <strong>Certificates</strong>
            <p>Mint/register certificate proofs and verify by hash using public verification routes.</p>
          </article>
        </div>
      </Card>

      <Card title="Technology Stack" subtitle="Everything runs local; no external runtime dependency required.">
        <div className="card-grid three">
          <article className="mini-card">
            <strong>Algorand LocalNet</strong>
            <p>algod + indexer + kmd containers managed via AlgoKit.</p>
          </article>
          <article className="mini-card">
            <strong>FastAPI BFF</strong>
            <p>JWT auth, demo-auth, activity feed, AI orchestration, and certificate metadata serving.</p>
          </article>
          <article className="mini-card">
            <strong>React + Typed Clients</strong>
            <p>Role dashboards with generated contract clients under <code>src/contracts</code>.</p>
          </article>
        </div>
      </Card>

      <Card title="How It Works" subtitle="Role login first, wallet auth second, chain writes guarded by JWT role.">
        <ol className="timeline">
          <li>
            <strong>1. Choose role and credentials</strong>
            <span>Use seeded demo users for student/faculty/admin entry.</span>
          </li>
          <li>
            <strong>2. Dashboard opens immediately</strong>
            <span>Role preview session starts for non-protected operations.</span>
          </li>
          <li>
            <strong>3. Wallet sign-in auto-attempts</strong>
            <span>Nonce-sign JWT auth runs in background for protected chain writes.</span>
          </li>
          <li>
            <strong>4. Verify proof and activity</strong>
            <span>Audit events, tx tracking, and cert verify remain backend-first.</span>
          </li>
        </ol>
      </Card>

      <Card title="Platform Health">
        {health.loading ? <LoadingSkeleton rows={3} compact /> : null}
        {health.data ? (
          <>
            <div className="kv">
              <span>Status</span>
              <span>{health.data.status}</span>
            </div>
            <div className="kv">
              <span>DB</span>
              <span>{health.data.db.status}</span>
            </div>
            <div className="kv">
              <span>Algod / Indexer / KMD</span>
              <span>
                {health.data.algod.status} / {health.data.indexer.status} / {health.data.kmd.status}
              </span>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  )
}

