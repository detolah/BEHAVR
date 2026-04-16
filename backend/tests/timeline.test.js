// backend/tests/timeline.test.js
const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup } = require('./helpers');

const app = createApp();
let company, user, customer;

beforeAll(async () => {
  company  = await createTestCompany({ name: 'Timeline Co', api_key: 'tl-key-test-001' });
  user     = await createTestUser(company.id);
  customer = await createTestCustomer(company.id, { email: 'tl@test.com' });
});
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/timeline/:customerId', () => {
  test('returns events array including customer_created', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get(`/api/timeline/${customer.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const created = res.body.find(e => e.type === 'customer_created');
    expect(created).toBeDefined();
    expect(created).toHaveProperty('timestamp');
    expect(created).toHaveProperty('description');
    expect(created).toHaveProperty('actor');
  });

  test('events are sorted newest first', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get(`/api/timeline/${customer.id}`)
      .set('Authorization', `Bearer ${token}`);
    const timestamps = res.body.map(e => new Date(e.timestamp).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  test('returns 404 for customer not in company', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get('/api/timeline/does-not-exist-xyz')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('accepts API key auth', async () => {
    const res = await request(app)
      .get(`/api/timeline/${customer.id}`)
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(200);
  });
});
