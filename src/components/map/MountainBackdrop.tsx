"use client";

import { useRef } from "react";
import { motion, useTransform } from "framer-motion";
import { usePointerParallax } from "@/lib/motion/usePointerParallax";
import type { InterestPalette } from "@/lib/theme/interestTheme";
import { BOARD_UNITS, EXTENSION_UNITS } from "@/lib/domain/mapLayout";

/** Fixed flecks — stars, bubbles or fireflies by theme. Deterministic so
 * server and client agree. */
const SPECKS: readonly { readonly x: number; readonly y: number; readonly r: number }[] = [
  { x: 80, y: 70, r: 2.5 }, { x: 190, y: 140, r: 1.8 }, { x: 300, y: 60, r: 2.2 },
  { x: 420, y: 120, r: 1.6 }, { x: 540, y: 70, r: 2.4 }, { x: 660, y: 150, r: 1.7 },
  { x: 900, y: 90, r: 2.3 }, { x: 960, y: 200, r: 1.6 }, { x: 240, y: 250, r: 1.5 },
  { x: 130, y: 200, r: 1.9 }, { x: 740, y: 60, r: 1.5 }, { x: 860, y: 240, r: 1.4 },
];

/** Flecks over the next range, for the extended board only. */
const FAR_SPECKS: readonly { readonly x: number; readonly y: number; readonly r: number }[] = [
  { x: 1080, y: 80, r: 2.2 }, { x: 1200, y: 160, r: 1.6 }, { x: 1320, y: 60, r: 2.4 },
  { x: 1450, y: 130, r: 1.7 }, { x: 1180, y: 250, r: 1.5 }, { x: 1500, y: 40, r: 1.8 },
];

/**
 * The mountain itself: sky wash, two ridges, snow cap and the climbing path.
 *
 * `extended` continues the picture to the right by `EXTENSION_UNITS`: the
 * same face comes down off the summit, rises to two more peaks — the next
 * range, where the coming-soon camps stand — and the trail goes on faintly
 * from the summit towards them. One SVG, so the gradients and the parallax
 * carry across without a seam. The onboarding preview never extends.
 */
export function MountainBackdrop({
  palette,
  extended = false,
}: {
  palette: InterestPalette;
  extended?: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const pointer = usePointerParallax(svg);

  // Layers drift by different amounts, so the mountain gains depth as the
  // pointer moves across it. Nearer layers travel further.
  const farX = useTransform(pointer.x, [-1, 1], [14, -14]);
  const farY = useTransform(pointer.y, [-1, 1], [7, -7]);
  const nearX = useTransform(pointer.x, [-1, 1], [-26, 26]);
  const nearY = useTransform(pointer.y, [-1, 1], [-11, 11]);
  const fleckX = useTransform(pointer.x, [-1, 1], [26, -26]);
  const fleckY = useTransform(pointer.y, [-1, 1], [16, -16]);

  const width = extended ? BOARD_UNITS + EXTENSION_UNITS : BOARD_UNITS;
  // The far edge of each shape: the extension's peaks, or the mountain's own
  // right-hand slope.
  const farTail = extended
    ? "L 1130 300 L 1260 400 L 1400 250 L 1520 380 L 1560 625 Z"
    : "L 1040 625 Z";
  const nearTail = extended
    ? "L 1060 420 L 1130 345 L 1230 440 L 1343 175 L 1450 300 L 1520 260 L 1560 625 Z"
    : "L 1040 625 Z";

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${String(width)} 625`}
      className="absolute inset-0 size-full"
      aria-hidden
      data-extended={extended ? "true" : "false"}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.sky} />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.ridge} />
          <stop offset="100%" stopColor={palette.ridgeFar} />
        </linearGradient>
        <linearGradient id="ridgeFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.ridgeFar} />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
      </defs>

      <rect width={width} height="625" fill="url(#sky)" />

      <motion.g style={{ x: fleckX, y: fleckY }}>
        {(extended ? [...SPECKS, ...FAR_SPECKS] : SPECKS).map((s) => (
          <circle
            key={`${String(s.x)}-${String(s.y)}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={palette.ridge}
            opacity="0.3"
          />
        ))}
      </motion.g>

      {/* Far range, drifting against the near face. */}
      <motion.path
        style={{ x: farX, y: farY }}
        d={`M -20 625 L 110 320 L 300 480 L 470 240 L 620 430 L 780 230 L 1000 420 ${farTail}`}
        fill="url(#ridgeFar)"
        opacity="0.85"
      />
      <motion.g style={{ x: nearX, y: nearY }}>
      {/* Main mountain — its summit sits under camp 4. */}
      <path
        d={`M -20 625 L 210 430 L 330 500 L 520 300 L 640 360 L 810 90 L 1000 330 ${nearTail}`}
        fill="url(#ridge)"
      />
      {/* Snow cap. */}
      <path
        d="M 762 145 L 810 90 L 866 155 L 838 142 L 812 160 L 788 138 Z"
        fill="#ffffff"
      />

      {/* The climbing path threading every camp marker. */}
      <path
        d="M 60 600 C 120 585 150 560 180 525 S 300 460 400 388 S 540 330 620 250 S 760 190 810 106"
        fill="none"
        stroke={palette.trail}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="14 16"
        opacity="0.9"
      />
      {extended && (
        /* The trail goes on from the summit, faintly: down the far side and
           up to the next range. Where the coming-soon camps stand. */
        <path
          d="M 810 106 C 900 170 980 330 1060 410 Q 1100 370 1130 345 Q 1190 400 1230 435 Q 1290 300 1343 175"
          fill="none"
          stroke={palette.trail}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray="8 16"
          opacity="0.55"
        />
      )}
      </motion.g>
    </svg>
  );
}
