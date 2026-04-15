const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { getProfile, updateProfile, getProfileHistory, seedProfile } = require('../services/profile-service');

const router = express.Router();
const ROLE_RANK = { agent: 1, lead: 2, csm: 3, manager: 4 };

router.get('/:customer_id', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const profile = await getProfile(req.params.customer_id, req.company.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (err) { next(err); }
});

router.post('/:customer_id', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const profile = await seedProfile(req.params.customer_id, req.company.id);
    res.status(201).json(profile);
  } catch (err) { next(err); }
});

router.patch('/:customer_id', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const { core_fields } = req.body;
    const userRank = ROLE_RANK[req.user.role] || 0;
    if (core_fields?.sensitivity_flags !== undefined && userRank < 2) {
      return res.status(403).json({ error: 'Requires lead role or above to edit sensitivity_flags' });
    }
    const profile = await prisma.profile.findFirst({
      where: { customer_id: req.params.customer_id, company_id: req.company.id },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const updated = await updateProfile(profile.id, req.company.id, req.body, req.user.id || 'api-key');
    res.json(updated);
  } catch (err) { next(err); }
});

router.get('/:customer_id/history', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const profile = await prisma.profile.findFirst({
      where: { customer_id: req.params.customer_id, company_id: req.company.id },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const history = await getProfileHistory(profile.id, req.company.id);
    res.json(history);
  } catch (err) { next(err); }
});

module.exports = router;
