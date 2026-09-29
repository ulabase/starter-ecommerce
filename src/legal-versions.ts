/**
 * The versions of the two legal documents, in one place.
 *
 * They used to appear in four: the ACL permission's `mergeRequest` stamps them,
 * the Guards rule compares them, and each document printed its own — the last
 * being the one nobody could check, because it lived in a static HTML file the
 * setup never read.
 *
 * `ulabase.setup.ts` imports these, and so do the pages. Publish new documents by
 * editing these two strings and re-running the setup: every user meets the
 * acceptance form again on their next request, and the version they accept is
 * the version the pages show.
 */
export const TOS_VERSION = '2026-07-01';
export const PP_VERSION = '2026-07-01';
