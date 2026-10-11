import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: the API routes read a mutable in-memory store,
  // and with it on, any GET route that doesn't touch the request would be prerendered
  // at build time and serve stale data.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
