---
type: setup-configuration
title: Service Setup (ulabase.setup.ts)
description: Declarative setup file that defines check/apply steps for configuring Ulabase services including Stripe, accounts, ACL, Guards, and consents
tags: [setup, configuration, stripe, accounts, acl, guards, consents, declarative]
verified:
  - by: openwiki/0.7.2
    at: 2026-10-28T14:01:51.932Z
sources:
  - id: openwiki-source-192c27e8048436d93b29c2cb
    resource: repo://src/catalog.seed.ts
  - id: openwiki-source-e97943e8cdae3243b0c06632
    resource: repo://src/legal-versions.ts
  - id: openwiki-source-34f568b222540eb11aa44859
    resource: repo://ulabase.setup.ts
generated: { by: "openwiki/0.7.2", at: "2026-10-28T14:01:51.932Z" }
---

# Service Setup (ulabase.setup.ts)

The `ulabase.setup.ts` file is a declarative setup configuration that defines what a Ulabase service needs to run the shop application. It specifies check and apply steps for every service configuration, ensuring the service is properly configured with all required features, permissions, and data.

## Overview

The setup file replaces manual configuration checklists with executable code. Instead of remembering which settings must match or running multiple scripts, a single command configures the entire service:

```bash
npx @ulabase/cli setup --srv <srvId>
```

With `--dry-run`, it checks what the service is missing without making changes. Every step is idempotent—running against an already-configured service writes nothing and reports each step as satisfied.

## The Check/Apply Pattern

Each configuration step follows a two-phase pattern:

1. **Check**: Examines whether the desired state is already satisfied
2. **Apply**: Configures the service if the check fails

This pattern ensures:
- **Idempotency**: Re-running against a configured service writes nothing
- **Safety**: Checks verify actual state, not just presence of configuration
- **Transparency**: `--dry-run` shows exactly what needs fixing
- **Reliability**: Failed applies can be retried without side effects

```mermaid
flowchart TD
    A["Start setup"] --> B{"Step check"}
    B -->|"Satisfied"| C["Step complete"]
    B -->|"Not satisfied"| D["Step apply"]
    D --> E{"Re-check"}
    E -->|"Satisfied"| C
    E -->|"Still failing"| F["Report error and stop"]
    C --> G{"Next step"}
    G -->|"Yes"| B
    G -->|"No"| H["Setup complete"]
```

*Each step checks desired state, applies only when the check fails, then re-checks so a satisfied step is verified.*

## Step Groups

### Stripe Configuration

The setup installs and configures Stripe for payment processing:

1. **Feature Installation**: Installs the Stripe feature plugin
2. **Products Mode Configuration**: Configures Stripe products, success/cancel URLs, shipping countries, session expiration, and notification settings
3. **Collections Initialization**: Creates required collections (`orders`, `transactions`) with proper indexes

### ACL Permissions

Five permissions control catalog and order access:

- **Catalog Read**: Allows anyone (`$unauthenticated` and `user` roles) to browse purchasable products
- **Order Creation**: Allows anyone to place orders via POST
- **Order Read**: Allows reading individual orders with secret verification
- **Order List**: Allows signed-in users to list orders from their billing account
- **Stripe Portal**: Allows signed-in users to access Stripe billing portal

### Accounts Configuration

The accounts feature provides authentication:

1. **Feature Installation**: Installs the accounts feature
2. **Configuration**: Sets app name, frontend URLs, and feature flags (registration, verification, password reset, invitations, OAuth)
3. **Google OAuth** (optional): Configures Google OAuth credentials when enabled

### User Schema and Validation

A JSON schema validates user documents:

- **Schema Storage**: Stores a schema that defines required fields (`_id`, `roles`). `password` and `profile` are deliberately optional: an invited user is written with no password and an empty profile, so requiring them would refuse every invitation.
- **Collection Validation**: Applies the schema to the `users` collection
- **Consents Fields**: Includes `latestConsents` and `consents` fields for legal document tracking

### Consents System

The consents system manages legal document acceptance:

1. **Permission**: Allows users to update their own consents via PATCH. The permission's `mergeRequest` stamps the current versions and appends to the `consents` history.
2. **Token Claims**: Ensures `latestConsents/tos` and `latestConsents/pp` are included in authentication tokens (configured via `account-properties-claims` on the `auth` feature). There is no team claim — the orders list `readFilter` reads `@team._id`, which the server resolves at every request.
3. **Guards Rule**: Blocks users who haven't accepted current legal versions (HTTP 451).

## Secrets Handling

Secrets are managed with a "variable wins" strategy:

```typescript
const secret = (name: string, stored: unknown) => {
  const fromEnvironment = process.env[name];
  if (fromEnvironment !== undefined && fromEnvironment !== '') {
    pushed.add(name);
    return fromEnv(name);
  }
  return stored;
};
```

**Key principles:**
- `fromEnv` marks a secret for resolution at apply time ("on the way to the wire")
- Environment variables override stored values ("variable wins"): when the variable is set, the function returns `fromEnv(name)` and records the name in the pushed set; otherwise it returns the stored value
- A secret named in the environment is one you are asking to be written, so the step is not satisfied until it has been — `wantsReplacing` consults the pushed set to know this
- Stored secrets read back as bullets; empty strings mean never set
- Re-running against a configured service needs no secrets in the environment
- Changing a secret from the environment works by exporting the key and re-running

## SHOPPERS Role Configuration

The shop sells to both guests and signed-in users:

```typescript
const SHOPPERS = ['$unauthenticated', 'user'];
```

**Why one permission with two roles, not two permissions:**

The ACL authorizer matches only the first permission it finds for a request. With two separate permissions:
- `$unauthenticated` alone would break for signed-in users (they'd get 403)
- Two rules for the same path would make which one applies depend on role order

One permission with both roles ensures consistent access regardless of authentication state.

## Catalog Seeding

The setup includes demo products for initial shop display:

- **Content, not configuration**: Seeds only when catalog is empty
- **Never overwrites**: Re-running the setup doesn't reset real data to demo data
- **Idempotent**: Uses upsert to allow partial seeding runs
- **Delete when ready**: Remove the seeding step when the shop becomes yours
- **Checks for emptiness**: The check asks whether the catalog holds anything at all, not whether specific products are present

## Versioned Legal Documents

Legal document versions are managed centrally:

- **TOS_VERSION** and **PP_VERSION** define current versions in `src/legal-versions.ts`
- **Permission stamps** versions when users accept via `mergeRequest`
- **Guards rule** compares token claims against current versions
- **Updating versions** forces re-acceptance on next request
- **Version comparison**: The guard blocks when either acceptance is missing (`not (A and B)`)

## Dependencies and Order

The steps run in a fixed order. Stripe and accounts are logically independent, but the consents steps must follow accounts because they write against the `users` collection the accounts feature owns. The app is pointed at the service only after every other step is in place.

```mermaid
flowchart TD
    A["Stripe feature"] --> B["Stripe products config"]
    B --> C["Stripe collections"]
    C --> D["Catalog read permission"]
    D --> E["Order create permission"]
    E --> F["Order read permission"]
    F --> G["Order list permission"]
    G --> H["Stripe portal permission"]
    H --> I["Sample catalog"]
    I --> J["Accounts feature"]
    J --> K["Accounts config"]
    K --> L["Google OAuth optional"]
    L --> M["User schema stored"]
    M --> N["Users collection validated"]
    N --> O["Consents permission"]
    O --> P["Token claims"]
    P --> Q["Guards feature"]
    Q --> R["Guards rule"]
    R --> S["App points at service"]
```

*Step order in `ulabase.setup.ts`: Stripe and accounts configure independently, consents steps follow accounts, and the app is pointed at the service only after every other step is in place.*

## Running the Setup

### Basic Usage
```bash
npx @ulabase/cli setup --srv <srvId>
```

### Dry Run (Check Only)
```bash
npx @ulabase/cli setup --srv <srvId> --dry-run
```

### Environment Variables
- `SHOP_ORIGIN`: Where the shop is served from (default: `http://localhost:5173`)
- `APP_NAME`: Shown in emails (default: `Ulabase Shop`)
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

## Invariants and Failures

**Key invariants:**
- Every step must be idempotent
- Checks verify actual state, not just presence
- Secrets are resolved at apply time, not check time
- Catalog data is never overwritten by setup runs
- The app is pointed at the service only after all other steps complete

**Failure modes:**
- Missing environment variables cause `fromEnv` to throw
- Invalid configurations are caught by service validation
- Version mismatches between permission and guards rule cause permanent blocking
- Missing ACL permissions result in 403 errors for specific operations

## Extension Points

The setup can be extended by:
- Adding new steps to the `defineSetup` array
- Modifying the `SHOPPERS` roles for different access patterns
- Updating `SHIPPING_COUNTRIES` for different regions
- Adding new legal document versions
- Customizing the user schema for additional fields
- Exporting the `appPointsAtService` step to keep it last in extended setups

## Configuration/Operations

**Updating legal documents:**
1. Edit `TOS_VERSION` and `PP_VERSION` in `src/legal-versions.ts`
2. Re-run the setup
3. All users will be prompted to accept new versions on next request
4. The acceptance they already gave stays in the `consents` history

**Changing secrets:**
1. Export the environment variable (e.g., `STRIPE_SECRET_KEY`)
2. Re-run the setup
3. The new value will be written to the service

**Adding products:**
1. Edit `src/catalog.seed.json`
2. Re-run setup (only affects empty catalogs)
3. Or manually add products to the catalog collection

## Related Pages

- [Feature Flags](feature-flags.md) - App-side feature toggles that drive setup configuration
- [Stripe Integration](../integrations/stripe.md) - Stripe-specific configuration details
- [Ulabase Service](../integrations/ulabase-service.md) - Service architecture and APIs
- [Consents Gate](../workflows/consents-gate.md) - How the consent gate blocks unaccepted users
- [Billing Accounts](../domains/billing-accounts.md) - Teams, billing accounts, and order filtering by `@team._id`
