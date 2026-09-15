"use client";

import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";
import type { BadgeId } from "@/lib/domain/badges";

/**
 * Which badges this browser has already been shown on the Climb Log, so a
 * newly earned one gets a moment of its own the first time the child opens
 * the page and then settles down.
 *
 * `localStorage` is right for this and nothing more: it is a per-viewer
 * convenience, it never needs to reach the server, and losing it costs one
 * spotlight rather than any progress. The badges themselves stay derived.
 */

const KEY = "bn_seen_badges";

/**
 * Snapshot value meaning "this is the server render, so assume nothing is
 * new". Not valid JSON, so it can never collide with a real stored value.
 */
export const UNKNOWN_SEEN = "server";

const seenSchema = z.array(z.string());

/**
 * What was stored when this page loaded, cached for the life of the page on
 * purpose. `useSyncExternalStore` reads its snapshot every render and treats a
 * change as a changed store, so re-reading storage would make recording "seen"
 * clear the spotlight on the next render.
 */
let snapshot: string | null = null;

function readStorage(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    // Private windows and blocked site data both land here. No spotlight is a
    // fine outcome; a thrown error on a child's screen is not.
    return "[]";
  }
}

/** The raw stored string, kept raw so the store snapshot stays stable. */
export function readSeenBadges(): string {
  snapshot ??= readStorage();
  return snapshot;
}

/**
 * Forgets the cached reading, as a fresh page load would. Exported for tests,
 * which need several "visits" inside one module instance.
 */
export function forgetSeenBadgesSnapshot(): void {
  snapshot = null;
}

/**
 * The parsed set, or null when this is the server render and there is nothing
 * to compare against yet.
 */
export function parseSeenBadges(raw: string): ReadonlySet<string> | null {
  if (raw === UNKNOWN_SEEN) return null;
  try {
    const parsed = seenSchema.safeParse(JSON.parse(raw));
    return new Set(parsed.success ? parsed.data : []);
  } catch {
    return new Set();
  }
}

/**
 * Records the badges now on show, so they are no longer new *next* visit.
 * Deliberately does not touch the cached snapshot above, so this visit keeps
 * its spotlight. Takes the already-serialised list so the caller can depend
 * on a plain string rather than an array that changes identity every render.
 */
export function writeSeenBadges(payload: string): void {
  try {
    window.localStorage.setItem(KEY, payload);
  } catch {
    // Nothing to do: the spotlight simply plays again next visit.
  }
}

/** A stored value never changes under a page, so there is nothing to watch. */
const subscribeToNothing = () => () => {
  // no-op
};

/**
 * The badges earned since this browser last looked at the Climb Log.
 *
 * Read as external state, like every other browser-only value in the app: the
 * server cannot know what this browser has seen, so it renders a calm page
 * with nothing marked new and the client reveals the fresh ones on hydration.
 * Marking them seen happens in an effect, so the render itself stays pure and
 * the spotlight holds for as long as the page is open.
 */
export function useFreshBadges(earned: readonly BadgeId[]): readonly BadgeId[] {
  const raw = useSyncExternalStore(subscribeToNothing, readSeenBadges, () => UNKNOWN_SEEN);
  const payload = JSON.stringify(earned);
  const seen = parseSeenBadges(raw);

  useEffect(() => {
    // Nothing to record until the browser's own answer is in.
    if (raw === UNKNOWN_SEEN) return;
    writeSeenBadges(payload);
  }, [raw, payload]);

  return seen === null ? [] : earned.filter((id) => !seen.has(id));
}
