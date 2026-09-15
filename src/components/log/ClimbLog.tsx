"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Celebration } from "@/components/effects/Celebration";
import { CAMP_DEFINITIONS } from "@/lib/data/camps";
import { badgesFor, type Badge } from "@/lib/domain/badges";
import { recentDays, type LocalDate } from "@/lib/domain/localDate";
import { GRADE_BAND_OPTIONS, type ClimberProfile, type GradeBand } from "@/lib/domain/onboarding";
import { masteryView, type LearnerProgress } from "@/lib/domain/progress";
import {
  campBestDay,
  climbTotals,
  daysInBand,
  streakFrom,
  streakMessage,
  todayView,
  type ClimbDay,
} from "@/lib/domain/streak";
import { INTEREST_PALETTES } from "@/lib/theme/interestTheme";
import { useToday } from "@/lib/progress/useToday";
import { useFreshBadges } from "@/lib/progress/seenBadges";
import { SPRING } from "@/lib/motion/presets";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { StreakFlame } from "./StreakFlame";
import { MASTERY_MAX, isCampComplete } from "@/lib/domain/mastery";
import { CAMP_NUMBERS } from "@/lib/domain/camp";

/** One band's climb, as the screen needs it. Mirrors the repository's shape. */
export interface ClimbView {
  readonly progress: LearnerProgress;
  readonly checkpointsPassed: number;
}

interface ClimbLogProps {
  readonly profile: ClimberProfile;
  /** The climb of the band being climbed now. */
  readonly progress: LearnerProgress;
  /** Every band's climb, for the breakdown. */
  readonly climbs: Readonly<Record<GradeBand, ClimbView>>;
  /** Every band's rows; the screen picks what each section should read. */
  readonly days: readonly ClimbDay[];
  /** Checkpoint reviews passed in the band being climbed now. */
  readonly checkpointsPassed: number;
  readonly serverToday: LocalDate;
}

/** How much of the calendar is shown. Two weeks fits a phone without scrolling. */
const CALENDAR_DAYS = 14;

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"] as const;

function weekdayInitial(date: LocalDate): string {
  const index = new Date(`${date}T00:00:00Z`).getUTCDay();
  return WEEKDAY[index] ?? "?";
}

function dayOfMonth(date: LocalDate): string {
  return String(Number(date.slice(8, 10)));
}

/** "K–1", as the adult reads it, for a band. */
function gradeLabel(band: GradeBand): string {
  return GRADE_BAND_OPTIONS.find((option) => option.value === band)?.grade ?? band;
}

/** The child's own name for a band: "I'm getting good". */
function stageLabel(band: GradeBand): string {
  return GRADE_BAND_OPTIONS.find((option) => option.value === band)?.stage ?? band;
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

/** The badge grid deals itself out rather than appearing all at once. */
const dealOut = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
};

const dealIn = {
  hidden: { opacity: 0, y: 16, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1 },
};

/**
 * My progress. Two scopes, kept apart on purpose:
 *
 * - **Turning up** is the child's, whatever they were climbing: the streak,
 *   today's goal, the calendar, days climbed. Those read every row.
 * - **The climb** is the grade's: badges, each camp's best day, problems
 *   solved and right first time. Those read only this grade's rows and this
 *   grade's meters, so a fresh grade starts from nothing. It used to read the
 *   whole log, and a child who switched grade arrived with First Steps and
 *   Century already earned.
 *
 * Then every grade the child has climbed, side by side, each with its four
 * camp meters, so switching grade never makes a climb disappear.
 */
export function ClimbLog({
  profile,
  progress,
  climbs,
  days,
  checkpointsPassed,
  serverToday,
}: ClimbLogProps) {
  const reduced = useReducedMotion();
  const today = useToday(serverToday);
  const band = profile.gradeBand;

  // Turning up: every row.
  const streak = streakFrom(days, today);
  const now = todayView(days, today);
  const everything = climbTotals(days);

  // The climb: this grade's rows and meters.
  const mine = daysInBand(days, band);
  const totals = climbTotals(mine);
  const badges = badgesFor({ band, progress, days, today, checkpointsPassed });
  const palette = INTEREST_PALETTES[profile.interestTheme];

  // Solves per calendar day, for the strip.
  const perDay = new Map<LocalDate, number>();
  for (const day of days) {
    perDay.set(day.date, (perDay.get(day.date) ?? 0) + day.solves);
  }
  const calendar = recentDays(today, CALENDAR_DAYS);
  const earned = badges.filter((badge) => badge.earned);
  const earnedCount = earned.length;
  // Badges won since this browser last looked. Usually none, which is the
  // point: the spotlight means something because it is rare.
  const fresh = useFreshBadges(earned.map((badge) => badge.id));
  const freshIds = new Set<string>(fresh);

  // Every grade with anything in it, plus the one being climbed, in grade order.
  const climbed = GRADE_BAND_OPTIONS.map((option) => option.value).filter((other) => {
    if (other === band) return true;
    const rows = daysInBand(days, other);
    const meters = CAMP_NUMBERS.some((camp) => climbs[other].progress.camps[camp].earned > 0);
    return rows.length > 0 || meters;
  });

  return (
    <>
      <AppBar current="log" />
      <PageShell>
        <motion.div
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.08 }}
          className="mx-auto w-full max-w-5xl"
        >
          <motion.header
            variants={fadeUp}
            className="mb-6 flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-deep">
                My progress
              </p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">
                Everything you have climbed
              </h1>
            </div>
            <p className="rounded-full border-2 border-edge bg-surface px-3 py-1.5 text-xs font-bold text-ink">
              Climbing now: Grade {gradeLabel(band)}
            </p>
          </motion.header>

          {/* ---------------------------------------------------------------- */}
          {/* Turning up: the streak, today, the calendar. Every grade counts. */}
          <motion.section
            variants={fadeUp}
            aria-labelledby="streak-heading"
            className={`mb-6 overflow-hidden rounded-[28px] border-2 p-6 ${
              streak.status === "climbing"
                ? "border-reward-deep bg-reward-soft"
                : "border-edge bg-surface"
            }`}
          >
            <div className="flex flex-wrap items-center gap-5">
              <div
                className={`flex size-20 shrink-0 items-center justify-center rounded-3xl ${
                  streak.status === "climbing" ? "bg-white shadow-md" : "bg-surface-tint"
                }`}
              >
                <StreakFlame view={streak} />
              </div>

              <div className="min-w-56 flex-1">
                <h2
                  id="streak-heading"
                  className={`text-xs font-extrabold uppercase tracking-[0.22em] ${
                    streak.status === "climbing" ? "text-reward-ink" : "text-ink-soft"
                  }`}
                >
                  {streak.status === "climbing" ? "Streak going" : "Streak resting"}
                </h2>
                <p className="mt-1 text-3xl font-extrabold text-ink">
                  {String(streak.current)} day{streak.current === 1 ? "" : "s"} in a row
                </p>
                <p className="mt-1 text-sm font-medium text-ink-soft">
                  {streakMessage(streak, now)}
                </p>
              </div>

              {/* Today's small, reachable goal — the reason to open the app at all. */}
              <div className="flex items-center gap-3 rounded-3xl border-2 border-edge bg-surface px-5 py-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-ink-soft">
                    Today
                  </p>
                  <p className="text-2xl font-extrabold text-ink">
                    {String(now.solves)}
                    <span className="text-base font-bold text-ink-soft">
                      /{String(now.goal)}
                    </span>
                  </p>
                </div>
                <span aria-hidden className="text-2xl">
                  {now.goalMet ? "✅" : palette.glyph}
                </span>
              </div>
            </div>

            {/* The last fortnight. A climbed day is filled; a full one is gold. */}
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="The last two weeks">
              {calendar.map((date) => {
                const solves = perDay.get(date) ?? 0;
                const full = solves >= now.goal;
                const climbedDay = solves > 0;
                const isToday = date === today;
                return (
                  <li key={date}>
                    <div
                      className={`flex size-11 flex-col items-center justify-center rounded-2xl border-2 ${
                        full
                          ? "border-reward-deep bg-reward text-reward-ink"
                          : climbedDay
                            ? "border-brand-deep bg-brand/15 text-brand-deep"
                            : "border-edge bg-surface text-ink-soft"
                      } ${isToday ? "ring-2 ring-ink ring-offset-2" : ""}`}
                      title={`${date}: ${String(solves)} solved`}
                    >
                      <span aria-hidden className="text-[10px] font-bold uppercase">
                        {weekdayInitial(date)}
                      </span>
                      <span aria-hidden className="text-xs font-extrabold leading-none">
                        {dayOfMonth(date)}
                      </span>
                      <span className="sr-only">
                        {date}: {String(solves)} problems solved
                        {isToday ? ", today" : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs font-medium text-ink-soft">
              Every grade counts towards your streak.
            </p>
          </motion.section>

          {/* ---------------------------------------------------------------- */}
          {/* The climb: this grade's badges. Locked ones are silhouettes. */}
          <motion.section
            variants={fadeUp}
            aria-labelledby="badges-heading"
            className="relative mb-6 rounded-[28px] border-2 border-edge bg-surface p-6"
          >
            {/* Only mounted once there is something to celebrate. `fresh` is
                always empty on the server, so this keeps the confetti — which
                renders nothing at all under reduced motion — out of the
                hydrated markup entirely. */}
            {fresh.length > 0 && <Celebration variant="burst" fireKey={fresh.length} />}

            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="badges-heading" className="text-xl font-bold text-ink">
                Badges <span className="text-base font-semibold text-ink-soft">· Grade {gradeLabel(band)}</span>
              </h2>
              <p className="text-sm font-semibold text-ink-soft">
                {String(earnedCount)} of {String(badges.length)} earned
              </p>
            </div>

            {fresh.length > 0 && (
              <motion.p
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={SPRING.bounce}
                className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-reward-deep bg-reward-soft px-4 py-2 text-sm font-extrabold text-reward-ink"
                // Announced, not just decorated, so a screen reader hears it too.
                role="status"
              >
                <span aria-hidden className="text-base">🎉</span>
                {fresh.length === 1
                  ? "1 new badge since last time!"
                  : `${String(fresh.length)} new badges since last time!`}
              </motion.p>
            )}

            <motion.ul variants={dealOut} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {badges.map((badge, index) => (
                <BadgeCard
                  key={badge.id}
                  badge={badge}
                  index={index}
                  isNew={freshIds.has(badge.id)}
                  reduced={reduced === true}
                />
              ))}
            </motion.ul>
          </motion.section>

          {/* ---------------------------------------------------------------- */}
          {/* The climb: this grade's best day at each camp. */}
          <motion.section
            variants={fadeUp}
            aria-labelledby="bests-heading"
            className="mb-6 rounded-[28px] border-2 border-edge bg-surface p-6"
          >
            <h2 id="bests-heading" className="mb-5 text-xl font-bold text-ink">
              Your best day at each camp{" "}
              <span className="text-base font-semibold text-ink-soft">· Grade {gradeLabel(band)}</span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {CAMP_DEFINITIONS.map((camp) => {
                const best = campBestDay(mine, camp.number);
                const view = masteryView(progress, camp.number);
                return (
                  <li
                    key={camp.number}
                    className="flex items-center gap-4 rounded-3xl border-2 border-edge bg-surface-tint px-4 py-3"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">
                      {String(camp.number)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-ink">{camp.name}</p>
                      <p className="text-sm text-ink-soft">
                        Meter {String(view.shown)}/{String(MASTERY_MAX)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-ink">{String(best)}</p>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                        best day
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.section>

          {/* ---------------------------------------------------------------- */}
          {/* Every grade climbed, side by side, each with its four camps. */}
          <motion.section
            variants={fadeUp}
            aria-labelledby="grades-heading"
            className="mb-6 rounded-[28px] border-2 border-edge bg-surface p-6"
          >
            <h2 id="grades-heading" className="mb-1 text-xl font-bold text-ink">
              Your climbs, grade by grade
            </h2>
            <p className="mb-5 text-sm text-ink-soft">
              Each grade is its own mountain. Change grade in Grade &amp; world to climb another.
            </p>
            <ul className="grid gap-3">
              {climbed.map((other) => {
                const climb = climbs[other];
                const rows = climbTotals(daysInBand(days, other));
                const mastered = CAMP_NUMBERS.filter((camp) =>
                  isCampComplete(climb.progress.camps[camp].earned),
                ).length;
                const current = other === band;
                return (
                  <li
                    key={other}
                    data-grade={other}
                    className={`rounded-3xl border-2 px-4 py-4 ${
                      current ? "border-brand bg-surface-tint" : "border-edge bg-surface"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-base font-bold text-ink">
                        Grade {gradeLabel(other)}{" "}
                        <span className="text-sm font-semibold text-ink-soft">· {stageLabel(other)}</span>
                      </p>
                      {current && (
                        <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
                          Climbing now
                        </span>
                      )}
                    </div>
                    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={`Grade ${gradeLabel(other)} camps`}>
                      {CAMP_DEFINITIONS.map((camp) => {
                        const meter = climb.progress.camps[camp.number].earned;
                        const full = isCampComplete(meter);
                        return (
                          <li
                            key={camp.number}
                            className={`rounded-2xl border-2 px-3 py-2 ${
                              full ? "border-reward-deep bg-reward-soft" : "border-edge bg-surface"
                            }`}
                          >
                            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                              Camp {String(camp.number)}
                            </p>
                            <p className={`text-lg font-extrabold ${full ? "text-reward-ink" : "text-ink"}`}>
                              {String(meter)}
                              <span className="text-xs font-bold text-ink-soft">/{String(MASTERY_MAX)}</span>
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 text-sm text-ink-soft">
                      {String(rows.solves)} solved · {String(rows.cleanSolves)} right first time ·{" "}
                      {String(mastered)} of {String(CAMP_NUMBERS.length)} camps mastered
                    </p>
                  </li>
                );
              })}
            </ul>
          </motion.section>

          {/* ---------------------------------------------------------------- */}
          <motion.section
            variants={fadeUp}
            aria-label="Totals"
            className="grid gap-3 sm:grid-cols-4"
          >
            <Total value={totals.solves} label={`solved in grade ${gradeLabel(band)}`} />
            <Total value={everything.solves} label="solved, every grade" />
            <Total value={everything.daysClimbed} label="days climbed" />
            <Total value={streak.longest} label="longest streak" />
          </motion.section>
        </motion.div>
      </PageShell>
    </>
  );
}

function Total({ value, label }: { readonly value: number; readonly label: string }) {
  return (
    <div className="rounded-3xl border-2 border-edge bg-surface px-5 py-4 text-center">
      <p className="text-3xl font-extrabold text-ink">{String(value)}</p>
      <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </p>
    </div>
  );
}

function BadgeCard({
  badge,
  index,
  isNew,
  reduced,
}: {
  readonly badge: Badge;
  readonly index: number;
  /** Earned since this browser last looked, so it gets the spotlight. */
  readonly isNew: boolean;
  readonly reduced: boolean;
}) {
  const percent = Math.round(badge.progress * 100);

  return (
    <motion.li
      variants={dealIn}
      transition={SPRING.settle}
      className={`relative flex items-center gap-4 rounded-3xl border-2 p-4 ${
        badge.earned ? "border-reward-deep bg-reward-soft" : "border-edge bg-surface-tint"
      } ${isNew ? "shadow-lg" : ""}`}
    >
      {/* The spotlight: a ring that breathes around a badge just won. */}
      {isNew && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-1 rounded-[26px] border-2 border-reward-deep"
          animate={reduced ? { opacity: 0.9 } : { opacity: [0.25, 1, 0.25], scale: [1, 1.02, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <motion.span
        aria-hidden
        className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${
          badge.earned ? "bg-white shadow-md" : "bg-edge/60 opacity-40 grayscale"
        }`}
        animate={
          isNew && !reduced
            ? { rotate: [0, -14, 14, 0], scale: [1, 1.18, 1] }
            : badge.earned && !reduced
              ? { rotate: [0, -8, 8, 0] }
              : { rotate: 0 }
        }
        transition={{
          duration: isNew ? 1.4 : 2.6,
          repeat: Infinity,
          delay: isNew ? 0 : index * 0.25,
          ease: "easeInOut",
        }}
      >
        {badge.glyph}
      </motion.span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-base font-bold ${badge.earned ? "text-reward-ink" : "text-ink-soft"}`}
        >
          {badge.name}
          {isNew && (
            <span className="ml-2 rounded-full bg-reward-deep px-2 py-0.5 align-middle text-[10px] font-extrabold uppercase tracking-wide text-white">
              New
            </span>
          )}
        </p>
        <p className="text-sm text-ink-soft">{badge.how}</p>

        {!badge.earned && (
          <div className="mt-2">
            <div
              className="h-2 overflow-hidden rounded-full bg-edge ring-1 ring-ink/25"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${badge.name} progress`}
            >
              <div className="h-full rounded-full bg-brand" style={{ width: `${String(percent)}%` }} />
            </div>
          </div>
        )}
      </div>

      {badge.earned && (
        <span className="shrink-0 text-lg" aria-label="Earned" role="img">
          ⭐
        </span>
      )}
    </motion.li>
  );
}
