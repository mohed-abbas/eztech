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
import { paymentsRouter } from './payments.js';
import { notificationsRouter } from './notifications.js';

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
apiRouter.use('/payments', paymentsRouter);
