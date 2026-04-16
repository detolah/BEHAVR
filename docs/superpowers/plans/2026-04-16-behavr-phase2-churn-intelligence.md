# BEHAVR Phase 2 — Churn Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add churn scoring, playbook recommendations, intervention queue, customer timeline, and cohort analytics to the BEHAVR MVP — additive only, no existing endpoints or schema altered.

**Architecture:** New `ChurnScore` DB model stores per-customer risk scores (0–100) computed from `Signal` + `Profile.core_fields`. `playbook-service` maps score + trust + escalation to one of 8 intervention playbooks. Five new Express routes serve the dashboard and Zendesk widget. Nightly cron (Task 13) is written but NOT wired — see PENDING note.

**Tech Stack:** Node.js, Express, Prisma, PostgreSQL, React, Tailwind CSS, Vanilla JS, Jest, Supertest

**Constraint:** DO NOT modify any existing routes, endpoints, or schema columns defined in the Phase 1 plan.

---

## File Map

```
backend/
  prisma/
    schema.prisma              — MODIFY: add ChurnScore model + ChurnScore[] relations on Customer/Company
  src/
    app.js                     — MODIFY: mount 5 new routes
    services/
      churn-score-service.js   — CREATE: computeChurnScore(), scoreCustomer(), scoreAllCustomers()
      playbook-service.js      — CREATE: getPlaybook() with 8-combination matrix
      timeline-service.js      — CREATE: getTimeline() merging ProfileHistory + Signal + ChurnScore
    routes/
      churn.js                 — CREATE: GET /api/churn/:customerId
      playbook.js              — CREATE: GET /api/playbook/:customerId
      interventions.js         — CREATE: GET /api/interventions
      timeline.js              — CREATE: GET /api/timeline/:customerId
      cohorts.js               — CREATE: GET /api/cohorts
    cron/
      nightly.js               — CREATE: registerNightlyCron() — written but NOT wired (PENDING Task 13)
  tests/
    helpers.js                 — MODIFY: add churnScore cleanup before customer deletion
    churn-score.test.js        — CREATE: unit tests for computeChurnScore
    churn.test.js              — CREATE: integration tests for GET /api/churn/:customerId
    playbook.test.js           — CREATE: unit + route tests for playbook
    interventions.test.js      — CREATE: integration tests for GET /api/interventions
    timeline.test.js           — CREATE: integration tests for GET /api/timeline/:customerId
    cohorts.test.js            — CREATE: integration tests for GET /api/cohorts

zendesk-app/
  assets/
    styles.css                 — MODIFY: add .churn-badge styles
    app.js                     — MODIFY: fetch churn score, renderChurnBadge(), update renderProfile()

dashboard/
  src/
    api/
      churn.js                 — CREATE: getChurnScore, getPlaybook, getInterventions, getTimeline, getCohorts
    pages/
      InterventionQueue.jsx    — CREATE: sorted churn risk table with playbook
      Timeline.jsx             — CREATE: chronological event feed for a customer
      CohortAnalysis.jsx       — CREATE: aggregate stats + CSS bar charts
    App.jsx                    — MODIFY: add /interventions, /cohorts, /customers/:id/timeline routes
    pages/CustomerList.jsx     — MODIFY: add nav links for Interventions + Cohorts
    pages/ProfileEditor.jsx    — MODIFY: add Timeline link to header nav
```

---

## Task 1: ChurnScore Schema Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/tests/helpers.js`

- [ ] **Step 1: Add ChurnScore model and relations to schema.prisma**

Open `backend/prisma/schema.prisma`. Add `churnScores ChurnScore[]` to the `Customer` and `Company` models, and add the `ChurnScore` model at the end. Full updated schema:

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

  users        User[]
  customers    Customer[]
  profiles     Profile[]
  signals      Signal[]
  churnScores  ChurnScore[]
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

  company     Company      @relation(fields: [company_id], references: [id])
  profiles    Profile[]
  signals     Signal[]
  churnScores ChurnScore[]

  @@unique([company_id, email])
  @@index([company_id, external_id])
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

  customer Customer         @relation(fields: [customer_id], references: [id])
  company  Company          @relation(fields: [company_id], references: [id])
  history  ProfileHistory[]

  @@unique([customer_id, company_id])
  @@index([company_id])
}

model ProfileHistory {
  id         String   @id @default(cuid())
  profile_id String
  changed_by String
  field_name String
  old_value  String?
  new_value  String?
  changed_at DateTime @default(now())

  profile Profile @relation(fields: [profile_id], references: [id], onDelete: Cascade)

  @@index([profile_id])
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
  @@index([company_id])
}

model ChurnScore {
  id          String   @id @default(cuid())
  customer_id String
  company_id  String
  score       Float    @default(0)
  factors     Json?
  scored_at   DateTime @default(now())

  customer Customer @relation(fields: [customer_id], references: [id])
  company  Company  @relation(fields: [company_id], references: [id])

  @@unique([customer_id, company_id])
  @@index([company_id, score])
}
```

- [ ] **Step 2: Update helpers.js cleanup function**

In `backend/tests/helpers.js`, find the `cleanup` function and replace it with:

```js
async function cleanup(company_id) {
  await prisma.profileHistory.deleteMany({ where: { profile: { company_id } } });
  await prisma.profile.deleteMany({ where: { company_id } });
  await prisma.churnScore.deleteMany({ where: { company_id } });
  await prisma.signal.deleteMany({ where: { company_id } });
  await prisma.customer.deleteMany({ where: { company_id } });
  await prisma.user.deleteMany({ where: { company_id } });
  await prisma.company.delete({ where: { id: company_id } });
}
```

- [ ] **Step 3: Run migration**

```bash
cd ~/BEHAVR/backend
npx prisma migrate dev --name add-churn-score
```

Expected: `✔ Generated Prisma Client` and new migration file in `prisma/migrations/`.

- [ ] **Step 4: Commit**

```bash
cd ~/BEHAVR
git add backend/prisma/ backend/tests/helpers.js
git commit -m "feat: add ChurnScore model + migration"
```

---

## Task 2: churn-score-service.js

**Files:**
- Create: `backend/tests/churn-score.test.js`
- Create: `backend/src/services/churn-score-service.js`

- [ ] **Step 1: Write failing unit tests**

```js
// backend/tests/churn-score.test.js
const { computeChurnScore, WEIGHT_MAP } = require('../src/services/churn-score-service');

describe('computeChurnScore', () => {
  test('returns 0 for empty inputs', () => {
    expect(computeChurnScore({}, {})).toBe(0);
  });

  test('returns 0 for loyal low-contact customer', () => {
    const signal = { contact_count: 0, escalation_count: 0, avg_sentiment_score: 1.0 };
    const core   = { trust_level: 'loyal_advocate', escalation_pattern: 'never_escalated' };
    expect(computeChurnScore(signal, core)).toBe(0);
  });

  test('returns high score for at-risk customer', () => {
    const signal = { contact_count: 12, escalation_count: 6, avg_sentiment_score: 0.1, last_contact_at: new Date() };
    const core   = { trust_level: 'at_risk', escalation_pattern: 'threatens_cancel' };
    expect(computeChurnScore(signal, core)).toBeGreaterThan(60);
  });

  test('clamps at 100', () => {
    const signal = { contact_count: 20, escalation_count: 10, avg_sentiment_score: 0, last_contact_at: new Date() };
    const core   = { trust_level: 'at_risk', escalation_pattern: 'threatens_cancel' };
    expect(computeChurnScore(signal, core)).toBe(100);
  });

  test('lower sentiment increases score', () => {
    const low  = computeChurnScore({ avg_sentiment_score: 0.1 }, {});
    const high = computeChurnScore({ avg_sentiment_score: 0.9 }, {});
    expect(low).toBeGreaterThan(high);
  });

  test('recent contact adds recency pts', () => {
    const withRecent    = computeChurnScore({ last_contact_at: new Date() }, {});
    const withoutRecent = computeChurnScore({}, {});
    expect(withRecent).toBeGreaterThan(withoutRecent);
  });

  test('WEIGHT_MAP is exported', () => {
    expect(WEIGHT_MAP).toBeDefined();
    expect(WEIGHT_MAP.escalation_tiers).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd ~/BEHAVR/backend && npx jest tests/churn-score.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../src/services/churn-score-service'`

- [ ] **Step 3: Create churn-score-service.js**

```js
// backend/src/services/churn-score-service.js
const prisma = require('../lib/prisma');

const WEIGHT_MAP = {
  escalation_tiers: [
    { min: 5, pts: 30 },
    { min: 3, pts: 20 },
    { min: 1, pts: 12 },
  ],
  sentiment_max: 20,
  trust: {
    at_risk:          15,
    retained_churner: 15,
    skeptical:         8,
    neutral:           0,
    loyal_advocate:   -5,
  },
  contact_tiers: [
    { min: 10, pts: 15 },
    { min: 5,  pts: 8 },
    { min: 3,  pts: 4 },
  ],
  escalation_pattern: {
    threatens_cancel:   10,
    posts_publicly:     10,
    escalates_quickly:   8,
    specific_trigger:    4,
    never_escalated:    -3,
  },
  recency: [
    { days: 7,  pts: 10 },
    { days: 30, pts: 5 },
  ],
};

function computeChurnScore(signal, core) {
  let score = 0;

  // Escalation count (max 30pts)
  const esc = signal.escalation_count || 0;
  for (const tier of WEIGHT_MAP.escalation_tiers) {
    if (esc >= tier.min) { score += tier.pts; break; }
  }

  // Sentiment inverted: 0 = max risk (max 20pts)
  if (signal.avg_sentiment_score != null) {
    score += Math.round((1 - signal.avg_sentiment_score) * WEIGHT_MAP.sentiment_max);
  }

  // Trust level (-5 to 15pts)
  score += WEIGHT_MAP.trust[core?.trust_level] || 0;

  // Contact count (max 15pts)
  const cnt = signal.contact_count || 0;
  for (const tier of WEIGHT_MAP.contact_tiers) {
    if (cnt >= tier.min) { score += tier.pts; break; }
  }

  // Escalation pattern (-3 to 10pts)
  score += WEIGHT_MAP.escalation_pattern[core?.escalation_pattern] || 0;

  // Recency: active contact in last 7 or 30 days (max 10pts)
  if (signal.last_contact_at) {
    const days = (Date.now() - new Date(signal.last_contact_at)) / 86400000;
    for (const tier of WEIGHT_MAP.recency) {
      if (days <= tier.days) { score += tier.pts; break; }
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

async function scoreCustomer(customer_id, company_id) {
  const [signal, profile] = await Promise.all([
    prisma.signal.findFirst({ where: { customer_id, company_id } }),
    prisma.profile.findFirst({ where: { customer_id, company_id } }),
  ]);

  const signalData = signal || { contact_count: 0, escalation_count: 0 };
  const core       = profile?.core_fields || {};
  const score      = computeChurnScore(signalData, core);

  const factors = {
    escalation_count:    signalData.escalation_count || 0,
    contact_count:       signalData.contact_count    || 0,
    avg_sentiment_score: signalData.avg_sentiment_score ?? null,
    trust_level:         core.trust_level        || null,
    escalation_pattern:  core.escalation_pattern || null,
  };

  return prisma.churnScore.upsert({
    where:  { customer_id_company_id: { customer_id, company_id } },
    create: { customer_id, company_id, score, factors },
    update: { score, factors, scored_at: new Date() },
  });
}

async function scoreAllCustomers(company_id) {
  const customers = await prisma.customer.findMany({
    where:  { company_id },
    select: { id: true },
  });
  const results = await Promise.all(customers.map(c => scoreCustomer(c.id, company_id)));
  return results.length;
}

module.exports = { computeChurnScore, scoreCustomer, scoreAllCustomers, WEIGHT_MAP };
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd ~/BEHAVR/backend && npx jest tests/churn-score.test.js --no-coverage
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
cd ~/BEHAVR
git add backend/src/services/churn-score-service.js backend/tests/churn-score.test.js
git commit -m "feat: churn-score-service with weight map"
```

---

## Task 3: Churn Route

**Files:**
- Create: `backend/src/routes/churn.js`
- Create: `backend/tests/churn.test.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Write failing integration test**

```js
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
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd ~/BEHAVR/backend && npx jest tests/churn.test.js --no-coverage
```

Expected: FAIL — `Cannot GET /api/churn/...`

- [ ] **Step 3: Create churn route**

```js
// backend/src/routes/churn.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { scoreCustomer } = require('../services/churn-score-service');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/:customerId', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.customerId, company_id: req.company.id },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    const churnScore = await scoreCustomer(customer.id, req.company.id);
    res.json(churnScore);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 4: Mount all routes in app.js**

Replace the content of `backend/src/app.js` with:

```js
// backend/src/app.js
const express = require('express');
const cors = require('cors');

const authRoutes         = require('./routes/auth');
const companiesRoutes    = require('./routes/companies');
const customersRoutes    = require('./routes/customers');
const profilesRoutes     = require('./routes/profiles');
const webhooksRoutes     = require('./routes/webhooks');
const schemaRoutes       = require('./routes/schema');
const churnRoutes        = require('./routes/churn');
const playbookRoutes     = require('./routes/playbook');
const interventionRoutes = require('./routes/interventions');
const timelineRoutes     = require('./routes/timeline');
const cohortRoutes       = require('./routes/cohorts');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api/auth',          authRoutes);
  app.use('/api/companies',     companiesRoutes);
  app.use('/api/customers',     customersRoutes);
  app.use('/api/profiles',      profilesRoutes);
  app.use('/api/webhooks',      webhooksRoutes);
  app.use('/api/schema',        schemaRoutes);
  app.use('/api/churn',         churnRoutes);
  app.use('/api/playbook',      playbookRoutes);
  app.use('/api/interventions', interventionRoutes);
  app.use('/api/timeline',      timelineRoutes);
  app.use('/api/cohorts',       cohortRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
```

Create placeholder files for the routes not yet built so the require()s don't crash:

```bash
for f in playbook interventions timeline cohorts; do
  echo "const express = require('express'); const router = express.Router(); module.exports = router;" \
    > ~/BEHAVR/backend/src/routes/${f}.js
done
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd ~/BEHAVR/backend && npx jest tests/churn.test.js --no-coverage
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
cd ~/BEHAVR
git add backend/src/routes/churn.js backend/src/routes/playbook.js \
        backend/src/routes/interventions.js backend/src/routes/timeline.js \
        backend/src/routes/cohorts.js backend/src/app.js backend/tests/churn.test.js
git commit -m "feat: churn route GET /api/churn/:customerId + mount all new routes"
```

---

## Task 4: playbook-service.js

**Files:**
- Create: `backend/tests/playbook.test.js`
- Create: `backend/src/services/playbook-service.js`

- [ ] **Step 1: Write failing unit tests**

```js
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
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd ~/BEHAVR/backend && npx jest tests/playbook.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../src/services/playbook-service'`

- [ ] **Step 3: Create playbook-service.js**

```js
// backend/src/services/playbook-service.js

const PLAYBOOKS = {
  'high-at_risk-volatile': {
    id: 1, title: 'Critical Escalation',
    action: 'Escalate to CSM immediately. Do not attempt to resolve without senior involvement.',
    urgency: 'critical',
  },
  'high-at_risk-calm': {
    id: 2, title: 'Executive Retention',
    action: 'Flag for executive outreach. Prepare retention offer. Do not push product.',
    urgency: 'high',
  },
  'high-stable-volatile': {
    id: 3, title: 'De-escalation First',
    action: 'Acknowledge frustration before solving. Follow de-escalation playbook. Document trigger.',
    urgency: 'high',
  },
  'high-stable-calm': {
    id: 4, title: 'Proactive Success Check-in',
    action: 'Schedule proactive success call. Focus on value realization and roadmap alignment.',
    urgency: 'medium',
  },
  'low-at_risk-volatile': {
    id: 5, title: 'Flag for Lead Review',
    action: 'Flag account for lead review. Monitor next contact closely. Update trust score if needed.',
    urgency: 'medium',
  },
  'low-at_risk-calm': {
    id: 6, title: 'Trust Rebuild',
    action: 'Send warm check-in. Focus on relationship, not product. Small win preferred.',
    urgency: 'low',
  },
  'low-stable-volatile': {
    id: 7, title: 'Document & Monitor',
    action: 'Document escalation trigger in profile. No immediate action. Monitor pattern.',
    urgency: 'low',
  },
  'low-stable-calm': {
    id: 8, title: 'No Action Needed',
    action: 'Customer is stable. Continue standard support.',
    urgency: 'none',
  },
};

const AT_RISK_TRUST    = new Set(['at_risk', 'retained_churner', 'skeptical']);
const VOLATILE_PATTERN = new Set(['escalates_quickly', 'threatens_cancel', 'posts_publicly']);

function getPlaybook(score, trustLevel, escalationPattern) {
  const churnKey      = score >= 60 ? 'high' : 'low';
  const trustKey      = AT_RISK_TRUST.has(trustLevel)    ? 'at_risk'  : 'stable';
  const escalationKey = VOLATILE_PATTERN.has(escalationPattern) ? 'volatile' : 'calm';
  return PLAYBOOKS[`${churnKey}-${trustKey}-${escalationKey}`] || PLAYBOOKS['low-stable-calm'];
}

module.exports = { getPlaybook, PLAYBOOKS, AT_RISK_TRUST, VOLATILE_PATTERN };
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd ~/BEHAVR/backend && npx jest tests/playbook.test.js --no-coverage
```

Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
cd ~/BEHAVR
git add backend/src/services/playbook-service.js backend/tests/playbook.test.js
git commit -m "feat: playbook-service with 8-combination matrix"
```

---

## Task 5: Playbook Route

**Files:**
- Modify: `backend/src/routes/playbook.js` (replace placeholder)

- [ ] **Step 1: Add route test — append to backend/tests/playbook.test.js**

```js
// Append to the bottom of backend/tests/playbook.test.js

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
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd ~/BEHAVR/backend && npx jest tests/playbook.test.js --no-coverage
```

Expected: FAIL — placeholder route returns nothing for `GET /api/playbook/:id`

- [ ] **Step 3: Replace playbook.js placeholder with real route**

```js
// backend/src/routes/playbook.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { scoreCustomer } = require('../services/churn-score-service');
const { getPlaybook } = require('../services/playbook-service');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/:customerId', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.customerId, company_id: req.company.id },
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const [churnScore, profile] = await Promise.all([
      scoreCustomer(customer.id, req.company.id),
      prisma.profile.findFirst({
        where:  { customer_id: customer.id, company_id: req.company.id },
        select: { core_fields: true },
      }),
    ]);

    const core = profile?.core_fields || {};
    res.json(getPlaybook(churnScore.score, core.trust_level, core.escalation_pattern));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd ~/BEHAVR/backend && npx jest tests/playbook.test.js --no-coverage
```

Expected: PASS — all tests

- [ ] **Step 5: Commit**

```bash
cd ~/BEHAVR
git add backend/src/routes/playbook.js backend/tests/playbook.test.js
git commit -m "feat: playbook route GET /api/playbook/:customerId"
```

---

## Task 6: Interventions Route

**Files:**
- Modify: `backend/src/routes/interventions.js` (replace placeholder)
- Create: `backend/tests/interventions.test.js`

- [ ] **Step 1: Write failing integration test**

```js
// backend/tests/interventions.test.js
const request = require('supertest');
const createApp = require('../src/app');
const prisma = require('../src/lib/prisma');
const { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup } = require('./helpers');

const app = createApp();
let company, user, customer;

beforeAll(async () => {
  company  = await createTestCompany({ name: 'Intervention Co', api_key: 'iv-key-test-001' });
  user     = await createTestUser(company.id);
  customer = await createTestCustomer(company.id, { email: 'iv@test.com' });
  await prisma.churnScore.create({
    data: { customer_id: customer.id, company_id: company.id, score: 75, factors: {} },
  });
});
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/interventions', () => {
  test('returns at-risk customers with playbook', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get('/api/interventions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('interventions');
    expect(res.body).toHaveProperty('total');
    expect(res.body.interventions.length).toBeGreaterThan(0);
    const item = res.body.interventions[0];
    expect(item).toHaveProperty('customer');
    expect(item).toHaveProperty('score');
    expect(item).toHaveProperty('playbook');
    expect(item.score).toBeGreaterThan(30);
  });

  test('respects min_score query param', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get('/api/interventions?min_score=90')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.interventions.length).toBe(0);
  });

  test('rejects API key auth', async () => {
    const res = await request(app)
      .get('/api/interventions')
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(401);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/interventions');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd ~/BEHAVR/backend && npx jest tests/interventions.test.js --no-coverage
```

Expected: FAIL — placeholder returns empty body

- [ ] **Step 3: Replace interventions.js placeholder with real route**

```js
// backend/src/routes/interventions.js
const express = require('express');
const { requireJwt } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { getPlaybook } = require('../services/playbook-service');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/', requireJwt, attachCompany, async (req, res, next) => {
  const limit    = Math.min(parseInt(req.query.limit)     || 50,  100);
  const offset   = parseInt(req.query.offset)  || 0;
  const minScore = parseFloat(req.query.min_score) || 30;

  try {
    const [scores, total] = await prisma.$transaction([
      prisma.churnScore.findMany({
        where:   { company_id: req.company.id, score: { gte: minScore } },
        orderBy: { score: 'desc' },
        take:    limit,
        skip:    offset,
        include: { customer: { select: { id: true, email: true, name: true } } },
      }),
      prisma.churnScore.count({
        where: { company_id: req.company.id, score: { gte: minScore } },
      }),
    ]);

    // Batch-fetch profiles to avoid N+1
    const customerIds = scores.map(s => s.customer_id);
    const profiles = await prisma.profile.findMany({
      where:  { customer_id: { in: customerIds }, company_id: req.company.id },
      select: { customer_id: true, core_fields: true },
    });
    const profileMap = Object.fromEntries(profiles.map(p => [p.customer_id, p.core_fields || {}]));

    const interventions = scores.map(cs => {
      const core = profileMap[cs.customer_id] || {};
      return {
        customer:           cs.customer,
        score:              cs.score,
        scored_at:          cs.scored_at,
        factors:            cs.factors,
        trust_level:        core.trust_level        || null,
        escalation_pattern: core.escalation_pattern || null,
        playbook:           getPlaybook(cs.score, core.trust_level, core.escalation_pattern),
      };
    });

    res.json({ interventions, total });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd ~/BEHAVR/backend && npx jest tests/interventions.test.js --no-coverage
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
cd ~/BEHAVR
git add backend/src/routes/interventions.js backend/tests/interventions.test.js
git commit -m "feat: interventions route GET /api/interventions"
```

---

## Task 7: timeline-service.js + Timeline Route

**Files:**
- Create: `backend/src/services/timeline-service.js`
- Modify: `backend/src/routes/timeline.js` (replace placeholder)
- Create: `backend/tests/timeline.test.js`

- [ ] **Step 1: Write failing integration test**

```js
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
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd ~/BEHAVR/backend && npx jest tests/timeline.test.js --no-coverage
```

Expected: FAIL — placeholder returns empty array

- [ ] **Step 3: Create timeline-service.js**

```js
// backend/src/services/timeline-service.js
const prisma = require('../lib/prisma');

function formatFieldName(key) {
  return key.replace(/^(core_fields|industry_fields)\./, '').replace(/_/g, ' ');
}

async function getTimeline(customer_id, company_id) {
  const customer = await prisma.customer.findFirst({ where: { id: customer_id, company_id } });
  if (!customer) return null;

  const [profile, signal, churnScore] = await Promise.all([
    prisma.profile.findFirst({
      where:   { customer_id, company_id },
      include: { history: { orderBy: { changed_at: 'asc' } } },
    }),
    prisma.signal.findFirst({ where: { customer_id, company_id } }),
    prisma.churnScore.findFirst({ where: { customer_id, company_id } }),
  ]);

  const events = [];

  events.push({
    type:        'customer_created',
    timestamp:   customer.created_at,
    description: 'Customer record created',
    actor:       'system',
  });

  if (profile?.history) {
    for (const h of profile.history) {
      events.push({
        type:        'profile_update',
        timestamp:   h.changed_at,
        description: `${formatFieldName(h.field_name)}: "${h.old_value || '—'}" → "${h.new_value}"`,
        actor:       h.changed_by,
      });
    }
  }

  if (signal?.last_contact_at) {
    events.push({
      type:        'contact',
      timestamp:   signal.last_contact_at,
      description: `Contact recorded (${signal.contact_count} total, ${signal.escalation_count} escalation${signal.escalation_count !== 1 ? 's' : ''})`,
      actor:       'system',
    });
  }

  if (churnScore) {
    events.push({
      type:        'churn_scored',
      timestamp:   churnScore.scored_at,
      description: `Churn risk scored: ${Math.round(churnScore.score)}/100`,
      actor:       'system',
    });
  }

  events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return events;
}

module.exports = { getTimeline };
```

- [ ] **Step 4: Replace timeline.js placeholder with real route**

```js
// backend/src/routes/timeline.js
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const { getTimeline } = require('../services/timeline-service');

const router = express.Router();

router.get('/:customerId', requireAuth, attachCompany, async (req, res, next) => {
  try {
    const events = await getTimeline(req.params.customerId, req.company.id);
    if (events === null) return res.status(404).json({ error: 'Customer not found' });
    res.json(events);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 5: Run test — expect PASS**

```bash
cd ~/BEHAVR/backend && npx jest tests/timeline.test.js --no-coverage
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
cd ~/BEHAVR
git add backend/src/services/timeline-service.js backend/src/routes/timeline.js \
        backend/tests/timeline.test.js
git commit -m "feat: timeline-service + route GET /api/timeline/:customerId"
```

---

## Task 8: Cohorts Route

**Files:**
- Modify: `backend/src/routes/cohorts.js` (replace placeholder)
- Create: `backend/tests/cohorts.test.js`

- [ ] **Step 1: Write failing integration test**

```js
// backend/tests/cohorts.test.js
const request = require('supertest');
const createApp = require('../src/app');
const prisma = require('../src/lib/prisma');
const { createTestCompany, createTestUser, createTestCustomer, makeJwt, cleanup } = require('./helpers');

const app = createApp();
let company, user;

beforeAll(async () => {
  company = await createTestCompany({ name: 'Cohort Co', api_key: 'co-key-test-001' });
  user    = await createTestUser(company.id);
  const c1 = await createTestCustomer(company.id, { email: 'c1@cohort.com' });
  const c2 = await createTestCustomer(company.id, { email: 'c2@cohort.com' });
  await prisma.churnScore.createMany({
    data: [
      { customer_id: c1.id, company_id: company.id, score: 80, factors: {} },
      { customer_id: c2.id, company_id: company.id, score: 20, factors: {} },
    ],
  });
});
afterAll(async () => { await cleanup(company.id); });

describe('GET /api/cohorts', () => {
  test('returns aggregate cohort statistics', async () => {
    const token = makeJwt(user, company);
    const res = await request(app)
      .get('/api/cohorts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total_customers', 2);
    expect(res.body).toHaveProperty('avg_churn_score', 50);
    expect(res.body.churn_distribution).toEqual({ low: 1, medium: 0, high: 1 });
    expect(res.body).toHaveProperty('trust_breakdown');
    expect(res.body).toHaveProperty('escalation_breakdown');
  });

  test('rejects API key auth', async () => {
    const res = await request(app)
      .get('/api/cohorts')
      .set('x-api-key', company.api_key);
    expect(res.status).toBe(401);
  });

  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/cohorts');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd ~/BEHAVR/backend && npx jest tests/cohorts.test.js --no-coverage
```

Expected: FAIL — placeholder returns nothing

- [ ] **Step 3: Replace cohorts.js placeholder with real route**

```js
// backend/src/routes/cohorts.js
const express = require('express');
const { requireJwt } = require('../middleware/auth');
const { attachCompany } = require('../middleware/tenant');
const prisma = require('../lib/prisma');

const router = express.Router();

router.get('/', requireJwt, attachCompany, async (req, res, next) => {
  try {
    const [scores, profiles] = await Promise.all([
      prisma.churnScore.findMany({
        where:  { company_id: req.company.id },
        select: { score: true },
      }),
      prisma.profile.findMany({
        where:  { company_id: req.company.id },
        select: { core_fields: true },
      }),
    ]);

    const distribution = { low: 0, medium: 0, high: 0 };
    let totalScore = 0;
    for (const s of scores) {
      totalScore += s.score;
      if (s.score < 30)      distribution.low++;
      else if (s.score < 60) distribution.medium++;
      else                   distribution.high++;
    }
    const avg_churn_score = scores.length
      ? Math.round((totalScore / scores.length) * 10) / 10
      : 0;

    const trust_breakdown      = {};
    const escalation_breakdown = {};
    for (const p of profiles) {
      const core = p.core_fields || {};
      if (core.trust_level)
        trust_breakdown[core.trust_level] = (trust_breakdown[core.trust_level] || 0) + 1;
      if (core.escalation_pattern)
        escalation_breakdown[core.escalation_pattern] = (escalation_breakdown[core.escalation_pattern] || 0) + 1;
    }

    res.json({ total_customers: scores.length, avg_churn_score, churn_distribution: distribution, trust_breakdown, escalation_breakdown });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd ~/BEHAVR/backend && npx jest tests/cohorts.test.js --no-coverage
```

Expected: PASS — 3 tests

- [ ] **Step 5: Run full test suite — confirm no regressions**

```bash
cd ~/BEHAVR/backend && npx jest --no-coverage
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
cd ~/BEHAVR
git add backend/src/routes/cohorts.js backend/tests/cohorts.test.js
git commit -m "feat: cohorts route GET /api/cohorts"
```

---

## Task 9: Zendesk Churn Badge

**Files:**
- Modify: `zendesk-app/assets/styles.css`
- Modify: `zendesk-app/assets/app.js`

- [ ] **Step 1: Append badge styles to styles.css**

Add to the end of `zendesk-app/assets/styles.css`:

```css
/* Churn risk badge */
.churn-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid;
}
.churn-badge-high   { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.churn-badge-medium { background: #fffbeb; color: #d97706; border-color: #fed7aa; }
.churn-badge-low    { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
.churn-badge-label  { font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.04em; }
.churn-badge-score  { font-size: 18px; font-weight: 700; }
```

- [ ] **Step 2: Add renderChurnBadge() to app.js**

In `zendesk-app/assets/app.js`, add `renderChurnBadge` immediately after the `renderSignal` function:

```js
  function renderChurnBadge(churnData) {
    if (!churnData || churnData.score == null) return '';
    const score = Math.round(churnData.score);
    let cls = 'churn-badge-low', label = 'Low Risk';
    if (score >= 60)      { cls = 'churn-badge-high';   label = 'High Risk'; }
    else if (score >= 30) { cls = 'churn-badge-medium'; label = 'Medium Risk'; }
    return `<div class="churn-badge ${cls}">
      <span class="churn-badge-label">${label}</span>
      <span class="churn-badge-score">${score}</span>
    </div>`;
  }
```

- [ ] **Step 3: Update renderProfile signature and badge injection**

Change the `renderProfile` function signature from:

```js
  function renderProfile(profile, signal) {
```

to:

```js
  function renderProfile(profile, signal, churnData) {
```

Inside the same function, find:

```js
    document.getElementById('profile-card').innerHTML = `<div class="profile-card">
      ${briefHtml}
```

Replace with:

```js
    document.getElementById('profile-card').innerHTML = `<div class="profile-card">
      ${renderChurnBadge(churnData)}
      ${briefHtml}
```

- [ ] **Step 4: Update loadProfile to fetch churn in parallel**

In `loadProfile`, find:

```js
      const [profile, customerData] = await Promise.all([
        api('GET', `/api/profiles/${currentCustomerId}`),
        api('GET', `/api/customers/${encodeURIComponent(email)}`),
      ]);
      renderProfile(profile, customerData.signal);
```

Replace with:

```js
      const [profile, customerData, churnData] = await Promise.all([
        api('GET', `/api/profiles/${currentCustomerId}`),
        api('GET', `/api/customers/${encodeURIComponent(email)}`),
        api('GET', `/api/churn/${currentCustomerId}`).catch(() => null),
      ]);
      renderProfile(profile, customerData.signal, churnData);
```

- [ ] **Step 5: Commit**

```bash
cd ~/BEHAVR
git add zendesk-app/assets/styles.css zendesk-app/assets/app.js
git commit -m "feat: churn risk badge in Zendesk sidebar widget"
```

---

## Task 10: Dashboard API Client + InterventionQueue Page

**Files:**
- Create: `dashboard/src/api/churn.js`
- Create: `dashboard/src/pages/InterventionQueue.jsx`
- Modify: `dashboard/src/App.jsx`
- Modify: `dashboard/src/pages/CustomerList.jsx`

- [ ] **Step 1: Create dashboard/src/api/churn.js**

```js
// dashboard/src/api/churn.js
import client from './client.js';

export const getChurnScore    = (customerId)  => client.get(`/churn/${customerId}`);
export const getPlaybook      = (customerId)  => client.get(`/playbook/${customerId}`);
export const getInterventions = (params = {}) => client.get('/interventions', { params });
export const getTimeline      = (customerId)  => client.get(`/timeline/${customerId}`);
export const getCohorts       = ()            => client.get('/cohorts');
```

- [ ] **Step 2: Create dashboard/src/pages/InterventionQueue.jsx**

```jsx
// dashboard/src/pages/InterventionQueue.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInterventions } from '../api/churn.js';

const URGENCY_COLORS = {
  critical: 'bg-red-100 text-red-800 border border-red-200',
  high:     'bg-orange-100 text-orange-800 border border-orange-200',
  medium:   'bg-yellow-100 text-yellow-800 border border-yellow-200',
  low:      'bg-blue-100 text-blue-800 border border-blue-200',
  none:     'bg-gray-100 text-gray-600 border border-gray-200',
};

function scoreColor(score) {
  if (score >= 60) return 'text-red-600 font-bold';
  if (score >= 30) return 'text-yellow-600 font-semibold';
  return 'text-green-600';
}

export default function InterventionQueue() {
  const [interventions, setInterventions] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInterventions()
      .then(r => { setInterventions(r.data.interventions); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <Link to="/" className="text-blue-600 text-sm hover:underline">← Customers</Link>
        <span className="font-bold text-gray-900">Intervention Queue</span>
        <span className="text-sm text-gray-500">{total} at risk</span>
      </nav>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Customers at Risk</h1>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : interventions.length === 0 ? (
          <p className="text-gray-500 text-sm">No customers above risk threshold.</p>
        ) : (
          <div className="space-y-3">
            {interventions.map(item => (
              <div key={item.customer.id} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <Link to={`/customers/${item.customer.id}/profile`}
                        className="font-medium text-gray-900 hover:text-blue-600 truncate">
                        {item.customer.name || item.customer.email}
                      </Link>
                      <span className={`text-sm ${scoreColor(item.score)}`}>
                        {Math.round(item.score)}/100
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{item.customer.email}</p>
                    <div className="flex gap-2 flex-wrap">
                      {item.trust_level && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {item.trust_level.replace(/_/g, ' ')}
                        </span>
                      )}
                      {item.escalation_pattern && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {item.escalation_pattern.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 max-w-[220px]">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${URGENCY_COLORS[item.playbook.urgency]}`}>
                      {item.playbook.title}
                    </span>
                    <p className="text-xs text-gray-500 mt-2">{item.playbook.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add Interventions + Cohorts nav links to CustomerList.jsx**

In `dashboard/src/pages/CustomerList.jsx`, find:

```jsx
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{user?.name} ({user?.role})</span>
          <button onClick={logout} className="text-red-500 hover:underline">Logout</button>
        </div>
```

Replace with:

```jsx
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <Link to="/interventions" className="hover:text-blue-600">Interventions</Link>
          <Link to="/cohorts" className="hover:text-blue-600">Cohorts</Link>
          <span>{user?.name} ({user?.role})</span>
          <button onClick={logout} className="text-red-500 hover:underline">Logout</button>
        </div>
```

- [ ] **Step 4: Update App.jsx with all new routes**

```jsx
// dashboard/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }     from './context/AuthContext.jsx';
import Login                from './pages/Login.jsx';
import Onboarding           from './pages/Onboarding.jsx';
import CustomerList         from './pages/CustomerList.jsx';
import ProfileEditor        from './pages/ProfileEditor.jsx';
import History              from './pages/History.jsx';
import Import               from './pages/Import.jsx';
import InterventionQueue    from './pages/InterventionQueue.jsx';
import Timeline             from './pages/Timeline.jsx';
import CohortAnalysis       from './pages/CohortAnalysis.jsx';
import ProtectedRoute       from './components/ProtectedRoute.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"      element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/"           element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
          <Route path="/customers/:customerId/profile"  element={<ProtectedRoute><ProfileEditor /></ProtectedRoute>} />
          <Route path="/customers/:customerId/history"  element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/customers/:customerId/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
          <Route path="/import"        element={<ProtectedRoute><Import /></ProtectedRoute>} />
          <Route path="/interventions" element={<ProtectedRoute><InterventionQueue /></ProtectedRoute>} />
          <Route path="/cohorts"       element={<ProtectedRoute><CohortAnalysis /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

Note: `Timeline` and `CohortAnalysis` are imported here. Create them as minimal stubs now if needed:

```jsx
// Stub for Timeline.jsx (replace in Task 11):
// export default function Timeline() { return <div>Timeline coming soon</div>; }

// Stub for CohortAnalysis.jsx (replace in Task 12):
// export default function CohortAnalysis() { return <div>Cohorts coming soon</div>; }
```

- [ ] **Step 5: Commit**

```bash
cd ~/BEHAVR
git add dashboard/src/api/churn.js dashboard/src/pages/InterventionQueue.jsx \
        dashboard/src/App.jsx dashboard/src/pages/CustomerList.jsx
git commit -m "feat: InterventionQueue page + dashboard API client + App routes"
```

---

## Task 11: Dashboard Timeline Page

**Files:**
- Create: `dashboard/src/pages/Timeline.jsx`
- Modify: `dashboard/src/pages/ProfileEditor.jsx`

- [ ] **Step 1: Create dashboard/src/pages/Timeline.jsx**

```jsx
// dashboard/src/pages/Timeline.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTimeline } from '../api/churn.js';
import { getCustomerById } from '../api/customers.js';

const EVENT_LABELS = {
  customer_created: 'Created',
  profile_update:   'Profile Update',
  contact:          'Contact',
  churn_scored:     'Risk Scored',
};

const EVENT_STYLES = {
  customer_created: 'bg-blue-50 border-blue-200',
  profile_update:   'bg-white border-gray-200',
  contact:          'bg-green-50 border-green-200',
  churn_scored:     'bg-purple-50 border-purple-200',
};

const LABEL_STYLES = {
  customer_created: 'bg-blue-100 text-blue-700',
  profile_update:   'bg-gray-100 text-gray-600',
  contact:          'bg-green-100 text-green-700',
  churn_scored:     'bg-purple-100 text-purple-700',
};

export default function Timeline() {
  const { customerId } = useParams();
  const [events, setEvents]     = useState([]);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getTimeline(customerId), getCustomerById(customerId)])
      .then(([tRes, cRes]) => { setEvents(tRes.data); setCustomer(cRes.data); })
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to={`/customers/${customerId}/profile`} className="text-blue-600 text-sm hover:underline">
          ← Profile
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-700">
          Timeline — {customer?.name || customer?.email}
        </span>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Customer Timeline</h1>
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm">No events recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event, i) => (
              <div key={i} className={`border rounded-lg px-4 py-3 ${EVENT_STYLES[event.type] || 'bg-white border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 mt-0.5 ${LABEL_STYLES[event.type] || 'bg-gray-100 text-gray-600'}`}>
                    {EVENT_LABELS[event.type] || event.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{event.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{new Date(event.timestamp).toLocaleString()}</span>
                      {event.actor && event.actor !== 'system' && <span>· {event.actor}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Timeline link to ProfileEditor.jsx**

In `dashboard/src/pages/ProfileEditor.jsx`, find:

```jsx
          <Link to={`/customers/${customerId}/history`} className="text-sm text-gray-500 hover:underline">History</Link>
```

Replace with:

```jsx
          <Link to={`/customers/${customerId}/history`}  className="text-sm text-gray-500 hover:underline">History</Link>
          <Link to={`/customers/${customerId}/timeline`} className="text-sm text-gray-500 hover:underline">Timeline</Link>
```

- [ ] **Step 3: Commit**

```bash
cd ~/BEHAVR
git add dashboard/src/pages/Timeline.jsx dashboard/src/pages/ProfileEditor.jsx
git commit -m "feat: Timeline page + link from ProfileEditor"
```

---

## Task 12: Dashboard CohortAnalysis Page

**Files:**
- Create: `dashboard/src/pages/CohortAnalysis.jsx`

- [ ] **Step 1: Create dashboard/src/pages/CohortAnalysis.jsx**

```jsx
// dashboard/src/pages/CohortAnalysis.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCohorts } from '../api/churn.js';

function Bar({ label, value, max, colorClass }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm mb-2">
      <span className="w-40 text-gray-600 shrink-0 truncate capitalize">{label.replace(/_/g, ' ')}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-gray-500 text-xs">{value}</span>
    </div>
  );
}

export default function CohortAnalysis() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCohorts().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;
  if (!data)   return <div className="p-8 text-red-500 text-sm">Failed to load cohort data.</div>;

  const trustTotal      = Object.values(data.trust_breakdown).reduce((a, b) => a + b, 0);
  const escalationTotal = Object.values(data.escalation_breakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <Link to="/" className="text-blue-600 text-sm hover:underline">← Customers</Link>
        <span className="font-bold text-gray-900">Cohort Analysis</span>
        <span />
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Cohort Analysis</h1>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{data.total_customers}</p>
            <p className="text-xs text-gray-500 mt-1">Scored Customers</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{data.avg_churn_score}</p>
            <p className="text-xs text-gray-500 mt-1">Avg Churn Score</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{data.churn_distribution.high}</p>
            <p className="text-xs text-gray-500 mt-1">High Risk (60+)</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Churn Risk Distribution</h2>
          <Bar label="Low (0–29)"     value={data.churn_distribution.low}    max={data.total_customers} colorClass="bg-green-500" />
          <Bar label="Medium (30–59)" value={data.churn_distribution.medium} max={data.total_customers} colorClass="bg-yellow-500" />
          <Bar label="High (60–100)"  value={data.churn_distribution.high}   max={data.total_customers} colorClass="bg-red-500" />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Trust Level Breakdown</h2>
          {trustTotal === 0 ? (
            <p className="text-gray-400 text-sm">No trust level data yet.</p>
          ) : (
            Object.entries(data.trust_breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([k, v]) => <Bar key={k} label={k} value={v} max={trustTotal} colorClass="bg-blue-500" />)
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Escalation Pattern Breakdown</h2>
          {escalationTotal === 0 ? (
            <p className="text-gray-400 text-sm">No escalation data yet.</p>
          ) : (
            Object.entries(data.escalation_breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([k, v]) => <Bar key={k} label={k} value={v} max={escalationTotal} colorClass="bg-orange-500" />)
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/BEHAVR
git add dashboard/src/pages/CohortAnalysis.jsx
git commit -m "feat: CohortAnalysis page"
```

---

## [PENDING] Task 13: Nightly Cron Job

> **DO NOT implement this task.** Write the file and record wiring instructions. Activate when ready by following Steps 1, 3, and 4.

- [ ] **Step 1: Install node-cron (PENDING — skip)**

When activating: `cd ~/BEHAVR/backend && npm install node-cron@^3.0.3`

- [ ] **Step 2: Create backend/src/cron/nightly.js**

```bash
mkdir -p ~/BEHAVR/backend/src/cron
```

```js
// backend/src/cron/nightly.js
// NOT wired into server.js. To activate: follow Step 3 below.
const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { scoreAllCustomers } = require('../services/churn-score-service');

function registerNightlyCron() {
  // Fires at 02:00 UTC every night
  cron.schedule('0 2 * * *', async () => {
    console.log('[cron] Starting nightly churn scoring...');
    try {
      const companies = await prisma.company.findMany({ select: { id: true, name: true } });
      let total = 0;
      for (const company of companies) {
        const count = await scoreAllCustomers(company.id);
        total += count;
        console.log(`[cron] Scored ${count} customers for ${company.name}`);
      }
      console.log(`[cron] Complete. Total scored: ${total}`);
    } catch (err) {
      console.error('[cron] Nightly scoring failed:', err);
    }
  }, { timezone: 'UTC' });
}

module.exports = { registerNightlyCron };
```

- [ ] **Step 3: Wire into server.js (PENDING — skip)**

When activating, add to `backend/src/server.js` after `app.listen(...)`:

```js
const { registerNightlyCron } = require('./cron/nightly');
registerNightlyCron();
```

- [ ] **Step 4: Commit cron file (unwired)**

```bash
cd ~/BEHAVR
git add backend/src/cron/nightly.js
git commit -m "feat: nightly churn cron job (written, not wired — pending)"
```
