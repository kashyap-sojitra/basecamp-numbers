import { describe, expect, it, vi } from "vitest";
import RootLayout, { metadata } from "./layout";

// next/font runs at build time and reaches the filesystem; the layout only
// needs the CSS variable name it returns.
vi.mock("next/font/google", () => ({
  Karla: () => ({ variable: "--font-karla" }),
}));

// Vercel's analytics component reads the router; the layout only needs to
// have placed it. The mock is a named component so the tree can be searched.
vi.mock("@vercel/analytics/next", () => ({
  Analytics: function Analytics() { return null; },
}));

/** The layout renders <html>, which cannot be mounted inside jsdom's body. */
function treeOf(): string {
  const element: unknown = RootLayout({ children: null, params: Promise.resolve({}) });
  return JSON.stringify(element, (key: string, value: unknown): unknown =>
    key === "_owner" || key === "_store" ? undefined : value,
  );
}

/** Whether an element of the given component type appears anywhere in a tree. */
function hasComponent(node: unknown, name: string): boolean {
  if (node === null || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((child) => hasComponent(child, name));
  const element = node as { type?: unknown; props?: { children?: unknown } };
  if (typeof element.type === "function" && element.type.name === name) return true;
  return hasComponent(element.props?.children, name);
}

describe("RootLayout", () => {
  it("places Vercel Web Analytics once, for every page", () => {
    const element: unknown = RootLayout({ children: null, params: Promise.resolve({}) });
    expect(hasComponent(element, "Analytics")).toBe(true);
  });

  it("declares the app's language", () => {
    expect(treeOf()).toContain('"lang":"en"');
  });

  it("loads Karla, the brand face, as a CSS variable", () => {
    expect(treeOf()).toContain("--font-karla");
  });

  it("paints the page in theme tokens rather than raw colours", () => {
    const tree = treeOf();
    expect(tree).toContain("bg-page");
    expect(tree).toContain("text-ink");
  });

  it("names the app and says what it is", () => {
    expect(metadata.title).toBe("Basecamp Numbers");
    expect(String(metadata.description).length).toBeGreaterThan(10);
  });

  it("wires up the pointer effects and the route transitions once, for every page", () => {
    const tree = treeOf();
    expect(tree).toContain("nav-forward");
    expect(tree).toContain("nav-back");
    expect(tree).toContain("fade-through");
  });
});
