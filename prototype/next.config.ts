import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TMDB requests and images are fetched directly by the user's browser.
  poweredByHeader: false,
  devIndicators: false,
};

export default nextConfig;
