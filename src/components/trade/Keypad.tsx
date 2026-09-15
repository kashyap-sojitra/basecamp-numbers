"use client";

import { useEffect } from "react";

/**
 * The summit's answer control: a number pad.
 *
 * No other camp types anything — camp 1 walks a line, camp 2 picks a landing,
 * camp 3 drags rows — so this is the one place a child produces a number
 * rather than choosing or placing one. Big keys (56px, well over the 44px
 * floor), the digits in phone order, erase and check on the bottom row, and
 * the entry shown large above them. A physical keyboard works too: digits,
 * Backspace and Enter, so a laptop is not slower than a tablet.
 */

const KEY =
  "flex size-14 items-center justify-center rounded-2xl border-2 text-2xl font-extrabold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";

export function Keypad({
  entry,
  locked,
  onDigit,
  onErase,
  onSubmit,
}: {
  /** The digits typed so far. */
  readonly entry: string;
  /** No more typing: a hint is up, or the number has been found. */
  readonly locked: boolean;
  readonly onDigit: (digit: number) => void;
  readonly onErase: () => void;
  readonly onSubmit: () => void;
}) {
  useEffect(() => {
    if (locked) return;
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^[0-9]$/.test(event.key)) {
        onDigit(Number(event.key));
      } else if (event.key === "Backspace") {
        onErase();
      } else if (event.key === "Enter") {
        onSubmit();
      } else {
        return;
      }
      event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [locked, onDigit, onErase, onSubmit]);

  const canCheck = !locked && entry !== "";

  return (
    <div className="inline-flex flex-col items-center gap-3" data-keypad>
      {/* The entry, read out as it changes. A question mark until something is typed. */}
      <output
        aria-label="Your answer"
        aria-live="polite"
        className="flex min-h-14 w-full min-w-48 items-center justify-center rounded-2xl border-2 border-edge bg-surface-tint px-4 text-4xl font-extrabold tabular-nums tracking-tight text-ink"
      >
        {entry === "" ? <span className="text-ink-soft">?</span> : entry}
      </output>

      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={locked}
            onClick={() => { onDigit(digit); }}
            className={`${KEY} border-edge bg-surface text-ink hover:border-brand disabled:opacity-50`}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          aria-label="Erase"
          disabled={locked || entry === ""}
          onClick={onErase}
          className={`${KEY} border-edge bg-surface-tint text-ink-soft hover:border-brand disabled:opacity-50`}
        >
          <span aria-hidden>⌫</span>
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => { onDigit(0); }}
          className={`${KEY} border-edge bg-surface text-ink hover:border-brand disabled:opacity-50`}
        >
          0
        </button>
        <button
          type="button"
          aria-label="Check my answer"
          disabled={!canCheck}
          onClick={onSubmit}
          className={`${KEY} border-transparent bg-gradient-to-r from-brand to-brand-deep text-white shadow-md disabled:opacity-40 disabled:shadow-none`}
        >
          <span aria-hidden>✓</span>
        </button>
      </div>
    </div>
  );
}
