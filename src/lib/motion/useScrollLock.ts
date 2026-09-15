"use client";

import { useEffect } from "react";

/**
 * Stops the page scrolling while a drag is in flight.
 *
 * A CSS transform counts towards the document's scrollable overflow, so a
 * piece dragged past the edge used to grow the page and flash both scrollbars
 * into existence. Constraining the drag fixed that and broke something worse:
 * `dragSnapToOrigin` is clamped by `dragConstraints`, so a piece released
 * outside the board stayed stuck where it was dropped.
 *
 * Locking the root instead leaves the drag itself completely unconstrained —
 * which is the behaviour that always worked — and a page that cannot scroll
 * cannot show a scrollbar. Nobody wants the page scrolling under them
 * mid-drag anyway.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [active]);
}
