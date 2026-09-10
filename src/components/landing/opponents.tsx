// src/components/landing/opponents.tsx  [U1]
// "Meet the opponents" (§3): the five personas of agent/instructions.md, each with
// one line in their own voice rendered as a chat bubble. The names, blurbs,
// difficulty labels and ratings come from DIFFICULTIES so the landing page can
// never drift from the opponent a visitor actually gets; only the sample lines are
// written here (§3: "write 5 short, in-character lines … under 90 characters").
import { Display, Eyebrow, PersonaCard, Reveal, Section } from "@/components/ui-kit";
import { DIFFICULTIES, DIFFICULTY_ORDER } from "@/lib/difficulty";
import type { Difficulty } from "@/lib/types";

/** One line each, in character, all under 90 characters. */
const SAMPLE_LINE: Record<Difficulty, string> = {
  beginner: "I nearly moved my queen out there. Glad I did not — your knight looks mean.",
  casual: "Coffee first, then castling. That is the correct order, my friend.",
  intermediate: "Your knight has nowhere to go now. The pin is doing all the work.",
  advanced: "Your bishop is a spectator. Mine is not.",
  grandmaster: "You had one move. That was not it.",
};

export function Opponents() {
  return (
    <Section id="opponents" padding="lg" className="scroll-mt-20">
      <Eyebrow>Meet the opponents</Eyebrow>
      <Display level={3} as="h2" className="mt-2">
        Five opponents, five opinions.
      </Display>
      <p className="mt-3 max-w-[60ch] text-[15px] text-muted-foreground">
        Every AI game comes with a voice. They pick their move, then tell you what they think of
        yours.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {DIFFICULTY_ORDER.map((id, index) => {
          const config = DIFFICULTIES[id];
          return (
            <Reveal key={id} delayIndex={index} className="h-full">
              <PersonaCard
                className="h-full"
                name={config.persona.name}
                difficulty={config.label}
                rating={config.aiRating}
                blurb={config.persona.blurb}
                sample={SAMPLE_LINE[id]}
              />
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
