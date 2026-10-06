import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
async function control(request: APIRequestContext, path: string) {
  const response = await request.post(`http://127.0.0.1:8790/${path}`);
  expect(response.ok()).toBeTruthy();
}
async function status(request: APIRequestContext) {
  return (await request.get("http://127.0.0.1:8790/status")).json();
}
async function open(page: Page) {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js**",
    (route) =>
      route.fulfill({
        contentType: "application/javascript",
        body: `window.turnstile={render(el,options){window.testChallenge=options;setTimeout(()=>options.callback(crypto.randomUUID()),0);return 'test-widget';},reset(){setTimeout(()=>window.testChallenge.callback(crypto.randomUUID()),0);}};window.spwcTurnstileReady();`,
      }),
  );
  await page.goto("/steel-pipe-weight-calculator/");
  await page.evaluate(() => {
    (window as any).dataLayer = [];
  });
  await page
    .getByRole("button", { name: "Request sourcing assistance", exact: true })
    .click();
  await page.locator('[name="destination_country"]').fill("US");
  await page.locator('[name="email"]').fill("buyer@example.com");
  await page.locator('[name="company"]').fill("<img src=x onerror=alert(1)>");
  await page.locator('[name="notes"]').fill("Please quote these pipes.");
  await expect(page.locator("#sourcing-submit")).toBeEnabled();
}
test.beforeEach(async ({ request }) => control(request, "reset"));
test("valid form persists to real local D1 and records owner notification; calculator stays unchanged", async ({
  page,
  request,
}) => {
  await open(page);
  const before = await page.locator("#rTotal").textContent();
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-success")).toContainText(
    "Request received",
  );
  await expect(page.locator("#sourcing-success")).toContainText(
    "Typically within 2 business days",
  );
  const data = await status(request);
  expect(data.inquiries).toHaveLength(1);
  expect(data.outbox).toHaveLength(1);
  expect(data.inquiries[0].email).toBe("buyer@example.com");
  expect(data.inquiries[0].od_mm).toBe(114.3);
  expect(await page.locator("#rTotal").textContent()).toBe(before);
  await expect.poll(async () => (await status(request)).mailCount).toBe(1);
  await expect(page.locator('[name="email"]')).toHaveValue("");
  const events = await page.evaluate(() =>
    (window as any).dataLayer.filter((p: any) =>
      p.event.startsWith("sourcing_"),
    ),
  );
  expect(events.map((e: any) => e.event)).toContain("sourcing_form_success");
  expect(events.every((e: any) => Object.keys(e).length === 1)).toBeTruthy();
});
test("atomic D1 failure preserves all fields and retry succeeds without duplicate", async ({
  page,
  request,
}) => {
  await control(request, "d1-fail");
  await open(page);
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-error")).toContainText("preserved");
  for (const [name, value] of [
    ["email", "buyer@example.com"],
    ["company", "<img src=x onerror=alert(1)>"],
    ["notes", "Please quote these pipes."],
    ["destination_country", "US"],
    ["quantity_value", "10"],
    ["od_mm", "114.3"],
    ["wall_mm", "6"],
    ["density_kg_m3", "7850"],
    ["length_m", "6"],
  ])
    await expect(page.locator(`[name="${name}"]`)).toHaveValue(value);
  expect((await status(request)).inquiries).toHaveLength(0);
  expect((await status(request)).outbox).toHaveLength(0);
  await expect(page.locator("#sourcing-success")).toBeHidden();
  await control(request, "d1-ok");
  await expect(page.locator("#sourcing-submit")).toBeEnabled();
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-success")).toContainText(
    "Request received",
  );
  expect((await status(request)).inquiries).toHaveLength(1);
});
test("provider failure never reverses customer success", async ({
  page,
  request,
}) => {
  await control(request, "mail-fail");
  await open(page);
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-success")).toContainText(
    "Request received",
  );
  await expect
    .poll(async () => (await status(request)).outbox[0]?.status)
    .toBe("retry");
  expect((await status(request)).inquiries).toHaveLength(1);
  await control(request, "mail-ok");
  await control(request, "retry");
  await expect
    .poll(async () => (await status(request)).outbox[0]?.status)
    .toBe("sent");
  expect((await status(request)).inquiries).toHaveLength(1);
});
test("lost 201 response retry uses same inquiry ID/key with a fresh challenge", async ({
  page,
  request,
}) => {
  await open(page);
  let firstId: string | undefined;
  let firstKey: string | undefined;
  let tries = 0;
  await page.route("http://127.0.0.1:8788/v1/inquiries", async (route) => {
    tries++;
    const body = route.request().postDataJSON();
    if (tries === 1) {
      firstKey = body.idempotency_key;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      firstId = (await response.json()).inquiry_id;
      await route.abort("failed");
    } else {
      expect(body.idempotency_key).toBe(firstKey);
      await route.continue();
    }
  });
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-error")).toContainText("preserved");
  await expect(page.locator('[name="email"]')).toHaveValue("buyer@example.com");
  await expect(page.locator("#sourcing-submit")).toBeEnabled();
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-success")).toContainText(firstId!);
  expect((await status(request)).inquiries).toHaveLength(1);
});
test("expiry refresh preserves form, schedule prefill remains exact and analytics have no PII", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    (window as any).testChallenge["expired-callback"](),
  );
  await expect(page.locator('[name="email"]')).toHaveValue("buyer@example.com");
  await expect(page.locator("#sourcing-submit")).toBeEnabled();
  await page.getByRole("tab", { name: "NPS / Schedule" }).click();
  await page.locator("#std").selectOption("ASME B36.19");
  await page.locator("#nps").selectOption("12");
  await page.locator("#sched").selectOption("40S");
  await page.locator("#sourcing-prefill").click();
  await expect(page.locator('[name="wall_mm"]')).toHaveValue("9.52");
  await expect(page.locator('[name="od_mm"]')).toHaveValue("323.8");
  await expect(page.locator('[name="wall_mm"]')).toHaveAttribute(
    "readonly",
    "",
  );
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-success")).toContainText(
    "Request received",
  );
  const events = await page.evaluate(() =>
    (window as any).dataLayer.filter((e: any) =>
      e.event.startsWith("sourcing_"),
    ),
  );
  expect(events.every((e: any) => Object.keys(e).length === 1)).toBeTruthy();
});

test("real D1 scheduled escalation, private R2 backup/restore and retention", async ({
  page,
  request,
}) => {
  await open(page);
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-success")).toContainText(
    "Request received",
  );
  await expect
    .poll(async () => (await status(request)).outbox[0]?.status)
    .toBe("sent");
  await control(request, "stale");
  await control(request, "retry");
  await control(request, "retry");
  expect(
    (await status(request)).outbox.filter(
      (o: any) => o.kind === "owner_stale_inquiry",
    ),
  ).toHaveLength(1);
  await control(request, "daily");
  expect((await status(request)).backups).toBe(1);
  const restore = await request.post("http://127.0.0.1:8790/restore");
  expect(restore.ok()).toBeTruthy();
  expect((await restore.json()).restored).toBe(1);
  await control(request, "expire");
  await control(request, "daily");
  const final = await status(request);
  expect(final.inquiries).toHaveLength(0);
  expect(final.outbox).toHaveLength(0);
});

test("invalid challenge is rejected; refresh keeps contact data and submits successfully", async ({
  page,
  request,
}) => {
  await open(page);
  await page.evaluate(() =>
    (window as any).testChallenge.callback("invalid-test-token"),
  );
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-error")).toContainText("Refresh");
  await expect(page.locator('[name="email"]')).toHaveValue("buyer@example.com");
  expect((await status(request)).inquiries).toHaveLength(0);
  await page
    .getByRole("button", { name: "Refresh verification", exact: true })
    .click();
  await expect(page.locator("#sourcing-submit")).toBeEnabled();
  await page.locator("#sourcing-submit").click();
  await expect(page.locator("#sourcing-success")).toContainText(
    "Request received",
  );
});
