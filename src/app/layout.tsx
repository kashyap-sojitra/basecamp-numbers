import type { Metadata } from "next";
import { ViewTransition } from "react";
import { Karla } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ClickSparkles } from "@/components/effects/ClickSparkles";
import { CursorGlow } from "@/components/effects/CursorGlow";
import "./globals.css";

// Karla is Nerdy's brand face.
const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Basecamp Numbers",
  description: "Climb the mountain, one number at a time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${karla.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-page text-ink">
        <CursorGlow />
        {/*
          Every navigation slides: deeper into the mountain goes one way, back
          out goes the other. Links say which by passing `transitionTypes`.
        */}
        <ViewTransition
          enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade-through" }}
          exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "fade-through" }}
          default="none"
        >
          <div className="flex min-h-full flex-1 flex-col">{children}</div>
        </ViewTransition>
        <ClickSparkles />
        {/*
          Vercel Web Analytics: page views and Web Vitals, cookieless and
          anonymous, so it fits "nothing stored that could identify a child".
          It only does anything on a Vercel deployment with analytics enabled;
          elsewhere it renders nothing.
        */}
        <Analytics />
      </body>
    </html>
  );
}
