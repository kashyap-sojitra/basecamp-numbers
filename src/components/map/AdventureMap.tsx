"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CAMP_DEFINITIONS, UPCOMING_CAMPS } from "@/lib/data/camps";
import type { ClimberProfile } from "@/lib/domain/onboarding";
import { GRADE_BAND_OPTIONS } from "@/lib/domain/onboarding";
import { campsWithProgress, masteryView, type LearnerProgress } from "@/lib/domain/progress";
import type { ClimbDay } from "@/lib/domain/streak";
import type { LocalDate } from "@/lib/domain/localDate";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { StreakChip } from "@/components/log/StreakChip";
import { MountainBackdrop } from "./MountainBackdrop";
import { CampMarker } from "./CampMarker";
import { CampRoute } from "./CampRoute";
import { UpcomingList, UpcomingMarker } from "./UpcomingCamps";
import { ROUTES } from "@/lib/routes";
import { checkpointCopy } from "@/lib/domain/checkpointCopy";
import { BOARD_SCALE, MOUNTAIN_FRACTION, TOTAL_ASPECT } from "@/lib/domain/mapLayout";

interface AdventureMapProps {
  readonly profile: ClimberProfile;
  /** The learner's saved record, loaded on the server. */
  readonly progress: LearnerProgress;
  /** The climb log, for the streak chip. */
  readonly days: readonly ClimbDay[];
  readonly serverToday: LocalDate;
}

export function AdventureMap({ profile, progress, days, serverToday }: AdventureMapProps) {
  const camps = campsWithProgress(CAMP_DEFINITIONS, progress);
  // The earliest camp asking for a review, if any — the map leads with it.
  const review = camps.find((camp) => camp.progress.status === "checkpoint")?.progress;
  const dimmedCamp = review?.status === "checkpoint" ? review.reviewOf : null;
  const dimmedView = dimmedCamp === null ? null : masteryView(progress, dimmedCamp);
  const openCount = camps.filter((camp) => camp.progress.status !== "locked").length;
  const palette = INTEREST_PALETTES[profile.interestTheme];
  const copy = checkpointCopy(profile.gradeBand);
  const gradeLabel =
    GRADE_BAND_OPTIONS.find((o) => o.value === profile.gradeBand)?.grade ?? profile.gradeBand;

  return (
    <>
      <AppBar current="map" />
      <PageShell>
        <header className="mx-auto mb-6 flex w-full max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-deep">
              Your map
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">
              Four camps to the summit
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StreakChip days={days} serverToday={serverToday} />
            <Chip>Grade {gradeLabel}</Chip>
            <Chip>
              <span aria-hidden className="mr-1">{palette.glyph}</span>
              {palette.label}
            </Chip>
          </div>
        </header>

        {/* A dimmed camp is announced, not left to be noticed. */}
        {dimmedCamp !== null && dimmedView !== null && (
          <motion.aside
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mx-auto mb-5 flex w-full max-w-6xl flex-wrap items-center gap-4 rounded-3xl border-2 border-berry bg-berry-soft p-4"
          >
            <motion.span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-berry text-2xl shadow-md"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              🔔
            </motion.span>
            <div className="min-w-48 flex-1">
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-berry-ink">
                {copy.eyebrow}
              </p>
              <p className="mt-1 text-base font-bold text-ink">
                {copy.headline(dimmedCamp)}
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                {copy.detail(dimmedView.earned, dimmedView.shown, dimmedView.stale)}
              </p>
            </div>
            <Link
              href={ROUTES.checkpoint(dimmedCamp)}
              transitionTypes={["nav-forward"]}
              className="rounded-full bg-berry px-6 py-3 text-sm font-extrabold text-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {copy.action}
            </Link>
          </motion.aside>
        )}

        {/* The mountain needs BOARD_MIN_PX (1152px, the `min-w` below) before the
            four cards fit around markers the backdrop art has already fixed in
            place. Anything narrower gets the route as a list, which reads better
            than a mountain scrolled sideways. */}
        <div className="xl:hidden">
          {/* Summit at the top, so what comes after the summit sits above it. */}
          <UpcomingList camps={UPCOMING_CAMPS} />
          <CampRoute camps={camps} band={profile.gradeBand} palette={palette} />
        </div>

        <div className="hidden xl:block">
          <MountainBoard camps={camps} band={profile.gradeBand} palette={palette} />
        </div>

        <p className="mx-auto mt-5 w-full max-w-6xl text-sm text-ink-soft">
          {dimmedCamp !== null
            ? copy.foot(dimmedCamp)
            : openCount === camps.length
            ? "Every camp is open. Keep their meters full to stay sharp."
            : `${String(openCount)} of ${String(camps.length)} camps open. Fill a camp's Mastery Meter to open the next one.`}
        </p>
      </PageShell>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border-2 border-edge bg-surface px-3 py-1.5 text-xs font-bold text-ink">
      {children}
    </span>
  );
}

/**
 * The mountain board on a laptop: a fixed frame with the board scrolling
 * sideways inside it.
 *
 * The mountain is drawn at the frame's own inner width — sized in CSS from
 * the frame, not in pixels — so the four camps and their cards are all in
 * view on arrival and nothing is clipped. Beyond the summit the picture goes
 * on in proportion (`BOARD_SCALE`) — the next range, where the coming-soon
 * camps stand — and that is what scrolls into view. The border, the rounded corners and the shadow are on the *frame*, so
 * only the mountain moves under them; the scrollbar is `scroll-sleek` in
 * `globals.css`. A fade at the right edge says there is more while there is,
 * and one button takes a child there and back, since a five-year-old will not
 * go looking for a scrollbar.
 */
function MountainBoard({
  camps,
  band,
  palette,
}: {
  readonly camps: ReturnType<typeof campsWithProgress>;
  readonly band: ClimberProfile["gradeBand"];
  readonly palette: (typeof INTEREST_PALETTES)[keyof typeof INTEREST_PALETTES];
}) {
  const frame = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [atEnd, setAtEnd] = useState(false);

  function onScroll() {
    const el = frame.current;
    if (el === null) return;
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }

  function travel() {
    const el = frame.current;
    if (el === null) return;
    const left = atEnd ? 0 : el.scrollWidth - el.clientWidth;
    // jsdom has no scrollTo on elements; setting scrollLeft is the fallback.
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ left, behavior: reduced === true ? "auto" : "smooth" });
    } else {
      el.scrollLeft = left;
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      <div
        ref={frame}
        onScroll={onScroll}
        data-board-frame
        className="scroll-sleek relative rounded-[28px] border-2 border-edge bg-surface shadow-sm"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative"
          style={{ width: `${String(BOARD_SCALE * 100)}%`, aspectRatio: String(TOTAL_ASPECT) }}
        >
          <MountainBackdrop palette={palette} extended />

          {/* The mountain: the camps' markers are percentages of this area,
              so extending the board never moves them. */}
          <div
            className="absolute inset-y-0 left-0"
            style={{ width: `${String(MOUNTAIN_FRACTION * 100)}%` }}
            data-board-mountain
          >
            {camps.map((camp, i) => (
              <CampMarker key={camp.number} camp={camp} band={band} palette={palette} order={i} />
            ))}
          </div>

          {/* The next range: coming soon, and nothing more — not camps, not
              links. Their markers are percentages of this area. */}
          <div
            className="absolute inset-y-0"
            style={{
              left: `${String(MOUNTAIN_FRACTION * 100)}%`,
              width: `${String((1 - MOUNTAIN_FRACTION) * 100)}%`,
            }}
            data-board-extension
          >
            {UPCOMING_CAMPS.map((camp, i) => (
              <UpcomingMarker key={camp.number} camp={camp} order={i} />
            ))}
          </div>
        </motion.div>
      </div>

      {/* Over the frame, not in it, so they do not scroll away. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0.5 right-0.5 w-24 rounded-r-[26px] bg-gradient-to-l from-surface to-transparent transition-opacity duration-300 ${
          atEnd ? "opacity-0" : "opacity-100"
        }`}
      />
      <button
        type="button"
        onClick={travel}
        className="absolute bottom-5 right-5 inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-edge bg-surface px-4 text-xs font-bold text-ink shadow-md transition-colors hover:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {atEnd ? (
          <>
            <span aria-hidden>‹</span> Back to the summit
          </>
        ) : (
          <>
            See what&apos;s next <span aria-hidden>›</span>
          </>
        )}
      </button>
    </div>
  );
}
