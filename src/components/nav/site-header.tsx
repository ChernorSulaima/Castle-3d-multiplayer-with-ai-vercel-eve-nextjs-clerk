import Link from "next/link";
import { AuthActions, AuthNavLinks } from "@/components/nav/auth-nav";

/**
 * Server component shell; everything auth-dependent lives in the client
 * `AuthNavLinks` / `AuthActions` (see auth-nav.tsx for why no `auth()` runs here).
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span aria-hidden className="text-lg leading-none">
            ♞
          </span>
          <span className="text-sm font-semibold tracking-tight sm:text-base">3D Chess</span>
        </Link>

        <div className="min-w-0 flex-1">
          <AuthNavLinks />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <AuthActions />
        </div>
      </div>
    </header>
  );
}
