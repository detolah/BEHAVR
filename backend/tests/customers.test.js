const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, createTestUser, makeJwt, cleanup } = require('./helpers');

const app = createApp();
let company, user, token;

beforeAll(async () => {
  company = await createTestCompany({ industry: 'saas' });
  user = await createTestUser(company.id, { role: 'agent' });
  token = makeJwt(user, company);
});
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/customers/:email', () => {
  test('creates customer + profile + signal on first fetch', async () => {
    const email = `new-${Date.now()}@example.com`;
    const res = await request(app)
      .get(`/api/customers/${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.customer.email).toBe(email);
    expect(res.body.profile).toBeDefined();
    expect(res.body.signal).toBeDefined();
    expect(res.body.isNew).toBe(true);
  });

  test('isNew=false on second fetch', async () => {
    const email = `existing-${Date.now()}@example.com`;
    await request(app).get(`/api/customers/${encodeURIComponent(email)}`).set('Authorization', `Bearer ${token}`);
    const res = await request(app).get(`/api/customers/${encodeURIComponent(email)}`).set('Authorization', `Bearer ${token}`);
    expect(res.body.isNew).toBe(false);
  });

  test('API key auth works', async () => {
    const res = await request(app)
      .get(`/api/customers/apikey-${Date.now()}%40example.com`)
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(200);
  });

  test('tenant isolation: same email = separate record per company', async () => {
    const companyB = await createTestCompany({ name: 'Co B' });
    const userB = await createTestUser(companyB.id, { role: 'agent' });
    const tokenB = makeJwt(userB, companyB);
    const email = `shared-${Date.now()}@example.com`;
    await request(app).get(`/api/customers/${encodeURIComponent(email)}`).set('Authorization', `Bearer ${token}`);
    const res = await request(app).get(`/api/customers/${encodeURIComponent(email)}`).set('Authorization', `Bearer ${tokenB}`);
    expect(res.body.isNew).toBe(true);
    await cleanup(companyB.id);
  });
});

describe('GET /api/customers/list', () => {
  test('returns array scoped to company', async () => {
    const res = await request(app).get('/api/customers/list').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
