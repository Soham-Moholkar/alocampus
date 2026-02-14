import { useState } from 'react';
import { usePolls, useCreatePoll } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/auth';
import { useSearchParams } from 'react-router-dom';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { CardSkeleton } from '@/components/ui/Skeleton';
import {
  Vote,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  BarChart3,
  Hash,
} from 'lucide-react';

export default function PollsPage() {
  const { role } = useAuthStore();
  const { data, isLoading, error } = usePolls();
  const createPoll = useCreatePoll();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFaculty = role === 'faculty' || role === 'admin';

  const [showCreate, setShowCreate] = useState(searchParams.get('create') === 'true');
  const [form, setForm] = useState({
    question: '',
    options: ['', ''],
    start_round: 0,
    end_round: 1000,
  });
  const [formError, setFormError] = useState('');

  const addOption = () => {
    if (form.options.length < 10) {
      setForm({ ...form, options: [...form.options, ''] });
    }
  };

  const removeOption = (index: number) => {
    if (form.options.length > 2) {
      setForm({ ...form, options: form.options.filter((_, i) => i !== index) });
    }
  };

  const updateOption = (index: number, value: string) => {
    const opts = [...form.options];
    opts[index] = value;
    setForm({ ...form, options: opts });
  };

  const handleCreate = async () => {
    if (!form.question.trim()) {
      setFormError('Question is required');
      return;
    }
    const validOptions = form.options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      setFormError('At least 2 options are required');
      return;
    }

    setFormError('');
    try {
      await createPoll.mutateAsync({
        question: form.question,
        options: validOptions,
        start_round: form.start_round,
        end_round: form.end_round,
      });
      setShowCreate(false);
      setForm({ question: '', options: ['', ''], start_round: 0, end_round: 1000 });
      setSearchParams({});
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail || 'Failed to create poll');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Vote className="w-6 h-6 text-primary-light" />
            Polls
          </h1>
          <p className="text-text-secondary mt-1">
            {isFaculty
              ? 'Create and manage blockchain-verified polls'
              : 'Participate in transparent on-chain voting'}
          </p>
        </div>
        {isFaculty && (
          <Button
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowCreate(true)}
          >
            Create Poll
          </Button>
        )}
      </div>

      {/* Poll list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-danger">Failed to load polls. Is the backend running?</p>
        </Card>
      ) : data?.polls?.length === 0 ? (
        <Card className="text-center py-12">
          <Vote className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">No polls created yet</p>
          {isFaculty && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setShowCreate(true)}
            >
              Create First Poll
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.polls.map((poll) => (
            <Card key={poll.poll_id} hover>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-text-muted" />
                  <span className="text-xs text-text-muted">Poll #{poll.poll_id}</span>
                </div>
                <Badge variant="primary" dot>
                  Active
                </Badge>
              </div>

              <CardTitle>{poll.question}</CardTitle>
              <CardDescription>
                {poll.options.length} options &middot; Rounds {poll.start_round}–{poll.end_round}
              </CardDescription>

              {/* Options preview */}
              <div className="mt-4 space-y-2">
                {poll.options.map((opt, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-lighter/40 hover:bg-surface-lighter/60 transition-colors cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-primary/30 flex items-center justify-center text-xs text-text-muted">
                      {i + 1}
                    </div>
                    <span className="text-sm text-text">{opt}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <Clock className="w-3.5 h-3.5" />
                  On-chain verified
                </div>
                {poll.tx_id && (
                  <span className="text-xs font-mono text-text-muted">
                    tx: {poll.tx_id.slice(0, 8)}...
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Poll Modal */}
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false);
          setSearchParams({});
        }}
        title="Create New Poll"
      >
        <div className="space-y-4">
          <TextArea
            label="Question"
            placeholder="What would you like to ask?"
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Options
            </label>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    className="flex-1"
                  />
                  {form.options.length > 2 && (
                    <button
                      onClick={() => removeOption(i)}
                      className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {form.options.length < 10 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={addOption}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Option
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Round"
              type="number"
              value={form.start_round}
              onChange={(e) => setForm({ ...form, start_round: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="End Round"
              type="number"
              value={form.end_round}
              onChange={(e) => setForm({ ...form, end_round: parseInt(e.target.value) || 0 })}
            />
          </div>

          {formError && (
            <p className="text-sm text-danger">{formError}</p>
          )}

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
              loading={createPoll.isPending}
              icon={<CheckCircle className="w-4 h-4" />}
              className="flex-1"
            >
              Create Poll
            </Button>
          </div>

          <p className="text-xs text-text-muted text-center">
            <BarChart3 className="w-3 h-3 inline mr-1" />
            This poll will be recorded on Algorand with one-address-one-vote enforcement.
          </p>
        </div>
      </Modal>
    </div>
  );
}
