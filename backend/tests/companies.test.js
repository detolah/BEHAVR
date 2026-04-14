const request = require('supertest');
const createApp = require('../src/app');
const prisma = require('../src/lib/prisma');

const app = createApp();

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: 'admin@acme.com' } });
  await prisma.company.deleteMany({ where: { name: 'Acme Corp' } });
});

describe('POST /api/companies', () => {
  test('creates company and returns api_key', async () => {
    const res = await request(app).post('/api/companies').send({
      name: 'Acme Corp',
      industry: 'saas',
      zendesk_subdomain: 'acme',
      adminEmail: 'admin@acme.com',
      adminPassword: 'securepass123',
      adminName: 'Admin User',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('api_key');
    expect(res.body.company.name).toBe('Acme Corp');
    expect(res.body.user.role).toBe('manager');
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('rejects missing required fields', async () => {
    const res = await request(app).post('/api/companies').send({ name: 'Acme Corp' });
    expect(res.status).toBe(400);
  });
});
