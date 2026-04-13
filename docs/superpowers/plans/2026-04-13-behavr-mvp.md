# BEHAVR MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build BEHAVR Phase 1 — a multi-tenant behavioral intelligence SaaS with Zendesk sidebar widget and React dashboard.

**Architecture:** Express/Prisma backend with per-company tenant scoping on every query; Vanilla JS ZAF sidebar widget fetching from BEHAVR API; React dashboard for profile management. JWT for dashboard auth, API keys for widget auth.

**Tech Stack:** Node.js, Express, PostgreSQL, Prisma, React, Vite, Tailwind CSS, Vanilla JS, ZAF SDK v2, Jest, Supertest, Vitest

---

## File Map

```
behavr/
  backend/
    package.json
    jest.config.js
    .env.example
    src/
      app.js               — Express app factory (no listen, for testing)
      server.js            — Entry: calls app.listen
      lib/
        prisma.js          — Prisma client singleton
      middleware/
        auth.js            — JWT + API key verification
        tenant.js          — Attach req.company, scope by company_id
        roles.js           — Role-based access guard factory
      routes/
        auth.js            — POST /api/auth/login
        companies.js       — POST /api/companies
        customers.js       — GET /api/customers/:email
        profiles.js        — GET/POST/PATCH /api/profiles/:id, GET history
        webhooks.js        — POST /api/webhooks/zendesk
        schema.js          — GET /api/schema/:industry
      services/
        profile-service.js — seed/get/update profile logic
        signal-service.js  — upsert signal logic
        schema-service.js  — return field definitions per industry
    prisma/
      schema.prisma
      seed.js
    tests/
      setup.js
      helpers.js
      auth.test.js
      companies.test.js
      customers.test.js
      profiles.test.js
      webhooks.test.js
      schema.test.js
  dashboard/
    package.json
    index.html
    vite.config.js
    tailwind.config.js
    postcss.config.js
    src/
      main.jsx
      App.jsx
      api/
        client.js          — axios instance with JWT header
        customers.js
        profiles.js
        companies.js
      context/
        AuthContext.jsx
      hooks/
        useAuth.js
        useProfile.js
      pages/
        Login.jsx
        Onboarding.jsx
        CustomerList.jsx
        ProfileEditor.jsx
        History.jsx
      components/
        ProfileCard.jsx
        FieldEditor.jsx
        SignalBadge.jsx
        IndustryFields.jsx
        RoleGate.jsx
  zendesk-app/
    manifest.json
    assets/
      index.html
      app.js
      styles.css
```

---

## Task 1: Backend Scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/jest.config.js`
- Create: `backend/src/app.js`
- Create: `backend/src/server.js`
- Create: `backend/src/lib/prisma.js`

- [ ] **Step 1: Create backend directory and package.json**

```bash
mkdir -p backend/src/{lib,middleware,routes,services}
mkdir -p backend/tests
mkdir -p backend/prisma
```

```json
// backend/package.json
{
  "name": "behavr-backend",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch --runInBand",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "node prisma/seed.js"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "nodemon": "^3.1.0",
    "prisma": "^5.14.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Create .env.example**

```bash
# backend/.env.example
DATABASE_URL="postgresql://user:password@localhost:5432/behavr"
JWT_SECRET="change-me-in-production-min-32-chars"
JWT_EXPIRES_IN="24h"
PORT=3001
ZENDESK_SHARED_SECRET="your-zendesk-shared-secret"
```

- [ ] **Step 3: Create jest.config.js**

```js
// backend/jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterFramework: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
};
```

- [ ] **Step 4: Create Prisma client singleton**

```js
// backend/src/lib/prisma.js
const { PrismaClient } = require('@prisma/client');

const prisma = global.__prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
```

- [ ] **Step 5: Create app.js**

```js
// backend/src/app.js
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const companiesRoutes = require('./routes/companies');
const customersRoutes = require('./routes/customers');
const profilesRoutes = require('./routes/profiles');
const webhooksRoutes = require('./routes/webhooks');
const schemaRoutes = require('./routes/schema');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth', authRoutes);
  app.use('/api/companies', companiesRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/profiles', profilesRoutes);
  app.use('/api/webhooks', webhooksRoutes);
  app.use('/api/schema', schemaRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
```

- [ ] **Step 6: Create server.js**

```js
// backend/src/server.js
require('dotenv').config();
const createApp = require('./app');

const app = createApp();
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`BEHAVR backend running on port ${PORT}`);
});
```

- [ ] **Step 7: Install dependencies**

```bash
cd backend && npm install
```

---

## Task 2: Prisma Schema

**Files:**
- Create: `backend/prisma/schema.prisma`

- [ ] **Step 1: Write schema.prisma**

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  agent
  lead
  csm
  manager
}

model Company {
  id                String    @id @default(cuid())
  name              String
  industry          String
  plan_tier         String    @default("free")
  zendesk_subdomain String?
  api_key           String    @unique
  created_at        DateTime  @default(now())

  users     User[]
  customers Customer[]
  profiles  Profile[]
  signals   Signal[]
}

model User {
  id         String   @id @default(cuid())
  company_id String
  email      String
  password   String
  name       String
  role       Role     @default(agent)
  created_at DateTime @default(now())

  company Company @relation(fields: [company_id], references: [id])

  @@unique([company_id, email])
}

model Customer {
  id          String   @id @default(cuid())
  company_id  String
  email       String
  external_id String?
  name        String?
  created_at  DateTime @default(now())

  company  Company   @relation(fields: [company_id], references: [id])
  profiles Profile[]
  signals  Signal[]

  @@unique([company_id, email])
}

model Profile {
  id              String   @id @default(cuid())
  customer_id     String
  company_id      String
  core_fields     Json?
  industry_fields Json?
  agent_note      String?
  new_agent_brief String?
  last_updated_by String?
  updated_at      DateTime @updatedAt

  customer Customer        @relation(fields: [customer_id], references: [id])
  company  Company         @relation(fields: [company_id], references: [id])
  history  ProfileHistory[]

  @@unique([customer_id, company_id])
}

model ProfileHistory {
  id         String   @id @default(cuid())
  profile_id String
  changed_by String
  field_name String
  old_value  String?
  new_value  String?
  changed_at DateTime @default(now())

  profile Profile @relation(fields: [profile_id], references: [id])
}

model Signal {
  id                  String    @id @default(cuid())
  customer_id         String
  company_id          String
  contact_count       Int       @default(0)
  escalation_count    Int       @default(0)
  last_contact_at     DateTime?
  avg_sentiment_score Float?
  updated_at          DateTime  @updatedAt

  customer Customer @relation(fields: [customer_id], references: [id])
  company  Company  @relation(fields: [company_id], references: [id])

  @@unique([customer_id, company_id])
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend
cp .env.example .env
# Edit .env with your local DATABASE_URL
npx prisma migrate dev --name init
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 3: Generate client**

```bash
npx prisma generate
```

---

## Task 3: Test Helpers

**Files:**
- Create: `backend/tests/setup.js`
- Create: `backend/tests/helpers.js`

- [ ] **Step 1: Write setup.js**

```js
// backend/tests/setup.js
const prisma = require('../src/lib/prisma');

afterAll(async () => {
  await prisma.$disconnect();
});
```

- [ ] **Step 2: Write helpers.js**

```js
// backend/tests/helpers.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../src/lib/prisma');

async function createTestCompany(overrides = {}) {
  return prisma.company.create({
    data: {
      name: overrides.name || 'Test Co',
      industry: overrides.industry || 'saas',
      api_key: overrides.api_key || crypto.randomBytes(32).toString('hex'),
      zendesk_subdomain: overrides.zendesk_subdomain || 'testco',
      ...overrides,
    },
  });
}

async function createTestUser(company_id, overrides = {}) {
  const password = await bcrypt.hash(overrides.password || 'password123', 10);
  return prisma.user.create({
    data: {
      company_id,
      email: overrides.email || `agent-${Date.now()}@test.com`,
      password,
      name: overrides.name || 'Test Agent',
      role: overrides.role || 'agent',
    },
  });
}

async function createTestCustomer(company_id, overrides = {}) {
  return prisma.customer.create({
    data: {
      company_id,
      email: overrides.email || `customer-${Date.now()}@example.com`,
      name: overrides.name || 'Test Customer',
      ...overrides,
    },
  });
}

function makeJwt(user, company) {
  return jwt.sign(
    { userId: user.id, companyId: company.id, role: user.role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

async function cleanup(company_id) {
  await prisma.profileHistory.deleteMany({ where: { profile: { company_id } } });
  await prisma.profile.deleteMany({ where: { company_id } });
  await prisma.signal.deleteMany({ where: { company_id } });
  await prisma.customer.deleteMany({ where: { company_id } });
  await prisma.user.deleteMany({ where: { company_id } });
  await prisma.company.delete({ where: { id: company_id } });
}

module.exports = { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup };
```

---

## Task 4: Middleware — Auth

**Files:**
- Create: `backend/src/middleware/auth.js`
- Create: `backend/tests/auth.test.js` (middleware section)

- [ ] **Step 1: Write auth middleware**

```js
// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

async function requireJwt(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    req.user = { id: payload.userId, companyId: payload.companyId, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key) return res.status(401).json({ error: 'Missing API key' });
  const company = await prisma.company.findUnique({ where: { api_key: key } });
  if (!company) return res.status(401).json({ error: 'Invalid API key' });
  req.company = company;
  req.user = { companyId: company.id, role: 'agent' };
  next();
}

// Used by Zendesk widget routes — accepts either JWT or API key
async function requireAuth(req, res, next) {
  if (req.headers['x-api-key']) return requireApiKey(req, res, next);
  return requireJwt(req, res, next);
}

module.exports = { requireJwt, requireApiKey, requireAuth };
```

---

## Task 5: Middleware — Tenant Scoping

**Files:**
- Create: `backend/src/middleware/tenant.js`

- [ ] **Step 1: Write tenant middleware**

```js
// backend/src/middleware/tenant.js
const prisma = require('../lib/prisma');

// After requireJwt: attach full company to req, verify user belongs to it
async function attachCompany(req, res, next) {
  if (req.company) return next(); // already set by API key middleware
  try {
    const company = await prisma.company.findUnique({
      where: { id: req.user.companyId },
    });
    if (!company) return res.status(403).json({ error: 'Company not found' });
    req.company = company;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { attachCompany };
```

---

## Task 6: Middleware — Roles

**Files:**
- Create: `backend/src/middleware/roles.js`

- [ ] **Step 1: Write role guard factory**

```js
// backend/src/middleware/roles.js
const ROLE_RANK = { agent: 1, lead: 2, csm: 3, manager: 4 };

function requireRole(minRole) {
  return (req, res, next) => {
    const userRank = ROLE_RANK[req.user?.role] || 0;
    const minRank = ROLE_RANK[minRole] || 0;
    if (userRank < minRank) {
      return res.status(403).json({ error: `Requires ${minRole} role or above` });
    }
    next();
  };
}

module.exports = { requireRole };
```

---

## Task 7: Schema Service

**Files:**
- Create: `backend/src/services/schema-service.js`
- Create: `backend/tests/schema.test.js`

- [ ] **Step 1: Write schema-service.js**

```js
// backend/src/services/schema-service.js
const CORE_SCHEMA = {
  communication_dna: {
    type: 'enum',
    options: ['direct_blunt', 'detail_oriented', 'emotional_expressive', 'reserved_quiet', 'collaborative'],
  },
  support_trigger: {
    type: 'enum',
    options: ['critical_only', 'any_question', 'proactive', 'reactive'],
  },
  emotional_baseline: {
    type: 'enum',
    options: ['calm_rational', 'anxious', 'frustrated_default', 'already_escalated', 'apologetic'],
  },
  resolution_preference: {
    type: 'enum',
    options: ['quick_fix', 'full_explanation', 'wants_options', 'acknowledgment_first', 'written_confirmation'],
  },
  escalation_pattern: {
    type: 'enum',
    options: ['escalates_quickly', 'specific_trigger', 'never_escalated', 'threatens_cancel', 'posts_publicly'],
  },
  trust_level: {
    type: 'enum',
    options: ['loyal_advocate', 'neutral', 'skeptical', 'at_risk', 'retained_churner'],
  },
  followup_behavior: {
    type: 'enum',
    options: ['follows_up_relentlessly', 'goes_quiet', 'needs_checkin', 'prefers_left_alone'],
  },
  what_has_worked: { type: 'text', maxLength: 500 },
  what_to_avoid: { type: 'text', maxLength: 500 },
  sensitivity_flags: {
    type: 'multiselect',
    options: ['accessibility', 'language_barrier', 'billing_anxiety', 'legal_aware', 'personal_hardship', 'advocate_present'],
    requiresRole: 'lead',
  },
  new_agent_brief: { type: 'text', maxLength: 300 },
};

const INDUSTRY_SCHEMAS = {
  saas: {
    technical_literacy: {
      type: 'enum',
      options: ['non_technical', 'semi_technical', 'technical', 'developer'],
    },
    downtime_tolerance: { type: 'enum', options: ['very_low', 'moderate', 'high'] },
    integration_dependency: { type: 'enum', options: ['standalone', 'light_integrations', 'heavy_integrations'] },
    self_service_behavior: { type: 'enum', options: ['always_self_solves', 'contacts_immediately', 'mixed'] },
    adoption_stage: { type: 'enum', options: ['onboarding', 'mid_adoption', 'power_user', 'at_risk'] },
    channel_preference: { type: 'enum', options: ['email', 'live_chat', 'phone', 'async'] },
  },
};

function getSchema(industry) {
  return {
    core: CORE_SCHEMA,
    industry: INDUSTRY_SCHEMAS[industry] || null,
  };
}

module.exports = { getSchema, CORE_SCHEMA, INDUSTRY_SCHEMAS };
```

- [ ] **Step 2: Write failing test**

```js
// backend/tests/schema.test.js
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
});
```

- [ ] **Step 3: Run test — expect FAIL (route not built yet)**

```bash
cd backend && npx jest tests/schema.test.js --no-coverage
```

Expected: FAIL — `Cannot GET /api/schema/saas`

- [ ] **Step 4: Build schema route**

```js
// backend/src/routes/schema.js
const express = require('express');
const { getSchema } = require('../services/schema-service');

const router = express.Router();

router.get('/:industry', (req, res) => {
  const schema = getSchema(req.params.industry);
  res.json(schema);
});

module.exports = router;
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd backend && npx jest tests/schema.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/ tests/ prisma/ package.json jest.config.js .env.example
git commit -m "feat: scaffold backend, prisma schema, middleware, schema service"
```

---

## Task 8: Companies Route

**Files:**
- Create: `backend/src/routes/companies.js`
- Create: `backend/tests/companies.test.js`

- [ ] **Step 1: Write failing test**

```js
// backend/tests/companies.test.js
const request = require('supertest');
const createApp = require('../src/app');
const prisma = require('../src/lib/prisma');

const app = createApp();

afterEach(async () => {
  await prisma.company.deleteMany({ where: { name: 'Acme Corp' } });
});

describe('POST /api/companies', () => {
  test('creates company and returns api_key', async () => {
    const res = await request(app).post('/api/companies').send({
      name: 'Acme Corp',
      industry: 'saas',
      zendesk_subdomain: 'acme',
      adminEmail: 'admin@acme.com',
      adminPassword: 'securepass123',
      adminName: 'Admin User',
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('api_key');
    expect(res.body.company.name).toBe('Acme Corp');
    expect(res.body.user.role).toBe('manager');
  });

  test('rejects missing required fields', async () => {
    const res = await request(app).post('/api/companies').send({ name: 'Acme Corp' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/companies.test.js --no-coverage
```

- [ ] **Step 3: Build companies route**

```js
// backend/src/routes/companies.js
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const router = express.Router();

router.post('/', async (req, res, next) => {
  const { name, industry, zendesk_subdomain, adminEmail, adminPassword, adminName } = req.body;
  if (!name || !industry || !adminEmail || !adminPassword || !adminName) {
    return res.status(400).json({ error: 'Missing required fields: name, industry, adminEmail, adminPassword, adminName' });
  }
  try {
    const api_key = crypto.randomBytes(32).toString('hex');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    const company = await prisma.company.create({
      data: { name, industry, zendesk_subdomain, api_key },
    });

    const user = await prisma.user.create({
      data: {
        company_id: company.id,
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: 'manager',
      },
      select: { id: true, email: true, name: true, role: true },
    });

    res.status(201).json({ company, user, api_key });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Email already registered' });
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/companies.test.js --no-coverage
```

---

## Task 9: Auth Login Route

**Files:**
- Create: `backend/src/routes/auth.js`
- Create: `backend/tests/auth.test.js`

- [ ] **Step 1: Write failing test**

```js
// backend/tests/auth.test.js
const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, createTestUser, cleanup } = require('./helpers');

const app = createApp();
let company;

beforeAll(async () => { company = await createTestCompany(); });
afterAll(async () => { await cleanup(company.id); });

describe('POST /api/auth/login', () => {
  test('returns JWT on valid credentials', async () => {
    await createTestUser(company.id, { email: 'agent@test.com', password: 'pass123' });
    const res = await request(app).post('/api/auth/login').send({
      email: 'agent@test.com',
      password: 'pass123',
      companyId: company.id,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('agent@test.com');
  });

  test('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'agent@test.com',
      password: 'wrong',
      companyId: company.id,
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/auth.test.js --no-coverage
```

- [ ] **Step 3: Build auth route**

```js
// backend/src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  const { email, password, companyId } = req.body;
  if (!email || !password || !companyId) {
    return res.status(400).json({ error: 'email, password, and companyId required' });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { company_id_email: { company_id: companyId, email } },
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user.id, companyId: user.company_id, role: user.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/auth.test.js --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/ tests/
git commit -m "feat: companies registration and JWT auth login"
```

---

## Task 10: Profile Service

**Files:**
- Create: `backend/src/services/profile-service.js`
- Create: `backend/src/services/signal-service.js`

- [ ] **Step 1: Write profile-service.js**

```js
// backend/src/services/profile-service.js
const prisma = require('../lib/prisma');

async function seedProfile(customer_id, company_id) {
  return prisma.profile.upsert({
    where: { customer_id_company_id: { customer_id, company_id } },
    create: {
      customer_id,
      company_id,
      core_fields: null,
      industry_fields: null,
    },
    update: {},
  });
}

async function getProfile(customer_id, company_id) {
  return prisma.profile.findUnique({
    where: { customer_id_company_id: { customer_id, company_id } },
    include: {
      customer: { select: { id: true, email: true, name: true } },
    },
  });
}

async function updateProfile(profile_id, company_id, fields, changed_by) {
  const existing = await prisma.profile.findFirst({
    where: { id: profile_id, company_id },
  });
  if (!existing) return null;

  const historyEntries = [];
  const topLevelFields = ['agent_note', 'new_agent_brief', 'last_updated_by'];
  const updateData = { last_updated_by: changed_by, updated_at: new Date() };

  for (const [key, value] of Object.entries(fields)) {
    if (key === 'core_fields' || key === 'industry_fields') {
      const oldGroup = existing[key] || {};
      for (const [subKey, subVal] of Object.entries(value)) {
        if (oldGroup[subKey] !== subVal) {
          historyEntries.push({
            profile_id,
            changed_by,
            field_name: `${key}.${subKey}`,
            old_value: oldGroup[subKey] != null ? String(oldGroup[subKey]) : null,
            new_value: subVal != null ? String(subVal) : null,
          });
        }
      }
      updateData[key] = { ...oldGroup, ...value };
    } else if (topLevelFields.includes(key)) {
      if (existing[key] !== value) {
        historyEntries.push({
          profile_id,
          changed_by,
          field_name: key,
          old_value: existing[key],
          new_value: value,
        });
      }
      updateData[key] = value;
    }
  }

  const [profile] = await prisma.$transaction([
    prisma.profile.update({ where: { id: profile_id }, data: updateData }),
    ...(historyEntries.length > 0
      ? [prisma.profileHistory.createMany({ data: historyEntries })]
      : []),
  ]);

  return profile;
}

async function getProfileHistory(profile_id, company_id) {
  const profile = await prisma.profile.findFirst({ where: { id: profile_id, company_id } });
  if (!profile) return null;
  return prisma.profileHistory.findMany({
    where: { profile_id },
    orderBy: { changed_at: 'desc' },
  });
}

module.exports = { seedProfile, getProfile, updateProfile, getProfileHistory };
```

- [ ] **Step 2: Write signal-service.js**

```js
// backend/src/services/signal-service.js
const prisma = require('../lib/prisma');

async function seedSignal(customer_id, company_id) {
  return prisma.signal.upsert({
    where: { customer_id_company_id: { customer_id, company_id } },
    create: { customer_id, company_id },
    update: {},
  });
}

async function incrementContact(customer_id, company_id, { escalated = false } = {}) {
  return prisma.signal.update({
    where: { customer_id_company_id: { customer_id, company_id } },
    data: {
      contact_count: { increment: 1 },
      escalation_count: escalated ? { increment: 1 } : undefined,
      last_contact_at: new Date(),
    },
  });
}

async function updateSentiment(customer_id, company_id, score) {
  const signal = await prisma.signal.findUnique({
    where: { customer_id_company_id: { customer_id, company_id } },
  });
  if (!signal) return null;
  const count = signal.contact_count || 1;
  const current = signal.avg_sentiment_score || 0;
  const newAvg = (current * (count - 1) + score) / count;
  return prisma.signal.update({
    where: { customer_id_company_id: { customer_id, company_id } },
    data: { avg_sentiment_score: newAvg },
  });
}

module.exports = { seedSignal, incrementContact, updateSentiment };
```

---

## Task 11: Customers Route

**Files:**
- Create: `backend/src/routes/customers.js`
- Create: `backend/tests/customers.test.js`

- [ ] **Step 1: Write failing test**

```js
// backend/tests/customers.test.js
const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, cleanup, makeJwt, createTestUser } = require('./helpers');

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
    const email = `newcustomer-${Date.now()}@example.com`;
    const res = await request(app)
      .get(`/api/customers/${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.customer.email).toBe(email);
    expect(res.body.profile).toBeDefined();
    expect(res.body.signal).toBeDefined();
    expect(res.body.isNew).toBe(true);
  });

  test('returns existing customer on second fetch', async () => {
    const email = `existing-${Date.now()}@example.com`;
    await request(app)
      .get(`/api/customers/${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .get(`/api/customers/${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(false);
  });

  test('API key auth also works', async () => {
    const email = `apikey-${Date.now()}@example.com`;
    const res = await request(app)
      .get(`/api/customers/${encodeURIComponent(email)}`)
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(200);
  });

  test('rejects cross-tenant: company B cannot see company A customer', async () => {
    const companyB = await createTestCompany({ name: 'Company B', api_key: 'b-key-' + Date.now() });
    const userB = await createTestUser(companyB.id, { role: 'agent' });
    const tokenB = makeJwt(userB, companyB);
    const email = `shared-${Date.now()}@example.com`;
    await request(app)
      .get(`/api/customers/${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${token}`);
    const res = await request(app)
      .get(`/api/customers/${encodeURIComponent(email)}`)
      .set('Authorization', `Bearer ${tokenB}`);
    // Should return a NEW customer for company B — different record
    expect(res.status).toBe(200);
    expect(res.body.isNew).toBe(true);
    await cleanup(companyB.id);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/customers.test.js --no-coverage
```

- [ ] **Step 3: Build customers route**

```js
// backend/src/routes/customers.js
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { seedProfile } = require('../services/profile-service');
const { seedSignal } = require('../services/signal-service');

const router = express.Router();

router.get('/:email', requireAuth, attachCompany, async (req, res, next) => {
  const { email } = req.params;
  const company_id = req.company.id;
  try {
    let isNew = false;
    let customer = await prisma.customer.findUnique({
      where: { company_id_email: { company_id, email } },
    });

    if (!customer) {
      isNew = true;
      customer = await prisma.customer.create({
        data: { company_id, email },
      });
    }

    const [profile, signal] = await Promise.all([
      seedProfile(customer.id, company_id),
      seedSignal(customer.id, company_id),
    ]);

    res.json({ customer, profile, signal, isNew });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/customers.test.js --no-coverage
```

---

## Task 12: Profiles Routes

**Files:**
- Create: `backend/src/routes/profiles.js`
- Create: `backend/tests/profiles.test.js`

- [ ] **Step 1: Write failing tests**

```js
// backend/tests/profiles.test.js
const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup } = require('./helpers');

const app = createApp();
let company, agent, lead, agentToken, leadToken, customer;

beforeAll(async () => {
  company = await createTestCompany({ industry: 'saas' });
  agent = await createTestUser(company.id, { role: 'agent', email: 'agent@p.com' });
  lead = await createTestUser(company.id, { role: 'lead', email: 'lead@p.com' });
  agentToken = makeJwt(agent, company);
  leadToken = makeJwt(lead, company);
  customer = await createTestCustomer(company.id);
  // Seed profile + signal
  await request(app)
    .get(`/api/customers/${encodeURIComponent(customer.email)}`)
    .set('Authorization', `Bearer ${agentToken}`);
});
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/profiles/:customer_id', () => {
  test('returns profile for customer', async () => {
    const res = await request(app)
      .get(`/api/profiles/${customer.id}`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.customer_id).toBe(customer.id);
  });

  test('rejects missing auth', async () => {
    const res = await request(app).get(`/api/profiles/${customer.id}`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/profiles/:customer_id', () => {
  test('agent can update core_fields except sensitivity_flags', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${customer.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ core_fields: { emotional_baseline: 'anxious' } });
    expect(res.status).toBe(200);
    expect(res.body.core_fields.emotional_baseline).toBe('anxious');
  });

  test('agent cannot update sensitivity_flags', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${customer.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ core_fields: { sensitivity_flags: ['accessibility'] } });
    expect(res.status).toBe(403);
  });

  test('lead can update sensitivity_flags', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${customer.id}`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ core_fields: { sensitivity_flags: ['accessibility'] } });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/profiles/:customer_id/history', () => {
  test('returns history entries', async () => {
    const res = await request(app)
      .get(`/api/profiles/${customer.id}/history`)
      .set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/profiles.test.js --no-coverage
```

- [ ] **Step 3: Build profiles route**

```js
// backend/src/routes/profiles.js
const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { requireRole } = require('../middleware/roles');
const { getProfile, updateProfile, getProfileHistory } = require('../services/profile-service');

const router = express.Router();
const SENSITIVITY_FLAG_FIELDS = ['sensitivity_flags'];

router.get('/:customer_id', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const profile = await getProfile(req.params.customer_id, req.company.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (err) { next(err); }
});

router.post('/:customer_id', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const { seedProfile } = require('../services/profile-service');
    const profile = await seedProfile(req.params.customer_id, req.company.id);
    res.status(201).json(profile);
  } catch (err) { next(err); }
});

router.patch('/:customer_id', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const { core_fields, industry_fields, agent_note, new_agent_brief } = req.body;
    const ROLE_RANK = { agent: 1, lead: 2, csm: 3, manager: 4 };
    const userRank = ROLE_RANK[req.user.role] || 0;

    // Check if sensitivity_flags are being updated
    if (core_fields && core_fields.sensitivity_flags !== undefined && userRank < 2) {
      return res.status(403).json({ error: 'Requires lead role or above to edit sensitivity_flags' });
    }

    const profile = await prisma.profile.findFirst({
      where: { customer_id: req.params.customer_id, company_id: req.company.id },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const updated = await updateProfile(profile.id, req.company.id, req.body, req.user.id);
    res.json(updated);
  } catch (err) { next(err); }
});

router.get('/:customer_id/history', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const profile = await prisma.profile.findFirst({
      where: { customer_id: req.params.customer_id, company_id: req.company.id },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const history = await getProfileHistory(profile.id, req.company.id);
    res.json(history);
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/profiles.test.js --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add src/ tests/
git commit -m "feat: customers and profiles routes with tenant scoping and role guards"
```

---

## Task 13: Webhooks + Seed

**Files:**
- Create: `backend/src/routes/webhooks.js`
- Create: `backend/tests/webhooks.test.js`
- Create: `backend/prisma/seed.js`

- [ ] **Step 1: Write failing test**

```js
// backend/tests/webhooks.test.js
const request = require('supertest');
const createApp = require('../src/app');
const { createTestCompany, createTestCustomer, cleanup } = require('./helpers');

const app = createApp();
let company, customer;

beforeAll(async () => {
  company = await createTestCompany();
  customer = await createTestCustomer(company.id);
  // seed signal
  await request(app)
    .get(`/api/customers/${encodeURIComponent(customer.email)}`)
    .set('x-api-key', company.api_key);
});
afterAll(async () => { await cleanup(company.id); });

describe('POST /api/webhooks/zendesk', () => {
  test('increments contact_count on ticket.solved event', async () => {
    const res = await request(app)
      .post('/api/webhooks/zendesk')
      .set('x-api-key', company.api_key)
      .send({
        event: 'ticket.solved',
        customer_email: customer.email,
      });
    expect(res.status).toBe(200);
    expect(res.body.signal.contact_count).toBe(1);
  });

  test('increments escalation_count when escalated flag set', async () => {
    const res = await request(app)
      .post('/api/webhooks/zendesk')
      .set('x-api-key', company.api_key)
      .send({
        event: 'ticket.solved',
        customer_email: customer.email,
        escalated: true,
      });
    expect(res.status).toBe(200);
    expect(res.body.signal.escalation_count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/webhooks.test.js --no-coverage
```

- [ ] **Step 3: Build webhooks route**

```js
// backend/src/routes/webhooks.js
const express = require('express');
const prisma = require('../lib/prisma');
const { requireApiKey } = require('../middleware/auth');
const { incrementContact } = require('../services/signal-service');

const router = express.Router();

router.post('/zendesk', requireApiKey, async (req, res, next) => {
  const { event, customer_email, escalated = false } = req.body;
  const company_id = req.company.id;

  if (!customer_email) return res.status(400).json({ error: 'customer_email required' });

  try {
    const customer = await prisma.customer.findUnique({
      where: { company_id_email: { company_id, email: customer_email } },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    if (event === 'ticket.solved' || event === 'ticket.updated') {
      const signal = await incrementContact(customer.id, company_id, { escalated });
      return res.json({ signal });
    }

    res.json({ message: 'Event received, no action taken' });
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/webhooks.test.js --no-coverage
```

- [ ] **Step 5: Write seed.js**

```js
// backend/prisma/seed.js
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const api_key = crypto.randomBytes(32).toString('hex');
  const company = await prisma.company.upsert({
    where: { api_key },
    create: {
      name: 'Demo SaaS Co',
      industry: 'saas',
      zendesk_subdomain: 'demo',
      api_key,
    },
    update: {},
  });

  const password = await bcrypt.hash('demo123', 10);
  await prisma.user.upsert({
    where: { company_id_email: { company_id: company.id, email: 'admin@demo.com' } },
    create: {
      company_id: company.id,
      email: 'admin@demo.com',
      password,
      name: 'Demo Admin',
      role: 'manager',
    },
    update: {},
  });

  console.log(`Seeded company: ${company.name}`);
  console.log(`API Key: ${company.api_key}`);
  console.log(`Login: admin@demo.com / demo123`);
  console.log(`Company ID: ${company.id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
```

- [ ] **Step 6: Run all tests**

```bash
npx jest --no-coverage
```

Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/routes/webhooks.js tests/webhooks.test.js prisma/seed.js
git commit -m "feat: zendesk webhook handler and db seed script"
```

---

## Task 14: Zendesk App Scaffold

**Files:**
- Create: `zendesk-app/manifest.json`
- Create: `zendesk-app/assets/index.html`
- Create: `zendesk-app/assets/styles.css`
- Create: `zendesk-app/assets/app.js`

- [ ] **Step 1: Create directories**

```bash
mkdir -p zendesk-app/assets
```

- [ ] **Step 2: Write manifest.json**

```json
{
  "name": "BEHAVR",
  "author": {
    "name": "BEHAVR",
    "email": "support@behavr.io"
  },
  "version": "1.0.0",
  "frameworkVersion": "2.0",
  "location": {
    "support": {
      "ticket_sidebar": {
        "url": "assets/index.html"
      }
    }
  },
  "parameters": [
    {
      "name": "api_key",
      "type": "text",
      "secure": true,
      "required": true
    },
    {
      "name": "api_base_url",
      "type": "text",
      "required": true
    }
  ]
}
```

- [ ] **Step 3: Write index.html**

```html
<!-- zendesk-app/assets/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BEHAVR</title>
  <link rel="stylesheet" href="styles.css" />
  <script src="https://static.zdassets.com/zendesk_app_framework_sdk/2.0/zaf_sdk.min.js"></script>
</head>
<body>
  <div id="app">
    <div id="loading" class="state-loading">
      <div class="spinner"></div>
      <p>Loading profile...</p>
    </div>
    <div id="error" class="state-hidden"></div>
    <div id="new-customer" class="state-hidden">
      <div class="new-badge">New Customer — No Profile Yet</div>
      <p class="hint">Add the first observation after this ticket resolves.</p>
    </div>
    <div id="profile-card" class="state-hidden"></div>
    <div id="post-ticket-nudge" class="state-hidden">
      <div class="nudge-card">
        <p class="nudge-title">Quick observation before you close</p>
        <select id="nudge-baseline">
          <option value="">— Select emotional baseline —</option>
          <option value="calm_rational">Calm / Rational</option>
          <option value="anxious">Anxious</option>
          <option value="frustrated_default">Frustrated</option>
          <option value="already_escalated">Already Escalated</option>
          <option value="apologetic">Apologetic</option>
        </select>
        <button id="nudge-submit">Save Observation</button>
      </div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write styles.css**

```css
/* zendesk-app/assets/styles.css */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #2f3941; background: #fff; }

.state-hidden { display: none; }
.state-loading { display: flex; flex-direction: column; align-items: center; padding: 24px; color: #68737d; }

.spinner { width: 24px; height: 24px; border: 3px solid #e9ebed; border-top-color: #1f73b7; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 8px; }
@keyframes spin { to { transform: rotate(360deg); } }

.new-badge { background: #f3f4f6; border: 1px solid #d8dcde; border-radius: 4px; padding: 8px 12px; font-weight: 600; color: #49545c; }
.hint { margin-top: 8px; color: #68737d; font-size: 12px; }

.profile-card { padding: 8px 0; }

.brief-box { background: #fff8e1; border-left: 4px solid #f5a623; border-radius: 4px; padding: 10px 12px; margin-bottom: 12px; }
.brief-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #b45309; letter-spacing: 0.5px; margin-bottom: 4px; }
.brief-text { font-size: 12px; color: #2f3941; line-height: 1.5; }

.section { margin-bottom: 12px; }
.section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #68737d; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #e9ebed; padding-bottom: 4px; }

.field-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
.field-label { color: #68737d; font-size: 12px; flex: 1; }
.field-value { font-size: 12px; font-weight: 500; color: #2f3941; text-align: right; flex: 1; }
.field-value.null { color: #c2c8cc; font-style: italic; font-weight: 400; }

.flag-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.flag-badge { background: #fff3cd; border: 1px solid #ffc107; border-radius: 3px; padding: 2px 6px; font-size: 11px; color: #856404; }

.signal-row { display: flex; gap: 8px; flex-wrap: wrap; }
.signal-badge { background: #f3f4f6; border: 1px solid #d8dcde; border-radius: 12px; padding: 3px 8px; font-size: 11px; color: #49545c; }
.signal-badge strong { color: #1f73b7; }

.edit-btn { display: block; width: 100%; margin-top: 12px; padding: 7px; background: #1f73b7; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; text-align: center; }
.edit-btn:hover { background: #1a6099; }

.error-box { background: #fce8e6; border: 1px solid #cc3340; border-radius: 4px; padding: 10px; color: #cc3340; font-size: 12px; margin: 8px; }

.nudge-card { background: #f8f9fa; border: 1px solid #d8dcde; border-radius: 6px; padding: 12px; margin: 8px; }
.nudge-title { font-weight: 600; margin-bottom: 8px; color: #2f3941; }
.nudge-card select { width: 100%; padding: 6px; border: 1px solid #d8dcde; border-radius: 4px; font-size: 12px; margin-bottom: 8px; }
.nudge-card button { width: 100%; padding: 7px; background: #1f73b7; color: #fff; border: none; border-radius: 4px; font-size: 12px; cursor: pointer; }
```

---

## Task 15: Zendesk Widget Logic

**Files:**
- Modify: `zendesk-app/assets/app.js`

- [ ] **Step 1: Write app.js**

```js
// zendesk-app/assets/app.js
(function () {
  'use strict';

  const client = ZAFClient.init();
  let API_BASE, API_KEY, currentCustomerId, currentProfileId;

  client.invoke('resize', { width: '100%', height: '600px' });

  function show(id) {
    ['loading', 'error', 'new-customer', 'profile-card', 'post-ticket-nudge'].forEach(s => {
      document.getElementById(s).className = s === id ? '' : 'state-hidden';
    });
  }

  function showError(msg) {
    const el = document.getElementById('error');
    el.className = 'error-box';
    el.textContent = msg;
    show('error');
  }

  function formatValue(val) {
    if (val === null || val === undefined || val === '') return '<span class="field-value null">Not observed</span>';
    const display = String(val).replace(/_/g, ' ');
    return `<span class="field-value">${display}</span>`;
  }

  function renderFlags(flags) {
    if (!flags || flags.length === 0) return '<span class="field-value null">None</span>';
    return `<div class="flag-list">${flags.map(f => `<span class="flag-badge">${f.replace(/_/g, ' ')}</span>`).join('')}</div>`;
  }

  function renderCoreFields(core) {
    if (!core) return '<p class="hint">No fields recorded yet.</p>';
    const fields = [
      ['Communication', core.communication_dna],
      ['Support Trigger', core.support_trigger],
      ['Emotional Baseline', core.emotional_baseline],
      ['Resolution Preference', core.resolution_preference],
      ['Escalation Pattern', core.escalation_pattern],
      ['Trust Level', core.trust_level],
      ['Follow-up Behavior', core.followup_behavior],
    ];
    return fields.map(([label, val]) =>
      `<div class="field-row"><span class="field-label">${label}</span>${formatValue(val)}</div>`
    ).join('');
  }

  function renderIndustryFields(industry) {
    if (!industry) return '';
    const fields = [
      ['Technical Literacy', industry.technical_literacy],
      ['Downtime Tolerance', industry.downtime_tolerance],
      ['Integration Dependency', industry.integration_dependency],
      ['Self-Service', industry.self_service_behavior],
      ['Adoption Stage', industry.adoption_stage],
      ['Channel Preference', industry.channel_preference],
    ];
    return `
      <div class="section">
        <div class="section-title">Product Behavior</div>
        ${fields.map(([label, val]) =>
          `<div class="field-row"><span class="field-label">${label}</span>${formatValue(val)}</div>`
        ).join('')}
      </div>`;
  }

  function renderSignal(signal) {
    if (!signal) return '';
    return `
      <div class="section">
        <div class="section-title">Signals</div>
        <div class="signal-row">
          <span class="signal-badge">Contacts <strong>${signal.contact_count}</strong></span>
          <span class="signal-badge">Escalations <strong>${signal.escalation_count}</strong></span>
          ${signal.avg_sentiment_score != null ? `<span class="signal-badge">Sentiment <strong>${signal.avg_sentiment_score.toFixed(1)}</strong></span>` : ''}
        </div>
      </div>`;
  }

  function renderProfile(data) {
    const { profile, signal } = data;
    const core = profile.core_fields;
    const industry = profile.industry_fields;
    const card = document.getElementById('profile-card');

    card.innerHTML = `
      <div class="profile-card">
        ${profile.new_agent_brief ? `
          <div class="brief-box">
            <div class="brief-label">New Agent Brief</div>
            <div class="brief-text">${profile.new_agent_brief}</div>
          </div>` : ''}
        <div class="section">
          <div class="section-title">Behavioral Profile</div>
          ${renderCoreFields(core)}
        </div>
        ${core && core.sensitivity_flags && core.sensitivity_flags.length > 0 ? `
          <div class="section">
            <div class="section-title">Sensitivity Flags</div>
            ${renderFlags(core.sensitivity_flags)}
          </div>` : ''}
        ${renderIndustryFields(industry)}
        ${renderSignal(signal)}
        ${core && core.what_has_worked ? `
          <div class="section">
            <div class="section-title">What Works</div>
            <p style="font-size:12px;color:#2f3941;line-height:1.5">${core.what_has_worked}</p>
          </div>` : ''}
        ${core && core.what_to_avoid ? `
          <div class="section">
            <div class="section-title">Avoid</div>
            <p style="font-size:12px;color:#cc3340;line-height:1.5">${core.what_to_avoid}</p>
          </div>` : ''}
      </div>`;

    show('profile-card');
  }

  async function apiGet(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  async function apiPatch(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  async function loadProfile(email) {
    show('loading');
    try {
      const customerData = await apiGet(`/api/customers/${encodeURIComponent(email)}`);
      currentCustomerId = customerData.customer.id;
      currentProfileId = customerData.profile.id;

      if (customerData.isNew || !customerData.profile.core_fields) {
        show('new-customer');
        return;
      }

      // Fetch full profile with signal separately to get latest signal
      const [profile, signal] = await Promise.all([
        apiGet(`/api/profiles/${currentCustomerId}`),
        apiGet(`/api/customers/${encodeURIComponent(email)}`).then(d => d.signal),
      ]);

      renderProfile({ profile, signal });
    } catch (err) {
      showError('Could not load customer profile. Check your API key and server connection.');
    }
  }

  async function init() {
    try {
      const settings = await client.metadata();
      API_KEY = settings.settings.api_key;
      API_BASE = settings.settings.api_base_url.replace(/\/$/, '');
    } catch {
      showError('Widget configuration missing. Add api_key and api_base_url in app settings.');
      return;
    }

    const ticketData = await client.get('ticket.requester.email');
    const email = ticketData['ticket.requester.email'];
    if (!email) {
      showError('No requester email found on this ticket.');
      return;
    }

    await loadProfile(email);

    // Watch for ticket solve to show nudge
    client.on('ticket.status.changed', async (data) => {
      if (data === 'solved') {
        document.getElementById('post-ticket-nudge').className = '';
      }
    });
  }

  document.getElementById('nudge-submit').addEventListener('click', async () => {
    const val = document.getElementById('nudge-baseline').value;
    if (!val || !currentCustomerId) return;
    try {
      await apiPatch(`/api/profiles/${currentCustomerId}`, {
        core_fields: { emotional_baseline: val },
      });
      document.getElementById('post-ticket-nudge').className = 'state-hidden';
    } catch {
      // silently fail nudge — non-critical
    }
  });

  init();
})();
```

- [ ] **Step 2: Manual test checklist**

```
1. Deploy app to Zendesk dev instance:
   - Upload zip of zendesk-app/ via Zendesk Apps admin
   - Set api_key + api_base_url in app parameters

2. Open a ticket with a known requester email
   - Widget should show spinner → load profile card or "new customer" state

3. Open ticket with customer who has a profile:
   - new_agent_brief appears at top in yellow box
   - Core fields display with underscores replaced by spaces
   - "Not observed" for null fields

4. Change ticket status to Solved:
   - Nudge appears asking for emotional_baseline observation
   - Select a value and click Save — nudge disappears
```

- [ ] **Step 3: Commit**

```bash
git add zendesk-app/
git commit -m "feat: zendesk sidebar widget with ZAF SDK, profile rendering, post-ticket nudge"
```

---

## Task 16: Dashboard Scaffold

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/index.html`
- Create: `dashboard/vite.config.js`
- Create: `dashboard/tailwind.config.js`
- Create: `dashboard/postcss.config.js`
- Create: `dashboard/src/main.jsx`
- Create: `dashboard/src/App.jsx`

- [ ] **Step 1: Create dashboard package.json**

```json
{
  "name": "behavr-dashboard",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest"
  },
  "dependencies": {
    "axios": "^1.7.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.24.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "vite": "^5.3.1",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create config files**

```js
// dashboard/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, proxy: { '/api': 'http://localhost:3001' } },
});
```

```js
// dashboard/tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

```js
// dashboard/postcss.config.js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BEHAVR</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create main.jsx**

```jsx
// dashboard/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: Create index.css**

```css
/* dashboard/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Create App.jsx**

```jsx
// dashboard/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Onboarding from './pages/Onboarding.jsx';
import CustomerList from './pages/CustomerList.jsx';
import ProfileEditor from './pages/ProfileEditor.jsx';
import History from './pages/History.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/" element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
          <Route path="/customers/:customerId/profile" element={<ProtectedRoute><ProfileEditor /></ProtectedRoute>} />
          <Route path="/customers/:customerId/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Install dashboard deps**

```bash
cd dashboard && npm install
```

---

## Task 17: Auth Context + API Client

**Files:**
- Create: `dashboard/src/context/AuthContext.jsx`
- Create: `dashboard/src/api/client.js`
- Create: `dashboard/src/api/customers.js`
- Create: `dashboard/src/api/profiles.js`
- Create: `dashboard/src/api/companies.js`
- Create: `dashboard/src/components/ProtectedRoute.jsx`

- [ ] **Step 1: Write AuthContext.jsx**

```jsx
// dashboard/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('behavr_token'));
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('behavr_user')); } catch { return null; }
  });
  const [company, setCompany] = useState(() => {
    try { return JSON.parse(localStorage.getItem('behavr_company')); } catch { return null; }
  });

  function login(tokenVal, userData, companyData) {
    localStorage.setItem('behavr_token', tokenVal);
    localStorage.setItem('behavr_user', JSON.stringify(userData));
    localStorage.setItem('behavr_company', JSON.stringify(companyData));
    setToken(tokenVal);
    setUser(userData);
    setCompany(companyData);
  }

  function logout() {
    localStorage.removeItem('behavr_token');
    localStorage.removeItem('behavr_user');
    localStorage.removeItem('behavr_company');
    setToken(null);
    setUser(null);
    setCompany(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, company, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Write api/client.js**

```js
// dashboard/src/api/client.js
import axios from 'axios';

const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('behavr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('behavr_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
```

- [ ] **Step 3: Write API modules**

```js
// dashboard/src/api/customers.js
import client from './client.js';

export const getCustomer = (email) => client.get(`/customers/${encodeURIComponent(email)}`);
export const listCustomers = (companyId) => client.get(`/customers?companyId=${companyId}`);
```

```js
// dashboard/src/api/profiles.js
import client from './client.js';

export const getProfile = (customerId) => client.get(`/profiles/${customerId}`);
export const updateProfile = (customerId, data) => client.patch(`/profiles/${customerId}`, data);
export const getHistory = (customerId) => client.get(`/profiles/${customerId}/history`);
```

```js
// dashboard/src/api/companies.js
import client from './client.js';

export const registerCompany = (data) => client.post('/companies', data);
export const login = (data) => client.post('/auth/login', data);
```

- [ ] **Step 4: Write ProtectedRoute.jsx**

```jsx
// dashboard/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
```

---

## Task 18: Dashboard Pages

**Files:**
- Create: `dashboard/src/pages/Login.jsx`
- Create: `dashboard/src/pages/Onboarding.jsx`
- Create: `dashboard/src/pages/CustomerList.jsx`
- Create: `dashboard/src/pages/ProfileEditor.jsx`
- Create: `dashboard/src/pages/History.jsx`

- [ ] **Step 1: Write Login.jsx**

```jsx
// dashboard/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { login as loginApi } from '../api/companies.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', companyId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginApi(form);
      login(res.data.token, res.data.user, { id: form.companyId });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">BEHAVR</h1>
        <p className="text-gray-500 text-sm mb-6">Behavioral Intelligence Platform</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company ID</label>
            <input className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-500 text-center">
          New company? <a href="/onboarding" className="text-blue-600 hover:underline">Register here</a>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write Onboarding.jsx**

```jsx
// dashboard/src/pages/Onboarding.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerCompany } from '../api/companies.js';
import { useAuth } from '../context/AuthContext.jsx';

const INDUSTRIES = ['saas', 'ecommerce', 'healthcare', 'finance', 'education', 'other'];

export default function Onboarding() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', industry: 'saas', zendesk_subdomain: '',
    adminEmail: '', adminPassword: '', adminName: '',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await registerCompany(form);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 w-full max-w-lg">
          <h2 className="text-xl font-bold text-green-700 mb-2">Company Registered!</h2>
          <div className="bg-gray-50 rounded p-4 space-y-2 text-sm font-mono">
            <p><strong>Company ID:</strong> {result.company.id}</p>
            <p><strong>API Key:</strong> {result.api_key}</p>
          </div>
          <p className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-3 mt-4 text-sm">
            Save your API key now — it will not be shown again.
          </p>
          <button onClick={() => navigate('/login')} className="mt-4 w-full bg-blue-600 text-white py-2 rounded font-medium text-sm">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Register Your Company</h1>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            ['Company Name', 'name', 'text'],
            ['Zendesk Subdomain', 'zendesk_subdomain', 'text'],
            ['Admin Name', 'adminName', 'text'],
            ['Admin Email', 'adminEmail', 'email'],
            ['Admin Password', 'adminPassword', 'password'],
          ].map(([label, key, type]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={key !== 'zendesk_subdomain'} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write CustomerList.jsx**

```jsx
// dashboard/src/pages/CustomerList.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import client from '../api/client.js';

function completionPercent(profile) {
  if (!profile?.core_fields) return 0;
  const keys = ['communication_dna','support_trigger','emotional_baseline','resolution_preference',
    'escalation_pattern','trust_level','followup_behavior'];
  const filled = keys.filter(k => profile.core_fields[k] != null).length;
  return Math.round((filled / keys.length) * 100);
}

export default function CustomerList() {
  const { company, logout, user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await client.get('/customers/list');
        setCustomers(res.data);
      } catch {
        setCustomers([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = customers.filter(c =>
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <span className="font-bold text-gray-900">BEHAVR</span>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>{user?.name} ({user?.role})</span>
          <button onClick={logout} className="text-red-500 hover:underline">Logout</button>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
        </div>
        <input
          className="w-full border border-gray-300 rounded px-4 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by email or name..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">No customers found.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(c => {
              const pct = completionPercent(c.profile);
              return (
                <Link key={c.id} to={`/customers/${c.id}/profile`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-blue-400 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900">{c.name || c.email}</p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">Profile {pct}%</p>
                      <div className="w-24 h-1.5 bg-gray-200 rounded-full">
                        <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write ProfileEditor.jsx**

```jsx
// dashboard/src/pages/ProfileEditor.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProfile, updateProfile } from '../api/profiles.js';
import { useAuth } from '../context/AuthContext.jsx';
import RoleGate from '../components/RoleGate.jsx';
import FieldEditor from '../components/FieldEditor.jsx';
import IndustryFields from '../components/IndustryFields.jsx';
import SignalBadge from '../components/SignalBadge.jsx';
import client from '../api/client.js';

const CORE_FIELDS = [
  { key: 'communication_dna', label: 'Communication Style',
    options: ['direct_blunt','detail_oriented','emotional_expressive','reserved_quiet','collaborative'] },
  { key: 'support_trigger', label: 'Support Trigger',
    options: ['critical_only','any_question','proactive','reactive'] },
  { key: 'emotional_baseline', label: 'Emotional Baseline',
    options: ['calm_rational','anxious','frustrated_default','already_escalated','apologetic'] },
  { key: 'resolution_preference', label: 'Resolution Preference',
    options: ['quick_fix','full_explanation','wants_options','acknowledgment_first','written_confirmation'] },
  { key: 'escalation_pattern', label: 'Escalation Pattern',
    options: ['escalates_quickly','specific_trigger','never_escalated','threatens_cancel','posts_publicly'] },
  { key: 'trust_level', label: 'Trust Level',
    options: ['loyal_advocate','neutral','skeptical','at_risk','retained_churner'] },
  { key: 'followup_behavior', label: 'Follow-up Behavior',
    options: ['follows_up_relentlessly','goes_quiet','needs_checkin','prefers_left_alone'] },
];

export default function ProfileEditor() {
  const { customerId } = useParams();
  const { user, company } = useAuth();
  const [profile, setProfile] = useState(null);
  const [signal, setSignal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, customerRes] = await Promise.all([
          getProfile(customerId),
          client.get(`/customers/by-id/${customerId}`),
        ]);
        setProfile(profileRes.data);
        setSignal(customerRes.data?.signal);
        setDraft({
          core_fields: { ...(profileRes.data.core_fields || {}) },
          industry_fields: { ...(profileRes.data.industry_fields || {}) },
          new_agent_brief: profileRes.data.new_agent_brief || '',
          agent_note: profileRes.data.agent_note || '',
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [customerId]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateProfile(customerId, draft);
      setProfile(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const ROLE_RANK = { agent: 1, lead: 2, csm: 3, manager: 4 };
  const userRank = ROLE_RANK[user?.role] || 0;

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <Link to="/" className="text-blue-600 text-sm hover:underline">← Customers</Link>
        <div className="flex items-center gap-3">
          <Link to={`/customers/${customerId}/history`} className="text-sm text-gray-500 hover:underline">View History</Link>
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Profile'}
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {signal && <SignalBadge signal={signal} />}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Agent Brief <span className="text-gray-400">(300 chars)</span></label>
          <textarea rows={3} maxLength={300}
            className="w-full border border-yellow-300 bg-yellow-50 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            value={draft.new_agent_brief || ''}
            onChange={e => setDraft(d => ({ ...d, new_agent_brief: e.target.value }))}
            placeholder="Brief a first-time agent on this customer in 2-3 sentences..."
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Core Behavioral Fields</h2>
          <div className="space-y-3">
            {CORE_FIELDS.map(field => (
              <FieldEditor key={field.key} field={field}
                value={draft.core_fields?.[field.key] || ''}
                onChange={val => setDraft(d => ({ ...d, core_fields: { ...d.core_fields, [field.key]: val } }))}
              />
            ))}
          </div>

          <RoleGate minRole="lead" userRole={user?.role}>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sensitivity Flags</label>
              {['accessibility','language_barrier','billing_anxiety','legal_aware','personal_hardship','advocate_present'].map(flag => (
                <label key={flag} className="flex items-center gap-2 mb-1 text-sm">
                  <input type="checkbox"
                    checked={(draft.core_fields?.sensitivity_flags || []).includes(flag)}
                    onChange={e => {
                      const current = draft.core_fields?.sensitivity_flags || [];
                      const next = e.target.checked ? [...current, flag] : current.filter(f => f !== flag);
                      setDraft(d => ({ ...d, core_fields: { ...d.core_fields, sensitivity_flags: next } }));
                    }}
                  />
                  {flag.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </RoleGate>
        </div>

        {company?.industry === 'saas' && (
          <IndustryFields
            values={draft.industry_fields || {}}
            onChange={vals => setDraft(d => ({ ...d, industry_fields: vals }))}
          />
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Notes</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-600 block mb-1">What has worked (500 chars)</label>
              <textarea rows={2} maxLength={500}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={draft.core_fields?.what_has_worked || ''}
                onChange={e => setDraft(d => ({ ...d, core_fields: { ...d.core_fields, what_has_worked: e.target.value } }))}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">What to avoid (500 chars)</label>
              <textarea rows={2} maxLength={500}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                value={draft.core_fields?.what_to_avoid || ''}
                onChange={e => setDraft(d => ({ ...d, core_fields: { ...d.core_fields, what_to_avoid: e.target.value } }))}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write History.jsx**

```jsx
// dashboard/src/pages/History.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getHistory } from '../api/profiles.js';

export default function History() {
  const { customerId } = useParams();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory(customerId).then(r => setHistory(r.data)).finally(() => setLoading(false));
  }, [customerId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3">
        <Link to={`/customers/${customerId}/profile`} className="text-blue-600 text-sm hover:underline">← Back to Profile</Link>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Profile Change History</h1>
        {loading ? <p className="text-gray-500 text-sm">Loading...</p> :
         history.length === 0 ? <p className="text-gray-500 text-sm">No changes recorded yet.</p> : (
          <div className="space-y-2">
            {history.map(entry => (
              <div key={entry.id} className="bg-white border border-gray-200 rounded-lg px-5 py-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{entry.field_name.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.old_value ? <span className="line-through text-red-400">{entry.old_value}</span> : <span className="text-gray-300">empty</span>}
                      {' → '}
                      <span className="text-green-600">{entry.new_value || 'empty'}</span>
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>{new Date(entry.changed_at).toLocaleDateString()}</p>
                    <p>{new Date(entry.changed_at).toLocaleTimeString()}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">by {entry.changed_by}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Task 19: Dashboard Components

**Files:**
- Create: `dashboard/src/components/FieldEditor.jsx`
- Create: `dashboard/src/components/IndustryFields.jsx`
- Create: `dashboard/src/components/SignalBadge.jsx`
- Create: `dashboard/src/components/RoleGate.jsx`

- [ ] **Step 1: Write FieldEditor.jsx**

```jsx
// dashboard/src/components/FieldEditor.jsx
import React from 'react';

export default function FieldEditor({ field, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-700 flex-1">{field.label}</label>
      <select className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 flex-1 max-w-xs"
        value={value || ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">— Not observed —</option>
        {field.options.map(opt => (
          <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Write IndustryFields.jsx**

```jsx
// dashboard/src/components/IndustryFields.jsx
import React from 'react';
import FieldEditor from './FieldEditor.jsx';

const SAAS_FIELDS = [
  { key: 'technical_literacy', label: 'Technical Literacy', options: ['non_technical','semi_technical','technical','developer'] },
  { key: 'downtime_tolerance', label: 'Downtime Tolerance', options: ['very_low','moderate','high'] },
  { key: 'integration_dependency', label: 'Integration Dependency', options: ['standalone','light_integrations','heavy_integrations'] },
  { key: 'self_service_behavior', label: 'Self-Service Behavior', options: ['always_self_solves','contacts_immediately','mixed'] },
  { key: 'adoption_stage', label: 'Adoption Stage', options: ['onboarding','mid_adoption','power_user','at_risk'] },
  { key: 'channel_preference', label: 'Channel Preference', options: ['email','live_chat','phone','async'] },
];

export default function IndustryFields({ values, onChange }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Product Behavior (SaaS)</h2>
      <div className="space-y-3">
        {SAAS_FIELDS.map(field => (
          <FieldEditor key={field.key} field={field}
            value={values[field.key] || ''}
            onChange={val => onChange({ ...values, [field.key]: val })}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write SignalBadge.jsx**

```jsx
// dashboard/src/components/SignalBadge.jsx
import React from 'react';

export default function SignalBadge({ signal }) {
  if (!signal) return null;
  return (
    <div className="flex gap-3 flex-wrap">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center">
        <p className="text-2xl font-bold text-blue-700">{signal.contact_count}</p>
        <p className="text-xs text-blue-500">Contacts</p>
      </div>
      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center">
        <p className="text-2xl font-bold text-red-700">{signal.escalation_count}</p>
        <p className="text-xs text-red-500">Escalations</p>
      </div>
      {signal.avg_sentiment_score != null && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-center">
          <p className="text-2xl font-bold text-green-700">{signal.avg_sentiment_score.toFixed(1)}</p>
          <p className="text-xs text-green-500">Avg Sentiment</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write RoleGate.jsx**

```jsx
// dashboard/src/components/RoleGate.jsx
import React from 'react';

const ROLE_RANK = { agent: 1, lead: 2, csm: 3, manager: 4 };

export default function RoleGate({ minRole, userRole, children, fallback = null }) {
  const userRank = ROLE_RANK[userRole] || 0;
  const minRank = ROLE_RANK[minRole] || 0;
  return userRank >= minRank ? children : fallback;
}
```

- [ ] **Step 5: Commit**

```bash
cd dashboard
git add src/
git commit -m "feat: react dashboard with auth, customer list, profile editor, history"
```

---

## Task 20: Backend — Customer List Endpoint + By-ID

**Files:**
- Modify: `backend/src/routes/customers.js`

The dashboard's CustomerList and ProfileEditor need two additional endpoints not in the original spec but required by the UI.

- [ ] **Step 1: Add list and by-id routes to customers.js**

```js
// Add to backend/src/routes/customers.js, before module.exports

router.get('/list', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      where: { company_id: req.company.id },
      include: {
        profiles: {
          where: { company_id: req.company.id },
          select: { id: true, core_fields: true, updated_at: true },
        },
        signals: {
          where: { company_id: req.company.id },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    const result = customers.map(c => ({
      ...c,
      profile: c.profiles[0] || null,
      signal: c.signals[0] || null,
      profiles: undefined,
      signals: undefined,
    }));
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/by-id/:id', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, company_id: req.company.id },
      include: {
        signals: { where: { company_id: req.company.id } },
      },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json({ ...customer, signal: customer.signals[0] || null, signals: undefined });
  } catch (err) { next(err); }
});
```

Note: These routes must be registered BEFORE the `/:email` catch-all route in the file.

- [ ] **Step 2: Reorder routes in customers.js**

The full `customers.js` after edits must have this route order:
1. `GET /list` 
2. `GET /by-id/:id`
3. `GET /:email`

Rewrite `backend/src/routes/customers.js` with all three routes in that order.

- [ ] **Step 3: Run full backend test suite**

```bash
cd backend && npx jest --no-coverage
```

Expected: All PASS

- [ ] **Step 4: Final commit**

```bash
git add backend/src/routes/customers.js
git commit -m "feat: add customer list and by-id endpoints for dashboard"
```

---

## Task 21: Smoke Test & Final Verification

- [ ] **Step 1: Start backend**

```bash
cd backend
cp .env.example .env   # ensure .env is configured
npx prisma migrate dev
node prisma/seed.js
npm run dev
```

Expected: `BEHAVR backend running on port 3001`

- [ ] **Step 2: Start dashboard**

```bash
cd dashboard && npm run dev
```

Expected: `Local: http://localhost:3000/`

- [ ] **Step 3: Test onboarding flow**

1. Navigate to `http://localhost:3000/onboarding`
2. Fill in company details and submit
3. Copy the company ID and API key shown
4. Navigate to `/login`, enter company ID + admin credentials
5. Confirm redirect to customer list

- [ ] **Step 4: Test profile creation flow**

1. In a second terminal: `curl -H "x-api-key: YOUR_API_KEY" http://localhost:3001/api/customers/test%40example.com`
2. Confirm response has `isNew: true`, empty `core_fields: null`
3. Load the dashboard customer list — test@example.com appears at 0% completion
4. Click through to ProfileEditor
5. Set 3 fields, click Save
6. Reload page — fields persist
7. Navigate to History — 3 change entries visible

- [ ] **Step 5: Test role guard**

```bash
# Login as an agent
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@test.com","password":"pass","companyId":"YOUR_ID"}' | jq -r .token)

# Try to set sensitivity_flags — expect 403
curl -s -X PATCH http://localhost:3001/api/profiles/CUSTOMER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"core_fields":{"sensitivity_flags":["accessibility"]}}' | jq .
```

Expected: `{"error": "Requires lead role or above to edit sensitivity_flags"}`

- [ ] **Step 6: Run full test suite one last time**

```bash
cd backend && npx jest --no-coverage --verbose
```

Expected: All tests PASS

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: BEHAVR MVP Phase 1 complete — backend, zendesk widget, react dashboard"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] All 6 DB tables: Company, User, Customer, Profile, ProfileHistory, Signal
- [x] All universal core fields in schema-service.js
- [x] SaaS industry overlay fields in schema-service.js
- [x] All 8 API endpoints (POST /companies, POST /auth/login, GET /customers/:email, GET/POST/PATCH /profiles/:id, GET /profiles/:id/history, POST /webhooks/zendesk, GET /schema/:industry)
- [x] Multi-tenancy: every query scoped to company_id
- [x] API keys per company for widget auth
- [x] Profile history audit trail on every PATCH
- [x] Sensitivity flags require lead role
- [x] Seeded profile on new customer (null fields, not empty)
- [x] Widget: ZAF SDK, ticket_sidebar, email extraction, new agent brief at top, post-ticket nudge
- [x] Dashboard: Login, Onboarding, CustomerList, ProfileEditor, History pages
- [x] Role-aware UI via RoleGate component
- [x] Profile completion percentage on CustomerList

**Gaps found and addressed:**
- Added `GET /customers/list` and `GET /customers/by-id/:id` — required by dashboard but not in original spec. Both are tenant-scoped.
- Task 20 explicitly notes route ordering to prevent `list` and `by-id` from matching the `/:email` wildcard.
