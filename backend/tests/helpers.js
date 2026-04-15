const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');

async function createTestCompany(overrides = {}) {
  return prisma.company.create({
    data: {
      name: 'Test Co',
      industry: 'saas',
      api_key: crypto.randomBytes(32).toString('hex'),
      zendesk_subdomain: 'testco',
      ...overrides,
    },
  });
}

async function createTestUser(company_id, overrides = {}) {
  const password = await bcrypt.hash(overrides.password || 'password123', 10);
  return prisma.user.create({
    data: {
      company_id,
      email: overrides.email || `agent-${Date.now()}@test.com`,
      password,
      name: overrides.name || 'Test Agent',
      role: overrides.role || 'agent',
    },
  });
}

async function createTestCustomer(company_id, overrides = {}) {
  return prisma.customer.create({
    data: {
      company_id,
      email: overrides.email || `customer-${Date.now()}@example.com`,
      name: overrides.name || 'Test Customer',
      ...overrides,
    },
  });
}

function makeJwt(user, company) {
  return jwt.sign(
    { userId: user.id, companyId: company.id, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

async function cleanup(company_id) {
  await prisma.profileHistory.deleteMany({ where: { profile: { company_id } } });
  await prisma.profile.deleteMany({ where: { company_id } });
  await prisma.signal.deleteMany({ where: { company_id } });
  await prisma.customer.deleteMany({ where: { company_id } });
  await prisma.user.deleteMany({ where: { company_id } });
  await prisma.company.delete({ where: { id: company_id } });
}

module.exports = { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup };
