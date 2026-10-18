import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: static shells with streamed dynamic holes.
  // Note: admin data pages (members, groups, member detail) carry
  // server-action forms, and Next 16.4 can fail to swap a streamed hole that
  // contains progressive-enhancement form markup on hard loads — so those
  // pages use `export const instant = false` + `connection()` to render
  // fully per request instead of streaming into a hole.
  cacheComponents: true,
  partialPrefetching: true,
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
