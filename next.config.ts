import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AGENTS.md is hand-maintained project policy; stop `next dev` from rewriting it.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  // The Find agent reads this file at runtime (SampleTenderSource); make sure the deploy ships it.
  outputFileTracingIncludes: { "/find": ["./data/sample-tenders/tenders.json"] },
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
