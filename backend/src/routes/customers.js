const express = require('express');
const https = require('https');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { seedProfile } = require('../services/profile-service');
const { seedSignal } = require('../services/signal-service');

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

async function bulkUpsert(company_id, rows) {
  let imported = 0, skipped = 0;
  const errors = [];

  for (const row of rows) {
    const email = (row.email || '').trim().toLowerCase();
    const name  = (row.name  || '').trim() || null;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ email: email || '(blank)', reason: 'Invalid email' });
      continue;
    }
    try {
      const existing = await prisma.customer.findUnique({
        where: { company_id_email: { company_id, email } },
      });
      if (existing) { skipped++; continue; }
      const customer = await prisma.customer.create({ data: { company_id, email, name } });
      await Promise.all([
        seedProfile(customer.id, company_id),
        seedSignal(customer.id, company_id),
      ]);
      imported++;
    } catch (e) {
      errors.push({ email, reason: e.message });
    }
  }
  return { imported, skipped, errors };
}

function fetchZendeskUsers(subdomain, email, token) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${email}/token:${token}`).toString('base64');
    const results = [];

    function fetchPage(url) {
      const opts = {
        hostname: `${subdomain}.zendesk.com`,
        path: url,
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      };
      https.get(opts, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          if (res.statusCode === 401) return reject(new Error('Invalid Zendesk credentials'));
          if (res.statusCode !== 200) return reject(new Error(`Zendesk API error: ${res.statusCode}`));
          try {
            const data = JSON.parse(body);
            results.push(...(data.users || []));
            if (data.next_page) {
              const next = new URL(data.next_page);
              fetchPage(next.pathname + next.search);
            } else {
              resolve(results);
            }
          } catch (e) { reject(e); }
        });
      }).on('error', reject);
    }

    fetchPage('/api/v2/users.json?role=end-user&per_page=100');
  });
}

// ── routes ───────────────────────────────────────────────────────────────────

router.get('/list', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { company_id: req.company.id },
      include: {
        profiles:    { where: { company_id: req.company.id }, select: { id: true, core_fields: true, updated_at: true } },
        signals:     { where: { company_id: req.company.id } },
        churnScores: { where: { company_id: req.company.id }, select: { score: true, scored_at: true } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(customers.map(c => ({
      ...c,
      profile:    c.profiles[0]    || null,
      signal:     c.signals[0]     || null,
      churnScore: c.churnScores[0] ? {
        ...c.churnScores[0],
        risk_level: c.churnScores[0].score >= 70 ? 'high' : c.churnScores[0].score >= 55 ? 'medium' : 'low',
      } : null,
      profiles:    undefined,
      signals:     undefined,
      churnScores: undefined,
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

router.post('/import/csv', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: 'rows array required' });
    if (rows.length > 1000)
      return res.status(400).json({ error: 'Maximum 1000 rows per import' });
    const result = await bulkUpsert(req.company.id, rows);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/import/zendesk', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const { subdomain, email, api_token } = req.body;
    if (!subdomain || !email || !api_token)
      return res.status(400).json({ error: 'subdomain, email and api_token required' });
    const users = await fetchZendeskUsers(subdomain, email, api_token);
    const rows = users.map(u => ({ email: u.email, name: u.name })).filter(r => r.email);
    const result = await bulkUpsert(req.company.id, rows);
    res.json({ ...result, total_fetched: users.length });
  } catch (err) {
    if (err.message.includes('credentials')) return res.status(401).json({ error: err.message });
    next(err);
  }
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
