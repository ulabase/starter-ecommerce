---
type: domain
title: Shop Catalog and Product Pages
description: Covers catalog browsing, category filtering, text search, infinite scroll pagination, product pages with variant selection, and stock handling.
tags: [catalog, shop, products, variants, stock, pagination, filtering, search]
sources:
  - id: openwiki-source-192c27e8048436d93b29c2cb
    resource: repo://src/catalog.seed.ts
  - id: openwiki-source-6f3c60c74f4ede9ae7843af8
    resource: repo://src/pages/shop/Product.tsx
  - id: openwiki-source-b21d0ca33622d12ef7bc4d82
    resource: repo://src/pages/shop/Shop.tsx
  - id: openwiki-source-9b6d8d8d73e675c6f6c7f32f
    resource: repo://src/seo.ts
  - id: openwiki-source-949bdd44bd293ab2d96d3c24
    resource: repo://src/shop/types.ts
generated: { by: "openwiki/0.7.2", at: "2026-10-13T10:18:39.801Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-13T10:18:39.801Z
---

# Shop Catalog and Product Pages

The shop catalog system provides browsing, filtering, searching, and detailed viewing of products with variant selection and stock management. It consists of two main pages: the Shop page for browsing the catalog grid, and the Product page for viewing individual products with variant selection.

## Data Model

The catalog uses a two-level product model: products contain variants that represent purchasable combinations.

### Product Types

```typescript
// ShopItem extends the base CatalogItem with shop-specific fields
type ShopItem = Omit<CatalogItem, 'image_url'> & {
  category?: string;        // Product category (not a Stripe field)
  images?: string[];        // Product gallery
  metadata?: Record<string, string>;
  in_stock?: number;        // Units on hand (absent = not counted)
  variants?: Variant[];     // Purchasable combinations
};

// Variant: one buyable combination of a product
type Variant = {
  id: string;               // Unique within product, not globally
  unit_amount?: number;     // Price in minor units (cents)
  currency?: string;        // Currency code
  purchasable?: boolean;    // Can be bought
  in_stock?: number;        // Units on hand (absent = not counted)
  images?: string[];        // Variant-specific images
  metadata?: Record<string, string>;  // Selection keys (color, size, etc.)
};
```

**Variant ID composition**: Variant IDs are scoped to their parent product. The composite `<product-id>/<variant-id>` is what the cart stores and the server prices.

### Variant Inheritance with `pick()`

Variants inherit values from their parent product when they don't specify them:

```typescript
function pick(item: ShopItem, variant?: Variant) {
  return {
    id: variant ? `${item._id}/${variant.id}` : item._id,
    unitAmount: variant?.unit_amount ?? item.unit_amount,
    currency: variant?.currency ?? item.currency ?? 'eur',
    purchasable: variant?.purchasable ?? item.purchasable,
    inStock: variant?.in_stock ?? item.in_stock,
    images: (variant?.images?.length ? variant.images : item.images) ?? [],
    metadata: variant?.metadata ?? item.metadata ?? {},
  };
}
```

**Key behavior**: Images are *replaced*, not merged—a variant showing one color is better than mixing all colors.

### Stock Management with `stock()`

Stock determines if an item can be sold and how many:

```typescript
function stock(chosen: ReturnType<typeof pick>) {
  const counted = typeof chosen.inStock === 'number';
  return {
    sellable: chosen.purchasable !== false && (!counted || chosen.inStock! > 0),
    limit: counted ? Math.max(0, chosen.inStock!) : undefined,
    low: counted && chosen.inStock! > 0 && chosen.inStock! <= 5,
  };
}
```

**Stock rules**:
- `purchasable: false` = shop decision: not for sale
- `in_stock: 0` = shelf decision: sold out
- `in_stock` absent = nobody counting (default for most items)
- Server applies same rules when pricing orders

### Price Display with `fromPrice()`

For products with variants, the grid shows "from €X.XX" using the lowest variant price:

```typescript
export function fromPrice(item: ShopItem): number {
  if (!item.variants?.length) return item.unit_amount;
  return Math.min(...item.variants.map(v => v.unit_amount ?? item.unit_amount));
}
```

## Product Page

The Product page fetches products by ID rather than from grid state, because URLs are shared and bookmarked.

### Fetching Strategy

```typescript
payments.getCatalog({
  collection: environment.catalogCollection,
  filter: { _id: id },
  pagesize: 1,
})
```

**Why fetch by ID**: The grid may never have been loaded. URLs must work standalone. The ACL's readFilter ensures unsellable products return empty results (effectively 404).

### Variant Selection Flow

```mermaid
flowchart TD
    A[Load Product] --> B{Has variants?}
    B -->|No| C[Use product directly]
    B -->|Yes| D[Extract options from metadata]
    D --> E[Auto-select first purchasable variant]
    E --> F{User selects options}
    F --> G[Find matching variant]
    G --> H{All options chosen?}
    H -->|No| I[Show "Select an option"]
    H -->|Yes| J{Variant exists?}
    J -->|No| K[Show "Combination not available"]
    J -->|Yes| L{Is sellable?}
    L -->|No| M[Show "Sold out"]
    L -->|Yes| N[Show price and add to cart]
    
    C --> O[Render product page]
    I --> O
    K --> O
    M --> O
    N --> O
```

### Option Extraction

Options are derived from variant metadata, not declared separately:

```typescript
const options = useMemo(() => {
  const out = new Map<string, string[]>();
  for (const variant of item?.variants ?? []) {
    for (const [key, value] of Object.entries(variant.metadata ?? {})) {
      if (key === 'etichetta') continue; // Internal label, not a selector
      const seen = out.get(key) ?? [];
      if (!seen.includes(value)) out.set(key, [...seen, value]);
    }
  }
  return out;
}, [item]);
```

**Conventions**:
- `etichetta` is excluded (used for email labels)
- Adding new metadata keys automatically creates new selectors
- Options shown as chips, disabled if no sellable variant exists
- Low stock warning shows when `in_stock` ≤ 5: "Only X left"

### Related Products

Four products from the same category, fetched after main product:

```typescript
payments.getCatalog({
  collection: environment.catalogCollection,
  filter: { category: item.category, _id: { $ne: item._id } },
  pagesize: 4,
  sort: 'name',
})
```

**Why after**: Must never delay the main product. Failure is silent (empty section).

### Cart Integration

The Product page adds items to the cart with the composite variant ID and selected options:

```typescript
cart.add(
  {
    productId: chosenItem.id,  // e.g., "product-id/variant-id"
    name: item.name,
    unitAmount: chosenItem.unitAmount,
    currency: chosenItem.currency,
    ...(Object.keys(chosen).length > 0 ? { options: chosen } : {}),
    ...(chosenItem.images[0] ? { image: chosenItem.images[0] } : {}),
  },
  quantity
);
```

**Why composite ID**: The cart holds what is bought, not the product family. The server prices the composite ID and the order line records it.

**State reset**: The "Added ✓" confirmation clears when the user changes variant selection, because a new choice is effectively a new product.

**Quantity input**: Clamped to stock limit where counted, with a minimum of 1. The checkout would refuse larger numbers anyway.

**View cart link**: Appears after successful addition, allowing quick navigation to the cart.

**Image gallery**: Shows variant-specific images with thumbnail navigation when multiple images exist.

**Reference field**: Shows the composite variant ID (e.g., "product-id/variant-id") for support and identification.

**Delivery info**: Shows "Downloadable — nothing to ship" for digital products, "Shipped in a box" for physical products.

**Category display**: Shows category as an "eyebrow" label above the product name.

**Back link**: "← Back to the shop" link at the top returns to the catalog with filters preserved.

**Shop header**: Shows "Shop" eyebrow and "Everything we make" title.

**Category chips**: "All" button plus category chips from the `CATEGORIES` array, with active state for selected category.

**Loading more**: Shows "Loading more…" text while fetching additional pages.

**Sentinel element**: Hidden div at the bottom of the grid that triggers infinite scroll when it comes into view.

**Toast area**: Announces additions to screen readers via `aria-live="polite"` and shows visual toast with "View cart" link.

**Just added tracking**: Tracks which item was just added to show "Added ✓" on the button and toast notification.

**Timer management**: Uses a ref to hold the timeout, so adding a second item restarts the timer rather than letting the first one's timeout clear the second one's message.

**Cancellation pattern**: Both pages use a `cancelled` flag in cleanup functions to prevent state updates after unmount.

**Restore logic**: When returning to a saved position, fetches pages 1..N in one request (`restoreAll`), then restores scroll position after paint using `requestAnimationFrame`.

**Page number in state**: The page number stays in state, not the URL, because it's a consequence of scrolling rather than a choice, and an address bar that changes as you scroll is noise in the history.

**Sort order**: Always sorted by name to ensure consistent paging and prevent items from appearing on multiple pages or none.

**Race condition prevention**: The `q` state object holds category, search, and page together, so they change in the same update or not at all, preventing stale page numbers with new filters.

**URL replacement**: Filter changes use `replace: true` to avoid adding to browser history, since typing is not navigation.

**Filter change clearing**: When a new filter is applied (page 1), the grid clears immediately to avoid showing previous filter's products while loading.

**Category toggle**: Clicking the active category deselects it (sets to null), clicking a different category selects it.

## Shop Page

The Shop page provides paginated browsing with filtering and search.

### URL-Driven State

Filters live in URL search params, not state:

```typescript
const [params, setParams] = useSearchParams();
const [q, setQ] = useState<{ category: string | null; search: string; page: number }>(() => {
  const category = params.get('category');
  const search = params.get('q') ?? '';
  const previous = recallPosition(positionKey(category, search));
  return { category, search, page: previous?.pages ?? 1 };
});
```

**Benefits**:
- Back button works after viewing a product
- Filtered URLs can be shared
- Reload preserves filters

**Search debounce**: Typing is debounced at 300ms to avoid firing a request per keystroke across the network.

### Infinite Scroll Pagination

Uses IntersectionObserver with a sentinel element:

```typescript
useEffect(() => {
  const node = sentinel.current;
  if (!node || done || items === null) return;

  const observer = new IntersectionObserver(
    entries => {
      if (entries[0]?.isIntersecting && !loadingMore) {
        setQ(prev => ({ ...prev, page: prev.page + 1 }));
      }
    },
    { rootMargin: '600px' }  // Start loading before reaching bottom
  );
  observer.observe(node);
  return () => observer.disconnect();
}, [done, items, loadingMore]);
```

**End detection**: Short page (< PAGE_SIZE) means catalog exhausted.

### Scroll Position Persistence

Position is saved in sessionStorage, keyed by filter:

```typescript
const WHERE_I_WAS = 'rh-shop-position';
const positionKey = (category: string | null, search: string) => 
  `${category ?? ''}|${search}`;

// Saved on every scroll (not on unmount - too late)
useEffect(() => {
  const remember = () =>
    rememberPosition({
      key: positionKey(q.category, q.search),
      pages: q.page,
      scrollY: window.scrollY,
    });
  window.addEventListener('scroll', remember, { passive: true });
  return () => {
    remember(); // Save final position
    window.removeEventListener('scroll', remember);
  };
}, [q.category, q.search, q.page]);
```

**Restore logic**: On return, fetch pages 1..N in one request, then restore scroll position after paint.

### Catalog Fetching

```typescript
payments.getCatalog({
  collection: environment.catalogCollection,
  page: restoreAll ? 1 : q.page,
  pagesize: restoreAll ? PAGE_SIZE * q.page : PAGE_SIZE,
  sort: 'name',
  ...(conditions.length === 1 ? { filter: conditions[0] } : {}),
  ...(conditions.length > 1 ? { filter: { $and: conditions } } : {}),
})
```

**Filtering**:
- Category: exact match
- Search: regex on name, case-insensitive
- Escaped to prevent regex injection

**Toast feedback**: Adding an item from the grid shows a toast notification with the product name and a "View cart" link, which auto-dismisses after 2.5 seconds.

**Grid item states**:
- Products with variants show "Choose" (links to product page)
- Simple sellable products show "Add to cart"
- Unsoldable products show "Sold out" badge

**Loading state**: Skeleton cards show while items load, with the search input remaining stable to preserve focus.

**Empty states**:
- No matches: "Nothing matches that. Try another category, or clear the search."
- Empty catalog: "The catalog has no purchasable products yet. Run `ulabase setup --srv <srvId>`."

**Price display**: Products with variants show "from €X.XX" using the lowest variant price.

## ACL and Visibility

The catalog permission carries a readFilter that ensures only purchasable products reach the client:

- Products where `purchasable` is true OR variants have `purchasable` not false are visible
- Unsoldable products never appear in the grid or product pages
- Product page shows "not in catalog" for hidden/withdrawn products (empty result = 404 equivalent)

## SEO

### Page Metadata

`applySeo()` sets per-page metadata and structured data:

```typescript
export function applySeo({ title, description, image, structuredData }: PageSeo): () => void {
  document.title = title === SITE ? SITE : `${title} · ${SITE}`;
  // Set meta tags, Open Graph, canonical URL
  // Add/remove JSON-LD structured data
  return () => script.remove(); // Cleanup
}
```

### Product Structured Data

`productJsonLd()` adds schema.org Product data for search results:

```typescript
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
    offers: {
      '@type': 'Offer',
      url: window.location.href,
      price: (opts.price / 100).toFixed(2), // Minor units to decimal
      priceCurrency: opts.currency.toUpperCase(),
      availability: opts.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };
}
```

**Canonical URL**: `applySeo()` sets a canonical URL without query parameters, so `?category=apparel` and `?q=mug` don't appear as separate pages to search engines.

**Structured data cleanup**: Before appending new JSON-LD, `applySeo()` removes any existing `<script type="application/ld+json">` tags—including stale prerendered data—to avoid duplicate or contradictory product information.

**Limitation**: As a SPA, link previews (Slack, WhatsApp, etc.) show `index.html` content, not product data. Server-side rendering would be required for full preview support.

## Error Handling

- **404 on catalog fetch**: Usually means Stripe plugin disabled or collection name mismatch
- **403 on catalog fetch**: ACL doesn't allow reading catalog (re-run setup)
- **Empty results**: "Nothing matches" or "Catalog empty" messages
- **Product not found**: "That product is not in the catalog. It may have been withdrawn."
- **Variant mismatch**: "That combination is not available"
- **Network errors**: Generic error messages with retry guidance

## Configuration

- `environment.catalogCollection`: MongoDB collection name for products
- `PAGE_SIZE = 24`: Products per page
- Categories defined in `CATEGORIES` array (curiosities, desk, kitchen, apparel, books, sound, garden, games)

## Related Pages

- [Stripe Integration](../integrations/stripe.md) - Payment processing and catalog API
- [Configuration and Deployment](../operations/configuration-and-deployment.md) - Environment setup
- [Purchase Flow](../workflows/purchase-flow.md) - Cart and checkout process
