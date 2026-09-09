import { HeroActions } from "@/components/nav/auth-nav";
import { ROOM_ORDER, ROOMS } from "@/lib/rooms";
import { DIFFICULTIES, DIFFICULTY_ORDER } from "@/lib/difficulty";

const FEATURES = [
  {
    title: "Real 3D board",
    body: "Reflective surfaces, HDRI lighting and orbit-pan-zoom controls — with an instant 2D fallback whenever you want it.",
  },
  {
    title: "Rated matchmaking",
    body: "Queue up and get paired with someone near your rating. The window widens every ten seconds until you are matched.",
  },
  {
    title: "An AI that talks back",
    body: "Stockfish picks the candidates; a persona picks the move and tells you why. Five difficulties, five personalities.",
  },
];

export function Hero() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-12 pb-8 sm:px-6 sm:pt-20 sm:pb-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          Play · Learn · Climb
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Chess, in three dimensions.
        </h1>
        <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
          Real-time matchmaking, an AI opponent with an opinion, pass-and-play on one device, and a
          board you can actually look around. Free, and it runs in your browser.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <HeroActions />
        </div>
      </div>

      <dl className="mt-12 grid gap-6 sm:mt-16 sm:grid-cols-3 sm:gap-8">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="border-t border-border pt-4">
            <dt className="text-sm font-semibold">{feature.title}</dt>
            <dd className="mt-1.5 text-sm text-muted-foreground">{feature.body}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">Five rooms</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {ROOM_ORDER.map((id) => (
              <li
                key={id}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                {ROOMS[id].label}
              </li>
            ))}
            <li className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              Custom colours
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Five opponents</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {DIFFICULTY_ORDER.map((id) => (
              <li
                key={id}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                {DIFFICULTIES[id].persona.name}
                <span className="text-muted-foreground/60"> · {DIFFICULTIES[id].aiRating}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
