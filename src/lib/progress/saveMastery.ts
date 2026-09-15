"use client";

import { useEffect, useRef } from "react";
import type { CampNumber, Mastery } from "@/lib/domain/camp";
import { todayLocalDate } from "@/lib/domain/localDate";
import { API } from "@/lib/routes";

/**
 * Reports one solved problem. Failures are logged and swallowed: a child
 * mid-climb should never see a network error, and the next solve tries again.
 *
 * The local date travels with the solve because the streak has to break at the
 * child's midnight, not at UTC's. The resulting meter does **not** travel with
 * it: the server works that out, so the number cannot be dictated from here.
 */
async function postSolve(camp: CampNumber, clean: boolean): Promise<void> {
  try {
    const response = await fetch(API.learner, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ camp, clean, localDate: todayLocalDate() }),
    });
    if (!response.ok) console.error("[progress] solve not recorded:", response.status);
  } catch (error) {
    console.error("[progress] solve not recorded:", error);
  }
}

/**
 * Reports every problem solved in this camp. Keyed on the solve *count*, not
 * on mastery: a full meter stops changing while the child keeps solving, and
 * those solves are exactly what make the other camps go stale.
 */
export function useRecordSolves(
  camp: CampNumber,
  solved: number,
  mastery: Mastery,
  cleanSolves: number,
): void {
  const lastReported = useRef(0);
  const lastClean = useRef(0);

  useEffect(() => {
    // The solve count is the trigger; a mastery change on its own re-runs this
    // and falls straight out, so nothing is ever reported twice.
    if (solved <= lastReported.current) return;
    lastReported.current = solved;
    // The clean count rising on the same step is what makes this solve clean.
    const clean = cleanSolves > lastClean.current;
    lastClean.current = cleanSolves;
    void postSolve(camp, clean);
  }, [camp, solved, mastery, cleanSolves]);
}
