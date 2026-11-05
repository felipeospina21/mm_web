import { expect, test } from "./_support/fixtures";
import {
  actionsMenuItem,
  clickAction,
  editProductName,
  pickClient,
  readProductName,
  resolveAndLoadIntoEditor,
} from "./_support/editor";
import { mockClientList, mockResolveReferences } from "./_support/mock-external";
import {
  MOCK_CLIENT,
  MOCK_PRODUCTS,
} from "./_support/test-data";

/**
 * Task 6.1 — SKU lookup → create quotation (flow entry).
 * Task 6.2 — Edit data in the editor (edit → undo → redo).
 *
 * Both the client list (`customer.list`) and the external SKU resolver
 * (`product.resolveReferences`) are mocked at the tRPC boundary, so these specs
 * touch no DB rows and call no live external API → no teardown needed.
 *
 * The editor renders to one Konva <canvas>, so page structure is asserted via
 * the `data-page-count` hook on `[data-testid="quotation-canvas"]`, and element
 * values are read back through the DOM inline editor (see `_support/editor.ts`).
 */

test.describe("lookup → create quotation (6.1)", () => {
  test.beforeEach(async ({ page }) => {
    await mockClientList(page, [MOCK_CLIENT]);
  });

  test("all resolved: loads one product page per SKU into the editor", async ({
    page,
  }) => {
    await mockResolveReferences(page, {
      resolved: MOCK_PRODUCTS,
      unresolved: [],
    });

    await page.goto("/");
    await pickClient(page, /e2e cliente prueba/i);
    await page.locator("#references").fill("e2e-1, e2e-2");
    await page.getByRole("button", { name: "Buscar referencias" }).click();

    await expect(page.getByText("2 de 2 referencias encontradas")).toBeVisible();
    // Mocked names prove the lookup was served by the stub, not a live call.
    await expect(page.getByText("Producto E2E Uno")).toBeVisible();
    await expect(page.getByText("Producto E2E Dos")).toBeVisible();

    await page.getByRole("button", { name: "Cargar en el editor" }).click();

    await expect(page).toHaveURL(/\/editor$/);
    await expect(
      page.getByRole("heading", { name: "Editor de cotizaciones" }),
    ).toBeVisible();
    // 2 product pages + the fixed policies page.
    await expect(page.getByTestId("quotation-canvas")).toHaveAttribute(
      "data-page-count",
      "3",
    );
    // Unsaved draft: no DB-assigned number yet.
    await expect(page.getByText("Borrador")).toBeVisible();
  });

  test("manual start: opens a blank draft for the selected client", async ({
    page,
  }) => {
    await page.goto("/");

    // Requires a client first.
    await expect(
      page.getByRole("button", { name: "Crear cotización manual" }),
    ).toBeDisabled();

    await pickClient(page, /e2e cliente prueba/i);
    await page.getByRole("button", { name: "Crear cotización manual" }).click();

    await expect(page).toHaveURL(/\/editor$/);
    // Header page + policies page, no product pages.
    await expect(page.getByTestId("quotation-canvas")).toHaveAttribute(
      "data-page-count",
      "2",
    );
    await expect(page.getByText("Borrador")).toBeVisible();

    // Client handoff reached the editor; the one-shot manual flag was consumed.
    const handoff = await page.evaluate(() => ({
      client: window.sessionStorage.getItem("mm_draft_quotation_client"),
      manual: window.sessionStorage.getItem("mm_pending_manual_quotation"),
    }));
    expect(handoff.client).toBe(MOCK_CLIENT.id);
    expect(handoff.manual).toBeNull();
  });
});

test.describe("edit data in the editor (6.2)", () => {
  // The template numbers the product line ("1. <name>").
  const original = "1. Producto E2E Uno";
  const edited = "1. Producto E2E Editado";

  test.beforeEach(async ({ page }) => {
    await mockClientList(page, [MOCK_CLIENT]);
    await mockResolveReferences(page, {
      resolved: MOCK_PRODUCTS,
      unresolved: [],
    });
    await page.goto("/");
    await pickClient(page, /e2e cliente prueba/i);
    await resolveAndLoadIntoEditor(page);
  });

  // NOTE: reading a value via the inline editor is NOT side-effect free — the
  // app commits on close even when the text is unchanged, which marks the draft
  // dirty and pushes an undo step (observed while writing these specs). So
  // undo/redo is asserted through button enablement + dirty state, and a value
  // is read back only as the LAST step of each test.

  test("edit → undo → redo toggles dirty state and undo/redo availability", async ({
    page,
  }) => {
    await expect(page.getByText("Cambios sin guardar")).toBeHidden();
    await expect(await actionsMenuItem(page, "Deshacer")).toBeDisabled();
    await page.keyboard.press("Escape");

    await editProductName(page, edited);
    await expect(page.getByText("Cambios sin guardar")).toBeVisible();
    await expect(await actionsMenuItem(page, "Deshacer")).toBeEnabled();
    await expect(await actionsMenuItem(page, "Rehacer")).toBeDisabled();

    // Undo → back at the initial snapshot: nothing to undo, redo available.
    await clickAction(page, "Deshacer");
    await expect(await actionsMenuItem(page, "Deshacer")).toBeDisabled();
    await expect(await actionsMenuItem(page, "Rehacer")).toBeEnabled();

    // Redo → edit reapplied: undo available again, nothing to redo.
    await clickAction(page, "Rehacer");
    await expect(await actionsMenuItem(page, "Deshacer")).toBeEnabled();
    await expect(await actionsMenuItem(page, "Rehacer")).toBeDisabled();
    await page.keyboard.press("Escape");

    expect(await readProductName(page)).toBe(edited);
  });

  test("undo restores the original product name", async ({ page }) => {
    await editProductName(page, edited);
    await clickAction(page, "Deshacer");
    expect(await readProductName(page)).toBe(original);
  });
});
