import type { ApiError } from '@ulabase/kit-react';

/**
 * The consents gate, client side.
 *
 * A Guards rule on the service blocks every request from a user who has not
 * accepted the current Terms of Service and Privacy Policy, answering `451`.
 * `/users/me` is one of those requests, so the very first thing the app does on
 * load — restoring the session — is what trips the gate. There is nothing to
 * probe and no collection to set up.
 *
 * Nothing here knows which versions are current — the server decides what is
 * being accepted, so bumping the versions in the Guards rule needs no change
 * and no redeploy on this side.
 */

type Listener = (blocked: boolean) => void;

let blocked = false;
const listeners = new Set<Listener>();

export function isBlocked(): boolean {
  return blocked;
}

export function setBlocked(next: boolean): void {
  if (blocked === next) return;
  blocked = next;
  listeners.forEach(l => l(next));
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/**
 * Raises the flag on any `451` from the service.
 *
 * Passed to `RhAuthProvider` as `config.onError`. Session restoration happens
 * on its own schedule and its failures are absorbed by the provider, so this
 * is the only place that gets to see why it failed — without it, "blocked" and
 * "signed out" are the same thing to the app.
 */
export const consentsOnError = (err: ApiError): void => {
  if (err.status === 451) setBlocked(true);
};
