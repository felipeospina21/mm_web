import { expect, type Page } from "@playwright/test";

import { MOCK_SKUS } from "./test-data";

/**
 * Editor/lookup page helpers shared by the e2e specs (Tasks 6.1–6.4).
 *
 * The editor draws everything on one Konva <canvas>, so element interaction is
 * done by coordinates derived from the (fixed) template geometry, and values
 * are READ BACK through the DOM inline editor (a <textarea>) rather than pixels.
 */

/** Pick the (already listed) client in the home-page combobox by label. */
export async function pickClient(page: Page, label: RegExp): Promise<void> {
  await page.getByRole("combobox", { name: "Cliente" }).click();
  await page.getByRole("button", { name: label }).click();
}

/** Type SKUs, resolve them (mocked) and hand the result to the editor. */
export async function resolveAndLoadIntoEditor(page: Page): Promise<void> {
  await page.locator("#references").fill(MOCK_SKUS);
  await page.getByRole("button", { name: "Buscar referencias" }).click();
  await page.getByRole("button", { name: "Cargar en el editor" }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.getByTestId("quotation-canvas")).toHaveAttribute(
    "data-page-count",
    "3",
  );
}

/**
 * Template geometry of page 1's `product-name` text element
 * (`template-data.ts` `makeProductElements`) and the page's stage offset
 * (`getPageOffset(1)` = 40,40). Update if the template layout changes.
 */
const PAGE_OFFSET = { x: 40, y: 40 };
const PRODUCT_NAME_BOX = { x: 40, y: 220, width: 600, height: 40 };

/** Screen point at the centre of page 1's product-name element (scroll 0). */
async function productNamePoint(page: Page): Promise<{ x: number; y: number }> {
  const stage = page.locator(".konvajs-content").first();
  const box = await stage.boundingBox();
  if (!box) throw new Error("Konva stage not rendered");
  return {
    x: box.x + PAGE_OFFSET.x + PRODUCT_NAME_BOX.x + PRODUCT_NAME_BOX.width / 2,
    y: box.y + PAGE_OFFSET.y + PRODUCT_NAME_BOX.y + PRODUCT_NAME_BOX.height / 2,
  };
}

/** Double-click the product name to open its inline editor; returns it. */
export async function openProductNameEditor(page: Page) {
  const { x, y } = await productNamePoint(page);
  await page.mouse.dblclick(x, y);
  const editor = page.locator("textarea");
  await expect(editor).toBeVisible();
  return editor;
}

/**
 * Click empty stage margin (left of the page) to deselect. The selected
 * element's floating toolbar can overlap the header "Acciones" button.
 */
export async function deselect(page: Page): Promise<void> {
  const box = await page.locator(".konvajs-content").first().boundingBox();
  if (!box) throw new Error("Konva stage not rendered");
  await page.mouse.click(box.x + 10, box.y + 10);
  await expect(page.getByRole("button", { name: "Duplicar" })).toBeHidden();
}

/** Read the product name by opening (and cancelling) its inline editor. */
export async function readProductName(page: Page): Promise<string> {
  const editor = await openProductNameEditor(page);
  const value = await editor.inputValue();
  await editor.press("Escape");
  await expect(editor).toBeHidden();
  await deselect(page);
  return value;
}

/** Replace the product name via the inline editor and commit (blur). */
export async function editProductName(page: Page, value: string): Promise<void> {
  const editor = await openProductNameEditor(page);
  await editor.fill(value);
  await editor.blur();
  await expect(editor).toBeHidden();
  await deselect(page);
}

/** Open the toolbar "Acciones" menu (idempotent) and return an item locator. */
export async function actionsMenuItem(page: Page, name: string) {
  const toggle = page.getByRole("button", { name: "Acciones" });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  return page.getByRole("menuitem", { name });
}

/** Click an "Acciones" menu item (e.g. Deshacer / Rehacer), then close it. */
export async function clickAction(page: Page, name: string): Promise<void> {
  await (await actionsMenuItem(page, name)).click();
  await page.keyboard.press("Escape");
}
