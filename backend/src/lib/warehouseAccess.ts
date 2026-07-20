import { prisma } from './prisma.js';
import { HttpError } from '../middleware/error.js';
import type { JwtPayload } from '../middleware/auth.js';

// Controle d'acces entrepot : un admin voit tout ; un warehouse_manager uniquement SON entrepot
// (managerId === user.sub). Renvoie l'entrepot ou leve 404/403. Point de securite du module.
export async function assertWarehouseAccess(user: JwtPayload, warehouseId: string) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true, managerId: true },
  });
  if (!warehouse) throw new HttpError(404, 'warehouse_not_found');
  if (user.role === 'admin') return warehouse;
  if (user.role === 'warehouse_manager' && warehouse.managerId === user.sub) return warehouse;
  throw new HttpError(403, 'forbidden');
}
