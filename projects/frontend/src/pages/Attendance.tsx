import { useState } from 'react';
import { useSessions, useCreateSession } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/auth';
import { useSearchParams } from 'react-router-dom';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/lib/utils';
import {
  ClipboardCheck,
  Plus,
  CheckCircle,
  Calendar,
  Hash,
  Users,
} from 'lucide-react';

export default function AttendancePage() {
  const { role } = useAuthStore();
  const { data, isLoading, error } = useSessions();
  const createSession = useCreateSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFaculty = role === 'faculty' || role === 'admin';

  const [showCreate, setShowCreate] = useState(searchParams.get('create') === 'true');
  const [form, setForm] = useState({
    course_code: '',
    session_ts: Math.floor(Date.now() / 1000),
    open_round: 0,
    close_round: 500,
  });
  const [formError, setFormError] = useState('');

  const handleCreate = async () => {
    if (!form.course_code.trim()) {
      setFormError('Course code is required');
      return;
    }

    setFormError('');
    try {
      await createSession.mutateAsync(form);
      setShowCreate(false);
      setForm({
        course_code: '',
        session_ts: Math.floor(Date.now() / 1000),
        open_round: 0,
        close_round: 500,
      });
      setSearchParams({});
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail || 'Failed to create session');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-success" />
            Attendance
          </h1>
          <p className="text-text-secondary mt-1">
            {isFaculty
              ? 'Create sessions and track blockchain-verified attendance'
              : 'Check in to active sessions with on-chain verification'}
          </p>
        </div>
        {isFaculty && (
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreate(true)}
          >
            Create Session
          </Button>
        )}
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-danger">Failed to load sessions. Is the backend running?</p>
        </Card>
      ) : data?.sessions?.length === 0 ? (
        <Card className="text-center py-12">
          <ClipboardCheck className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">No attendance sessions yet</p>
          {isFaculty && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setShowCreate(true)}
            >
              Create First Session
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.sessions.map((session) => (
            <Card key={session.session_id} hover>
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-text-muted" />
                  <span className="text-xs text-text-muted">
                    Session #{session.session_id}
                  </span>
                </div>
                <Badge variant="success" dot>
                  Open
                </Badge>
              </div>

              {/* Course info */}
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <ClipboardCheck className="w-5 h-5 text-success" />
                </div>
                <div>
                  <CardTitle>{session.course_code}</CardTitle>
                  <CardDescription>
                    {session.session_ts ? formatDate(session.session_ts) : 'N/A'}
                  </CardDescription>
                </div>
              </div>

              {/* Round info */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-2.5 rounded-lg bg-surface-lighter/40 text-center">
                  <p className="text-xs text-text-muted mb-1">Opens</p>
                  <p className="text-sm font-mono text-text">Round {session.open_round}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-lighter/40 text-center">
                  <p className="text-xs text-text-muted mb-1">Closes</p>
                  <p className="text-sm font-mono text-text">Round {session.close_round}</p>
                </div>
              </div>

              {/* Check-in button (for students) */}
              {!isFaculty && (
                <Button variant="success" size="sm" className="w-full mt-4">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Check In
                </Button>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Users className="w-3.5 h-3.5" />
                  On-chain roster
                </div>
                {session.tx_id && (
                  <span className="text-xs font-mono text-text-muted">
                    tx: {session.tx_id.slice(0, 8)}...
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setSearchParams({});
        }}
        title="Create Attendance Session"
      >
        <div className="space-y-4">
          <Input
            label="Course Code"
            placeholder="e.g., CS101, MATH201"
            value={form.course_code}
            onChange={(e) => setForm({ ...form, course_code: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Open Round"
              type="number"
              value={form.open_round}
              onChange={(e) => setForm({ ...form, open_round: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Close Round"
              type="number"
              value={form.close_round}
              onChange={(e) => setForm({ ...form, close_round: parseInt(e.target.value) || 0 })}
            />
          </div>

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreate(false);
                setSearchParams({});
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={createSession.isPending}
              icon={<CheckCircle className="w-4 h-4" />}
              className="flex-1"
            >
              Create Session
            </Button>
          </div>

          <p className="text-xs text-text-muted text-center">
            <Calendar className="w-3 h-3 inline mr-1" />
            Check-ins are enforced by Algorand round windows. One check-in per address per session.
          </p>
        </div>
      </Modal>
    </div>
  );
}
