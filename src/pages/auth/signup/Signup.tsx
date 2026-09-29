import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@ulabase/kit-react';
import { environment } from '../../../environments/environment';
import { OAuthButtons } from '../oauth-buttons/OAuthButtons';
import { Alert } from '../../../ui/alert/Alert';

export default function Signup() {
  const auth = useAuth();
  const features = environment.features;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({ firstName: false, lastName: false, email: false, password: false });

  const emailInvalid = touched.email && (!email || !email.includes('@'));
  const passwordInvalid = touched.password && (!password || password.length < 8);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ firstName: true, lastName: true, email: true, password: true });
    if (!firstName || !lastName || !email || !email.includes('@') || !password || password.length < 8) return;

    setLoading(true);
    setError(null);
    // The server calls this a team; here it is the account purchases are charged
    // to, and "Andrea's Team" is the wrong words in a shop — a customer who
    // never invites anyone should not be told they have a team.
    const owner = firstName || email.split('@')[0];
    const teamName = `${owner}'s account`;

    try {
      await auth.register({ teamName, firstName, lastName, email, password });
      setSubmitted(true);
    } catch (err: unknown) {
      setLoading(false);
      const e = err as { status?: number; message?: string };
      if (e?.status === 409) setError('An account with this email already exists.');
      else setError(e?.message ?? 'Something went wrong. Please try again.');
    }
  };

  if (submitted) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p>We sent a verification link to confirm your account. Click it to finish signing up.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Create an account</h1>

        {error && (
          <Alert type="error" onClose={() => setError(null)}>{error}</Alert>
        )}

        {features.oauthLogin && (
          <>
            <OAuthButtons providers={features.oauthProviders} />
            {features.emailRegistration && <div className="divider"><span>OR</span></div>}
          </>
        )}

        {features.emailRegistration && (
          <form onSubmit={submit} noValidate>
            <label htmlFor="signup-firstName">First name</label>
            <input
              id="signup-firstName"
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, firstName: true }))}
              autoComplete="given-name"
            />
            {touched.firstName && !firstName && (
              <p className="field-error">First name is required.</p>
            )}

            <label htmlFor="signup-lastName">Last name</label>
            <input
              id="signup-lastName"
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, lastName: true }))}
              autoComplete="family-name"
            />
            {touched.lastName && !lastName && (
              <p className="field-error">Last name is required.</p>
            )}

            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
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

            <label htmlFor="signup-password">Password</label>
            <div className="password-field">
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, password: true }))}
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
              {loading ? 'Creating account\u2026' : 'Create account'}
            </button>
          </form>
        )}

        <p className="auth-links">
          Already have an account? <Link to="/auth/login">Log in</Link>
        </p>
      </div>
    </main>
  );
}
