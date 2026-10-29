import { Router } from 'express';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { buildInsights } from '../ai/insights.js';

export const insightsRouter = Router();

insightsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ insights: buildInsights(req.user!.id) });
  }),
);
