// backend/src/routes/interventions.js
const express = require('express');
const { requireJwt } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { getPlaybook } = require('../services/playbook-service');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/', requireJwt, attachCompany, async (req, res, next) => {
  const limit    = Math.min(parseInt(req.query.limit)     || 50,  100);
  const offset   = parseInt(req.query.offset)  || 0;
  const minScore = parseFloat(req.query.min_score) || 30;

  try {
    const [scores, total] = await prisma.$transaction([
      prisma.churnScore.findMany({
        where:   { company_id: req.company.id, score: { gte: minScore } },
        orderBy: { score: 'desc' },
        take:    limit,
        skip:    offset,
        include: { customer: { select: { id: true, email: true, name: true } } },
      }),
      prisma.churnScore.count({
        where: { company_id: req.company.id, score: { gte: minScore } },
      }),
    ]);

    // Batch-fetch profiles to avoid N+1
    const customerIds = scores.map(s => s.customer_id);
    const profiles = await prisma.profile.findMany({
      where:  { customer_id: { in: customerIds }, company_id: req.company.id },
      select: { customer_id: true, core_fields: true },
    });
    const profileMap = Object.fromEntries(profiles.map(p => [p.customer_id, p.core_fields || {}]));

    const interventions = scores.map(cs => {
      const core = profileMap[cs.customer_id] || {};
      return {
        customer:           cs.customer,
        score:              cs.score,
        scored_at:          cs.scored_at,
        factors:            cs.factors,
        trust_level:        core.trust_level        || null,
        escalation_pattern: core.escalation_pattern || null,
        playbook:           getPlaybook(cs.score, core.trust_level, core.escalation_pattern),
      };
    });

    res.json({ interventions, total });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
