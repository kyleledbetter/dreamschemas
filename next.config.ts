import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Only run ESLint on these directories during build
    dirs: ['app', 'components', 'lib'],
    // Allow build to continue even with ESLint errors
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow build to continue even with TypeScript errors
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.module.exprContextCritical = false;
    return config;
  },
};

export default nextConfig;