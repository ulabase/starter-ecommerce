/**
 * One HTML file per product, and a sitemap listing them.
 *
 * Runs after `vite build`, reads the catalog from the live service, and writes
 * `dist/product/<id>/index.html` for each product — the same single-page app, with that product's
 * title, description, image and schema.org data already in the `<head>`.
 *
 * **Why stubs rather than rendered pages.** Rendering the React tree at build time would need a
 * DOM and a second rendering path to keep working; substituting the head needs neither. The
 * crawler reads the metadata it came for, and a browser runs the app exactly as before — the
 * router takes over the moment the JavaScript starts, and the body it replaces was the same body
 * every route already started from.
 *
 * It covers what a single-page app cannot: the crawlers behind link previews — Slack, WhatsApp,
 * X, LinkedIn — never run JavaScript, so before this a product pasted into a chat showed the
 * shop's generic description.
 *
 * **What it does not cover: freshness.** These are photographs. A price changed after the build
 * is stale in the crawler's copy until the next one — and so is availability, which goes off
 * fastest. That is the trade against server-side rendering, and for a catalog that changes weekly
 * it is a good trade. For one that changes hourly it is not.
 *
 * Needs `SHOP_API_URL` and `SHOP_PUBLIC_URL`. Without them it skips and says so: someone building
 * without a service must still be able to build.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const API = process.env.SHOP_API_URL?.replace(/\/$/, '');
const SITE = process.env.SHOP_PUBLIC_URL?.replace(/\/$/, '');
const COLLECTION = process.env.SHOP_CATALOG_COLLECTION ?? 'catalog';
const DIST = 'dist';

if (!API || !SITE) {
  console.log(
    '[prerender] skipped — set SHOP_API_URL and SHOP_PUBLIC_URL to generate product pages and a sitemap'
  );
  process.exit(0);
}

/** Everything the ACL lets an anonymous reader see, which is everything a crawler should. */
async function catalog() {
  const items = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`${API}/${COLLECTION}?page=${page}&pagesize=100&sort=name`);
    if (!res.ok) {
      throw new Error(`GET /${COLLECTION} answered ${res.status}`);
    }
    const batch = await res.json();
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

const escape = s =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The cheapest variant, or the product's own price. Matches what the window shows. */
const fromPrice = item =>
  item.variants?.length
    ? Math.min(...item.variants.map(v => v.unit_amount ?? item.unit_amount))
    : item.unit_amount;

const firstImage = item => item.images?.[0] ?? item.variants?.find(v => v.images?.[0])?.images[0];

function head(item, url) {
  const price = fromPrice(item);
  const currency = (item.currency ?? 'eur').toUpperCase();
  const image = firstImage(item);
  const sellable = item.variants?.length
    ? item.variants.some(v => v.purchasable !== false)
    : item.purchasable !== false;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item.name,
    ...(item.description ? { description: item.description } : {}),
    ...(image ? { image: [image] } : {}),
    sku: item._id,
    offers: {
      '@type': 'Offer',
      url,
      price: (price / 100).toFixed(2),
      priceCurrency: currency,
      availability: sellable ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return [
    `<title>${escape(item.name)} · Ulabase Shop</title>`,
    `<meta name="description" content="${escape(item.description ?? item.name)}" />`,
    `<link rel="canonical" href="${escape(url)}" />`,
    `<meta property="og:type" content="product" />`,
    `<meta property="og:title" content="${escape(item.name)}" />`,
    `<meta property="og:description" content="${escape(item.description ?? item.name)}" />`,
    `<meta property="og:url" content="${escape(url)}" />`,
    image ? `<meta property="og:image" content="${escape(image)}" />` : '',
    `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
  ].filter(Boolean).join('\n    ');
}

/**
 * The page these are built from.
 *
 * Normally the freshly built `dist/index.html`. With `SHOP_SHELL=remote` it is fetched from the
 * deployed site instead, which is what lets this run on a schedule without building anything: the
 * shell changes when the app changes, and refreshing prices does not change the app.
 */
const shell =
  process.env.SHOP_SHELL === 'remote'
    ? await fetch(`${SITE}/index.html`).then(res => {
        if (!res.ok) throw new Error(`GET ${SITE}/index.html answered ${res.status}`);
        return res.text();
      })
    : await readFile(join(DIST, 'index.html'), 'utf8');
const items = await catalog();

for (const item of items) {
  const url = `${SITE}/product/${encodeURIComponent(item._id)}`;
  // Strip the shell's own tags first, then insert. The other order deletes what was just
  // inserted — these tags come before the shell's, so a regex looking for the first one finds
  // the new one. Two titles is not a page with two names either: it is a page whose name
  // depends on which the crawler reads first.
  const stripped = shell
    .replace(/<meta name="description"[^>]*>\s*/g, '')
    .replace(/<meta property="og:(title|description|type|url|image)"[^>]*>\s*/g, '');

  const page = stripped.replace(/<title>[\s\S]*?<\/title>/, head(item, url));

  const dir = join(DIST, 'product', item._id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), page);
}

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  `  <url><loc>${escape(SITE)}/</loc></url>`,
  ...items.map(i =>
    `  <url><loc>${escape(`${SITE}/product/${encodeURIComponent(i._id)}`)}</loc></url>`
  ),
  '</urlset>',
].join('\n');

await writeFile(join(DIST, 'sitemap.xml'), sitemap);
await writeFile(
  join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`
);

console.log(`[prerender] ${items.length} product pages, a sitemap and robots.txt`);
