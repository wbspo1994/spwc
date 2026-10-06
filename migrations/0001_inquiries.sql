PRAGMA foreign_keys = ON;
CREATE TABLE inquiries (
 id TEXT PRIMARY KEY,
 idempotency_key TEXT UNIQUE NOT NULL,
 payload_hash TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','reviewing','sourced','unsourced','closed')),
 source_page TEXT NOT NULL,
 calculation_mode TEXT NOT NULL CHECK(calculation_mode IN ('actual','schedule')),
 standard_id TEXT, edition TEXT, nps TEXT, schedule_designation TEXT,
 od_mm REAL NOT NULL, wall_mm REAL NOT NULL, density_kg_m3 REAL NOT NULL, length_m REAL NOT NULL,
 theoretical_kg_m REAL NOT NULL, theoretical_total_kg REAL NOT NULL,
 quantity_value REAL NOT NULL,
 quantity_unit TEXT NOT NULL CHECK(quantity_unit IN ('pieces','total_length')),
 destination_country TEXT NOT NULL, email TEXT NOT NULL, company TEXT, notes TEXT,
 handled_at TEXT, closed_at TEXT, closure_reason TEXT,
 retention_delete_after TEXT NOT NULL
);
CREATE TABLE notification_outbox (
 id TEXT PRIMARY KEY,
 inquiry_id TEXT NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
 kind TEXT NOT NULL DEFAULT 'owner_new_inquiry' CHECK(kind IN ('owner_new_inquiry','owner_stale_inquiry')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','retry','sent','failed')),
 attempt_count INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL, last_attempt_at TEXT, sent_at TEXT, last_error TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 lease_token TEXT, lease_until TEXT,
 UNIQUE(inquiry_id, kind)
);
CREATE INDEX inquiries_created_at ON inquiries(created_at);
CREATE INDEX inquiries_status_created_at ON inquiries(status, created_at);
CREATE INDEX inquiries_email ON inquiries(email);
CREATE INDEX inquiries_retention ON inquiries(retention_delete_after);
CREATE INDEX outbox_due ON notification_outbox(status, next_attempt_at);
