const request = require('supertest');
const createApp = require('../src/app');

const app = createApp();

describe('GET /api/schema/:industry', () => {
  test('returns core + saas schema', async () => {
    const res = await request(app).get('/api/schema/saas');
    expect(res.status).toBe(200);
    expect(res.body.core).toHaveProperty('communication_dna');
    expect(res.body.industry).toHaveProperty('technical_literacy');
  });

  test('returns core + null industry for unknown industry', async () => {
    const res = await request(app).get('/api/schema/unknown');
    expect(res.status).toBe(200);
    expect(res.body.core).toHaveProperty('communication_dna');
    expect(res.body.industry).toBeNull();
  });

  test('core schema has all 11 expected fields', async () => {
    const res = await request(app).get('/api/schema/saas');
    const coreKeys = Object.keys(res.body.core);
    expect(coreKeys).toContain('communication_dna');
    expect(coreKeys).toContain('sensitivity_flags');
    expect(coreKeys).toContain('new_agent_brief');
    expect(coreKeys).toContain('what_has_worked');
    expect(coreKeys).toContain('what_to_avoid');
  });

  test('saas industry schema has all 6 fields', async () => {
    const res = await request(app).get('/api/schema/saas');
    const industryKeys = Object.keys(res.body.industry);
    expect(industryKeys).toHaveLength(6);
    expect(industryKeys).toContain('technical_literacy');
    expect(industryKeys).toContain('channel_preference');
  });
});
