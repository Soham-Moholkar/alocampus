import { useAuthStore } from '@/stores/auth';
import { useAnalytics, usePolls, useSessions, useCerts } from '@/hooks/useApi';
import { truncateAddress, formatDate } from '@/lib/utils';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { CardSkeleton } from '@/components/ui/Skeleton';
import {
  Vote,
  ClipboardCheck,
  Award,
  Shield,
  GraduationCap,
  UserCog,
  Plus,
  ArrowRight,
  Blocks,
  Hash,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { role, address } = useAuthStore();
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics();
  const { data: pollsData, isLoading: pollsLoading } = usePolls();
  const { data: sessionsData, isLoading: sessionsLoading } = useSessions();
  const { data: certsData, isLoading: certsLoading } = useCerts();

  const isAdmin = role === 'admin' || role === 'faculty';

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 animate-fade-in bg-gray-50/50">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${isAdmin
                ? 'bg-amber-100 text-amber-600'
                : 'bg-indigo-600 text-white'
              }`}
          >
            {isAdmin ? (
              <UserCog className="w-7 h-7" />
            ) : (
              <GraduationCap className="w-7 h-7" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Welcome back, {role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User'}
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
              <Blocks className="w-3.5 h-3.5" />
              {address ? truncateAddress(address, 8) : 'Not connected'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-2">
            <Link to="/polls?create=true">
              <Button size="sm" icon={<Plus className="w-4 h-4" />}>
                New Poll
              </Button>
            </Link>
            <Link to="/attendance?create=true">
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
              >
                New Session
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Stats Grid - Wallet Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {analyticsLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Active Polls"
              value={analytics?.total_polls ?? 0}
              subValue={analytics?.total_votes ? `${analytics.total_votes} total votes` : undefined}
              variant="purple"
              chip
            />
            <StatCard
              title="Sessions"
              value={analytics?.total_sessions ?? 0}
              subValue={
                analytics?.total_checkins
                  ? `${analytics.total_checkins} check-ins`
                  : undefined
              }
              variant="pink"
              chip
            />
            <StatCard
              title="Certificates"
              value={analytics?.total_certs ?? 0}
              icon={Award}
              variant="white"
            />
            <StatCard
              title="Current Role"
              value={role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Student'}
              icon={Shield}
              variant="white"
            />
          </>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Polls */}
        <Card className="border-0 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Vote className="w-5 h-5 text-indigo-600" />
              </div>
              <CardTitle>Recent Polls</CardTitle>
            </div>
            <Link to="/polls">
              <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          {pollsLoading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : pollsData?.polls?.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Vote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No polls active</p>
              {isAdmin && (
                <Link to="/polls?create=true">
                  <Button variant="outline" size="sm" className="mt-4">
                    Create First Poll
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {pollsData?.polls.slice(0, 3).map((poll) => (
                <div
                  key={poll.poll_id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all group"
                >
                  <div className="p-3 rounded-full bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Vote className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {poll.question}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {poll.options.length} options &middot; Rounds{' '}
                      {poll.start_round}–{poll.end_round}
                    </p>
                  </div>
                  <Badge variant="primary" dot className="bg-indigo-100 text-indigo-700 border-indigo-200">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Sessions */}
        <Card className="border-0 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <CardTitle>Attendance Sessions</CardTitle>
            </div>
            <Link to="/attendance">
              <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          {sessionsLoading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : sessionsData?.sessions?.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No sessions yet</p>
              {isAdmin && (
                <Link to="/attendance?create=true">
                  <Button variant="outline" size="sm" className="mt-4">
                    Create First Session
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {sessionsData?.sessions.slice(0, 3).map((session) => (
                <div
                  key={session.session_id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group"
                >
                  <div className="p-3 rounded-full bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {session.course_code}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {session.session_ts ? formatDate(session.session_ts) : 'N/A'}{' '}
                      &middot; Round {session.open_round}
                    </p>
                  </div>
                  <Badge variant="success" dot className="bg-emerald-100 text-emerald-700 border-emerald-200">
                    Open
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Certificates Section */}
      <Card className="border-0 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Award className="w-5 h-5 text-amber-600" />
            </div>
            <CardTitle>
              {isAdmin ? 'Issued Certificates' : 'My Certificates'}
            </CardTitle>
          </div>
          <Link to="/certificates">
            <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50">
              View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>

        {certsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : certsData?.certs?.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Award className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">
              {isAdmin
                ? 'No certificates issued yet'
                : 'You have no certificates yet'}
            </p>
            {isAdmin && (
              <Link to="/certificates?issue=true">
                <Button variant="outline" size="sm" className="mt-4">
                  Issue First Certificate
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {certsData?.certs.slice(0, 3).map((cert) => (
              <div
                key={cert.cert_hash}
                className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-5 hover:shadow-md transition-all group"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-md bg-amber-100 text-amber-600">
                    <Award className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-gray-900">Certificate</span>
                </div>
                <p className="text-xs text-gray-500 mb-3 font-mono">
                  To: {truncateAddress(cert.recipient, 8)}
                </p>
                {cert.asset_id && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 p-2 rounded-lg">
                    <Hash className="w-3 h-3" />
                    ASA #{cert.asset_id}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Actions - Updated for new aesthetic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/polls" className="group">
          <Card hover className="flex items-center gap-4 border-0 shadow-sm bg-indigo-600 text-white hover:bg-indigo-700">
            <div className="p-3 rounded-xl bg-white/20">
              <Vote className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">
                {isAdmin ? 'Manage Polls' : 'Vote in Polls'}
              </p>
              <p className="text-xs text-indigo-200">
                {pollsData?.count ?? 0} active
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-indigo-200 group-hover:translate-x-1 transition-transform" />
          </Card>
        </Link>

        <Link to="/attendance" className="group">
          <Card hover className="flex items-center gap-4 border-0 shadow-sm bg-emerald-600 text-white hover:bg-emerald-700">
            <div className="p-3 rounded-xl bg-white/20">
              <ClipboardCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">
                {isAdmin ? 'Manage Attendance' : 'Check-in'}
              </p>
              <p className="text-xs text-emerald-200">
                {sessionsData?.sessions?.length ?? 0} sessions
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-1 transition-transform" />
          </Card>
        </Link>

        <Link to="/certificates" className="group">
          <Card hover className="flex items-center gap-4 border-0 shadow-sm bg-amber-500 text-white hover:bg-amber-600">
            <div className="p-3 rounded-xl bg-white/20">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">
                {isAdmin ? 'Issue Certificates' : 'My Certificates'}
              </p>
              <p className="text-xs text-amber-100">
                {certsData?.certs?.length ?? 0} total
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-100 group-hover:translate-x-1 transition-transform" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
