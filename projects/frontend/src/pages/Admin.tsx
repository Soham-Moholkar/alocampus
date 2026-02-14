import { useState } from 'react';
import { useSetRole, useAnalytics, useHealthDetailed } from '@/hooks/useApi';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import {
  Shield,
  UserPlus,
  CheckCircle,
  AlertCircle,
  Activity,
  Vote,
  ClipboardCheck,
  Award,
  Server,
} from 'lucide-react';

export default function AdminPage() {
  const setRoleMutation = useSetRole();
  const { data: analytics } = useAnalytics();
  const { data: health } = useHealthDetailed();

  const [roleForm, setRoleForm] = useState({
    address: '',
    role: 'student' as 'admin' | 'faculty' | 'student',
  });
  const [roleError, setRoleError] = useState('');
  const [roleSuccess, setRoleSuccess] = useState('');

  const handleSetRole = async () => {
    if (!roleForm.address || roleForm.address.length !== 58) {
      setRoleError('Valid 58-character Algorand address required');
      return;
    }

    setRoleError('');
    setRoleSuccess('');

    try {
      const result = await setRoleMutation.mutateAsync(roleForm);
      setRoleSuccess(result.message || `Role set to ${roleForm.role} successfully`);
      setRoleForm({ ...roleForm, address: '' });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setRoleError(detail || 'Failed to set role');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text flex items-center gap-2">
          <Shield className="w-6 h-6 text-warning" />
          Admin Panel
        </h1>
        <p className="text-text-secondary mt-1">
          Manage roles, view analytics, and monitor system health
        </p>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Polls" value={analytics?.total_polls ?? 0} icon={Vote} />
        <StatCard title="Votes" value={analytics?.total_votes ?? 0} icon={Vote} />
        <StatCard title="Sessions" value={analytics?.total_sessions ?? 0} icon={ClipboardCheck} />
        <StatCard title="Check-ins" value={analytics?.total_checkins ?? 0} icon={ClipboardCheck} />
        <StatCard title="Certificates" value={analytics?.total_certs ?? 0} icon={Award} />
      </div>

      {/* Role Management */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-primary-light" />
          <CardTitle>Role Management</CardTitle>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Assign roles to wallet addresses. Changes are pushed to all smart contracts on-chain.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <Input
              label="Wallet Address"
              placeholder="58-character Algorand address"
              value={roleForm.address}
              onChange={(e) => setRoleForm({ ...roleForm, address: e.target.value })}
            />
          </div>
          <div>
            <Select
              label="Role"
              value={roleForm.role}
              onChange={(e) =>
                setRoleForm({
                  ...roleForm,
                  role: e.target.value as 'admin' | 'faculty' | 'student',
                })
              }
              options={[
                { value: 'student', label: 'Student' },
                { value: 'faculty', label: 'Faculty' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleSetRole}
              loading={setRoleMutation.isPending}
              icon={<CheckCircle className="w-4 h-4" />}
              className="w-full"
            >
              Assign Role
            </Button>
          </div>
        </div>

        {roleError && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-danger/10 border border-danger/20">
            <AlertCircle className="w-4 h-4 text-danger" />
            <p className="text-sm text-danger">{roleError}</p>
          </div>
        )}

        {roleSuccess && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-lg bg-success/10 border border-success/20">
            <CheckCircle className="w-4 h-4 text-success" />
            <p className="text-sm text-success">{roleSuccess}</p>
          </div>
        )}

        <div className="mt-4 p-3 rounded-lg bg-surface-lighter/30 border border-border">
          <p className="text-xs text-text-muted">
            <strong className="text-text-secondary">Note:</strong> Role changes are pushed to
            all 3 smart contracts (Voting, Attendance, Certificate). Admin roles can only be set
            by the contract deployer. Faculty roles can be set by any admin.
          </p>
        </div>
      </Card>

      {/* System Health */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-algo-teal" />
          <CardTitle>System Health</CardTitle>
          {health && (
            <Badge
              variant={health.status === 'healthy' ? 'success' : 'warning'}
              dot
            >
              {health.status}
            </Badge>
          )}
        </div>

        {health?.checks ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(health.checks).map(([name, check]) => (
              <div
                key={name}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface-lighter/30 border border-border"
              >
                <Server className="w-4 h-4 text-text-muted" />
                <div>
                  <p className="text-sm font-medium text-text capitalize">{name}</p>
                  <Badge
                    variant={check.status === 'healthy' ? 'success' : 'danger'}
                    className="mt-1"
                  >
                    {check.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Loading health checks...</p>
        )}
      </Card>
    </div>
  );
}
