import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/lib/api';
import {
  ArrowLeft,
  AlertCircle,
  GraduationCap,
  UserCog,
  BookOpen,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const DEMO_ADDRESSES: Record<string, string> = {
  student: '3GJZIKKZQRTW3SJOW6QYEMMRQ4BFHFDTC5C7XBCOOZN7TEZ4ASH4MFG32I',
  faculty: 'FACULTYADDR0000000000000000000000000000000000000000000000A',
  admin: 'ADMINTESTADDR00000000000000000000000000000000000000000000A',
};

const ROLE_CONFIG: Record<string, { label: string; icon: typeof GraduationCap; gradient: string; accent: string }> = {
  student: { label: 'Student', icon: GraduationCap, gradient: 'bg-gradient-primary', accent: 'bg-primary text-white' },
  faculty: { label: 'Faculty', icon: BookOpen, gradient: 'bg-gradient-to-br from-success to-emerald-600', accent: 'bg-success text-white' },
  admin: { label: 'Admin', icon: UserCog, gradient: 'bg-gradient-to-br from-warning to-orange-500', accent: 'bg-warning text-white' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const roleHint = searchParams.get('role') || 'student';
  const config = ROLE_CONFIG[roleHint] || ROLE_CONFIG.student;
  const RoleIcon = config.icon;

  const [address, setAddress] = useState(DEMO_ADDRESSES[roleHint] || '');
  const [step, setStep] = useState<'address' | 'signing' | 'verifying'>('address');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!address || address.length < 58) {
      setError('Please enter a valid Algorand address (58 characters)');
      return;
    }

    setError('');
    setLoading(true);
    setStep('signing');

    try {
      // Step 1: Get nonce from server
      const { data: nonceData } = await authApi.getNonce(address);
      const nonce = nonceData.nonce;

      setStep('verifying');

      // Step 2: For LocalNet demo, we simulate signing by sending the nonce back
      const { data: tokenData } = await authApi.verify(address, nonce, nonce);

      // Step 3: Decode JWT to get role
      const jwt = tokenData.jwt;
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      const role = payload.role || 'student';

      login(jwt, address, role);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { detail?: string } } })?.response?.data
              ?.detail || 'Connection failed';
      setError(
        typeof msg === 'string'
          ? msg
          : 'Connection failed. Make sure the backend is running.',
      );
      setStep('address');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-dark flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
          {/* Role Badge */}
          <div className="flex justify-center mb-6">
            <div
              className={`w-14 h-14 rounded-xl flex items-center justify-center ${config.gradient}`}
            >
              <RoleIcon className="w-7 h-7 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-text text-center mb-2">
            {config.label} Login
          </h1>
          <p className="text-sm text-text-secondary text-center mb-8">
            Enter your Algorand wallet address to authenticate.
          </p>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 mb-4 rounded-lg bg-danger/10 border border-danger/20">
              <AlertCircle className="w-4 h-4 text-danger mt-0.5 flex-shrink-0" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {/* Address input */}
          <div className="space-y-4">
            <Input
              label="Wallet Address"
              placeholder="Enter your 58-character Algorand address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={step !== 'address'}
            />

            <Button
              onClick={handleConnect}
              loading={loading}
              className="w-full"
              size="lg"
            >
              {step === 'address'
                ? `Sign in as ${config.label}`
                : step === 'signing'
                  ? 'Signing Challenge...'
                  : 'Verifying...'}
            </Button>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center justify-center gap-6 mt-8">
            {['Connect', 'Sign', 'Verify'].map((label, i) => {
              const stepIndex =
                step === 'address' ? 0 : step === 'signing' ? 1 : 2;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      i <= stepIndex
                        ? config.accent
                        : 'bg-surface-lighter text-text-muted'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs text-text-muted">{label}</span>
                </div>
              );
            })}
          </div>

          {/* Quick switch */}
          <div className="mt-6 flex items-center justify-center gap-3">
            {Object.entries(ROLE_CONFIG)
              .filter(([key]) => key !== roleHint)
              .map(([key, cfg]) => (
                <Link
                  key={key}
                  to={`/login?role=${key}`}
                  className="text-xs text-text-muted hover:text-primary-light transition-colors"
                >
                  {cfg.label} →
                </Link>
              ))}
          </div>
        </div>

        {/* Demo hint */}
        <div className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/20 text-center">
          <p className="text-xs text-accent-light">
            <strong>LocalNet Demo:</strong> The address is pre-filled for demo.
            Make sure the backend is running at{' '}
            <code className="bg-surface-lighter px-1.5 py-0.5 rounded text-xs font-mono">
              localhost:8000
            </code>
          </p>
        </div>
      </div>
    </div>
  );
}
