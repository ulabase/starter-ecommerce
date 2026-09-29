# Ulabase Starter — Ecommerce

A real online shop: product catalogue, cart, card payments through Stripe, and orders you can
look up afterwards. People can buy without creating an account, and the ones who do get sign-up,
login, password reset and teams.

It is a React app plus a [Ulabase](https://cloud.restheart.com) service. There is no
server of yours to write, deploy or pay for.

![The shop, with the demo catalogue](./starter-shop.png)

## Get it running

**You need:** [Node.js](https://nodejs.org) 18 or later, a free Ulabase service, and a
[Stripe](https://stripe.com) account. Both are free to sign up for.

### 1. Clone it

```bash
git clone https://github.com/ulabase/starter-ecommerce.git
cd ulabase-starter-ecommerce
npm install
```

### 2. Point it at your service

Create a **free service** at [cloud.restheart.com](https://cloud.restheart.com) and copy its URL
from the service's *Connect* page. Put it in `src/environments/environment.ts`:

```ts
apiUrl: 'https://xxxxxx.eu-central-1-free-1.restheart.com',
```

> Use the URL of **your service**, not `cloud-api.restheart.com`. That second one is RESTHeart
> Cloud's own control panel, and pointing the app at it makes every request fail.

### 3. Set the service up

This installs the payment feature, creates the collections, opens the shop to visitors without an
account, turns on sign-up, login and password reset, and puts a few demo products in the
catalogue.

First you need two things from Stripe, both in **test mode** — check the toggle at the top right
of the Stripe dashboard says *Test mode*.

**The secret key.** [Developers → API keys](https://dashboard.stripe.com/test/apikeys), copy the
one starting `sk_test_`.

**The webhook signing secret.** This one takes a minute: Stripe has to know where to tell your
service that a payment went through, and your service has to know the message really came from
Stripe.

In [Developers → Webhooks](https://dashboard.stripe.com/test/webhooks), add an event destination:

1. **Events** — scope *Your account*, then select these six:
   ```
   checkout.session.completed
   checkout.session.async_payment_succeeded
   checkout.session.async_payment_failed
   checkout.session.expired
   charge.refunded
   charge.dispute.created
   ```
   The first is the one that marks an order paid. The rest cover slow payment methods, abandoned
   checkouts, refunds and disputes. Leave the API version as Stripe suggests it.
2. **Destination type** — *Webhook endpoint*.
3. **Destination** — the URL is your service plus `/stripe/webhook`:
   ```
   https://xxxxxx.eu-central-1-free-1.restheart.com/stripe/webhook
   ```

Save it, then reveal the **signing secret** on the destination you just made. It starts `whsec_`.

> Your service is on the public internet, so Stripe reaches it directly. You do not need the
> Stripe CLI or `stripe listen` — those are for a webhook arriving at your laptop.

```bash
npm install -g ulabase   # the ulabase command; the setup file's own copy came with npm install

export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_WEBHOOK_SECRET=whsec_...

ulabase login
ulabase setup --srv <srvId>
```

`ulabase login` asks for a **personal access token**, which you create first: in
[cloud.restheart.com](https://cloud.restheart.com), open your profile and issue one. It is not
your account password — the CLI has no way to accept one. A token carries the `cli` role rather
than yours, so it configures services and cannot buy one, and revoking it touches nothing else.

`<srvId>` is the six characters at the start of your service URL.

You only need the Stripe keys the first time. After that the service keeps them, and re-running
the command asks for nothing.

### 4. Start it

```bash
npm run dev
```

Open [localhost:5173](http://localhost:5173) and the shop is there, with four demo products.
Buy one with Stripe's test card `4242 4242 4242 4242`, any future expiry date, any CVC.

## Going live

Three things change, and nothing else:

1. **Real Stripe keys.** Swap the test keys for live ones and run `ulabase setup --srv <srvId>`
   again. Take payments only once you have tested the whole flow.
2. **Your own products.** Replace the demo ones in the `catalog` collection, from the RESTHeart
   Cloud console. A product needs a name, a price and `purchasable: true` to be sold.
3. **Your own look.** Everything visual is in `src/styles.css` and is meant to be replaced.

## Making it yours

| To change | Look in |
|---|---|
| Colours, fonts, spacing | `src/styles.css` |
| The shop pages | `src/pages/shop/` |
| What is on the catalogue | the `catalog` collection, in the console |
| What the service must have | `ulabase.setup.ts` — run `ulabase setup` after editing |

## Something not working?

**The shop is empty.** The catalogue has no products with `purchasable: true`. Run
`ulabase setup --srv <srvId>` to add the demo ones.

**Everything fails, or you see a login page you did not ask for.** `apiUrl` is probably pointing
at `cloud-api.restheart.com` instead of your own service — see step 2.

**Payment goes through but the order stays "pending".** The webhook is not arriving. In Stripe,
open your event destination and look at the recent deliveries: a `401` or `404` means the URL is
wrong — it must end in `/stripe/webhook` — and a `400` means the signing secret does not match the
one you gave `ulabase setup`. If `checkout.session.completed` is not in the selected events, nothing is
sent at all.

## More

[NOTES.md](./NOTES.md) has how the app is put together, the route map, what each part does, and
the things worth knowing before this becomes a real shop.

[SEO.md](./SEO.md) has how product pages get their own title, price and preview image — what a
single-page app cannot do on its own, and what this one does about it.

- [Ulabase documentation](https://restheart.org/docs/cloud/)
- [The `ulabase` command line](https://restheart.org/docs/cloud/cli)
- [Stripe on Ulabase](https://restheart.org/docs/cloud/stripe)
