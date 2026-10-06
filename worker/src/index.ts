import type { Env, Inquiry } from "./types";
import {
  InvalidInput,
  normalize,
  fingerprint,
  makeInquiry,
} from "./validation";
import { processOutbox, escalate, purge } from "./outbox";
import { backup, pruneBackups } from "./backup";
const productionOrigin = "https://steelpipe.wbspo.ccwu.cc";
const maxBytes = 16 * 1024;
export function allowedOrigin(env: Env): string {
  // Production is fixed; the only supported override is the isolated local frontend.
  return env.ALLOWED_ORIGIN === "http://127.0.0.1:4321"
    ? env.ALLOWED_ORIGIN
    : productionOrigin;
}
function reply(status: number, data: unknown, origin?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const size = request.headers.get("Content-Length");
  if (size && Number(size) > maxBytes) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new InvalidInput();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new RangeError();
    }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes),
    );
  } catch {
    throw new InvalidInput();
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new InvalidInput();
  return parsed as Record<string, unknown>;
}
async function verifyTurnstile(
  input: Record<string, unknown>,
  env: Env,
): Promise<boolean> {
  if (
    !env.TURNSTILE_SECRET_KEY ||
    !env.TURNSTILE_HOSTNAME ||
    typeof input.turnstile_token !== "string" ||
    !input.turnstile_token ||
    input.turnstile_token.length > 2048
  )
    return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: input.turnstile_token,
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return false;
    const result = (await res.json()) as {
      success: boolean;
      hostname?: string;
      action?: string;
    };
    return (
      result.success === true &&
      result.hostname === env.TURNSTILE_HOSTNAME &&
      (!env.TURNSTILE_ACTION || result.action === env.TURNSTILE_ACTION)
    );
  } catch {
    return false;
  }
}
function safeBackground(
  ctx: ExecutionContext,
  job: () => Promise<void>,
  event: string,
): void {
  // Both a synchronous scheduling error and asynchronous mail/maintenance failure are isolated from submission.
  try {
    ctx.waitUntil(
      Promise.resolve()
        .then(job)
        .catch(() => {
          console.error(JSON.stringify({ event }));
        }),
    );
  } catch {
    console.error(JSON.stringify({ event: "background_scheduling_failed" }));
  }
}
export async function handle(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url),
    origin = request.headers.get("Origin"),
    allowed = allowedOrigin(env),
    cors = origin === allowed ? allowed : undefined;
  if (url.pathname !== "/v1/inquiries")
    return reply(404, { error: "Not found." }, cors);
  if (request.method === "OPTIONS") {
    if (origin !== allowed) return reply(403, { error: "Origin not allowed." });
    if (request.headers.get("Access-Control-Request-Method") !== "POST")
      return reply(405, { error: "Use POST." }, cors);
    const requested = (
      request.headers.get("Access-Control-Request-Headers") || ""
    )
      .toLowerCase()
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (requested.some((x) => x !== "content-type"))
      return reply(403, { error: "Headers not allowed." }, cors);
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      },
    });
  }
  if (request.method !== "POST")
    return reply(405, { error: "Use POST." }, cors);
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    return reply(400, { error: "Use JSON." }, cors);
  if (origin !== allowed) return reply(403, { error: "Origin not allowed." });
  let input: Record<string, unknown>;
  try {
    input = await readBody(request);
  } catch (e) {
    return reply(
      e instanceof RangeError ? 413 : 400,
      {
        error: e instanceof RangeError ? "Payload too large." : "Invalid JSON.",
      },
      cors,
    );
  }
  try {
    // Cloudflare-supplied IP is used only as the ephemeral platform rate limiter key; never saved/logged.
    const ip = request.headers.get("CF-Connecting-IP") || "unidentified";
    const limit = await env.INQUIRY_RATE_LIMITER.limit({ key: ip });
    if (!limit.success)
      return reply(
        429,
        { error: "Too many requests. Please try again later." },
        cors,
      );
  } catch {
    return reply(503, { error: "Please try again later." }, cors);
  }
  if (!(await verifyTurnstile(input, env)))
    return reply(
      403,
      { error: "Please refresh the verification challenge." },
      cors,
    );
  let value: ReturnType<typeof normalize>;
  try {
    value = normalize(input);
  } catch {
    return reply(400, { error: "Please check the inquiry fields." }, cors);
  }
  try {
    const hash = await fingerprint(value);
    const previous = await env.DB.prepare(
      "SELECT * FROM inquiries WHERE idempotency_key=?",
    )
      .bind(value.idempotency_key)
      .first<Inquiry>();
    if (previous)
      return reply(
        previous.payload_hash === hash ? 201 : 409,
        previous.payload_hash === hash
          ? { inquiry_id: previous.id }
          : {
              error:
                "This retry differs from the original request. Start a new request.",
            },
        cors,
      );
    const now = new Date(),
      row = makeInquiry(value, hash, now),
      keys = Object.keys(row) as (keyof Inquiry)[];
    try {
      const results = await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO inquiries (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
        ).bind(...keys.map((k) => row[k])),
        env.DB.prepare(
          `INSERT INTO notification_outbox (id,inquiry_id,next_attempt_at,created_at,updated_at) VALUES (?,?,?,?,?)`,
        ).bind(
          crypto.randomUUID(),
          row.id,
          now.toISOString(),
          now.toISOString(),
          now.toISOString(),
        ),
      ]);
      if (results.some((r) => !r.success)) throw new Error("persist_failed");
    } catch {
      // UNIQUE race: compare the winner only after the failed batch rolled back.
      const winner = await env.DB.prepare(
        "SELECT * FROM inquiries WHERE idempotency_key=?",
      )
        .bind(value.idempotency_key)
        .first<Inquiry>();
      if (winner)
        return reply(
          winner.payload_hash === hash ? 201 : 409,
          winner.payload_hash === hash
            ? { inquiry_id: winner.id }
            : {
                error:
                  "This retry differs from the original request. Start a new request.",
              },
          cors,
        );
      return reply(
        503,
        { error: "Request could not be saved. Please retry." },
        cors,
      );
    }
    safeBackground(
      ctx,
      () => processOutbox(env, row.id),
      "outbox_processing_failed",
    );
    return reply(201, { inquiry_id: row.id }, cors);
  } catch {
    return reply(
      503,
      { error: "Request could not be saved. Please retry." },
      cors,
    );
  }
}
export async function scheduled(
  controller: ScheduledController,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const now = new Date(controller.scheduledTime);
  // Retention/backup hygiene runs independently from the mail provider.
  if (controller.cron === "0 2 * * *") {
    await purge(env, now);
    await pruneBackups(env, now);
    await backup(env, now);
  }
  await escalate(env, now);
  await processOutbox(env, undefined, now);
}
export default { fetch: handle, scheduled };
