import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { NavLinks, NAV_LINKS, PUBLIC_NAV_LINKS } from "@/components/nav/nav-links";
import { buttonVariants } from "@/components/ui/button";

/**
 * Server component so it can use `<Show>` — in Core 3 `<SignedIn>`/`<SignedOut>`/
 * `<Protect>` throw at render, and `@clerk/nextjs` only re-exports the *server*
 * `<Show>`. The interactive parts (active-route links) are client children.
 *
 * Links are plain `<Link>`s styled with `buttonVariants(...)`, never
 * `<Button render={<a/>}/>` — Base UI's own guidance for anchor-shaped buttons.
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
          <Show when="signed-in" fallback={<NavLinks links={PUBLIC_NAV_LINKS} />}>
            <NavLinks links={NAV_LINKS} />
          </Show>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Show when="signed-out">
            <Link href="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Sign in
            </Link>
            <Link href="/sign-up" className={buttonVariants({ size: "sm" })}>
              Sign up
            </Link>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
