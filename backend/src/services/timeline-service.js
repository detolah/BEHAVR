// backend/src/services/timeline-service.js
const prisma = require('../lib/prisma');

function formatFieldName(key) {
  return key.replace(/^(core_fields|industry_fields)\./, '').replace(/_/g, ' ');
}

async function getTimeline(customer_id, company_id) {
  const customer = await prisma.customer.findFirst({ where: { id: customer_id, company_id } });
  if (!customer) return null;

  const [profile, signal, churnScore] = await Promise.all([
    prisma.profile.findUnique({
      where:   { customer_id_company_id: { customer_id, company_id } },
      include: { history: { orderBy: { changed_at: 'asc' } } },
    }),
    prisma.signal.findUnique({ where: { customer_id_company_id: { customer_id, company_id } } }),
    prisma.churnScore.findUnique({ where: { customer_id_company_id: { customer_id, company_id } } }),
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
        description: `${formatFieldName(h.field_name)}: "${h.old_value ?? '—'}" → "${h.new_value ?? '—'}"`,
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
