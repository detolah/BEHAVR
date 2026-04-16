// backend/tests/churn.test.js
const request = require('supertest');
const createApp = require('../src/app');
const prisma = require('../src/lib/prisma');
const { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup } = require('./helpers');

const app = createApp();
let company, user, customer;

beforeAll(async () => {
  company  = await createTestCompany();
  user     = await createTestUser(company.id);
  customer = await createTestCustomer(company.id);
});
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/churn/:customerId', () => {
  test('returns churn score for valid customer (JWT)', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get(`/api/churn/${customer.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('score');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
    expect(res.body).toHaveProperty('factors');
    expect(res.body).toHaveProperty('scored_at');
  });

  test('accepts API key auth', async () => {
    const res = await request(app)
      .get(`/api/churn/${customer.id}`)
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(200);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/churn/${customer.id}`);
    expect(res.status).toBe(401);
  });

  test('returns 404 for customer not in company', async () => {
    const other     = await createTestCompany({ name: 'Other Co', api_key: 'other-key-999' });
    const otherCust = await createTestCustomer(other.id, { email: 'x@other.com' });
    const token     = makeJwt(user, company);
    const res = await request(app)
      .get(`/api/churn/${otherCust.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    await prisma.customer.delete({ where: { id: otherCust.id } });
    await prisma.company.delete({ where: { id: other.id } });
  });
});
