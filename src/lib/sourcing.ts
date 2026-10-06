import { trackEvent, type AnalyticsTarget } from "./analytics";
import { pipeWeight } from "./calculator";
import { toMm, toM } from "./units";
export const CTA_EVENTS = [
  "sourcing_cta_view",
  "sourcing_cta_click",
  "sourcing_form_start",
  "sourcing_form_success",
  "sourcing_form_fail",
] as const;
export function trackSourcing(
  name: (typeof CTA_EVENTS)[number],
  target?: AnalyticsTarget,
): void {
  // No caller-supplied properties: contact data cannot flow into CTA analytics.
  trackEvent(name, {}, target);
}
export interface Snapshot {
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
}
export function calculatorSnapshot(doc: Document): Snapshot {
  const value = (id: string) =>
    (doc.getElementById(id) as HTMLInputElement).value;
  const mode =
    doc.getElementById("tabSchedule")?.getAttribute("aria-selected") === "true"
      ? "schedule"
      : "actual";
  let od = toMm(Number(value("od")), value("odUnit") as "mm" | "in"),
    wall = toMm(Number(value("wall")), value("wallUnit") as "mm" | "in");
  let standard_id: string | null = null,
    edition: string | null = null,
    nps: string | null = null,
    schedule_designation: string | null = null;
  if (mode === "schedule") {
    const datasets = JSON.parse(doc.getElementById("spwc-data")!.textContent!);
    const ds = datasets.find(
      (d: { standardId: string }) => d.standardId === value("std"),
    );
    const row = ds?.records.find(
      (r: { nps: string; scheduleDesignation: string; availability: string }) =>
        r.nps === value("nps") &&
        r.scheduleDesignation === value("sched") &&
        r.availability === "available",
    );
    if (!row) throw new Error("Choose available calculator dimensions first.");
    od = row.odMm;
    wall = row.wallMm;
    standard_id = ds.standardId;
    edition = ds.edition;
    nps = row.nps;
    schedule_designation = row.scheduleDesignation;
  }
  const density =
    value("densityPreset") === "custom" ? Number(value("densityCustom")) : 7850;
  const length = toM(Number(value("len")), value("lenUnit") as "m" | "ft"),
    pieces = Number(value("pcs"));
  const weight = pipeWeight({
    odMm: od,
    wallMm: wall,
    densityKgM3: density,
    lengthM: length,
    pieces,
  });
  return {
    calculation_mode: mode,
    standard_id,
    edition,
    nps,
    schedule_designation,
    od_mm: od,
    wall_mm: wall,
    density_kg_m3: density,
    length_m: length,
    theoretical_kg_m: weight.kgPerM,
    theoretical_total_kg: weight.totalKg,
    quantity_value: pieces,
  };
}
export class Submission {
  private material = "";
  private key = "";
  constructor(
    private request: typeof fetch = (input, init) => fetch(input, init),
    private uuid: () => string = () => crypto.randomUUID(),
  ) {}
  async send(
    endpoint: string,
    fields: Record<string, unknown>,
    token: string,
  ): Promise<{
    ok: boolean;
    inquiryId?: string;
    message: string;
    status: number;
  }> {
    const material = JSON.stringify(fields);
    if (material !== this.material) {
      this.material = material;
      this.key = this.uuid();
    }
    try {
      const response = await this.request(`${endpoint}/v1/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          idempotency_key: this.key,
          turnstile_token: token,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (
        response.status === 201 &&
        typeof result.inquiry_id === "string" &&
        /^[0-9a-f-]{36}$/i.test(result.inquiry_id)
      ) {
        this.material = "";
        this.key = "";
        return {
          ok: true,
          inquiryId: result.inquiry_id,
          message: "Request received",
          status: 201,
        };
      }
      const message =
        response.status === 403
          ? "Refresh the verification challenge and retry."
          : response.status === 429
            ? "Too many requests. Please wait before retrying."
            : response.status === 409
              ? "This request differs from an earlier submission. Review your data before starting a new request."
              : response.status === 400 || response.status === 413
                ? "Check the form fields and retry."
                : "Request could not be confirmed. Your data is preserved; please retry.";
      return { ok: false, message, status: response.status };
    } catch {
      return {
        ok: false,
        message:
          "Request could not be confirmed. Your data is preserved; please retry.",
        status: 0,
      };
    }
  }
}
