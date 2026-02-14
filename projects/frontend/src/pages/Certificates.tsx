import { useState } from 'react';
import { useCerts, useIssueCert, useVerifyCert } from '@/hooks/useApi';
import { useAuthStore } from '@/stores/auth';
import { useSearchParams } from 'react-router-dom';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { truncateAddress, formatDate } from '@/lib/utils';
import {
  Award,
  Plus,
  CheckCircle,
  Search,
  ExternalLink,
  ShieldCheck,
  Hash,
  FileText,
} from 'lucide-react';

export default function CertificatesPage() {
  const { role } = useAuthStore();
  const { data, isLoading, error } = useCerts();
  const issueCert = useIssueCert();
  const [searchParams, setSearchParams] = useSearchParams();
  const isFaculty = role === 'faculty' || role === 'admin';

  const [showIssue, setShowIssue] = useState(searchParams.get('issue') === 'true');
  const [showVerify, setShowVerify] = useState(false);
  const [verifyHash, setVerifyHash] = useState('');

  const [form, setForm] = useState({
    recipient_address: '',
    recipient_name: '',
    course_code: '',
    title: '',
    description: '',
  });
  const [formError, setFormError] = useState('');

  // Verification query
  const { data: verifyResult, isLoading: verifying } = useVerifyCert(
    showVerify ? verifyHash : '',
  );

  const handleIssue = async () => {
    if (!form.recipient_address || form.recipient_address.length !== 58) {
      setFormError('Valid 58-character Algorand address required');
      return;
    }
    if (!form.recipient_name.trim()) {
      setFormError('Recipient name is required');
      return;
    }
    if (!form.course_code.trim()) {
      setFormError('Course code is required');
      return;
    }
    if (!form.title.trim()) {
      setFormError('Certificate title is required');
      return;
    }

    setFormError('');
    try {
      await issueCert.mutateAsync(form);
      setShowIssue(false);
      setForm({
        recipient_address: '',
        recipient_name: '',
        course_code: '',
        title: '',
        description: '',
      });
      setSearchParams({});
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(detail || 'Failed to issue certificate');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Award className="w-6 h-6 text-accent-light" />
            Certificates
          </h1>
          <p className="text-text-secondary mt-1">
            {isFaculty
              ? 'Issue and manage blockchain-verified NFT certificates'
              : 'View and verify your on-chain certificates'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            icon={<Search className="w-4 h-4" />}
            onClick={() => setShowVerify(true)}
          >
            Verify Cert
          </Button>
          {isFaculty && (
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowIssue(true)}
            >
              Issue Certificate
            </Button>
          )}
        </div>
      </div>

      {/* Certificate grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <Card className="text-center py-8">
          <p className="text-danger">Failed to load certificates. Is the backend running?</p>
        </Card>
      ) : data?.certs?.length === 0 ? (
        <Card className="text-center py-12">
          <Award className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-secondary">No certificates issued yet</p>
          {isFaculty && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setShowIssue(true)}
            >
              Issue First Certificate
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.certs.map((cert) => (
            <Card key={cert.cert_hash} hover className="relative overflow-hidden">
              {/* Decorative gradient stripe */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-primary" />

              {/* Content */}
              <div className="pt-2">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Award className="w-6 h-6 text-accent-light" />
                  </div>
                  <Badge variant="success" dot>
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Verified
                  </Badge>
                </div>

                <CardTitle>Certificate</CardTitle>
                <CardDescription>
                  Issued to: {truncateAddress(cert.recipient, 6)}
                </CardDescription>

                {cert.asset_id && (
                  <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-surface-lighter/40">
                    <Hash className="w-3.5 h-3.5 text-text-muted" />
                    <span className="text-xs font-mono text-text-secondary">
                      ASA #{cert.asset_id}
                    </span>
                  </div>
                )}

                {cert.created && (
                  <p className="text-xs text-text-muted mt-2">
                    Issued: {formatDate(cert.created)}
                  </p>
                )}

                {/* Footer */}
                <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setVerifyHash(cert.cert_hash);
                      setShowVerify(true);
                    }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    Verify
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Issue Certificate Modal */}
      <Modal
        open={showIssue}
        onClose={() => {
          setShowIssue(false);
          setSearchParams({});
        }}
        title="Issue Certificate NFT"
      >
        <div className="space-y-4">
          <Input
            label="Recipient Address"
            placeholder="58-character Algorand address"
            value={form.recipient_address}
            onChange={(e) =>
              setForm({ ...form, recipient_address: e.target.value })
            }
          />
          <Input
            label="Recipient Name"
            placeholder="Full name for the certificate"
            value={form.recipient_name}
            onChange={(e) =>
              setForm({ ...form, recipient_name: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Course Code"
              placeholder="e.g., CS101"
              value={form.course_code}
              onChange={(e) =>
                setForm({ ...form, course_code: e.target.value })
              }
            />
            <Input
              label="Title"
              placeholder="e.g., Excellence Award"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <TextArea
            label="Description (optional)"
            placeholder="Brief description..."
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />

          {formError && <p className="text-sm text-danger">{formError}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowIssue(false);
                setSearchParams({});
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleIssue}
              loading={issueCert.isPending}
              icon={<Award className="w-4 h-4" />}
              className="flex-1"
            >
              Mint & Issue
            </Button>
          </div>

          <p className="text-xs text-text-muted text-center">
            <FileText className="w-3 h-3 inline mr-1" />
            This mints an ARC-3 NFT on Algorand and registers the cert hash on-chain.
          </p>
        </div>
      </Modal>

      {/* Verify Certificate Modal */}
      <Modal
        open={showVerify}
        onClose={() => {
          setShowVerify(false);
          setVerifyHash('');
        }}
        title="Verify Certificate"
      >
        <div className="space-y-4">
          <Input
            label="Certificate Hash"
            placeholder="Enter SHA-256 cert hash"
            value={verifyHash}
            onChange={(e) => setVerifyHash(e.target.value)}
          />

          {verifying && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          )}

          {verifyResult && (
            <Card
              className={
                verifyResult.valid
                  ? 'border-success/30 bg-success/5'
                  : 'border-danger/30 bg-danger/5'
              }
            >
              <div className="flex items-center gap-2 mb-3">
                {verifyResult.valid ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <Search className="w-5 h-5 text-danger" />
                )}
                <span
                  className={`font-semibold ${
                    verifyResult.valid ? 'text-success' : 'text-danger'
                  }`}
                >
                  {verifyResult.valid ? 'Certificate Valid' : 'Not Found'}
                </span>
              </div>
              {verifyResult.valid && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Recipient</span>
                    <span className="font-mono text-text">
                      {verifyResult.recipient
                        ? truncateAddress(verifyResult.recipient, 6)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Asset ID</span>
                    <span className="font-mono text-text">
                      {verifyResult.asset_id ?? 'N/A'}
                    </span>
                  </div>
                  {verifyResult.issued_ts && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Issued</span>
                      <span className="text-text">
                        {formatDate(verifyResult.issued_ts)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <p className="text-xs text-text-muted mt-2">
                {verifyResult.message}
              </p>
            </Card>
          )}

          <Button
            variant="secondary"
            onClick={() => {
              setShowVerify(false);
              setVerifyHash('');
            }}
            className="w-full"
          >
            Close
          </Button>
        </div>
      </Modal>
    </div>
  );
}
