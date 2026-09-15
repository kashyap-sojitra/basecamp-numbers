# Basecamp Numbers

A K-5 math practice app built around a mountain-climbing metaphor. This file is the
persistent context for the project — read it before proposing changes.

Everything below describes what the code **does**, not what it aspires to. Where a
number or a hex value appears here it is the one in the source. If you change the
code, change this file in the same commit.

## Product

- The child climbs a mountain through **exactly 4 camps**. Each camp is a skill stage.
  Each camp asks for a different *act*: camp 1 walks a number-line jump, camp 2
  chooses where a crossing jump lands, camp 3 drags rows into an array, and camp 4
  works out a number written the long way and **types** it. `lib/data/camps.ts`
  is the whole definition. **Camps 5 and 6 appear on the map as "coming
  soon" teasers and nowhere else** (`UPCOMING_CAMPS`, `UpcomingCamps.tsx`): a
  dashed ghost badge and a small card naming what the camp will practise, so a
  child knows the climb goes on. They are not camps — not a `CampNumber`, no
  route, no reducer, no meter, no lock, never a link — and they never borrow
  the locked camp's padlock, because the promise is "there is more", not "you
  are shut out". On the board they stand on **the next range, to the right of
  the summit**, which the board scrolls to (see Responsive); their markers are
  percentages of that extension area (`extensionArea`), not of the mountain,
  so the four camps never move, and `mapLayout.test.ts` proves the teaser
  cards stay on the board and clear of every camp card at every height and
  width. On the phone's route they sit above the summit. Their names and skills are
  placeholders until the product confirms them (ROADMAP.md).
- **The grade choice is written for the child, not the school.**
  `GRADE_BAND_OPTIONS` leads with a first-person stage — *I'm just starting*,
  *I'm getting good*, *I'm ready for big numbers* — with ages and a glyph, and the
  school grade (`K–1`, `2–3`, `4–5`) demoted to the small line an adult reads. It
  was "K–1" in 24px, which a five-year-old cannot decode, and it is the first
  thing the app asks.
- Each camp has a **Mastery Meter** (0-100). A right answer first time is worth 14
  points, one found after a wobble 7 (`masteryGain`). Wrong answers never subtract —
  the only thing that lowers a meter is decay.
  - The meter **decays** when a camp goes untouched, so earlier camps pull the child back.
    Staleness is counted in **problems solved elsewhere**, not elapsed time, so time away
    from the app costs nothing. Tuning lives in `lib/domain/decay.ts`.
  - Decay is **non-destructive**: the earned meter is kept and the dimmed reading is
    derived, so a checkpoint restores it in full rather than making the child re-earn it.
    Unlocking reads the earned value, so decay never re-locks a camp.
  - When a camp's meter has decayed past threshold, advancing is gated by a **short
    checkpoint review** of that camp before the child can move up. The earliest stale
    camp is the one reviewed. Camp 1 is never gated, since it is where a dimmed climber
    goes to practise. **The review is offered only where it is named**: on the
    banner and on the dimmed camp's own card (`isGated`). A higher camp that is
    gated says *Review Camp 1 first* (K-1: *Warm up Camp 1 first*) and offers
    nothing to press. It used to carry the review's button, labelled just
    "Checkpoint", so a child who tapped it on the summit's card was handed
    camp 1's number line and read it as the summit's question. **A camp's card
    never opens another camp's questions.**
  - **The tuning must let a first ascent through.** The grace is three camps'
    worth of clean solves (`DECAY_GRACE_SOLVES` 24, eight per camp) and the
    slope 3 points a solve, so a camp is reviewed after 35 solves away; even an
    ascent made entirely of after-a-wobble solves reaches the summit with camp
    1 bright, and a child who then settles in at camp 4 for a dozen problems is
    sent back for three questions. It was 6 and 4, which gated after 14 solves
    elsewhere — less than two camps — so *every* child who climbed straight up
    met a camp-1 review the moment the summit opened. `decay.test.ts` proves
    the straight and the wobbly ascent both arrive ungated, and that lingering
    still gates.
  - **Every camp asks the same kind of question in every band.** The band
    changes the numbers through the difficulty ladder, never the act: camp 1
    walks a jump, camp 2 picks a landing, camp 3 builds an array, camp 4 names
    a number, at K-1 and at 4-5 alike. A grade never sees one act at two camps.
- **Every band's floor rises with the band**, not just its ceiling. Level 1 for
  2-3 must not hand out K-1's easiest problem, which it did: both bands' easiest
  array was `2x2` and both camp 1s drew the same 1-9 jump. The bands still
  overlap a little at the edges so a child who is genuinely behind can reach
  gentle work. For place value the *leading digit* scales with level as well as
  the block budget — the budget caps the work, not the value, so level 5 could
  otherwise still draw `20`.
- **Difficulty adapts after every answer.** Each camp runs at a level 1-5 and moves on
  correctness *and* response time: wrong goes down, quick-and-right goes up, slow-but-
  right holds or drops. The quick threshold scales with the level
  (`5s + level × 2s`), so a child is never pushed down for thinking about a big jump.
  The entire rule is `difficultyMove` in `lib/domain/difficulty.ts` and nothing else
  decides difficulty.
- Tone is encouraging, never punitive. Progress is the reward loop.
- Every answer gets a reaction: a right one fires `AnswerBurst` with `YAY` (a
  YAY stamp plus flying emoji) over the board; a wrong one fires a warm, curious
  miss (🤔 and a stamp), never a cross, a red, or a sad face. **The stamp's word
  says how far off the answer was**, and is decided by one rule,
  `lib/domain/reaction.ts`. It was "Nearly!" for every miss, and a child can
  catch that out: land ten ticks away, or jump the wrong way entirely, and
  "nearly" is a fib. On the two jump camps the distance is measured against
  the jump asked for — one tick out is *So close!*, less than the jump away is
  *Not quite!*, the jump or further (no move, wrong direction) is *Try again!*
  (`jumpMiss`). An array or mat that has overshot says *Too many!*; a row that
  cannot fit says *Not yet!*, because that is a shape that is wrong, not a
  count that is off (`groupingMiss`). A wrong number typed at the summit is
  measured against the value — one away is *So close!*, within a ten *Not
  quite!*, and `714` for `84` is *Try again!* (`tradeMiss`). Every word is two words or fewer and a test forbids nearly,
  wrong, no, bad, oops, fail and missed. The reaction plays over the board,
  never on top of the words and the button the child needs next.
- Every wait has a loader. Route changes use `loading.tsx` with `AppLoading` (a
  climber on a rope); AI waits use `CoachLoading` (the theme's character on a trail);
  buttons awaiting the network use `ButtonSpinner`. Nothing ever just sits blank.
- Finishing a sitting shows a **session summary screen**: stars earned, every camp's
  Mastery Meter before and after, a **New today** panel, and one AI-written line about
  what improved.
  - **Stars** rate the sitting (effort and accuracy on the day); the Mastery Meter
    carries lasting progress. Stars are deliberately not a currency: nothing unlocks
    with them, they are never spent, and they are never taken away. The rule is
    `starsForSession` in `lib/domain/stars.ts`, and it is the whole of it:

    | Stars | Earned by |
    | --- | --- |
    | 0 | nothing solved — the screen says "come back soon" |
    | 1 | anything solved at all; turning up counts |
    | 2 | `STAR_EFFORT` (5) solved |
    | 3 | 5 solved **and** 70% of them right first time (`STAR_ACCURACY`) |
  - The summary line is the third AI use, alongside word-problem framing and
    encouragement. It never mentions a number, because the screen shows them.
    It is told **which slips the sitting actually contained**, in order
    (`session.slips`, capped at `SLIP_MEMORY`), so it can name a slip that
    *stopped happening* — which is what "what you got better at" means. A
    four-way strong/steady/wobbly/nothing bucket cannot say "you stopped
    counting the starting tick"; a list of diagnoses can. Both reducers record
    them: the number line from `diagnoseJump`, grouping from the evaluator's own
    hint, which already names the misconception.

## Coming back

The reward loop points at **tomorrow**, not at never stopping today. There is no
leaderboard (nothing to compare a child against), no infinite feed, and no penalty
for a day off.

- The **Climb Log** at `/log` is the one place all of this lives: the streak, the
  last fortnight as a calendar, badges, per-camp bests, and lifetime totals. A
  streak chip in the map header is the way in. The child sees it as **My
  progress** — in the app bar, on the streak chip and on the summary — because
  testers could not tell what a "climb log" was; the name stays in the code,
  the route and this file.
- **Two scopes, kept apart.** *Turning up* is the child's, whatever they were
  climbing: the streak, today's goal, the calendar, days climbed. *The climb*
  is the grade band's: the meters, each camp's best day, problems solved,
  right first time, and every badge about climbing. Every `climb_days` row
  carries its band, the log is read whole and filtered in the domain
  (`daysInBand`), and the checkpoint count lives on `band_progress`. It was
  read whole for everything, so a child who switched grade arrived with
  *First Steps* and *Century* already earned. Seven Days is the one badge that
  reads every row, because a streak is about turning up. The progress screen
  says which scope each section is in, and ends with **every grade the child
  has climbed side by side**, each with its four camp meters and its solves,
  so switching grade never makes a climb disappear.
- **Streaks** count distinct local days with at least one solve. `lib/domain/streak.ts`
  holds the rule. Two things keep it kind: a streak survives **one** missed day
  (`STREAK_GRACE_DAYS`), and a lapsed streak is **resting**, never lost — the copy
  names how long it was and invites a new one. No message may say lost, failed,
  missed or broken.
- The day is the **child's own calendar day**, computed in the browser and carried
  across the API as a validated `LocalDate` (`lib/domain/localDate.ts`). A day
  boundary computed in UTC would break streaks for most of the world. Day arithmetic
  anchors dates at UTC midnight purely as a counting device, so it is immune to DST.
- A small **daily goal** (5 problems, the same figure as the second star) gives the
  day a finish line that is reachable in one sitting.
- **Badges** are *derived* from the meters and the log by `lib/domain/badges.ts`,
  never stored, so there is no second source of truth to drift and a badge cannot be
  lost to a failed write. Unearned ones show as silhouettes with their condition and
  a progress bar — the point is to show what is in reach, not to withhold. The one
  condition that is a past event rather than a state of the meters, passing a
  checkpoint, is counted on `band_progress.checkpoints_passed` because it cannot be
  derived — per band, since a review is part of a climb.
- A badge earned since this browser last opened the Climb Log gets a **spotlight**:
  the grid deals itself out, the new ones pulse with a NEW pill, and confetti fires
  once. Which badges have been seen is the *only* thing in `localStorage`
  (`bn_seen_badges`) — a per-viewer convenience whose loss costs one spotlight and no
  progress.
- `climb_days` accumulates on **every solve**, not at the end of a sitting, so a
  child who closes the tab keeps the day and the streak with it.
- The session summary's **New today** panel names what this sitting crossed — a
  personal best, a streak, the daily goal, a new badge — by running the same derived
  rules over the record before and after. `lib/domain/milestones.ts`. It is silent
  when nothing was crossed rather than inventing an achievement.
- All of this is **child-facing**. Parents see it over the child's shoulder; there is
  still no parent dashboard, report or export, and that stays out of scope.

## Mechanics — one per camp

1. **Number-line jump** (camp 1) — walk a within-place jump along a unit-tick line.
2. **Pick the landing** (camp 2) — read a crossing jump and choose which of four
   landings it reaches. Same problems, same ladder and the same `campSession`
   reducer as the crossing skill always had; only the act differs.
3. **Drag-and-drop array** (camp 3) — build rows into a frame to multiply.
4. **Name the number** (camp 4, the summit) — the mat shows a number **the
   long way** (`7 tens and 14 ones`, drawn as ten-frames with their counts)
   and the child works out what it is worth and **types it on a keypad**.
   `lib/math/tradeTasks.ts` still poses the tasks — the same place-value
   ladder, scruffed so at least one place holds ten or more — and
   `lib/domain/tradeSession.ts` runs the sitting: digits, erase, check.
   It was "tap *Trade 10* under the column that has ten", with that column lit
   up, which is the same act as camp 2 — pick one of a few buttons — and no
   challenge at all; testers said camps 2 and 4 asked the same kind of
   question. Typing the value is an act no other camp asks for, and at the
   summit it is real work: 2 thousands, 13 hundreds, 1 ten and 15 ones is
   3325, and the carries happen in the child's head. The ten-frames on the mat
   (`PieceGrid`, a ringed ten under every place that can carry) are the
   support, not the answer; the mat carries no buttons and the value is
   written nowhere until it is found. **A wrong number is diagnosed**, not
   counted: `diagnoseTrade` in `lib/domain/tradeDiagnosis.ts` tells the counts
   written side by side (`714`), a forgotten carry (`74`), one away, a single
   place on its own (`70`, `14`) and a plain miscount apart from the counts
   alone, and that name — never a digit — is what the coach and the summary
   are handed. **Every word the camp says is in `lib/domain/tradeCopy.ts`**,
   band-split like the checkpoint copy: K-1 hears *count the tens and the
   ones* and never "the long way". Once found, the mat is read back as a sum,
   `7 tens and 14 ones = 84`. The keypad (`components/trade/Keypad.tsx`) is
   56px keys in phone order, erase and check, and takes a physical keyboard
   too. **The framing is a real word problem whose operands are the counts**:
   `kind: "trade-up"` carries `piles` (unit and count per place) and the
   story tells them — *7 bags of ten and 14 loose* — and asks how many
   altogether; the value is the answer and the guard now throws away any
   story that says it (`answerIsOperand` is true for place-value only). "Ten",
   "hundred" and "thousand" are kept as words so the guard does not read them
   as invented numbers, and an empty place is simply not told. The
   checkpoint's summit review is the same act.

This was **two mechanics used twice** for a long time, capped on the reasoning
that two bounded the motor skills a child had to learn. What it bounded in
practice was variety: testers read camps 1 and 2 as one number line apart only in
whether the jump carried, and camps 3 and 4 as the same drag into a frame. Each
camp now sets its own act. Two things survive from the old rule. The crossing jump
and the place-value number still come from the **same generators and the same
difficulty ladder**, so the tables below did not move. And camp 2's three wrong
landings are each a slip `diagnoseJump` can name (`lib/math/jumpChoices.ts` —
missed the regroup, wrong direction, off by one, did not move), so a wrong pick is
diagnosed and coached exactly as a wrong tap on the line is; random distractors
would have thrown that away.

The place-value *grouping* board (`PlaceValueMat` and `groupingSession`'s
place-value branch) is no longer set by any camp. It is still implemented and
still covered, through a camp definition made in the tests; removing it is a
cleanup, not a product decision, and is tracked in ROADMAP.md.

### The two jump skills are **regrouping**, not "inside a ten"

`within-place` means *no place carries or borrows*; `cross-place` means *at least
one does*. `5 + 2` / `8 + 5` at K-1, `34 + 25` / `38 + 25` at 2-3,
`623 + 14` / `899 + 6` at 4-5. `carriesAdding` and `borrowsSubtracting` in
`lib/math/numberLineProblems.ts` are the definition and the tests sweep against
them.

It was "stays inside one ten" and that does not scale: staying inside a ten
*forces* the jump under ten, so 2-3's declared range of 19 was clamped to 9 and
its camp 1 became K-1's camp 1 with a bigger number in front — `79 - 8` against
`9 - 8`. **Nor can the jump simply be made bigger.** The line draws one tick per
integer at `MIN_TICK_PX`, so a jump of 20 is already 1054px and a jump of 145
would be 5202px. Jump size is capped by the mechanic, which is why `maxChange`
tops out at 20 and why difficulty above K-1 comes from regrouping and from how
many places a carry **cascades** through (`cascadeFor`) rather than from
magnitude. If bigger numbers are ever wanted, the way in is a tick `step` of 10
or 100 — not a longer line.

K-1 keeps "inside a ten" in its wording because for that band it is still true;
the older bands are told "no carrying" / "carries over" (`jumpWords`).

### What a child meets at each level

Every camp runs at a level 1-5 chosen by `difficultyMove`; a new camp opens at
`STARTING_DIFFICULTY` (2). These are the **actual** ranges the generators
produce, swept over 400 problems per cell. `lib/math/difficultyLadder.test.ts`
holds the same numbers and fails if the code drifts from this table, so it is
safe to read as fact rather than intent.

**Camps 1-2 — jump size** (identical for both skills; camp 1 never regroups,
camp 2 always does):

| Band | L1 | L2 | L3 | L4 | L5 | Level 1 / Level 5 example |
| --- | --- | --- | --- | --- | --- | --- |
| K-1 | 1-3 | 2-5 | 4-6 | 5-8 | 7-9 | `6 − 2` / `8 − 7`, crossing `9 + 2` / `10 − 8` |
| 2-3 | 3-7 | 6-11 | 9-13 | 12-16 | 15-19 | `54 + 3` / `29 − 17`, crossing `78 + 7` / `100 − 16` |
| 4-5 | 6-9 | 8-12 | 11-15 | 14-18 | 17-20 | `379 − 9` / `271 + 18`, crossing `903 + 7` / `913 − 19` |

**Camp 3 — the array's product:**

| Band | L1 | L2 | L3 | L4 | L5 | L1 / L5 example |
| --- | --- | --- | --- | --- | --- | --- |
| K-1 | 4-9 | 4-12 | 6-12 | 6-15 | 8-15 | `3 × 2` / `2 × 4` |
| 2-3 | 9-16 | 9-25 | 16-25 | 16-36 | 25-36 | `3 × 4` / `5 × 6` |
| 4-5 | 16-25 | 25-36 | 36-49 | 49-64 | 64-81 | `4 × 5` / `8 × 8` |

**Camp 4 — the number on the mat** (the same place-value ladder; it arrives
written the long way and the child names it):

| Band | L1 | L2 | L3 | L4 | L5 | L1 / L5 example |
| --- | --- | --- | --- | --- | --- | --- |
| K-1 | 11-13 | 12-15 | 14-16 | 15-18 | 17-19 | `12` / `18` |
| 2-3 | 20-52 | 30-63 | 40-74 | 50-85 | 60-95 | `50` / `84` |
| 4-5 | 100-440 | 200-540 | 300-651 | 1004-5440 | 2000-5541 | `130` / `2315` |

Three properties hold across all of it, and each has its own test:

- **Nothing goes backwards.** Every level's floor and ceiling are at least the
  level below's.
- **No band is handed a younger band's easiest work.** Each band's level-1 floor
  clears the band below's. They still overlap at the edges, so a child who is
  genuinely behind can reach gentle work rather than being held at their
  nominal grade.
- **A child gains a digit at most once.** The place count rises only between
  levels 3 and 4 for 4-5 and never elsewhere, and the leading digit's floor
  *resets* when it does — otherwise level 4 opened at 3001 straight after level
  3 closed at 651.

K-1's camp 4 is the one deliberately narrow cell: the teens are nine numbers, so
a level offers three or four of them. Widening it is a content decision, tracked
in ROADMAP.md, not a bug. A teen also has exactly **one** untidy layout — all
ones — which is why `generateTradeTask`'s dedupe salts the *target* draw rather
than the scruff: re-rolling how `12` is scruffed can only ever give twelve ones.

## Stack

- **Next.js 16 (App Router) + TypeScript** in strict mode (see Type rules below).
- **Tailwind CSS v4**, configured in CSS via `@theme inline` — there is no
  `tailwind.config`.
- **Framer Motion** for animation, plus React's `<ViewTransition>` for route changes.
- **Neon Postgres + Drizzle ORM** for persistence.
- **Zod** validation at *every* boundary — request bodies, outbound responses, database
  rows, the learner cookie, and `localStorage`. Anything that was once a string gets
  parsed, not cast.
- **Gemini API** (free tier, via `@google/genai`), isolated behind
  `lib/ai/wordProblemGenerator.ts`.
  - Used **only** for word-problem framing and encouragement lines.
  - **Never** for the arithmetic itself. All math is computed and verified locally.
  - No other module imports `@google/genai` directly.

Testing is **Vitest + Testing Library** in jsdom, with v8 coverage — see
Verification below.

**Eight runtime dependencies, and that is the budget** — plus one exception,
`@vercel/analytics`, which is the host's own Web Analytics: page views and Web
Vitals, cookieless and anonymous, no UI, no second runtime, and it renders
nothing off Vercel. It is placed once in `app/layout.tsx`. It is the only
tracking of any kind, and it must stay so: nothing that profiles a child, and
nothing beyond counters leaves the browser. No component library, no
second animation engine, no icon package, no `clsx`/`tailwind-merge`. Animated
component libraries (shadcn-registry kits, WebGL/GSAP packs) were evaluated and
rejected: they are built for marketing pages, their catalogues are hero sections and
navbars rather than number lines and base-10 blocks, they are styled dark-and-glassy
against this app's bright palette, and each one would add a second animation runtime
plus borrowed markup whose contrast and keyboard behaviour we would have to re-audit.
Anything the app needs visually is cheaper to write in Framer Motion against the
tokens below.

## Theme

Nerdy / Varsity Tutors brand palette, taken from nerdy.com's own stylesheet and then
corrected for contrast. Tokens live in `:root` in `app/globals.css`; use the Tailwind
names (`bg-surface`, `text-ink-soft`), never raw hex in a component.

- Base and chrome: **light and bright**. Page `#FBFAFF`, white cards, violet-tinted
  panels `#F4F2FD`, edges `#D2CAEE`, ink text `#202344`.
- Primary accent: **Nerdy periwinkle `#6C64C9`** (`--brand`), deepening to
  `#5824C5` (`--brand-deep`), lightening to `#A488F7` (`--brand-soft`).
- Informational accent: **`--info` `#0B7F86`**. Nerdy's own secondary is bright cyan
  `#17E2EA`, which is 1.6:1 on white and so cannot carry a word or a border; the cyan
  survives as the ocean theme's sky and as decorative particles.
- Supporting joy: mint `#35DD8B` (`--mint`), violet `#A110FF` (`--grape`), magenta
  `#C9159F` (`--berry`) with `#A80F84` (`--berry-ink`) for berry text and
  `#FAE8F5` (`--berry-soft`) for a pale berry fill. Use them freely; this is a
  game for children, not a dashboard.
- **A tint over anything but the page must be opaque.** `bg-berry/10` reads fine
  over `--page`, and on the mountain it let the backdrop through: on the ocean
  theme's peak a gated camp card's text measured **1.23:1**. `--berry-soft` is
  that same tint flattened onto white, so it is a colour rather than a filter.
  Translucency is for decoration; anything carrying a word gets a solid fill.
- **Warm colours are reserved for reward moments only** — `--reward` `#FFCB19`,
  `--reward-deep` `#FF800D`, `--reward-soft` `#FFEAC0` for fills, and `--reward-ink`
  `#A94E00` for warm text that has to stay legible. They mark mastery gains, camp
  completion, the summit, a live streak and an earned badge, and appear nowhere else.
  A win should be the only warm thing on the screen.
- Inside that bright frame, game pieces use **vibrant saturated colours** keyed to the
  child's chosen interest theme: **space, ocean, or jungle** (`lib/theme/interestTheme.ts`).
- Type: **Karla**, Nerdy's brand face.

### Why four brand values were darkened

Every colour pair in use clears **WCAG AA**: 4.5:1 for text, 3:1 for large text and
for non-text boundaries that carry meaning (focus rings, meter fill against its track,
a game piece against its board). Four of Nerdy's brightest values could not, so each
has a darker counterpart and the bright original is kept only where it carries no
information:

| Token | Nerdy value | Ours | Why |
| --- | --- | --- | --- |
| `--ink-soft` | `#6C6E87` | `#5F6178` | Failed on tinted and reward-soft panels (4.50 and 4.22). |
| `--info` | `#17E2EA` | `#0B7F86` | 1.6:1 on white — unusable for text or a border. |
| `--berry` | `#FB43DA` | `#C9159F` | 3.04:1 on white; also has to hold white button text. |
| `--berry-ink` | — | `#A80F84` | Berry as *text*, which must also clear AA on the pale berry banner. |

Ocean and jungle game pieces were darkened for the same reason. Bright cyan and mint
live on as confetti, sparkles and mountain skies, which carry no meaning — decorative
colour is exempt, and that exemption is the only reason they survive.

## Accessibility

- **Tap targets**: every control outside the number line is at least **44px** on its
  smaller axis (`min-h-11`, `size-11`) — the WCAG 2.5.8 **AAA** figure, which is what
  we design to. Measured, not assumed: a browser sweep asserts it per route.
- The **number-line ticks are the one deliberate exception**, at 34px wide on a 375px
  phone (`MIN_TICK_PX`) widening to 42px when there is room, by 47px tall. That clears
  the 24px AA requirement but not 44px, and the reason is that forcing 44px would push
  a 21-tick line to 924px and make a child scroll to see numbers they are comparing.
  It is made safe by there being **no dead space**: the ticks are contiguous, so a
  midpoint between two of them still lands on a tick, and a slightly-off tap picks a
  neighbour rather than nothing. Do not shrink them further, and do not add gaps.
- **Keyboard**: every control is a real button or link with a visible `focus-visible`
  ring. The number line and the onboarding radiogroups use a roving tabindex with
  arrow keys, so a 31-tick line is one tab stop rather than thirty-one.
- **Icon-only controls carry `aria-label`s**; decorative glyphs are `aria-hidden`.
- **Cursor**: every enabled control shows `cursor: pointer`, from one rule in
  `@layer base` in `globals.css` — not `cursor-pointer` sprinkled per component,
  which is how the buttons and the links came to disagree in the first place
  (browsers give `<a href>` a pointer and `<button>` an arrow). The layer matters:
  utilities beat base, so a control that means something else by its cursor still
  says so — the draggable pieces are `cursor-grab`, `active:cursor-grabbing`.
  Disabled controls keep the plain arrow everywhere, never `not-allowed`; nothing
  should offer a press it will not accept, and the circle-slash is punitive for a
  child who has simply not finished choosing yet.
- **Read-aloud**: a Web Speech API button sits beside the problem for **K-1**, where
  reading the words is the barrier. One predicate decides it —
  `wantsReadAloud(profile)` in `lib/domain/onboarding.ts` — never an inline
  `gradeBand === "k-1"` at the call site.
- **K-1 gets concrete words, not metaphors.** A metaphor asks the reader to
  translate before they can act, and a five-year-old is spending everything they
  have on decoding the letters. A dimmed camp is a *warm-up* for K-1 and has
  *gone dim* for 2-3 and 4-5; `lib/domain/checkpointCopy.ts` holds both sets and
  is the only place either is written. A test asserts K-1 never meets "dim",
  "checkpoint", "meter", "review" or "slipped", and is given one number to hold
  rather than three. Camp 4's words follow the same split in
  `lib/domain/tradeCopy.ts`, and a test holds K-1 to no "long way", no
  "place" and no digit in any line. Copy aimed at the youngest band belongs in a
  module like those, not inline.
- **Live regions**: anything that appears without a navigation — a saved-state error, a
  new-badge announcement — carries `aria-live` or `role="status"`, so the change is
  heard and not only seen.
- All motion honours `prefers-reduced-motion`, and it must degrade to *information
  without movement*: under `reduce` the confetti does not render at all while the NEW
  pill and every label stay. Never encode meaning in motion alone.

## Responsive

- Verified with a headless Chrome sweep across viewports from 375px phone to 1920px
  desktop on every route: no horizontal page scroll, nothing spilling past the
  viewport, and no tap target under 24px anywhere.
- **A dragged piece must not grow the page, and constraining it is the wrong
  fix.** A CSS transform counts towards the document's scrollable overflow, so
  an unconstrained drag can flash scrollbars into existence mid-drag. The
  obvious answer — `dragConstraints` — breaks something worse:
  `dragSnapToOrigin` is *clamped* by it, so a piece released outside the board
  stays stranded where it was dropped, and no amount of resetting by hand
  covers every release path (`onDragEnd` never fires on `pointercancel` or a
  lost pointer capture; `onPointerUp` fires *before* Framer's drag end and is
  overwritten). **The drag stays unconstrained and the page is locked
  instead** — `useScrollLock(dragging)` in both frames. A page that cannot
  scroll cannot show a scrollbar, and nobody wants the page moving under them
  mid-drag. This is the one drag behaviour jsdom *can* see, so
  `ArrayFrame.test.tsx` asserts the root is locked while a piece is in the air
  and released afterwards.
- **Give a snap-back time to finish before asserting it.** Returning from a
  1500px drag is a spring that takes over a second; measuring at 1200ms reads
  as "stuck" when it is simply in flight. Allow ~2s.
- **A highlight must not change the layout it decorates.** The drop zones used to
  answer a hovering piece with `scale: 1.02`. On the place-value mat that is 9px
  of extra width inside an `overflow-x-auto` wrapper, so the mat grew its own
  pair of scrollbars for exactly as long as a piece was in the air. They are
  `ring-4 ring-brand/30` now — box-shadow draws outside the box and takes no
  space. Beware the CSS rule underneath it: **`overflow-y: visible` computes to
  `auto` as soon as `overflow-x` is not visible**, so setting one axis to scroll
  quietly arms the other.
- The **mountain map sits in a fixed frame and scrolls sideways inside it.**
  The mountain itself is drawn at the frame's own inner width — sized from the
  frame in CSS (`BOARD_SCALE`, `MOUNTAIN_FRACTION` in `lib/domain/mapLayout.ts`),
  never in pixels — so all four camps and their cards are in view on arrival and
  nothing is clipped. It was `min-w-[1152px]` inside a padded 1088px column,
  which quietly cut camp 4's card by 21px on every laptop. Beyond the summit the
  picture continues in proportion (`EXTENSION_UNITS`, 52% of the mountain) to
  **the next range**, where the coming-soon camps stand, and that is what scrolls
  into view. The border, radius and shadow are on the *frame*
  (`data-board-frame`), so only the mountain moves under them; the scrollbar is
  `.scroll-sleek` in `globals.css` — a 6px rounded thumb in `--brand-soft` on a
  clear track, margined out of the corners, with Firefox's standard thin bar
  behind an `@supports` guard. A fade at the right edge shows while there is
  more, and one 44px button, *See what's next* / *Back to the summit*, scrolls
  there and back (smooth, or instant under `reduce`), because a child will not
  go looking for a scrollbar. There is **no separate "Summit" flag**: camp 4's card
  already says *The Summit*, and a warm pill hung in the sky read as clutter
  once the next range was beside it, so it was removed. `BOARD_MIN_PX` (1152) stays the reference width
  the geometry is proved at, and the proof also sweeps `FRAME_MIN_PX` (1084),
  the narrowest a frame is at `xl`. Below `xl`
  it becomes `CampRoute` — the same camps as a vertical trail, summit at the top.
  Both layouts share `CampCardBody`, which takes a `compact` flag: the mountain drops
  the skill sentence, the mechanic label and the checkpoint explanation, because a
  card there has a hard width budget and the banner above already says it in full.
- **The camp markers cannot move.** `MountainBackdrop`'s climbing path threads them
  (`180,525` in its viewBox is camp 1's `18%,84%`) and camp 4 stands on the drawn
  summit, so the cards fit around fixed points rather than the other way round.
  With `extended`, the backdrop's viewBox widens from 1000 to 1520 units and the
  same face comes down off the summit and up to two more peaks (`1130,345`,
  `1343,175`) under the coming-soon markers, with the trail going on faintly; it
  is one SVG so the gradients and the parallax carry across without a seam. The
  onboarding preview never extends.
  That arithmetic is `lib/domain/mapLayout.ts` and is *proved*, not eyeballed:
  `mapLayout.test.ts` sweeps every board width and every card height up to
  `CARD_MAX_H_PX` and asserts no two cards share both axes and none leaves the
  board. A card hangs to the right of its badge and is anchored towards the middle
  of the board (`cardAnchor`), so a tall card grows inwards and cannot be clipped;
  the badge — not the row — sits on the marker, so a card's height can never drag
  the badge off the trail. Change `w-36`/`gap-2` in `CampMarker` and the constants
  in `mapLayout.ts` together; Tailwind needs the literals.
- The **number line** scrolls sideways when the ticks would fall below 34px, and
  scrolls itself so the current jump is in view, with faded edges as the hint.
- **The app bar keeps its words at every width, and is one row at every
  width.** Glyph-only pills would fit a phone easily, and that is exactly what
  they cost: nobody guesses that a rucksack means "change picks", and testers
  reported getting lost between screens. So the labels stay and everything else
  gives way below `md`: the three destinations become equal segments of **one
  tab strip** (`bg-surface-tint` track, the current segment filled
  `bg-brand-deep`) that fills the row beside the mark, the glyphs step out
  (`hidden md:inline`), and the app's name is `sr-only` until `md`. It was a
  brand row over a grid of three loose pills, 112px, with the name alone on its
  row and the pills mismatched (two bordered, one filled). Now 72px on a phone,
  the same as a laptop. The strip holds until `md`, not `sm`: at 640px the
  full pills plus the name are 670px and spilled sideways. Labels are `text-xs` below `md` and `text-sm` above;
  "Grade & world" wraps to two lines at 320px, which `leading-tight` inside a
  44px segment allows. A first-time climber has no strip and keeps the name at
  every width. Every segment still clears 44px on its smaller axis. Measured in
  Chrome at 320-1920 on every route: no horizontal scroll at any width.
- **The climber rides the arc**, via `offsetPath: path(arc.d)` with `offsetDistance`
  animated — which is why `arcGeometry` returns `d` and not only its parts. It used
  to animate `left` with its own separate hop, so the curve and the character told
  two different stories about one jump. Under `reduce` it simply arrives at the
  landing: same information, no travel.
- **Ten of a place are ringed together** when a mat holds enough to trade
  (`overfullPlace`), captioned "ten ones make one ten". A mat can hold the right
  total and still miss the point — `14` as fourteen ones is the number without the
  idea — and the equivalence should be visible rather than only asserted in a
  sentence. The caption is `aria-hidden` because the hint panel already announces
  it; two live regions saying the same thing is noise, not access.
- **Column widths follow how many blocks a place holds, not how big one block is.**
  Ones are the smallest and most numerous, and used to have the narrowest column:
  one 44px tap target per row turned fourteen ones into a fourteen-high tower and
  an 800px-tall mat.

## How the code is laid out

The layering is the standard, and it is what keeps the rules testable without a
browser. Each layer may import from the ones below it and never the reverse.

- **`lib/domain/`** — pure rules. No React, no I/O, no `Date.now()`, no randomness.
  Every file holds one named rule with its constants beside it and a comment saying
  what it decides: `difficultyMove`, `starsForSession`, `dimmedMastery`,
  `streakFrom`, `badgesFor`, `milestonesFor`. When a rule needs the clock or the day,
  it is **passed in** (`at`, `now`, `today`) so the function stays pure and the
  reducers stay replayable.
- **`lib/math/`** — deterministic problem generation. A seeded mulberry32 PRNG
  (`lib/math/rng.ts`) means a problem index always yields the same problem, which is
  what makes invariant sweeps possible. The ladder keeps a problem distinct from
  the others *at its own level*, and difficulty changes between problems — so
  `generateJumpProblem`/`generateGroupingTask` also take the problem just
  finished (`avoid`), or a level change hands the child the same one twice
  running. `sequence.test.ts` sweeps every level pairing. **A sitting does not start at index 0** — it
  starts at `ladderStart(totalSolves)`, because determinism alone meant every K-1
  climber opened camp 1 with `5 + 2` on every visit, forever. The offset is a pure
  function of state the server already holds, so the ladder stays reproducible and
  hydration still matches; it is bounded by `LADDER_CYCLE` because generating
  problem *n* costs one pass over the *n* before it.
- **`lib/db/`** — Drizzle schema plus a repository marked `"server-only"`. Rows are
  Zod-parsed on the way out: Drizzle types them at compile time, but at runtime they
  are JSON off a wire like any other untrusted input. A single bad row is skipped, not
  fatal — a child keeps their climb.
- **`lib/ai/`** — the only importer of `@google/genai`, plus `framingGuard.ts`, a pure
  check that the model's words contain our operands, invent no numbers of their own,
  and do not leak the answer. Rejected framing falls back to the template bank.
  **The rule diagnoses, the model only finds the words.** `diagnoseJump` in
  `lib/domain/jumpDiagnosis.ts` reads the tick the child actually landed on and
  names the slip — did not move, wrong direction, off by one, stopped at the
  boundary, missed the regroup, miscounted — and *that* is what the coach is
  handed. Before it existed the model was told "they answered wrongly and will
  try again", which is why its lines could only be generic sympathy: the app
  knew the child had landed on 12 instead of 13 and threw it away. The same
  principle runs the other way at the end of a sitting: the summary is handed
  the sitting's slips rather than a mood. Diagnosing a
  misconception is arithmetic and stays local; wording it warmly for a
  six-year-old is not, and that is the model's job. Every nudge is **digit-free
  by construction** and swept against every problem × every wrong landing, so
  what we hand the model can never carry the answer. Both the
  model and the bank draw their characters from one recurring cast
  (`THEME_CAST` in `lib/ai/cast.ts`, picked per problem by `castFor`), so a child
  meets the same friends whether or not Gemini answered, and a fallback is not a
  change of cast. Each character also carries a `glyph`, and it is the glyph
  that **rides the number line**: the story said "Pip the robot needs twelve
  stars" while the board showed a generic theme emoji, so the friend a child was
  reading about never actually turned up. `NumberLineJumpCamp` builds one
  `FramingRequest` and both the coach and the climber are taken from it, so the
  friend in the sentence is provably the friend on the line. The cast is **original on
  purpose**: borrowing the cartoon characters children already know would ship
  someone else's trademarks in a product for children. Archetypes — a brave
  captain, a clumsy sidekick, a cheeky animal — are what a child responds to and
  are free; familiarity comes from recurrence. **A character name may never
  contain a digit**, or the framing guard reads it as an invented number and
  throws the story away.
- **`lib/progress/`, `lib/learner/`, `lib/theme/`, `lib/motion/`** — thin adapters:
  the fetch that records a solve, the cookie, the palettes, the shared spring presets.
- **`components/`** — presentation only. Game state lives in pure reducers
  (`campSession.ts` — shared by camps 1 and 2 — `groupingSession.ts`,
  `tradeSession.ts`) that receive actions carrying their own timestamps.
- **One page shell, `components/PageShell.tsx`.** Every screen — the map, the
  log, the four camps, the checkpoint, the session summary and the route
  loaders — sits in the same `<main>`: `max-w-6xl`, `px-4 sm:px-8`, `py-6`.
  Before it each screen picked its own (`3xl`, `5xl`, `6xl`; `py-8` or
  `py-16`) and a 14-inch laptop scrolled the onboarding page by a hundred-odd
  pixels of mostly air. `6xl` because the mountain board is 1152px wide and the
  widest screen should set the width. A screen that reads better narrow keeps
  an inner column (the summary's `max-w-3xl`): the gutters and the vertical
  rhythm are what have to match, not every block's width.
- **Onboarding is a landing page, and its backdrop runs edge to edge.** The
  ambient wash sits *outside* the page shell, on a wrapper that fills the rest
  of the viewport: inside the shell it stopped at the 1152px column and a wide
  screen showed the plain page as two bands either side. A sky-tint layer
  under the wash takes the chosen world's `sky`, so picking a world recolours
  the whole page. From `lg` the screen is two columns
  (`lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`, the camps' own split): the
  hero words, a **live preview of the mountain** and the start button on the
  left; the two pick groups on the right, vertically centred against them. The
  preview is `MountainBackdrop` itself — the map's real backdrop — painted in
  the picked world's palette, and in `UNPICKED_PALETTE` (brand tints, in
  `lib/theme/interestTheme.ts`) until there is one; it is `aria-hidden`
  because the radios already say what is chosen. **Recolouring alone was not
  a different world** — testers saw one silhouette in three tints — so
  `WorldScenery` (`components/map/`) lays each world's own life over it in
  the backdrop's 1000×625 space: a rocket, a shooting star, twinkling stars
  and a planet with an orbiting moon for space; two rolling wave layers that
  turn the mountain into an island, clouds, a whale and a leaping dolphin
  for the ocean; swaying corner leaves, hanging vines, fireflies, a gliding
  toucan and a tiger cub peeking from the foliage for the jungle. The
  friends on the mountain are the story cast (`THEME_CAST`), so the crew a
  child first sees is the one they will meet in the problems. Every
  position and timing is a constant — no `Math.random`, the server renders
  it too — and under `reduce` the scene stands still with every sprite at
  its resting spot. It is not GIFs or any raster media: those cannot take
  the palette, ignore reduced motion, and would be the first image assets
  in a codebase that draws everything. Cool colours only; nothing has been
  won yet. The label chip covers the bottom-left corner, which is why the
  left-hand leaves are taller than the right. Below `lg` it is not rendered
  and everything stacks. Two stacked panels of `min-h-60` cards used to make a
  laptop scroll through mostly air; measured in Chrome at 1024x768, 1190x773,
  1440x800 and 1920x1080 the page now fits with no scroll, and at 375px it is
  one column that scrolls. The pick cards are compact: a grade card is a glyph
  tile and three lines (beside each other on a phone, stacked from `sm`, since
  three across a `lg` column leaves ~170px of words); a **world card is a
  scene** — `WorldScene` draws two ridges in the world's `ridgeFar` and `ridge`
  across the bottom, the card is filled with its `sky`, the glyph floats over
  the ridge on an **opaque white disc** — loose, it took the ridge's own hue
  and vanished into it — and the words sit in the sky in ink, which clears AA on every
  world's sky. It was a gradient band over a white label, which read as a
  swatch rather than a place. A chosen card gets a brand tick as well as the
  border; `aria-checked` carries the state.
- **A camp puts its words beside its board from `lg`.** Camps 2, 3 and 4 lay
  the task, the story and the instruction in a 2/5 column with the board in
  the other 3/5 (`lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]`) — the side space
  a laptop was leaving empty while the page scrolled. Measured with a climber
  who has nothing mastered (the mastered banner adds ~150px): every camp fits a
  1190x773 laptop with no scroll. Camp 1 stays one column, because a 20-jump
  line is 1054px wide and needs the width. Every camp shares the section
  chrome (`p-5 sm:p-6`, header `mb-5`), so the only difference is where the
  board sits. The trade mat is a grid on a phone, sized by how many places are
  in play (three across, or two by two once thousands join): three `min-w-28`
  columns needed 312px and a 375px phone has 299px inside the card.
- **One app bar, on every screen.** `components/AppBar.tsx` carries the app's
  identity — a drawn two-peak mark and the name — plus the three destinations a
  child moves between (`NAV_ITEMS`: **Map**, **My progress**, **Grade & world**
  — plain words, after testers could not tell what "Mountain", "Climb log" and
  "Change picks" did; each page's heading says the same words). **There is no sidebar, and the bar does not
  list the camps**: the mountain *is* the navigation, so a rail repeating it
  would be a second and worse map. The page you are on is *named rather than
  linked* (`aria-current="page"`, rendered as a span), so the bar never offers a
  link to where you already are; a camp or a checkpoint passes `"none"`, where
  none of the three is current.
  - **A first-time climber gets the identity and no pills** (`destinations`).
    Nothing is saved yet, so `/map` and `/log` both redirect straight back to
    onboarding — three doors that all lead here is worse than none. Onboarding
    derives it from the `existing` profile it is already handed.
  - It is on the camps too, which costs one 72px row above the board at every
    width. That was worth measuring rather than assuming: a camp's tile tray
    already sits below the fold with or without it (910px of content against a
    760px viewport), so the bar makes an existing squeeze worse rather than
    creating one — and legible navigation won. See Responsive.
  - The mark is drawn rather than imported, and is **not Nerdy's logo**: this is
    not one of their products, and their trademark in the product's own header
    would say it was. `app/icon.svg` is the **same lockup** — a brand tile with
    white peaks — and `icon.png` / `apple-icon.png` are rendered from it. The
    bar's mark used to be brand peaks with a white snow cap on a transparent
    ground; on the bar's white surface the cap vanished and the mountain read
    as flat-topped, so it now sits on the tile like the favicon does. A static
    asset cannot read the theme tokens, so the SVG's hex values are `--brand`
    and `--brand-soft` flattened; change the two together.
  - The map keeps its streak chip as a second way into the log. That one carries
    the streak count and the problems still to go, which a nav pill does not.
  - It is above the **session summary** and the **route loaders** too. The
    summary used to return before the branch that rendered the bar, so the last
    screen a child saw in a sitting was the one without navigation; and a
    loader that lacks it makes the bar appear to drop in when the screen
    arrives. The root loader passes `destinations={false}`, since a first-time
    climber has nowhere else to go yet.
- **A camp screen owns its mechanic and nothing else.** Everything a sitting does
  around the mechanic — writing each solve through, reading the child's own day,
  deciding the read-aloud button, keying the reaction, and swapping the board for
  the summary — is `useCampSitting` in `lib/progress/`, alongside `answerOutcome`
  (how an answer reads to the coach: first try, after a wobble, or wrong) and
  `reactionKey` in `lib/motion/presets.ts` (a key that changes on every answer,
  so a burst replays even when two answers look alike to React). The four camp
  screens differ only in how a problem is posed and answered. Add a cross-cutting rule there, not
  in one screen: when that lifecycle was written out by hand in each, every miss
  showed up as a matched set. The checkpoint screen deliberately does not use it —
  it has no sitting, no summary and no solves to write through.

### Standards that hold everywhere

- **No randomness during render.** Anything that must match between server and client,
  or replay identically, uses the seeded PRNG (confetti is a pure function of its
  `fireKey`). `Math.random` appears only inside event handlers.
- **Browser-only state is read through `useSyncExternalStore`**, never during render:
  speech support, today's local date, seen badges. Each supplies a server snapshot so
  hydration matches and the client corrects itself afterwards. Do not `setState`
  synchronously inside an effect to work around this — ESLint rejects it, and the
  reason is that it causes exactly the flicker it looks like it fixes.
- **The client reports what happened; the server decides what it is worth.**
  `PATCH /api/learner` takes the camp, the day and whether the answer was clean,
  and `recordSolve` applies `masteryGain` itself in SQL
  (`least(MASTERY_MAX, mastery + gain)` — added in the database so two solves
  racing cannot lose a gain). The client used to send the resulting meter and the
  server wrote it down, which meant one crafted request could fill any camp. The
  meter is the one stored thing that cannot be re-derived, so it is the one thing
  the client must not be trusted with. `mastery` is still accepted and ignored so
  a tab open across the deploy keeps recording; drop it when that cannot be true.
- **Derive, don't store.** Lock state, dimmed meters, badges and milestones are all
  computed from the meters plus the climb log, so two screens cannot disagree and a
  failed write cannot strand a child in a wrong state. The database holds only what
  cannot be derived: the profile, earned mastery **per grade band**, the solve
  counter and the checkpoint count **per grade band** (`band_progress`), and the
  day log, each row tagged with the band it was solved in.
- **Failures are quiet for the child and loud in the console.** A solve that cannot be
  recorded logs and is swallowed; the next solve retries. No network error is ever
  rendered mid-climb.
- **One definition, one import path.** Every shared type, constant and rule has
  exactly one home, and re-export facades exist so it also has one *door*:
  `domain/progress.ts` re-exports the decay types, and everything that needs them
  imports from there rather than reaching past it. Union types are inferred from
  their Zod schema (`z.infer`), so the legal values are written once and serve both
  runtime validation and the compile-time type. Where a value must be listed per
  member, use `Record<Union, …>` rather than an array — the compiler then demands
  every case. TypeScript `enum` is deliberately unused; a string-literal union plus
  a schema does the same job with better narrowing.
- **No paths written inline.** Every route and API endpoint comes from
  `lib/routes.ts` (`ROUTES.map`, `ROUTES.camp(n)`, `API.learner`). The dynamic ones
  are typed as template literals so they stay assignable to Next's generated `Route`
  type and a bad path is still a build error.
- **Comparing a discriminated-union tag against a string literal is correct** and is
  used everywhere (`round.kind === "right"`, `streak.status === "climbing"`). The
  compiler narrows the type and rejects a typo, so these are not magic strings and
  must not be replaced with constants. What is forbidden is an inline literal that
  encodes a *rule* — a grade band that unlocks a feature, a path, a storage key.

## Verification

`npm test` runs the whole suite: **1150 tests across 91 files**, covering **98% of
lines** and 92% of branches. `.github/workflows/ci.yml` runs build, typecheck,
lint, coverage, the suite at **UTC+14 and UTC−11**, and `npm audit` on every push
and pull request — the timezone runs are there because streaks turn over on the
child's own day and a suite in one timezone cannot see an off-by-one-day bug. `npm run test:coverage` enforces that as a floor —
raise the thresholds in `vitest.config.mts`, never lower them. Tests live beside
the code they cover, as `*.test.ts` / `*.test.tsx`.

What to reach for, by layer:

- **Pure rules** (`lib/domain`, `lib/math`) — assert the invariant, not an example.
  The generators are swept across every band × skill × difficulty level: an answer
  is always in range, a within-place jump never crosses a ten, a place-value target
  is always buildable inside the block budget. Deterministic generation is what
  makes this a proof rather than a spot check. Anything touching `LocalDate` is
  tested across leap days, new year and both DST transitions.
- **Reducers** — drive them through whole sittings and assert the invariants hold
  at every step (the meter never passes 100, clean solves never exceed solves,
  difficulty stays on the ladder), plus that they never mutate their input.
- **API routes** — call the exported `POST`/`PATCH` with a real `Request`. Assert
  the refusals as carefully as the successes: a bad camp number, a meter off the
  meter, a day that does not exist, a missing learner, no database.
- **The database layer** — a fake Drizzle that records what was asked of it, so
  the repository's own decisions are tested without a server. `getTableConfig`
  asserts the schema's CHECK constraints and cascades.
- **The AI layer** — a fake `@google/genai`. Every fallback has a test: no key, bad
  JSON, a leaked answer, an invented number, a rate limit, an open breaker, a
  timeout. No test ever reaches the network.
- **Components** — Testing Library, queried by role and accessible name, so the
  test exercises what a child or a screen reader actually gets. Assert behaviour
  and accessibility (labels, `aria-live`, 44px targets, keyboard operation), not
  markup.
- **Reduced motion** — `reducedMotion.test.tsx` asserts the rule directly: under
  `reduce`, decoration stops rendering and every label, reading and reaction stays.

Things worth knowing before writing more:

- **`ViewTransition` needs a shim.** Next runs the app on its vendored React
  canary; the installed `react` is 19.2 and has no `ViewTransition`. `test/reactShim.js`
  re-exports the real React and adds it as a passthrough, aliased in
  `vitest.config.mts`. Aliasing onto Next's vendored copy instead puts two Reacts
  in one process and nulls the hook dispatcher.
- **`AnimatePresence` keeps exiting elements** until an animation jsdom never
  runs, and Framer's cleanup often rides on `onAnimationComplete` rather than a
  timer. Assert the *outcome* (the meter moved, the total changed), not that the
  old panel disappeared.
- **Framer ignores pointer events without `isPrimary`**, so a simulated drag
  silently does nothing without it. `DraggablePiece.test.tsx` shows the shape of a
  working drag; the drop hit-test is also a pure exported function
  (`landedInZone`), because the page-versus-viewport coordinate correction is
  worth testing directly. Note that jsdom has no layout, so
  it cannot see a drag growing the page — that one needs real Chrome.
- **A server snapshot only runs on the server.** `serverSnapshot.test.tsx` uses
  `renderToString` to cover the `getServerSnapshot` branch of every
  `useSyncExternalStore`.
- **Framer reads `prefers-reduced-motion` once per process**, so a file cannot
  flip it mid-run. Reduced-motion assertions live in their own file.

Beyond the suite, for anything visual: **headless Chrome** (`puppeteer-core`
driving the system Chrome, installed with `--no-save` and removed afterwards) for
the viewport sweep, tap-target sizes, unlabelled controls, and console or
hydration errors. Several bugs the numbers could not show — a missing arc, a
flicker loop, a hydration mismatch under reduced motion — were only caught that
way. After probing against the real database, **delete the test learners**.

## Type rules

- **No `any` anywhere.**
- **No unexplained non-null assertions** (`!`) — if one is truly needed, comment why.
  Prefer a guard or `?? fallback` over asserting; `noUncheckedIndexedAccess` is on
  because indexing really can miss.
- Model domain state with **discriminated unions**, not optional-field grab bags.
  `CampProgress`, `Mechanic` and the session round states are the pattern to copy.
- `tsconfig.json` enables `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
  `exactOptionalPropertyTypes` in particular means never passing `undefined` to an
  optional prop — give Framer a concrete value (`{ scale: 1 }`) instead.
- ESLint runs `@typescript-eslint` **strict + strict-type-checked** on top of
  `eslint-config-next`. It is type-aware, so it needs a working program: run
  `npm run build` before `npm run lint` or `npm run typecheck` after any dependency
  change.

## Next.js 16 notes

The installed version differs from most training data. The traps that have actually
bitten:

- Route props come from **generated types** — `PageProps<"/camp/[camp]">`,
  `LayoutProps<"/">` — and `params`/`searchParams` are **promises**, so they are
  awaited.
- `npm run typecheck` needs a prior `npm run build`, since those generated types are
  written into `.next/types`.
- There is **no `middleware.ts`**; the equivalent file is `proxy.ts`. The app does not
  currently need one.
- Route transitions use React's `<ViewTransition>` in `app/layout.tsx`, with `<Link>`
  passing `transitionTypes` (`nav-forward` / `nav-back`) to say which direction the
  child is travelling. The keyframes are in `globals.css` behind a reduced-motion guard.
- Read `node_modules/next/dist/docs/` before writing anything that touches framework
  API, and heed deprecation notices.

## Out of scope

Do not build, and do not propose:

- Accounts / login
- Multiplayer
- Leaderboards or any child-against-child comparison
- Teacher or parent dashboards
- More than 4 camps. The two *coming soon* teasers on the map are not camps
  and must not grow into partial ones: no route, no data, no unlock.
- A fifth mechanic, or one mechanic serving two camps — each camp keeps its own act
- A third animation library or a component kit
- Native app packaging

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit` (run `build` first)
- `npm test` — the whole test suite, once
- `npm run test:watch` — the suite in watch mode
- `npm run test:coverage` — the suite with coverage, enforcing the thresholds
- `npm run db:generate` — generate a migration from `src/lib/db/schema.ts`
- `npm run db:migrate` — apply migrations to `DATABASE_URL`
- `npm run db:push` — push the schema straight to the database (dev only)
- `npm run db:studio` — browse the data

## Environment

Copy `.env.example` to `.env.local` and fill it in. `drizzle.config.ts` loads
`.env.local` explicitly, because drizzle-kit itself only reads `.env`.

- `DATABASE_URL` — Neon Postgres connection string. Required to save anything. Without
  it the app builds and onboarding renders, but the API answers `503` with a message
  saying exactly what to do.
  - The schema lives in `src/lib/db/schema.ts` and its migrations in
    `drizzle/`; a fresh database gets the whole schema with `npm run
    db:migrate`. A schema change is always a new migration (`npm run
    db:generate`, then read the SQL before applying it), never an edit to an
    existing one. `drizzle/meta/` is drizzle-kit's record of the schema after
    each migration, which `db:generate` diffs against: committed, never
    hand-edited.
- `GEMINI_API_KEY` — optional. Without it, word problems and encouragement come from
  the local template bank in `lib/ai/templates.ts` and the app is fully playable.
- `GEMINI_MODEL` — optional, defaults to `gemini-3.6-flash`.
- `GEMINI_MAX_CALLS_PER_MINUTE` — optional, defaults to 4, just under the free tier's 5.

**The rate budget, not imagination, is what limits the AI.** Four calls a minute
with a 1s gap, and one problem already costs two — framing *and* encouragement —
so a child solving three problems in a minute has already spent it. Adding a
fourth and fifth AI feature would therefore make the app *less* AI-visible, not
more, because it would starve the calls a child can already see. The way to add
AI here is to give the calls that exist **richer input** — which is what
`diagnoseJump` and `session.slips` do — not to make more of them.

The AI layer is built to be rate-limited rather than to pretend it is not: a rolling
per-minute budget, a 1s minimum gap, 6s/5s timeouts, and a breaker that pauses for 60s
after three failures or any quota error. Every one of those paths falls back to a
template, so a throttled key looks like slightly plainer wording and nothing else.
`thinkingConfig: { thinkingLevel: MINIMAL }` is required — omitting it makes the model
prefix its JSON with prose, and `thinkingBudget: 0` is rejected outright on 3.5+.

## Learner identity

- One anonymous learner per browser, identified by a UUID in an `httpOnly`
  cookie (`bn_learner`, `sameSite=lax`, one year, `secure` in production), minted on
  the first successful save. No accounts, no login, and nothing stored that could
  identify a child.
- Grade band and interest theme hang off that UUID. **Mastery, the solve
  counter and the checkpoint count hang off the UUID *and the grade band***
  (`camp_mastery`, `band_progress`): each band is its own climb, so a child
  who finished camp 1 as K-1 and switches to 2-3 starts 2-3 at the trailhead,
  and finds K-1 exactly as they left it when they switch back. It was per
  learner only, and camp 1 arrived already full with camp 2 unlocked. The band
  a solve counts towards is read from the saved profile on the server, never
  from the request. The climb log is one log per child, every row tagged with
  its band: a streak is the child turning up, whatever they were climbing,
  while solves and bests are read per band.
- The cookie is parsed with Zod like any other untrusted input, never trusted as a
  string.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
