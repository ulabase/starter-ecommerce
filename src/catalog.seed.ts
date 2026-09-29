/**
 * A hundred invented products, so the shop has something to page through and
 * something to filter. They live in `catalog.seed.json`, one file that the
 * setup imports and that the Ulabase console loads into an empty
 * `catalog` too, so the shop and the console never disagree on what a product
 * looks like.
 *
 * Content, not configuration: the setup seeds these only when the catalog is
 * empty and never touches the collection again. Delete both files when the
 * shop becomes yours.
 *
 * `category` is not a field the stripe plugin knows about. It rides along
 * because a catalog is a Mongo collection like any other, and what the plugin
 * does not read, it does not mind.
 *
 * Three are `purchasable: false` on purpose: the shop has to filter on that
 * flag rather than show whatever the collection happens to hold.
 *
 * A handful carry `in_stock`, and most do not. That asymmetry is the point: an
 * absent count means nobody is counting, which is what a small shop wants for
 * almost everything it sells. The few that do carry one cover the cases worth
 * seeing:
 *
 * - `tee-classic` has variants counted per article, and its yellow L is down
 *   to its last one, which is what makes two tabs buying it at once something
 *   you can watch happen. XL costs more, which is why a variant is an article
 *   and not a label.
 * - `mug-enamel-set` has variants and no count anywhere: a product with
 *   variants and no count has to keep working, and it is the half that breaks
 *   when the counted path gets all the attention.
 * - `pocket-thundercloud` is the plain-product twin of the yellow L: last one,
 *   no variants involved.
 * - `jar-of-last-monday` is for sale with none left, which differs from
 *   `purchasable: false` and reads the same to a buyer. Both have to reach the
 *   same "Sold out", from opposite directions.
 *
 * Prices are in cents.
 */

import DEMO_PRODUCTS from './catalog.seed.json' with { type: 'json' };

export { DEMO_PRODUCTS };

export const CATEGORIES = [
  'curiosities',
  'desk',
  'kitchen',
  'apparel',
  'books',
  'sound',
  'garden',
  'games',
] as const;

export type Category = (typeof CATEGORIES)[number];
