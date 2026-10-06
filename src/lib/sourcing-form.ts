import {
  calculatorSnapshot,
  Submission,
  trackSourcing,
  type Snapshot,
} from "./sourcing";
import { pipeWeight } from "./calculator";
interface Turnstile {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
    spwcTurnstileReady?: () => void;
  }
}
export function initSourcingForm(): void {
  const root = document.getElementById("sourcing-cta");
  if (!root) return;
  const form = document.getElementById("sourcing-form") as HTMLFormElement;
  const submit = document.getElementById(
    "sourcing-submit",
  ) as HTMLButtonElement;
  const open = document.getElementById("sourcing-open") as HTMLButtonElement;
  const status = document.getElementById("sourcing-status")!;
  const error = document.getElementById("sourcing-error")!;
  const success = document.getElementById("sourcing-success")!;
  const field = (name: string) =>
    form.elements.namedItem(name) as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;
  const submission = new Submission();
  let token = "",
    widget: string | undefined,
    snapshot: Snapshot | undefined,
    started = false,
    busy = false;
  const fail = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };
  const challengeExpired = () => {
    token = "";
    submit.disabled = true;
    status.textContent = "Verification expired. Refreshing challenge…";
    if (widget && window.turnstile) window.turnstile.reset(widget);
  };
  const prefill = () => {
    try {
      snapshot = calculatorSnapshot(document);
      for (const name of [
        "od_mm",
        "wall_mm",
        "density_kg_m3",
        "length_m",
        "quantity_value",
      ] as const) {
        field(name).value = String(snapshot[name]);
      }
      field("quantity_unit").value = "pieces";
      (field("quantity_value") as HTMLInputElement).step = "1";
      (field("quantity_value") as HTMLInputElement).min = "1";
      for (const name of ["od_mm", "wall_mm"])
        (field(name) as HTMLInputElement).readOnly =
          snapshot.calculation_mode === "schedule";
      document.getElementById("sourcing-snapshot")!.textContent =
        snapshot.calculation_mode === "schedule"
          ? `${snapshot.standard_id}-${snapshot.edition}, NPS ${snapshot.nps}, Schedule ${snapshot.schedule_designation}`
          : "Actual dimensions";
      error.hidden = true;
      updateWeight();
    } catch {
      fail(
        "Enter valid calculator values, then use current calculator values.",
      );
    }
  };
  const updateWeight = () => {
    const output = document.getElementById("sourcing-weight")!;
    try {
      const quantity = Number(field("quantity_value").value),
        unit = field("quantity_unit").value;
      const result = pipeWeight({
        odMm: Number(field("od_mm").value),
        wallMm: Number(field("wall_mm").value),
        densityKgM3: Number(field("density_kg_m3").value),
        lengthM: Number(field("length_m").value),
        pieces: 1,
      });
      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        (unit === "pieces" && !Number.isInteger(quantity))
      )
        throw new Error();
      const total =
        result.kgPerM *
        (unit === "pieces"
          ? quantity * Number(field("length_m").value)
          : quantity);
      output.textContent = `Theoretical estimate: ${result.kgPerM.toFixed(2)} kg/m; ${total.toFixed(2)} kg total. The server independently recomputes this estimate.`;
    } catch {
      output.textContent =
        "Enter valid dimensions and quantity to display the theoretical estimate.";
    }
  };
  const render = () => {
    if (!window.turnstile || widget) return;
    widget = window.turnstile.render(
      document.getElementById("sourcing-challenge")!,
      {
        sitekey: root.dataset.sitekey,
        action: "sourcing_inquiry",
        callback: (value: string) => {
          token = value;
          submit.disabled = busy;
          status.textContent = "Verification complete.";
        },
        "expired-callback": challengeExpired,
        "error-callback": () => {
          token = "";
          submit.disabled = true;
          fail(
            "Verification failed. Use Refresh verification and retry. Your data is preserved.",
          );
        },
      },
    );
  };
  const loadChallenge = () => {
    if (window.turnstile) render();
    else if (!document.getElementById("spwc-turnstile-script")) {
      window.spwcTurnstileReady = render;
      const script = document.createElement("script");
      script.id = "spwc-turnstile-script";
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=spwcTurnstileReady&render=explicit";
      script.async = true;
      script.onerror = () =>
        fail(
          "Verification could not load. Your data is preserved. Please retry or use the contact email.",
        );
      document.head.append(script);
    }
  };
  document.getElementById("sourcing-refresh")!.addEventListener("click", () => {
    if (busy) return;
    token = "";
    submit.disabled = true;
    error.hidden = true;
    if (widget && window.turnstile) window.turnstile.reset(widget);
    else {
      document.getElementById("spwc-turnstile-script")?.remove();
      loadChallenge();
    }
  });
  open.addEventListener("click", () => {
    trackSourcing("sourcing_cta_click");
    form.hidden = false;
    open.setAttribute("aria-expanded", "true");
    success.hidden = true;
    if (!snapshot) prefill();
    loadChallenge();
    field("email").focus();
  });
  document
    .getElementById("sourcing-prefill")!
    .addEventListener("click", prefill);
  form.addEventListener("input", () => {
    if (!started) {
      trackSourcing("sourcing_form_start");
      started = true;
    }
    updateWeight();
  });
  field("quantity_unit").addEventListener("change", () => {
    const quantity = field("quantity_value") as HTMLInputElement;
    quantity.step = field("quantity_unit").value === "pieces" ? "1" : "any";
    quantity.min = field("quantity_unit").value === "pieces" ? "1" : "0.001";
    updateWeight();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!snapshot || !token) {
      fail(
        "Use valid calculator values and complete verification before submitting.",
      );
      return;
    }
    const fields: Record<string, unknown> = {
      source_page: "/steel-pipe-weight-calculator/",
      calculation_mode: snapshot.calculation_mode,
      standard_id: snapshot.standard_id,
      edition: snapshot.edition,
      nps: snapshot.nps,
      schedule_designation: snapshot.schedule_designation,
    };
    for (const name of [
      "od_mm",
      "wall_mm",
      "density_kg_m3",
      "length_m",
      "quantity_value",
    ])
      fields[name] = Number(field(name).value);
    for (const name of [
      "quantity_unit",
      "destination_country",
      "email",
      "company",
      "notes",
    ])
      fields[name] = field(name).value;
    busy = true;
    open.disabled = true;
    submit.disabled = true;
    error.hidden = true;
    status.textContent = "Saving request…";
    const editable = Array.from(form.elements).filter(
      (el): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement,
    );
    editable.forEach((el) => (el.disabled = true));
    (
      document.getElementById("sourcing-prefill") as HTMLButtonElement
    ).disabled = true;
    const result = await submission.send(root.dataset.api!, fields, token);
    busy = false;
    open.disabled = false;
    editable.forEach((el) => (el.disabled = false));
    (
      document.getElementById("sourcing-prefill") as HTMLButtonElement
    ).disabled = false;
    token = "";
    if (widget && window.turnstile) window.turnstile.reset(widget);
    submit.disabled = !token;
    if (result.ok) {
      trackSourcing("sourcing_form_success");
      form.reset();
      form.hidden = true;
      success.textContent = `Request received. Inquiry ID: ${result.inquiryId}. Typically within 2 business days.`;
      success.hidden = false;
      snapshot = undefined;
      started = false;
      open.setAttribute("aria-expanded", "false");
      success.focus();
    } else {
      trackSourcing("sourcing_form_fail");
      fail(result.message);
      status.textContent =
        "Your data is preserved. You can retry or contact wbspo1994@gmail.com.";
    }
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        trackSourcing("sourcing_cta_view");
        observer.disconnect();
      }
    });
    observer.observe(root);
  } else trackSourcing("sourcing_cta_view");
}
