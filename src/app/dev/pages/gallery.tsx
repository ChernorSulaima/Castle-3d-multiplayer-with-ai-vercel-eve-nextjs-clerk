"use client";
// src/app/dev/pages/gallery.tsx  [U4]
// The presentational halves of /play, /leaderboard, /profile and /settings with
// fixed data, so they can be reviewed (and screenshotted at 1440x900 and
// 390x844) without a Clerk session. Every component below is the SAME one the
// real page renders — only the data source is faked.
import { useState } from "react";
import { BotIcon, UsersIcon } from "lucide-react";
import { AiSetup } from "@/components/play/ai-setup";
import { LocalSetup } from "@/components/play/local-setup";
import { QueuePanelView } from "@/components/play/find-match-panel";
import { SpectateGridView, type SpectateGame } from "@/components/play/spectate-list";
import {
  LeaderboardBody,
  type LeaderboardRow,
} from "@/components/leaderboard/leaderboard-table";
import { LeaderboardFilters } from "@/components/leaderboard/leaderboard-filters";
import { ProfileHeaderView } from "@/components/profile/profile-header";
import { RatingSparklineView } from "@/components/profile/rating-sparkline";
import { RecentGamesView, type RecentGame } from "@/components/profile/recent-games-table";
import { SettingsForm } from "@/components/settings/settings-form";
import { SettingsPreview } from "@/components/settings/settings-preview";
import { Display, Eyebrow, ModeCard, Section } from "@/components/ui-kit";
import { Tabs } from "@/components/ui/tabs";
import type { RatingPool } from "@/lib/types";
import type { SectionId } from "./sections";

/* ------------------------------------------------------------------- fixtures */

const OPENING = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2";
const ITALIAN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";
const OPERA_MATE = "1n1Rkb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2K5 b k - 1 17";
const SCHOLARS = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";
const ENDGAME = "8/5pk1/6p1/8/8/6P1/5PK1/8 w - - 0 42";

const LIVE_GAMES: SpectateGame[] = [
  { _id: "g1", whiteName: "ada", blackName: "viktor", whiteRating: 1482, blackRating: 1519, moveCount: 24, spectatorCount: 3 },
  { _id: "g2", whiteName: "marco", blackName: "pip", whiteRating: 1104, blackRating: 986, moveCount: 8, spectatorCount: 0 },
  { _id: "g3", whiteName: "kasparova", blackName: "morphy", whiteRating: 2287, blackRating: 2190, moveCount: 41, spectatorCount: 17 },
];

const LIVE_POSITIONS: Record<string, string> = {
  g1: ITALIAN,
  g2: OPENING,
  g3: ENDGAME,
};

const LEADERBOARD_ROWS: LeaderboardRow[] = [
  { rank: 1, playerId: "p1", username: "kasparova", avatarUrl: "", rating: 2287, wins: 91, losses: 14, draws: 9 },
  { rank: 2, playerId: "p2", username: "morphy", avatarUrl: "", rating: 2190, wins: 74, losses: 21, draws: 5 },
  { rank: 3, playerId: "p3", username: "viktor", avatarUrl: "", rating: 1841, wins: 58, losses: 30, draws: 12 },
  { rank: 4, playerId: "p4", username: "ada", avatarUrl: "", rating: 1482, wins: 34, losses: 28, draws: 6 },
  { rank: 5, playerId: "p5", username: "marco", avatarUrl: "", rating: 1104, wins: 19, losses: 24, draws: 3 },
  { rank: 6, playerId: "p6", username: "pip", avatarUrl: "", rating: 986, wins: 4, losses: 17, draws: 1 },
];

const PROFILE = {
  username: "ada",
  avatarUrl: "",
  rating: 1482,
  ratingHuman: 1519,
  ratingAi: 1401,
  wins: 34,
  losses: 28,
  draws: 6,
  createdAt: Date.UTC(2026, 1, 14),
};

const RATING_SERIES = [
  1200, 1216, 1204, 1231, 1248, 1240, 1272, 1291, 1284, 1310, 1345, 1338, 1372, 1401, 1394,
  1428, 1455, 1447, 1470, 1482,
];

const RECENT: RecentGame[] = [
  { _id: "r1", mode: "online", status: "checkmate", winner: "w", opponentName: "viktor", myColour: "w", moveCount: 34, undoCount: 0, rated: true, createdAt: Date.UTC(2026, 8, 9) },
  { _id: "r2", mode: "ai", difficulty: "grandmaster", status: "resigned", winner: "w", opponentName: "Kasparova", myColour: "b", moveCount: 51, undoCount: 2, rated: false, createdAt: Date.UTC(2026, 8, 8) },
  { _id: "r3", mode: "online", status: "draw", winner: "draw", opponentName: "marco", myColour: "b", moveCount: 78, undoCount: 0, rated: true, createdAt: Date.UTC(2026, 8, 7) },
  { _id: "r4", mode: "local", status: "active", opponentName: "Player 2", myColour: "w", moveCount: 12, undoCount: 0, rated: false, createdAt: Date.UTC(2026, 8, 6) },
];

const RECENT_POSITIONS: Record<string, string> = {
  r1: OPERA_MATE,
  r2: SCHOLARS,
  r3: ENDGAME,
  r4: ITALIAN,
};

const NOOP = () => {};

/* ---------------------------------------------------------------------- shell */

function Slice({
  id,
  eyebrow,
  title,
  only,
  children,
}: {
  id: SectionId;
  eyebrow: string;
  title: string;
  only: SectionId | null;
  children: React.ReactNode;
}) {
  if (only !== null && only !== id) return null;
  return (
    <Section width="app" padding="md" id={id} className="border-t border-border first:border-t-0">
      <header className="mb-6 grid gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Display level={3} as="h2">{title}</Display>
      </header>
      {children}
    </Section>
  );
}

export function PagesGallery({ only = null }: { only?: SectionId | null }) {
  const [pool, setPool] = useState<RatingPool | "all">("all");

  return (
    <div className="pb-24">
      {only === null ? (
        <Section width="app" padding="sm">
          <Eyebrow>Development harness</Eyebrow>
          <p className="mt-2 max-w-prose text-[15px] text-muted-foreground">
            The presentational halves of the signed-in pages, with fixed data. Buttons here start
            nothing — the containers that own the Convex mutations are not mounted.
          </p>
        </Section>
      ) : null}

      <Slice only={only} id="play" eyebrow="Choose a mode" title="Play">
        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <QueuePanelView elapsedMs={47_000} range={400} myRating={1482} onCancel={NOOP} onPlayAi={NOOP} />

          <ModeCard
            title="Play the AI"
            icon={BotIcon}
            description="Five opponents from Beginner to Grandmaster. Each one explains its moves."
          >
            <AiSetup onStart={NOOP} />
          </ModeCard>

          <ModeCard
            title="Pass and play"
            icon={UsersIcon}
            description="Two people, one device. The board turns to face whoever is to move."
          >
            <LocalSetup onStart={NOOP} />
          </ModeCard>
        </div>

        <section className="mt-10 grid gap-4">
          <Eyebrow as="span">Live now</Eyebrow>
          <SpectateGridView games={LIVE_GAMES} positions={LIVE_POSITIONS} />
        </section>

        <section className="mt-10 grid gap-4">
          <Eyebrow as="span">Live now · empty state</Eyebrow>
          <SpectateGridView games={[]} />
        </section>
      </Slice>

      <Slice only={only} id="leaderboard" eyebrow="Rated players" title="Leaderboard">
        <Tabs defaultValue="all" className="gap-5">
          <LeaderboardFilters />
        </Tabs>
        <div className="mt-5">
          <LeaderboardBody rows={LEADERBOARD_ROWS} />
        </div>
        <div className="mt-10 grid gap-4">
          <Eyebrow as="span">Empty state</Eyebrow>
          <LeaderboardBody rows={[]} />
        </div>
      </Slice>

      <Slice only={only} id="profile" eyebrow="Player" title="Profile">
        <div className="grid gap-6">
          <ProfileHeaderView profile={PROFILE} />
          <RatingSparklineView
            pool={pool}
            onPoolChange={setPool}
            values={RATING_SERIES}
            gameCount={RATING_SERIES.length - 1}
          />
          <section aria-label="Recent games" className="grid gap-3">
            <h2 className="eyebrow">Recent games</h2>
            <RecentGamesView games={RECENT} positions={RECENT_POSITIONS} />
          </section>
        </div>
      </Slice>

      <Slice only={only} id="settings" eyebrow="Your setup" title="Settings">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0">
            {/* A stub writer: the real page hands `SettingsForm` the one debounced
                `players.updateSettings` writer. Every control still drives the
                ui-store, so the preview beside it reacts exactly as it will live. */}
            <SettingsForm save={NOOP} />
          </div>
          <SettingsPreview className="order-first lg:sticky lg:top-20 lg:order-none" />
        </div>
      </Slice>
    </div>
  );
}
