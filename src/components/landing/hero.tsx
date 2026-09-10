"use client";
// src/components/landing/hero.tsx  [U1]
// §3's split hero and the "Choose your room" band directly under it. They are one
// component because they share one piece of state — the room the hero board is
// sitting in — and because §1.4 wants the swap to happen while the board is still
// on screen.
//
// Everything that costs anything is gated: the replay stops when the hero scrolls
// away or the tab is hidden, the canvas pauses itself (`pauseWhenOffscreen`), and
// the quality tier drops to "low" on a phone.
import { useState } from "react";
import { Display, Eyebrow, Section } from "@/components/ui-kit";
import { DEFAULT_ROOM } from "@/lib/rooms";
import { STAGGER_MS } from "@/lib/ui";
import type { ResolvedQualityTier, RoomPresetId } from "@/lib/types";
import { HeroBoard } from "./hero-board";
import { HeroCtas } from "./hero-ctas";
import { LandingStats } from "./landing-stats";
import { NotationStrip } from "./notation-strip";
import { RoomStrip } from "./room-strip";
import { useInView, useMediaQuery } from "./use-in-view";
import { SHOWCASE_CAPTION, useShowcaseGame } from "./use-showcase-game";

/** §1.2: one italic word per headline, maximum. */
const HEADLINE: { text: string; italic?: boolean }[] = [
  { text: "Chess" },
  { text: "you" },
  { text: "can" },
  { text: "walk", italic: true },
  { text: "around." },
];

export function Hero() {
  const [room, setRoom] = useState<RoomPresetId>(DEFAULT_ROOM);
  // A little margin so the replay keeps running while the visitor reads the room
  // cards just below the fold.
  const { ref: boardRef, inView } = useInView<HTMLDivElement>("200px");
  const game = useShowcaseGame({ paused: !inView });

  // Medium everywhere, low on phones (§3). `false` until the client answers, so the
  // first mount is the cheap tier either way.
  const wide = useMediaQuery("(min-width: 768px)");
  const tier: ResolvedQualityTier = wide ? "medium" : "low";

  return (
    <>
      {/* `isolate` keeps the vignette behind the board and off the header. */}
      <section aria-labelledby="hero-heading" className="relative isolate overflow-hidden lg:-mt-14 lg:pt-14">
        <div className="mx-auto w-full max-w-[80rem] px-4 sm:px-6">
          <div className="grid items-center gap-8 pt-8 pb-10 sm:pt-10 lg:grid-cols-12 lg:gap-8 lg:pt-10 lg:pb-12">
            <div className="lg:col-span-5">
              <Eyebrow>Online 3D chess</Eyebrow>

              <Display level={1} id="hero-heading" className="mt-3">
                {HEADLINE.map((word, index) => (
                  <span key={word.text}>
                    {index > 0 ? " " : null}
                    <span
                      className="inline-block motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:fill-mode-backwards motion-safe:duration-500"
                      style={{ animationDelay: `${index * STAGGER_MS}ms` }}
                    >
                      {word.italic ? <em>{word.text}</em> : word.text}
                    </span>
                  </span>
                ))}
              </Display>

              <p className="mt-4 max-w-[46ch] text-[17px] leading-relaxed text-pretty text-muted-foreground">
                Sit at a board in a room you chose. Play people near your rating, or an AI that
                tells you what it thinks.
              </p>

              <HeroCtas className="mt-7" />
              <LandingStats className="mt-5" />
            </div>

            <div className="min-w-0 lg:col-span-7">
              {/* Reserves the board's height on desktop; the canvas itself is the
                  absolutely positioned layer below, so it can touch the top and the
                  right edge of the viewport instead of stopping at the grid. */}
              <div aria-hidden className="hidden lg:block lg:h-[min(72vh,720px)]" />
              <div
                ref={boardRef}
                // Mobile: in flow, full width. Desktop: pinned to the section's top
                // and right edges (the section sits under the transparent header),
                // starting left of the column so the mask can dissolve it toward the
                // headline. Non-interactive, so it never intercepts pointer events.
                className="relative h-[max(56vw,20rem)] w-full lg:pointer-events-none lg:absolute lg:inset-y-0 lg:right-0 lg:left-[44%] lg:h-auto lg:w-auto xl:left-[46%]"
              >
                <HeroBoard game={game} room={room} tier={tier} />
              </div>

              <div className="relative z-10">
                <NotationStrip moves={game.moves} ply={game.ply} className="mt-3 -ml-4" />
                <p className="mt-1 text-[13px] text-muted-foreground">{SHOWCASE_CAPTION}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section id="rooms" padding="md" className="scroll-mt-20">
        <Eyebrow>Choose your room</Eyebrow>
        <Display level={3} as="h2" className="mt-2">
          Pick where you sit.
        </Display>
        <p className="mt-3 max-w-[60ch] text-[15px] text-muted-foreground">
          Five rooms, each with its own light, its own squares and its own mood. Point at one and
          the board above moves into it.
        </p>

        <RoomStrip active={room} onSelect={setRoom} className="mt-6" />
      </Section>
    </>
  );
}
