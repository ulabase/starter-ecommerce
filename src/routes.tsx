import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AuthGuard, PublicGuard } from '@ulabase/kit-react';
import { environment } from './environments/environment';

const Login = lazy(() => import('./pages/auth/login/Login'));
const Signup = lazy(() => import('./pages/auth/signup/Signup'));
const Verify = lazy(() => import('./pages/auth/verify/Verify'));
const ForgotPassword = lazy(() => import('./pages/auth/forgot-password/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/auth/reset-password/ResetPassword'));
const Accept = lazy(() => import('./pages/invitations/accept/Accept'));
const Shell = lazy(() => import('./pages/shell/Shell'));
const Billing = lazy(() => import('./pages/billing/Billing'));
const NewBillingAccount = lazy(() => import('./pages/billing/new/NewBillingAccount'));
const BillingAccount = lazy(() => import('./pages/billing/detail/BillingAccount'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const Shop = lazy(() => import('./pages/shop/Shop'));
const Cart = lazy(() => import('./pages/shop/Cart'));
const Product = lazy(() => import('./pages/shop/Product'));
const Orders = lazy(() => import('./pages/shop/Orders'));
const Terms = lazy(() => import('./pages/legal/Terms'));
const Privacy = lazy(() => import('./pages/legal/Privacy'));

const { emailRegistration, passwordReset, oauthLogin, teamInvitations } = environment.features;

/**
 * Every route is lazy, so there is a gap between navigating and the chunk
 * arriving. `fallback={null}` filled it with nothing — a blank page for as long
 * as the download takes, then the content.
 *
 * That reads worst exactly where it matters most. Coming back from Stripe, the
 * buyer has just paid and is looking for confirmation; a blank screen is the
 * moment they wonder whether it worked, and the page that says "Confirming your
 * payment…" only appears once it is too late to reassure them.
 *
 * Deliberately quiet: a word, not a spinner. On a fast connection this is one
 * frame, and something that flashes is worse than something that waits.
 */
function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="route-loading muted">Loading…</p>}>{children}</Suspense>
  );
}

export const routes: RouteObject[] = [
  {
    path: 'auth/login',
    element: (
      <SuspenseWrapper>
        <PublicGuard>
          <Login />
        </PublicGuard>
      </SuspenseWrapper>
    ),
  },
  ...(emailRegistration || oauthLogin
    ? [
        {
          path: 'auth/signup',
          element: (
            <SuspenseWrapper>
              <PublicGuard>
                <Signup />
              </PublicGuard>
            </SuspenseWrapper>
          ),
        },
      ]
    : []),
  ...(emailRegistration
    ? [
        {
          path: 'auth/verify',
          element: (
            <SuspenseWrapper>
              <PublicGuard>
                <Verify />
              </PublicGuard>
            </SuspenseWrapper>
          ),
        },
      ]
    : []),
  ...(passwordReset
    ? [
        {
          path: 'auth/forgot-password',
          element: (
            <SuspenseWrapper>
              <PublicGuard>
                <ForgotPassword />
              </PublicGuard>
            </SuspenseWrapper>
          ),
        },
        {
          path: 'auth/reset-password',
          element: (
            <SuspenseWrapper>
              <PublicGuard>
                <ResetPassword />
              </PublicGuard>
            </SuspenseWrapper>
          ),
        },
      ]
    : []),
  ...(teamInvitations
    ? [
        {
          path: 'invitations/accept',
          element: (
            <SuspenseWrapper>
              <Accept />
            </SuspenseWrapper>
          ),
        },
      ]
    : []),
  // The shop is the front door, and it is outside AuthGuard: a guest must be
  // able to browse, pay, and see their receipt without ever creating an
  // account. Whether the service actually permits an anonymous `POST /orders`
  // is its ACL's call — the cart surfaces the 401 if it does not.
  //
  // It sits at `/` rather than under a prefix because that is where people
  // arrive. A shop reachable only by typing a path nobody links to is a shop
  // with no visitors, and the signed-out landing was the login page.
  // One shell around the whole shop, signed in or not. It used to wrap only the
  // account area, so a visitor browsing the shop had no header at all and the
  // shop grew its own row of buttons to make up for it — and "My account" led
  // to `/app`, a starter showcase page that has nothing to do with a shop.
  //
  // Not the auth pages: those are a centred card on an empty page, and a header
  // above them would be chrome around a form whose whole job is to be the only
  // thing on screen.
  {
    path: '/',
    element: (
      <SuspenseWrapper>
        <Shell />
      </SuspenseWrapper>
    ),
    children: [
      { index: true, element: <Shop /> },
      // A URL people bookmark and paste to each other, so it loads its own
      // product rather than reading one out of the grid's state.
      { path: 'product/:id', element: <Product /> },
      { path: 'cart', element: <Cart /> },
      // Readable while the consents gate is up — see ConsentsGate.
      { path: 'terms', element: <Terms /> },
      { path: 'privacy', element: <Privacy /> },
      // /checkout is gone: the cart starts the Stripe session itself. Kept as a
      // redirect because it is a path people have bookmarked mid-purchase.
      { path: 'checkout', element: <Navigate to="/cart" replace /> },
      // Both the history and where Stripe returns the buyer — the path must
      // match `stripeConfig.products.success-url` on the service. No guard: a
      // guest checkout comes back here too, and is told what it can be told.
      { path: 'orders', element: <Orders /> },
      // Kept so a success URL configured before the merge still lands
      // somewhere: the order reference travels in the fragment, which a
      // redirect preserves.
      { path: 'order', element: <Navigate to="/orders" replace /> },

      // Signed in only. The guard is per-route rather than around the shell,
      // so a guest keeps the header on every page a guest is allowed to see.
      { path: 'profile', element: <AuthGuard><Profile /></AuthGuard> },
      { path: 'billing', element: <AuthGuard><Billing /></AuthGuard> },
      { path: 'billing/new', element: <AuthGuard><NewBillingAccount /></AuthGuard> },
      { path: 'billing/:id', element: <AuthGuard><BillingAccount /></AuthGuard> },
    ],
  },
  // An unknown path used to render the authenticated home with no guard around
  // it, so a typo showed a signed-out visitor a page `/` itself refused them.
  { path: '*', element: <Navigate to="/" replace /> },
];
