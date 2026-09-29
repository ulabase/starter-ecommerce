import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatPrice, useAuth, useCart, usePayments } from '@ulabase/kit-react';
import { environment } from '../../environments/environment';
import { rememberPendingOrder } from '../../shop/pending-order';
import './Shop.css';

/**
 * The cart, and the last page before Stripe.
 *
 * There used to be a `/checkout` between them, and by the end it had no job
 * left. For someone signed in it repeated this page's summary and added a
 * button. For a guest it asked for an email — which Stripe asks for anyway on
 * its own page, and which the webhook writes back onto the order from the
 * customer details, so the field was collecting something the server was going
 * to learn regardless. The shipping address went the same way when Stripe
 * started collecting that too.
 *
 * What was worth keeping is the offer of an account, and that belongs here,
 * beside the button where the choice is actually made.
 */
export default function Cart() {
  const cart = useCart();
  const auth = useAuth();
  const payments = usePayments();

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = async () => {
    setError(null);
    setStarting(true);

    // Built by the cart, not here: the lines carry the options that were chosen,
    // and a hand-rolled `{ productId, quantity }` drops them — which is how the
    // seller ends up with an order that says "Classic T-shirt" and never says
    // which one.
    const items = cart.orderItems;

    try {
      // No email, even for a guest: Stripe collects one on its own page and the
      // webhook fills `buyer_email` from what it returns.
      const order = await payments.createOrder(items, undefined, environment.catalogOrdersCollection);

      // Write the secret down BEFORE leaving for Stripe. The success URL is
      // configured server-side and cannot carry it, so this is the only way the
      // orders page will be able to read the order back — especially for a
      // guest, who has no session to identify them.
      rememberPendingOrder(order._id.$oid, order.secret);

      // The cart stays. Emptying it here loses it for everyone who reaches
      // Stripe and changes their mind — and Stripe's own cancel link brings
      // them back to this page, which would greet them with "Nothing in it
      // yet." after they had just built a basket. It is cleared on the orders
      // page, once an order actually reads `paid`.
      window.location.href = order.checkout_url;
    } catch (err) {
      const e = err as { status?: number; message?: string };
      setStarting(false);
      // A 401 is the one failure this page can explain better than the server:
      // it means the service does not permit anonymous orders, which is its
      // ACL's decision and says nothing a buyer could act on.
      setError(
        e.status === 401
          ? 'This service requires an account to order. Please sign in.'
          : (e.message ?? `Could not start checkout${e.status ? ` (HTTP ${e.status})` : ''}.`)
      );
    }
  };

  if (cart.lines.length === 0) {
    return (
      <div className="shop-page shop-narrow shop-empty">
        <h1>Your cart</h1>
        <p className="muted">Nothing in it yet.</p>
        <Link to="/" className="btn-primary">Browse the shop</Link>
      </div>
    );
  }

  return (
    <div className="shop-page shop-narrow">
      <h1>Your cart</h1>

      <ul className="cart-lines">
        {cart.lines.map(line => (
          <li key={line.productId} className="cart-line">
            {line.image && <img src={line.image} alt="" className="cart-line-image" />}

            <div className="cart-line-main">
              {/* Back to what was bought, not to the family: a cart is also where people go to
                  change their mind about a size. */}
              <Link to={`/product/${encodeURIComponent(line.productId.split('/')[0]!)}`}
                    className="cart-line-name">
                {line.name}
              </Link>
              {line.options && (
                <span className="cart-line-options">
                  {Object.values(line.options).join(' · ')}
                </span>
              )}
              <span className="muted">{formatPrice(line.unitAmount, line.currency)} each</span>
            </div>

            <div className="cart-line-qty">
              <label className="sr-only" htmlFor={`qty-${line.productId}`}>
                Quantity for {line.name}
              </label>
              <input
                id={`qty-${line.productId}`}
                type="number"
                min={1}
                value={line.quantity}
                onChange={e => cart.setQuantity(line.productId, Number(e.target.value))}
              />
            </div>

            <span className="cart-line-total">
              {formatPrice(line.unitAmount * line.quantity, line.currency)}
            </span>

            <button
              type="button"
              className="btn-danger-text"
              onClick={() => cart.remove(line.productId)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <div className="cart-summary">
        <span>Subtotal</span>
        <strong>{formatPrice(cart.subtotal, cart.currency)}</strong>
      </div>
      <p className="muted cart-note">
        Tax and shipping, if any, are calculated by Stripe at checkout. The server prices the
        order from its own catalog — these amounts are for display.
      </p>

      {error && <div className="form-error" role="alert">{error}</div>}

      {!auth.isAuthenticated && (
        <p className="muted checkout-account">
          <strong>Have an account?</strong>{' '}
          <Link to="/auth/login?next=/cart">Log in</Link> and come straight back — your cart is
          kept, and your orders are then listed under your billing account. You do not need one
          to buy.
        </p>
      )}

      <div className="form-row cart-actions">
        <Link to="/" className="btn-secondary">Keep shopping</Link>
        <button type="button" className="btn-primary" onClick={checkout} disabled={starting}>
          {starting ? 'Starting…' : 'Pay with Stripe'}
        </button>
      </div>

      {/* Said before the click, not discovered after it. A button that silently moves someone to
          a domain they did not expect is where people abandon a cart — and "card details never
          reach this shop" is the reassurance that answers the worry it raises. */}
      <p className="muted cart-note">
        You will be taken to Stripe to pay. Your card details never reach this shop, and you can
        come back if you change your mind.
      </p>
    </div>
  );
}
