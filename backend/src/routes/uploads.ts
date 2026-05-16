import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';

export const uploadsRouter = Router();

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'rider-documents');

// rider-documents are PII (license/insurance scans) — owner or admin only
uploadsRouter.get('/rider-documents/:riderId/:file', requireAuth, (req, res, next) => {
  const { riderId, file } = req.params;
  if (req.user!.role !== 'admin' && req.user!.sub !== riderId) {
    return next(new HttpError(403, 'forbidden'));
  }

  // path.basename strips any traversal segments — final path must stay inside UPLOAD_ROOT
  const safeRider = path.basename(String(riderId));
  const safeName = path.basename(String(file));
  const target = path.join(UPLOAD_ROOT, safeRider, safeName);
  if (!target.startsWith(UPLOAD_ROOT + path.sep)) {
    return next(new HttpError(400, 'invalid_path'));
  }

  fs.access(target, fs.constants.R_OK, (err) => {
    if (err) return next(new HttpError(404, 'not_found'));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(target);
  });
});
