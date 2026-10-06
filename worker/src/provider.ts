import type { Env, Inquiry } from "./types";
export interface Notification {
  subject: string;
  text: string;
  html: string;
  replyTo: string;
  key: string;
}
export interface MailProvider {
  send(notification: Notification): Promise<void>;
}
export class MailError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (x) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        x
      ]!,
  );
}
export function notification(
  inquiry: Inquiry,
  kind: string,
  key: string,
): Notification {
  const label =
    kind === "owner_stale_inquiry" ? "SPWC SLA alert" : "SPWC Inquiry";
  const summary = `${inquiry.od_mm} mm OD / ${inquiry.wall_mm} mm wall`;
  const subject = `[${label}] ${inquiry.id} — ${inquiry.destination_country} — ${summary}`;
  const fields = Object.entries(inquiry).filter(
    ([name]) => !["payload_hash", "idempotency_key"].includes(name),
  );
  const text =
    fields.map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n") +
    `\nReply to buyer: ${inquiry.email}`;
  const html = `<h1>${escapeHtml(label)}</h1><dl>${fields.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v ?? "—"))}</dd>`).join("")}</dl><p><a href="mailto:${escapeHtml(encodeURIComponent(inquiry.email))}">Reply to buyer</a></p>`;
  return { subject, text, html, replyTo: inquiry.email, key };
}
export class ResendProvider implements MailProvider {
  constructor(
    private env: Env,
    private request: typeof fetch = (input, init) => fetch(input, init),
  ) {}
  async send(mail: Notification): Promise<void> {
    if (!this.env.RESEND_API_KEY) throw new MailError("mail_unconfigured");
    let res: Response;
    try {
      res = await this.request("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": mail.key,
        },
        body: JSON.stringify({
          from: this.env.RESEND_FROM || "onboarding@resend.dev",
          to: ["wbspo1994@gmail.com"],
          reply_to: mail.replyTo,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new MailError("mail_network_error");
    }
    if (!res.ok) throw new MailError(`mail_http_${res.status}`);
    let data: { id?: unknown };
    try {
      data = await res.json();
    } catch {
      throw new MailError("mail_invalid_response");
    }
    if (typeof data.id !== "string" || !data.id)
      throw new MailError("mail_invalid_response");
  }
}
