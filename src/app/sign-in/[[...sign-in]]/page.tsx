import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The optional catch-all is MANDATORY, not stylistic: in non-production
 * `<SignIn/>` fetches `/sign-in/<probe>` and throws if it 404s
 * (clerk-setup.md §8.1). It also has to serve `/sign-in/factor-one`,
 * `/sign-in/sso-callback` and friends.
 *
 * No props: the Next SDK fills `routing: "path"` and `path` from the pathname.
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10">
      <SignIn />
    </div>
  );
}
