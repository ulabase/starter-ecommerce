# SEO — Ecommerce starter

How this shop gets a title, a price and a picture under a search result or a pasted link, given
that it is a single-page app.

## What sets the metadata

`src/seo.ts` has two functions, and every page calls at least the first:

- `applySeo()` — title, description, canonical and Open Graph tags.
- `productJsonLd()` — schema.org `Product` data on a product page. This is what puts a price and a
  stock status under a Google result.

Both write into the live document. That is enough for Google, which renders JavaScript, and not
enough for anything else.

## Why that is not enough

The HTML the server sends is an empty shell; everything real happens afterwards in the browser.
**Link preview crawlers do not run JavaScript** — Slack, WhatsApp, X, LinkedIn, iMessage read the
HTML as delivered and stop. A product link pasted into a chat shows the shop's generic title, for
every product.

## One file per product

`scripts/prerender.mjs` runs after `vite build`. It reads the catalogue from the service and writes
`dist/product/<id>/index.html` per product — the same app, with that product's title, description,
image and structured data already in the `<head>` — plus `sitemap.xml` and `robots.txt`.

```bash
SHOP_API_URL=https://xxxxxx.ulabase.app \
SHOP_PUBLIC_URL=https://ilmionegozio.com \
npm run build
```

Without those two variables the script skips itself and says so, so building without a service
keeps working.

Everyone gets the same file: a crawler reads the `<head>` and stops, a browser runs the app and
replaces the body with live data. Serving crawlers something different from users is cloaking and
against Google's rules; this is not that.

> **This is one of three known ways.** [react-snap](https://github.com/stereobooster/react-snap)
> renders the real DOM with headless Chrome, and [Vike](https://vike.dev/pre-rendering) makes
> pre-rendering a property of the app. Both produce fully rendered HTML, and both are a bigger
> change than this: a script that only substitutes the `<head>` needs no browser at build time and
> leaves the app untouched. Swap it if you want the body rendered too.

## Keeping them fresh

The prerendered `<head>` is a snapshot, and a price that changes after the build stays wrong in
the crawler's copy until the next run. **No customer sees that** — a human gets the SPA, which
asks the service and shows the price current to the second.

So the bar is "not months old", not "correct now", and a crawler revisits a small shop daily or
weekly. Once a day is plenty, plus a manual run after a change worth announcing.

The script reads one thing out of `dist`: `index.html`, which changes when the *app* changes and
not when a price does. `SHOP_SHELL=remote` takes it from the deployed site instead, so a scheduled
refresh needs no `npm install` and no `vite build`:

```bash
SHOP_SHELL=remote \
SHOP_API_URL=https://xxxxxx.ulabase.app \
SHOP_PUBLIC_URL=https://ilmionegozio.com \
node scripts/prerender.mjs
```

A few seconds, then upload `dist/product/` and `sitemap.xml`. On Netlify or Vercel, a cron on the
build hook does the whole thing.

## On S3 and CloudFront

S3 is the one host where the pieces have to be put there deliberately.

**Serve the extensionless URL.** The canonical URL is `/product/<id>` with no trailing slash, but
the file is at `product/<id>/index.html`. Use CloudFront with
[AWS's `url-rewrite-single-page-apps` function](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example-function-add-index.html)
on viewer-request, unchanged:

```js
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

The plain S3 website endpoint is not a substitute: it answers `/product/mug-enamel` with a 302 to
the trailing-slash form, so the crawled address stops matching the declared canonical.

**Add the client-side routes.** `/cart` and `/orders` have no generated file, so after the rewrite
they 404. Custom error responses — 403 and 404 → `/index.html`, response code 200 — hand those to
the router. Neither AWS document covers this; it is the piece you configure yourself.

**Set Cache-Control, and skip invalidations.** [AWS's tiered-TTL guidance](https://aws.amazon.com/blogs/networking-and-content-delivery/host-single-page-applications-spa-with-tiered-ttls-on-cloudfront-and-s3/)
is to make the HTML refresh itself rather than to invalidate after every deploy — invalidations
cost money, do not touch the browser's own cache, and are a control-plane operation:

```bash
aws s3 sync dist/ s3://$BUCKET/ --delete \
  --exclude "*.html" --exclude "sitemap.xml" --exclude "robots.txt" \
  --cache-control "public,max-age=31536000,immutable"

aws s3 sync dist/ s3://$BUCKET/ --delete \
  --exclude "*" --include "*.html" --include "sitemap.xml" --include "robots.txt" \
  --cache-control "public,max-age=60,stale-while-revalidate=2592000"
```

With those headers the scheduled refresh needs no invalidation: upload `dist/product/` and
`sitemap.xml` and CloudFront picks them up. Keep `--delete` scoped to `product/` on that run —
a refresh runs without a build, so `dist/` holds nothing else.

## Check the pages are actually served

If a catch-all rewrite wins over the generated files, nothing looks broken: users see the same
working shop and only the previews stay generic.

```bash
curl -s https://ilmionegozio.com/product/mug-enamel | grep '<title>'
```

The product's name means it works. The shop's generic title means the rewrite is eating the pages.

## The limit that remains

For a catalogue that changes hourly, snapshots are the wrong tool and the answer is server-side
rendering. The Angular starter has it through Angular's SSR router. This one is Vite, and does not.
