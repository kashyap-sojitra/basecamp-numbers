"use client";

import { useSyncExternalStore } from "react";
import { todayLocalDate, type LocalDate } from "@/lib/domain/localDate";

/** A calendar day does not change while a page is open, so nothing to watch. */
const subscribeToNothing = () => () => {
  // no-op
};

/**
 * Today in the child's own timezone.
 *
 * Read as external state rather than computed during render: the server has no
 * way to know the browser's timezone, so it renders its own day and the client
 * corrects it on hydration without a mismatch. Every streak reading goes
 * through here so the whole screen agrees on what day it is.
 */
export function useToday(serverToday: LocalDate): LocalDate {
  return useSyncExternalStore(
    subscribeToNothing,
    () => todayLocalDate(),
    () => serverToday,
  );
}
