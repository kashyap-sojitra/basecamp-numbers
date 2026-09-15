import type { InterestTheme } from "@/lib/domain/onboarding";

/**
 * Vibrant game-piece colours for each interest theme, drawn from the Nerdy
 * palette and tuned to sit on the light frame. The frame and chrome never
 * change; only the pieces and the mountain do.
 */
export interface InterestPalette {
  /** Sky wash behind the mountain. */
  readonly sky: string;
  /** The distant range, hazed back for depth. */
  readonly ridgeFar: string;
  /** The main mountain face. */
  readonly ridge: string;
  /** The climbing trail drawn across the mountain. */
  readonly trail: string;
  /** Vivid fill for camp markers and every game piece. */
  readonly piece: string;
  /** Text and icons that sit on top of `piece`. */
  readonly pieceInk: string;
  /** Rules and rails inside a game board, on a white card. */
  readonly line: string;
  readonly label: string;
  readonly glyph: string;
}

export const INTEREST_PALETTES: Record<InterestTheme, InterestPalette> = {
  space: {
    sky: "#efe7ff",
    ridgeFar: "#c4a5f7",
    ridge: "#5824c5",
    trail: "#ffffff",
    piece: "#a110ff",
    pieceInk: "#ffffff",
    line: "#5824c5",
    label: "Space",
    glyph: "🚀",
  },
  ocean: {
    sky: "#e6f6ff",
    ridgeFar: "#b8e6ff",
    ridge: "#1756e2",
    trail: "#ffffff",
    // Deepened from Nerdy's cyan #17e2ea, which was only 1.6:1 against the
    // white board — a tile the child cannot make out is no use.
    piece: "#1470d6",
    pieceInk: "#ffffff",
    line: "#1756e2",
    label: "Ocean",
    glyph: "🐋",
  },
  jungle: {
    sky: "#e6fbf1",
    ridgeFar: "#a7f3cf",
    ridge: "#12a566",
    trail: "#ffffff",
    // Deepened from mint #35dd8b (1.77:1 on white) for the same reason.
    piece: "#0f8452",
    pieceInk: "#ffffff",
    line: "#12a566",
    label: "Jungle",
    glyph: "🐯",
  },
};

/**
 * The mountain before a world is picked. Onboarding previews the map in the
 * chosen world's colours, and until there is one it stands in brand tints:
 * the page's own violet panel and edge for the sky and the far range, and
 * `--brand` for the face. These are the theme tokens flattened, like
 * `app/icon.svg`; change them together.
 */
export const UNPICKED_PALETTE: InterestPalette = {
  sky: "#f4f2fd",
  ridgeFar: "#d2caee",
  ridge: "#6c64c9",
  trail: "#ffffff",
  piece: "#6c64c9",
  pieceInk: "#ffffff",
  line: "#6c64c9",
  label: "Your world",
  glyph: "⛰️",
};
