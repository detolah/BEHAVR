const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, createTestUser, cleanup } = require('./helpers');

const app = createApp();
let company;

beforeAll(async () => {
  company = await createTestCompany();
  await createTestUser(company.id, { email: 'agent@test.com', password: 'pass123' });
});
afterAll(async () => { await cleanup(company.id); });

describe('POST /api/auth/login', () => {
  test('returns JWT on valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'agent@test.com',
      password: 'pass123',
      companyId: company.id,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('agent@test.com');
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'agent@test.com',
      password: 'wrong',
      companyId: company.id,
    });
    expect(res.status).toBe(401);
  });

  test('rejects missing fields', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'agent@test.com' });
    expect(res.status).toBe(400);
  });
});
