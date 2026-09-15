# Basecamp Numbers — product decisions

The reasoning behind the app, for anyone asking "why is it like that". Each
decision names what it optimises for, what it gives up, and where the evidence
sits in the code.

Written to be read alongside [README.md](README.md) (what it is),
[CLAUDE.md](CLAUDE.md) (what every rule actually does) and
[ROADMAP.md](ROADMAP.md) (what is still missing, stated plainly).

---

## 1. Four camps, each with its own act — reversed from "two mechanics, ever"

For most of the project a child learned **one** number line and **one**
drag-and-drop mat, and every activity was expressed through one of those two.
That was a deliberate decision, and it was reversed after testing.

**What it optimised for:** a five-year-old spending their attention on the maths
rather than on learning a new interface every few minutes. Motor skill is a real
budget at that age, and every new interaction spends it.

**What it actually cost:** testers read the second camp of each pair as a repeat
of the first. Camps 1 and 2 were one number line apart only in whether the jump
carried; camps 3 and 4 were the same drag into a frame with different blocks. The
rule bounded variety, which is the thing a four-stage climb needs most.

**What replaced it:** each camp sets its own act. Camp 2 keeps the crossing jump
but answers it by *choosing* a landing from four, where the three wrong ones are
each a slip the app can already name (`jumpChoices`, `diagnoseJump`). Camp 4 no
longer builds a number — it *trades* an untidy pile tidy, ten of a place for one
of the next (`tradeTasks`, `tradeSession`), which is regrouping as an action.

**What survives from the old decision:** the problems and the difficulty ladder
behind camps 2 and 4 did not change — only what the child does with them — so
the ranges in CLAUDE.md are the same numbers. And difficulty still scales
*inside* each mechanic (decision 3); the reversal added acts, not a fifth camp.

**Gives up now:** the guarantee that a child meets only two interfaces. Each new
act is a real cost to a five-year-old, which is why there are exactly four and
why no mechanic will serve two camps again.

## 2. Compete with yourself, never with another child

There is no leaderboard, no class ranking, no comparison of any kind.

This is enforced structurally, not by policy: **every database query is scoped
to a single learner id** — 6 of 6 `where` clauses in `learnerRepository.ts`. The
data layer cannot read two children at once, so cross-child comparison is
*absent*, not merely unbuilt.

**Optimises for:** the bottom half of the class. Ranking tells a struggling
seven-year-old something true and useless. The only reference point here is the
child's own yesterday.

**Gives up:** the strongest known short-term engagement lever in ed-tech.

**Three rules follow from it, each visible in the code:**

- **Wrong answers never subtract mastery** (`masteryGain` only ever adds).
- **Difficulty drops are invisible.** `difficultyMove` moves down on a wrong
  answer, but the level is never shown — a quiet adjustment, not a demotion.
- **Stars are not a currency.** Nothing unlocks with them, they are never spent
  and never taken away. One star for solving anything at all: turning up counts.

## 3. Difficulty scales by *regrouping*, because the mechanic has a ceiling

The two number-line camps are "no carrying" and "carries over" — not "inside a
ten" and "across a ten", which is what they used to be.

**The problem that forced it:** staying inside a ten *mathematically forces* the
jump under ten. Grade 2-3 declared a jump range of 19 and was silently clamped
to 9, so its first camp was the K-1 camp with a bigger number in front —
`79 − 8` against `9 − 8`.

**And the obvious fix is impossible.** The number line draws one tick per
integer at 34px, so a jump of 20 is already 1054px of line and a jump of 145
would be 5202px. **Jump size is capped by the mechanic itself.** Difficulty above
K-1 therefore comes from regrouping, and from how many places a carry cascades
through, rather than from magnitude.

| | no carrying | carries over |
| --- | --- | --- |
| K-1 | `5 + 2` | `8 + 5` |
| 2-3 | `34 + 25` | `38 + 25` |
| 4-5 | `623 + 14` | `899 + 6` |

**Evidence:** `carriesAdding` / `borrowsSubtracting` are the definition, and
12,000 generated problems were swept against them — 0 mis-classified, 0 out of
range. Every band × level range is tabulated in CLAUDE.md and pinned by
`difficultyLadder.test.ts`, which also asserts that nothing goes backwards, that
no band is handed a younger band's easiest work, and that a child gains a digit
at most once.

## 4. The AI never does arithmetic — but it is told exactly what went wrong

The rule is: **the rule decides, the model finds the words.**

- All maths is computed and verified locally. `framingGuard.ts` rejects any
  model output that omits an operand, invents a number, leaks the answer or
  contains markup.
- `diagnoseJump` reads the tick the child *actually* landed on and names the
  slip: did not move, wrong direction, off by one, stopped at the boundary,
  missed the regroup, miscounted. **That** is what the coach is handed.

**What this replaced:** the model used to be told "they answered wrongly and
will try again". The app knew the child had landed on 12 instead of 13 and threw
it away — which is why its lines could only be generic sympathy.

**Why this split and not "let the model teach":** diagnosing a misconception is
arithmetic, and a model that is wrong about arithmetic in a maths app for
children is worse than no model. Wording a diagnosis warmly for a six-year-old
is *not* arithmetic, and is exactly what a language model is good at.

**Evidence:** every nudge is digit-free by construction, swept across every
problem × every possible wrong landing (5,000+ cases). What we hand the model
can never carry the answer.

**The same split at the end of a sitting.** The summary line is handed the slips
the sitting actually contained, in order, so it can name one that *stopped
happening*. It used to get a four-way mood bucket — strong, steady, wobbly,
nothing — which cannot tell a child they stopped counting the starting tick.

**Why we did not add a fourth and fifth AI feature.** The free tier allows five
calls a minute and we spend four; one problem already costs two, framing and
encouragement. A child solving three problems in a minute has spent the budget
already. More AI features would have made the app *less* AI-visible in a demo,
because they would starve the calls a child can see. So every addition here went
into giving the existing calls better input, at zero extra cost. We also refused
AI-chosen difficulty (pedagogy the rule owns and can be tested), AI
text-to-speech (Web Speech is free, offline and instant) and a "why was I wrong"
explainer (that is the model explaining arithmetic — the exact thing the guard
exists to prevent).

**The fallback is the product, not a safety net.** No key, bad JSON, a rate
limit, an open breaker, a timeout — every path falls back to a local template
bank, and both the bank and the model draw characters from the same cast, so a
fallback is not even a change of cast. A throttled key looks like slightly
plainer wording and nothing else.

## 5. Spaced repetition counted in problems, not days

A camp's meter dims as the child solves problems **elsewhere** — never as time
passes. Dim far enough and advancing is gated behind a three-question review.

**Optimises for:** not punishing a holiday. A fortnight away costs nothing; a
long run at camp 4 is what pulls camp 1 back down.

**Gives up:** true time-based forgetting curves, which are better science and
worse product for a child who has no control over when they get a tablet.

**Non-destructive by design:** the earned meter is kept and the dimmed reading is
*derived*, so a checkpoint restores it in full rather than making a child
re-earn it. Unlocking reads the earned value, so decay can never re-lock a camp.

## 6. Anonymous by construction

One learner per browser, a UUID in an `httpOnly` cookie. No accounts, no login,
no email, no name — **nothing stored that could identify a child.** Onboarding is
two taps, so a six-year-old can start alone.

**Gives up:** cross-device continuity, and any parent-facing report.

**Why it is not a shortcut:** a children's product that holds identifying data
inherits COPPA/GDPR-K obligations and a breach surface. Holding nothing is the
cheapest way to be safe, and it is a decision that holds at any scale.

## 7. Progress is computed by the server

The client reports **what happened** — which camp, which day, whether it was
right first time. The server decides what that is worth.

**What this replaced:** the client used to send the resulting meter and the
server wrote it down, so one crafted request could fill any camp.

**Evidence:** verified against the real database — a clean solve then a wobbly
one gives 14 then 21, screen and database agreeing exactly; and a request
claiming `mastery: 100` yields the real +14 and nothing more.

## 8. Accessibility as a constraint, not a pass at the end

- **44px tap targets** — the WCAG 2.5.8 **AAA** figure, not the AA one.
- **One deliberate exception**, documented: the number-line ticks are 34px wide
  on a 375px phone, because forcing 44px would push a 21-tick line to 924px and
  make a child scroll to compare numbers. It is made safe by the ticks being
  **contiguous** — no dead space, so a slightly-off tap picks a neighbour rather
  than nothing.
- **Four brand colours were overridden for contrast.** The brand's cyan is 1.6:1
  on white; ours ships at `#0B7F86`. Each override records the measured ratio.
- **Reduced motion degrades to information without movement** — under `reduce`
  the confetti does not render at all while every label stays, and the climber
  arrives at its landing rather than travelling.
- **Read-aloud for K-1 only**, where decoding the words is the barrier rather
  than the maths.
- **K-1 gets concrete words.** A dimmed camp is a *warm-up* for a five-year-old
  and has *gone dim* for the older bands. A test asserts K-1 never meets "dim",
  "checkpoint", "meter", "review" or "slipped", and is given one number to hold
  rather than three.

## 9. Eight runtime dependencies, and that is the budget

No component library, no icon pack, no second animation engine, no
`clsx`/`tailwind-merge`. The one exception is `@vercel/analytics`: the host's
own Web Analytics, cookieless and anonymous, with no UI and no second runtime,
placed once in the root layout. It breaks none of the reasoning below — it
borrows no markup and paints nothing — and it is the only tracking there is. Animated component kits were evaluated and rejected:
their catalogues are hero sections and navbars rather than number lines and
base-10 blocks, they are styled dark-and-glassy against a bright palette, and
each would add a second animation runtime plus borrowed markup whose contrast
and keyboard behaviour we would have to re-audit.

## 10. Correctness is proved where it can be

**1150 tests across 91 files, 98.7% of lines and 92.5% of branches**, enforced
as a floor in CI (97 / 98 / 97 / 92 for statements, lines, functions, branches).

The approach differs by layer, and the distinction that matters is
**invariants over examples**: the generators are swept across every band × skill
× level and asserted against properties, not spot-checked. Deterministic
generation is what makes that a proof rather than sampling.

Also: the suite runs at `TZ=Pacific/Kiritimati` (UTC+14) and `Pacific/Niue`
(UTC−11) on every push, because streaks turn over on the child's own calendar
day and a suite that only ever runs in one timezone cannot see an
off-by-one-day bug.

**What the tests found that review did not:** every K-1 climber opened camp 1
with `5 + 2` on every visit forever (determinism with no offset); a badge
spotlight that vanished on any re-render; and a place-value generator that could
set the same target twice in a row.

## 11. The summit is typed, not tapped

Camp 4 asks the child to work out the value of a mat written the long way —
`7 tens and 14 ones` — and type it on a keypad. It was "tap *Trade 10* under
the column that has ten", with that column lit up, which is camp 2's act
(pick one of a few buttons) with the answer highlighted; testers said camps 2
and 4 asked the same kind of question, and at the summit there was nothing to
climb. Typing a number is an act no other camp asks for, and at 4-5 it is real
work: 2 thousands, 13 hundreds, 1 ten and 15 ones is 3325, with the carries
done in the child's head. The ten-frames on the mat are the support, not the
answer; the value is written nowhere until it is found.

**What it gives up:** the physical act of trading. Regrouping is now something
the child *sees* (a ringed ten is one of the next place) and *computes*, rather
than performs. **What it buys:** a fourth genuinely different act, a summit that
is harder than the camps below it, and wrong answers that can be diagnosed —
digits written side by side, a forgotten carry, one place on its own — because
each is a specific number the counts predict. The story became a real word
problem in the process: the operands are the counts (*7 bags of ten and 14
loose*) and the value is the answer, which the framing guard now forbids the
model to say.

## 12. A camp's card never opens another camp's questions

When a lower camp dims past the review threshold, the camps above it are gated
until it is reviewed. The gated camp's card used to carry the review's button,
labelled only "Checkpoint", so a child who tapped it on the summit's card was
handed camp 1's number line and read it as the summit's question. The review is
now offered in two places only, and both name the camp: the banner and the
dimmed camp's own card. A gated camp says *Review Camp 1 first* and offers
nothing to press.

The tuning had to change with it. A grace of 6 solves at 4 points a solve
gated after 14 solves elsewhere — less than two camps — so *every* child who
climbed straight up met a camp-1 review the moment the summit opened. The grace
is now three camps' worth of clean solves (24) at 3 points a solve, and a test
proves that both a straight ascent and one made entirely of after-a-wobble
solves reach the summit ungated, while a child who lingers at camp 4 is still
sent back. Decay is for a child who lingers, not one who is climbing.

## 13. "Coming soon" is a teaser, not a camp

Camps 5 and 6 appear on the map beyond the summit so a child knows the climb
goes on. They are deliberately not camps: not a `CampNumber`, no route, no
reducer, no meter, no lock, never a link, and they do not borrow the locked
camp's padlock — the promise is "there is more", not "you are shut out". The
four-camp rule (§1) still holds; the board simply scrolls sideways to the next
range inside a fixed frame. Their names and skills are placeholders until the
product confirms them.

---

## What we would do next, in order

Straight from ROADMAP.md:

1. **A "come back tomorrow" nudge.** Every retention mechanic — streak, daily
   goal, badge spotlight — currently assumes a return that nothing prompts.
2. **Privacy-preserving analytics.** Day-1 and day-7 return, where children
   stall. Without it, the psychology above is a set of hypotheses.
3. **Per-client throttle on the coach endpoint.** The breaker is process-global,
   so one client can spend everyone's quota. It degrades rather than breaks,
   which is why it is third.
4. **End-to-end coverage of one full sitting**, now that there is CI to run it.

## What we would not build, however well it demoed

Leaderboards or any child-against-child comparison; accounts and login; a
teacher or parent dashboard, which turns practice into surveillance; a third
mechanic; a fifth camp.
