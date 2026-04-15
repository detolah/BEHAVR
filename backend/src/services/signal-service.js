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
      ...(escalated ? { escalation_count: { increment: 1 } } : {}),
      last_contact_at: new Date(),
    },
  });
}

module.exports = { seedSignal, incrementContact };
