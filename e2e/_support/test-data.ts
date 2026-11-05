import type { MockClient, MockProduct } from "./mock-external";

/** Shared mocked fixtures for the lookup-flow / editor e2e specs (Task 6.1+). */

/** A fake client (never in the DB) for specs that mock `customer.list`. */
export const MOCK_CLIENT: MockClient = {
  id: "00000000-0000-4000-8000-0000000000c1",
  name: "e2e cliente prueba",
  companyId: null,
  userAlias: null,
  address: null,
  phone: null,
  contacts: [],
};

const variant = (id: string, colorName: string) => ({
  id,
  colorName,
  colorHex: "#cc0000",
  localInventory: 10,
  zoneInventory: 5,
  stock: 15,
  packaging: "Caja x 24",
});

/** Two resolved products → editor gets 2 product pages + 1 policies page. */
export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: "e2e-p1",
    name: "Producto E2E Uno",
    reference: "e2e-1",
    price: "$10.000",
    description: "Primer producto simulado",
    imageUrl: null,
    variants: [variant("v1", "Rojo")],
  },
  {
    id: "e2e-p2",
    name: "Producto E2E Dos",
    reference: "e2e-2",
    price: "$20.000",
    description: "Segundo producto simulado",
    imageUrl: null,
    variants: [variant("v2", "Rojo")],
  },
];

/** SKUs to type on the home page for {@link MOCK_PRODUCTS}. */
export const MOCK_SKUS = "e2e-1, e2e-2";
