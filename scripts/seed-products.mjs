/**
 * Seeds the product catalog with mocked data.
 *
 * Usage:
 *   pnpm db:seed:products
 *
 * Idempotent: products are keyed by a stable slug id, so re-running
 * updates the existing rows instead of duplicating them.
 * Requires DATABASE_URL (loaded from .env via --env-file-if-exists).
 */
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Is your .env file in place?");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

/** Offline-safe placeholder image: an inline SVG data URL with the product name. */
function placeholderImage(name, background) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="${background}"/><text x="50%" y="50%" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${name}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const CATALOG = [
  {
    id: "prod-canvas-tote",
    name: "Canvas Tote Bag",
    description:
      "Heavy-duty 12oz cotton canvas tote with reinforced handles and interior zip pocket. Ideal for retail and promotional giveaways.",
    price: "$4.90",
    background: "#8d6e63",
    variants: [
      { colorName: "Natural", colorHex: "#e8dcc8", stock: 1240, packaging: "Box of 50" },
      { colorName: "Navy", colorHex: "#1f3a5f", stock: 860, packaging: "Box of 50" },
      { colorName: "Olive", colorHex: "#6b7a3a", stock: 320, packaging: "Box of 50" },
    ],
  },
  {
    id: "prod-ceramic-mug",
    name: "Ceramic Mug 11oz",
    description:
      "Dishwasher-safe ceramic mug with glossy finish and comfortable C-handle. Perfect for sublimation printing.",
    price: "$2.75",
    background: "#5c7a99",
    variants: [
      { colorName: "White", colorHex: "#f5f5f5", stock: 3200, packaging: "Box of 36" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 2100, packaging: "Box of 50" },
      { colorName: "Red", colorHex: "#c0392b", stock: 0, packaging: "Box of 50" },
    ],
  },
  {
    id: "prod-steel-bottle",
    name: "Insulated Steel Bottle",
    description:
      "Double-wall vacuum-insulated 750ml bottle. Keeps drinks cold 24h or hot 12h. Laser engraving ready.",
    price: "$12.50",
    background: "#4a6b7a",
    variants: [
      { colorName: "Matte Black", colorHex: "#333333", stock: 540, packaging: "Carton of 24" },
      { colorName: "Brushed Steel", colorHex: "#b8b8b8", stock: 410, packaging: "Carton of 24" },
      { colorName: "Teal", colorHex: "#2a8f8f", stock: 95, packaging: "Carton of 24" },
    ],
  },
  {
    id: "prod-cotton-hoodie",
    name: "Fleece Hoodie",
    description:
      "Unisex brushed-fleece hoodie with kangaroo pocket and metal drawstring tips. Sizes S–XXL available.",
    price: "$18.50",
    background: "#5a4a6b",
    variants: [
      { colorName: "Heather Grey", colorHex: "#a8a8a8", stock: 210, packaging: "Poly bag, carton of 20" },
      { colorName: "Black", colorHex: "#1c1c1c", stock: 480, packaging: "Poly bag, carton of 24" },
      { colorName: "Burgundy", colorHex: "#7a2e3f", stock: 75, packaging: "Poly bag, carton of 24" },
    ],
  },
  {
    id: "prod-notebook-a5",
    name: "Hardcover Notebook A5",
    description:
      "A5 dotted notebook with elastic closure, ribbon marker and 160 pages of 100gsm ivory paper. Deboss or foil stamping available.",
    price: "$6.50",
    background: "#3a6b4a",
    variants: [
      { colorName: "Forest Green", colorHex: "#2d5a3d", stock: 780, packaging: "Box of 40" },
      { colorName: "Charcoal", colorHex: "#3a3a3a", stock: 640, packaging: "Box of 40" },
      { colorName: "Coral", colorHex: "#e07a5f", stock: 210, packaging: "Box of 40" },
    ],
  },
  {
    id: "prod-tote-jute",
    name: "Jute Shopping Bag",
    description:
      "Laminated jute bag with long cotton rope handles and laminated interior. Great for eco-friendly campaigns.",
    price: "$3.80",
    background: "#7a6b4a",
    variants: [
      { colorName: "Natural Jute", colorHex: "#c8b088", stock: 2100, packaging: "Bale of 100" },
      { colorName: "Olive", colorHex: "#7a7a3a", stock: 540, packaging: "Bale of 100" },
    ],
  },
];

try {
  for (const item of CATALOG) {
    const imageUrl = placeholderImage(item.name, item.background);

    await sql`
      INSERT INTO mm_web_product (id, name, description, price, "imageUrl", "createdAt")
      VALUES (${item.id}, ${item.name}, ${item.description}, ${item.price}, ${imageUrl}, now())
      ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            description = EXCLUDED.description,
            price = EXCLUDED.price,
            "imageUrl" = EXCLUDED."imageUrl"
    `;

    for (const variant of item.variants) {
      const variantId = `${item.id}-${slugify(variant.colorName)}`;
      await sql`
        INSERT INTO mm_web_product_variant (id, "productId", "colorName", "colorHex", stock, packaging)
        VALUES (${variantId}, ${item.id}, ${variant.colorName}, ${variant.colorHex}, ${variant.stock}, ${variant.packaging})
        ON CONFLICT (id) DO UPDATE
          SET "colorName" = EXCLUDED."colorName",
              "colorHex" = EXCLUDED."colorHex",
              stock = EXCLUDED.stock,
              packaging = EXCLUDED.packaging
      `;
    }
  }

  console.log(`Seeded ${CATALOG.length} products.`);
} catch (error) {
  console.error("Seed failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
