import { describe, expect, it } from "vitest";
import { createRng, hashSeed } from "./rng";

describe("createRng", () => {
  it("gives the same sequence for the same seed", () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const first = Array.from({ length: 50 }, () => a.int(0, 1000));
    const second = Array.from({ length: 50 }, () => b.int(0, 1000));
    expect(first).toEqual(second);
  });

  it("gives different sequences for different seeds", () => {
    const a = Array.from({ length: 20 }, (() => {
      const rng = createRng(1);
      return () => rng.int(0, 1_000_000);
    })());
    const b = Array.from({ length: 20 }, (() => {
      const rng = createRng(2);
      return () => rng.int(0, 1_000_000);
    })());
    expect(a).not.toEqual(b);
  });

  it("stays inside the bounds it is given, inclusive", () => {
    const rng = createRng(99);
    for (let i = 0; i < 20_000; i += 1) {
      const value = rng.int(3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("reaches both ends of a small range", () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) seen.add(rng.int(0, 2));
    expect(seen).toEqual(new Set([0, 1, 2]));
  });

  it("handles a single-value range", () => {
    const rng = createRng(5);
    for (let i = 0; i < 100; i += 1) expect(rng.int(4, 4)).toBe(4);
  });

  it("spreads roughly evenly over a range", () => {
    const rng = createRng(2024);
    const counts = new Map<number, number>();
    const draws = 60_000;
    for (let i = 0; i < draws; i += 1) {
      const value = rng.int(1, 6);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    for (const face of [1, 2, 3, 4, 5, 6]) {
      const share = (counts.get(face) ?? 0) / draws;
      // A fair-enough die: no face under 14% or over 20% of 60k draws.
      expect(share).toBeGreaterThan(0.14);
      expect(share).toBeLessThan(0.2);
    }
  });

  it("picks only from the list it is given, and reaches every entry", () => {
    const rng = createRng(31);
    const items = ["a", "b", "c"] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(rng.pick(items));
    expect(seen).toEqual(new Set(items));
  });

  it("picks the only entry from a one-item list", () => {
    const rng = createRng(11);
    expect(rng.pick(["only"] as const)).toBe("only");
  });

  it("survives a negative or huge seed", () => {
    for (const seed of [-1, -99999, 2 ** 31, Number.MAX_SAFE_INTEGER]) {
      const rng = createRng(seed);
      const value = rng.int(0, 10);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(10);
    }
  });
});

describe("hashSeed", () => {
  it("is stable for the same text", () => {
    expect(hashSeed("number-line:k-1:2:0")).toBe(hashSeed("number-line:k-1:2:0"));
  });

  it("gives different seeds for texts differing by one character", () => {
    expect(hashSeed("camp:1")).not.toBe(hashSeed("camp:2"));
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
  });

  it("returns an unsigned 32-bit integer", () => {
    for (const text of ["", "a", "a much longer seed string with spaces", "🚀"]) {
      const seed = hashSeed(text);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });

  it("rarely collides across the seeds the app actually uses", () => {
    const seeds = new Set<number>();
    let count = 0;
    for (const skill of ["within-place", "cross-place"]) {
      for (const band of ["k-1", "2-3", "4-5"]) {
        for (let level = 1; level <= 5; level += 1) {
          for (let index = 0; index < 200; index += 1) {
            seeds.add(hashSeed(`number-line:${skill}:${band}:${String(level)}:${String(index)}:0`));
            count += 1;
          }
        }
      }
    }
    expect(seeds.size).toBe(count);
  });
});
