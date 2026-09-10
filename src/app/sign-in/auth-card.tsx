"use client";
// src/app/sign-in/auth-card.tsx  [U4]
// The Clerk <SignIn/> and <SignUp/> cards, themed onto the Study tokens
// (UI_REDESIGN §1.1). Shared by both auth routes — it lives beside the sign-in
// page because both routes belong to this package and Next only treats reserved
// filenames (page/layout/route/…) inside app/ as routes.
//
// The appearance API was read off @clerk/react's own types before use: the
// documented shape is `appearance={{ variables: {...} }}` and every colour is a
// plain string. Note the names — this version has `colorForeground` /
// `colorMutedForeground`, not the older `colorText` / `colorTextSecondary`.
//
// Hex, not `var(--accent)`: Clerk derives a whole shade scale from
// `colorPrimary` and `colorNeutral`, which means it parses the value. So the two
// palettes are passed explicitly and swapped from `resolvedTheme` instead.
import { SignIn, SignUp } from "@clerk/nextjs";
import { useTheme } from "next-themes";

type Variables = NonNullable<
  NonNullable<React.ComponentProps<typeof SignIn>["appearance"]>["variables"]
>;

const SHARED: Variables = {
  borderRadius: "0.625rem",
  fontFamily: "var(--font-geist-sans)",
  fontFamilyMono: "var(--font-geist-mono)",
};

const DARK: Variables = {
  ...SHARED,
  colorPrimary: "#c9a24a",
  colorPrimaryForeground: "#1a130d",
  colorBackground: "#1c1610",
  colorForeground: "#f1e7d3",
  colorMuted: "#0c0907",
  colorMutedForeground: "#b3a48c",
  colorInput: "#0c0907",
  colorInputForeground: "#f1e7d3",
  colorBorder: "#2d241b",
  colorRing: "#c9a24a",
  colorNeutral: "#f1e7d3",
  colorDanger: "#d4644a",
};

const LIGHT: Variables = {
  ...SHARED,
  colorPrimary: "#806018",
  colorPrimaryForeground: "#fbf7ee",
  colorBackground: "#fbf7ee",
  colorForeground: "#1a130d",
  colorMuted: "#e9e0cf",
  colorMutedForeground: "#5c503f",
  colorInput: "#fbf7ee",
  colorInputForeground: "#1a130d",
  colorBorder: "#d9cdb7",
  colorRing: "#806018",
  colorNeutral: "#1a130d",
  colorDanger: "#a63d27",
};

/**
 * Neither component takes routing props: the Next SDK fills `routing: "path"`
 * and `path` from the pathname.
 */
export function AuthCard({ kind }: { kind: "sign-in" | "sign-up" }) {
  // `resolvedTheme` is undefined until next-themes has read the class on <html>.
  // The app's default is dark, so that is the fallback; clerk-js re-renders the
  // card when the prop changes, and no layout depends on this value.
  const { resolvedTheme } = useTheme();
  const appearance = { variables: resolvedTheme === "light" ? LIGHT : DARK };

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-12">
      {kind === "sign-in" ? (
        <SignIn appearance={appearance} />
      ) : (
        <SignUp appearance={appearance} />
      )}
    </div>
  );
}
