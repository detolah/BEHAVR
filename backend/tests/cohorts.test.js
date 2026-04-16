// backend/tests/cohorts.test.js
const request = require('supertest');
const createApp = require('../src/app');
const prisma = require('../src/lib/prisma');
const { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup } = require('./helpers');

const app = createApp();
let company, user;

beforeAll(async () => {
  company = await createTestCompany({ name: 'Cohort Co', api_key: 'co-key-test-001' });
  user    = await createTestUser(company.id);
  const c1 = await createTestCustomer(company.id, { email: 'c1@cohort.com' });
  const c2 = await createTestCustomer(company.id, { email: 'c2@cohort.com' });
  await prisma.churnScore.createMany({
    data: [
      { customer_id: c1.id, company_id: company.id, score: 80, factors: {} },
      { customer_id: c2.id, company_id: company.id, score: 20, factors: {} },
    ],
  });
});
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/cohorts', () => {
  test('returns aggregate cohort statistics', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get('/api/cohorts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_customers', 2);
    expect(res.body).toHaveProperty('avg_churn_score', 50);
    expect(res.body.churn_distribution).toEqual({ low: 1, medium: 0, high: 1 });
    expect(res.body).toHaveProperty('trust_breakdown');
    expect(res.body).toHaveProperty('escalation_breakdown');
  });

  test('rejects API key auth', async () => {
    const res = await request(app)
      .get('/api/cohorts')
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(401);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/cohorts');
    expect(res.status).toBe(401);
  });
});
