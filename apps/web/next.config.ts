import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Enable React Compiler for automatic memoization
  reactCompiler: true,
  
  // Image optimization for weather icons and other external images
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.openweathermap.org' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.vercel.app' },
    ],
    minimumCacheTTL: 60, // Cache images for at least 60 seconds
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Enable compression
  compress: true,
  
  // Output standalone for Docker deployments
  output: 'standalone',
  
  // Enable Turbopack caching
  turbopack: {
    root: path.resolve(__dirname, '.'),
  },
  
  async redirects() {
    return [
      { source: "/dev/dashboard", destination: "/dev", permanent: true },
      { source: "/dev/dashboard/triage", destination: "/dev/triage", permanent: true },
      { source: "/dev/dashboard/chat", destination: "/dev/chat", permanent: true },
      { source: "/dev/dashboard/health", destination: "/dev/health", permanent: true },
      { source: "/dev/dashboard/changelog", destination: "/dev/changelog", permanent: true },
    ];
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
