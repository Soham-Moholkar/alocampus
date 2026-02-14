import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import {
  Vote,
  ClipboardCheck,
  Award,
  Shield,
  ArrowRight,
  Blocks,
  GraduationCap,
  UserCog,
  BookOpen,
} from 'lucide-react';

const features = [
  {
    icon: Vote,
    title: 'Verifiable Voting',
    desc: 'On-chain polls with one-address-one-vote enforcement. Every vote is transparent and tamper-proof.',
    color: 'text-primary-light',
    bg: 'bg-primary/10',
  },
  {
    icon: ClipboardCheck,
    title: 'Attendance Tracking',
    desc: 'Blockchain-backed check-ins with round-window constraints. No proxy attendance possible.',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    icon: Award,
    title: 'NFT Certificates',
    desc: 'ARC-3 compliant NFTs minted on Algorand. Verifiable forever, owned by recipients.',
    color: 'text-accent-light',
    bg: 'bg-accent/10',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    desc: 'On-chain role enforcement. Admins, faculty, and students each have dedicated permissions.',
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
];

const stats = [
  { label: 'Smart Contracts', value: '3' },
  { label: 'On-Chain Features', value: '10+' },
  { label: 'Zero PII On-Chain', value: '100%' },
  { label: 'Trust Required', value: '0' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-dark">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 glass-strong">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            <span className="text-lg font-bold text-text">AlgoCampus</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="outline" size="sm">
                Connect Wallet
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary-light text-sm font-medium mb-6">
            <Blocks className="w-4 h-4" />
            Built on Algorand
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-text leading-tight mb-6">
            Campus Operations,{' '}
            <span className="bg-gradient-to-r from-primary-light to-accent-light bg-clip-text text-transparent">
              Blockchain Verified
            </span>
          </h1>

          <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10">
            Fair voting, tamper-proof attendance, and verifiable certificates — all powered by
            Algorand smart contracts. No central authority needed.
          </p>
        </div>
      </section>

      {/* Login Role Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-xl font-semibold text-text-secondary mb-8">
            Choose how you want to sign in
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Student Card */}
            <Link to="/login?role=student" className="group">
              <div className="bg-card border border-border rounded-2xl p-8 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 h-full">
                <div className="inline-flex p-4 rounded-xl bg-primary/10 mb-5">
                  <GraduationCap className="w-8 h-8 text-primary-light" />
                </div>
                <h3 className="text-xl font-bold text-text mb-2">Student</h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-6">
                  Vote in polls, check-in to attendance sessions, and view your NFT certificates.
                </p>
                <div className="flex items-center gap-2 text-primary-light text-sm font-medium group-hover:gap-3 transition-all">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>

            {/* Faculty Card */}
            <Link to="/login?role=faculty" className="group">
              <div className="bg-card border border-border rounded-2xl p-8 hover:border-success/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-success/5 h-full">
                <div className="inline-flex p-4 rounded-xl bg-success/10 mb-5">
                  <BookOpen className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-xl font-bold text-text mb-2">Faculty</h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-6">
                  Create polls & sessions, issue NFT certificates, and track student participation.
                </p>
                <div className="flex items-center gap-2 text-success text-sm font-medium group-hover:gap-3 transition-all">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>

            {/* Admin Card */}
            <Link to="/login?role=admin" className="group">
              <div className="bg-card border border-border rounded-2xl p-8 hover:border-warning/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-warning/5 h-full">
                <div className="inline-flex p-4 rounded-xl bg-warning/10 mb-5">
                  <UserCog className="w-8 h-8 text-warning" />
                </div>
                <h3 className="text-xl font-bold text-text mb-2">Admin</h3>
                <p className="text-sm text-text-secondary leading-relaxed mb-6">
                  Manage user roles, monitor system health & analytics, and full platform control.
                </p>
                <div className="flex items-center gap-2 text-warning text-sm font-medium group-hover:gap-3 transition-all">
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          </div>

          <p className="text-center text-xs text-text-muted mt-6">
            Roles are enforced on-chain. Your wallet address determines your permissions.
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-8 border-y border-border/50">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-text">{s.value}</p>
              <p className="text-sm text-text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-text mb-3">
              Decentralized Campus Infrastructure
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Every campus operation backed by Algorand smart contracts — transparent, verifiable, and trustless.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="group bg-card border border-border rounded-xl p-6 hover:border-primary/20 transition-all duration-200 hover:-translate-y-1"
              >
                <div className={`inline-flex p-3 rounded-lg ${f.bg} mb-4`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-text mb-2">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture section */}
      <section className="py-20 px-6 border-t border-border/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-text mb-4">How It Works</h2>
          <p className="text-text-secondary mb-12">
            Three-layer architecture: React frontend → FastAPI backend → Algorand smart contracts
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="text-3xl mb-3">🎨</div>
              <h4 className="font-semibold text-text mb-2">Frontend</h4>
              <p className="text-sm text-text-secondary">
                React dashboard with wallet authentication. Role-based views for students, faculty & admins.
              </p>
            </div>
            <div className="bg-card border border-primary/20 rounded-xl p-6">
              <div className="text-3xl mb-3">⚡</div>
              <h4 className="font-semibold text-text mb-2">Backend (BFF)</h4>
              <p className="text-sm text-text-secondary">
                FastAPI server handles JWT auth, caches data in SQLite, and orchestrates blockchain calls.
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="text-3xl mb-3">🔗</div>
              <h4 className="font-semibold text-text mb-2">Algorand</h4>
              <p className="text-sm text-text-secondary">
                Three ARC-4 smart contracts with box storage. All state is on-chain and publicly verifiable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span className="text-sm text-text-secondary">AlgoCampus &copy; 2025</span>
          </div>
          <p className="text-xs text-text-muted">
            Built for the Algorand x MLSC Hackathon — Track 2: AI and Automation in Blockchain
          </p>
        </div>
      </footer>
    </div>
  );
}
