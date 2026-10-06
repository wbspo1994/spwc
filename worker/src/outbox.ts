import type { Env, Inquiry, Outbox } from "./types";
import {
  MailError,
  notification,
  ResendProvider,
  type MailProvider,
} from "./provider";
const delays = [5 * 60, 30 * 60, 2 * 3600, 12 * 3600];
export async function processOutbox(
  env: Env,
  inquiryId?: string,
  now = new Date(),
  provider: MailProvider = new ResendProvider(env),
): Promise<void> {
  const instant = now.toISOString();
  const query = `SELECT * FROM notification_outbox WHERE status IN ('pending','retry') AND next_attempt_at <= ? AND (lease_until IS NULL OR lease_until < ?) ${inquiryId ? "AND inquiry_id = ?" : ""} ORDER BY next_attempt_at LIMIT 10`;
  const args = inquiryId ? [instant, instant, inquiryId] : [instant, instant];
  const rows = await env.DB.prepare(query)
    .bind(...args)
    .all<Outbox>();
  const started = Date.now();
  for (const row of rows.results) {
    // Later rows get fresh leases even when earlier provider attempts took time.
    const attemptTime = new Date(
      now.getTime() + Math.max(0, Date.now() - started),
    );
    const attemptInstant = attemptTime.toISOString();
    const token = crypto.randomUUID();
    const claimed = await env.DB.prepare(
      `UPDATE notification_outbox SET lease_token=?, lease_until=?, updated_at=? WHERE id=? AND status IN ('pending','retry') AND next_attempt_at <= ? AND (lease_until IS NULL OR lease_until < ?)`,
    )
      .bind(
        token,
        new Date(attemptTime.getTime() + 60000).toISOString(),
        attemptInstant,
        row.id,
        attemptInstant,
        attemptInstant,
      )
      .run();
    if (!claimed.meta.changes) continue;
    const inquiry = await env.DB.prepare(
      "SELECT * FROM inquiries WHERE id=? AND retention_delete_after > ?",
    )
      .bind(row.inquiry_id, attemptInstant)
      .first<Inquiry>();
    if (!inquiry) {
      await env.DB.prepare(
        "DELETE FROM notification_outbox WHERE id=? AND lease_token=?",
      )
        .bind(row.id, token)
        .run();
      continue;
    }
    if (row.kind === "owner_stale_inquiry" && inquiry.status !== "new") {
      await env.DB.prepare(
        `UPDATE notification_outbox SET status='sent', last_error='escalation_cancelled', updated_at=?, lease_token=NULL, lease_until=NULL WHERE id=? AND lease_token=?`,
      )
        .bind(attemptInstant, row.id, token)
        .run();
      continue;
    }
    let error: string | null = null;
    try {
      await provider.send(notification(inquiry, row.kind, row.id));
    } catch (e) {
      error = e instanceof MailError ? e.code : "mail_failed";
    }
    const count = row.attempt_count + 1;
    const status = error ? (count >= 5 ? "failed" : "retry") : "sent";
    const next = new Date(
      attemptTime.getTime() + delays[Math.min(count - 1, 3)] * 1000,
    ).toISOString();
    await env.DB.prepare(
      `UPDATE notification_outbox SET status=?, attempt_count=?, next_attempt_at=?, last_attempt_at=?, sent_at=?, last_error=?, updated_at=?, lease_token=NULL, lease_until=NULL WHERE id=? AND lease_token=?`,
    )
      .bind(
        status,
        count,
        next,
        attemptInstant,
        error ? null : attemptInstant,
        error,
        attemptInstant,
        row.id,
        token,
      )
      .run();
    if (status === "failed")
      console.error(JSON.stringify({ event: "notification_dead_letter" }));
  }
}
// UTC weekday hours; weekends do not count. No locale-dependent dates or DST.
export function businessHoursSince(created: Date, now: Date): number {
  let cursor = created.getTime(),
    hours = 0;
  while (cursor < now.getTime()) {
    const day = new Date(cursor),
      end = new Date(cursor);
    end.setUTCHours(24, 0, 0, 0);
    const next = Math.min(end.getTime(), now.getTime());
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6)
      hours += (next - cursor) / 3600000;
    cursor = next;
  }
  return hours;
}
export async function escalate(env: Env, now = new Date()): Promise<void> {
  const time = now.toISOString();
  const rows = await env.DB.prepare(
    `SELECT id,created_at FROM inquiries WHERE status='new' AND created_at <= ? AND retention_delete_after > ? AND NOT EXISTS (SELECT 1 FROM notification_outbox o WHERE o.inquiry_id=inquiries.id AND kind='owner_stale_inquiry') ORDER BY created_at LIMIT 10`,
  )
    .bind(new Date(now.getTime() - 86400000).toISOString(), time)
    .all<{ id: string; created_at: string }>();
  const statements = rows.results
    .filter((r) => businessHoursSince(new Date(r.created_at), now) >= 24)
    .map((r) =>
      env.DB.prepare(
        `INSERT INTO notification_outbox (id,inquiry_id,kind,status,next_attempt_at,created_at,updated_at) SELECT ?,id,'owner_stale_inquiry','pending',?,?,? FROM inquiries WHERE id=? AND status='new' ON CONFLICT(inquiry_id,kind) DO NOTHING`,
      ).bind(crypto.randomUUID(), time, time, time, r.id),
    );
  if (statements.length) await env.DB.batch(statements);
}
export async function purge(env: Env, now = new Date()): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "DELETE FROM notification_outbox WHERE inquiry_id IN (SELECT id FROM inquiries WHERE retention_delete_after <= ?)",
    ).bind(now.toISOString()),
    env.DB.prepare(
      "DELETE FROM inquiries WHERE retention_delete_after <= ?",
    ).bind(now.toISOString()),
  ]);
}
