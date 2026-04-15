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
