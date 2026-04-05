# Product Data Schema Template

## Core Product

```typescript
interface Product {
  id: string;                        // UUID or slug — immutable after creation
  sku: string;                       // Unique stock keeping unit
  name: string;
  description: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";

  pricing: ProductPricing;
  inventory: ProductInventory;
  media: ProductMedia[];
  attributes: ProductAttribute[];    // color, size, material, etc.
  variants: ProductVariant[];        // if applicable

  createdAt: Date;
  updatedAt: Date;
}
```

## Pricing

```typescript
interface ProductPricing {
  currency: string;                  // ISO 4217 — "KRW", "USD"
  basePrice: number;                 // In smallest currency unit (cents/원)
  salePrice?: number;                // null = no active sale
  salePeriod?: { from: Date; to: Date };
  taxRate: number;                   // 0.1 = 10%
  taxIncluded: boolean;              // Is tax included in basePrice?
}
```

## Inventory

```typescript
interface ProductInventory {
  trackInventory: boolean;           // false = always in stock (digital goods)
  stock: number;                     // Current available quantity
  reservedStock: number;             // Locked in active checkouts
  lowStockThreshold: number;        // Alert when stock <= this value
  backorderAllowed: boolean;
  reservationTtlMinutes: number;    // How long to hold reserved stock (default: 15)
}
```

## Variant

```typescript
interface ProductVariant {
  id: string;
  sku: string;
  attributes: Record<string, string>; // { color: "red", size: "M" }
  pricing?: Partial<ProductPricing>;  // Override base pricing
  inventory: ProductInventory;
  active: boolean;
}
```

## Cart Line Item (Price Snapshot)

```typescript
interface CartLineItem {
  productId: string;
  variantId?: string;
  quantity: number;
  // Snapshot at add-to-cart time — do not read live price from DB during checkout
  snapshotPrice: number;
  snapshotCurrency: string;
  snapshotName: string;
  addedAt: Date;
}
```

## Usage Notes

- Store `snapshotPrice` in cart to survive price changes — revalidate at checkout entry only
- `reservedStock + stock` = total physical stock on hand
- Use `FOR UPDATE` or atomic SQL when decrementing `stock`
- Archive products instead of deleting — orders reference them
- `{{CURRENCY}}` — replace with project's primary currency code
- `{{TAX_RATE}}` — replace with applicable tax rate (e.g., `0.1` for 10% VAT)
