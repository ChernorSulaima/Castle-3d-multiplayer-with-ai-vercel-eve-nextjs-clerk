// next.config.ts
import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    // Clerk avatars (FR-2)
    remotePatterns: [new URL("https://img.clerk.com/**")],
  },
  async headers() {
    return [
      {
        // engine lives under a version-stamped directory (/stockfish/sf11/*) -> immutable is safe; bump the dir when upgrading
        source: "/stockfish/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // HDRIs are content-stable but not hashed -> 30 days (NFR-9)
        source: "/hdri/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=2592000" }],
      },
    ];
  },
};

// withEve mounts /eve/v1/* on this origin (dev rewrite to `eve dev`, Vercel Build Output service).
// eveRoot defaults to ./agent — do not pass `agents` as well.
export default withEve(nextConfig);
