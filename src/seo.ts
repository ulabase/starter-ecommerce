/**
 * Per-page title, description and structured data.
 *
 * **This is a single-page app, and that is a real limit.** The HTML the server sends is an empty
 * shell; everything here runs afterwards, in the browser. Google renders JavaScript and will see
 * it. The crawlers behind link previews — Slack, WhatsApp, X, LinkedIn — do not, so a product
 * link pasted into a chat shows whatever `index.html` says and not the product.
 *
 * Fixing that properly means server-side rendering, which is a different shape of application.
 * The Angular starter has it through Angular's SSR router; this one is Vite and does not. It is
 * a decision worth making deliberately rather than a gap to paper over — see the README.
 *
 * What follows still earns its place: Google is where a shop is searched for, and structured data
 * is what turns a result into one with a price and an availability under it.
 */

const SITE = 'Ulabase Shop';

function meta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function link(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
}

export interface PageSeo {
  title: string;
  description?: string;
  image?: string;
  /** JSON-LD, already shaped. Products get one; a listing does not need one. */
  structuredData?: Record<string, unknown>;
}

/**
 * Applies a page's metadata. Returns a cleanup that removes the structured data.
 *
 * The title and description are overwritten by the next page, so they need no undoing; a
 * `<script type="application/ld+json">` left behind would describe a product the reader is no
 * longer looking at, and two of them describe two.
 */
export function applySeo({ title, description, image, structuredData }: PageSeo): () => void {
  document.title = title === SITE ? SITE : `${title} · ${SITE}`;

  if (description) {
    meta('meta[name="description"]', 'name', 'description', description);
    meta('meta[property="og:description"]', 'property', 'og:description', description);
  }
  meta('meta[property="og:title"]', 'property', 'og:title', title);
  meta('meta[property="og:type"]', 'property', 'og:type', structuredData ? 'product' : 'website');
  meta('meta[property="og:url"]', 'property', 'og:url', window.location.href);
  if (image) {
    meta('meta[property="og:image"]', 'property', 'og:image', image);
  }

  // Without a canonical, `?category=apparel` and `?q=mug` are separate pages showing overlapping
  // products, which is how a small catalog looks like a large duplicate one.
  link('canonical', window.location.origin + window.location.pathname);

  // The prerendered page already carries structured data for this product, written at build time.
  // Appending ours next to it leaves two `Product` blocks describing one thing, disagreeing about
  // the price as soon as the snapshot is a day old — so the stale one goes before ours arrives.
  // This also covers a block a previous page failed to clean up.
  document.head
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach(tag => tag.remove());

  if (!structuredData) return () => {};

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(structuredData);
  document.head.appendChild(script);
  return () => script.remove();
}

/** A product as schema.org describes one — the shape search engines read prices from. */
export function productJsonLd(opts: {
  id: string;
  name: string;
  description?: string;
  images: string[];
  price: number;
  currency: string;
  available: boolean;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.images.length ? { image: opts.images } : {}),
    sku: opts.id,
    offers: {
      '@type': 'Offer',
      url: window.location.href,
      // Schema.org wants a decimal, and the catalog stores minor units.
      price: (opts.price / 100).toFixed(2),
      priceCurrency: opts.currency.toUpperCase(),
      availability: opts.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };
}
