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
