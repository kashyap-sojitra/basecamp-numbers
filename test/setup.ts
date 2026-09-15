import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * jsdom is missing three browser APIs the app genuinely uses. Each is stubbed
 * with the least convincing thing that still lets the component under test
 * behave: sizes are asserted by stubbing `getBoundingClientRect` in the tests
 * that care, not by pretending to observe layout here.
 */

function stub(name: string, value: unknown): void {
  Object.defineProperty(window, name, { writable: true, configurable: true, value });
}

// Framer Motion reads this on mount to honour prefers-reduced-motion.
stub("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
}));

class StubResizeObserver implements ResizeObserver {
  observe(): void {
    /* nothing to observe: tests stub the rect they need */
  }
  unobserve(): void {
    /* nothing to stop */
  }
  disconnect(): void {
    /* nothing to stop */
  }
}
stub("ResizeObserver", StubResizeObserver);

// The number line scrolls itself so the current jump is in view.
Element.prototype.scrollTo = function scrollTo(): void {
  /* jsdom cannot scroll */
};

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});
