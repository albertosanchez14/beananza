import type { NextConfig } from "next";

function requiredUrl(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "**" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    const apiUrl = requiredUrl("INTERNAL_API_URL");

    return [
      { source: "/register", destination: `${apiUrl}/register` },
      { source: "/rooms", destination: `${apiUrl}/rooms` },
      { source: "/config", destination: `${apiUrl}/config` },
      { source: "/upload-avatar", destination: `${apiUrl}/upload-avatar` },
      {
        source: "/user-avatars/:path*",
        destination: `${apiUrl}/user-avatars/:path*`,
      },
    ];
  },
};

export default nextConfig;
