import { Router } from 'express';
import { KNOWLEDGE_BASE, searchKnowledge } from '../ai/knowledge.js';

export const helpRouter = Router();

helpRouter.get('/articles', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const locale = req.query.locale === 'km' ? 'km' : 'en';

  if (query.trim()) {
    res.json({
      items: searchKnowledge(query, locale, 5).map((hit) => ({
        id: hit.article.id,
        titleEn: hit.article.titleEn,
        titleKm: hit.article.titleKm,
        bodyEn: hit.article.bodyEn,
        bodyKm: hit.article.bodyKm,
        tags: hit.article.tags,
        score: hit.score,
      })),
    });
    return;
  }

  res.json({
    items: KNOWLEDGE_BASE.map((article) => ({
      id: article.id,
      titleEn: article.titleEn,
      titleKm: article.titleKm,
      bodyEn: article.bodyEn,
      bodyKm: article.bodyKm,
      tags: article.tags,
    })),
  });
});
