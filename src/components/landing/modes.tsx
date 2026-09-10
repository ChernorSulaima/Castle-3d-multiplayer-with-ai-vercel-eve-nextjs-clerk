// src/components/landing/modes.tsx  [U1]
// "Play your way" (§3): three cards, each describing what the app really does and
// each deep-linking into /play. Server component — nothing here needs the client.
import Link from "next/link";
import { Bot, Swords, Users } from "lucide-react";
import { Display, Eyebrow, ModeCard, Reveal, Section } from "@/components/ui-kit";
import { buttonVariants } from "@/components/ui/button";
import { MAX_HINTS_PER_GAME, QUEUE_BASE_RANGE, QUEUE_WIDEN_INTERVAL_MS } from "@/lib/constants";
import { cn } from "@/lib/ui";

const MODES = [
  {
    href: "/play?mode=online",
    cta: "Find a match",
    title: "Find a match",
    icon: Swords,
    description: `Rated games against people within ±${QUEUE_BASE_RANGE} of your rating; the window widens every ${QUEUE_WIDEN_INTERVAL_MS / 1000} seconds.`,
    details: [
      "Your rating moves the moment the game ends.",
      "Anyone can watch a game in progress.",
    ],
  },
  {
    href: "/play?mode=ai",
    cta: "Play the AI",
    title: "Play the AI",
    icon: Bot,
    description: "Five opponents from Beginner to Grandmaster. Each one explains its moves.",
    details: [
      "Stockfish finds the candidates; the persona picks one and talks about it.",
      `${MAX_HINTS_PER_GAME} hints a game against Beginner and Casual.`,
    ],
  },
  {
    href: "/play?mode=local",
    cta: "Pass and play",
    title: "Pass and play",
    icon: Users,
    description: "Two people, one device. The board turns to face whoever is to move.",
    details: [
      "Take backs whenever you both agree.",
      "Nothing is rated — it is a board on a table.",
    ],
  },
] as const;

export function Modes() {
  return (
    <Section id="modes" padding="lg" className="scroll-mt-20">
      <Eyebrow>Play your way</Eyebrow>
      <Display level={3} as="h2" className="mt-2">
        Three ways to start.
      </Display>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {MODES.map((mode, index) => (
          <Reveal key={mode.href} delayIndex={index} className="h-full">
            <ModeCard
              title={mode.title}
              description={mode.description}
              icon={mode.icon}
              details={[...mode.details]}
              action={
                <Link
                  prefetch={false}
                  href={mode.href}
                  className={cn(buttonVariants({ size: "lg" }), "h-10 w-full px-4")}
                >
                  {mode.cta}
                </Link>
              }
            />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
