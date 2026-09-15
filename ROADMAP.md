# Roadmap — known gaps and future enhancements

What is not built, what is weak, and what comes next. Ordered by effort against
impact, not by wishlist appeal.

This file is deliberately honest about the shape of the thing: the domain logic is
in good order, and nearly everything below is *operational* rather than
architectural.

---

## Known gaps, stated plainly

These are true today. None of them is hidden elsewhere in the docs.

| Gap | Why it matters | Severity |
| --- | --- | --- |
| **`/api/coach` is unauthenticated and unthrottled per client** | The rate limiter and circuit breaker are process-global, so one client can exhaust the shared Gemini budget and degrade every child to template wording. | Medium — it degrades, it does not break, and the free tier costs nothing |
| **Only page-level analytics** | Vercel Web Analytics (cookieless, anonymous) counts page views and Web Vitals, which shows whether anyone comes back but not what they did. There is still no measurement of day-1 or day-7 return per learner, solves per sitting, or where children abandon, so every retention claim the product makes is a hypothesis. | Medium |
| **No notifications, push, service worker or PWA manifest** | Every return mechanic (streak, daily goal, badge spotlight) only works *if the child already came back*. Nothing prompts the return. | Medium |
| **No end-to-end suite** | Component tests cover behaviour in jsdom, but no test drives a real browser through a whole sitting. | Medium |
| **Nothing runs against a real database** | The repository is tested against a fake Drizzle that records calls. Schema constraints are asserted via `getTableConfig`, but no migration is ever applied in a test. | Low–medium |
| **The solve endpoint does not check the camp is unlocked** | A crafted request can record a solve for a locked camp at the real 14 points a request — slower than playing, and it wins nothing since there is no leaderboard, but it is an integrity hole. | Low — nothing to gain, and the server still decides the gain |
| **Visual and layout correctness is ad-hoc** | Verified by a headless-Chrome sweep run by hand, not on every change. | Low |
| **Branch coverage sits at 92.5%**, just above its 92% floor | The uncovered branches are concentrated in animation and presentation rather than in rules — the scenery, the loaders and the map's drift. | Low — this is decoration, not rules |

---

## Next, ranked

### 1. A "come back tomorrow" nudge — ~1–2 days, high impact on the core metric

The entire retention model — streaks with a one-day grace, the five-problem daily
goal, the badge spotlight — assumes a return that nothing currently prompts.

Smallest honest version: a PWA manifest so the app can live on a home screen, plus a
parent-opt-in local notification at a time the parent picks. Local notifications
avoid a push server, a subscription store, and holding any contact detail — which
keeps the "nothing stored that could identify a child" promise intact.

Explicitly not: email, SMS, or any notification the child can enable without a
parent.

### 2. Minimal privacy-preserving analytics — ~1 day, high learning value

Day-1 and day-7 return, solves per sitting, drop-off point within a sitting,
checkpoint pass rate, and which camp children stall on.

Constraint: it has to stay anonymous. The existing learner UUID is enough of a key,
and nothing beyond counters should leave the server. Self-hosted or a
privacy-first vendor — not anything that profiles children.

Without this, the product bets in `CLAUDE.md` cannot be evaluated, only asserted.

### 3. Per-client throttle on `/api/coach` — ~half a day, medium impact

Key the existing rate limiter by learner id in addition to the process-global
budget, so one client cannot spend everyone's quota. The circuit breaker and
template fallback already mean this degrades rather than fails, which is why it
ranks below the items above rather than at the top.

### 4. Widen the content within the existing mechanics — ~2–3 days, medium impact

The four-camp ceiling is a product constraint and stays. But the generators already
scale by grade band × difficulty level, so more variety is a tuning job rather than
new code.

The clearest target left is **K-1 place value: the teens are nine numbers, so a
level offers only three or four of them** and a child can meet the same one twice in
a short sitting. Every other cell of the ladder now ramps per band and per level —
see the table in CLAUDE.md — so this is the one narrow cell. It is pinned by
`difficultyLadder.test.ts`, so retuning `GROUPING_BAND_RANGES` shows up as a
visible, deliberate change rather than a silent one.

### 5. End-to-end coverage of one full sitting — ~1–2 days, medium impact

One Playwright run: onboard, solve through a camp, hit the summary, land on the
Climb Log with a streak. This covers the seams that unit tests structurally cannot —
route transitions, the cookie round-trip, real hydration, and the actual drag
interaction.

Lower priority than it looks, because the component suite is thorough and the
headless-Chrome sweep already catches layout regressions. It earns its place once
there is CI to run it in.

---

## Deliberately not doing

These are not backlog items. They are decisions, and reversing one is a product
change rather than a sprint.

- **Leaderboards or any child-against-child comparison.** Not merely unbuilt:
  every database query is scoped to a single learner id, so the data layer cannot
  see two children at once. The product's whole reward model assumes the only
  reference point is the child's own yesterday.
- **Accounts and login.** One anonymous learner per browser is the privacy posture,
  not a shortcut. Adding accounts means holding data about children.
- **Teacher or parent dashboards.** Parents are meant to watch over a shoulder. A
  dashboard turns practice into surveillance and changes what the child is doing it
  for.
- **A fifth camp, or one mechanic serving two camps.** Each camp has its own act
  now — see DECISIONS.md §1 for the reversal — and four acts is already a real
  cost to a five-year-old; four camps bound the map. Camp 4's act is typing
  the value of a mat on a keypad; it was tapping a lit "Trade 10" button,
  which read as camp 2's pick over again.
- **A second animation library or a component kit.** Eight runtime dependencies is
  the budget.
- **Native app packaging.** A PWA manifest (item 1) gets the home-screen icon
  without an app store.

---

## Smaller things worth doing eventually
- **Narrative continuity.** The cast turns up in every problem but the story
  does not build across a sitting. Templates structurally cannot do it and it
  needs no extra model calls: the framing request would carry the last story's
  beat, and the model would continue it.
- **Confirm the two "coming soon" camps.** The map shows camps 5 and 6 as
  teasers (`UPCOMING_CAMPS` in `lib/data/camps.ts`): *Cloud Peak — share things
  out into equal groups* and *Star Ridge — split one whole into fraction
  pieces*. Those names and skills were chosen as a plausible K-5 progression
  after place value, not decided; change them there, and only there. The
  teasers are not camps and the four-camp rule still holds.

- The number line's roving focus starts at tick 0 rather than at the jump's start,
  so on a 0–1000 line a child tabbing in lands far from the problem even though the
  line auto-scrolls to it. A one-line change, but a real UX decision — the current
  behaviour is asserted by a test, so changing it is explicit.
- Raise the coverage thresholds toward the actual figures once CI exists, so drift
  is caught rather than merely reported.
- **Remove the orphaned place-value grouping board.** `PlaceValueMat` and the
  place-value branch of `groupingSession` are set by no camp since camp 4 stopped being a
  place-value build. They are still implemented and covered through a synthetic camp
  definition in the tests, so this is dead weight rather than a bug — but it is
  dead weight, and `GroupingBoard`'s narrowing would collapse to one case.
- The `seenBadges` localStorage snapshot is cached per page load on purpose (a
  re-read would clear the spotlight mid-visit). It is correct, but it is subtle
  enough to deserve a comment pointing at the test that pins it.
