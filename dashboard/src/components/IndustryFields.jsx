import React from 'react';
import FieldEditor from './FieldEditor.jsx';

const SAAS_FIELDS = [
  { key: 'technical_literacy',    label: 'Technical Literacy',    options: ['non_technical','semi_technical','technical','developer'] },
  { key: 'downtime_tolerance',    label: 'Downtime Tolerance',    options: ['very_low','moderate','high'] },
  { key: 'integration_dependency',label: 'Integration Dependency',options: ['standalone','light_integrations','heavy_integrations'] },
  { key: 'self_service_behavior', label: 'Self-Service Behavior', options: ['always_self_solves','contacts_immediately','mixed'] },
  { key: 'adoption_stage',        label: 'Adoption Stage',        options: ['onboarding','mid_adoption','power_user','at_risk'] },
  { key: 'channel_preference',    label: 'Channel Preference',    options: ['email','live_chat','phone','async'] },
];

export default function IndustryFields({ values, onChange }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Product Behavior (SaaS)</h2>
      <div className="space-y-3">
        {SAAS_FIELDS.map(f => (
          <FieldEditor key={f.key} field={f} value={values[f.key] || ''}
            onChange={v => onChange({ ...values, [f.key]: v })} />
        ))}
      </div>
    </div>
  );
}
