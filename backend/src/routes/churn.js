// backend/src/routes/churn.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { scoreCustomer } = require('../services/churn-score-service');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/:customerId', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.customerId, company_id: req.company.id },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const churnScore = await scoreCustomer(customer.id, req.company.id);
    res.json(churnScore);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
