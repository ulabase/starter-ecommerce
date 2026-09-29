import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@ulabase/kit-react';

export default function Verify() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();

  const email = searchParams.get('email') ?? '';
  const token = searchParams.get('token') ?? '';
  const error = searchParams.get('error');
  const missingParams = !email || !token;

  useEffect(() => {
    if (!missingParams && !error) {
      auth.verify(email, token).then(url => {
        window.location.href = url;
      });
    }
  }, [missingParams, error, email, token, auth]);

  if (missingParams) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Invalid link</h1>
          <p>This verification link is missing required information.</p>
          <p className="auth-links"><Link to="/auth/login">Back to log in</Link></p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Verification failed</h1>
          <p>The verification link is invalid or has expired.</p>
          <p className="auth-links"><Link to="/auth/login">Back to log in</Link></p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Verifying your email…</h1>
        <p>Please wait while we verify your email address.</p>
      </div>
    </main>
  );
}
