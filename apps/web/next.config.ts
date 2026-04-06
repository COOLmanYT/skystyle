import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/dev/dashboard", destination: "/dev", permanent: true },
      { source: "/dev/dashboard/triage", destination: "/dev/triage", permanent: true },
      { source: "/dev/dashboard/chat", destination: "/dev/chat", permanent: true },
      { source: "/dev/dashboard/health", destination: "/dev/health", permanent: true },
      { source: "/dev/dashboard/changelog", destination: "/dev/changelog", permanent: true },
    ];
  },
};

export default nextConfig;
