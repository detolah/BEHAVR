const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

router.post('/login', async (req, res, next) => {
  const { email, password, companyId } = req.body;
  if (!email || !password || !companyId) {
    return res.status(400).json({ error: 'email, password, and companyId required' });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { company_id_email: { company_id: companyId, email } },
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, companyId: user.company_id, role: user.role },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
