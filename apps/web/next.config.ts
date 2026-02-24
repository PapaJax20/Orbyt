import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Allow imports from workspace packages
  transpilePackages: ["@orbyt/ui", "@orbyt/shared", "@orbyt/api"],

  // Resolve .js imports to .ts files (NodeNext moduleResolution compatibility)
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },

  // Image domains for Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },

  // PWA headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // Sentry organisation / project — set via env or leave blank for DSN-only mode
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Disable Sentry build-time telemetry
  telemetry: false,

  // Only upload source maps in production (CI will have SENTRY_AUTH_TOKEN set)
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },

  // Suppress the verbose Sentry CLI output during builds
  silent: true,
});
