export const environment = {
  // Your free Ulabase service, e.g. 'https://<srvid>.ulabase.app'.
  // `npx ulabase setup --srv <srvid>` writes it here for you. Empty in the
  // starter's own repository: empty shows the "configure your service" screen.
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
