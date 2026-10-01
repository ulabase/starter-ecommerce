---
type: "Reference"
title: "Quickstart — Ulabase Ecommerce Starter"
openwiki_generated: true
verified:
  - by: openwiki/0.6.1
    at: 2026-10-01T12:11:43.532Z
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
generated: { by: "openwiki/0.6.1", at: "2026-10-01T12:11:43.532Z" }
---


# Quickstart — Ulabase Ecommerce Starter

Welcome to the Ulabase Ecommerce Starter documentation. This React SPA is a complete online shop — product catalogue, cart, Stripe card payments, and order lookup — powered by a managed Ulabase service. There is no custom backend to write, deploy, or pay for: the app talks to Ulabase via `@ulabase/kit-react`, and the service handles persistence, authentication, and Stripe integration.

## What you need

| Requirement | Notes |
|---|---|
| **Node.js 18+** | Local development and the `ulabase` CLI |
| **A free Ulabase service** | Created at [ulabase.com](https://ulabase.com); the six-character service ID is in the URL |
| **A Stripe account** | Free to sign up; test mode works out of the box |

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

1. **Clone and install:**
   ```bash
   git clone https://github.com/ulabase/starter-ecommerce.git
   cd ulabase-starter-ecommerce
   npm install
   ```

2. **Point at your service** — copy the URL from your service's *Connect* page into `src/environments/environment.ts`:
   ```ts
   apiUrl: 'https://xxxxxx.ulabase.app',
   ```

3. **Configure the service** — create a Stripe webhook destination (six events, destination type *Webhook endpoint*, URL `https://xxxxxx.ulabase.app/stripe/webhook`), then:
   ```bash
   npm install -g ulabase
   export STRIPE_SECRET_KEY=sk_test_...
   export STRIPE_WEBHOOK_SECRET=whsec_...
   ulabase login
   ulabase setup --srv <srvId>
   ```
   The `ulabase login` command asks for a personal access token (created in your Ulabase profile), not your account password.

4. **Start:**
   ```bash
   npm run dev
   ```
   Open [localhost:5173](http://localhost:5173). Buy a demo product with Stripe's test card `4242 4242 4242 4242`.

You only need the Stripe keys the first time. Subsequent `ulabase setup` runs ask for nothing.

## Key files

| File | Role |
|---|---|
| `src/environments/environment.ts` | API URL, collection names, feature flags |
| `ulabase.setup.ts` | Declarative service configuration — runs via `@ulabase/cli` |
| `src/main.tsx` | Provider tree: `RhAuthProvider` → `RhPaymentsProvider` → `RhCartProvider` |
| `src/routes.tsx` | Route map with feature-flag gating and lazy loading |
| `src/styles.css` | Design tokens (section 1) and disposable default skin (sections 3–5) |
| `src/shop/cart.ts` | Client-side cart state (persisted) |
| `src/shop/pending-order.ts` | Stashes order reference across the Stripe redirect |

## Next steps

- **[Architecture Overview](./architecture/overview.md)** — understand the provider tree, route map, and how the app bootstraps.
- **[Service Setup](./concepts/service-setup.md)** — deep dive into `ulabase.setup.ts` and how the CLI applies it.
- **[End-to-End Purchase Flow](./workflows/purchase-flow.md)** — trace the buyer journey from catalogue to Stripe checkout to order confirmation.
- **[Stripe Integration](./integrations/stripe.md)** — webhook events, checkout session creation, and order status transitions.
