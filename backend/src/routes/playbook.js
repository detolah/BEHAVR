// backend/src/routes/playbook.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { scoreCustomer } = require('../services/churn-score-service');
const { getPlaybook } = require('../services/playbook-service');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/:customerId', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.customerId, company_id: req.company.id },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const [churnScore, profile] = await Promise.all([
      scoreCustomer(customer.id, req.company.id),
      prisma.profile.findFirst({
        where:  { customer_id: customer.id, company_id: req.company.id },
        select: { core_fields: true },
      }),
    ]);

    const core = profile?.core_fields || {};
    res.json(getPlaybook(churnScore.score, core.trust_level, core.escalation_pattern));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
