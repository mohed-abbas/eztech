// Catalog data seeded from the frontend mock — run with: npm run seed:catalog
// Upserts categories, warehouses, brands, products and per-warehouse stock so the
// catalog API serves the same data the frontend currently renders from mock JSON.
// Idempotent: re-running upserts by slug/name without creating duplicates.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const here = dirname(fileURLToPath(import.meta.url));
const mockDir = resolve(here, '../../frontend/app/data/mock');
const load = <T>(file: string): T => JSON.parse(readFileSync(resolve(mockDir, file), 'utf8')) as T;

type MockCategory = { id: string; name: string; slug: string; description: string; icon: string };
type MockWarehouse = {
  id: string;
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  serviceRadius: number;
  operatingHours: { open: string; close: string };
  isActive: boolean;
};
type MockProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  image: string;
  pricingType: 'flat' | 'tiered';
  price: { flat?: number; hourly?: number; daily?: number; weekly?: number };
  compatibilityTags: string[];
  stock: number;
  warehouseIds: string[];
  featured: boolean;
  rating: number;
  reviewCount: number;
};

// compatibility tags that name a real brand — first match becomes the product's brand
const BRANDS = ['Apple', 'Samsung', 'Dell', 'HP', 'LG', 'Lenovo', 'Logitech', 'Sony', 'Anker', 'Belkin', 'ASUS'];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

async function main() {
  const categories = load<MockCategory[]>('categories.json');
  const warehouses = load<MockWarehouse[]>('warehouses.json');
  const products = load<MockProduct[]>('products.json');

  // categories — map mock id (cat_*) → db id
  const categoryId = new Map<string, string>();
  for (const c of categories) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, icon: c.icon },
      create: { name: c.name, slug: c.slug, description: c.description, icon: c.icon },
    });
    categoryId.set(c.id, row.id);
  }

  // warehouses — map mock id (wh_*) → db id
  const warehouseId = new Map<string, string>();
  for (const w of warehouses) {
    const existing = await prisma.warehouse.findFirst({ where: { name: w.name } });
    const data = {
      address: w.address,
      lat: w.coordinates.lat,
      lng: w.coordinates.lng,
      serviceRadius: w.serviceRadius,
      openTime: w.operatingHours.open,
      closeTime: w.operatingHours.close,
      isActive: w.isActive,
    };
    const row = existing
      ? await prisma.warehouse.update({ where: { id: existing.id }, data })
      : await prisma.warehouse.create({ data: { name: w.name, ...data } });
    warehouseId.set(w.id, row.id);
  }

  // brands — derived from product compatibility tags
  const brandId = new Map<string, string>();
  const brandNames = new Set(products.flatMap((p) => p.compatibilityTags).filter((t) => BRANDS.includes(t)));
  for (const name of brandNames) {
    const row = await prisma.brand.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    brandId.set(name, row.id);
  }

  // products + per-warehouse stock
  for (const p of products) {
    const catId = categoryId.get(p.categoryId);
    if (!catId) throw new Error(`product ${p.slug} references unknown category ${p.categoryId}`);
    const brand = p.compatibilityTags.find((t) => BRANDS.includes(t));

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        categoryId: catId,
        brandId: brand ? (brandId.get(brand) ?? null) : null,
        imageUrl: p.image,
        pricingType: p.pricingType,
        flatPrice: p.price.flat ?? null,
        hourlyPrice: p.price.hourly ?? null,
        dailyPrice: p.price.daily ?? null,
        weeklyPrice: p.price.weekly ?? null,
        compatibilityTags: p.compatibilityTags,
        stock: p.stock,
        featured: p.featured,
        rating: p.rating,
        reviewCount: p.reviewCount,
      },
    });

    for (const whMockId of p.warehouseIds) {
      const whId = warehouseId.get(whMockId);
      if (!whId) continue;
      await prisma.warehouseStock.upsert({
        where: { warehouseId_productId: { warehouseId: whId, productId: product.id } },
        update: {},
        create: { warehouseId: whId, productId: product.id, quantity: p.stock },
      });
    }
  }

  console.log(`seeded: ${products.length} products, ${categories.length} categories, ${warehouses.length} warehouses, ${brandNames.size} brands`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
