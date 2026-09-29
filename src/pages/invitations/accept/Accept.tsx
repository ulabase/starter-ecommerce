import { useState, useEffect, type FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@ulabase/kit-react';
import { Alert } from '../../../ui/alert/Alert';

export default function Accept() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';
  const missingParams = !email || !token;

  const [loading, setLoading] = useState(!missingParams);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<{ isNewUser: boolean; teamName: string } | null>(null);
  const [done, setDone] = useState(false);

  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newUserTouched, setNewUserTouched] = useState(false);

  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    if (missingParams) return;
    auth.getInvitation(email, token).then(
      inv => {
        setInvitation(inv);
        setLoading(false);
      },
      (err: unknown) => {
        setLoading(false);
        const e = err as { status?: number; message?: string };
        if (e?.status === 404) setError('This invitation is invalid or has expired.');
        else setError(e?.message ?? 'Something went wrong. Please try again.');
      }
    );
  }, [missingParams, email, token, auth]);

  const messageFor = (err: unknown): string => {
    const e = err as { status?: number; message?: string };
    if (e?.status === 404) return 'This invitation is invalid or has expired.';
    if (e?.status === 401) return 'Invalid password.';
    return e?.message ?? 'Something went wrong. Please try again.';
  };

  const submitNewUser = async (e: FormEvent) => {
    e.preventDefault();
    setNewUserTouched(true);
    if (!newUserPassword || newUserPassword.length < 8) return;
    try {
      await auth.activate({ email, token, password: newUserPassword });
      navigate('/');
    } catch (err: unknown) {
      setError(messageFor(err));
    }
  };

  const submitLoginAndAccept = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginPassword) return;
    try {
      await auth.login(email, loginPassword);
      await acceptForLoggedInUser();
    } catch (err: unknown) {
      setError(messageFor(err));
    }
  };

  const acceptForLoggedInUser = async () => {
    try {
      await auth.acceptInvite(token);
      setDone(true);
      setTimeout(() => navigate('/'), 1200);
    } catch (err: unknown) {
      setError(messageFor(err));
    }
  };

  if (missingParams) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Invalid invitation link</h1>
          <p>This link is missing required information.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <p>Loading invitation…</p>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>You're in</h1>
          <p>Redirecting…</p>
        </div>
      </main>
    );
  }

  if (invitation?.isNewUser) {
    const newUserPasswordInvalid = newUserTouched && (!newUserPassword || newUserPassword.length < 8);
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={submitNewUser} noValidate>
          <h1>Join {invitation.teamName}</h1>
          <p>Set a password to activate your account.</p>

          {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}

          <label htmlFor="accept-password">Password</label>
          <div className="password-field">
            <input
              id="accept-password"
              type={showNewUserPassword ? 'text' : 'password'}
              value={newUserPassword}
              onChange={e => setNewUserPassword(e.target.value)}
              onBlur={() => setNewUserTouched(true)}
              autoComplete="new-password"
              aria-invalid={newUserPasswordInvalid || undefined}
              aria-describedby={newUserPasswordInvalid ? 'error-password' : undefined}
            />
            <button type="button" className="btn-toggle-password" onClick={() => setShowNewUserPassword(v => !v)}>
              {showNewUserPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          {newUserPasswordInvalid && (
            <p id="error-password" className="field-error">Password must be at least 8 characters.</p>
          )}

          <button type="submit" disabled={!newUserPassword || newUserPassword.length < 8}>Join team</button>
        </form>
      </main>
    );
  }

  if (auth.isAuthenticated) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Join {invitation?.teamName}</h1>
          <p>You're signed in as {email}.</p>
          {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}
          <button type="button" onClick={acceptForLoggedInUser}>Join team</button>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submitLoginAndAccept} noValidate>
        <h1>Log in to join {invitation?.teamName}</h1>
        <p>{email}</p>

        {error && <Alert type="error" onClose={() => setError(null)}>{error}</Alert>}

        <label htmlFor="accept-login-password">Password</label>
        <div className="password-field">
          <input
            id="accept-login-password"
            type={showLoginPassword ? 'text' : 'password'}
            value={loginPassword}
            onChange={e => setLoginPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="button" className="btn-toggle-password" onClick={() => setShowLoginPassword(v => !v)}>
            {showLoginPassword ? 'Hide' : 'Show'}
          </button>
        </div>

        <button type="submit" disabled={!loginPassword}>Log in and join</button>
      </form>
    </main>
  );
}
