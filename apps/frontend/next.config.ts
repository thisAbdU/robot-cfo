import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@robot-cfo/shared",
    "@rainbow-me/rainbowkit",
    "wagmi",
    "@tanstack/react-query",
  ],
};

export default nextConfig;
