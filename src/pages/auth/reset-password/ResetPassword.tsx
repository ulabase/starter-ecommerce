import { useState, type FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@ulabase/kit-react';
import { Alert } from '../../../ui/alert/Alert';

export default function ResetPassword() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';
  const missingParams = !email || !token;

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const passwordInvalid = touched && (!password || password.length < 8);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!password || password.length < 8) return;

    setLoading(true);
    setError(null);
    try {
      await auth.resetPassword({ email, token, password });
      navigate('/');
    } catch (err: unknown) {
      setLoading(false);
      const e = err as { status?: number; message?: string };
      if (e?.status === 401) setError('This reset link is invalid or has expired.');
      else setError(e?.message ?? 'Something went wrong. Please try again.');
    }
  };

  if (missingParams) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Invalid link</h1>
          <p>This password reset link is missing required information.</p>
          <p className="auth-links"><Link to="/auth/forgot-password">Request a new link</Link></p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Set a new password</h1>

        {error && (
          <Alert type="error" onClose={() => setError(null)}>{error}</Alert>
        )}

        <label htmlFor="reset-password">New password</label>
        <div className="password-field">
          <input
            id="reset-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onBlur={() => setTouched(true)}
            autoComplete="new-password"
            aria-invalid={passwordInvalid || undefined}
            aria-describedby={passwordInvalid ? 'error-password' : undefined}
          />
          <button type="button" className="btn-toggle-password" onClick={() => setShowPassword(v => !v)}>
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {passwordInvalid && (
          <p id="error-password" className="field-error">Password must be at least 8 characters.</p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Saving\u2026' : 'Set password'}
        </button>
      </form>
    </main>
  );
}
