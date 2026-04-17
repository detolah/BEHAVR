// backend/src/routes/cohorts.js
const express = require('express');
const { requireJwt } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/', requireJwt, attachCompany, async (req, res, next) => {
  try {
    const [scores, profiles] = await Promise.all([
      prisma.churnScore.findMany({
        where:  { company_id: req.company.id },
        select: { score: true },
      }),
      prisma.profile.findMany({
        where:  { company_id: req.company.id },
        select: { core_fields: true },
      }),
    ]);

    const distribution = { low: 0, medium: 0, high: 0 };
    let totalScore = 0;
    for (const s of scores) {
      totalScore += s.score;
      if (s.score < 55)      distribution.low++;
      else if (s.score < 70) distribution.medium++;
      else                   distribution.high++;
    }
    const avg_churn_score = scores.length
      ? Math.round((totalScore / scores.length) * 10) / 10
      : 0;

    const trust_breakdown      = {};
    const escalation_breakdown = {};
    for (const p of profiles) {
      const core = p.core_fields || {};
      if (core.trust_level)
        trust_breakdown[core.trust_level] = (trust_breakdown[core.trust_level] || 0) + 1;
      if (core.escalation_pattern)
        escalation_breakdown[core.escalation_pattern] = (escalation_breakdown[core.escalation_pattern] || 0) + 1;
    }

    res.json({ total_customers: scores.length, avg_churn_score, churn_distribution: distribution, trust_breakdown, escalation_breakdown });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
