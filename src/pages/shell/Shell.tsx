import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useCart } from '@ulabase/kit-react';
import { isJustSignedUp, setJustSignedUp } from '../../just-signed-up';
import { usePayments } from '@ulabase/kit-react';
import './Shell.css';

const STORAGE_KEY = 'rh-theme';

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const toggle = useCallback(() => {
    setDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return { dark, toggle };
}

/**
 * The shop's frame, for everyone.
 *
 * There is no `AuthGuard` around this: a shop whose header only exists once you
 * log in is a shop that greets strangers with nothing, and the theme switcher —
 * the one control every visitor wants — was locked behind an account.
 *
 * So everything here is written twice over: signed in it shows the avatar menu,
 * signed out it shows the two links that lead to one.
 */
export default function Shell() {
  const auth = useAuth();
  const cart = useCart();
  const payments = usePayments();
  const [portalError, setPortalError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const [justSignedUp, setJustSignedUpState] = useState(isJustSignedUp);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const avatarBtnRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLAnchorElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setJustSignedUp(false);
  }, []);

  useEffect(() => {
    setNavigating(false);
  }, [location]);

  /**
   * A new page starts at the top.
   *
   * A single-page app swaps the content and leaves the scroll position where it
   * was, which a browser doing a real navigation would never do. Clicking Terms
   * from the footer — the bottom of a long shop — opened the document already
   * scrolled past its own heading.
   *
   * Keyed on `pathname` alone: the hash and the query string change without the
   * page changing, and the order reference comes back from Stripe in a fragment
   * we do not want to scroll for.
   */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const initials = (): string => {
    const user = auth.user;
    if (!user) return '?';
    const first = user.profile?.name?.charAt(0) ?? '';
    const last = user.profile?.surname?.charAt(0) ?? '';
    const fallback = user._id?.charAt(0) ?? '?';
    return (first + last || fallback).toUpperCase();
  };

  const displayName = (): string => {
    const user = auth.user;
    if (!user) return '';
    const fn = user.profile?.name;
    const ln = user.profile?.surname;
    if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
    return user._id;
  };

  const email = (): string => {
    return auth.user?._id ?? '';
  };

  const activeTeamName = (): string => {
    const active = auth.teams.find(t => t.active);
    return active?.name ?? '';
  };

  const toggleMenu = () => {
    setMenuOpen(prev => {
      if (!prev) {
        setTimeout(() => firstMenuItemRef.current?.focus(), 0);
      }
      return !prev;
    });
  };

  const closeMenu = () => {
    setMenuOpen(false);
    avatarBtnRef.current?.focus();
  };

  const onMenuKeydown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
    }
  };

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menuOpen]);

  /**
   * Stripe's customer portal: cards on file, past payments, invoices.
   *
   * It refused this shop until billing accounts had a Stripe Customer — the
   * portal has nothing to show without one, and products mode never made one.
   * Now it does, so the page works here as it does for a subscriber: hosted by
   * Stripe, so this hands back a URL and we go there.
   */
  const openPortal = async () => {
    closeMenu();
    setPortalError(null);
    try {
      const { url } = await payments.openBillingPortal();
      window.location.href = url;
    } catch (e) {
      const err = e as { status?: number; message?: string };
      setPortalError(
        err.status === 402
          ? 'Nothing to show yet — this opens once you have bought something.'
          : err.status === 403
            ? 'The service ACL does not allow opening the billing portal. Re-run `ulabase setup`.'
            : (err.message ?? 'Could not open the billing portal.')
      );
    }
  };

  const logout = async () => {
    closeMenu();
    await auth.logout();
    // Back to the shop, not to a login form: signing out of a shop is not
    // leaving it, and everything at `/` is open to a guest anyway.
    navigate('/');
  };

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>

      <div className="layout">
        {navigating && (
          <div className="nav-progress" role="progressbar" aria-label="Loading page"></div>
        )}

        <header className="header">
          <Link to="/" className="logo">Ulabase</Link>

          <nav className="nav" aria-label="Main">
            <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Shop</NavLink>
            <NavLink to="/cart" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              Cart{cart.totalItems > 0 ? ` (${cart.totalItems})` : ''}
            </NavLink>
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="btn-icon"
              onClick={theme.toggle}
              aria-label={theme.dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme.dark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>

            {!auth.isAuthenticated && (
              <>
                <Link to="/auth/login" className="btn-secondary">Log in</Link>
                <Link to="/auth/signup" className="btn-primary">Sign up</Link>
              </>
            )}

            {auth.isAuthenticated && (
            <div className="user-menu" ref={menuRef}>
              <button
                ref={avatarBtnRef}
                type="button"
                className="avatar-btn"
                onClick={toggleMenu}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
              >
                {initials()}
              </button>

              {menuOpen && (
                <div className="dropdown" role="menu" onClick={e => e.stopPropagation()} onKeyDown={onMenuKeydown}>
                  <div className="dropdown-header">
                    <span className="dropdown-name">{displayName()}</span>
                    {email() && email() !== displayName() && (
                      <span className="dropdown-email">{email()}</span>
                    )}
                    {activeTeamName() && (
                      <span className="dropdown-team">Billing: {activeTeamName()}</span>
                    )}
                  </div>
                  <div className="dropdown-divider"></div>
                  {/* "Account" and "Billing account" sat next to each other and
                      read as the same thing twice. One is who you are, the other
                      is who pays — so they are named for that now. */}
                  <Link ref={firstMenuItemRef} to="/profile" className="dropdown-item" role="menuitem" onClick={closeMenu}>Your profile</Link>
                  <Link to="/orders" className="dropdown-item" role="menuitem" onClick={closeMenu}>Your orders</Link>
                  <button type="button" className="dropdown-item" role="menuitem" onClick={openPortal}>
                    Payments &amp; invoices
                  </button>
                  <Link to="/billing" className="dropdown-item" role="menuitem" onClick={closeMenu}>Billing account</Link>
                  <div className="dropdown-divider"></div>
                  <button type="button" className="dropdown-item dropdown-item-danger" role="menuitem" onClick={logout}>Logout</button>
                </div>
              )}
            </div>
            )}
          </div>
        </header>

        {portalError && (
          <div className="welcome-banner" role="alert">
            <p>{portalError}</p>
            <button type="button" className="btn-dismiss" onClick={() => setPortalError(null)}>&#10005;</button>
          </div>
        )}

        {justSignedUp && (
          <div className="welcome-banner">
            <p>Welcome aboard — your account is ready.</p>
            <button type="button" className="btn-dismiss" onClick={() => setJustSignedUpState(false)}>&#10005;</button>
          </div>
        )}

        <main id="main" className="main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
