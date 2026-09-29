import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatPrice, useCart, usePayments } from '@ulabase/kit-react';
import { fromPrice, pick, stock, type ShopItem, type Variant } from '../../shop/types';
import { applySeo, productJsonLd } from '../../seo';
import { environment } from '../../environments/environment';
import './Shop.css';

/**
 * One product.
 *
 * Fetched by id rather than picked out of the grid's state, because the grid
 * may never have been loaded: this is a URL people bookmark, paste to each
 * other and arrive at from a search engine, and it has to work on its own.
 *
 * The ACL already allows it — the catalog permission's predicate covers
 * `path-template('/catalog/{docid}')` as well as the collection — and it
 * carries the same readFilter, so an unsellable product is a 404 here rather
 * than a page with no button.
 */
export default function Product() {
  const { id = '' } = useParams();
  const payments = usePayments();
  const cart = useCart();

  const [item, setItem] = useState<ShopItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  /** The option chosen for each metadata key: `{ colour: 'yellow', size: 'L' }`. */
  const [chosen, setChosen] = useState<Record<string, string>>({});

  /** Which of the product's photos is showing. Reset whenever the set of photos changes. */
  const [shown, setShown] = useState(0);

  const [quantity, setQuantity] = useState(1);

  const [related, setRelated] = useState<ShopItem[]>([]);

  // A new choice is a new product: "Added ✓" left standing would be claiming the last one, and
  // the photo of the previous colour would be claiming more than that.
  useEffect(() => {
    setAdded(false);
    setShown(0);
  }, [chosen]);

  /**
   * The questions and their answers, read off the variants themselves.
   *
   * Nothing declares which options a product has: the distinct metadata keys are the questions
   * and their distinct values are the answers, so adding a colour to the catalog adds it to the
   * page with nothing to update here.
   */
  const options = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const variant of item?.variants ?? []) {
      for (const [key, value] of Object.entries(variant.metadata ?? {})) {
        // `etichetta` is one product's own convention for what the email prints. It is not a
        // choice anybody makes, so it is not a selector — which is the price of free-form
        // metadata, and cheaper than a schema saying which keys are options.
        if (key === 'etichetta') continue;
        const seen = out.get(key) ?? [];
        if (!seen.includes(value)) out.set(key, [...seen, value]);
      }
    }
    return out;
  }, [item]);

  /** The variant matching every chosen option, once they are all chosen. */
  const variant: Variant | undefined = useMemo(() => {
    if (!item?.variants?.length) return undefined;
    if (options.size === 0) return undefined;
    return item.variants.find(v =>
      [...options.keys()].every(key => v.metadata?.[key] === chosen[key])
    );
  }, [item, options, chosen]);

  // Start on the first variant that can actually be bought, so the page opens on something
  // rather than on an empty form.
  useEffect(() => {
    const first = item?.variants?.find(v => v.purchasable !== false) ?? item?.variants?.[0];
    if (first?.metadata) {
      const { etichetta: _unused, ...rest } = first.metadata;
      setChosen(rest);
    }
  }, [item]);

  useEffect(() => {
    let cancelled = false;
    setItem(null);
    setError(null);

    // One product, asked for as a catalog of one.
    //
    // The kit reads the catalog as a list, and there is no separate call for a
    // single document — which turns out to suit a shop. Fetching `/catalog/{id}`
    // tells a withdrawn product apart from a hidden one, by answering 404 or
    // 403, and a shopper should be told the same thing either way: this is not
    // for sale. An empty list says exactly that and nothing more.
    payments
      .getCatalog({
        collection: environment.catalogCollection,
        filter: { _id: id },
        pagesize: 1,
      })
      .then(docs => {
        if (cancelled) return;
        const doc = (docs as ShopItem[])[0];
        if (doc) setItem(doc);
        else setError('That product is not in the catalog. It may have been withdrawn.');
      })
      .catch((err: { message?: string }) => {
        if (!cancelled) setError(err.message ?? 'Could not load the product.');
      });

    return () => {
      cancelled = true;
    };
  }, [payments, id]);

  /**
   * A product with variants has no price of its own, and should not: the price belongs to what is
   * bought. So until a variant is resolved there is nothing to show and nothing to buy — which is
   * true for one render before the effect below picks a default, and stays true for as long as a
   * catalog offers a combination that does not exist.
   */
  const chooseFirst = Boolean(item?.variants?.length) && !variant;

  /**
   * Four more from the same category.
   *
   * The same category, and nothing cleverer: a starter has no purchase history to learn from, and
   * a "you might also like" built on nothing is worse than an honest "more in apparel". Fetched
   * after the product rather than with it, because it must never delay the thing that was asked
   * for.
   */
  useEffect(() => {
    if (!item?.category) {
      setRelated([]);
      return;
    }
    let cancelled = false;
    payments
      .getCatalog({
        collection: environment.catalogCollection,
        filter: { category: item.category, _id: { $ne: item._id } },
        pagesize: 4,
        sort: 'name',
      })
      .then(docs => {
        if (!cancelled) setRelated(docs as ShopItem[]);
      })
      // A shelf that fails to load is a shelf that is not there. Nothing to tell anybody.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [payments, item]);

  // Title, description and the Product structured data that puts a price under a search result.
  useEffect(() => {
    if (!item) return;
    const shown = pick(item, variant);
    return applySeo({
      title: item.name,
      description: item.description,
      image: shown.images[0],
      structuredData: productJsonLd({
        id: shown.id,
        name: item.name,
        description: item.description,
        images: shown.images,
        price: shown.unitAmount,
        currency: shown.currency,
        available: stock(shown).sellable,
      }),
    });
  }, [item, variant]);

  const add = () => {
    if (!item || chooseFirst) return;
    const chosenItem = pick(item, variant);
    // The cart holds what is bought, not the family it belongs to: the composite id is what the
    // server prices and what the order line records. The options travel with it, because a
    // variant's name is its product's and two of them would otherwise read alike.
    cart.add(
      {
        productId: chosenItem.id,
        name: item.name,
        unitAmount: chosenItem.unitAmount,
        currency: chosenItem.currency,
        ...(Object.keys(chosen).length > 0 ? { options: chosen } : {}),
        ...(chosenItem.images[0] ? { image: chosenItem.images[0] } : {}),
      },
      quantity
    );
    setAdded(true);
  };

  return (
    <div className="shop-page">
      <Link to="/" className="back-link">&larr; Back to the shop</Link>

      {error && <div className="form-error" role="alert">{error}</div>}

      {!error && !item && (
        <div className="product-layout">
          <div className="card skeleton" style={{ height: '22rem' }} />
          <div className="card skeleton" style={{ height: '12rem' }} />
        </div>
      )}

      {item && (
        <article className="product-layout">
          <div>
            {pick(item, variant).images[shown] ? (
              <img src={pick(item, variant).images[shown]} alt="" className="product-image" />
            ) : (
              <div className="product-image placeholder" aria-hidden="true" />
            )}

            {/* Only when there is a choice to make. A single thumbnail under a single photo is
                furniture pretending to be a control. */}
            {pick(item, variant).images.length > 1 && (
              <div className="product-thumbs">
                {pick(item, variant).images.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    className={`product-thumb${i === shown ? ' is-shown' : ''}`}
                    aria-label={`Photo ${i + 1}`}
                    aria-pressed={i === shown}
                    onClick={() => setShown(i)}
                  >
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-detail">
            {item.category && <p className="eyebrow">{String(item.category)}</p>}
            <h1>{item.name}</h1>

            <p className="product-price">
              {chooseFirst
                ? <span className="muted">Select an option</span>
                : formatPrice(pick(item, variant).unitAmount, pick(item, variant).currency)}
            </p>

            {item.description && <p>{item.description}</p>}

            {[...options.entries()].map(([key, values]) => (
              <div key={key} className="product-option">
                <span className="product-option-label">{key}</span>
                <div className="product-option-values" role="group" aria-label={key}>
                  {values.map(value => {
                    // Shown and disabled rather than hidden: options that appear and vanish while
                    // you choose are harder to use than a greyed-out size.
                    const sellable = item.variants?.some(
                      v => v.metadata?.[key] === value && stock(pick(item, v)).sellable
                    );
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`chip${chosen[key] === value ? ' chip-active' : ''}`}
                        aria-pressed={chosen[key] === value}
                        disabled={!sellable}
                        onClick={() => setChosen(c => ({ ...c, [key]: value }))}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <dl className="product-facts">
              <dt>Delivery</dt>
              <dd>{item.type === 'digital' ? 'Downloadable — nothing to ship' : 'Shipped in a box'}</dd>
              <dt>Reference</dt>
              <dd><code>{pick(item, variant).id}</code></dd>
            </dl>

            {stock(pick(item, variant)).low && !chooseFirst && (
              <p className="product-stock" role="status">
                Only {stock(pick(item, variant)).limit} left.
              </p>
            )}

            {chooseFirst ? (
              <p className="muted">
                That combination is not available. Try another one.
              </p>
            ) : stock(pick(item, variant)).sellable ? (
              <div className="product-actions">
                <label className="sr-only" htmlFor="product-qty">Quantity</label>
                <input
                  id="product-qty"
                  className="product-qty"
                  type="number"
                  min={1}
                  max={stock(pick(item, variant)).limit}
                  value={quantity}
                  onChange={e => {
                    // Clamped to the shelf where there is one. The checkout would refuse a larger
                    // number anyway, and refusing it here costs the buyer nothing.
                    const limit = stock(pick(item, variant)).limit ?? Infinity;
                    setQuantity(Math.min(limit, Math.max(1, Number(e.target.value) || 1)));
                  }}
                />
                <button type="button" className="btn-primary" onClick={add}>
                  {added ? 'Added ✓' : 'Add to cart'}
                </button>
                {added && <Link to="/cart" className="btn-secondary">View cart</Link>}
              </div>
            ) : (
              <p className="muted">
                <span className="badge">Sold out</span> This one cannot be bought right now.
              </p>
            )}
          </div>
        </article>
      )}

      {related.length > 0 && (
        <section className="product-related">
          <h2>More in {item?.category}</h2>
          <div className="shop-grid">
            {related.map(other => (
              <article key={other._id} className="card shop-item">
                <Link to={`/product/${encodeURIComponent(other._id)}`} className="shop-item-link">
                  {other.images?.[0] && (
                    <img src={other.images[0]} alt="" className="shop-item-image" />
                  )}
                </Link>
                <div className="shop-item-body">
                  <h3 className="shop-item-name">
                    <Link to={`/product/${encodeURIComponent(other._id)}`}>{other.name}</Link>
                  </h3>
                  <div className="shop-item-footer">
                    <span className="shop-item-price">
                      {other.variants?.length ? 'from ' : ''}
                      {formatPrice(fromPrice(other), other.currency ?? 'eur')}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
