import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { clearOrderRef, formatPrice, readOrderRef, type OrderRef, useAuth, useCart, usePayments } from '@ulabase/kit-react';
import { environment } from '../../environments/environment';
import type { ShopOrder } from '../../shop/types';
import { clearPendingOrder, readPendingOrder } from '../../shop/pending-order';
import './Shop.css';

/**
 * Orders — the history, and the page Stripe returns the buyer to.
 *
 * One page rather than two because they were two views of the same thing: a
 * customer coming back from Stripe wants to see the order they just placed,
 * and a customer opening their history wants the same list with that order at
 * the top of it. Split apart, the return page could only ever show one order
 * and had nothing to say to someone arriving without a reference — "No order
 * to show", on a page called Orders.
 *
 * The awkward part is real though, and it is why the polling stays. Stripe
 * redirects as soon as the payment is authorised, but the order only moves off
 * `pending_payment` when Stripe's *webhook* arrives — a separate connection,
 * usually seconds later, with no ordering guarantee against the redirect. A
 * single read would routinely tell someone who just paid that they had not.
 */

type Confirming = 'none' | 'waiting' | 'settled' | 'unfinished' | 'error';

export default function Orders() {
  const auth = useAuth();
  const payments = usePayments();
  const cart = useCart();

  // The order just paid for, tracked separately from the list: it is the one
  // that may still be moving, and the list is a snapshot.
  const [confirming, setConfirming] = useState<Confirming>('none');
  const [justPaid, setJustPaid] = useState<ShopOrder | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const [orders, setOrders] = useState<ShopOrder[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  /**
   * The reference Stripe sent them back with, read once.
   *
   * Read here rather than inside the effect because reading it is destructive:
   * the effect strips it from the address bar, and StrictMode runs effects
   * twice in development — so the second run found an empty URL, decided
   * nobody had just paid, and fell back to the stash. That fallback used to
   * hold one order and happened to be the right one; once it held a list it
   * answered with the most recent, which after two checkouts is the other
   * tab's, and a buyer who had just paid was told their order was unpaid.
   *
   * `undefined` means not read yet — `null` is a real answer, and means the
   * page was opened rather than returned to.
   */
  const returnedRef = useRef<OrderRef | null | undefined>(undefined);
  if (returnedRef.current === undefined) returnedRef.current = readOrderRef();

  // ── The order coming back from Stripe ──────────────────────────────────
  useEffect(() => {
    // Two ways the reference arrives, in order of preference: interpolated into
    // the success URL by the service and carried back by Stripe — which
    // survives a cleared localStorage and a different browser — or what we
    // stashed before redirecting.
    const fromUrl = returnedRef.current;
    if (fromUrl) {
      // Out of the address bar immediately: the secret is a credential, and a
      // URL gets screenshotted, shared and bookmarked.
      clearOrderRef();
    }

    const stashed = readPendingOrder();
    const ref = fromUrl ?? (stashed ? { id: stashed.id, secret: stashed.secret } : null);
    if (!ref) return;

    // Only a reference that came back in the URL means somebody just paid —
    // that fragment is interpolated into the success URL, which Stripe sends
    // them to after paying and nowhere else. A stashed one only means a
    // checkout was opened at some point, and an abandoned cart leaves exactly
    // the same trace as a completed one.
    //
    // Polling both is what produced "Confirming your payment…" and then "Your
    // payment went through" for a forty-minute-old cart nobody paid for. The
    // page was asserting an outcome it had not read.
    const justReturned = fromUrl !== null;

    setConfirming('waiting');
    const controller = new AbortController();

    const read = justReturned
      // Just back from Stripe: the payment is authorised but the order only
      // moves when the webhook lands, on another connection, seconds later. So
      // wait for it rather than reporting the state of a race.
      ? payments.waitForOrder(ref.id, ref.secret, {
          collection: environment.catalogOrdersCollection,
          timeoutMs: 30_000,
          intervalMs: 1_000,
          signal: controller.signal,
        })
      // Otherwise just read it. Whatever it says is the answer.
      : payments.getOrder(ref.id, ref.secret, environment.catalogOrdersCollection);

    read
      .then(result => {
        setJustPaid(result);
        setConfirming(result.status === 'pending_payment' ? 'unfinished' : 'settled');
        // A finished order has nothing left to look up. An unfinished one keeps
        // its secret: it is what lets the buyer read it back after paying.
        if (result.status !== 'pending_payment') clearPendingOrder(ref.id);
        // Emptying the cart belongs here and not at checkout, because this is
        // the first moment the goods are actually sold. Someone who reached
        // Stripe and turned back still has their basket; someone who paid does
        // not get to buy it twice. Only `paid` — an expired or cancelled order
        // leaves the cart alone, so they can try again.
        if (result.status === 'paid') cart.clear();
      })
      .catch((err: { name?: string; status?: number; message?: string }) => {
        if (controller.signal.aborted) return;
        if (err.name === 'WaitTimeoutError') {
          // Only reachable on the just-returned path: the payment is
          // authorised, the webhook is late, and Stripe has the money either
          // way. Keep the secret so a reload picks up where this left off.
          setConfirming('unfinished');
          return;
        }
        // A 404 on a reference we merely stashed means the order is gone —
        // deleted, or from a service that has been reset. The stash is stale,
        // not broken: forget it and show the page as if it had never been
        // there. Reporting it made a housekeeping detail look like a failed
        // purchase, on every visit, for ever.
        //
        // Coming back from Stripe it is worth saying: somebody just paid and
        // the order is not there, which is a real problem and not the buyer's.
        if (err.status === 404 && !justReturned) {
          clearPendingOrder(ref.id);
          setConfirming('none');
          return;
        }

        setConfirming('error');
        setConfirmError(
          err.status === 404
            ? 'We cannot find the order you just paid for. Your payment is safe — please contact us with the time of your purchase.'
            : (err.message ?? 'Could not read the order.')
        );
      });

    return () => controller.abort();
  }, [payments]);

  // ── The history ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setOrders([]);
      return;
    }

    let cancelled = false;
    // Newest first. The ACL decides which documents come back — the permission
    // carries a readFilter on the billing account, so this asks for "all
    // orders" and is answered with the caller's.
    auth
      .api(`/${environment.catalogOrdersCollection}?sort=-_id&pagesize=25`)
      .then(res => res.json())
      .then((docs: ShopOrder[]) => {
        if (!cancelled) setOrders(docs);
      })
      .catch((err: { status?: number; message?: string }) => {
        if (cancelled) return;
        setOrders([]);
        setListError(
          err.status === 403
            ? 'The service ACL does not allow reading your orders. Re-run `ulabase setup`.'
            : (err.message ?? 'Could not load your orders.')
        );
      });

    return () => {
      cancelled = true;
    };
  }, [auth, auth.isAuthenticated]);

  /**
   * Where the parcel went.
   *
   * Stripe collects it on its own page and the webhook writes it onto the
   * order, so this is a record rather than a form — there is nothing to edit
   * here, and the address the customer typed at Stripe is the address the
   * server has.
   */
  const address = (order: ShopOrder) => {
    const a = order.shipping_address;
    if (!a) return null;
    const lines = [a.name, a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '),
                   [a.state, a.country].filter(Boolean).join(' ')].filter(Boolean);
    return (
      <address className="order-address">
        {lines.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </address>
    );
  };

  /** BSON dates arrive as `{ $date: millis }`. */
  const when = (d?: { $date: number } | null) =>
    d ? new Date(d.$date).toLocaleString(undefined, {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }) : null;

  /**
   * What the status means, in words a buyer uses.
   *
   * `pending_payment` is the one worth spelling out. It is not an error and not
   * a stuck order: it is what every order looks like between opening Stripe and
   * paying, including the ones nobody ever pays. Stripe expires the session on
   * its own — `checkout.session.expired` moves it to `expired` — but that can be
   * an hour later, and "pending_payment" with no explanation reads as a fault
   * for the whole hour.
   */
  const explain = (order: ShopOrder): { label: string; note?: string } => {
    switch (order.status) {
      case 'paid':
        return { label: 'Paid' };
      case 'pending_payment': {
        const deadline = when(order.expires_at);
        return {
          label: 'Awaiting payment',
          note: deadline
            ? `Not paid yet. If you left Stripe without paying, this cancels itself by ${deadline}.`
            : 'Not paid yet. If you left Stripe without paying, this cancels itself shortly.',
        };
      }
      case 'expired':
        return { label: 'Expired', note: 'Not paid in time. Nothing was charged.' };
      case 'failed':
        return { label: 'Payment failed', note: 'Nothing was charged.' };
      default:
        return { label: order.status };
    }
  };

  const line = (order: ShopOrder) => {
    const status = explain(order);
    const placed = when(order.created_at);
    const paid = when(order.paid_at);

    return (
    <li key={order._id.$oid} className="order-row">
      <div className="order-row-main">
        <div className="order-row-when">
          <strong>{placed ?? 'Order'}</strong>
          <span className="order-row-id">{order._id.$oid}</span>
        </div>
        <span className={`badge order-status order-status-${order.status}`}>{status.label}</span>
      </div>

      {status.note && <p className="muted order-row-note">{status.note}</p>}

      {order.status === 'pending_payment' && order.checkout_url && (
        <p className="order-row-note">
          <a href={order.checkout_url} className="btn-secondary">Finish paying</a>
        </p>
      )}
      <ul className="cart-lines cart-lines-compact">
        {order.line_items.map(l => {
          // Whatever the buyer chose, straight off the line the server wrote. Not read, not
          // interpreted — the keys belong to whoever built the shop.
          const options = (l as unknown as { metadata?: Record<string, string> }).metadata;
          return (
            <li key={l.product_id} className="cart-line">
              <span className="cart-line-main">
                {l.quantity} × {l.name}
                {options && Object.keys(options).length > 0 && (
                  <span className="cart-line-options">{Object.values(options).join(' · ')}</span>
                )}
              </span>
              <span className="cart-line-total">{formatPrice(l.subtotal, order.currency)}</span>
            </li>
          );
        })}
      </ul>
      <div className="cart-summary">
        <span>Total</span>
        <strong>{formatPrice(order.amount_total, order.currency)}</strong>
      </div>

      {paid && <p className="muted order-row-note">Paid {paid}</p>}

      {address(order)}
    </li>
    );
  };

  return (
    <div className="shop-page shop-narrow">
      <h1>Your orders</h1>

      {confirming === 'waiting' && (
        <section className="card">
          <h2>Confirming your payment…</h2>
          <p className="muted">
            This can take a few seconds — we're waiting for Stripe to tell our server the
            payment went through.
          </p>
          <div className="skeleton" style={{ height: '4rem' }} />
        </section>
      )}

      {confirming === 'settled' && justPaid && (
        <section className="card">
          <h2>{justPaid.status === 'paid' ? 'Thank you — order confirmed' : 'Order not completed'}</h2>
          {justPaid.status !== 'paid' && (
            <div className="form-error" role="alert">
              This order is <strong>{justPaid.status}</strong>. Nothing was charged.
            </div>
          )}
          <ul className="order-list">{line(justPaid)}</ul>
        </section>
      )}

      {confirming === 'unfinished' && justPaid && (
        <section className="card">
          <h2>This order is not paid</h2>
          <p className="muted">
            You opened Checkout for it and did not finish. Nothing has been charged. The link
            below is the same Checkout session — it works until the order expires.
          </p>
          <div className="order-resume">
            <a href={justPaid.checkout_url} className="btn-primary">Finish paying</a>
            <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
              Check again
            </button>
          </div>
        </section>
      )}

      {confirming === 'unfinished' && !justPaid && (
        <section className="card">
          <h2>Payment received — still confirming</h2>
          <div className="success-msg" role="status">
            Your payment went through. Our server hasn't finished recording it yet, which is
            normal and usually takes a few more seconds.
          </div>
          <p className="muted">You have not been charged twice.</p>
          <div className="order-resume">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Check again
            </button>
          </div>
        </section>
      )}

      {confirming === 'error' && (
        <div className="form-error" role="alert">{confirmError}</div>
      )}

      {listError && <div className="form-error" role="alert">{listError}</div>}

      {!auth.isAuthenticated && (
        <div className="shop-empty">
          <p className="muted">
            Orders are kept against a billing account. Sign in to see everything charged to
            yours — a guest checkout has no account to list, and the receipt email carries
            that order's details.
          </p>
          <Link to="/auth/login" className="btn-primary">Log in</Link>
        </div>
      )}

      {auth.isAuthenticated && orders === null && <p className="muted">Loading…</p>}

      {auth.isAuthenticated && orders?.length === 0 && !listError && (
        <div className="shop-empty">
          <p className="muted">Nothing charged to this billing account yet.</p>
          <Link to="/" className="btn-primary">Browse the shop</Link>
        </div>
      )}

      {orders && orders.length > 0 && (
        <ul className="order-list">{orders.map(line)}</ul>
      )}
    </div>
  );
}
