import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { assertWarehouseAccess } from '../lib/warehouseAccess.js';
import { AdjustStockSchema } from '../schemas/warehouse.js';

export const inventoryRouter = Router();

// GET /api/inventory/:warehouseId — stock par entrepot avec le detail produit (admin ou son manager)
inventoryRouter.get('/:warehouseId', requireAuth, requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const warehouseId = String(req.params['warehouseId']);
    await assertWarehouseAccess(req.user!, warehouseId);
    const stock = await prisma.warehouseStock.findMany({
      where: { warehouseId },
      include: {
        product: { select: { id: true, name: true, slug: true, imageUrl: true, categoryId: true, category: { select: { name: true } } } },
      },
      orderBy: { product: { name: 'asc' } },
    });
    res.json({ stock });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/inventory/:warehouseId/:productId — fixer la quantite (admin ou son manager)
// Le delta est calcule et journalise dans StockAdjustment (qui / quand / delta).
inventoryRouter.patch('/:warehouseId/:productId', requireAuth, requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  const parsed = AdjustStockSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  const warehouseId = String(req.params['warehouseId']);
  const productId = String(req.params['productId']);
  const actorId = req.user!.sub;
  try {
    await assertWarehouseAccess(req.user!, warehouseId);

    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) return next(new HttpError(404, 'product_not_found'));

    const stock = await prisma.$transaction(async (tx) => {
      const current = await tx.warehouseStock.findUnique({ where: { warehouseId_productId: { warehouseId, productId } } });
      const previousQty = current?.quantity ?? 0;
      const delta = parsed.data.quantity - previousQty;

      const updated = await tx.warehouseStock.upsert({
        where: { warehouseId_productId: { warehouseId, productId } },
        create: { warehouseId, productId, quantity: parsed.data.quantity },
        update: { quantity: parsed.data.quantity },
      });

      if (delta !== 0) {
        await tx.stockAdjustment.create({
          data: { warehouseId, productId, actorId, delta, ...(parsed.data.reason ? { reason: parsed.data.reason } : {}) },
        });
      }
      return updated;
    });

    res.json({ stock });
  } catch (err) {
    next(err);
  }
});
