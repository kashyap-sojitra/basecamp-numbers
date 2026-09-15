"use client";

import Link from "next/link";
import { streakFrom, todayView, type ClimbDay } from "@/lib/domain/streak";
import type { LocalDate } from "@/lib/domain/localDate";
import { useToday } from "@/lib/progress/useToday";
import { StreakFlame } from "./StreakFlame";
import { ROUTES } from "@/lib/routes";

interface StreakChipProps {
  readonly days: readonly ClimbDay[];
  readonly serverToday: LocalDate;
}

/**
 * The streak, on the map header, as the way into the climb log. Warm colours
 * are reserved for reward moments, and a live streak is one — so a climbing
 * streak is gold and a resting one is quiet brand ink.
 */
export function StreakChip({ days, serverToday }: StreakChipProps) {
  const today = useToday(serverToday);
  const view = streakFrom(days, today);
  const now = todayView(days, today);
  const climbing = view.status === "climbing";

  const label = climbing
    ? `${String(view.current)}-day streak. ${
        now.goalMet
          ? "Today's climb is done."
          : `${String(now.remaining)} more problems today for a full climb.`
      } Open your progress.`
    : "No streak yet. Open your progress.";

  return (
    <Link
      href={ROUTES.log}
      transitionTypes={["nav-forward"]}
      aria-label={label}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        climbing
          ? "border-reward-deep bg-reward-soft text-reward-ink hover:border-reward-ink"
          : "border-edge text-ink-soft hover:border-brand-deep hover:text-ink"
      }`}
    >
      <StreakFlame view={view} size="text-base" />
      {climbing ? (
        <span>
          {String(view.current)} <span className="font-semibold">day{view.current === 1 ? "" : "s"}</span>
        </span>
      ) : (
        <span>My progress</span>
      )}
      {climbing && !now.goalMet && (
        <span
          aria-hidden
          className="rounded-full bg-reward-deep px-2 py-0.5 text-[11px] font-extrabold text-white"
        >
          {String(now.remaining)} to go
        </span>
      )}
    </Link>
  );
}
