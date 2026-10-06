import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  images: { unoptimized: true },
  turbopack: { root: process.cwd() },
};
export default config;
