"use client";

import type { JSX, ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type TargetAndTransition,
  type Transition,
} from "framer-motion";
import type { InterestTheme } from "@/lib/domain/onboarding";
import { THEME_CAST } from "@/lib/ai/cast";
import { INTEREST_PALETTES, type InterestPalette } from "@/lib/theme/interestTheme";

/**
 * What lives in a world: the things that move across the mountain once a
 * child has picked one. Drawn in the backdrop's own 1000×625 coordinate
 * space so it can sit over `MountainBackdrop` and scale with it.
 *
 * Recolouring the mountain was not enough of a difference — testers saw one
 * silhouette in three tints. So each world gets its own sky and shore: a
 * rocket, a shooting star and an orbiting moon for space; rolling waves that
 * turn the mountain into an island for the ocean; swaying leaves, vines and
 * fireflies for the jungle. The friends from the story cast (`THEME_CAST`)
 * are on the mountain too, so the first thing a child sees of a world is the
 * same crew they will meet in the problems.
 *
 * Every position and every timing is a constant. Nothing here may use
 * `Math.random`: the server renders it, and the client must agree. Under
 * reduced motion the scene stands still — a picture, not a film — and every
 * sprite is exactly where it would otherwise come to rest.
 *
 * Decoration only: the radios already say which world is chosen, so the
 * whole layer is `aria-hidden`. Cool colours only; warm hues are for rewards
 * and nothing has been won yet.
 */

/** A pair Framer needs together: a sprite either moves with both or not at all. */
interface Motion {
  readonly animate: TargetAndTransition;
  readonly transition: Transition;
}

/** Repeating forever, with the same easing everything here shares. */
function loop(duration: number, delay = 0, repeatDelay = 0): Transition {
  return { duration, delay, repeat: Infinity, repeatDelay, ease: "easeInOut" };
}

function glide(duration: number, delay = 0, repeatDelay = 0): Transition {
  return { duration, delay, repeat: Infinity, repeatDelay, ease: "linear" };
}

/**
 * A cast member's face by position in the crew. The cast is a non-empty
 * tuple, so only the first is known to exist; the rest fall back to a glyph
 * of the same kind, which the tests assert is never actually needed.
 */
function crew(theme: InterestTheme, index: number, fallback: string): string {
  return THEME_CAST[theme].characters[index]?.glyph ?? fallback;
}

interface SpriteProps {
  readonly glyph: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  /** Mirror the glyph, for a creature that should face the way it travels. */
  readonly flip?: boolean;
  readonly motion?: Motion;
  readonly still: boolean;
}

/**
 * An emoji placed in the scene. The resting spot is the text's own `x`/`y`;
 * the animation is a transform on the group around it, so a sprite's home is
 * readable from its props and its travel is relative to home.
 */
function Sprite({ glyph, x, y, size, flip = false, motion: move, still }: SpriteProps) {
  const animation = !still && move !== undefined ? move : {};
  return (
    <motion.g {...animation}>
      <text
        x={flip ? -x : x}
        y={y}
        fontSize={size}
        textAnchor="middle"
        dominantBaseline="central"
        {...(flip ? { transform: "scale(-1 1)" } : {})}
      >
        {glyph}
      </text>
    </motion.g>
  );
}

// ---------------------------------------------------------------------------
// Space
// ---------------------------------------------------------------------------

/** Four-point stars in the sky. x, y, half-size, and a phase for the twinkle. */
const STARS: readonly { readonly x: number; readonly y: number; readonly r: number; readonly phase: number }[] = [
  { x: 60, y: 40, r: 7, phase: 0 }, { x: 150, y: 220, r: 5, phase: 0.7 },
  { x: 290, y: 40, r: 6, phase: 1.3 }, { x: 380, y: 130, r: 8, phase: 0.4 },
  { x: 470, y: 40, r: 5, phase: 1.9 }, { x: 590, y: 150, r: 6, phase: 1.0 },
  { x: 700, y: 50, r: 7, phase: 2.4 }, { x: 890, y: 30, r: 5, phase: 0.2 },
  { x: 960, y: 190, r: 6, phase: 1.6 }, { x: 330, y: 230, r: 4, phase: 2.8 },
];

function starPath(r: number): string {
  const pinch = String(r * 0.32);
  return `M0 ${String(-r)} L${pinch} ${String(-r * 0.32)} L${String(r)} 0 L${pinch} ${pinch} L0 ${String(r)} L-${pinch} ${pinch} L${String(-r)} 0 L-${pinch} ${String(-r * 0.32)} Z`;
}

const PLANET = { x: 180, y: 130, r: 42 } as const;

function SpaceScene({ palette, still }: { palette: InterestPalette; still: boolean }) {
  const twinkle = (phase: number): Motion => ({
    animate: { opacity: [0.25, 0.95, 0.25], scale: [1, 1.35, 1] },
    transition: loop(2.6, phase),
  });
  return (
    <>
      {STARS.map((star) => (
        <motion.path
          key={`${String(star.x)}-${String(star.y)}`}
          d={starPath(star.r)}
          fill={palette.ridge}
          style={{ x: star.x, y: star.y }}
          {...(still ? { opacity: 0.6 } : twinkle(star.phase))}
        />
      ))}

      {/* A ringed planet, with a moon going round it. */}
      <motion.g {...(still ? {} : { animate: { y: [0, -8, 0] }, transition: loop(7) })}>
        <circle cx={PLANET.x} cy={PLANET.y} r={PLANET.r} fill={palette.ridgeFar} />
        <ellipse
          cx={PLANET.x}
          cy={PLANET.y}
          rx={PLANET.r + 30}
          ry={13}
          fill="none"
          stroke={palette.ridge}
          strokeWidth="6"
          opacity="0.8"
          transform={`rotate(-18 ${String(PLANET.x)} ${String(PLANET.y)})`}
        />
        <motion.g {...(still ? {} : { animate: { rotate: 360 }, transition: glide(12) })}>
          {/* An invisible anchor keeps the group's centre on the planet, so
              the moon orbits it rather than spinning about itself. */}
          <circle cx={PLANET.x} cy={PLANET.y} r={PLANET.r + 32} fill="none" />
          <circle cx={PLANET.x + PLANET.r + 24} cy={PLANET.y} r={7} fill={palette.ridge} />
        </motion.g>
      </motion.g>

      {/* A shooting star, top right, every few seconds. */}
      <motion.line
        x1={640}
        y1={30}
        x2={700}
        y2={58}
        stroke={palette.ridge}
        strokeWidth="4"
        strokeLinecap="round"
        {...(still
          ? { opacity: 0.5 }
          : {
              animate: { x: [0, 240], y: [0, 110], opacity: [0, 0.9, 0] },
              transition: glide(1.5, 1.2, 4.5),
            })}
      />

      <Sprite glyph="🛰️" x={930} y={110} size={40} still={still}
        motion={{ animate: { y: [0, -10, 0], x: [0, -14, 0], rotate: [0, 8, 0] }, transition: loop(9) }} />

      {/* The rocket crosses the whole sky, above the summit. Its home is
          mid-flight, which is where it rests when motion is off. */}
      <Sprite glyph="🚀" x={560} y={80} size={52} still={still}
        motion={{
          animate: { x: [-630, 520], y: [180, -130], rotate: 22 },
          transition: glide(9, 0.6, 2.5),
        }} />

      {/* The crew, on the peaks. */}
      <Sprite glyph={crew("space", 1, "🤖")} x={210} y={404} size={40} still={still}
        motion={{ animate: { y: [0, -9, 0] }, transition: loop(1.6) }} />
      <Sprite glyph={crew("space", 0, "👩‍🚀")} x={520} y={272} size={44} still={still}
        motion={{ animate: { rotate: [-7, 7, -7] }, transition: loop(2.4) }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Ocean
// ---------------------------------------------------------------------------

/** One wavelength; the wave layers slide by exactly this, so the loop is seamless. */
const WAVE_PERIOD = 200;

/** A full-width band of rolling water: wave crests along the top, filled to the floor. */
function wavePath(baseline: number, amplitude: number): string {
  const q = WAVE_PERIOD / 4;
  const h = WAVE_PERIOD / 2;
  let d = `M ${String(-WAVE_PERIOD)} ${String(baseline)}`;
  for (let x = -WAVE_PERIOD; x < 1000 + WAVE_PERIOD; x += WAVE_PERIOD) {
    d += ` q ${String(q)} ${String(-amplitude)} ${String(h)} 0 q ${String(q)} ${String(amplitude)} ${String(h)} 0`;
  }
  return `${d} L ${String(1000 + WAVE_PERIOD)} 625 L ${String(-WAVE_PERIOD)} 625 Z`;
}

const WAVE_FAR = wavePath(560, 10);
const WAVE_NEAR = wavePath(582, 12);

/** Three overlapping puffs, drawn once and placed twice. */
function Cloud({ x, y, scale, still, delay }: { x: number; y: number; scale: number; still: boolean; delay: number }) {
  return (
    <motion.g
      style={{ x, y, scale }}
      {...(still ? {} : { animate: { x: [x, x + 50, x] }, transition: loop(16, delay) })}
      opacity="0.9"
    >
      <circle cx={0} cy={0} r={26} fill="#ffffff" />
      <circle cx={30} cy={-8} r={32} fill="#ffffff" />
      <circle cx={64} cy={2} r={24} fill="#ffffff" />
    </motion.g>
  );
}

function OceanScene({ palette, still }: { palette: InterestPalette; still: boolean }) {
  return (
    <>
      <Cloud x={280} y={70} scale={1} still={still} delay={0} />
      <Cloud x={860} y={40} scale={0.7} still={still} delay={4} />

      {/* Rolling water; the mountain is an island now. */}
      <motion.path
        d={WAVE_FAR}
        fill={palette.ridgeFar}
        opacity="0.95"
        {...(still ? {} : { animate: { x: [0, -WAVE_PERIOD] }, transition: glide(7) })}
      />

      <Sprite glyph="🐬" x={440} y={484} size={44} flip still={still}
        motion={{
          animate: { x: [-120, 0, 120], y: [112, -14, 112], rotate: [-35, 0, 35] },
          transition: { ...loop(2.2, 1.5, 3.5), ease: "easeOut" },
        }} />

      <Sprite glyph={crew("ocean", 1, "⛵")} x={700} y={552} size={46} still={still}
        motion={{
          animate: { x: [0, 90, 0], rotate: [-3, 3, -3] },
          transition: { x: loop(18), rotate: loop(3) },
        }} />

      <Sprite glyph={crew("ocean", 2, "🐙")} x={880} y={564} size={42} still={still}
        motion={{ animate: { y: [0, -8, 0], rotate: [-6, 6, -6] }, transition: loop(2.8) }} />

      <motion.path
        d={WAVE_NEAR}
        fill={palette.piece}
        opacity="0.85"
        {...(still ? {} : { animate: { x: [-WAVE_PERIOD, 0] }, transition: glide(5) })}
      />

      {/* A whale surfacing in the near water, with a spout. */}
      <Sprite glyph="🐋" x={560} y={588} size={54} still={still}
        motion={{ animate: { y: [8, -6, 8] }, transition: loop(3.2) }} />
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          cx={548 - i * 6}
          cy={560}
          r={4 - i}
          fill="#ffffff"
          {...(still
            ? { opacity: 0.8 }
            : {
                animate: { y: [0, -34 - i * 8], opacity: [0, 0.9, 0] },
                transition: loop(3.2, 1.3 + i * 0.12),
              })}
        />
      ))}

      {/* A fish popping up now and then. */}
      <Sprite glyph="🐠" x={140} y={590} size={26} still={still}
        motion={{
          animate: { y: [0, -34, 0], rotate: [0, -20, 0] },
          transition: { ...loop(1.4, 3, 4.6), ease: "easeOut" },
        }} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Jungle
// ---------------------------------------------------------------------------

/** Fireflies: x, y, and a phase so they never pulse in step. */
const FIREFLIES: readonly { readonly x: number; readonly y: number; readonly phase: number }[] = [
  { x: 200, y: 262, phase: 0 }, { x: 420, y: 176, phase: 0.9 }, { x: 700, y: 150, phase: 1.7 },
  { x: 300, y: 380, phase: 0.4 }, { x: 860, y: 262, phase: 2.3 }, { x: 150, y: 120, phase: 1.2 },
  { x: 640, y: 420, phase: 2.9 }, { x: 960, y: 90, phase: 0.6 },
];

/** Nerdy mint: decorative, so it may be as bright as it likes. */
const FIREFLY = "#35dd8b";

/** A leaf grown from `base`, leaning by `lean`: a teardrop that sways from its stem. */
function Leaf({ base, lean, length, fill, still, delay }: {
  base: readonly [number, number];
  lean: number;
  length: number;
  fill: string;
  still: boolean;
  delay: number;
}) {
  const [bx, by] = base;
  const tipX = bx + Math.sin((lean * Math.PI) / 180) * length;
  const tipY = by - Math.cos((lean * Math.PI) / 180) * length;
  const midX = (bx + tipX) / 2;
  const midY = (by + tipY) / 2;
  const w = length * 0.34;
  const nx = Math.cos((lean * Math.PI) / 180) * w;
  const ny = Math.sin((lean * Math.PI) / 180) * w;
  const d = `M ${String(bx)} ${String(by)} Q ${String(midX - nx)} ${String(midY - ny)} ${String(tipX)} ${String(tipY)} Q ${String(midX + nx)} ${String(midY + ny)} ${String(bx)} ${String(by)} Z`;
  return (
    <motion.path
      d={d}
      fill={fill}
      style={{ originX: 0.5, originY: 1 }}
      {...(still ? {} : { animate: { rotate: [-3, 3, -3] }, transition: loop(4.2, delay) })}
    />
  );
}

/** A vine hanging from the top edge, with leaves along it and whatever is at the end. */
function Vine({ x, length, palette, still, children }: {
  x: number;
  length: number;
  palette: InterestPalette;
  still: boolean;
  children?: ReactNode;
}) {
  return (
    <motion.g
      style={{ originX: 0.5, originY: 0 }}
      {...(still ? {} : { animate: { rotate: [-4, 4, -4] }, transition: loop(3.6) })}
    >
      <path
        d={`M ${String(x)} -10 q -14 ${String(length / 2)} 0 ${String(length)}`}
        fill="none"
        stroke={palette.ridge}
        strokeWidth="5"
        strokeLinecap="round"
      />
      {[0.3, 0.55, 0.8].map((t, i) => (
        <circle
          key={t}
          cx={x - 10 + (i % 2 === 0 ? -8 : 10)}
          cy={length * t}
          r={9}
          fill={palette.piece}
        />
      ))}
      {children}
    </motion.g>
  );
}

function JungleScene({ palette, still }: { palette: InterestPalette; still: boolean }) {
  return (
    <>
      {FIREFLIES.map((f) => (
        <motion.circle
          key={`${String(f.x)}-${String(f.y)}`}
          cx={f.x}
          cy={f.y}
          r={4}
          fill={FIREFLY}
          {...(still
            ? { opacity: 0.8 }
            : {
                animate: { opacity: [0.15, 1, 0.15], scale: [0.8, 1.5, 0.8], x: [0, 10, 0], y: [0, -6, 0] },
                transition: loop(2.8, f.phase),
              })}
        />
      ))}

      <Vine x={120} length={120} palette={palette} still={still} />
      <Vine x={580} length={130} palette={palette} still={still}>
        <Sprite glyph={crew("jungle", 2, "🐒")} x={572} y={140} size={42} still />
      </Vine>
      <Vine x={950} length={70} palette={palette} still={still} />

      <Sprite glyph={crew("jungle", 1, "🦜")} x={500} y={150} size={44} still={still}
        motion={{
          animate: { x: [570, -580], y: [0, -30, 15, -20, 0] },
          transition: glide(15, 0.8, 1.5),
        }} />

      <Sprite glyph="🦋" x={420} y={232} size={26} still={still}
        motion={{
          animate: { x: [0, 40, 80, 40, 0], y: [0, -26, 0, -18, 0], rotate: [0, 12, 0, -12, 0] },
          transition: loop(7),
        }} />
      <Sprite glyph="🦋" x={740} y={424} size={22} flip still={still}
        motion={{
          animate: { x: [0, -30, -60, -30, 0], y: [0, -20, 0, -24, 0] },
          transition: loop(8, 1.5),
        }} />

      {/* The tiger cub peeks out from behind the right-hand leaves. */}
      <Sprite glyph={crew("jungle", 3, "🐯")} x={905} y={572} size={46} still={still}
        motion={{
          animate: { y: [52, 0, 0, 0, 52] },
          transition: { ...loop(5.5, 1, 2.5), times: [0, 0.2, 0.5, 0.8, 1] },
        }} />

      {/* Foliage in both bottom corners, in front of everything else. */}
      <Leaf base={[1010, 640]} lean={-34} length={200} fill={palette.ridge} still={still} delay={0.3} />
      <Leaf base={[1010, 640]} lean={-62} length={160} fill={palette.piece} still={still} delay={1.1} />
      <Leaf base={[975, 640]} lean={-12} length={130} fill={palette.piece} still={still} delay={0.7} />
      {/* The left corner's leaves are taller: the preview's label chip sits
          over that corner, and a leaf has to clear it to be seen at all. */}
      <Leaf base={[-10, 640]} lean={30} length={280} fill={palette.ridge} still={still} delay={0.5} />
      <Leaf base={[-10, 640]} lean={56} length={230} fill={palette.piece} still={still} delay={1.4} />
      <Leaf base={[30, 640]} lean={10} length={200} fill={palette.piece} still={still} delay={0.9} />
    </>
  );
}

// ---------------------------------------------------------------------------

const SCENES: Record<InterestTheme, (props: { palette: InterestPalette; still: boolean }) => JSX.Element> = {
  space: SpaceScene,
  ocean: OceanScene,
  jungle: JungleScene,
};

/**
 * The living layer over the mountain for the chosen world, or nothing until
 * one is chosen. Worlds cross-fade when the pick changes.
 */
export function WorldScenery({ theme }: { theme: InterestTheme | null }) {
  const still = useReducedMotion() === true;
  return (
    <svg
      viewBox="0 0 1000 625"
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden
      data-scenery={theme ?? "none"}
    >
      <AnimatePresence initial={false}>
        {theme !== null && (
          <motion.g
            key={theme}
            {...(still
              ? {}
              : {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  exit: { opacity: 0 },
                  transition: { duration: 0.45 },
                })}
          >
            <Scene theme={theme} still={still} />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

function Scene({ theme, still }: { theme: InterestTheme; still: boolean }) {
  const Picked = SCENES[theme];
  return <Picked palette={INTEREST_PALETTES[theme]} still={still} />;
}
