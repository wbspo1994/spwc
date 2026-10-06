// Exercise real Astro output. A source-only placement check cannot detect hoisted scripts.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const base = {
  ...process.env,
  ASTRO_TELEMETRY_DISABLED: "1",
  PUBLIC_SITE_URL: "https://steelpipe.wbspo.ccwu.cc",
  PUBLIC_NOINDEX: "false",
};
for (const key of [
  "PUBLIC_SOURCING_CTA_ENABLED",
  "PUBLIC_INQUIRY_API_URL",
  "PUBLIC_TURNSTILE_SITE_KEY",
])
  delete base[key];
const cases = [
  [
    "disabled",
    {
      PUBLIC_SOURCING_CTA_ENABLED: "false",
      PUBLIC_INQUIRY_API_URL: "http://127.0.0.1:8788",
      PUBLIC_TURNSTILE_SITE_KEY: "test-only-placeholder",
    },
    false,
  ],
  ["unset", {}, false],
  [
    "incomplete",
    {
      PUBLIC_SOURCING_CTA_ENABLED: "true",
      PUBLIC_INQUIRY_API_URL: "http://127.0.0.1:8788",
    },
    false,
  ],
  [
    "enabled",
    {
      PUBLIC_SOURCING_CTA_ENABLED: "true",
      PUBLIC_INQUIRY_API_URL: "http://127.0.0.1:8788",
      PUBLIC_TURNSTILE_SITE_KEY: "test-only-placeholder",
    },
    true,
  ],
  // Leave the final artifacts in the production-shaped CTA-off state, without publishing them.
  ["disabled-final", { PUBLIC_SOURCING_CTA_ENABLED: "false" }, false],
];
for (const [name, variables, expected] of cases) {
  try {
    execFileSync("npm", ["run", "build"], {
      cwd: root,
      env: { ...base, ...variables },
      stdio: "pipe",
    });
  } catch (e) {
    process.stderr.write(e.stdout || "");
    process.stderr.write(e.stderr || "");
    process.exit(e.status || 1);
  }
  const html = readFileSync(
    `${root}/dist/steel-pipe-weight-calculator/index.html`,
    "utf8",
  );
  const files = readdirSync(`${root}/dist/_astro`).filter((name) =>
    name.endsWith(".js"),
  );
  const sourcingFiles = files.filter((file) =>
    /sourcing-form|sourcing_cta_view|sourcing-challenge|initSourcingForm/.test(
      file + "\n" + readFileSync(`${root}/dist/_astro/${file}`, "utf8"),
    ),
  );
  assert.equal(
    html.includes('id="sourcing-form"'),
    expected,
    `${name}: rendered form gate`,
  );
  assert.equal(
    sourcingFiles.length > 0,
    expected,
    `${name}: sourcing code in emitted client assets`,
  );
  if (!expected) {
    assert.ok(
      !/SourcingCTA|sourcing-form/.test(html),
      `${name}: disabled HTML script reference`,
    );
    // The frozen calculator has one module entry; no CTA loader may be attached.
    assert.equal(
      (html.match(/<script\b[^>]*type="module"/g) || []).length,
      1,
      `${name}: no extra module loader`,
    );
  }
  console.log(
    `${name}: form and emitted-bundle gates passed (${files.length} JS assets)`,
  );
}
