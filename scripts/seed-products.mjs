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
  {
    id: "prod-tumbler-20oz",
    name: "Tumbler 20oz",
    description:
      "Powder-coated stainless steel tumbler with leak-proof lid and straw. Sublimation-ready white or laser-ready black.",
    price: "$7.25",
    background: "#7a4a5a",
    variants: [
      { colorName: "White", colorHex: "#f5f5f5", stock: 1450, packaging: "Carton of 24" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 980, packaging: "Carton of 24" },
      { colorName: "Rose Gold", colorHex: "#b76e79", stock: 0, packaging: "Carton of 24" },
    ],
  },
  {
    id: "prod-tote-nonwoven",
    name: "Non-Woven Tote",
    description:
      "Recycled polypropylene non-woven tote with heat-sealed handles. Lightweight, foldable and screen-printable.",
    price: "$1.10",
    background: "#4a5a6b",
    variants: [
      { colorName: "White", colorHex: "#f5f5f5", stock: 5200, packaging: "Bale of 200" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 3100, packaging: "Bale of 200" },
      { colorName: "Navy", colorHex: "#1f3a5f", stock: 1250, packaging: "Bale of 200" },
    ],
  },
  {
    id: "prod-umbrella-classic",
    name: "Classic Umbrella",
    description:
      "8-rib fiberglass umbrella with auto open/close and reflective trim. UV50+ canopy, fits in a branded sleeve.",
    price: "$6.90",
    background: "#3a5a4a",
    variants: [
      { colorName: "Black", colorHex: "#2b2b2b", stock: 640, packaging: "Carton of 24" },
      { colorName: "Navy", colorHex: "#1f3a5f", stock: 420, packaging: "Carton of 24" },
      { colorName: "Red", colorHex: "#c0392b", stock: 180, packaging: "Carton of 24" },
    ],
  },
  {
    id: "prod-pen-metal",
    name: "Metal Rollerball Pen",
    description:
      "Weighted aluminium rollerball with click action and laser-engravable barrel. Smooth 0.7mm gel ink.",
    price: "$2.40",
    background: "#5a5a6b",
    variants: [
      { colorName: "Silver", colorHex: "#c0c0c0", stock: 4200, packaging: "Box of 50" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 2800, packaging: "Box of 50" },
      { colorName: "Gold", colorHex: "#c9a227", stock: 350, packaging: "Box of 50" },
    ],
  },
  {
    id: "prod-notebook-spiral",
    name: "Spiral Notebook A4",
    description:
      "A4 spiral notebook with 80 sheets of 70gsm white paper and lay-flat binding. Full-colour cover printing.",
    price: "$1.85",
    background: "#6b5a3a",
    variants: [
      { colorName: "White", colorHex: "#f5f5f5", stock: 3600, packaging: "Box of 100" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 2400, packaging: "Box of 100" },
    ],
  },
  {
    id: "prod-bottle-glass",
    name: "Glass Water Bottle 500ml",
    description:
      "Borosilicate glass bottle with bamboo cap and silicone sleeve. Dishwasher-safe, BPA-free.",
    price: "$5.60",
    background: "#4a7a6b",
    variants: [
      { colorName: "Clear", colorHex: "#e8f0f0", stock: 890, packaging: "Carton of 24" },
      { colorName: "Smoke", colorHex: "#5a5a5a", stock: 560, packaging: "Carton of 24" },
      { colorName: "Amber", colorHex: "#b07a3a", stock: 0, packaging: "Carton of 24" },
    ],
  },
  {
    id: "prod-hat-6panel",
    name: "6-Panel Cap",
    description:
      "Structured 6-panel cotton twill cap with adjustable strap. Embroidery-ready front panel, 3D puff available.",
    price: "$4.20",
    background: "#6b4a4a",
    variants: [
      { colorName: "Black", colorHex: "#2b2b2b", stock: 1750, packaging: "Carton of 36" },
      { colorName: "Navy", colorHex: "#1f3a5f", stock: 1120, packaging: "Carton of 36" },
      { colorName: "Khaki", colorHex: "#b0a070", stock: 480, packaging: "Carton of 36" },
    ],
  },
  {
    id: "prod-tshirt-organic",
    name: "Organic Cotton T-Shirt",
    description:
      "180gsm GOTS-certified organic cotton tee with ribbed collar. DTG and screen printing ready. Sizes S–XXL.",
    price: "$5.90",
    background: "#4a6b5a",
    variants: [
      { colorName: "White", colorHex: "#f5f5f5", stock: 2600, packaging: "Carton of 24" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 1900, packaging: "Carton of 24" },
      { colorName: "Heather Grey", colorHex: "#a8a8a8", stock: 720, packaging: "Carton of 24" },
    ],
  },
  {
    id: "prod-laptop-sleeve",
    name: "Laptop Sleeve 14\"",
    description:
      "Water-resistant neoprene sleeve for 13–14\" laptops with interior microfibre lining and zip closure.",
    price: "$8.75",
    background: "#3a4a6b",
    variants: [
      { colorName: "Black", colorHex: "#2b2b2b", stock: 680, packaging: "Carton of 24" },
      { colorName: "Navy", colorHex: "#1f3a5f", stock: 450, packaging: "Carton of 24" },
      { colorName: "Grey", colorHex: "#8a8a8a", stock: 210, packaging: "Carton of 24" },
    ],
  },
  {
    id: "prod-bottle-sports",
    name: "Sports Bottle 700ml",
    description:
      "Tritan sports bottle with flip-top cap and carry loop. BPA-free, dishwasher-safe, leak-proof.",
    price: "$3.40",
    background: "#6b6b3a",
    variants: [
      { colorName: "Clear", colorHex: "#e8f0f0", stock: 1350, packaging: "Carton of 36" },
      { colorName: "Blue", colorHex: "#2a6f9f", stock: 890, packaging: "Carton of 36" },
      { colorName: "Red", colorHex: "#c0392b", stock: 340, packaging: "Carton of 36" },
    ],
  },
  {
    id: "prod-tote-canvas-small",
    name: "Canvas Tote (Small)",
    description:
      "Compact 10oz cotton canvas tote with gusset base and reinforced handles. Great for events and retail.",
    price: "$3.20",
    background: "#7a5a4a",
    variants: [
      { colorName: "Natural", colorHex: "#e8dcc8", stock: 2900, packaging: "Box of 100" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 1600, packaging: "Box of 100" },
    ],
  },
  {
    id: "prod-mug-travel",
    name: "Travel Mug 350ml",
    description:
      "Double-wall stainless travel mug with silicone base and twist-lock lid. Keeps drinks hot 6h, cold 12h.",
    price: "$9.80",
    background: "#5a3a4a",
    variants: [
      { colorName: "Matte Black", colorHex: "#333333", stock: 520, packaging: "Carton of 24" },
      { colorName: "White", colorHex: "#f5f5f5", stock: 380, packaging: "Carton of 24" },
      { colorName: "Teal", colorHex: "#2a8f8f", stock: 95, packaging: "Carton of 24" },
    ],
  },
  {
    id: "prod-backpack-urban",
    name: "Urban Backpack 20L",
    description:
      "Water-resistant polyester backpack with padded 15.6\" laptop compartment and front zip pocket.",
    price: "$24.50",
    background: "#3a3a5a",
    variants: [
      { colorName: "Black", colorHex: "#2b2b2b", stock: 340, packaging: "Carton of 12" },
      { colorName: "Navy", colorHex: "#1f3a5f", stock: 260, packaging: "Carton of 12" },
      { colorName: "Olive", colorHex: "#6b7a3a", stock: 85, packaging: "Carton of 12" },
    ],
  },
  {
    id: "prod-sticky-notes",
    name: "Sticky Notes Set",
    description:
      "Set of 4 pads (76×76mm) with 100 sheets each. Acid-free, re-stickable, full-colour cover printing.",
    price: "$1.25",
    background: "#6b5a5a",
    variants: [
      { colorName: "Yellow", colorHex: "#f0d060", stock: 4800, packaging: "Box of 100" },
      { colorName: "Pink", colorHex: "#f0a0b0", stock: 2100, packaging: "Box of 100" },
      { colorName: "Blue", colorHex: "#a0c0f0", stock: 1750, packaging: "Box of 100" },
    ],
  },
  {
    id: "prod-bottle-thermos",
    name: "Thermos Flask 500ml",
    description:
      "Vacuum-insulated stainless steel flask with wide mouth and powder-coat finish. Hot 12h, cold 24h.",
    price: "$14.90",
    background: "#4a5a4a",
    variants: [
      { colorName: "Matte Black", colorHex: "#333333", stock: 410, packaging: "Carton of 24" },
      { colorName: "Brushed Steel", colorHex: "#b8b8b8", stock: 290, packaging: "Carton of 24" },
      { colorName: "Burgundy", colorHex: "#7a2e3f", stock: 0, packaging: "Carton of 24" },
    ],
  },
  {
    id: "prod-tote-kids",
    name: "Kids' Tote Bag",
    description:
      "Lightweight 8oz cotton tote sized for kids with short handles. Perfect for school events and parties.",
    price: "$2.80",
    background: "#6b4a6b",
    variants: [
      { colorName: "Natural", colorHex: "#e8dcc8", stock: 1800, packaging: "Box of 100" },
      { colorName: "White", colorHex: "#f5f5f5", stock: 1200, packaging: "Box of 100" },
    ],
  },
  {
    id: "prod-mug-ceramic-15oz",
    name: "Ceramic Mug 15oz",
    description:
      "Oversized 15oz ceramic mug with glossy finish. Sublimation-ready, dishwasher and microwave safe.",
    price: "$3.90",
    background: "#5a6b4a",
    variants: [
      { colorName: "White", colorHex: "#f5f5f5", stock: 2400, packaging: "Box of 36" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 1500, packaging: "Box of 36" },
    ],
  },
  {
    id: "prod-hoodie-zip",
    name: "Zip-Up Hoodie",
    description:
      "Unisex 320gsm fleece zip-up hoodie with metal zipper and kangaroo pocket. Sizes S–XXL.",
    price: "$22.00",
    background: "#4a4a6b",
    variants: [
      { colorName: "Black", colorHex: "#2b2b2b", stock: 380, packaging: "Poly bag, carton of 20" },
      { colorName: "Navy", colorHex: "#1f3a5f", stock: 290, packaging: "Poly bag, carton of 20" },
      { colorName: "Heather Grey", colorHex: "#a8a8a8", stock: 120, packaging: "Poly bag, carton of 20" },
    ],
  },
  {
    id: "prod-notebook-pocket",
    name: "Pocket Notebook",
    description:
      "A6 pocket notebook with 48 pages of 90gsm ivory paper and elastic closure. Deboss or foil stamping.",
    price: "$3.10",
    background: "#6b6b5a",
    variants: [
      { colorName: "Forest Green", colorHex: "#2d5a3d", stock: 950, packaging: "Box of 50" },
      { colorName: "Charcoal", colorHex: "#3a3a3a", stock: 720, packaging: "Box of 50" },
      { colorName: "Coral", colorHex: "#e07a5f", stock: 280, packaging: "Box of 50" },
    ],
  },
  {
    id: "prod-bottle-eco",
    name: "Eco Bottle 600ml",
    description:
      "Recycled PET bottle with bamboo cap and silicone sleeve. BPA-free, dishwasher-safe, 100% recyclable.",
    price: "$4.75",
    background: "#5a6b5a",
    variants: [
      { colorName: "Clear", colorHex: "#e8f0f0", stock: 1100, packaging: "Carton of 36" },
      { colorName: "Smoke", colorHex: "#5a5a5a", stock: 680, packaging: "Carton of 36" },
    ],
  },
  {
    id: "prod-tote-gift",
    name: "Gift Tote with Ribbon",
    description:
      "Premium 12oz cotton tote with satin ribbon handles and interior lining. Ideal for premium gifting.",
    price: "$6.40",
    background: "#6b3a4a",
    variants: [
      { colorName: "Natural", colorHex: "#e8dcc8", stock: 760, packaging: "Box of 50" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 540, packaging: "Box of 50" },
      { colorName: "Burgundy", colorHex: "#7a2e3f", stock: 190, packaging: "Box of 50" },
    ],
  },
  {
    id: "prod-mug-enamel",
    name: "Enamel Camp Mug",
    description:
      "Retro enamel camp mug with powder-coat finish. Durable, lightweight, perfect for outdoor events.",
    price: "$4.50",
    background: "#4a6b6b",
    variants: [
      { colorName: "White", colorHex: "#f5f5f5", stock: 1300, packaging: "Box of 36" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 890, packaging: "Box of 36" },
      { colorName: "Red", colorHex: "#c0392b", stock: 320, packaging: "Box of 36" },
    ],
  },
  {
    id: "prod-sweatshirt",
    name: "Crewneck Sweatshirt",
    description:
      "Unisex 300gsm brushed-fleece crewneck with ribbed cuffs and hem. Sizes S–XXL, embroidery ready.",
    price: "$16.80",
    background: "#5a5a4a",
    variants: [
      { colorName: "Heather Grey", colorHex: "#a8a8a8", stock: 420, packaging: "Poly bag, carton of 20" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 350, packaging: "Poly bag, carton of 20" },
      { colorName: "Navy", colorHex: "#1f3a5f", stock: 160, packaging: "Poly bag, carton of 20" },
    ],
  },
  {
    id: "prod-notebook-journal",
    name: "Leather Journal",
    description:
      "A5 faux-leather journal with 120 pages of 100gsm ivory paper, elastic closure and ribbon marker.",
    price: "$8.90",
    background: "#6b5a4a",
    variants: [
      { colorName: "Tan", colorHex: "#b08050", stock: 580, packaging: "Box of 40" },
      { colorName: "Black", colorHex: "#2b2b2b", stock: 460, packaging: "Box of 40" },
      { colorName: "Forest Green", colorHex: "#2d5a3d", stock: 210, packaging: "Box of 40" },
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
