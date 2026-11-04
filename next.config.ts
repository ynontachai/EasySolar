import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // EasySolar is a single landing page; legacy routes land there. Temporary
  // redirects keep the old pages restorable.
  async redirects() {
    return [
      { source: "/checker", destination: "/#calculator", permanent: false },
      { source: "/equipment", destination: "/", permanent: false },
      { source: "/community-buy/:path*", destination: "/", permanent: false },
      { source: "/solar-value/:path*", destination: "/", permanent: false },
      { source: "/community-buy", destination: "/", permanent: false },
      { source: "/solar-value", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
