import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Long-cache the immutable Stockfish engine files copied into /public.
  // NOTE: no transpilePackages and no wasm MIME override are needed - verified below.
  async headers() {
    return [
      {
        source: "/stockfish/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
