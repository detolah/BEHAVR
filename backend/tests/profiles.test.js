const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup } = require('./helpers');

const app = createApp();
let company, agent, lead, agentToken, leadToken, customer;

beforeAll(async () => {
  company = await createTestCompany({ industry: 'saas' });
  agent = await createTestUser(company.id, { role: 'agent', email: 'agent@prof.com' });
  lead  = await createTestUser(company.id, { role: 'lead',  email: 'lead@prof.com'  });
  agentToken = makeJwt(agent, company);
  leadToken  = makeJwt(lead,  company);
  customer   = await createTestCustomer(company.id);
  await request(app)
    .get(`/api/customers/${encodeURIComponent(customer.email)}`)
    .set('Authorization', `Bearer ${agentToken}`);
});
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/profiles/:customer_id', () => {
  test('returns profile', async () => {
    const res = await request(app)
      .get(`/api/profiles/${customer.id}`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.customer_id).toBe(customer.id);
  });

  test('401 without auth', async () => {
    expect((await request(app).get(`/api/profiles/${customer.id}`)).status).toBe(401);
  });
});

describe('PATCH /api/profiles/:customer_id', () => {
  test('agent updates core field', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${customer.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ core_fields: { emotional_baseline: 'anxious' } });
    expect(res.status).toBe(200);
    expect(res.body.core_fields.emotional_baseline).toBe('anxious');
  });

  test('agent blocked from sensitivity_flags', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${customer.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ core_fields: { sensitivity_flags: ['accessibility'] } });
    expect(res.status).toBe(403);
  });

  test('lead can set sensitivity_flags', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${customer.id}`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ core_fields: { sensitivity_flags: ['accessibility'] } });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/profiles/:customer_id/history', () => {
  test('returns audit entries after patch', async () => {
    const res = await request(app)
      .get(`/api/profiles/${customer.id}/history`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
