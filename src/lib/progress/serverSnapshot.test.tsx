import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { useToday } from "./useToday";
import { useFreshBadges, writeSeenBadges } from "./seenBadges";
import { localDateSchema, todayLocalDate } from "@/lib/domain/localDate";
import type { BadgeId } from "@/lib/domain/badges";

/**
 * These hooks read browser-only state through `useSyncExternalStore`, which
 * means each one has a *server* snapshot that only runs when there is no
 * browser. Rendering them on the server is the only way to exercise it — and
 * the whole point is that the server's markup is the calm one, with the client
 * correcting it on hydration.
 */

const SERVER_DAY = localDateSchema.parse("2026-09-11");

function Today() {
  return <p>{useToday(SERVER_DAY)}</p>;
}

function Fresh({ earned }: { readonly earned: readonly BadgeId[] }) {
  return <p>{useFreshBadges(earned).join(",") || "none"}</p>;
}

describe("useToday on the server", () => {
  it("renders the day the server was given, since it cannot know the timezone", () => {
    expect(renderToString(<Today />)).toContain(SERVER_DAY);
  });

  it("does not reach for the browser's clock", () => {
    const html = renderToString(<Today />);
    if (todayLocalDate() !== SERVER_DAY) {
      expect(html).not.toContain(todayLocalDate());
    }
  });
});

describe("useFreshBadges on the server", () => {
  it("marks nothing as new, so the first paint is calm", () => {
    expect(renderToString(<Fresh earned={["first-climb", "summit"]} />)).toContain("none");
  });

  it("marks nothing as new even when storage says otherwise", () => {
    // The server has no access to this at all; the client corrects it after.
    writeSeenBadges(JSON.stringify([]));
    expect(renderToString(<Fresh earned={["first-climb"]} />)).toContain("none");
  });
});
