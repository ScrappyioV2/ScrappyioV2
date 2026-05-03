import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['scrappyio-v2-42kf.vercel.app', 'localhost:3000'],
    },
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,
};
export default nextConfig;