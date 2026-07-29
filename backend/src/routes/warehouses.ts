import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { assertWarehouseAccess } from '../lib/warehouseAccess.js';
import { generatePickupCode } from '../lib/orders.js';
import { CreateWarehouseSchema, PatchWarehouseSchema } from '../schemas/warehouse.js';

export const warehousesRouter = Router();

const managerSelect = { id: true, name: true, email: true };

// Le bloc `manager` porte le nom ET l'email d'un employe : il n'est joint que pour le staff.
// Helper partage par la liste et le detail — la regle doit etre la meme aux deux endroits.
function isStaff(role: string | undefined): boolean {
  return role === 'admin' || role === 'warehouse_manager';
}

// Un managerId doit designer un utilisateur EXISTANT dont le role est `warehouse_manager`.
// Sans ce controle, PATCH { managerId: <id d'un client> } etait accepte alors que
// assertWarehouseAccess (lib/warehouseAccess.ts) exige role === 'warehouse_manager' :
// l'entrepot se retrouvait avec un responsable qui ne peut pas y acceder.
// `null` est valide (desassignation), `undefined` signifie « champ non fourni ».
async function assertAssignableManager(managerId: string | null | undefined): Promise<void> {
  if (managerId === undefined || managerId === null) return;
  const user = await prisma.user.findUnique({ where: { id: managerId }, select: { role: true } });
  if (!user || user.role !== 'warehouse_manager') throw new HttpError(422, 'invalid_manager');
}

// GET /api/warehouses — liste (authentifie). La liste elle-meme reste ouverte a tout compte
// connecte (contrat d'origine), mais le responsable n'est joint que pour le staff : le bloc
// manager porte le nom ET l'email d'un employe, qui n'ont pas a circuler vers un client.
warehousesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
      ...(isStaff(req.user?.role) ? { include: { manager: { select: managerSelect } } } : {}),
    });
    res.json({ warehouses });
  } catch (err) {
    next(err);
  }
});

// GET /api/warehouses/:id — detail (authentifie). MEME regle que la liste ci-dessus : le bloc
// `manager` n'est joint que pour le staff. Il ne l'etait pas : la liste, elle, masquait bien le
// responsable a un client, mais il suffisait d'y prendre un id et de le rejouer ici pour obtenir le
// nom et l'email de l'employe — n'importe quel compte client ou livreur connecte y avait acces.
warehousesRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: String(req.params['id']) },
      ...(isStaff(req.user?.role) ? { include: { manager: { select: managerSelect } } } : {}),
    });
    if (!warehouse) return next(new HttpError(404, 'warehouse_not_found'));
    res.json({ warehouse });
  } catch (err) {
    next(err);
  }
});

// GET /api/warehouses/:id/stock — stock de l'entrepot (admin ou manager de CET entrepot)
warehousesRouter.get('/:id/stock', requireAuth, requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const warehouseId = String(req.params['id']);
    await assertWarehouseAccess(req.user!, warehouseId);
    const stock = await prisma.warehouseStock.findMany({
      where: { warehouseId },
      include: { product: { select: { id: true, name: true, slug: true, imageUrl: true, categoryId: true } } },
      orderBy: { product: { name: 'asc' } },
    });
    res.json({ stock });
  } catch (err) {
    next(err);
  }
});

// statuts d'une commande encore a preparer (avant que le livreur ne l'emporte)
const TO_PREPARE_STATUSES = ['pending_assignment', 'rider_assigned', 'at_warehouse'] as const;

// GET /api/warehouses/orders/to-prepare — file de preparation TRANSVERSE, tous entrepots confondus
// (admin uniquement).
//
// Raison d'etre : la file par entrepot ci-dessous est cadree par assertWarehouseAccess, donc une
// commande routee vers un entrepot SANS responsable n'apparait dans aucun tableau de bord entrepot.
// Depuis le passage de relais, une telle commande ne peut plus etre ramassee tant que personne ne
// l'a preparee : elle resterait bloquee a at_warehouse faute d'etre seulement VISIBLE quelque part.
// L'admin a toujours eu le DROIT de la preparer (assertWarehouseAccess laisse passer tout admin sur
// n'importe quel entrepot) ; il lui manquait la liste. C'est le filet de securite qui autorise la
// creation de commande a accepter un entrepot actif sans responsable (cf. routes/orders.ts).
//
// `unmanaged` marque les lignes qu'aucun responsable ne viendra traiter : ce sont celles qui
// exigent une action de l'admin.
warehousesRouter.get('/orders/to-prepare', requireAuth, requireRole('admin'), async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { warehouseId: { not: null }, status: { in: [...TO_PREPARE_STATUSES] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reference: true,
        status: true,
        preparedAt: true,
        createdAt: true,
        dropoffAddress: true,
        // meme exposition que la file par entrepot : l'admin doit pouvoir dicter le code au livreur
        pickupCode: true,
        warehouseId: true,
        items: { select: { name: true, quantity: true } },
      },
    });
    const warehouses = await prisma.warehouse.findMany({
      where: { id: { in: [...new Set(orders.map((o) => o.warehouseId!))] } },
      select: { id: true, name: true, isActive: true, managerId: true },
    });
    const byId = new Map(warehouses.map((w) => [w.id, w]));
    res.json({
      orders: orders.map((o) => {
        const wh = byId.get(o.warehouseId!);
        return {
          ...o,
          warehouseName: wh?.name ?? null,
          unmanaged: wh ? wh.managerId === null : false,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/warehouses/:id/orders — commandes entrantes a preparer pour cet entrepot (admin ou son manager)
warehousesRouter.get('/:id/orders', requireAuth, requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const warehouseId = String(req.params['id']);
    await assertWarehouseAccess(req.user!, warehouseId);
    const orders = await prisma.order.findMany({
      where: { warehouseId, status: { in: [...TO_PREPARE_STATUSES] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reference: true,
        status: true,
        preparedAt: true,
        createdAt: true,
        dropoffAddress: true,
        // pickupCode est reserve a cette liste et au detail de preparation : l'ecran entrepot doit
        // pouvoir relire le code d'une commande deja preparee pour le dicter au livreur.
        pickupCode: true,
        items: { select: { name: true, quantity: true } },
      },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

// champs renvoyes par la preparation — `pickupCode` n'est lisible que par l'entrepot et l'admin
const PREPARED_ORDER_SELECT = { id: true, reference: true, preparedAt: true, pickupCode: true } as const;

// PATCH /api/warehouses/:id/orders/:orderId/prepare — marquer la commande prete pour le ramassage
// et emettre le code de ramassage que le comptoir remettra au livreur.
warehousesRouter.patch('/:id/orders/:orderId/prepare', requireAuth, requireRole('admin', 'warehouse_manager'), async (req, res, next) => {
  try {
    const warehouseId = String(req.params['id']);
    const orderId = String(req.params['orderId']);
    await assertWarehouseAccess(req.user!, warehouseId);

    // Idempotent : un second appel sur une commande deja preparee RENVOIE le code existant et ne
    // le regenere pas. Reemettre un code invaliderait silencieusement celui deja note par le
    // livreur en route. Lecture et ecriture dans la meme transaction pour qu'un double-clic ne
    // puisse pas produire deux codes concurrents.
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: orderId },
        select: { ...PREPARED_ORDER_SELECT, warehouseId: true },
      });
      if (!current || current.warehouseId !== warehouseId) throw new HttpError(404, 'order_not_found');
      if (current.preparedAt !== null && current.pickupCode !== null) {
        return {
          id: current.id,
          reference: current.reference,
          preparedAt: current.preparedAt,
          pickupCode: current.pickupCode,
        };
      }
      return tx.order.update({
        where: { id: orderId },
        data: {
          preparedAt: current.preparedAt ?? new Date(),
          pickupCode: current.pickupCode ?? generatePickupCode(),
        },
        select: PREPARED_ORDER_SELECT,
      });
    });
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/warehouses — creer (admin)
warehousesRouter.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = CreateWarehouseSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  try {
    await assertAssignableManager(parsed.data.managerId);
    // exactOptionalPropertyTypes : retirer les clés `undefined` avant Prisma
    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    ) as unknown as Prisma.WarehouseUncheckedCreateInput;
    const warehouse = await prisma.warehouse.create({ data });
    res.status(201).json({ warehouse });
  } catch (err) {
    // P2003 : la FK managerId ne pointe sur aucun User — 422 plutot qu'un 500 opaque
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return next(new HttpError(422, 'invalid_manager'));
    }
    next(err);
  }
});

// PATCH /api/warehouses/:id — modifier, dont assignation d'un managerId (admin)
warehousesRouter.patch('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  const parsed = PatchWarehouseSchema.safeParse(req.body);
  if (!parsed.success) return next(new HttpError(422, 'validation_failed', { issues: parsed.error.issues }));
  const id = String(req.params['id']);
  try {
    await assertAssignableManager(parsed.data.managerId);
    // exactOptionalPropertyTypes : retirer les clés `undefined` avant Prisma
    const data = Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    ) as unknown as Prisma.WarehouseUncheckedUpdateInput;
    const warehouse = await prisma.warehouse.update({ where: { id }, data });
    res.json({ warehouse });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') return next(new HttpError(404, 'warehouse_not_found'));
      // P2003 : la FK managerId ne pointe sur aucun User — 422 plutot qu'un 500 opaque
      if (err.code === 'P2003') return next(new HttpError(422, 'invalid_manager'));
    }
    next(err);
  }
});
