"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { AppBar } from "@/components/AppBar";
import { PageShell } from "@/components/PageShell";
import { ButtonSpinner } from "@/components/effects/ButtonSpinner";
import { MountainBackdrop } from "@/components/map/MountainBackdrop";
import { WorldScenery } from "@/components/map/WorldScenery";
import {
  GRADE_BAND_OPTIONS,
  INTEREST_THEME_OPTIONS,
  type ClimberProfile,
  type GradeBand,
  type InterestTheme,
} from "@/lib/domain/onboarding";
import {
  INTEREST_PALETTES,
  UNPICKED_PALETTE,
  type InterestPalette,
} from "@/lib/theme/interestTheme";
import { ROUTES, API } from "@/lib/routes";

/** Both picks made, or still waiting on one of them. */
type Draft =
  | { readonly kind: "incomplete"; readonly gradeBand: GradeBand | null; readonly interestTheme: InterestTheme | null }
  | { readonly kind: "ready"; readonly gradeBand: GradeBand; readonly interestTheme: InterestTheme };

function toDraft(
  gradeBand: GradeBand | null,
  interestTheme: InterestTheme | null,
): Draft {
  if (gradeBand !== null && interestTheme !== null) {
    return { kind: "ready", gradeBand, interestTheme };
  }
  return { kind: "incomplete", gradeBand, interestTheme };
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

/*
 * The ambient wash behind everything. Brand violet, Nerdy cyan and mint — the
 * decorative colours, which carry no meaning and so may be translucent. No
 * warm hue: yellow is for a win, and nothing has been won yet.
 */
const WASH =
  "radial-gradient(48% 62% at 0% 0%, rgba(108,100,201,0.16), transparent 70%), " +
  "radial-gradient(42% 58% at 100% 8%, rgba(23,226,234,0.16), transparent 70%), " +
  "radial-gradient(52% 55% at 72% 100%, rgba(53,221,139,0.12), transparent 70%)";

const CARD =
  "relative flex overflow-hidden rounded-2xl border-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand";
const CARD_IDLE = "border-edge hover:border-brand/60 hover:shadow-md";
const CARD_PICKED = "border-brand shadow-lg";

interface OnboardingScreenProps {
  /** A returning learner's saved picks, so changing them starts from what they chose. */
  readonly existing: ClimberProfile | null;
}

/** Arrow-key movement within a radiogroup, as the role implies. */
function radioGroupKeys(
  event: React.KeyboardEvent<HTMLDivElement>,
  count: number,
  index: number,
  choose: (next: number) => void,
): void {
  const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
  const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
  if (!forward && !back) return;
  event.preventDefault();
  // Wraps, which is what a radiogroup does.
  choose((index + (forward ? 1 : -1) + count) % count);
}

/** The tick on a chosen card. Decoration: `aria-checked` carries the state. */
function PickedMark() {
  return (
    <span
      aria-hidden
      className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-white"
    >
      ✓
    </span>
  );
}

/** A step's heading: the number, then the question. */
function StepHeading({ step, id, children }: { step: number; id: string; children: string }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-extrabold text-white">
        {step}
      </span>
      <h2 id={id} className="text-lg font-bold text-ink">
        {children}
      </h2>
    </div>
  );
}

/**
 * A world card's scenery: two ridges in the theme's own colours across the
 * bottom of the card, so the card *is* a glimpse of that world's mountain
 * rather than a gradient with a label under it. Stretched to the card's
 * width; silhouettes do not mind.
 */
function WorldScene({ palette }: { palette: InterestPalette }) {
  return (
    <svg
      viewBox="0 0 320 120"
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] w-full"
    >
      <path
        d="M0 120 L0 74 L58 34 L118 70 L182 26 L244 64 L320 38 L320 120 Z"
        fill={palette.ridgeFar}
        opacity="0.7"
      />
      <path
        d="M0 120 L0 96 L72 56 L132 88 L212 30 L272 78 L320 64 L320 120 Z"
        fill={palette.ridge}
      />
      <path d="M200 40 L212 30 L225 42 L217 38 L209 44 L203 38 Z" fill="#ffffff" />
    </svg>
  );
}

export function OnboardingScreen({ existing }: OnboardingScreenProps) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const [gradeBand, setGradeBand] = useState<GradeBand | null>(existing?.gradeBand ?? null);
  const [interestTheme, setInterestTheme] = useState<InterestTheme | null>(
    existing?.interestTheme ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const draft = toDraft(gradeBand, interestTheme);
  const preview = interestTheme === null ? UNPICKED_PALETTE : INTEREST_PALETTES[interestTheme];

  async function start() {
    if (draft.kind !== "ready" || saving) return;
    setSaving(true);
    setProblem(null);

    try {
      const response = await fetch(API.learner, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gradeBand: draft.gradeBand,
          interestTheme: draft.interestTheme,
        }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const parsed = z.object({ error: z.string() }).safeParse(body);
        throw new Error(parsed.success ? parsed.data.error : `Save failed (${String(response.status)})`);
      }
      router.push(ROUTES.map);
    } catch (error) {
      console.error("[onboarding] could not save picks:", error);
      setSaving(false);
      setProblem(error instanceof Error ? error.message : "That did not save. Have another go?");
    }
  }

  return (
    <>
      <AppBar current="picks" destinations={existing !== null} />
      {/*
        The backdrop sits *outside* the page shell so it runs edge to edge.
        Inside the shell it stopped at the 1152px column and left the page's
        plain ground showing as two bands on a wide screen. The sky tint
        follows the chosen world, so picking one recolours the whole page.
      */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          initial={false}
          animate={{ backgroundColor: preview.sky }}
          transition={{ duration: 0.5 }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: WASH }} />

        <PageShell className="relative justify-center">
          <motion.div
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.09, delayChildren: 0.05 }}
            className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:gap-x-10 lg:gap-y-6"
          >
            <motion.header variants={fadeUp} className="text-center lg:col-start-1 lg:row-start-1 lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-deep">
                Before you climb
              </p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">
                Let&apos;s get you ready to climb
              </h1>
              <p className="mx-auto mt-2 max-w-md text-base text-ink-soft lg:mx-0">
                Two quick picks and the mountain is yours.
              </p>
            </motion.header>

            {/*
              The picks. From `lg` they take the wider column beside the hero,
              which is the width a laptop was leaving empty while the page
              scrolled through two stacked panels.
            */}
            <div className="grid gap-6 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-center">
              <motion.section variants={fadeUp} aria-labelledby="grade-heading">
                <StepHeading step={1} id="grade-heading">
                  Which one sounds like you?
                </StepHeading>

                <div
                  role="radiogroup"
                  aria-labelledby="grade-heading"
                  className="grid gap-3 sm:grid-cols-3"
                  onKeyDown={(event) => {
                    const at = GRADE_BAND_OPTIONS.findIndex((o) => o.value === gradeBand);
                    radioGroupKeys(event, GRADE_BAND_OPTIONS.length, at < 0 ? 0 : at, (next) => {
                      const option = GRADE_BAND_OPTIONS[next];
                      if (option !== undefined) setGradeBand(option.value);
                    });
                  }}
                >
                  {GRADE_BAND_OPTIONS.map((option) => {
                    const selected = gradeBand === option.value;
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => { setGradeBand(option.value); }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`${CARD} min-h-28 items-start gap-3 bg-surface p-4 sm:flex-col ${
                          selected ? CARD_PICKED : CARD_IDLE
                        }`}
                      >
                        {/* A foothold for a child who cannot read the words yet. Beside
                            the words on a phone, where the card is wide and the page is
                            long; above them from `sm`, where three share a row and the
                            words need the whole card. */}
                        <span
                          aria-hidden
                          className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl ${
                            selected ? "bg-brand-soft/40" : "bg-surface-tint"
                          }`}
                        >
                          {option.glyph}
                        </span>
                        <span className="block min-w-0 pr-5">
                          <span className="block text-base font-bold leading-snug text-ink">
                            {option.stage}
                          </span>
                          <span className="mt-1 block whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-deep">
                            {option.ages} · {option.grade}
                          </span>
                          <span className="mt-1.5 block text-sm leading-snug text-ink-soft">
                            {option.blurb}
                          </span>
                        </span>
                        {selected && <PickedMark />}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>

              <motion.section variants={fadeUp} aria-labelledby="theme-heading">
                <StepHeading step={2} id="theme-heading">
                  Pick your world
                </StepHeading>

                <div
                  role="radiogroup"
                  aria-labelledby="theme-heading"
                  className="grid gap-3 sm:grid-cols-3"
                  onKeyDown={(event) => {
                    const at = INTEREST_THEME_OPTIONS.findIndex((o) => o.value === interestTheme);
                    radioGroupKeys(event, INTEREST_THEME_OPTIONS.length, at < 0 ? 0 : at, (next) => {
                      const option = INTEREST_THEME_OPTIONS[next];
                      if (option !== undefined) setInterestTheme(option.value);
                    });
                  }}
                >
                  {INTEREST_THEME_OPTIONS.map((option, index) => {
                    const selected = interestTheme === option.value;
                    const palette = INTEREST_PALETTES[option.value];
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => { setInterestTheme(option.value); }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        className={`${CARD} h-40 flex-col ${selected ? CARD_PICKED : CARD_IDLE}`}
                        style={{ backgroundColor: palette.sky }}
                      >
                        {/* The words sit in the sky, above the ridges: ink on a
                            pale sky clears AA in every world. */}
                        <span className="relative z-10 block p-4 pr-10">
                          <span className="block text-lg font-bold text-ink">{option.label}</span>
                          <span className="mt-0.5 block text-sm text-ink-soft">{option.blurb}</span>
                        </span>
                        <WorldScene palette={palette} />
                        {/* The glyph rides on a solid white disc. Loose over the
                            ridge it took the ridge's own hue — a blue whale on a
                            blue ridge, a rocket on deep violet — and vanished
                            into it. The disc is opaque, like every ground under
                            something that carries meaning. */}
                        <motion.span
                          aria-hidden
                          className="absolute bottom-3 right-3 z-10 flex size-14 items-center justify-center rounded-full bg-surface text-3xl shadow-md"
                          animate={
                            reduced === true
                              ? { y: 0 }
                              : { y: [0, -8, 0], rotate: [0, -6, 6, 0] }
                          }
                          transition={{
                            duration: 3.4,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: index * 0.5,
                          }}
                        >
                          {option.glyph}
                        </motion.span>
                        {selected && <PickedMark />}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>
            </div>

            <motion.div
              variants={fadeUp}
              className="flex flex-col items-center gap-3 lg:col-start-1 lg:row-start-3 lg:items-start"
            >
              <motion.button
                type="button"
                onClick={() => { void start(); }}
                disabled={draft.kind !== "ready" || saving}
                animate={
                  draft.kind === "ready" && reduced !== true
                    ? { scale: [1, 1.045, 1] }
                    : { scale: 1 }
                }
                transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: draft.kind === "ready" ? 1.06 : 1 }}
                whileTap={{ scale: draft.kind === "ready" ? 0.96 : 1 }}
                className="w-full max-w-xs rounded-full bg-gradient-to-r from-brand to-brand-deep px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-35 disabled:shadow-none"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {saving && <ButtonSpinner />}
                  {saving ? "Packing your bag…" : "Start climbing"}
                </span>
              </motion.button>
              <p
                className={`min-h-5 max-w-md text-center text-sm lg:text-left ${problem === null ? "text-ink-soft" : "text-brand-deep"}`}
                aria-live="polite"
              >
                {problem ??
                  (draft.kind === "ready"
                    ? "Camp 1 is waiting."
                    : "Choose one of each to begin.")}
              </p>
            </motion.div>

            {/*
              The mountain the child is about to climb, in the colours of the
              world they picked — the map's own backdrop, so the preview is the
              real thing — with that world's own life moving over it: a rocket
              and a shooting star, rolling waves, swaying leaves and vines, and
              the story cast on the peaks. Recolouring alone read as one
              silhouette in three tints. Decoration: the radios already say
              what is chosen. Only from `lg`, where there is a column to put
              it in.
            */}
            <motion.div
              variants={fadeUp}
              aria-hidden
              data-world={interestTheme ?? "unpicked"}
              className="hidden lg:col-start-1 lg:row-start-2 lg:block lg:self-center"
            >
              <div
                className="relative aspect-[1000/625] w-full overflow-hidden rounded-3xl border-2 border-edge shadow-sm [&_circle]:transition-colors [&_circle]:duration-500 [&_stop]:[transition:stop-color_500ms]"
                style={{ backgroundColor: preview.sky }}
              >
                <MountainBackdrop palette={preview} />
                <WorldScenery theme={interestTheme} />
                <span className="absolute bottom-3 left-3 rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink shadow-sm">
                  <span className="mr-1">{preview.glyph}</span>
                  {interestTheme === null ? "Pick a world to colour your mountain" : `Your ${preview.label.toLowerCase()} mountain`}
                </span>
              </div>
            </motion.div>
          </motion.div>
        </PageShell>
      </div>
    </>
  );
}
