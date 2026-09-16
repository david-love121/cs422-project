import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API credentials stay on the server; poster images load from TMDB's CDN.
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
