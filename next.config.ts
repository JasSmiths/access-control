import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfkit uses __dirname + runtime file reads for AFM fonts; keep it external
  // so paths are not rewritten by the bundler. better-sqlite3 is on Next's auto-
  // external list already, but listing it here is a no-op and future-proofs us.
  serverExternalPackages: ["pdfkit", "better-sqlite3"],
  // Ensure pdfkit's AFM data files are copied into the standalone output trace.
  outputFileTracingIncludes: {
    "/api/reports": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
