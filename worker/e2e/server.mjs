// Test-only local harness: real workerd/D1/R2; controlled external provider responses.
// This file is never imported by the production Worker entry point.
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
mkdirSync(".wrangler", { recursive: true });
await build({
  entryPoints: ["e2e/entry.ts"],
  bundle: true,
  format: "esm",
  outfile: ".wrangler/e2e-worker.mjs",
  platform: "browser",
  target: "es2022",
});
let mailFail = false,
  mailCount = 0,
  verifyFail = false;
const usedTokens = new Set();
const mf = new Miniflare({
  name: "spwc-e2e",
  modules: true,
  scriptPath: ".wrangler/e2e-worker.mjs",
  compatibilityDate: "2026-04-03",
  host: "127.0.0.1",
  port: 8788,
  d1Databases: { DB: "e2e-db", RESTORE_DB: "e2e-restore-db" },
  r2Buckets: { BACKUPS: "e2e-backups" },
  ratelimits: { INQUIRY_RATE_LIMITER: { simple: { limit: 100, period: 60 } } },
  bindings: {
    ALLOWED_ORIGIN: "http://127.0.0.1:4321",
    TURNSTILE_SECRET_KEY: "test-only-placeholder",
    TURNSTILE_HOSTNAME: "127.0.0.1",
    TURNSTILE_ACTION: "sourcing_inquiry",
    RESEND_API_KEY: "test-only-placeholder",
    BACKUPS_ENABLED: "true",
  },
  outboundService: async (request) => {
    const body = await request.json();
    if (request.url.includes("siteverify")) {
      const good =
        !verifyFail &&
        !usedTokens.has(body.response) &&
        !String(body.response).startsWith("invalid");
      usedTokens.add(body.response);
      return Response.json({
        success: good,
        hostname: "127.0.0.1",
        action: "sourcing_inquiry",
      });
    }
    if (request.url === "https://api.resend.com/emails") {
      if (mailFail)
        return Response.json({ error: "test_failure" }, { status: 503 });
      mailCount++;
      return Response.json({ id: `test-mail-${mailCount}` });
    }
    throw new Error("Unexpected external request in test");
  },
});
await mf.ready;
const db = await mf.getD1Database("DB");
const schema = readFileSync("../migrations/0001_inquiries.sql", "utf8").replace(
  /\n/g,
  " ",
);
await db.exec(schema);
const restoreDB = await mf.getD1Database("RESTORE_DB");
await restoreDB.exec(schema);
const control = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:8790");
    if (req.method === "POST" && url.pathname === "/reset") {
      await db.exec(
        "DROP TRIGGER IF EXISTS force_failure; DELETE FROM notification_outbox; DELETE FROM inquiries;",
      );
      mailFail = false;
      verifyFail = false;
      mailCount = 0;
      usedTokens.clear();
      await restoreDB.exec(
        "DELETE FROM notification_outbox; DELETE FROM inquiries;",
      );
      const bucket = await mf.getR2Bucket("BACKUPS");
      const objects = await bucket.list();
      if (objects.objects.length)
        await bucket.delete(objects.objects.map((o) => o.key));
    } else if (req.method === "POST" && url.pathname === "/mail-fail")
      mailFail = true;
    else if (req.method === "POST" && url.pathname === "/mail-ok")
      mailFail = false;
    else if (req.method === "POST" && url.pathname === "/d1-fail")
      await db.exec(
        "CREATE TRIGGER force_failure BEFORE INSERT ON notification_outbox BEGIN SELECT RAISE(ABORT, 'test_failure'); END;",
      );
    else if (req.method === "POST" && url.pathname === "/d1-ok")
      await db.exec("DROP TRIGGER IF EXISTS force_failure;");
    else if (req.method === "POST" && url.pathname === "/retry") {
      await db
        .prepare(
          "UPDATE notification_outbox SET next_attempt_at='2000-01-01T00:00:00.000Z'",
        )
        .run();
      // workerd scheduled execution via an isolated, test-only entry wrapper below is not exposed publicly.
      const response = await mf.dispatchFetch("http://local/__test/scheduled", {
        method: "POST",
        body: JSON.stringify({ cron: "*/5 * * * *", time: Date.now() }),
      });
      if (!response.ok) throw new Error("cron_failed");
    } else if (req.method === "POST" && url.pathname === "/daily") {
      const response = await mf.dispatchFetch("http://local/__test/scheduled", {
        method: "POST",
        body: JSON.stringify({ cron: "0 2 * * *", time: Date.now() }),
      });
      if (!response.ok) throw new Error("daily_failed");
    } else if (req.method === "POST" && url.pathname === "/restore") {
      const response = await mf.dispatchFetch("http://local/__test/restore", {
        method: "POST",
      });
      res.statusCode = response.status;
      res.setHeader("Content-Type", "application/json");
      res.end(await response.text());
      return;
    } else if (req.method === "POST" && url.pathname === "/expire") {
      await db
        .prepare(
          "UPDATE inquiries SET retention_delete_after='2020-01-01T00:00:00.000Z'",
        )
        .run();
    } else if (req.method === "POST" && url.pathname === "/stale") {
      await db
        .prepare("UPDATE inquiries SET created_at='2026-01-01T00:00:00.000Z'")
        .run();
    } else if (req.method === "GET" && url.pathname === "/status") {
      const inquiries = (await db.prepare("SELECT * FROM inquiries").all())
        .results;
      const outbox = (
        await db.prepare("SELECT * FROM notification_outbox").all()
      ).results;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          inquiries,
          outbox,
          mailCount,
          backups: (await (await mf.getR2Bucket("BACKUPS")).list()).objects
            .length,
        }),
      );
      return;
    } else if (url.pathname !== "/health") {
      res.statusCode = 404;
      res.end();
      return;
    }
    res.end("OK");
  } catch {
    res.statusCode = 500;
    res.end("Test harness operation failed");
  }
});
control.listen(8790, "127.0.0.1", () =>
  console.log("Local test harness ready"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, async () => {
    control.close();
    await mf.dispose();
    process.exit(0);
  });
