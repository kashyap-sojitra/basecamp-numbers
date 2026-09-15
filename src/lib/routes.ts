import type { CampNumber } from "@/lib/domain/camp";

/**
 * Every path in the app, in one place. The dynamic ones are typed as template
 * literals rather than `string`, so they stay assignable to Next's generated
 * `Route` type and a bad path is a build error rather than a 404.
 */
export const ROUTES = {
  /** Onboarding. The map redirects here when there is no profile yet. */
  home: "/",
  /** Onboarding, reopened to change the existing picks. */
  changePicks: "/?change=1",
  map: "/map",
  log: "/log",
  camp: (camp: CampNumber) => `/camp/${String(camp)}` as `/camp/${CampNumber}`,
  checkpoint: (camp: CampNumber) =>
    `/checkpoint/${String(camp)}` as `/checkpoint/${CampNumber}`,
} as const;

/** The app's own API endpoints, as used by `fetch`. */
export const API = {
  /** POST saves the profile; PATCH records one solve. */
  learner: "/api/learner",
  /** PATCH restores a camp's meter after a passed checkpoint. */
  checkpoint: "/api/learner/checkpoint",
  /** POST asks for word-problem framing, encouragement or a summary line. */
  coach: "/api/coach",
} as const;
