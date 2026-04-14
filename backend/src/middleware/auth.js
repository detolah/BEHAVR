const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'test') {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

async function requireJwt(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId, companyId: payload.companyId, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  const company = await prisma.company.findUnique({ where: { api_key: key } });
  if (!company) return res.status(401).json({ error: 'Invalid API key' });
  req.company = company;
  req.user = { id: null, companyId: company.id, role: 'agent' };
  next();
}

async function requireAuth(req, res, next) {
  if (req.headers['x-api-key']) return requireApiKey(req, res, next);
  return requireJwt(req, res, next);
}

module.exports = { requireJwt, requireApiKey, requireAuth };
