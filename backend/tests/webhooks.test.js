const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, createTestCustomer, cleanup } = require('./helpers');

const app = createApp();
let company, customer;

beforeAll(async () => {
  company  = await createTestCompany();
  customer = await createTestCustomer(company.id);
  await request(app)
    .get(`/api/customers/${encodeURIComponent(customer.email)}`)
    .set('x-api-key', company.api_key);
});
afterAll(async () => { await cleanup(company.id); });

describe('POST /api/webhooks/zendesk', () => {
  test('increments contact_count on ticket.solved', async () => {
    const res = await request(app)
      .post('/api/webhooks/zendesk')
      .set('x-api-key', company.api_key)
      .send({ event: 'ticket.solved', customer_email: customer.email });
    expect(res.status).toBe(200);
    expect(res.body.signal.contact_count).toBe(1);
  });

  test('increments escalation_count when escalated=true', async () => {
    const res = await request(app)
      .post('/api/webhooks/zendesk')
      .set('x-api-key', company.api_key)
      .send({ event: 'ticket.solved', customer_email: customer.email, escalated: true });
    expect(res.status).toBe(200);
    expect(res.body.signal.escalation_count).toBe(1);
  });

  test('400 on missing customer_email', async () => {
    const res = await request(app)
      .post('/api/webhooks/zendesk')
      .set('x-api-key', company.api_key)
      .send({ event: 'ticket.solved' });
    expect(res.status).toBe(400);
  });

  test('401 on bad API key', async () => {
    const res = await request(app)
      .post('/api/webhooks/zendesk')
      .set('x-api-key', 'bad-key')
      .send({ event: 'ticket.solved', customer_email: customer.email });
    expect(res.status).toBe(401);
  });
});
