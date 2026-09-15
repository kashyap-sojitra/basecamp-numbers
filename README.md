# Basecamp Numbers

[![CI](https://github.com/kashyap-sojitra/basecamp-numbers/actions/workflows/ci.yml/badge.svg)](https://github.com/kashyap-sojitra/basecamp-numbers/actions/workflows/ci.yml)

A K-5 math practice app built around a mountain-climbing metaphor. A child picks a
grade band and an interest theme, then climbs four camps — each one a skill stage
with a Mastery Meter that fills as they solve problems and dims when they drift away
from it.

No accounts, no login, no leaderboard. One anonymous learner per browser.

---

## What it does

- **Four camps to the summit, each a different act.** Camp 1 walks a number-line
  jump, camp 2 chooses where a crossing jump lands, camp 3 drags rows into an
  array, and camp 4 works out a number written the long way and types it.
  Every camp asks the same kind of question in every grade band; the band
  changes the numbers, never the act. Everything lives in
  [`src/lib/data/camps.ts`](src/lib/data/camps.ts).

  | # | Camp | Skill | Mechanic |
  | --- | --- | --- | --- |
  | 1 | Trailhead | Add and subtract in small steps | Number-line jump |
  | 2 | Pine Ridge | Spot where a crossing jump lands | Pick the landing |
  | 3 | Glacier Field | Build arrays to multiply | Drag-and-drop grouping |
  | 4 | The Summit | Read tens, hundreds and thousands as one number | Name the number |

  Two more camps, 5 and 6, appear on the map as **coming soon** teasers beyond
  the summit — the board scrolls sideways to them — so a child knows the climb
  goes on. They are not camps: no route, no meter, no lock, never a link.

- **Mastery Meters (0–100)** carry lasting progress. A right answer first time is
  worth 14 points, one found after a wobble 7. Wrong answers never subtract.
- **Meters decay** as the child solves problems *elsewhere* — measured in problems,
  not minutes, so time away from the app costs nothing. Decay is non-destructive:
  the earned value is kept and the dimmed reading is derived, so a checkpoint
  restores it in full. Dim far enough and advancing is gated behind a short
  three-question review of the earliest stale camp. The review is offered only
  where it is named — the banner and the dimmed camp's own card — and the
  tuning lets a first ascent through: a child who climbs straight to the
  summit arrives with camp 1 still bright.
- **Difficulty adapts after every answer**, on correctness *and* response time, at a
  level 1–5 per camp. It is never shown to the child, so moving down is a quiet
  adjustment rather than a demotion. The two number-line camps are told apart by
  **regrouping** — camp 1 never carries or borrows, camp 2 always does — which is
  what lets the skill scale past K-1 without the jumps outgrowing the line.
  **Exactly what each band meets at each level is tabulated in
  [CLAUDE.md](CLAUDE.md#what-a-child-meets-at-each-level)**, and
  `lib/math/difficultyLadder.test.ts` holds the same numbers so the table cannot
  drift from the code.
- **A session summary** ends every sitting: stars for the day, each meter before and
  after, a "New today" panel, and one AI-written line about what improved.
- **The Climb Log at `/log`** is where returning lives: streak, the last fortnight as
  a calendar, badges, per-camp bests, lifetime totals. The streak and the
  calendar are the child's whatever grade they climb; badges, bests and solve
  counts belong to the grade being climbed, and every grade the child has
  climbed is shown side by side with its four camp meters.

### One mechanic per camp

1. **Number-line jump** — walk a within-place jump along the line.
2. **Pick the landing** — read a crossing jump and choose one of four landings.
   The three wrong ones are each a real slip — missed the carry, wrong direction,
   off by one, never moved — so a wrong pick is diagnosed and coached exactly as a
   wrong tap on the line is.
3. **Drag-and-drop array** — build rows into a frame to multiply.
4. **Name the number** — the mat shows a number the long way, as ten-frames with
   their counts (`7 tens and 14 ones`), and the child works out what it is worth
   and types it on a keypad. A wrong number is diagnosed from the counts — digits
   written side by side, a forgotten carry, one away — and coached by name.

It used to be two mechanics used twice, and testers read the second camp of each
pair as a repeat of the first. Camp 4 then spent a while as "tap *Trade 10* under
the column that has ten", which read as camp 2's pick over again; typing the value
is an act no other camp asks for. The problems and the difficulty ladder behind
camps 2 and 4 are unchanged — only what the child *does* with them.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in DATABASE_URL
npm run db:migrate
npm run dev
```

Open <http://localhost:3000>.

### Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | **Yes**, to save anything | Neon Postgres. Without it the app builds and onboarding renders, but the API answers `503` with the exact fix. |
| `GEMINI_API_KEY` | No | Word-problem wording and encouragement only. Without it those come from the local template bank and the app is fully playable. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.6-flash`. |
| `GEMINI_MAX_CALLS_PER_MINUTE` | No | Defaults to 4, just under the free tier's 5. |

`drizzle.config.ts` loads `.env.local` explicitly, because drizzle-kit itself only
reads `.env`.

---

## Stack

Next.js 16.3 (App Router) · React 19.2 · TypeScript strict · Tailwind CSS v4 ·
Framer Motion · Neon Postgres + Drizzle ORM · Zod · Gemini (`@google/genai`)

**Eight runtime dependencies, and that is the budget** — plus `@vercel/analytics`,
the host's own cookieless Web Analytics, placed once in the root layout and
rendering nothing off Vercel. No component library, no
second animation engine, no icon package, no `clsx`/`tailwind-merge`. Animated
component kits were evaluated and rejected: their catalogues are hero sections and
navbars rather than number lines and base-10 blocks, they are styled dark-and-glassy
against this app's bright palette, and each would add a second animation runtime plus
borrowed markup whose contrast and keyboard behaviour we would have to re-audit.

---

The one thing in `package.json` that is not a dependency is an `overrides`
entry pinning `esbuild` to at least 0.25.12 underneath `@esbuild-kit/core-utils`,
a transitive dependency of `drizzle-kit`. It closes an `npm audit` finding in a
package the app never runs in production; it can go once drizzle-kit drops that
dependency.

## How the code is laid out

Each layer may import from the ones below it and never the reverse. This is what
keeps the rules testable without a browser.

```
src/
  app/            routes, loading states, API handlers
  components/     presentation only — no game state
  lib/
    domain/       pure rules: no React, no I/O, no clock, no randomness
    math/         deterministic problem generation (seeded PRNG)
    db/           Drizzle schema + a "server-only" repository
    ai/           the only importer of @google/genai, plus the framing guard
    progress/     \
    learner/      |  thin adapters: the save fetch, the cookie,
    theme/        |  the palettes, shared spring presets
    motion/       /
```

**The rules worth reading first** — each is one named function with its constants
beside it:

| Rule | File | Decides |
| --- | --- | --- |
| `difficultyMove` | [`domain/difficulty.ts`](src/lib/domain/difficulty.ts) | Whether the next problem gets harder |
| `dimmedMastery` | [`domain/decay.ts`](src/lib/domain/decay.ts) | What a stale meter reads |
| `starsForSession` | [`domain/stars.ts`](src/lib/domain/stars.ts) | Stars for one sitting |
| `streakFrom` | [`domain/streak.ts`](src/lib/domain/streak.ts) | Whether a streak is climbing or resting |
| `badgesFor` | [`domain/badges.ts`](src/lib/domain/badges.ts) | All seven badges, derived |
| `milestonesFor` | [`domain/milestones.ts`](src/lib/domain/milestones.ts) | What the sitting just crossed |
| `checkFraming` | [`ai/framingGuard.ts`](src/lib/ai/framingGuard.ts) | Whether the model's words may be shown |

### Standards that hold everywhere

- **Derive, don't store.** Lock state, dimmed meters, badges and milestones are all
  computed from the meters plus the climb log, so two screens cannot disagree and a
  failed write cannot strand a child in a wrong state. The database holds only what
  cannot be derived: the profile, earned mastery, the solve counter, the day log and
  the checkpoint count.
- **No randomness during render.** Anything that must match between server and client
  uses a seeded mulberry32 PRNG. `Math.random` appears only in event handlers.
- **Browser-only state goes through `useSyncExternalStore`**, never a `setState` in an
  effect — speech support, today's local date, seen badges. Each supplies a server
  snapshot so hydration matches.
- **Zod at every boundary** — request bodies, *outbound* responses, database rows, the
  cookie, `localStorage`. Rows are re-parsed on read despite Drizzle's compile-time
  types; one bad row is skipped and logged, not fatal.
- **The AI never does arithmetic.** The answer is computed locally, and
  `checkFraming` rejects any model output that omits an operand, invents a number,
  leaks the answer, or contains markup. Rejected framing falls back to the template
  bank.
- **Failures are quiet for the child and loud in the console.** A solve that cannot be
  recorded logs and is swallowed; the next solve retries. No network error is ever
  rendered mid-climb.

---

## Testing

```bash
npm test              # the whole suite, once
npm run test:watch    # watch mode
npm run test:coverage # with coverage, enforcing thresholds
```

Vitest + Testing Library in jsdom, with v8 coverage. Tests live beside the code they
cover.

**1072 tests across 85 files**, run on every push by
[CI](.github/workflows/ci.yml). Coverage as of the last run:

| Statements | Branches | Functions | Lines |
| --- | --- | --- | --- |
| 97.41% | 92.47% | 97.11% | **98.39%** |

Thresholds are enforced in `vitest.config.mts` — raise them, never lower them.

The approach differs by layer: pure rules assert **invariants rather than examples**
(the generators are swept across every grade band × skill × difficulty level —
deterministic generation is what makes this a proof rather than a spot check);
reducers are driven through whole sittings; API routes are called with real `Request`
objects and their refusals tested as carefully as their successes; the repository
runs against a fake Drizzle; the AI layer against a fake `@google/genai` with a test
for every fallback. **No test ever reaches the network.**

`difficultyLadder.test.ts` is worth knowing about on its own: it asserts the exact
range every band meets at every level, that nothing goes backwards, that no band is
handed a younger band's easiest work, and that a child gains a digit at most once.
It is the executable copy of the difficulty table in CLAUDE.md.

Because streaks are timezone-sensitive, the suite is also run at `TZ=Pacific/Kiritimati`
(UTC+14) and `TZ=Pacific/Niue` (UTC−11) — 1072 pass at both, and CI runs both.

Known gaps — no end-to-end suite, and nothing runs against a real database — are
tracked in [ROADMAP.md](ROADMAP.md).

---

## Accessibility

- **Tap targets** are at least **44px** on the smaller axis — the WCAG 2.5.8 **AAA**
  figure. The number-line ticks are the one deliberate exception (34px wide on a
  375px phone), made safe by being contiguous: there is no dead space, so a
  slightly-off tap picks a neighbour rather than nothing.
- **Keyboard**: every control is a real button or link with a visible `focus-visible`
  ring. The number line and the onboarding radiogroups use a roving tabindex, so a
  31-tick line is one tab stop rather than thirty-one.
- **Contrast**: every pair in use clears WCAG AA. Four of the brand's brightest values
  could not and were darkened — the brand's cyan `#17E2EA` is 1.6:1 on white, so
  `--info` ships as `#0B7F86`. The bright originals survive only as confetti and
  skies, which carry no meaning.
- **Read-aloud** (Web Speech API) sits beside the problem for K-1, where decoding the
  words is the barrier rather than the math.
- **Reduced motion** degrades to *information without movement*: under `reduce` the
  confetti does not render at all while every label and the NEW pill stay.

---

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` (run `build` first — Next writes generated route types into `.next/types`) |
| `npm test` | The whole test suite, once |
| `npm run test:watch` | Watch mode |
| `npm run test:coverage` | With coverage, enforcing thresholds |
| `npm run db:generate` | Generate a migration from the schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push the schema straight to the database (dev only) |
| `npm run db:studio` | Browse the data |

---

## Privacy

One anonymous learner per browser, identified by a UUID in an `httpOnly` cookie
(`bn_learner`, `sameSite=lax`, one year, `secure` in production), minted on the first
successful save. No accounts, no login, and nothing stored that could identify a
child. The cookie is parsed with Zod like any other untrusted input.

The only tracking is Vercel Web Analytics: anonymous page views and Web Vitals,
cookieless, with no identifier that could be tied to a child. Nothing profiles a
learner, and nothing beyond counters leaves the browser.

Every database query is scoped to a single learner id, so cross-child comparison is
structurally absent rather than merely unbuilt.

---

## Further reading

- **[CLAUDE.md](CLAUDE.md)** — the normative spec: every rule, constant and constraint,
  and the reasoning behind each. Read it before proposing changes.
- **[DECISIONS.md](DECISIONS.md)** — the product decisions and the reasoning
  behind them: what each one optimises for, what it gives up, and where the
  evidence is.
- **[ROADMAP.md](ROADMAP.md)** — known gaps and what comes next, ranked.
