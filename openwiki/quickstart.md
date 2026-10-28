---
type: reference
title: Quick Start
description: Central entry point and task-routing map for the Ulabase Ecommerce Starter wiki — routes each job to the owning page (architecture, concepts, domains, workflows, integrations, operations) and covers first-time setup and key files.
tags: [quickstart, setup, onboarding, routing]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-28T14:01:51.932Z
sources:
  - id: openwiki-source-4e7cd7f381c92e8c5d89f5c1
    resource: repo://NOTES.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-23775c3de52f3ab95a13cb8b
    resource: repo://README.md
  - id: openwiki-source-eaae96b81373abab97667f4f
    resource: repo://src/environments/environment.ts
  - id: openwiki-source-95bfccfd0c712f6e72040e0d
    resource: repo://src/main.tsx
  - id: openwiki-source-07aa4341cebe71bfc8fd2890
    resource: repo://src/routes.tsx
  - id: openwiki-source-34f568b222540eb11aa44859
    resource: repo://ulabase.setup.ts
generated: { by: "openwiki/0.7.2", at: "2026-10-28T14:01:51.932Z" }
---

# Quick Start

Welcome to the Ulabase Ecommerce Starter documentation. This React SPA is a complete online shop — product catalogue, cart, Stripe card payments, and order lookup — powered by a managed Ulabase service. There is no custom backend to write, deploy, or pay for: the app talks to Ulabase via `@ulabase/kit-react`, and the service handles persistence, authentication, and Stripe integration.

This page is the routing map. Pick the job below and go to the owning page for the detail; the setup walkthrough at the bottom is enough to get a shop running.

## What you need

| Requirement | Notes |
|---|---|
| **Node.js 22.18+** | Runs the TypeScript setup file (`ulabase.setup.ts`) and the `ulabase` CLI |
| **A free Ulabase service** | Created at [ulabase.com](https://ulabase.com); the six-character service ID is in the URL |
| **A Stripe account** | Free to sign up; test mode works out of the box. Only needed when you want checkout |

The app boots with email/password auth and a demo catalogue. Google OAuth, custom products, and production Stripe keys are opt-in steps.

## Task routing

| I want to… | Go to |
|---|---|
| **Understand how the app boots** — provider tree, route map, lazy loading, where `ConsentsGate` sits | [Architecture Overview](./architecture/overview.md) |
| **Understand the platform** — managed service vs. the `@ulabase/kit` / `@ulabase/kit-react` / `@ulabase/cli` packages | [Ulabase Platform and Kit Packages](./concepts/ulabase-and-kit.md) |
| **Configure the service in code** — check/apply steps for Stripe, ACL, accounts, user schema and validation, catalog seeding, secrets, and versioned legal documents. Includes the two JWT claims (`latestConsents/tos`, `latestConsents/pp` — no team claim) and the consents acceptance + Guards gate | [Service Setup (ulabase.setup.ts)](./concepts/service-setup.md) |
| **Know what the shop requires from Ulabase** — provisions the service: Stripe products-mode config, ACL permissions (order list `readFilter` by active team), user schema, consents acceptance, token claims, Guards rule | [Ulabase Service Integration](./integrations/ulabase-service.md) |
| **Turn features on and off** — `environment.ts` flags, route/UI gating, matching service toggles | [Feature Flags and Environment Configuration](./concepts/feature-flags.md) |
| **Work on the catalogue** — browsing, filtering, search, product pages, variants, stock | [Shop Catalog and Product Pages](./domains/shop-catalog.md) |
| **Work on cart and orders** — client-side cart, checkout, order states, the pending-order stash across the Stripe redirect | [Cart and Order Lifecycle](./domains/cart-and-orders.md) |
| **Work on teams and billing** — billing accounts (teams), members and invitations, Stripe portal, order filtering by active team (`@team._id`, no team claim in the JWT) | [Billing Accounts (Teams)](./domains/billing-accounts.md) |
| **Trace a purchase end to end** — catalogue → cart → Stripe checkout → webhook → order return, for guests and signed-in buyers | [End-to-End Purchase Flow](./workflows/purchase-flow.md) |
| **Trace auth and invitations** — login, signup, verification, password reset, Google OAuth, invitation acceptance | [Authentication and Invitation Flows](./workflows/auth-and-invitations.md) |
| **Understand the consents gate** — consents acceptance + Guards rule blocks signed-in users with HTTP 451 until they accept the current TOS/Privacy Policy (two JWT claims, no team claim) | [Consents Gate Flow](./workflows/consents-gate.md) |
| **Configure Stripe** — keys, webhook events and signing secret, products mode, success URL | [Stripe Payment Integration](./integrations/stripe.md) |
| **Build and deploy** — environment configuration, `vite build` + prerender, static hosting, SEO | [Configuration and Deployment](./operations/configuration-and-deployment.md) |
| **Reskin the shop** — design tokens, semantic class hooks, swap map for a UI framework | [Customization and Theming](./operations/customization.md) |

## First-time setup in 10 minutes

### 1. Clone and install

```bash
git clone https://github.com/ulabase/starter-ecommerce.git
cd starter-ecommerce
npm install
```

### 2. Create a service

Create a **free service** at [ulabase.com](https://ulabase.com). Its ID is the six characters at the start of its URL.

### 3. Set it up

```bash
npm install -g ulabase   # or use npx ulabase in place of ulabase below
ulabase login
ulabase setup --srv <srvId>
```

`ulabase login` asks for a **personal access token** — create one in your [ulabase.com](https://ulabase.com) profile under Tokens. It carries the `cli` role for configuring services; revoking it touches nothing else.

`ulabase setup` configures the service (collections, ACL, seed data) and writes the service URL into `src/environments/environment.ts`. Commit that file when you publish your app. Checkout stays off until Stripe is configured — the cart says so.

### 4. Add Stripe payments (optional, when you want them)

You need two things from Stripe, both in **test mode** (toggle at the top right of the Stripe dashboard):

**The secret key.** [Developers → API keys](https://dashboard.stripe.com/test/apikeys), copy the one starting `sk_test_`.

**The webhook signing secret.** In [Developers → Webhooks](https://dashboard.stripe.com/test/webhooks), add an event destination:

1. **Events**: scope *Your account*, then select these six:
   ```
   checkout.session.completed
   checkout.session.async_payment_succeeded
   checkout.session.async_payment_failed
   checkout.session.expired
   charge.refunded
   charge.dispute.created
   ```
   Leave the API version as Stripe suggests.
2. **Destination type**: *Webhook endpoint*.
3. **Destination**: your service plus `/stripe/webhook`:
   ```
   https://xxxxxx.ulabase.app/stripe/webhook
   ```

Save it, then reveal the **signing secret** on the destination. It starts `whsec_`.

> Your service is on the public internet, so Stripe reaches it directly. The Stripe CLI and `stripe listen` are for a webhook arriving at your laptop, and you do not need them here.

Then run the setup again with the two keys:

```bash
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...
ulabase setup --srv <srvId>
```

The service keeps the keys: later runs ask for nothing.

### 5. Start

```bash
npm run dev
```

Open [localhost:5173](http://localhost:5173). Buy a demo product with Stripe's test card `4242 4242 4242 4242`.

## Key files

| File | Role |
|---|---|
| `src/environments/environment.ts` | API URL, collection names, feature flags |
| `ulabase.setup.ts` | Declarative service configuration — runs via `@ulabase/cli` |
| `src/main.tsx` | Provider tree: `RhAuthProvider` → `RhPaymentsProvider` → `RhCartProvider` |
| `src/routes.tsx` | Route map with feature-flag gating and lazy loading |
| `src/styles.css` | Design tokens (section 1) and disposable default skin (sections 3–5) |
| `src/shop/pending-order.ts` | Stashes order reference across the Stripe redirect |

## Next steps

- **[Architecture Overview](./architecture/overview.md)** — understand the provider tree, route map, and how the app bootstraps.
- **[Service Setup](./concepts/service-setup.md)** — deep dive into `ulabase.setup.ts` and how the CLI applies it.
- **[End-to-End Purchase Flow](./workflows/purchase-flow.md)** — trace the buyer journey from catalogue to Stripe checkout to order confirmation.
- **[Stripe Integration](./integrations/stripe.md)** — webhook events, checkout session creation, and order status transitions.
