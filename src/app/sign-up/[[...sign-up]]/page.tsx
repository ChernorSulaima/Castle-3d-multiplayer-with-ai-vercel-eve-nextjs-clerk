import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Sign up" };

/**
 * The catch-all is required twice over (clerk-setup.md §8.1/§8.5): the dev-mode
 * probe fetch, and the progressive username step — a Google/GitHub sign-up
 * returns with `missingFields: ["username"]` and clerk-js navigates to
 * `/sign-up/continue`, which must resolve to this same page (FR-2).
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10">
      <SignUp />
    </div>
  );
}
