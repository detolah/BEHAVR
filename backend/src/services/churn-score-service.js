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
