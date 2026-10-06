export interface Env {
  DB: D1Database;
  INQUIRY_RATE_LIMITER: {
    limit(input: { key: string }): Promise<{ success: boolean }>;
  };
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_HOSTNAME: string;
  TURNSTILE_ACTION?: string;
  ALLOWED_ORIGIN?: string;
  RESEND_API_KEY: string;
  RESEND_FROM?: string;
  BACKUPS?: R2Bucket;
  BACKUPS_ENABLED?: string;
}
export interface Inquiry {
  id: string;
  idempotency_key: string;
  payload_hash: string;
  created_at: string;
  updated_at: string;
  status: string;
  source_page: string;
  calculation_mode: "actual" | "schedule";
  standard_id: string | null;
  edition: string | null;
  nps: string | null;
  schedule_designation: string | null;
  od_mm: number;
  wall_mm: number;
  density_kg_m3: number;
  length_m: number;
  theoretical_kg_m: number;
  theoretical_total_kg: number;
  quantity_value: number;
  quantity_unit: "pieces" | "total_length";
  destination_country: string;
  email: string;
  company: string | null;
  notes: string | null;
  handled_at: string | null;
  closed_at: string | null;
  closure_reason: string | null;
  retention_delete_after: string;
}
export interface Outbox {
  id: string;
  inquiry_id: string;
  kind: string;
  status: string;
  attempt_count: number;
  next_attempt_at: string;
  last_attempt_at: string | null;
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  lease_token: string | null;
  lease_until: string | null;
}
