import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // FFmpeg.js configuration
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@ffmpeg/ffmpeg": "@ffmpeg/ffmpeg/dist/esm/index.js",
      };
    }

    // Handle dynamic imports for FFmpeg
    config.module.rules.push({
      test: /\.m?js$/,
      type: "javascript/auto",
      resolve: {
        fullySpecified: false,
      },
    });

    return config;
  },
};

export default nextConfig;
