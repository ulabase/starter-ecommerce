import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@ulabase/kit-react';

export default function ForgotPassword() {
  const auth = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailInvalid = touched && (!email || !email.includes('@'));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!email || !email.includes('@')) return;

    setLoading(true);
    // The API always returns 202 regardless of whether the email exists,
    // to avoid leaking which emails are registered — show the same confirmation either way.
    try {
      await auth.forgotPassword(email);
    } catch {
      // ignore
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p>If an account exists for that address, we sent a link to reset your password.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1>Forgot your password?</h1>
        <p>Enter your email and we'll send you a reset link.</p>

        <label htmlFor="forgot-email">Email</label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          autoComplete="email"
        />
        {emailInvalid && (
          <p className="field-error">Enter a valid email address.</p>
        )}

        <button type="submit" disabled={loading}>
          {loading ? 'Sending\u2026' : 'Send reset link'}
        </button>

        <p className="auth-links">
          <Link to="/auth/login">Back to log in</Link>
        </p>
      </form>
    </main>
  );
}
