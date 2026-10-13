## /products response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "products": [
      {
        "id": 12208806,
        "sku": "KIT002",
        "type": "variable",
        "provider_sku": null,
        "gtin": null,
        "name": "Combo Souvenir",
        "slug": null,
        "published": 1,
        "featured": 0,
        "catalog_visibility": "visible",
        "short_description": "",
        "description": "Combo práctico para el día a día: incluye bolígrafo retráctil, bolsa ecológica con cordón ajustable para llevar zapatos, balones, libros o ropa, libreta A7 con 40 hojas rayadas, 25 memos adhesivos y 5 sets de banderitas de 25 unidades cada uno, y vaso de 450 ml / 15 oz con cierre giratorio, ideal para bebidas frías. Todo lo necesario para organizarte y moverte con estilo.",
        "stock_status": "instock",
        "manage_stock": 1,
        "inventory": 1000,
        "weight": "0.00",
        "length": "0.00",
        "width": "0.00",
        "height": "0.00",
        "regular_price": 0,
        "sale_price": "0.00",
        "categories": ["Morrales Neveras y Bolsas"],
        "tags": "[\"Novedades 2026-II\"]",
        "printing_methods": "[{\"label\":\"Validar con la ejecutiva\",\"description\":\"SE SUGIERE: Bolígrafo: Tampografía bolígrafos plásticos hasta 5 tintas - Mochila: Screen hasta 5 tintas - Libreta y Vaso: Tampografía variedades hasta 5 tintas.\"}]",
        "images": "{\"main_image\":[\"https://soyave-bucket.s3.eu-central-1.amazonaws.com/marpico/combo-souvenir-ac789745.jpg\"],\"gallery_images\":[\"https://soyave-bucket.s3.eu-central-1.amazonaws.com/marpico/combo-souvenir-ac789745.jpg\"]}",
        "images_locked": 0,
        "parent_id": null,
        "position": 0,
        "provider_id": 1,
        "connector_id": 59,
        "company_id": 9,
        "sync_status": "active",
        "last_sync_at": "2026-10-13 16:35:47",
        "net_price": "0.00",
        "effective_price": "19990.00",
        "units_per_box": 1,
        "packaging_type": "Bolígrafo: bolsa OPP - Mochila: sin empaque individual. Libreta y Vaso: bolsa de polietileno.",
        "material": "Bolígrafo: ABS - Mochila: Kambrel 80 g - Libreta: Papel - Vaso: PLA.",
        "print_area": "Bolígrafo: Tampo: (6 X 0,7) - Mochila: Screen: (20 X 23) - Libreta: Tampo: (4,5 X 4) - Vaso: Tampo Vertical: (7 X 3). Tampo Horizontal: (4,5 X 4).",
        "product_length": null,
        "product_width": null,
        "product_height": null,
        "product_diameter": null,
        "product_weight": null,
        "gross_weight": null,
        "price_type": "fixed",
        "local_inventory": 1000,
        "zone_inventory": 0,
        "transit_inventory": 0,
        "transit_arrival_date": null,
        "provider_prefix": "",
        "id_ave": null,
        "first_variation_id": 12208807,
        "created_at": "2026-10-09 19:30:47",
        "updated_at": "2026-10-13 11:36:19",
        "is_discarded": 0,
        "discarded_at": null,
        "price_tiers": null,
        "provider_name": "Marpico",
        "attributes": [
          {
            "name": "Color",
            "value": "Rojo, Blanco",
            "values": ["Rojo", "Blanco"],
            "is_visible": true,
            "is_global": false,
            "variation": true
          }
        ],
        "variations": [
          {
            "id": 12208807,
            "parent_id": 12208806,
            "sku": "KIT002-e4db999f",
            "name": "Combo Souvenir (Color: Rojo)",
            "type": "variation",
            "regular_price": 19990,
            "sale_price": "0.00",
            "net_price": "0.00",
            "stock_status": "instock",
            "inventory": 500,
            "local_inventory": 500,
            "zone_inventory": 0,
            "transit_inventory": 0,
            "weight": "0.00",
            "length": "0.00",
            "width": "0.00",
            "height": "0.00",
            "images": "{\"variation_main_image\":[\"https://soyave-bucket.s3.eu-central-1.amazonaws.com/marpico/kit002-e4db999f-1fcbd424.jpg\"],\"variation_gallery_images\":[\"https://soyave-bucket.s3.eu-central-1.amazonaws.com/marpico/kit002-e4db999f-1fcbd424.jpg\"]}",
            "position": 0,
            "provider_id": 1,
            "price_type": "fixed",
            "categories": "15",
            "attributes": {
              "Color": "Rojo"
            },
            "tags": "[\"Novedades 2026-II\"]"
          },
          {
            "id": 12208808,
            "parent_id": 12208806,
            "sku": "KIT002-1f23cdf5",
            "name": "Combo Souvenir (Color: Blanco)",
            "type": "variation",
            "regular_price": 19990,
            "sale_price": "0.00",
            "net_price": "0.00",
            "stock_status": "instock",
            "inventory": 500,
            "local_inventory": 500,
            "zone_inventory": 0,
            "transit_inventory": 0,
            "weight": "0.00",
            "length": "0.00",
            "width": "0.00",
            "height": "0.00",
            "images": "{\"variation_main_image\":[\"https://soyave-bucket.s3.eu-central-1.amazonaws.com/marpico/kit002-1f23cdf5-8147c4e8.jpg\"],\"variation_gallery_images\":[\"https://soyave-bucket.s3.eu-central-1.amazonaws.com/marpico/kit002-1f23cdf5-8147c4e8.jpg\"]}",
            "position": 1,
            "provider_id": 1,
            "price_type": "fixed",
            "categories": "15",
            "attributes": {
              "Color": "Blanco"
            },
            "tags": "[\"Novedades 2026-II\"]"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 5239,
      "total_pages": 53
    }
  }
}
```

## /inventory response

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "items": [
      {
        "id": 9012,
        "sku": "MP-4410-ROJO",
        "provider_sku": "4410",
        "name": "Termo Kaila 600ml — Rojo",
        "parent_id": 9010,
        "available": 340,
        "local_inventory": 120,
        "zone_inventory": 220,
        "transit_inventory": 500,
        "updated_at": "2026-09-17 06:00:00"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 16843,
      "total_pages": 169
    }
  }
}
```
