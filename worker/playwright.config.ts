import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4321",
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    },
  },
  webServer: [
    {
      command: "node e2e/server.mjs",
      url: "http://127.0.0.1:8790/health",
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command:
        "cd .. && ASTRO_TELEMETRY_DISABLED=1 PUBLIC_SOURCING_CTA_ENABLED=true PUBLIC_INQUIRY_API_URL=http://127.0.0.1:8788 PUBLIC_TURNSTILE_SITE_KEY=test-only-public-placeholder PUBLIC_SITE_URL=https://steelpipe.wbspo.ccwu.cc PUBLIC_NOINDEX=true npm run dev -- --host 127.0.0.1 --port 4321",
      url: "http://127.0.0.1:4321",
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
