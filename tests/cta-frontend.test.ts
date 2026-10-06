import { describe, it, expect, vi } from "vitest";
import {
  Submission,
  CTA_EVENTS,
  trackSourcing,
  calculatorSnapshot,
} from "../src/lib/sourcing";
const id = "11111111-1111-4111-8111-111111111111";
describe("CTA frontend request contract", () => {
  it("reuses idempotency key after ambiguous network failure with a fresh Turnstile token", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error())
      .mockResolvedValueOnce(
        Response.json({ inquiry_id: id }, { status: 201 }),
      );
    const uuid = vi.fn(() => id);
    const submission = new Submission(fetcher, uuid);
    const fields = {
      email: "buyer@example.com",
      company: "Company",
      notes: "notes",
    };
    expect(
      (await submission.send("https://api.example.com", fields, "first")).ok,
    ).toBe(false);
    expect(
      (await submission.send("https://api.example.com", fields, "second")).ok,
    ).toBe(true);
    expect(uuid).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).idempotency_key).toBe(
      JSON.parse(fetcher.mock.calls[1][1].body).idempotency_key,
    );
    expect(JSON.parse(fetcher.mock.calls[1][1].body).turnstile_token).toBe(
      "second",
    );
    expect(fields).toEqual({
      email: "buyer@example.com",
      company: "Company",
      notes: "notes",
    });
  });
  it.each([400, 403, 409, 413, 429, 500, 503])(
    "failure %s does not report success or mutate form data",
    async (status) => {
      const fields = { email: "buyer@example.com", notes: "preserve" };
      const submission = new Submission(
        vi.fn(async () =>
          Response.json({ error: "secret-internal-error" }, { status }),
        ),
        () => id,
      );
      const result = await submission.send(
        "https://api.example.com",
        fields,
        "token",
      );
      expect(result.ok).toBe(false);
      expect(result.message).not.toContain("secret-internal-error");
      expect(fields.notes).toBe("preserve");
    },
  );
  it("rejects malformed success and resets key only after valid 201", async () => {
    const uuid = vi.fn(() => id);
    const submission = new Submission(
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({}, { status: 201 }))
        .mockResolvedValueOnce(
          Response.json({ inquiry_id: id }, { status: 201 }),
        )
        .mockResolvedValueOnce(
          Response.json({ inquiry_id: id }, { status: 201 }),
        ),
      uuid,
    );
    expect((await submission.send("x", {}, "a")).ok).toBe(false);
    expect((await submission.send("x", {}, "b")).ok).toBe(true);
    await submission.send("x", {}, "c");
    expect(uuid).toHaveBeenCalledTimes(2);
  });
  it("CTA analytics have event names only, never PII", () => {
    const target = { dataLayer: [] as Record<string, unknown>[] };
    for (const event of CTA_EVENTS) trackSourcing(event, target);
    expect(target.dataLayer).toEqual(CTA_EVENTS.map((event) => ({ event })));
  });
  it("prefill converts imperial units and reads exact schedule selection without editing calculator", () => {
    const values: Record<string, string> = {
      od: "4.5",
      odUnit: "in",
      wall: "0.25",
      wallUnit: "in",
      len: "20",
      lenUnit: "ft",
      pcs: "10",
      densityPreset: "carbon-steel",
      densityCustom: "7000",
      std: "ASME B36.19",
      nps: "12",
      sched: "40S",
    };
    let schedule = false;
    const doc = {
      getElementById: (key: string) =>
        key === "tabSchedule"
          ? { getAttribute: () => (schedule ? "true" : "false") }
          : key === "spwc-data"
            ? {
                textContent: JSON.stringify([
                  {
                    standardId: "ASME B36.19",
                    edition: "2022",
                    records: [
                      {
                        nps: "12",
                        scheduleDesignation: "40S",
                        availability: "available",
                        odMm: 323.9,
                        wallMm: 9.52,
                      },
                    ],
                  },
                ]),
              }
            : { value: values[key] },
    } as unknown as Document;
    let snapshot = calculatorSnapshot(doc);
    expect(snapshot.od_mm).toBeCloseTo(114.3);
    expect(snapshot.wall_mm).toBeCloseTo(6.35);
    expect(snapshot.length_m).toBeCloseTo(6.096);
    schedule = true;
    snapshot = calculatorSnapshot(doc);
    expect(snapshot.standard_id).toBe("ASME B36.19");
    expect(snapshot.wall_mm).toBe(9.52);
    expect(values.od).toBe("4.5");
  });
});
