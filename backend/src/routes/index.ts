import { Router } from 'express';
import { healthRouter } from './health.js';
import { authRouter } from './auth.js';
import { usersRouter } from './users.js';
import { riderRouter } from './rider.js';
import { ordersRouter } from './orders.js';
import { returnsRouter } from './returns.js';
import { productsRouter } from './products.js';
import { categoriesRouter } from './categories.js';
import { brandsRouter } from './brands.js';
import { zonesRouter } from './zones.js';
import { warehousesRouter } from './warehouses.js';
import { inventoryRouter } from './inventory.js';
import { paymentsRouter } from './payments.js';
import { notificationsRouter } from './notifications.js';
import { analyticsRouter } from './analytics.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/rider', riderRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/returns', returnsRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/brands', brandsRouter);
apiRouter.use('/zones', zonesRouter);
apiRouter.use('/warehouses', warehousesRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/payments', paymentsRouter);
// /api/analytics n'est PAS dans l'allowlist nginx detournee vers le BFF Nuxt (verifie en prod :
// GET /api/analytics/orders-per-day repond 404 {"error":"not_found"}, le notFoundHandler Express),
// donc pas d'alias /api/admin/analytics ni de changement nginx a prevoir.
apiRouter.use('/analytics', analyticsRouter);

// Production nginx path-splits a small allowlist of /api paths (products, orders, zones, config,
// geocode) to the Nuxt BFF, which serves a storefront-shaped remap: /api/products answers with a
// flat array, ignores every query param (so ?includeInactive is lost) and has no write handler, so
// a POST/PATCH there silently degrades to a read. The admin pages need the real Express catalog and
// order API, so the same routers are additionally mounted under /api/admin/* — a prefix nginx does
// not split, so it always reaches this app. No new handlers and no new permissions: the guards live
// on the routers themselves and are unchanged.
//
// /zones is in that same allowlist and is the worst case of the three, because its writes fail
// SILENTLY: measured against production on 2026-07-28, unauthenticated,
//   POST  /api/zones                     -> 200 {"type":"FeatureCollection",...}  (no write, no 401)
//   PATCH /api/zones/zone_paris_central  -> 404 {"statusCode":404,"statusMessage":"Page not found"}
//   GET   /api/admin/zones               -> 404 {"error":"not_found"}   (this app's notFoundHandler,
//                                           i.e. /api/admin/* does reach Express — only the mount
//                                           was missing)
// The admin zone editor (frontend/app/pages/admin/zones.vue) therefore calls /api/admin/zones only.
// /zones stays mounted below because the storefront reads it through the BFF (useServiceZone.ts,
// checkout).
apiRouter.use('/admin/products', productsRouter);
apiRouter.use('/admin/orders', ordersRouter);
apiRouter.use('/admin/zones', zonesRouter);
