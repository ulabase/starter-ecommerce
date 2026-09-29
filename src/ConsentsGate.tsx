import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@ulabase/kit-react';
import { isBlocked, setBlocked, subscribe } from './consents-signal';
import './ConsentsGate.css';

/**
 * Replaces the whole app with an acceptance form while the API is answering
 * `451`.
 *
 * It sits at the root, above the router, and that placement is the point: a
 * blocked user has no session — `/users/me` is refused too — so `AuthGuard`
 * would bounce them to the login page and they would never reach a screen
 * inside the app. Here there is no guard to get past.
 *
 * The overlay is user experience, not enforcement: remove it with the dev
 * tools and every request still comes back `451`. The rule lives on the server.
 */
/** Readable even while blocked. Kept beside the routes that serve them. */
const LEGAL_PATHS = ['/terms', '/privacy'];

export function ConsentsGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [blocked, setBlockedState] = useState(isBlocked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Two boxes because there are two documents. They gate the button and
  // nothing else: the request that follows carries no versions, and the server
  // stamps both in one go — see the permission's mergeRequest.
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [acceptedPp, setAcceptedPp] = useState(false);

  useEffect(() => subscribe(setBlockedState), []);

  // The two documents are readable while the gate is up, and have to be: a
  // document you cannot open is a document you cannot agree to. They were
  // static files in `public/` for exactly this reason, which cost them the
  // header, the footer and the theme; letting the routes through costs
  // nothing and enforces nothing either way — the server is still answering
  // 451 to every request that matters.
  const { pathname } = useLocation();
  if (LEGAL_PATHS.includes(pathname)) return <>{children}</>;

  if (!blocked) return <>{children}</>;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      // The versions and the timestamp are stamped by the permission's
      // mergeRequest — this call states nothing about what is accepted. The
      // user id comes from the token, since the user document is exactly what
      // we cannot read yet.
      await auth.acceptConsents();
      // The token is new and /users/me now answers: reload the session so the
      // app starts with a user and their teams rather than a blank shell.
      await auth.checkSession();
      setBlocked(false);
    } catch {
      setError('We could not record your acceptance. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    // Clear the flag too, or the next user to sign in on this tab meets the
    // overlay before making a single request.
    setBlocked(false);
    await auth.logout();
  };

  return (
    // Not `aria-modal`: this replaces the app rather than floating over it, and
    // the footer below it is real content a screen reader should still reach.
    // `aria-modal="true"` would hide everything outside this element.
    <div className="consents-overlay" role="dialog" aria-labelledby="consents-title">
      <div className="consents-card">
        <h1 id="consents-title">Before you continue</h1>
        <p>Please review these documents and accept them to use the application.</p>

        <label className="consents-check">
          <input
            type="checkbox"
            checked={acceptedTos}
            onChange={e => setAcceptedTos(e.target.checked)}
          />
          <span>
            I have read and accept the{' '}
            <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>
          </span>
        </label>

        <label className="consents-check">
          <input
            type="checkbox"
            checked={acceptedPp}
            onChange={e => setAcceptedPp(e.target.checked)}
          />
          <span>
            I have read and accept the{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>
          </span>
        </label>

        {error && <p className="field-error">{error}</p>}
        <button
          type="button"
          className="btn-primary"
          onClick={accept}
          disabled={busy || !acceptedTos || !acceptedPp}
        >
          {busy ? 'Saving…' : 'I accept'}
        </button>
        <button type="button" className="btn-plain" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
