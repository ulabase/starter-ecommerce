---
type: "Operations"
title: "Configuration, Build, and Deployment"
description: "Covers environment configuration, the build pipeline (Vite + prerender), static hosting requirements, and SEO prerendering."
tags: ["configuration", "build", "deployment", "vite", "prerender", "seo", "s3", "cloudfront", "static-hosting"]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-01T12:11:43.532Z
sources:
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-c83a8d61677eda2bd5d4ea73
    resource: repo://scripts/prerender.mjs
  - id: openwiki-source-754ef46985b85d02e813b322
    resource: repo://SEO.md
  - id: openwiki-source-eaae96b81373abab97667f4f
    resource: repo://src/environments/environment.ts
  - id: openwiki-source-146419bb9b2415894a6bd677
    resource: repo://src/styles.css
  - id: openwiki-source-dce9c746263f4480abb128e6
    resource: repo://src/viewport-height.ts
  - id: openwiki-source-5e1b077422a94ae165e88e4e
    resource: repo://vite.config.ts
generated: { by: "openwiki/0.6.1", at: "2026-10-01T12:11:43.532Z" }
---

# Configuration, Build, and Deployment

This page covers how the Ulabase Starter Ecommerce app is configured, built, and deployed as a static site. The app uses Vite for bundling, a prerender script for SEO optimization, and can be hosted on any static hosting service with proper URL rewriting.

## Environment Configuration

The app's runtime configuration lives in `src/environments/environment.ts`. This file controls the API endpoint, collection names, and feature flags.

### Core Properties

```typescript
export const environment = {
  // Your Ulabase service URL (not the admin node)
  apiUrl: '',
  
  // Collection names (must match service configuration)
  catalogCollection: 'catalog',
  catalogOrdersCollection: 'orders',
  
  // Feature flags
  features: {
    emailRegistration: true,
    passwordReset: true,
    oauthLogin: false,
    oauthProviders: ['google'] as const,
    teamInvitations: true,
  },
};
```

**Critical**: `apiUrl` must point to your tenant service (e.g., `https://xxxxxx.ulabase.app`), not the admin node (`api.ulabase.com`). The app validates this at startup and shows a configuration screen if invalid.

### Feature Flags

Feature flags control which authentication and team management features are available. These must match the corresponding toggles on your Ulabase service:

- **`emailRegistration`**: Enables email/password registration and verification
- **`passwordReset`**: Enables password reset functionality  
- **`oauthLogin`**: Enables OAuth login (currently only Google)
- **`teamInvitations`**: Enables team invitation flows

See [Feature Flags and Environment Configuration](../concepts/feature-flags.md) for detailed flag behavior.

## Build Pipeline

The build process is defined in `package.json`:

```bash
npm run build
```

This runs three sequential steps:

1. **`tsc -b`**: TypeScript type checking
2. **`vite build`**: Production bundling and asset optimization
3. **`node scripts/prerender.mjs`**: SEO prerendering (optional, requires environment variables)

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->
```text
flowchart TD
    A[Start Build] --> B[tsc -b<br/>Type Check]
    B --> C[vite build<br/>Bundle & Optimize]
    C --> D{SHOP_API_URL<br/>& SHOP_PUBLIC_URL<br/>set?}
    D -->|Yes| E[prerender.mjs<br/>Generate Product Pages]
    D -->|No| F[Skip Prerender<br/>Continue Build]
    E --> G[Output dist/]
    F --> G
    
    style A fill:#e1f5fe
    style B fill:#e8f5e8
    style C fill:#e8f5e8
    style D fill:#fff3e0
    style E fill:#e8f5e8
    style F fill:#fce4ec
    style G fill:#f3e5f5
```

*The build pipeline: type checking, bundling, and optional SEO prerendering.*

### Vite Configuration

The Vite config (`vite.config.ts`) is minimal:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

When linking local kit packages for development, add these settings back:

```typescript
resolve: { dedupe: ['react', 'react-dom', 'react-router-dom'] },
optimizeDeps: { exclude: ['@ulabase/kit', '@ulabase/kit-react'] },
server: { fs: { allow: ['..'] } },
```

## SEO Prerendering

The prerender script (`scripts/prerender.mjs`) generates static HTML files for each product, enabling link previews on platforms that don't execute JavaScript (Slack, WhatsApp, X, LinkedIn).

### How It Works

1. **Reads the catalog** from your live Ulabase service
2. **Generates `dist/product/<id>/index.html`** for each product
3. **Creates `sitemap.xml`** listing all product URLs
4. **Creates `robots.txt`** with sitemap reference

Each generated HTML file contains:
- Product-specific `<title>`, description, and Open Graph tags
- Schema.org `Product` JSON-LD structured data (price, availability, images)
- The same app shell as `dist/index.html`

### Environment Variables

Prerendering requires two environment variables:

```bash
SHOP_API_URL=https://xxxxxx.ulabase.app \
SHOP_PUBLIC_URL=https://ilmionegozio.com \
npm run build
```

- **`SHOP_API_URL`**: Your Ulabase service URL
- **`SHOP_PUBLIC_URL`**: Your public website URL (used for canonical URLs and sitemap)
- **`SHOP_CATALOG_COLLECTION`**: Optional, defaults to `catalog`
- **`SHOP_SHELL`**: Optional, set to `remote` to fetch shell from deployed site

**Graceful degradation**: If `SHOP_API_URL` or `SHOP_PUBLIC_URL` are not set, the script skips itself and the build continues without prerendering.

### SHOP_SHELL=remote Mode

For scheduled refreshes without rebuilding:

```bash
SHOP_SHELL=remote \
SHOP_API_URL=https://xxxxxx.ulabase.app \
SHOP_PUBLIC_URL=https://ilmionegozio.com \
node scripts/prerender.mjs
```

This fetches `index.html` from your deployed site instead of `dist/`, so you can update product data without running `npm install` or `vite build`.

## Static Hosting Requirements

### S3 + CloudFront Deployment

S3 requires specific configuration for SPA routing:

#### 1. Extensionless URLs

The canonical URL is `/product/<id>` (no trailing slash), but the file is at `product/<id>/index.html`. Use a CloudFront function on viewer-request:

```javascript
async function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    // Check whether the URI is missing a file name.
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    }
    // Check whether the URI is missing a file extension.
    else if (!uri.includes('.')) {
        request.uri += '/index.html';
    }
    
    return request;
}
```

#### 2. SPA Routes

Routes like `/cart` and `/orders` have no generated file. Configure custom error responses:
- 403 → `/index.html` (response code 200)
- 404 → `/index.html` (response code 200)

#### 3. Cache-Control Headers

Use tiered TTLs to avoid invalidations:

```bash
# Static assets (immutable)
aws s3 sync dist/ s3://$BUCKET/ --delete \
  --exclude "*.html" --exclude "sitemap.xml" --exclude "robots.txt" \
  --cache-control "public,max-age=31536000,immutable"

# HTML and sitemap (short-lived)
aws s3 sync dist/ s3://$BUCKET/ --delete \
  --exclude "*" --include "*.html" --include "sitemap.xml" --include "robots.txt" \
  --cache-control "public,max-age=60,stale-while-revalidate=2592000"
```

**Why no invalidations**: HTML refreshes itself via short TTL. Static assets are content-hashed by Vite, so new filenames = new cache entries.

### Verification

Test that prerendered pages are served correctly:

```bash
curl -s https://ilmionegozio.com/product/mug-enamel | grep '<title>'
```

- Product name = working
- Generic shop title = rewrite is eating the pages

## Styles Architecture

The global stylesheet (`src/styles.css`) is a disposable default skin:

### Section 1: Design Tokens
CSS custom properties for colors, typography, spacing, and shape. Re-theme the entire app by modifying this section.

### Sections 3-5: Disposable Skin
Default styling using the token vocabulary. Templates reference semantic class hooks (`.card`, `.btn-primary`, `.form-field`, etc.) for easy replacement.

**Two customization paths**:
1. **Tweak**: Modify tokens in section 1, then skin classes in section 3
2. **Replace**: Delete sections 3-5, adopt Material/Spartan/Tailwind, and reskin using the swap map in README.md

## Mobile Viewport Handling

`src/viewport-height.ts` provides a `--vh` CSS variable that accounts for mobile browser chrome and on-screen keyboards:

```typescript
export function trackViewportHeight(): () => void {
  // Measures visual viewport height, writes to --vh
  // Updates on resize (debounced for keyboard events)
  // Returns cleanup function
}
```

**Usage in CSS**:
```css
height: calc(var(--vh, 1vh) * 100);
```

**Why not `dvh`**: The native `dvh` unit tracks browser chrome but ignores the on-screen keyboard, which is the half that breaks login forms.

## Deployment Checklist

1. **Configure environment.ts**: Set `apiUrl` and collection names
2. **Set feature flags**: Match service configuration
3. **Run build**: `npm run build`
4. **Configure hosting**: S3/CloudFront or other static host
5. **Set up URL rewriting**: Extensionless URLs for product pages
6. **Configure error responses**: SPA routes return `index.html`
7. **Set cache headers**: Tiered TTLs for HTML vs static assets
8. **Verify prerendering**: Test product page titles
9. **Schedule refreshes**: Optional cron for `SHOP_SHELL=remote` mode

## Troubleshooting

### "Configure your service" screen
- Check `apiUrl` in `environment.ts`
- Ensure URL is `https://xxxxxx.ulabase.app` (not `api.ulabase.com`)

### Prerender skipped
- Set `SHOP_API_URL` and `SHOP_PUBLIC_URL` environment variables
- Check service is accessible and catalog collection exists

### Product pages show generic title
- Verify CloudFront function is rewriting URLs correctly
- Check custom error responses are configured
- Test with `curl` to see what HTML is returned

### Mobile keyboard covers form fields
- Ensure `trackViewportHeight()` is called in shell component
- Use `calc(var(--vh, 1vh) * 100)` for full-height layouts
