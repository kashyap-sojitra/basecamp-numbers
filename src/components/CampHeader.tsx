"use client";

import { ViewTransition } from "react";
import { MasteryMeter } from "@/components/MasteryMeter";
import type { CampDefinition, Mastery } from "@/lib/domain/camp";
import type { InterestPalette } from "@/lib/theme/interestTheme";

/** The chrome above any camp board: which camp, how full, and the ways out. */
export function CampHeader({
  camp,
  palette,
  title,
  subtitle,
  mastery,
  onFinish,
}: {
  readonly camp: CampDefinition;
  readonly palette: InterestPalette;
  readonly title: string;
  readonly subtitle: string;
  readonly mastery: Mastery;
  readonly onFinish: () => void;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        {/* Morphs out of the camp marker the child tapped on the map. */}
        <ViewTransition name={`camp-${String(camp.number)}`} share="camp-morph" default="none">
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-full border-[3px] border-white text-2xl font-extrabold shadow-md"
            style={{ backgroundColor: palette.piece, color: palette.pieceInk }}
          >
            {camp.number}
          </div>
        </ViewTransition>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-deep">
            Camp {camp.number} · {camp.name}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-40">
          <MasteryMeter mastery={mastery} size="lg" />
        </div>
        <button
          type="button"
          onClick={onFinish}
          className="inline-flex min-h-11 items-center rounded-full border-2 border-edge px-4 text-xs font-bold text-ink transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          Finish
        </button>
      </div>
    </header>
  );
}
