import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@ulabase/kit-react';
import { safeNext } from '../../../safe-next';
import { environment } from '../../../environments/environment';
import { OAuthButtons } from '../oauth-buttons/OAuthButtons';
import { Alert } from '../../../ui/alert/Alert';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: 'This link is invalid or has expired.',
};

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const features = environment.features;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    ERROR_MESSAGES[searchParams.get('error') ?? ''] ?? null
  );
  const [touched, setTouched] = useState({ email: false, password: false });

  const emailInvalid = touched.email && (!email || !email.includes('@'));
  const passwordInvalid = touched.password && !password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email || !email.includes('@') || !password) return;

    setLoading(true);
    setError(null);
    try {
      await auth.login(email, password);
      // Back where they were asked to sign in from — the checkout, usually.
      navigate(safeNext(searchParams));
    } catch (err: unknown) {
      setLoading(false);
      const e = err as { status?: number; message?: string };
      if (e?.status === 401) setError('Invalid email or password.');
      else setError(e?.message ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Log in</h1>

        {error && (
          <Alert type="error" onClose={() => setError(null)}>{error}</Alert>
        )}

        {features.oauthLogin && (
          <>
            <OAuthButtons providers={features.oauthProviders} />
            <div className="divider"><span>OR</span></div>
          </>
        )}

        <form onSubmit={submit} noValidate>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onBlur={() => setTouched(t => ({ ...t, email: true }))}
            autoComplete="email"
            aria-invalid={emailInvalid || undefined}
            aria-describedby={emailInvalid ? 'error-email' : undefined}
          />
          {emailInvalid && (
            <p id="error-email" className="field-error">Enter a valid email address.</p>
          )}

          <label htmlFor="login-password">Password</label>
          <div className="password-field">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, password: true }))}
              autoComplete="current-password"
              aria-invalid={passwordInvalid || undefined}
              aria-describedby={passwordInvalid ? 'error-password' : undefined}
            />
            <button type="button" className="btn-toggle-password" onClick={() => setShowPassword(v => !v)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {passwordInvalid && (
            <p id="error-password" className="field-error">Password is required.</p>
          )}

          <button type="submit" disabled={loading || !email || !password}>
            {loading ? 'Logging in\u2026' : 'Log in'}
          </button>
        </form>

        <p className="auth-links">
          {features.passwordReset && (
            <Link to="/auth/forgot-password">Forgot password?</Link>
          )}
          {features.passwordReset && (features.emailRegistration || features.oauthLogin) && ' \u00B7 '}
          {(features.emailRegistration || features.oauthLogin) && (
            <Link to="/auth/signup">Create an account</Link>
          )}
        </p>
      </div>
    </main>
  );
}
