import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { PlayerSync } from "@/components/providers/player-sync";
import { SiteHeader } from "@/components/nav/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "3D Chess", template: "%s · 3D Chess" },
  description: "Online 3D chess with real-time matchmaking, an AI opponent and custom rooms.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Provider order is mandatory: Clerk must wrap Convex so
            ConvexProviderWithClerk can read the Clerk context. */}
        <ClerkProvider afterSignOutUrl="/">
          <ConvexClientProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
              <TooltipProvider>
                <PlayerSync />
                <SiteHeader />
                <main className="flex-1">{children}</main>
                <Toaster position="top-center" richColors />
              </TooltipProvider>
            </ThemeProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
