require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEMO_CUSTOMERS = [
  {
    email: 'sarah.chen@acmecorp.com',
    name: 'Sarah Chen',
    core_fields: {
      communication_dna: 'detail_oriented',
      support_trigger: 'any_question',
      emotional_baseline: 'calm_rational',
      resolution_preference: 'full_explanation',
      escalation_pattern: 'never_escalated',
      trust_level: 'loyal_advocate',
      followup_behavior: 'needs_checkin',
      what_has_worked: ['Detailed walkthroughs with screenshots work best', 'Send step-by-step with screenshots', 'Always follow up after resolution'],
      what_to_avoid: ['Rushed one-liner responses', 'Closing tickets without confirmation', 'Skipping explanations'],
    },
    industry_fields: {
      technical_literacy: 'technical',
      adoption_stage: 'power_user',
      channel_preference: 'email',
      self_service_behavior: 'always_self_solves',
    },
    new_agent_brief: 'Power user, very detail-oriented. Always send step-by-step instructions.',
    signal: { contact_count: 14, escalation_count: 0, avg_sentiment_score: 0.85 },
  },
  {
    email: 'marcus.reyes@brightwave.io',
    name: 'Marcus Reyes',
    core_fields: {
      communication_dna: 'direct_blunt',
      support_trigger: 'critical_only',
      emotional_baseline: 'frustrated_default',
      resolution_preference: 'quick_fix',
      escalation_pattern: 'escalates_quickly',
      trust_level: 'at_risk',
      followup_behavior: 'follows_up_relentlessly',
      what_has_worked: ['Lead with acknowledgment + ETA immediately', 'Assign a named owner to his ticket', 'Brief him every 2 hours on critical issues'],
      what_to_avoid: ['Asking him to reproduce the issue more than once', 'Delayed first response over 10 min', 'Generic scripted replies'],
    },
    industry_fields: {
      technical_literacy: 'semi_technical',
      adoption_stage: 'mid_adoption',
      downtime_tolerance: 'very_low',
      channel_preference: 'live_chat',
    },
    new_agent_brief: 'High-value but volatile. Lead with an ETA, never leave without a next step.',
    signal: { contact_count: 31, escalation_count: 4, avg_sentiment_score: 0.32 },
  },
  {
    email: 'priya.nair@loopstack.com',
    name: 'Priya Nair',
    core_fields: {
      communication_dna: 'collaborative',
      support_trigger: 'proactive',
      emotional_baseline: 'anxious',
      resolution_preference: 'acknowledgment_first',
      escalation_pattern: 'specific_trigger',
      trust_level: 'neutral',
      followup_behavior: 'goes_quiet',
      what_has_worked: ['Open with empathy before jumping to solutions', 'Mirror her language and tone', 'Confirm understanding before suggesting a fix'],
      what_to_avoid: ['Leading with technical steps before acknowledgment', 'Leaving tickets open without a status update', 'Overly formal language'],
    },
    industry_fields: {
      technical_literacy: 'non_technical',
      adoption_stage: 'onboarding',
      channel_preference: 'email',
      self_service_behavior: 'contacts_immediately',
    },
    new_agent_brief: 'Anxious user, needs reassurance. Acknowledge first, then solve.',
    signal: { contact_count: 8, escalation_count: 1, avg_sentiment_score: 0.61 },
  },
  {
    email: 'tom.okoro@finverge.co',
    name: 'Tom Okoro',
    core_fields: {
      communication_dna: 'reserved_quiet',
      support_trigger: 'reactive',
      emotional_baseline: 'calm_rational',
      resolution_preference: 'written_confirmation',
      escalation_pattern: 'never_escalated',
      trust_level: 'skeptical',
      followup_behavior: 'prefers_left_alone',
      what_has_worked: ['Send a written recap after every interaction', 'Reference prior ticket numbers when relevant', 'Use bullet points for clarity'],
      what_to_avoid: ['Requesting phone or live chat sessions', 'Sending walls of unstructured text', 'Pushing for quick turnaround without context'],
    },
    industry_fields: {
      technical_literacy: 'developer',
      adoption_stage: 'power_user',
      channel_preference: 'async',
      integration_dependency: 'heavy_integrations',
    },
    new_agent_brief: 'Skeptical but fair. Always send a written recap. No surprise calls.',
    signal: { contact_count: 5, escalation_count: 0, avg_sentiment_score: 0.58 },
  },
  {
    email: 'jade.kim@novapulse.ai',
    name: 'Jade Kim',
    core_fields: {
      communication_dna: 'emotional_expressive',
      support_trigger: 'any_question',
      emotional_baseline: 'apologetic',
      resolution_preference: 'wants_options',
      escalation_pattern: 'threatens_cancel',
      trust_level: 'retained_churner',
      followup_behavior: 'needs_checkin',
      what_has_worked: ['Always present 2-3 options rather than one answer', 'Proactive check-ins after ticket resolution', 'Acknowledge her loyalty and patience'],
      what_to_avoid: ['Going silent after a ticket closes', 'Prescriptive single-option answers', 'Any reference to her prior churn'],
    },
    industry_fields: {
      technical_literacy: 'semi_technical',
      adoption_stage: 'at_risk',
      channel_preference: 'live_chat',
      self_service_behavior: 'mixed',
    },
    new_agent_brief: 'Previously churned, now retained. Check in proactively, always give options.',
    signal: { contact_count: 19, escalation_count: 2, avg_sentiment_score: 0.47 },
  },
];

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

  for (const c of DEMO_CUSTOMERS) {
    const customer = await prisma.customer.upsert({
      where: { company_id_email: { company_id: company.id, email: c.email } },
      create: { company_id: company.id, email: c.email, name: c.name },
      update: { name: c.name },
    });
    await prisma.profile.upsert({
      where: { customer_id_company_id: { customer_id: customer.id, company_id: company.id } },
      create: {
        customer_id: customer.id,
        company_id: company.id,
        core_fields: c.core_fields,
        industry_fields: c.industry_fields,
        new_agent_brief: c.new_agent_brief,
      },
      update: {
        core_fields: c.core_fields,
        industry_fields: c.industry_fields,
        new_agent_brief: c.new_agent_brief,
      },
    });
    await prisma.signal.upsert({
      where: { customer_id_company_id: { customer_id: customer.id, company_id: company.id } },
      create: { customer_id: customer.id, company_id: company.id, ...c.signal },
      update: c.signal,
    });
    console.log(`  + ${c.name} <${c.email}>`);
  }

  console.log(`\nCompany: ${company.name} | ID: ${company.id}`);
  console.log(`API Key: ${company.api_key}`);
  console.log(`Login: admin@demo.com / demo123`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
