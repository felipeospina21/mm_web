import { readFile, stat } from "node:fs/promises";

import type { Page } from "@playwright/test";

import { getQuotationsForUser } from "./_support/db";
import { resolveAndLoadIntoEditor } from "./_support/editor";
import { expect, test } from "./_support/fixtures";
import { mockResolveReferences } from "./_support/mock-external";
import { MOCK_PRODUCTS } from "./_support/test-data";

/**
 * Task 6.3 — Save a quotation (the only DB-writing flow).
 * Task 6.4 — PDF export (flow finish).
 *
 * Save is checked server-side against a client the user owns, so these specs
 * use the REAL `customer.list` / `customer.create` and create an `[E2E]`-tagged
 * client through the UI. Only `product.resolveReferences` is mocked. Every row
 * is removed by the `created` fixture (scoped to the e2e user_id) after each
 * test, with global teardown as the crash backstop.
 *
 * Export is only enabled once the quotation is saved (`disabled={!saved}`), so
 * 6.4 saves first too.
 */

/** Unique per run so leftovers from a crashed run can't collide. */
const clientName = () => `[E2E] cliente ${Date.now()}`;

/** Create + auto-select an `[E2E]` client from the home-page picker. */
async function createE2eClient(page: Page, name: string): Promise<void> {
  await page.getByRole("combobox", { name: "Cliente" }).click();
  await page.getByRole("button", { name: "Agregar cliente nuevo" }).click();

  const form = page.locator("form", {
    has: page.getByRole("heading", { name: "Agregar cliente" }),
  });
  // Role + accessible name (the required "*" marker is aria-hidden, but
  // getByLabel matches raw label text, which includes it).
  const field = (name: string) =>
    form.getByRole("textbox", { name, exact: true });
  await field("Nombre Empresa").fill(name);
  await field("Nombre de contacto").fill("E2E Contacto");
  await field("Teléfono de contacto").fill("3000000000");
  await field("Correo de contacto").fill("e2e-contacto@test.local");
  await form.getByRole("button", { name: "Crear cliente" }).click();
  await expect(form).toBeHidden();
}

/** Home → create client → lookup → editor → Save. Returns the quotation no. */
async function saveNewQuotation(
  page: Page,
  created: { quotationIds: string[]; createdClient: boolean },
): Promise<string> {
  await mockResolveReferences(page, { resolved: MOCK_PRODUCTS, unresolved: [] });
  await page.goto("/");

  // Flag cleanup BEFORE writing, so a mid-test failure still sweeps the rows.
  created.createdClient = true;
  await createE2eClient(page, clientName());
  await resolveAndLoadIntoEditor(page);

  created.quotationIds.push("pending");
  const save = page.getByRole("button", { name: "Guardar cotización" });
  await expect(save).toBeEnabled();
  await save.click();

  const badge = page.getByText(/^Cotización n\.º M\d+$/);
  await expect(badge).toBeVisible();
  const quotationNumber = (await badge.textContent())!.replace(
    "Cotización n.º ",
    "",
  );
  return quotationNumber;
}

test.describe("save a quotation (6.3)", () => {
  test("persists the quotation for the e2e user and clears dirty state", async ({
    page,
    created,
    e2eUserId,
  }) => {
    const quotationNumber = await saveNewQuotation(page, created);

    await expect(page.getByText("Borrador")).toBeHidden();
    await expect(page.getByText("Cambios sin guardar")).toBeHidden();
    // Saved → the toolbar switches to the update label and export unlocks.
    await expect(page.getByRole("button", { name: "Guardar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar a PDF" })).toBeEnabled();

    const rows = await getQuotationsForUser(e2eUserId);
    const row = rows.find((r) => r.quotationNumber === quotationNumber);
    expect(row, `quotation ${quotationNumber} persisted`).toBeDefined();
    created.quotationIds.push(row!.id);
    expect(row!.clientId).not.toBeNull();
    expect(row!.productCount).toBe(MOCK_PRODUCTS.length);
    expect(row!.references).toEqual(
      expect.arrayContaining(MOCK_PRODUCTS.map((p) => p.reference)),
    );
  });
});

test.describe("PDF export (6.4)", () => {
  test("downloads a non-empty PDF named after the quotation and client", async ({
    page,
    created,
  }) => {
    const quotationNumber = await saveNewQuotation(page, created);

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar a PDF" }).click();
    const file = await download;

    expect(file.suggestedFilename()).toMatch(
      new RegExp(
        `^Cotización N°${quotationNumber} - \\[E2E\\] CLIENTE \\d+ - Magic Medios SAS\\.pdf$`,
      ),
    );
    const path = await file.path();
    expect((await stat(path)).size).toBeGreaterThan(0);
    // Export wiring, not fidelity: only check it's a PDF (magic bytes).
    const head = (await readFile(path)).subarray(0, 5).toString("latin1");
    expect(head).toBe("%PDF-");
  });
});
