import Link from "next/link";
import { ROUTES } from "@/lib/routes";

/**
 * Which page the child is on. `"none"` is a camp or a checkpoint — the bar is
 * there, but none of its destinations is where you already are.
 */
export type AppSection = "map" | "log" | "picks" | "none";

/**
 * The app's mark, drawn rather than imported so it costs no request and uses
 * the theme tokens. It is the *same lockup as the favicon* (`app/icon.svg`):
 * a brand tile with white peaks. It used to be brand peaks with a white snow
 * cap on a transparent ground — on the bar's white surface the cap vanished
 * and the mountain read as flat-topped. On a tile the cap is snow again.
 * Change the two together. It is deliberately *not* Nerdy's logo: this is not
 * one of their products, and their trademark in the product's own header
 * would say it was.
 */
function SummitMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="size-8 shrink-0">
      <rect width="32" height="32" rx="7" className="fill-brand" />
      <path d="M21.5 12.5L29 25.5H14Z" className="fill-brand-soft" />
      <path d="M11.5 6L21 25.5H2Z" className="fill-white" />
    </svg>
  );
}

interface NavItem {
  readonly href: typeof ROUTES.map | typeof ROUTES.log | typeof ROUTES.changePicks;
  readonly glyph: string;
  readonly label: string;
  readonly section: AppSection;
  /** Which way the child is travelling, so the view transition slides to match. */
  readonly direction: "nav-back" | "nav-forward";
}

/*
 * Three destinations is the whole of it. The mountain itself is the app's
 * navigation — the camps are on it — so this bar deliberately does not list
 * them, and there is no sidebar repeating the map.
 *
 * The words are plain on purpose. They were "Mountain", "Climb log" and
 * "Change picks", and testers could not tell what any of them did: a child
 * knows what "the map" is from every game they have played, "My progress" says
 * what the log holds, and "Grade & world" names exactly what the third one
 * changes. Each page's own heading uses the same words, so the destination
 * confirms the choice.
 */
const NAV_ITEMS: readonly NavItem[] = [
  { href: ROUTES.map, glyph: "🗺️", label: "Map", section: "map", direction: "nav-back" },
  { href: ROUTES.log, glyph: "🏅", label: "My progress", section: "log", direction: "nav-forward" },
  {
    href: ROUTES.changePicks,
    glyph: "⚙️",
    label: "Grade & world",
    section: "picks",
    direction: "nav-back",
  },
];

/*
 * Every destination keeps its words at every width. Glyph-only pills would fit
 * one row on a phone, and that is exactly what they cost: nobody guesses that a
 * rucksack means "change picks". So below `md` the words stay and everything
 * *else* gives way: the three destinations become equal segments of one tab
 * strip that fills the row beside the mark, the glyphs step out, and the app's
 * name is read rather than seen (`sr-only`). One row of 72px, the same as a
 * laptop's, where it used to be a brand row over a row of three loose pills.
 */
const PILL =
  "inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-1 text-center text-xs font-bold leading-tight transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand md:w-auto md:gap-2 md:px-4 md:text-sm";

interface AppBarProps {
  readonly current: AppSection;
  /**
   * Whether the other screens exist for this child yet. A first-time climber
   * has no saved mountain, so `/map` and `/log` would bounce straight back to
   * onboarding — the bar keeps its identity and drops the pills rather than
   * offering three doors that all lead here.
   */
  readonly destinations?: boolean;
}

/**
 * The bar above every screen: who the app is, and the ways between its pages.
 *
 * It sits on the camps and the checkpoint too. That costs one row of chrome
 * above the board — 72px at every width — which is worth knowing when judging
 * how much room a number line has left.
 */
export function AppBar({ current, destinations = true }: AppBarProps) {
  return (
    <header className="border-b-2 border-edge bg-surface">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-6xl items-center gap-3 px-3 py-2.5 md:gap-4 md:px-8 md:py-3"
      >
        {/* The identity, not a link: the bar's own Map pill goes there, and
            "home" is onboarding, which is not somewhere to wander back into. */}
        <p className="flex shrink-0 items-center gap-2.5">
          <SummitMark />
          {/* On a phone the strip needs the row, so the name is for screen
              readers only until `md`. A first-time climber has no strip, and
              keeps the name at every width. */}
          <span
            className={`text-sm font-extrabold tracking-tight text-ink md:text-lg ${
              destinations ? "sr-only md:not-sr-only" : ""
            }`}
          >
            Basecamp Numbers
          </span>
        </p>

        {destinations && (
          <ul className="ml-auto flex min-w-0 flex-1 items-center rounded-full bg-surface-tint p-1 md:flex-none md:gap-2 md:rounded-none md:bg-transparent md:p-0">
            {NAV_ITEMS.map((item) => (
              <li key={item.href} className="min-w-0 flex-1 md:flex-none">
                {item.section === current ? (
                  /* The page you are on is named, not offered. */
                  <span aria-current="page" className={`${PILL} bg-brand-deep text-white shadow-sm`}>
                    <span aria-hidden className="hidden md:inline">{item.glyph}</span>
                    <span>{item.label}</span>
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    transitionTypes={[item.direction]}
                    className={`${PILL} text-ink hover:text-brand-deep md:border-2 md:border-edge md:hover:border-brand-deep`}
                  >
                    <span aria-hidden className="hidden md:inline">{item.glyph}</span>
                    <span>{item.label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </nav>
    </header>
  );
}
