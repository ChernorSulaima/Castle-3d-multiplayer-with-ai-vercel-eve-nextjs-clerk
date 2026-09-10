import { Suspense } from "react";
import type { Metadata } from "next";
import { ModePicker } from "@/components/play/mode-picker";
import { Display, Eyebrow, Section } from "@/components/ui-kit";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Play" };

export default function PlayPage() {
  return (
    <Section width="app" padding="md" className="pt-8 sm:pt-10">
      <header className="mb-8 grid gap-2">
        <Eyebrow>Choose a mode</Eyebrow>
        <Display level={3} as="h1">Play</Display>
      </header>

      {/* `ModePicker` reads `?mode=` with useSearchParams, which needs a boundary. */}
      <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
        <ModePicker />
      </Suspense>
    </Section>
  );
}
