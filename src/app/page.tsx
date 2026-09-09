import { Hero } from "@/components/landing/hero";
import { LiveTicker } from "@/components/landing/live-ticker";

/** `/` — public (§G). Guests see the hero, the CTA and the live ticker. */
export default function HomePage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <LiveTicker />
    </div>
  );
}
