const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, cleanup } = require('./helpers');

const app = createApp();
let company;

beforeAll(async () => { company = await createTestCompany(); });
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/schema/:industry', () => {
  test('returns core + saas schema', async () => {
    const res = await request(app)
      .get('/api/schema/saas')
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(200);
    expect(res.body.core).toHaveProperty('communication_dna');
    expect(res.body.industry).toHaveProperty('technical_literacy');
  });

  test('returns null industry for unknown industry', async () => {
    const res = await request(app)
      .get('/api/schema/unknown')
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(200);
    expect(res.body.industry).toBeNull();
  });

  test('core schema has exactly 11 fields with correct structure', async () => {
    const res = await request(app)
      .get('/api/schema/saas')
      .set('x-api-key', company.api_key);
    expect(Object.keys(res.body.core)).toHaveLength(11);
    expect(res.body.core.sensitivity_flags).toHaveProperty('requiresRole', 'lead');
    expect(res.body.core.new_agent_brief).toHaveProperty('maxLength', 300);
  });

  test('saas industry schema has exactly 6 fields', async () => {
    const res = await request(app)
      .get('/api/schema/saas')
      .set('x-api-key', company.api_key);
    expect(Object.keys(res.body.industry)).toHaveLength(6);
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/schema/saas');
    expect(res.status).toBe(401);
  });
});
