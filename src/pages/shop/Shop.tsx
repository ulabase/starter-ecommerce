import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatPrice, useCart, usePayments } from '@ulabase/kit-react';
import { fromPrice, pick, stock, type ShopItem } from '../../shop/types';
import { applySeo } from '../../seo';
import { environment } from '../../environments/environment';
import { CATEGORIES } from '../../catalog.seed';
import './Shop.css';

/** How many products a page holds. Also how the end of the catalog is spotted. */
const PAGE_SIZE = 24;

/**
 * Where the reader was, so coming back from a product returns them there.
 *
 * `sessionStorage`, not `localStorage`: it is about this visit. Keyed by the filter, because the
 * position in a list of mugs means nothing in a list of books.
 *
 * The pages matter as much as the offset. Restoring a scroll of 4000px onto a freshly loaded
 * first page lands on nothing — so the count is remembered and asked for in one request, which
 * is also one round trip instead of four.
 */
const WHERE_I_WAS = 'rh-shop-position';

/** The position in a list of mugs means nothing in a list of books. */
const positionKey = (category: string | null, search: string) => `${category ?? ''}|${search}`;

type Position = { key: string; pages: number; scrollY: number };

function rememberPosition(pos: Position) {
  try {
    sessionStorage.setItem(WHERE_I_WAS, JSON.stringify(pos));
  } catch {
    // A private window refuses. Losing the position is not worth an error.
  }
}

function recallPosition(key: string): Position | null {
  try {
    const raw = sessionStorage.getItem(WHERE_I_WAS);
    if (!raw) return null;
    const pos = JSON.parse(raw) as Position;
    return pos.key === key ? pos : null;
  } catch {
    return null;
  }
}

/** So a customer typing "3.5" does not hand Mongo a regex of their own. */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default function Shop() {
  const payments = usePayments();
  const cart = useCart();

  // Which item was just added, so the button can say so. Cleared on a timer —
  // and the timer is held in a ref so adding a second item restarts it rather
  // than letting the first one's timeout clear the second one's message.
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (addedTimer.current) clearTimeout(addedTimer.current);
  }, []);

  const addToCart = (item: ShopItem) => {
    cart.add({
      productId: item._id,
      name: item.name,
      unitAmount: item.unit_amount,
      currency: item.currency ?? 'eur',
      ...(item.images?.[0] ? { image: item.images[0] } : {}),
    });
    setJustAdded(item._id);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(null), 2500);
  };

  const [items, setItems] = useState<ShopItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  /**
   * The filter lives in the URL, not in a hook.
   *
   * Three things fall out of that and none of them are available otherwise: the back button works
   * after opening a product — the shop reappears filtered as it was, instead of resetting to
   * everything — a filtered window can be sent to somebody, and a reload does not throw the
   * choice away.
   *
   * The page number deliberately stays in state. It is a consequence of scrolling rather than a
   * choice, and an address bar that changes as you scroll is noise in the history.
   */
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');

  /**
   * What is being asked for, in one piece.
   *
   * The page used to be its own state, reset by an effect watching the filter.
   * That is a race, and it broke exactly where you would not look for it:
   * changing category from page three ran both effects in the same commit, so
   * the fetch fired with the *new* category and the *old* page, asked for page
   * three of a one-page list, got nothing back, and concluded the catalog was
   * exhausted. `done` stayed true, the sentinel never rendered again, and
   * infinite scroll was over for the rest of the session.
   *
   * Held together, a page number cannot be stale with respect to the filter it
   * belongs to: they change in the same update or not at all.
   */
  const [q, setQ] = useState<{ category: string | null; search: string; page: number }>(() => {
    const category = params.get('category');
    const search = params.get('q') ?? '';
    // Returning to the same list: start at the page the reader had reached, and the first
    // request below covers everything up to it in one go.
    const previous = recallPosition(positionKey(category, search));
    return { category, search, page: previous?.pages ?? 1 };
  });

  /** True until the first response arrives, which is when a restored scroll can be applied. */
  const restoring = useRef(q.page > 1);

  /** The URL follows the filter, replacing rather than pushing: typing is not navigation. */
  useEffect(() => {
    const next = new URLSearchParams();
    if (q.category) next.set('category', q.category);
    if (q.search) next.set('q', q.search);
    if (next.toString() !== params.toString()) {
      setParams(next, { replace: true });
    }
  }, [q.category, q.search, params, setParams]);

  // Typing is not a query. Waiting a moment turns a word into one request
  // instead of one per keystroke, and the catalog is on the other side of a
  // network.
  useEffect(() => {
    const t = setTimeout(() => {
      const search = query.trim();
      setQ(prev => (prev.search === search ? prev : { ...prev, search, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Written on every scroll rather than on unmount: leaving happens by clicking a product, and
  // an unmount handler that runs after the route changed has already lost the offset.
  useEffect(() => {
    const remember = () =>
      rememberPosition({
        key: positionKey(q.category, q.search),
        pages: q.page,
        scrollY: window.scrollY,
      });
    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      remember();
      window.removeEventListener('scroll', remember);
    };
  }, [q.category, q.search, q.page]);

  useEffect(() => {
    applySeo({
      title: q.category ? `${q.category[0]!.toUpperCase()}${q.category.slice(1)}` : 'Shop',
      description: q.category
        ? `Everything we make in ${q.category}.`
        : 'Everything we make — browse the catalogue and buy in a couple of clicks.',
    });
  }, [q.category]);

  const pickCategory = (next: string | null) =>
    setQ(prev => ({ ...prev, category: prev.category === next ? null : next, page: 1 }));

  /**
   * The catalog, filtered and a page at a time.
   *
   * `payments.getCatalog` builds the request: it attaches the session when
   * there is one and nothing when there is not, so this is the same call for a
   * guest and a customer, and the query parameters stop being this page's
   * spelling problem.
   *
   * What comes back is still the ACL's decision: the permission carries a
   * readFilter, so products that are not for sale never reach the client
   * whatever this asks for.
   */
  useEffect(() => {
    let cancelled = false;

    if (q.page > 1) {
      setLoadingMore(true);
    } else {
      // A new question: forget the old answer before asking, so the grid does
      // not show the previous filter's products while this one loads.
      setItems(null);
      setDone(false);
      setError(null);
    }

    const conditions: Record<string, unknown>[] = [];
    if (q.category) conditions.push({ category: q.category });
    // Anchored on neither end: "mug" should find "Enamel mug". `$options: 'i'`
    // rather than lower-casing the field, which would need an index we do not
    // control from here.
    if (q.search) conditions.push({ name: { $regex: escapeRegex(q.search), $options: 'i' } });

    // Sorted, and by name.
    //
    // Unsorted meant whatever order the server chose — which came back roughly
    // Z to A and looked deliberate, because any consistent order does. It also
    // makes the paging honest: without a sort, "page 2" is only well defined by
    // luck, and an item can appear on two pages or on none as documents move.
    // On a restore the first request covers pages 1..N at once — a scroll of four thousand
    // pixels applied to a freshly loaded first page lands on nothing. Afterwards it is one page
    // at a time as usual, and `page` N+1 with the normal size is exactly the next slice.
    const restoreAll = restoring.current && items === null;

    payments
      .getCatalog({
        collection: environment.catalogCollection,
        page: restoreAll ? 1 : q.page,
        pagesize: restoreAll ? PAGE_SIZE * q.page : PAGE_SIZE,
        sort: 'name',
        ...(conditions.length === 1 ? { filter: conditions[0] } : {}),
        ...(conditions.length > 1 ? { filter: { $and: conditions } } : {}),
      })
      .then(catalog => catalog as ShopItem[])
      .then((catalog: ShopItem[]) => {
        if (cancelled) return;
        setItems(prev => (q.page === 1 || restoreAll ? catalog : [...(prev ?? []), ...catalog]));
        // A short page is the end. Asking for a count would be a second
        // round-trip on every scroll to learn what the next page says for free.
        if (catalog.length < (restoreAll ? PAGE_SIZE * q.page : PAGE_SIZE)) setDone(true);
        setLoadingMore(false);

        if (restoreAll) {
          restoring.current = false;
          const previous = recallPosition(positionKey(q.category, q.search));
          // After paint, or the page is still short and the browser clamps the offset.
          if (previous) requestAnimationFrame(() => window.scrollTo(0, previous.scrollY));
        }
      })
      .catch((err: { status?: number; message?: string }) => {
        if (cancelled) return;
        setLoadingMore(false);
        // A 404 here almost always means the service has no `stripe` plugin, or
        // the catalog collection is named something else — not that the shop is
        // empty. Saying so beats an empty grid.
        setError(
          err.status === 404
            ? `No collection "${environment.catalogCollection}" on the service. Check the stripe plugin is enabled and the collection name matches.`
            : err.status === 403
              ? 'The service ACL does not allow reading the catalog. Re-run `ulabase setup` — the permission has to cover signed-in customers as well as guests.'
              : (err.message ?? 'Could not load the catalog.')
        );
      });

    return () => {
      cancelled = true;
    };
  }, [payments, q]);

  // The sentinel sits under the grid; when it comes into view there is another
  // page to ask for. `rootMargin` starts the request a screen early, so the
  // next products are usually there before the reader arrives at the gap.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || done || items === null) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting && !loadingMore) setQ(prev => ({ ...prev, page: prev.page + 1 }));
      },
      { rootMargin: '600px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [done, items, loadingMore]);

  /*
   * One return, and the search box inside it.
   *
   * There used to be an early return for the loading state, which meant every
   * new query unmounted the whole page and mounted a skeleton — taking the
   * search input with it, and the caret out of it. You typed a letter, waited
   * out the debounce, and were thrown out of the field you were typing in.
   *
   * React keeps focus across a re-render; it cannot keep it across an unmount.
   * So the header and the filters render unconditionally and only the area
   * below them changes.
   */
  return (
    <div className="shop-page">
      {/* Cart and account moved to the site header, which every page has now.
          This row was the shop improvising one because it had none. */}
      <header className="shop-header">
        <div>
          <p className="eyebrow">Shop</p>
          <h1>Everything we make</h1>
        </div>
      </header>

      <div className="shop-filters">
        <input
          type="search"
          className="shop-search"
          placeholder="Search products"
          aria-label="Search products"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />

        <div className="shop-categories" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={`chip${q.category === null ? ' chip-active' : ''}`}
            aria-pressed={q.category === null}
            onClick={() => pickCategory(null)}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              className={`chip${q.category === c ? ' chip-active' : ''}`}
              aria-pressed={q.category === c}
              onClick={() => pickCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}

      {!error && items === null && (
        <div className="shop-grid">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="card skeleton" style={{ height: '19rem' }} />
          ))}
        </div>
      )}

      {items && items.length === 0 && (q.category || q.search) && (
        <p className="muted">Nothing matches that. Try another category, or clear the search.</p>
      )}

      {items && items.length === 0 && !q.category && !q.search && (
        <p className="muted">
          The catalog has no purchasable products yet. Run <code>ulabase setup --srv &lt;srvId&gt;</code>.
        </p>
      )}

      {items && items.length > 0 && (
      <div className="shop-grid">
        {items.map(item => (
          <article key={item._id} className="card shop-item">
            {/* The image and the name lead to the product; the button does not.
                One link around the whole card would have swallowed "Add to
                cart" — a card you cannot press without navigating. */}
            <Link to={`/product/${encodeURIComponent(item._id)}`} className="shop-item-link">
              {item.images?.[0] && <img src={item.images[0]} alt="" className="shop-item-image" />}
            </Link>
            <div className="shop-item-body">
              <h2 className="shop-item-name">
                <Link to={`/product/${encodeURIComponent(item._id)}`}>{item.name}</Link>
              </h2>
              {item.description && <p className="muted shop-item-desc">{item.description}</p>}
              <div className="shop-item-footer">
                <span className="shop-item-price">
                  {item.variants?.length ? 'from ' : ''}
                  {formatPrice(fromPrice(item), item.currency ?? 'eur')}
                </span>
                {item.variants?.length ? (
                  // A product with variants cannot be added from here — the window does not know
                  // which colour or size, and neither does the buyer yet.
                  <Link to={`/product/${encodeURIComponent(item._id)}`} className="btn-primary">
                    Choose
                  </Link>
                ) : stock(pick(item)).sellable ? (
                  <button
                    type="button"
                    className={`btn-primary${justAdded === item._id ? ' is-added' : ''}`}
                    onClick={() => addToCart(item)}>
                    {justAdded === item._id ? 'Added \u2713' : 'Add to cart'}
                  </button>
                ) : (
                  <span className="badge">Sold out</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      )}

      {/* The observer watches this, not the last card: a card can be removed
          from the DOM by a filter change while the observer still holds it. */}
      {!done && <div ref={sentinel} className="shop-sentinel" aria-hidden="true" />}

      {loadingMore && <p className="muted shop-more">Loading more…</p>}

      {/* Announced to screen readers as well as shown: the cart count in the
          header changes too, but a number quietly going from 1 to 2 is easy to
          miss and impossible to hear. */}
      <div className="shop-toast-area" role="status" aria-live="polite">
        {justAdded && (
          <div className="shop-toast">
            <span>{items?.find(i => i._id === justAdded)?.name} added to your cart</span>
            <Link to="/cart" className="shop-toast-link">View cart</Link>
          </div>
        )}
      </div>
    </div>
  );
}
