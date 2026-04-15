const express = require('express');
const prisma = require('../lib/prisma');
const { requireApiKey } = require('../middleware/auth');
const { incrementContact } = require('../services/signal-service');

const router = express.Router();

router.post('/zendesk', requireApiKey, async (req, res, next) => {
  const { event, customer_email, escalated = false } = req.body;
  const company_id = req.company.id;
  if (!customer_email) return res.status(400).json({ error: 'customer_email required' });
  try {
    const customer = await prisma.customer.findUnique({
      where: { company_id_email: { company_id, email: customer_email } },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (event === 'ticket.solved' || event === 'ticket.updated') {
      const signal = await incrementContact(customer.id, company_id, { escalated });
      return res.json({ signal });
    }
    res.json({ message: 'Event received, no action taken' });
  } catch (err) { next(err); }
});

module.exports = router;
