"use client";

import Link from "next/link";
import { MasteryMeter } from "@/components/MasteryMeter";
import type { Camp } from "@/lib/domain/camp";
import { mechanicLabel } from "@/lib/domain/camp";
import { ROUTES } from "@/lib/routes";
import type { GradeBand } from "@/lib/domain/onboarding";
import { checkpointCopy } from "@/lib/domain/checkpointCopy";
import { isGated } from "@/lib/domain/progress";

/**
 * What a camp says about itself. Shared by the mountain's markers and the
 * phone's route list, so the two can never drift apart.
 */
export function CampCardBody({
  camp,
  band,
  compact = false,
}: {
  readonly camp: Camp;
  readonly band: GradeBand;
  /**
   * The mountain's cards sit beside markers whose positions are fixed by the
   * backdrop art, so there is a hard budget for how wide one may be. Compact
   * drops the skill sentence and the mechanic label — the overview answers
   * "where do I go", and the camp screen itself answers "what is this".
   * The phone's route list is never compact.
   */
  readonly compact?: boolean;
}) {
  const { progress } = camp;
  const copy = checkpointCopy(band);
  const faded = progress.status !== "locked" && progress.mastery < progress.earned;

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
          Camp {camp.number}
        </p>
        {faded && (
          <p className="rounded-full bg-berry px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
            {copy.chip}
          </p>
        )}
      </div>
      <p className="text-sm font-semibold text-ink">{camp.name}</p>
      {!compact && (
        <>
          <p className="mt-0.5 text-xs leading-snug text-ink-soft">{camp.skill}</p>
          <p className="mt-1.5 text-[10px] font-medium text-brand-deep">
            {mechanicLabel(camp.mechanic)}
          </p>
        </>
      )}
      <CampProgressDetail camp={camp} band={band} compact={compact} />
    </>
  );
}

function CampProgressDetail({
  camp,
  band,
  compact,
}: {
  camp: Camp;
  band: GradeBand;
  compact: boolean;
}) {
  const { progress } = camp;
  const copy = checkpointCopy(band);
  switch (progress.status) {
    case "open": {
      /*
       * A camp whose own meter has dimmed past the threshold offers its review
       * here, on its own card — this is the one place a review may be offered
       * besides the banner, and both name the camp. The child can still climb
       * it instead: practising is another way back up.
       */
      const owesReview = isGated(progress.earned, progress.mastery);
      return (
        <>
          <MasteryMeter mastery={progress.mastery} earned={progress.earned} />
          {owesReview && (
            <Link
              href={ROUTES.checkpoint(camp.number)}
              transitionTypes={["nav-forward"]}
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full bg-berry px-3 text-center text-xs font-extrabold text-white shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {copy.action}
            </Link>
          )}
          <Link
            href={ROUTES.camp(camp.number)}
            transitionTypes={["nav-forward"]}
            className={`flex min-h-11 w-full items-center justify-center rounded-full px-3 text-center text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
              owesReview
                ? "mt-2 border-2 border-edge bg-surface text-ink"
                : "mt-3 bg-gradient-to-r from-brand to-brand-deep text-white"
            }`}
          >
            Climb
          </Link>
        </>
      );
    }
    case "checkpoint":
      /*
       * Gated by a camp below that has gone dim. This card says whom to see and
       * offers nothing to press: it used to carry the review's button, and a
       * child who tapped "Checkpoint" on the summit's card was handed camp 1's
       * number line and read it as the summit's question. A camp's card never
       * opens another camp's questions. The way in is on that camp's own card
       * and on the banner, both of which name it.
       */
      return (
        <>
          <MasteryMeter mastery={progress.mastery} earned={progress.earned} />
          <p className="mt-2 flex min-h-11 items-center justify-center rounded-full border-2 border-berry/40 bg-surface px-3 text-center text-xs font-extrabold text-berry-ink">
            {copy.gate(progress.reviewOf)}
          </p>
          {!compact && (
            <p className="mt-2 text-[11px] font-bold text-berry-ink">
              {copy.card(progress.reviewOf)}
            </p>
          )}
        </>
      );
    case "locked":
      return (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
          <LockGlyph className="size-3" />
          Finish Camp {progress.unlocksAfter} to open
        </p>
      );
  }
}

export function LockGlyph({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor" opacity="0.85" />
      <path
        d="M8.5 10.5V8a3.5 3.5 0 1 1 7 0v2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
