// backend/tests/playbook.test.js
const { getPlaybook, PLAYBOOKS } = require('../src/services/playbook-service');

describe('getPlaybook — unit', () => {
  test('id:1 critical for high-at_risk-volatile', () => {
    const p = getPlaybook(75, 'at_risk', 'threatens_cancel');
    expect(p.id).toBe(1);
    expect(p.urgency).toBe('critical');
  });

  test('id:2 executive retention for high-at_risk-calm', () => {
    const p = getPlaybook(75, 'at_risk', 'never_escalated');
    expect(p.id).toBe(2);
    expect(p.urgency).toBe('high');
  });

  test('id:3 de-escalation for high-stable-volatile', () => {
    const p = getPlaybook(75, 'loyal_advocate', 'escalates_quickly');
    expect(p.id).toBe(3);
    expect(p.urgency).toBe('high');
  });

  test('id:4 proactive check-in for high-stable-calm', () => {
    const p = getPlaybook(75, 'loyal_advocate', 'never_escalated');
    expect(p.id).toBe(4);
    expect(p.urgency).toBe('medium');
  });

  test('id:8 no action for low-stable-calm', () => {
    const p = getPlaybook(10, 'loyal_advocate', 'never_escalated');
    expect(p.id).toBe(8);
    expect(p.urgency).toBe('none');
  });

  test('all 8 combinations produce unique playbook ids', () => {
    const combos = [
      [75, 'at_risk',        'threatens_cancel'],
      [75, 'at_risk',        'never_escalated'],
      [75, 'loyal_advocate', 'escalates_quickly'],
      [75, 'loyal_advocate', 'never_escalated'],
      [10, 'at_risk',        'threatens_cancel'],
      [10, 'at_risk',        'never_escalated'],
      [10, 'loyal_advocate', 'escalates_quickly'],
      [10, 'loyal_advocate', 'never_escalated'],
    ];
    const ids = combos.map(([s, t, e]) => getPlaybook(s, t, e).id);
    expect(new Set(ids).size).toBe(8);
  });

  test('defaults to no-action for null inputs', () => {
    expect(getPlaybook(0, null, null).id).toBe(8);
  });

  test('each playbook has title, action, urgency', () => {
    Object.values(PLAYBOOKS).forEach(p => {
      expect(p).toHaveProperty('title');
      expect(p).toHaveProperty('action');
      expect(p).toHaveProperty('urgency');
    });
  });
});

const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup } = require('./helpers');

const app2 = createApp();
let company2, user2, customer2;

beforeAll(async () => {
  company2  = await createTestCompany({ name: 'Playbook Co', api_key: 'pb-key-test-001' });
  user2     = await createTestUser(company2.id);
  customer2 = await createTestCustomer(company2.id, { email: 'pb@test.com' });
});
afterAll(async () => { await cleanup(company2.id); });

describe('GET /api/playbook/:customerId', () => {
  test('returns playbook for valid customer', async () => {
    const token = makeJwt(user2, company2);
    const res = await request(app2)
      .get(`/api/playbook/${customer2.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('action');
    expect(res.body).toHaveProperty('urgency');
  });

  test('returns 404 for nonexistent customer', async () => {
    const token = makeJwt(user2, company2);
    const res = await request(app2)
      .get('/api/playbook/nonexistent-xyz')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
