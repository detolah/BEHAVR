require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const api_key = crypto.randomBytes(32).toString('hex');
  const company = await prisma.company.upsert({
    where: { api_key },
    create: { name: 'Demo SaaS Co', industry: 'saas', zendesk_subdomain: 'demo', api_key },
    update: {},
  });
  const password = await bcrypt.hash('demo123', 10);
  await prisma.user.upsert({
    where: { company_id_email: { company_id: company.id, email: 'admin@demo.com' } },
    create: { company_id: company.id, email: 'admin@demo.com', password, name: 'Demo Admin', role: 'manager' },
    update: {},
  });
  console.log(`Company: ${company.name} | ID: ${company.id}`);
  console.log(`API Key: ${company.api_key}`);
  console.log(`Login: admin@demo.com / demo123`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
