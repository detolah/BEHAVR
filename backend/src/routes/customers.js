const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { seedProfile } = require('../services/profile-service');
const { seedSignal } = require('../services/signal-service');

const router = express.Router();

router.get('/list', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { company_id: req.company.id },
      include: {
        profiles: { where: { company_id: req.company.id }, select: { id: true, core_fields: true, updated_at: true } },
        signals: { where: { company_id: req.company.id } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(customers.map(c => ({
      ...c,
      profile: c.profiles[0] || null,
      signal: c.signals[0] || null,
      profiles: undefined,
      signals: undefined,
    })));
  } catch (err) { next(err); }
});

router.get('/by-id/:id', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, company_id: req.company.id },
      include: { signals: { where: { company_id: req.company.id } } },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ ...customer, signal: customer.signals[0] || null, signals: undefined });
  } catch (err) { next(err); }
});

router.get('/:email', requireAuth, attachCompany, async (req, res, next) => {
  const { email } = req.params;
  const company_id = req.company.id;
  try {
    let isNew = false;
    let customer = await prisma.customer.findUnique({
      where: { company_id_email: { company_id, email } },
    });
    if (!customer) {
      isNew = true;
      customer = await prisma.customer.create({ data: { company_id, email } });
    }
    const [profile, signal] = await Promise.all([
      seedProfile(customer.id, company_id),
      seedSignal(customer.id, company_id),
    ]);
    res.json({ customer, profile, signal, isNew });
  } catch (err) { next(err); }
});

module.exports = router;
