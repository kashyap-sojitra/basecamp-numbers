"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Speech support never changes during a page's life, so there is nothing to
 * subscribe to. */
const subscribeToNothing = () => () => {
  // no-op
};

function hasSpeech(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

interface ReadAloudButtonProps {
  /** The words to speak, already assembled by the caller. */
  readonly text: string;
  /** Slower for the youngest readers. */
  readonly rate?: number;
}

/**
 * Reads the problem aloud with the Web Speech API. Shown for K-1, where
 * reading the words is a barrier to doing the maths.
 *
 * Renders nothing until it knows the browser can speak — checking that during
 * render would disagree with the server, and offering a button that does
 * nothing is worse than offering none.
 */
export function ReadAloudButton({ text, rate = 0.85 }: ReadAloudButtonProps) {
  const reduced = useReducedMotion();
  const [speaking, setSpeaking] = useState(false);
  // A browser capability, read the way external state should be: false on the
  // server, the real answer on the client, and no hydration mismatch.
  const supported = useSyncExternalStore(subscribeToNothing, hasSpeech, () => false);

  // Never leave a voice talking over the next screen.
  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  if (!supported) return null;

  function speak() {
    const synth = window.speechSynthesis;
    // Tapping again stops it, which is what a child expects.
    if (synth.speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = 1.05;
    utterance.onend = () => { setSpeaking(false); };
    utterance.onerror = () => { setSpeaking(false); };
    setSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <motion.button
      type="button"
      onClick={speak}
      aria-label={speaking ? "Stop reading" : "Read the problem aloud"}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-surface text-xl text-brand-deep shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      animate={
        speaking && reduced !== true ? { scale: [1, 1.12, 1] } : { scale: 1 }
      }
      transition={{ duration: 1, repeat: speaking ? Infinity : 0, ease: "easeInOut" }}
    >
      <span aria-hidden>{speaking ? "◼" : "🔊"}</span>
    </motion.button>
  );
}
