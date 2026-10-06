import type { Env, Inquiry, Outbox } from "./types";
export const BACKUP_GRACE_DAYS = 7;
export async function backup(env: Env, now = new Date()): Promise<void> {
  if (env.BACKUPS_ENABLED !== "true") return;
  if (!env.BACKUPS) throw new Error("backup_binding_missing");
  // D1 batch reads share a consistent transaction snapshot. Only unexpired data is exported.
  const [inquiries, outbox] = await env.DB.batch([
    env.DB.prepare(
      "SELECT * FROM inquiries WHERE retention_delete_after > ? ORDER BY id",
    ).bind(now.toISOString()),
    env.DB.prepare(
      "SELECT o.* FROM notification_outbox o JOIN inquiries i ON i.id=o.inquiry_id WHERE i.retention_delete_after > ? ORDER BY o.id",
    ).bind(now.toISOString()),
  ]);
  const key = `daily/${now.toISOString()}.json`;
  await env.BACKUPS.put(
    key,
    JSON.stringify({
      version: 1,
      created_at: now.toISOString(),
      inquiries: inquiries.results,
      outbox: outbox.results,
    }),
    { httpMetadata: { contentType: "application/json" } },
  );
  await pruneBackups(env, now);
}
export async function pruneBackups(env: Env, now = new Date()): Promise<void> {
  if (!env.BACKUPS) return;
  let cursor: string | undefined;
  do {
    const page = await env.BACKUPS.list({ prefix: "daily/", cursor });
    const cutoff = now.getTime() - BACKUP_GRACE_DAYS * 86400000;
    const keys = page.objects
      .filter((o) => o.uploaded.getTime() <= cutoff)
      .map((o) => o.key);
    if (keys.length) await env.BACKUPS.delete(keys);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}
// Operator-only helper, no public restore route. Caller must use a fresh isolated database.
export async function restoreBackup(
  db: D1Database,
  content: string,
  now = new Date(),
): Promise<void> {
  const data = JSON.parse(content) as {
    version: number;
    inquiries: Inquiry[];
    outbox: Outbox[];
  };
  if (
    data.version !== 1 ||
    !Array.isArray(data.inquiries) ||
    !Array.isArray(data.outbox)
  )
    throw new Error("invalid_backup");
  const inquiryColumns = [
    "id",
    "idempotency_key",
    "payload_hash",
    "created_at",
    "updated_at",
    "status",
    "source_page",
    "calculation_mode",
    "standard_id",
    "edition",
    "nps",
    "schedule_designation",
    "od_mm",
    "wall_mm",
    "density_kg_m3",
    "length_m",
    "theoretical_kg_m",
    "theoretical_total_kg",
    "quantity_value",
    "quantity_unit",
    "destination_country",
    "email",
    "company",
    "notes",
    "handled_at",
    "closed_at",
    "closure_reason",
    "retention_delete_after",
  ] as const;
  const outboxColumns = [
    "id",
    "inquiry_id",
    "kind",
    "status",
    "attempt_count",
    "next_attempt_at",
    "last_attempt_at",
    "sent_at",
    "last_error",
    "created_at",
    "updated_at",
    "lease_token",
    "lease_until",
  ] as const;
  const valid = data.inquiries.filter(
    (i) => i.retention_delete_after > now.toISOString(),
  );
  const ids = new Set(valid.map((i) => i.id));
  const statements = valid.map((i) =>
    db
      .prepare(
        `INSERT INTO inquiries (${inquiryColumns.join(",")}) VALUES (${inquiryColumns.map(() => "?").join(",")})`,
      )
      .bind(...inquiryColumns.map((k) => i[k])),
  );
  statements.push(
    ...data.outbox
      .filter((o) => ids.has(o.inquiry_id))
      .map((o) =>
        db
          .prepare(
            `INSERT INTO notification_outbox (${outboxColumns.join(",")}) VALUES (${outboxColumns.map(() => "?").join(",")})`,
          )
          .bind(
            ...outboxColumns.map((k) =>
              k === "lease_token" || k === "lease_until" ? null : o[k],
            ),
          ),
      ),
  );
  // Bound transaction size; operators must export larger databases through D1's supported tooling.
  if (statements.length > 1000)
    throw new Error("backup_requires_operator_restore");
  if (statements.length) await db.batch(statements);
}
