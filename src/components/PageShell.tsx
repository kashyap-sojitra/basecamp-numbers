import type { ReactNode } from "react";

/**
 * The one page shell. Every screen sits in it, so the side gutters and the
 * vertical rhythm are the same everywhere.
 *
 * `max-w-6xl` because the mountain board is 1152px wide and the widest screen
 * should set the width rather than each screen picking its own — they had
 * picked 3xl, 5xl and 6xl. `py-6` because a 14-inch laptop has roughly 800px
 * of viewport under the browser chrome, and onboarding's `py-16` was spending
 * 128px of it on air. A screen that reads better narrow (the summary) keeps an
 * inner column: the gutters are what has to match, not every block's width.
 */
export const PAGE_SHELL = "mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-8";

export function PageShell({
  children,
  className = "",
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return <main className={`${PAGE_SHELL} ${className}`.trim()}>{children}</main>;
}
