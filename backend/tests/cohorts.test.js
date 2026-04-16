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
  await prisma.profile.createMany({
    data: [
      { customer_id: c1.id, company_id: company.id, core_fields: { trust_level: 'at_risk', escalation_pattern: 'escalates_quickly' } },
      { customer_id: c2.id, company_id: company.id, core_fields: { trust_level: 'loyal_advocate', escalation_pattern: 'never_escalated' } },
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
    expect(res.body.trust_breakdown).toEqual({ at_risk: 1, loyal_advocate: 1 });
    expect(res.body.escalation_breakdown).toEqual({ escalates_quickly: 1, never_escalated: 1 });
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

  test('does not include scores from another tenant', async () => {
    const other = await createTestCompany({ name: 'Other Co', api_key: 'co-other-001' });
    const otherCust = await createTestCustomer(other.id, { email: 'x@other.com' });
    await prisma.churnScore.create({
      data: { customer_id: otherCust.id, company_id: other.id, score: 99, factors: {} },
    });
    const token = makeJwt(user, company);
    const res = await request(app)
      .get('/api/cohorts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.total_customers).toBe(2);
    expect(res.body.avg_churn_score).toBe(50);
    await prisma.churnScore.deleteMany({ where: { company_id: other.id } });
    await prisma.customer.deleteMany({ where: { company_id: other.id } });
    await prisma.user.deleteMany({ where: { company_id: other.id } });
    await prisma.company.delete({ where: { id: other.id } });
  });

  test('returns zeros when company has no churn scores', async () => {
    const empty = await createTestCompany({ name: 'Empty Co', api_key: 'co-empty-001' });
    const emptyUser = await createTestUser(empty.id);
    const token = makeJwt(emptyUser, empty);
    const res = await request(app)
      .get('/api/cohorts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.total_customers).toBe(0);
    expect(res.body.avg_churn_score).toBe(0);
    expect(res.body.churn_distribution).toEqual({ low: 0, medium: 0, high: 0 });
    expect(res.body.trust_breakdown).toEqual({});
    expect(res.body.escalation_breakdown).toEqual({});
    await cleanup(empty.id);
  });
});
