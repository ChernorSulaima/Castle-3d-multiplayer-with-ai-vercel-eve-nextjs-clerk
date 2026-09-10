// src/components/landing/opponent-roster.tsx  [UI upgrade 2 §2.3]
// "Five opponents, five opinions." — a roster, not a card grid: five columns
// separated by seam hairlines, each one a lettered brass disc, a name, the
// rating in mono and one line in that opponent's own voice.
//
// The ratings rise left to right, so the discs and the faint rule under them
// climb with the strength: the row itself is the ladder. On a phone it becomes a
// snap scroller, one column and a half per screen.
import { Display, Reveal, Section } from "@/components/ui-kit";
import { MAX_HINTS_PER_GAME } from "@/lib/constants";
import { DIFFICULTIES, DIFFICULTY_ORDER } from "@/lib/difficulty";
import { cn } from "@/lib/ui";
import { SAMPLE_LINE } from "./sample-lines";

/** Each rung of the ladder, in px. Five columns → the top disc sits 32px higher. */
const RUNG = 8;

export function OpponentRoster() {
  return (
    <Section id="opponents" padding="none" className="scroll-mt-20 py-8 sm:py-12">
      <Display level={3} as="h2">
        Five opponents, five opinions.
      </Display>
      <p className="mt-3 max-w-[60ch] text-[15px] text-muted-foreground">
        Every AI game comes with a voice. They pick their move, then tell you what they think of
        yours.
      </p>

      <ul
        className={cn(
          // Phone: a snap scroller that bleeds to both edges. From `lg` it is the
          // five-column row the section is really about.
          "landing-scroller -mx-4 mt-10 flex snap-x snap-mandatory scroll-px-4 gap-0 overflow-x-auto px-4",
          "divide-x divide-border lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0",
        )}
      >
        {DIFFICULTY_ORDER.map((id, index) => {
          const config = DIFFICULTIES[id];
          const rise = index * RUNG;
          return (
            <li
              key={id}
              className="w-[68%] min-w-[11rem] shrink-0 snap-start px-4 first:pl-0 sm:w-[46%] lg:w-auto lg:min-w-0"
            >
              <Reveal delayIndex={index}>
                {/* The disc and the hairline under it both climb by one rung per
                    opponent, so the run of five reads as a ladder of strength. */}
                <div className="relative flex h-[5.5rem] items-end">
                  <div
                    aria-hidden
                    className="absolute inset-x-0 border-b border-border"
                    style={{ bottom: rise }}
                  />
                  <span
                    aria-hidden
                    className="relative grid size-12 shrink-0 place-items-center rounded-full bg-primary text-[15px] font-medium text-primary-foreground"
                    style={{ marginBottom: rise + RUNG }}
                  >
                    {config.persona.name[0]}
                  </span>
                </div>

                <h3 className="mt-4 text-[1.25rem] leading-tight font-semibold text-foreground">
                  {config.persona.name}
                </h3>
                <p className="tabular mt-1 font-mono text-[13px] text-muted-foreground">
                  {config.label} · {config.aiRating}
                </p>

                {/* The slot is kept even where there are no hints, so the five
                    sample lines start on the same line and the only thing that
                    steps down the row is the ladder itself. */}
                <div className="mt-2 h-6">
                  {config.hintsAllowed ? (
                    <p className="inline-flex items-center rounded-full border border-primary/40 px-2 py-0.5 text-[12px] font-medium text-primary">
                      {MAX_HINTS_PER_GAME} hints
                    </p>
                  ) : null}
                </div>

                {/* The opponent bubble of DESIGN.md's chat, without the lettered
                    disc — the 48px one above is already this opponent's face. */}
                <p
                  className={cn(
                    "mt-4 rounded-xl rounded-tl-sm border border-border bg-card px-3 py-2",
                    "text-[13px] leading-relaxed text-foreground",
                  )}
                >
                  {SAMPLE_LINE[id]}
                </p>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
