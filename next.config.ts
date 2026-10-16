import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Шрифт с кириллицей для PDF-отчётов читается с диска во время запроса.
  outputFileTracingIncludes: {
    "/api/reports/export": ["./assets/fonts/**/*"],
  },
};

export default nextConfig;
