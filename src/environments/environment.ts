export const environment = {
  // Your RESTHeart Cloud **service**, the one with the `stripe` plugin enabled —
  // e.g. 'https://ea820b.eu-central-1-free-1.restheart.com'. Copy it from the
  // service's Connect page in the console.
  //
  // Not the admin node (`cloud-api…`): that is RESTHeart Cloud's own control
  // plane, it serves no tenant collection, and pointing here at it answers every
  // `/catalog` request with 401 — which reads like a permissions problem and is
  // not one.
  // Empty on purpose: the app shows its "configure your service" screen until
  // you fill this in. A plausible-looking default would be somebody's real
  // service — six-character ids are real ids, and shipping one in a public repo
  // points every reader at a stranger's shop.
  apiUrl: '',

  /**
   * Collection names are configured per service
   * (`stripeConfig.products.catalog-collection` / `.orders-collection`), and the
   * interceptors match on the *configured* name — so the HTTP path really does
   * change if a deployment renamed them. These are the defaults the service
   * uses when it hasn't.
   */
  catalogCollection: 'catalog',
  catalogOrdersCollection: 'orders',

  features: {
    emailRegistration: true,
    passwordReset: true,
    oauthLogin: false, // Google sign-in: off until you create its OAuth client (README, "Google sign-in")
    oauthProviders: ['google'] as const,
    teamInvitations: true,
  },
};
