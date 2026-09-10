// src/app/page.tsx  [U1]
// `/` — public (§G), and the whole of UI_REDESIGN §3. A server component: only the
// pieces that need the client (the hero board, the auth-aware CTA, the two Convex
// queries) are client components, so the copy, the mode cards and the footer are in
// the first HTML response.
import type { Metadata } from "next";
import { Hero } from "@/components/landing/hero";
import { HeroBodyFlag } from "@/components/landing/hero-body-flag";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LiveNow } from "@/components/landing/live-now";
import { Modes } from "@/components/landing/modes";
import { Opponents } from "@/components/landing/opponents";

export const metadata: Metadata = {
  description:
    "Sit at a real 3D board in a room you chose. Rated matchmaking, five AI opponents with opinions, and pass-and-play on one device.",
};

export default function HomePage() {
  return (
    // 15px base on marketing pages (§1.2).
    <div className="flex flex-col text-[15px]">
      <HeroBodyFlag />
      <Hero />
      <Modes />
      <Opponents />
      <LiveNow />
      <LandingFooter />
    </div>
  );
}
