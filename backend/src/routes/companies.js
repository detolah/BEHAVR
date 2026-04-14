const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const router = express.Router();

router.post('/', async (req, res, next) => {
  const { name, industry, zendesk_subdomain, adminEmail, adminPassword, adminName } = req.body;
  if (!name || !industry || !adminEmail || !adminPassword || !adminName) {
    return res.status(400).json({ error: 'Missing required fields: name, industry, adminEmail, adminPassword, adminName' });
  }
  try {
    const api_key = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const company = await prisma.company.create({
      data: { name, industry, zendesk_subdomain, api_key },
    });

    const user = await prisma.user.create({
      data: {
        company_id: company.id,
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: 'manager',
      },
      select: { id: true, email: true, name: true, role: true },
    });

    res.status(201).json({ company, user, api_key });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already registered' });
    next(err);
  }
});

module.exports = router;
