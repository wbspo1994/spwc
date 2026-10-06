import b10 from "../../src/data/b36.10-2022.json";
import b19 from "../../src/data/b36.19-2022.json";
import { pipeWeight } from "../../src/lib/calculator";
import type { Inquiry } from "./types";

export class InvalidInput extends Error {}
const invalid = (): never => {
  throw new InvalidInput("Please check the inquiry fields.");
};
function text(value: unknown, max: number, required = true): string | null {
  if (value == null && !required) return null;
  if (typeof value !== "string") return invalid();
  const v = value.trim().normalize("NFC");
  if (
    v.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v) ||
    (required && !v)
  )
    return invalid();
  return v || null;
}
function number(value: unknown, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > max
  )
    return invalid();
  return value;
}
export function normalize(input: Record<string, unknown>) {
  const idempotency_key = text(input.idempotency_key, 36)!;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      idempotency_key,
    )
  )
    return invalid();
  const calculation_mode = input.calculation_mode;
  if (calculation_mode !== "actual" && calculation_mode !== "schedule")
    return invalid();
  const quantity_unit = input.quantity_unit;
  if (quantity_unit !== "pieces" && quantity_unit !== "total_length")
    return invalid();
  const quantity_value = number(input.quantity_value, 1e7);
  if (quantity_unit === "pieces" && !Number.isInteger(quantity_value))
    return invalid();
  const od_mm = number(input.od_mm, 10000),
    wall_mm = number(input.wall_mm, 5000);
  const density_kg_m3 = number(input.density_kg_m3, 30000),
    length_m = number(input.length_m, 10000);
  if (2 * wall_mm >= od_mm) return invalid();
  let standard_id: string | null = null,
    edition: string | null = null,
    nps: string | null = null,
    schedule_designation: string | null = null;
  if (calculation_mode === "schedule") {
    standard_id = text(input.standard_id, 32);
    edition = text(input.edition, 16);
    nps = text(input.nps, 16);
    schedule_designation = text(input.schedule_designation, 16);
    const dataset = [b10, b19].find(
      (d) => d.standardId === standard_id && d.edition === edition,
    );
    const record = dataset?.records.find(
      (r) =>
        r.nps === nps &&
        r.scheduleDesignation === schedule_designation &&
        r.availability === "available" &&
        !["pending", "failed"].includes(r.verificationStatus),
    );
    if (
      !record ||
      Math.abs(record.odMm - od_mm) > 1e-8 ||
      Math.abs(record.wallMm - wall_mm) > 1e-8
    )
      return invalid();
  }
  const email = text(input.email, 254)!.toLowerCase();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) || /[\r\n]/.test(email))
    return invalid();
  const destination_country = text(input.destination_country, 2)!.toUpperCase();
  // Two-letter ISO 3166-1 country codes; no guessed or arbitrary destination labels.
  const countries =
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
      " ",
    );
  if (!countries.includes(destination_country)) return invalid();
  const source_page = text(input.source_page, 128)!;
  if (source_page !== "/steel-pipe-weight-calculator/") return invalid();
  const company = text(input.company, 200, false),
    notes = text(input.notes, 2000, false);
  if (input.website != null && input.website !== "") return invalid();
  const weight = pipeWeight({
    odMm: od_mm,
    wallMm: wall_mm,
    densityKgM3: density_kg_m3,
    lengthM: length_m,
    pieces: 1,
  });
  const theoretical_total_kg =
    weight.kgPerM *
    (quantity_unit === "pieces" ? quantity_value * length_m : quantity_value);
  if (!Number.isFinite(theoretical_total_kg)) return invalid();
  return {
    idempotency_key: idempotency_key.toLowerCase(),
    source_page,
    calculation_mode: calculation_mode as "actual" | "schedule",
    standard_id,
    edition,
    nps,
    schedule_designation,
    od_mm,
    wall_mm,
    density_kg_m3,
    length_m,
    theoretical_kg_m: weight.kgPerM,
    theoretical_total_kg,
    quantity_value,
    quantity_unit: quantity_unit as "pieces" | "total_length",
    destination_country,
    email,
    company,
    notes,
  };
}
export async function fingerprint(
  value: ReturnType<typeof normalize>,
): Promise<string> {
  const { idempotency_key: _, ...material } = value;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(material)),
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export function retentionDate(now: Date): string {
  const year = now.getUTCFullYear() + 1,
    month = now.getUTCMonth();
  const date = new Date(now);
  date.setUTCDate(1);
  date.setUTCFullYear(year);
  date.setUTCMonth(month);
  date.setUTCDate(
    Math.min(
      now.getUTCDate(),
      new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
    ),
  );
  return date.toISOString();
}
export function makeInquiry(
  value: ReturnType<typeof normalize>,
  hash: string,
  now: Date,
): Inquiry {
  return {
    id: crypto.randomUUID(),
    ...value,
    payload_hash: hash,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    status: "new",
    handled_at: null,
    closed_at: null,
    closure_reason: null,
    retention_delete_after: retentionDate(now),
  };
}
