---
type: domain
title: Shop Catalog and Product Pages
description: Covers catalog browsing, category filtering, text search, infinite scroll pagination, product pages with variant selection, and stock handling.
tags: [catalog, shop, products, variants, stock, pagination, filtering, search]
verified:
  - by: openwiki/0.6.1
    at: 2026-10-01T12:11:43.532Z
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
generated: { by: "openwiki/0.6.1", at: "2026-10-01T12:11:43.532Z" }
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
    J -->|Yes| L[Show price and add to cart]
    
    C --> M[Render product page]
    I --> M
    K --> M
    L --> M
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

**Limitation**: As a SPA, link previews (Slack, WhatsApp, etc.) show `index.html` content, not product data. Server-side rendering would be required for full preview support.

## Error Handling

- **404 on catalog fetch**: Usually means Stripe plugin disabled or collection name mismatch
- **403 on catalog fetch**: ACL doesn't allow reading catalog (re-run setup)
- **Empty results**: "Nothing matches" or "Catalog empty" messages
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
