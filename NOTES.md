# Notes — Ecommerce starter

The [README](./README.md) gets you online. This is everything else: how the app is put
together, what to change when you make it yours, and the sharp edges worth knowing before
this becomes a real shop.

## Working on the kit itself

**Skip this unless you are changing `@ulabase/kit` or `@ulabase/kit-react`.**
Both are on npm, and `npm install` gets them; this section is for running the app against a
kit checkout you are editing.

```bash
# 1. Register the kit packages globally
cd ../restheart-cloud-kit/packages/kit       && npm link
cd ../kit-react                              && npm link

# 2. Point this app at them
cd ../../../ulabase-starter-ecommerce
npm link @ulabase/kit @ulabase/kit-react
```

**`npm install` undoes this.** It resolves the published versions and replaces the symlinks
with real directories — the app then runs against the release, silently, with no error to
notice. Re-run the `npm link` line after any install, and check with
`ls -l node_modules/@ulabase/`: symlinks, not directories.

**After every change to the kit, rebuild it** — this app consumes `dist/`, not the
TypeScript sources:

```bash
cd ../restheart-cloud-kit && npm run build
```

Vite picks the rebuild up without a restart, because the linked packages are excluded
from dependency pre-bundling in `vite.config.ts`.

### If you link, `vite.config.ts` needs three settings back

They were there and are now gone, because the kit is published and this app installs it
normally. Linking needs them again:

```ts
resolve:     { dedupe: ['react', 'react-dom', 'react-router-dom'] },
optimizeDeps:{ exclude: ['@ulabase/kit', '@ulabase/kit-react'] },
server:      { fs: { allow: ['..'] } },
```

A linked package resolves *its own* imports from its real path, so `react` would come from
the kit monorepo instead of this app. Two Reacts in one tree throw "Invalid hook call" on the
first hook the kit runs — `dedupe` forces a single copy. `optimizeDeps.exclude` keeps Vite
from snapshotting a symlinked dep, and `server.fs.allow` lets it serve sources from outside
the project root.

**Whichever way you switch, stop the dev server and delete `node_modules/.vite` first.** Vite
resolves a module once and keeps serving it from where it found it: link or unlink under a
running server and you get the provider from one copy and the hook from the other, which
surfaces as `useAuth must be used within a <RhAuthProvider>` on a component that is plainly
inside one.

## Structure

```
src/
  styles.css              ← design tokens + the DISPOSABLE default skin
  environments/
    environment.ts        ← apiUrl + feature flags
  routes.tsx              ← route map, feature-flag gating, lazy loading
  App.tsx                 ← fragment token capture + config screen + consents gate
  main.tsx                ← RhAuthProvider + RhPaymentsProvider + CartProvider
  consents-signal.ts      ← raises a flag on any 451
  ConsentsGate.tsx        ← acceptance overlay, above the router
  theme hook              ← light/dark toggle, persisted (in Shell.tsx)
  ui/alert/               ← the one shared feedback component
  shop/
    cart.tsx              ← cart state, persisted; the app's job, not the kit's
    pending-order.ts      ← carries order id + secret across the Stripe redirect
  pages/
    shop/                 ← catalog, cart, checkout, order return
    shell/                ← authenticated frame: header, nav, user menu
    home/                 ← PLACEHOLDER showcase — replace with your content
    auth/                 ← login, signup, verify, forgot/reset password
    invitations/accept/   ← one page, three flows (see below)
    billing/              ← billing accounts: list, detail (members/invites), new
    profile/              ← name, surname, change password
    legal/                ← Terms and Privacy — app pages, readable while the gate is up
    shop/                 ← catalog, cart, checkout, orders
```

### Route map

| Path | Guard | Shown when |
|---|---|---|
| `/auth/login` | `PublicGuard` | always |
| `/auth/signup` | `PublicGuard` | `emailRegistration \|\| oauthLogin` |
| `/auth/verify` | `PublicGuard` | `emailRegistration` |
| `/auth/forgot-password`, `/auth/reset-password` | `PublicGuard` | `passwordReset` |
| `/invitations/accept` | **none** — works signed-in or out | `teamInvitations` |
| `/`, `/product/:id`, `/cart`, `/orders` | **none** — a guest must be able to buy | always |
| `/app`, `/app/teams`, `/app/teams/new`, `/app/teams/:id`, `/app/account` | `AuthGuard` | always |
| anything else | — | redirects to `/` |

**The shop is at `/`, and that is the point.** It is where people arrive, and it is outside
`AuthGuard` because the whole of guest checkout is that it works without an account. Everything
needing one lives under `/app`.

`/order` must match the service's configured `success-url` — `ulabase.setup.ts` writes both from the
same constant, so they cannot disagree.

A path that matches nothing redirects to the shop. It used to render the authenticated home page
with no guard around it, so a typo showed a signed-out visitor the one page `/` itself refused
them.

Feature flags live in `src/environments/environment.ts` and must match your service's
**Sign-up Mgmt → Features** toggles. A flag that's off removes the route *and* the UI that
links to it.

## Customization

### The default skin is meant to be thrown away

`src/styles.css` holds two things: **design tokens** (section 1) and a **disposable
default skin** (sections 3–5). The look is deliberately a *mockup* — cohesive and
intentional, but obviously a scaffold. `@ulabase/kit-react` ships no UI at all, so
the components and this one stylesheet are the only places styling lives.

Two ways forward. Pick one:

**A. Tweak the skin** — fastest, roughly an hour to something that looks like yours:

1. Change the tokens in `styles.css` section 1 — colours, type scale, spacing, radii. Every
   component reads them, so this re-themes the whole app including dark mode.
2. Adjust the skin classes in section 3 if you want different shapes.
3. Replace the shell layout in `pages/shell/`.
4. Replace `pages/home/` with your own landing content.

**B. Adopt a UI framework** — Material, shadcn/ui, Tailwind, your own:

1. Delete sections 3–5 of `styles.css` (they are marked). Keep section 1 if you want the
   tokens; drop it too if your framework brings its own.
2. Reskin the components using the swap map below.

### Swap map

Components reference a small, stable vocabulary of semantic class hooks. Restyle them, or
replace each element with your framework's component:

| Class hook | Used for | Tailwind (example) | Material (example) |
|---|---|---|---|
| `.card` / `.card-header` | Section container + its title row | `rounded border p-6 mb-6` | `<Card>` |
| `.btn-primary` | The one accented action per form | `px-6 py-2 rounded bg-amber-400 font-semibold` | `<Button variant="contained">` |
| `.btn-secondary` | Quiet bordered action | `px-3 py-2 rounded border text-xs uppercase` | `<Button variant="outlined">` |
| `.btn-danger` / `.btn-danger-text` | Destructive action / inline variant | `… text-red-700 border-red-700` | `<Button variant="outlined" color="error">` |
| `.form-field` / `.form-field-sm` / `.form-row` | Label+control stack; `-sm` is narrow; `-row` lays fields side by side | `flex flex-col gap-1` / `flex gap-3` | `<TextField>` |
| `.password-field` / `.btn-toggle-password` | Password input with a Show/Hide toggle | `relative` / `absolute right-2` | `<TextField>` + end adornment |
| `.form-error` / `.field-error` | Form-level / per-field error | `rounded border border-red-300 bg-red-50 p-3` | `<FormHelperText error>` |
| `.success-msg` | Success feedback | `rounded border border-emerald-300 bg-emerald-50 p-3` | — (usually a snackbar) |
| `.muted` | Secondary/caption text | `text-sm text-gray-500` | `className="body2"` |
| `.badge` | Small status pill | `rounded-full px-2 text-xs uppercase` | `<Chip size="small">` |
| `.back-link` / `.eyebrow` | Back navigation / label above a title | `text-xs uppercase tracking-wide` | — |
| `.placeholder` / `.skeleton` | Empty-slot outline / loading block | `border border-dashed p-6` / `animate-pulse bg-gray-200` | `<LinearProgress>` |
| `.auth-page` / `.auth-card` / `.auth-links` / `.divider` | Centred auth layout | `min-h-screen grid place-items-center` / `w-90 rounded border p-8` | `<Card>` |
| `.config-page` / `.config-card` / `.config-status` / `.config-steps` | "Connect your service" screen | — | — |

Feedback is rendered through one component — `src/ui/alert/Alert.tsx` — which carries no
styles of its own, only the `.success-msg` / `.form-error` hooks plus the correct ARIA
roles. Swap that one component and every success/error message in the app follows.

Page-specific layout (`.team-row`, `.member-row`, `.feature-grid`, …) stays in the
component's own `.css` file and is not part of this contract.

## Reading your own data

Everything the starter does talks to `/auth/*`, `/token` and `/users/me` — the kit handles
those. For your application's own collections, use `auth.api`: it applies the session on the
way out, so you never attach the bearer token by hand.

```tsx
import { useAuth } from '@ulabase/kit-react';
import type { ApiError } from '@ulabase/kit-react';

function Notes() {
  const auth = useAuth();
  const [notes, setNotes] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auth.api('/notes?pagesize=10')
      .then(res => res.json())
      .then(setNotes)
      .catch((err: ApiError) => setError(err.message));
  }, [auth.api]);

  // …
}
```

Pass a path, not a URL. Any non-2xx rejects with an `ApiError` (`{ status, message }`), so a
`403` from an ACL or a `451` from a Guards rule is something you branch on rather than parse.

A plain `fetch` to the same URL is unauthenticated, and the service answers `401` — which
reads as "logged out" rather than "you forgot the header". That is the one mistake worth
knowing about in advance.

### Gating on consents

Registered users must accept the current Terms of Service and Privacy Policy before the app
serves them anything. This is on by default here (it came from the starter's
`feat/consents-gate` branch), with the server-side setup in
[the tutorial](https://ulabase.com/blog).

How it works, in three pieces:

| File | Role |
|---|---|
| `src/consents-signal.ts` | `config.onError` watches for a `451` and raises a flag |
| `src/ConsentsGate.tsx` | Sits above the router; swaps the whole app for the acceptance form while the flag is up |
| `src/pages/legal/Terms.tsx`, `Privacy.tsx` | Placeholder documents — replace with your own |
| `src/legal-versions.ts` | The versions the pages show and the setup enforces — one place |

The `451` comes from the Guards rule on the service, and `/users/me` is one of the requests it
refuses — so restoring the session is what trips the gate. There is nothing to probe.

The gate sits **above** the router deliberately: a blocked user cannot get past `AuthGuard`
either, so a gate placed inside the app would be unreachable.

The overlay is user experience, not enforcement. Remove it with the dev tools and every
request still comes back `451`; the rule lives on the server.

**Guests are a separate matter.** The gate stamps the *user document*, and a guest has none —
so a guest buying without an account never meets it. The checkout page collects their
acceptance with its own checkbox instead. See [Open points](#open-points) for what that does
and does not guarantee.

## Open points

Things this example does not settle. Read before copying it into a real shop.

### The service must be configured to match

Four settings have to line up or the flow breaks in ways that are not obvious from the client:

| Setting | Must be | Symptom when wrong |
|---|---|---|
| `stripeConfig.products.success-url` | path `/shop/order`, ideally with the `{ORDER_ID}`/`{ORDER_SECRET}` fragment (below) | the buyer lands on a 404 after paying |
| ACL: `GET /catalog` | readable anonymously | the shop is empty, no error |
| ACL: `POST /orders` | allowed anonymously with an email | guest checkout answers `401` |
| ACL: `GET /orders/{id}` | allowed anonymously, filtered on `?secret=` | the buyer pays, then the return page answers `401` |

The collection names are configurable server-side (`products.catalog-collection`,
`products.orders-collection`); if yours are renamed, set them in
`src/environments/environment.ts` — the kit takes them as parameters, it does not assume.

#### The same list, as something you can run

[`ulabase.setup.ts`](./ulabase.setup.ts) is that table as a setup, plus the collections, the indexes and
the `stripe` plugin's install and init:

```bash
npx @ulabase/cli setup --srv <srvId> --dry-run   # what is missing
npx @ulabase/cli setup --srv <srvId>             # make it so
```

Every step is a check and an apply, so running it against a service that is already configured
writes nothing and reports each step satisfied. Secrets are named rather than held:
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are read from the environment at apply time, and
only when the service does not already have them — so a re-run needs no secrets at all.

The table above is the *why*; the setup is the *how*, and the two live in the same repository so
they change in the same commit as the code they configure — which is the whole reason for it not
being a checklist.

> `@ulabase/cli` ships with the next kit release. Until it is on npm, install it from a
> checkout of `restheart-cloud-kit` with `npm link`.

### Configure the success URL to carry the order reference

Stripe substitutes only `{CHECKOUT_SESSION_ID}` in the success URL, so on its own the return
page does not know *which* order it is showing — and a guest has no session for the server to
recognise them by.

RESTHeart's `stripe` plugin interpolates `{ORDER_ID}` and `{ORDER_SECRET}` if you put them
there. **Configure it in the fragment**, so the secret never reaches a server log or a
`Referer` header:

```
/stripeConfig/products/success-url ->
  "https://your-app.example.com/shop/order#order={ORDER_ID}&secret={ORDER_SECRET}"
```

`OrderReturn.tsx` reads it with `readOrderRef()` and strips it from the address bar with
`clearOrderRef()` right away.

**If you skip this**, the app falls back to `src/shop/pending-order.ts`, which stashes the
reference in `localStorage` before redirecting. That covers the common case and fails in
three: `localStorage` blocked or full, a private window closed and reopened, and a payment
finished in a different browser from the one that started it. The fallback stays in the code
on purpose — the placeholders are opt-in, and a service configured before they existed still
works.

### Guest consent is a checkbox, not a record

A registered user's acceptance is enforced by a Guards rule and stamped on their user
document. A guest's is neither. The checkbox on the checkout page gates the button and nothing
else, and **the order carries no record that it was ticked** — the checkout interceptor rejects
any body key other than `items` and `email`, so there is nowhere to put it.

For a real shop this is not enough. Options, none implemented here: widen the interceptor to
accept and store a consent stamp, record it against the email in a separate collection, or
require an account to buy at all.

### Amounts assume one currency per cart

`formatPrice` is per-line and correct, but the cart subtotal adds line amounts together and
labels them with the first line's currency. A catalog that mixes currencies would show a
meaningless total. Stripe would reject the session anyway, so the failure is loud — but the
cart should refuse the mix earlier.

### Stock is optimistic, and can be oversold

`in_stock` lives on the product, or on the variant when there is one, and it is optional: a product
without it is one nobody counts, which is what most of a small catalogue wants. The shop refuses to
add what reads zero and clamps the quantity box to what is left.

**Nothing is reserved.** A cart holds no claim: the units come off when the payment lands, in one
atomic update per line. Two people can buy the last one, both payments succeed, and the order that
pushed the count below zero is marked `oversold: true`. The shop refunds it from the Stripe
dashboard, which comes back as `charge.refunded` and is already handled.

That is a trade, not an oversight. Reserving means an endpoint, a server-issued token, a per-cart
cap, a rate limit, expiry arithmetic, and a cart that stops being client-side — for the case where
two people want the last unit within the same half hour. Overselling costs a fee and an apologetic
email and is paid rarely; the complexity would be paid always. What the atomic decrement buys is
that the case is *visible*: `oversold` is in the order schema, and there is a warning in the log.

The seed carries the cases worth seeing: `pocket-thundercloud` has one left, the yellow L T-shirt
has one left, `jar-of-last-monday` is for sale with none, and the enamel mug counts nothing at all.

### Not covered

- **Restocking** — `in_stock` goes down when an order is paid and nothing puts it back up. That is
  on purpose, not a gap: the count is a field in a Mongo collection like any other, so restocking
  is done from the Ulabase console today, and the planned back-office screens will take it
  over. The shop has no page for it because the shop is not where it belongs.
- **Shipping** — Stripe collects the address on its own page, for the countries named in
  `products.shipping-address-countries`; the webhook writes it onto the order. **Tax** — left to
  Stripe's Checkout configuration.
- **Order history** — a signed-in buyer's past orders are readable via the orders collection, but there is no page for them.
- **Refunds** — `amount_refunded` is on the `Order` type and unused here.

## Packages used

- [`@ulabase/kit`](https://github.com/ulabase/kit/tree/main/packages/kit) — TypeScript auth logic (framework-agnostic)
- [`@ulabase/kit-react`](https://github.com/ulabase/kit/tree/main/packages/kit-react) — React context, hooks, and guards

## SEO

`src/seo.ts` sets per-page metadata, and `scripts/prerender.mjs` writes a real file per product so
link previews work. Why both are needed, how to refresh them on a schedule, and the hosting rule
that silently disables them: [SEO.md](./SEO.md).
