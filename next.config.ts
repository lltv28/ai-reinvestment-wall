import type { NextConfig } from "next";

// Static export for GitHub Pages. The site is served under /ai-reinvestment-wall
// in production (project page); dev stays at the root. Gated on NODE_ENV so it
// works without a committed .env. Images must be unoptimized (no image server).
const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH ||
  (process.env.NODE_ENV === "production" ? "/ai-reinvestment-wall" : undefined);

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
