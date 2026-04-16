// backend/tests/interventions.test.js
const request = require('supertest');
const createApp = require('../src/app');
const prisma = require('../src/lib/prisma');
const { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup } = require('./helpers');

const app = createApp();
let company, user, customer;

beforeAll(async () => {
  company  = await createTestCompany({ name: 'Intervention Co', api_key: 'iv-key-test-001' });
  user     = await createTestUser(company.id);
  customer = await createTestCustomer(company.id, { email: 'iv@test.com' });
  await prisma.churnScore.create({
    data: { customer_id: customer.id, company_id: company.id, score: 75, factors: {} },
  });
});
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/interventions', () => {
  test('returns at-risk customers with playbook', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get('/api/interventions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('interventions');
    expect(res.body).toHaveProperty('total');
    expect(res.body.interventions.length).toBeGreaterThan(0);
    const item = res.body.interventions[0];
    expect(item).toHaveProperty('customer');
    expect(item).toHaveProperty('score');
    expect(item).toHaveProperty('playbook');
    expect(item).toHaveProperty('scored_at');
    expect(item).toHaveProperty('factors');
    expect(item).toHaveProperty('trust_level');
    expect(item).toHaveProperty('escalation_pattern');
    expect(res.body.total).toBe(1);
    expect(item.score).toBeGreaterThan(30);
  });

  test('respects min_score query param', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get('/api/interventions?min_score=90')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.interventions.length).toBe(0);
  });

  test('rejects API key auth', async () => {
    const res = await request(app)
      .get('/api/interventions')
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(401);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/interventions');
    expect(res.status).toBe(401);
  });

  test('does not return scores from another tenant', async () => {
    const other = await createTestCompany({ name: 'Other Co', api_key: 'iv-other-001' });
    const otherCust = await createTestCustomer(other.id, { email: 'x@other.com' });
    await prisma.churnScore.create({
      data: { customer_id: otherCust.id, company_id: other.id, score: 90, factors: {} },
    });
    const token = makeJwt(user, company);
    const res = await request(app)
      .get('/api/interventions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.interventions.every(i => i.customer.id !== otherCust.id)).toBe(true);
    await prisma.churnScore.deleteMany({ where: { company_id: other.id } });
    await prisma.customer.deleteMany({ where: { company_id: other.id } });
    await prisma.user.deleteMany({ where: { company_id: other.id } });
    await prisma.company.delete({ where: { id: other.id } });
  });
});
