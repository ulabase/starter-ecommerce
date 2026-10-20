---
type: reference
title: Quickstart — Ulabase Ecommerce Starter
description: Entry point for the wiki — routes readers to the right section based on their goal. Covers first-time setup, key files, and links to every wiki section.
tags: [quickstart, setup, onboarding, routing]
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
generated: { by: "openwiki/0.7.2", at: "2026-10-11T09:48:34.925Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-20T08:19:28.862Z
---

# Quickstart — Ulabase Ecommerce Starter

Welcome to the Ulabase Ecommerce Starter documentation. This React SPA is a complete online shop — product catalogue, cart, Stripe card payments, and order lookup — powered by a managed Ulabase service. There is no custom backend to write, deploy, or pay for: the app talks to Ulabase via `@ulabase/kit-react`, and the service handles persistence, authentication, and Stripe integration.

## What you need

| Requirement | Notes |
|---|---|
| **Node.js 22.18+** | Runs the TypeScript setup file (`ulabase.setup.ts`) and the `ulabase` CLI |
| **A free Ulabase service** | Created at [ulabase.com](https://ulabase.com); the six-character service ID is in the URL |
| **A Stripe account** | Free to sign up; test mode works out of the box. Only needed when you want checkout |

The app boots with email/password auth and a demo catalogue. Google OAuth, custom products, and production Stripe keys are opt-in steps.

## Quick paths

Start here depending on what you want to do:

| I want to… | Go to |
|---|---|
| **Understand the app** — architecture, provider tree, route map, how it boots | [Architecture Overview](./architecture/overview.md) |
| **Add a feature** — understand the purchase flow, cart lifecycle, auth, or billing | [Workflows](./workflows/) and [Domains](./domains/) |
| **Configure Stripe** — keys, webhooks, products mode, success URL | [Stripe Integration](./integrations/stripe.md) |
| **Deploy** — environment variables, build, static hosting, SEO prerendering | [Configuration, Build, and Deployment](./operations/configuration-and-deployment.md) |
| **Reskin the shop** — design tokens, semantic class hooks, swap map for framework migration | [Customization and Theming](./operations/customization.md) |

## Major wiki sections

| Section | What it covers |
|---|---|
| **[Architecture](./architecture/)** | The React SPA, provider tree, route map, and how the app bootstraps with no custom server. |
| **[Concepts](./concepts/)** | Foundational pieces: the `ulabase.setup.ts` declarative configuration file, feature flags and environment configuration, and the relationship between Ulabase platform and the kit packages. |
| **[Workflows](./workflows/)** | End-to-end flows: the purchase journey, authentication and invitation handling, and the consents gate that blocks users who haven't accepted the current legal documents. |
| **[Domains](./domains/)** | The shop's core domains: product catalogue browsing, cart and order lifecycle, and billing accounts (teams). |
| **[Operations](./operations/)** | Running and customizing the app: environment configuration, build pipeline, static hosting, theming, and design tokens. |
| **[Integrations](./integrations/)** | External services: the Stripe payment integration (webhooks, checkout sessions, order status) and the Ulabase service configuration (ACL permissions, Guards rules, collection schemas). |

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
