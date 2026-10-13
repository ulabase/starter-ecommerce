---
type: reference
title: Architecture Overview
description: Describes the React SPA bootstrap process, provider tree (BrowserRouter → RhAuthProvider → RhPaymentsProvider → RhCartProvider → App), route map with feature-flag gating, Shell component, ConsentsGate placement, lazy loading, and configuration fallback.
tags: [architecture, react, spa, providers, routing, feature-flags, consents, shell]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-13T10:18:39.801Z
sources:
  - id: openwiki-source-4e7cd7f381c92e8c5d89f5c1
    resource: repo://NOTES.md
  - id: openwiki-source-54631e6ebf1d3b815c4a5eed
    resource: repo://src/App.tsx
  - id: openwiki-source-def8b68a3bfae964ad61c3db
    resource: repo://src/ConfigPage.tsx
  - id: openwiki-source-a3fd7ec517783a7d5d8842d0
    resource: repo://src/consents-signal.ts
  - id: openwiki-source-9674080b0675d512256b80bc
    resource: repo://src/ConsentsGate.tsx
  - id: openwiki-source-eaae96b81373abab97667f4f
    resource: repo://src/environments/environment.ts
  - id: openwiki-source-95bfccfd0c712f6e72040e0d
    resource: repo://src/main.tsx
  - id: openwiki-source-d246777daf29ea6fdf9f8b53
    resource: repo://src/pages/shell/Shell.tsx
  - id: openwiki-source-07aa4341cebe71bfc8fd2890
    resource: repo://src/routes.tsx
generated: { by: "openwiki/0.7.2", at: "2026-10-13T10:18:39.801Z" }
---

# Architecture Overview

This application is a client-side React Single-Page Application (SPA) that communicates with a Ulabase service via `@ulabase/kit-react`. There is no custom backend; all server-side logic is handled by the Ulabase service.

## Bootstrap Process

The application bootstraps through a carefully orchestrated sequence:

1. **Entry Point**: `index.html` loads `src/main.tsx` as a module
2. **Provider Nesting**: The app wraps itself in a provider hierarchy that establishes context for auth, payments, and cart functionality
3. **Fragment Token Capture**: `App.tsx` captures any `access_token` from the URL fragment for OAuth flows
4. **API Validation**: If `apiUrl` is not configured or invalid, the app shows a `ConfigPage` fallback
5. **Consents Gate**: For authenticated users, the `ConsentsGate` component wraps the router to enforce Terms/Privacy acceptance

## Provider Tree

The application uses a nested provider structure that establishes all necessary contexts:

```mermaid
flowchart TD
    A["BrowserRouter"] --> B["RhAuthProvider"]
    B --> C["RhPaymentsProvider"]
    C --> D["RhCartProvider"]
    D --> E["App"]
    E --> F["ConsentsGate"]
    F --> G["Router"]
    E --> H["Footer"]

    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#fce4ec
    style F fill:#f1f8e9
    style G fill:#e3f2fd
    style H fill:#e3f2fd
```

**Provider Responsibilities**:

- **BrowserRouter**: React Router context for navigation
- **RhAuthProvider**: Authentication state, session management, user data
- **RhPaymentsProvider**: Stripe payments integration and billing portal
- **RhCartProvider**: Shopping cart state and persistence
- **App**: Core application logic including fragment token capture and API validation; renders ConsentsGate wrapping the route output and the Footer as a sibling outside the gate
- **ConsentsGate**: Enforces Terms of Service and Privacy Policy acceptance for authenticated users
- **Footer**: Rendered outside ConsentsGate so it appears on every screen, including the consents acceptance overlay

## Route Map and Guards

The application uses React Router with lazy-loaded routes and feature-flag gating. The shop is intentionally outside `AuthGuard` to allow guest browsing and purchasing.

### Core Routes

| Path | Guard | Shown When | Purpose |
|------|-------|------------|---------|
| `/` | None (Shell) | Always | Shop front page |
| `/product/:id` | None (Shell) | Always | Individual product page |
| `/cart` | None (Shell) | Always | Shopping cart |
| `/orders` | None (Shell) | Always | Order history and Stripe return |
| `/terms` | None (Shell) | Always | Terms of Service (readable while consents gate is up) |
| `/privacy` | None (Shell) | Always | Privacy Policy (readable while consents gate is up) |
| `/checkout` | None (Shell) | Always | Redirects to `/cart` (kept for bookmarked URLs) |
| `/order` | None (Shell) | Always | Redirects to `/orders` (kept for success URL compatibility) |

### Auth Routes (Feature-flagged)

| Path | Guard | Feature Flag | Purpose |
|------|-------|--------------|---------|
| `/auth/login` | PublicGuard | Always | Login form |
| `/auth/signup` | PublicGuard | `emailRegistration` or `oauthLogin` | Registration form |
| `/auth/verify` | PublicGuard | `emailRegistration` | Email verification |
| `/auth/forgot-password` | PublicGuard | `passwordReset` | Password reset request |
| `/auth/reset-password` | PublicGuard | `passwordReset` | Password reset form |

### Invitation Routes

| Path | Guard | Feature Flag | Purpose |
|------|-------|--------------|---------|
| `/invitations/accept` | None | `teamInvitations` | Team invitation acceptance (works signed-in or out) |

### Protected Routes (require authentication)

| Path | Guard | Purpose |
|------|-------|---------|
| `/profile` | AuthGuard | User profile management |
| `/billing` | AuthGuard | Billing accounts list |
| `/billing/new` | AuthGuard | New billing account creation |
| `/billing/:id` | AuthGuard | Billing account details |

### Catch-all Route

| Path | Destination | Purpose |
|------|-------------|---------|
| `*` | `/` | Redirects unknown paths to the shop |

## Shell Component

The `Shell` component (`src/pages/shell/Shell.tsx`) wraps all routes except auth pages. It provides:

- **Header and Navigation**: Logo, Shop/Cart links, theme switcher
- **User Menu**: Avatar with dropdown for authenticated users
- **Guest Actions**: Login/Sign up buttons for unauthenticated users
- **Theme Toggle**: Light/dark mode persisted in localStorage
- **Scroll Management**: Resets scroll position on page navigation
- **Outlet Rendering**: Renders child routes via React Router's `<Outlet />`

The Shell intentionally has no `AuthGuard` around it, ensuring guests see the header and navigation on all shop pages.

## Consents Gate

The `ConsentsGate` (`src/ConsentsGate.tsx`) enforces Terms/Privacy acceptance for authenticated users:

- **Position**: Sits above the router in the component tree
- **Mechanism**: Listens for `451` responses from the Ulabase service via `consents-signal.ts`
- **Trigger**: Session restoration (`/users/me`) fails with `451` if user hasn't accepted current Terms
- **User Experience**: Shows acceptance overlay with checkboxes for Terms and Privacy
- **Legal Pages**: `/terms` and `/privacy` remain accessible while the gate is active
- **Server Enforcement**: The overlay is UX only; the server continues returning `451` until acceptance

## Lazy Loading and Suspense

All routes use React's lazy loading with a custom `SuspenseWrapper`:

- **Lazy Imports**: Each route component is dynamically imported
- **Suspense Fallback**: Shows a minimal "Loading..." message instead of a spinner
- **Performance**: Reduces initial bundle size and improves load times
- **UX Consideration**: Deliberately quiet fallback to avoid distraction during Stripe redirects

## Feature Flags

Feature flags in `src/environments/environment.ts` control which routes and UI elements are available:

- **`emailRegistration`**: Enables signup and email verification routes
- **`passwordReset`**: Enables forgot/reset password routes
- **`oauthLogin`**: Enables OAuth login (Google sign-in)
- **`teamInvitations`**: Enables team invitation acceptance route

When a feature flag is disabled, both the route and any UI linking to it are removed.

## Configuration Fallback

If `apiUrl` is not configured or invalid:

1. `App.tsx` validates the URL using `isValidApiBaseUrl`
2. If invalid, renders `ConfigPage` instead of the router
3. `ConfigPage` shows a three-step setup flow:
   - **Create a free service** at ulabase.com (skip if you already have one)
   - **Set it up from this folder** with `npx ulabase login` and `npx ulabase setup --srv <your service id>` — payments are optional; the setup runs without Stripe keys, and checkout turns on later with the test keys
   - **Reload** to replace the configuration screen with the sign-in page
4. The page displays whether `apiUrl` is set to an invalid URL or not set at all
5. No API calls are made; the app is in a safe, non-functional state

## Key Design Decisions

1. **No Custom Backend**: All server logic lives in the Ulabase service; the frontend is a pure SPA
2. **Guest-First Shop**: The shop is at `/` and outside `AuthGuard` to maximize conversion
3. **Consents Above Router**: The consents gate sits above the router because a blocked user can't pass `AuthGuard`
4. **Shell for Everyone**: The Shell provides consistent navigation for both guests and authenticated users
5. **Fragment Token Capture**: OAuth tokens are captured from URL fragments and stripped from history
6. **Feature-Flag Gating**: Routes and UI are removed when features are disabled, not just hidden
