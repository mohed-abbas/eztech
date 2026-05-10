// runs before test modules are imported, so config/env.ts sees a complete env
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'x'.repeat(32);
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
