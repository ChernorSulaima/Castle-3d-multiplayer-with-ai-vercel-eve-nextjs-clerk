"use client";

import Link from "next/link";
import { UserButton, useAuth } from "@clerk/nextjs";
import { NavLinks, NAV_LINKS, PUBLIC_NAV_LINKS } from "@/components/nav/nav-links";
import { buttonVariants } from "@/components/ui/button";

/**
 * Client-side auth-aware header parts.
 *
 * Why client-side (and not the server `<Show>`): calling `auth()` in the root layout
 * (1) forces every route — including `/`, `/leaderboard` and the not-found page — to
 * render dynamically, and (2) throws "Clerk can't detect clerkMiddleware()" whenever
 * a static-extension URL (e.g. `/favicon.png`) 404s, because the proxy matcher
 * deliberately skips those paths. `useAuth()` reads Clerk's client state instead;
 * the header reserves its width until Clerk loads so nothing jumps.
 *
 * Why `prefetch={false}` on the two auth links: `/sign-in` and `/sign-up` are optional
 * catch-all routes (`[[...sign-in]]`, required by Clerk). On Vercel with Next 16.3 the
 * router's segment-tree prefetch for those routes comes back with the catch-all param
 * replaced by the internal `…segments/_tree.segment.rsc` path, the client rejects the
 * mismatched tree and immediately re-prefetches — ~4 requests/second per visible link
 * until it gives up (measured: 280+ requests in 12 s on one page view). The routes are
 * dynamic anyway, so there is nothing useful to prefetch.
 */
export function AuthNavLinks() {
  const { isLoaded, isSignedIn } = useAuth();
  return <NavLinks links={isLoaded && isSignedIn ? NAV_LINKS : PUBLIC_NAV_LINKS} />;
}

export function AuthActions() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    // Same footprint as the two buttons so the header does not shift on hydration.
    return <div aria-hidden className="h-8 w-[8.25rem]" />;
  }

  if (isSignedIn) {
    return <UserButton />;
  }

  return (
    <>
      <Link
        href="/sign-in"
        prefetch={false}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        Sign in
      </Link>
      <Link href="/sign-up" prefetch={false} className={buttonVariants({ size: "sm" })}>
        Sign up
      </Link>
    </>
  );
}

/** Landing-page call to action; same reasoning as `AuthActions`. */
export function HeroActions() {
  const { isLoaded, isSignedIn } = useAuth();

  if (isLoaded && isSignedIn) {
    return (
      <>
        <Link href="/play" className={buttonVariants({ size: "lg" })}>
          Play now
        </Link>
        <Link href="/leaderboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Leaderboard
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/sign-up" prefetch={false} className={buttonVariants({ size: "lg" })}>
        Create an account
      </Link>
      <Link
        href="/sign-in"
        prefetch={false}
        className={buttonVariants({ variant: "outline", size: "lg" })}
      >
        Sign in
      </Link>
    </>
  );
}
