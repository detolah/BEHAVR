// backend/src/routes/timeline.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { getTimeline } = require('../services/timeline-service');

const router = express.Router();

router.get('/:customerId', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const events = await getTimeline(req.params.customerId, req.company.id);
    if (events === null) return res.status(404).json({ error: 'Customer not found' });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
