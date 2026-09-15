import type { PlaceUnit } from "@/lib/domain/grouping";

/**
 * Pixel size of one unit cube. Every block is drawn from this, so the blocks
 * stay true to scale: a rod is ten cubes long, a flat is ten rods wide, and a
 * child who counts the divisions gets the number the block is worth.
 */
const CELL = 6;

/** Hairline divisions marking each unit cube. White, so they read on the
 * saturated block whatever the interest theme. */
function divisions(axis: "to right" | "to bottom"): string {
  return `repeating-linear-gradient(${axis}, rgba(255,255,255,0.75) 0 1px, transparent 1px ${String(CELL)}px)`;
}

interface Base10BlockProps {
  readonly unit: PlaceUnit;
  readonly color: string;
}

export function Base10Block({ unit, color }: Base10BlockProps) {
  const flat = `${divisions("to right")}, ${divisions("to bottom")}`;

  switch (unit) {
    case 1:
      return (
        <span
          className="block rounded-[1px]"
          style={{ width: CELL, height: CELL, backgroundColor: color }}
          aria-hidden
        />
      );
    case 10:
      // A rod: one cube wide, ten tall.
      return (
        <span
          className="block rounded-[1px]"
          style={{
            width: CELL,
            height: CELL * 10,
            backgroundColor: color,
            backgroundImage: divisions("to bottom"),
          }}
          aria-hidden
        />
      );
    case 100:
      // A flat: ten by ten.
      return (
        <span
          className="block rounded-[2px]"
          style={{
            width: CELL * 10,
            height: CELL * 10,
            backgroundColor: color,
            backgroundImage: flat,
          }}
          aria-hidden
        />
      );
    case 1000:
      // A cube: a flat, with a second face offset behind it for depth.
      return (
        <span
          className="relative block"
          style={{ width: CELL * 12, height: CELL * 12 }}
          aria-hidden
        >
          <span
            className="absolute right-0 top-0 rounded-[2px] opacity-45"
            style={{ width: CELL * 10, height: CELL * 10, backgroundColor: color }}
          />
          <span
            className="absolute bottom-0 left-0 rounded-[2px]"
            style={{
              width: CELL * 10,
              height: CELL * 10,
              backgroundColor: color,
              backgroundImage: flat,
            }}
          />
        </span>
      );
  }
}
