import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { TestDB } from "./cta-db";
import { handle, scheduled, allowedOrigin } from "../worker/src/index";
import {
  processOutbox,
  escalate,
  purge,
  businessHoursSince,
} from "../worker/src/outbox";
import { backup, pruneBackups, restoreBackup } from "../worker/src/backup";
import { notification, ResendProvider } from "../worker/src/provider";
import { retentionDate } from "../worker/src/validation";
import type { Env, Inquiry } from "../worker/src/types";
const origin = "https://steelpipe.wbspo.ccwu.cc";
export const sample = () => ({
  idempotency_key: crypto.randomUUID(),
  turnstile_token: "fresh-token",
  source_page: "/steel-pipe-weight-calculator/",
  calculation_mode: "actual",
  od_mm: 114.3,
  wall_mm: 6,
  density_kg_m3: 7850,
  length_m: 6,
  quantity_value: 10,
  quantity_unit: "pieces",
  destination_country: " us ",
  email: " BUYER@example.com ",
  company: "Example",
  notes: "Need a quote",
  theoretical_kg_m: 999999,
  theoretical_total_kg: 999999,
});
let db: TestDB,
  env: Env,
  jobs: Promise<unknown>[],
  calls: string[],
  verify: Record<string, unknown>,
  mailStatus: number;
const context = () =>
  ({
    waitUntil: (job: Promise<unknown>) => jobs.push(job),
  }) as ExecutionContext;
const request = (
  body: unknown,
  headers: Record<string, string> = {},
  method = "POST",
) =>
  new Request("https://api.example.com/v1/inquiries", {
    method,
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    ...(method === "POST"
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
const submit = (body = sample(), headers = {}) =>
  handle(request(body, headers), env, context());
const drain = async () => {
  await Promise.all(jobs);
  jobs = [];
};
beforeEach(() => {
  db = new TestDB();
  jobs = [];
  calls = [];
  verify = {
    success: true,
    hostname: "steelpipe.wbspo.ccwu.cc",
    action: "sourcing_inquiry",
  };
  mailStatus = 200;
  env = {
    DB: db as unknown as D1Database,
    INQUIRY_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    TURNSTILE_SECRET_KEY: "test-placeholder",
    TURNSTILE_HOSTNAME: "steelpipe.wbspo.ccwu.cc",
    TURNSTILE_ACTION: "sourcing_inquiry",
    RESEND_API_KEY: "test-placeholder",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      calls.push(url);
      if (url.includes("siteverify")) return Response.json(verify);
      if (url.includes("resend"))
        return Response.json(
          mailStatus === 200
            ? { id: "provider-id" }
            : { error: "never-log-this" },
          { status: mailStatus },
        );
      throw new Error("unexpected_destination");
    }),
  );
});
afterEach(async () => {
  await drain();
  db.close();
  vi.unstubAllGlobals();
});
describe("CTA API and failure injection", () => {
  it("valid inquiry atomically persists, recomputes values, sends owner notification after 201", async () => {
    const response = await submit();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ inquiry_id: expect.any(String) });
    expect(db.rows("inquiries")).toHaveLength(1);
    expect(db.rows("notification_outbox")).toHaveLength(1);
    const row = db.rows("inquiries")[0];
    expect(row.email).toBe("buyer@example.com");
    expect(row.destination_country).toBe("US");
    expect(row.theoretical_kg_m).toBeCloseTo(
      Math.PI * 6 * (114.3 - 6) * 1e-6 * 7850,
      10,
    );
    expect(row.theoretical_total_kg).toBeCloseTo(row.theoretical_kg_m * 60, 10);
    expect(Object.keys(row)).not.toContain("turnstile_token");
    expect(Object.keys(row)).not.toContain("ip");
    await drain();
    expect(db.rows("notification_outbox")[0].status).toBe("sent");
    const mail = vi
      .mocked(fetch)
      .mock.calls.find(([url]) => String(url).includes("resend"))!;
    const payload = JSON.parse(mail[1]!.body as string);
    expect(payload.to).toEqual(["wbspo1994@gmail.com"]);
    expect(payload.reply_to).toBe("buyer@example.com");
    expect(payload.from).toBe("onboarding@resend.dev");
    expect(payload.html).toContain(row.id);
  });
  it("outbox insert failure rolls back inquiry and returns 503 without mail", async () => {
    db.failOn = "INSERT INTO notification_outbox";
    expect((await submit()).status).toBe(503);
    expect(db.rows("inquiries")).toHaveLength(0);
    expect(db.rows("notification_outbox")).toHaveLength(0);
    expect(calls.some((x) => x.includes("resend"))).toBe(false);
  });
  it("inquiry insert/read failures return safe 503", async () => {
    db.failOn = "INSERT INTO inquiries";
    const res = await submit();
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("injected");
    expect(db.rows("inquiries")).toHaveLength(0);
    db.failOn = "SELECT * FROM inquiries";
    expect((await submit()).status).toBe(503);
  });
  it("mail failure preserves 201 and durable inquiry, queues retry", async () => {
    mailStatus = 503;
    expect((await submit()).status).toBe(201);
    await drain();
    const row = db.rows("notification_outbox")[0];
    expect(row.status).toBe("retry");
    expect(row.attempt_count).toBe(1);
    expect(row.last_error).toBe("mail_http_503");
    expect(db.rows("inquiries")).toHaveLength(1);
  });
  it("same normalized key/material returns original 201, while material conflict is 409", async () => {
    const body = sample();
    const first = await submit(body);
    const id = (await first.json()).inquiry_id;
    await drain();
    expect(
      (
        await (
          await submit({
            ...body,
            email: "buyer@example.com",
            destination_country: "US",
            turnstile_token: "new-token",
            theoretical_total_kg: 1,
          })
        ).json()
      ).inquiry_id,
    ).toBe(id);
    expect((await submit({ ...body, quantity_value: 11 })).status).toBe(409);
    expect(db.rows("inquiries")).toHaveLength(1);
    expect(db.rows("notification_outbox")).toHaveLength(1);
  });
  it("concurrent idempotent submissions return one durable inquiry and outbox", async () => {
    const body = sample();
    const responses = await Promise.all([
      submit(body),
      submit({ ...body, turnstile_token: "another-fresh-token" }),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(db.rows("inquiries")).toHaveLength(1);
    expect(db.rows("notification_outbox")).toHaveLength(1);
  });
  it.each(["invalid", "expired", "replayed"])(
    "rejects %s Turnstile response before writes",
    async () => {
      verify = { success: false, "error-codes": ["timeout-or-duplicate"] };
      expect((await submit()).status).toBe(403);
      expect(db.rows("inquiries")).toHaveLength(0);
    },
  );
  it("replay of consumed token fails even for an existing idempotency key", async () => {
    const body = sample();
    expect((await submit(body)).status).toBe(201);
    await drain();
    verify.success = false;
    expect((await submit(body)).status).toBe(403);
    expect(db.rows("inquiries")).toHaveLength(1);
  });
  it.each([
    { hostname: "evil.example" },
    { action: "other" },
    { success: "true" },
  ])("rejects mismatched verification metadata %j", async (change) => {
    Object.assign(verify, change);
    expect((await submit()).status).toBe(403);
  });
  it("Turnstile transport failure and absent binding fail closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network_secret");
      }),
    );
    expect((await submit()).status).toBe(403);
    env.TURNSTILE_SECRET_KEY = "";
    expect((await submit()).status).toBe(403);
  });
  it.each([
    "https://evil.example",
    "null",
    "https://steelpipe.wbspo.ccwu.cc.evil.example",
    "http://127.0.0.1:4321",
  ])("rejects invalid origin %s before verification", async (Origin) => {
    expect((await submit(sample(), { Origin })).status).toBe(403);
    expect(calls).toHaveLength(0);
  });
  it("isolates the explicit human staging origin and rejects near matches", async () => {
    const staging = "https://spwc-cta-human-staging.wbspo1994.workers.dev";
    env.ALLOWED_ORIGIN = staging;
    for (const [Origin, status] of [[staging, 204], [origin, 403],
      [staging + ".evil.example", 403], [staging + "/", 403],
      ["http://spwc-cta-human-staging.wbspo1994.workers.dev", 403]] as const) {
      const response = await handle(request(null, {
        Origin, "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      }, "OPTIONS"), env, context());
      expect(response.status).toBe(status);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(status === 204 ? staging : null);
    }
    env.ALLOWED_ORIGIN = staging + ".evil.example";
    expect(allowedOrigin(env)).toBe(origin);
    env.ALLOWED_ORIGIN = undefined;
    expect(allowedOrigin(env)).toBe(origin);
  });
  it("requires exact origin for preflight and only POST/content-type", async () => {
    expect(
      (
        await handle(
          request(
            null,
            {
              "Access-Control-Request-Method": "POST",
              "Access-Control-Request-Headers": "content-type",
            },
            "OPTIONS",
          ),
          env,
          context(),
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await handle(
          request(
            null,
            {
              Origin: "https://evil.example",
              "Access-Control-Request-Method": "POST",
            },
            "OPTIONS",
          ),
          env,
          context(),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handle(request(null, {}, "GET"), env, context())).status,
    ).toBe(405);
    expect(
      (await submit(sample(), { "Content-Type": "text/plain" })).status,
    ).toBe(400);
    expect(calls).toHaveLength(0);
  });
  it("429 on rate limit, 503 on unavailable limiter", async () => {
    env.INQUIRY_RATE_LIMITER.limit = async () => ({ success: false });
    expect((await submit()).status).toBe(429);
    expect(calls).toHaveLength(0);
    env.INQUIRY_RATE_LIMITER.limit = async () => {
      throw new Error();
    };
    expect((await submit()).status).toBe(503);
  });
  it("rejects oversize including a streaming body with no declared size", async () => {
    expect(
      (await handle(request("x".repeat(16385)), env, context())).status,
    ).toBe(413);
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("x".repeat(16385)));
        c.close();
      },
    });
    const req = new Request("https://api.example.com/v1/inquiries", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect((await handle(req, env, context())).status).toBe(413);
    expect(calls).toHaveLength(0);
  });
  it.each([
    { wall_mm: 60 },
    { quantity_value: 1.5 },
    { quantity_value: 0 },
    { od_mm: "114.3" },
    { density_kg_m3: Infinity },
    { email: "bad\r\nBcc: secret" },
    { destination_country: "ZZ" },
    { notes: "x".repeat(2001) },
    { calculation_mode: "other" },
    { quantity_unit: "boxes" },
    { website: "spam" },
    { idempotency_key: "not-a-uuid" },
  ])("rejects invalid fields safely %j", async (change) => {
    const response = await submit({ ...sample(), ...change });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Please check");
    expect(db.rows("inquiries")).toHaveLength(0);
  });
  it("rejects arrays and invalid JSON without internal details", async () => {
    expect((await handle(request([]), env, context())).status).toBe(400);
    expect((await handle(request("{"), env, context())).status).toBe(400);
  });
  it("validates exact schedule against frozen data, never aliases 40 and 40S", async () => {
    const body = {
      ...sample(),
      calculation_mode: "schedule",
      standard_id: "ASME B36.19",
      edition: "2022",
      nps: "12",
      schedule_designation: "40S",
      od_mm: 323.8,
      wall_mm: 9.52,
    };
    expect((await submit(body)).status).toBe(201);
    await drain();
    expect(
      (
        await submit({
          ...body,
          idempotency_key: crypto.randomUUID(),
          schedule_designation: "40",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await submit({
          ...body,
          idempotency_key: crypto.randomUUID(),
          wall_mm: 10.31,
        })
      ).status,
    ).toBe(400);
  });
  it("total length quantity computes kg/m times metres", async () => {
    expect(
      (
        await submit({
          ...sample(),
          quantity_unit: "total_length",
          quantity_value: 3.5,
        })
      ).status,
    ).toBe(201);
    const row = db.rows("inquiries")[0];
    expect(row.theoretical_total_kg).toBeCloseTo(row.theoretical_kg_m * 3.5);
  });
  it("XSS-looking strings remain data and are escaped in email", async () => {
    expect(
      (
        await submit({
          ...sample(),
          company: "<img src=x onerror=alert(1)>",
          notes: "<script>alert(1)</script>",
        })
      ).status,
    ).toBe(201);
    const row = db.rows("inquiries")[0] as Inquiry;
    expect(row.notes).toContain("<script>");
    const mail = notification(row, "owner_new_inquiry", "key");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.text).toContain("<script>");
  });
  it("synchronous background scheduling failure cannot reverse persistence success", async () => {
    const ctx = {
      waitUntil() {
        throw new Error();
      },
    } as unknown as ExecutionContext;
    expect((await handle(request(sample()), env, ctx)).status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});
describe("Outbox, lifecycle and backups", () => {
  const failed = async () => {
    mailStatus = 500;
    await submit();
    await drain();
    return db.rows("notification_outbox")[0];
  };
  it("retry succeeds after transient provider failure", async () => {
    const row = await failed();
    mailStatus = 200;
    await processOutbox(env, undefined, new Date(row.next_attempt_at));
    expect(db.rows("notification_outbox")[0].status).toBe("sent");
    expect(db.rows("inquiries")).toHaveLength(1);
  });
  it("retries at +5min, +30min, +2h, +12h then dead-letters after attempt five", async () => {
    let row = await failed();
    for (const delay of [300, 1800, 7200, 43200]) {
      expect(
        (Date.parse(row.next_attempt_at) - Date.parse(row.last_attempt_at)) /
          1000,
      ).toBe(delay);
      await processOutbox(env, undefined, new Date(row.next_attempt_at));
      row = db.rows("notification_outbox")[0];
    }
    expect(row.status).toBe("failed");
    expect(row.attempt_count).toBe(5);
  });
  it("concurrent cron processors claim a single lease and use stable provider idempotency key", async () => {
    const row = await failed();
    mailStatus = 200;
    const before = calls.filter((x) => x.includes("resend")).length;
    await Promise.all([
      processOutbox(env, undefined, new Date(row.next_attempt_at)),
      processOutbox(env, undefined, new Date(row.next_attempt_at)),
    ]);
    expect(calls.filter((x) => x.includes("resend")).length - before).toBe(1);
    expect(db.rows("notification_outbox")[0].attempt_count).toBe(2);
  });
  it("in-flight lease blocks duplicate mail, expired lease recovers", async () => {
    const row = await failed();
    db.sqlite
      .prepare("UPDATE notification_outbox SET lease_token=?,lease_until=?")
      .run(
        "crashed",
        new Date(Date.parse(row.next_attempt_at) + 60000).toISOString(),
      );
    mailStatus = 200;
    await processOutbox(env, undefined, new Date(row.next_attempt_at));
    expect(db.rows("notification_outbox")[0].status).toBe("retry");
    await processOutbox(
      env,
      undefined,
      new Date(Date.parse(row.next_attempt_at) + 61000),
    );
    expect(db.rows("notification_outbox")[0].status).toBe("sent");
  });
  it("stale weekday lead escalates exactly once even when scans repeat", async () => {
    await submit();
    await drain();
    db.sqlite
      .prepare("UPDATE inquiries SET created_at=?")
      .run("2026-10-02T12:00:00.000Z");
    await escalate(env, new Date("2026-10-05T12:00:00Z"));
    await escalate(env, new Date("2026-10-05T12:00:00Z"));
    expect(
      db
        .rows("notification_outbox")
        .filter((r) => r.kind === "owner_stale_inquiry"),
    ).toHaveLength(1);
    expect(
      businessHoursSince(
        new Date("2026-10-02T12:00:00Z"),
        new Date("2026-10-05T12:00:00Z"),
      ),
    ).toBe(24);
  });
  it("weekend and handled leads do not escalate; pending alert cancels on status change", async () => {
    await submit();
    await drain();
    db.sqlite
      .prepare("UPDATE inquiries SET created_at=?")
      .run("2026-10-02T12:00:00.000Z");
    await escalate(env, new Date("2026-10-04T12:00:00Z"));
    expect(db.rows("notification_outbox")).toHaveLength(1);
    await escalate(env, new Date("2026-10-05T12:00:00Z"));
    db.sqlite.prepare("UPDATE inquiries SET status='reviewing'").run();
    const count = calls.length;
    await processOutbox(env, undefined, new Date("2026-10-07T12:00:00Z"));
    expect(calls.length).toBe(count);
    expect(
      db
        .rows("notification_outbox")
        .find((r) => r.kind === "owner_stale_inquiry")?.last_error,
    ).toBe("escalation_cancelled");
  });
  it("purge deletes expired inquiries and outbox atomically", async () => {
    await submit();
    await drain();
    const row = db.rows("inquiries")[0];
    await purge(env, new Date(row.retention_delete_after));
    expect(db.rows("inquiries")).toHaveLength(0);
    expect(db.rows("notification_outbox")).toHaveLength(0);
  });
  it("calendar retention clamps leap day rather than carrying into March", () => {
    expect(retentionDate(new Date("2024-02-29T12:34:56Z"))).toBe(
      "2025-02-28T12:34:56.000Z",
    );
  });
  it("private backup round trip restores inquiry/outbox and excludes expired rows", async () => {
    await submit();
    await drain();
    const objects = new Map<string, { text: string; uploaded: Date }>();
    env.BACKUPS_ENABLED = "true";
    env.BACKUPS = {
      put: async (key: string, text: string) => {
        objects.set(key, { text, uploaded: new Date() });
      },
      list: async () => ({
        objects: [...objects].map(([key, v]) => ({
          key,
          uploaded: v.uploaded,
        })),
        truncated: false,
      }),
      delete: async (keys: string[]) => keys.forEach((k) => objects.delete(k)),
    } as unknown as R2Bucket;
    await backup(env);
    expect(objects.size).toBe(1);
    const content = [...objects.values()][0].text;
    const restored = new TestDB();
    try {
      await restoreBackup(restored as unknown as D1Database, content);
      expect(restored.rows("inquiries")[0].id).toBe(db.rows("inquiries")[0].id);
      expect(restored.rows("notification_outbox")).toHaveLength(1);
    } finally {
      restored.close();
    }
    const expired = new TestDB();
    try {
      await restoreBackup(
        expired as unknown as D1Database,
        content,
        new Date("2028-01-01"),
      );
      expect(expired.rows("inquiries")).toHaveLength(0);
      expect(expired.rows("notification_outbox")).toHaveLength(0);
    } finally {
      expired.close();
    }
    objects.set("daily/old.json", {
      text: "old",
      uploaded: new Date("2020-01-01"),
    });
    await pruneBackups(env);
    expect(objects.has("daily/old.json")).toBe(false);
  });
  it("daily scheduled retention runs despite broken email provider", async () => {
    const row = await failed();
    db.sqlite
      .prepare("UPDATE inquiries SET retention_delete_after=?")
      .run("2020-01-01T00:00:00.000Z");
    await scheduled(
      { cron: "0 2 * * *", scheduledTime: Date.now() } as ScheduledController,
      env,
      context(),
    );
    expect(db.rows("inquiries")).toHaveLength(0);
  });
  it("provider error messages never store response bodies/secrets", async () => {
    await failed();
    expect(db.rows("notification_outbox")[0].last_error).not.toContain(
      "never-log",
    );
    const provider = new ResendProvider({ ...env, RESEND_API_KEY: "" });
    await expect(
      provider.send({
        subject: "x",
        text: "x",
        html: "x",
        replyTo: "x",
        key: "x",
      }),
    ).rejects.toThrow("mail_unconfigured");
  });
});
