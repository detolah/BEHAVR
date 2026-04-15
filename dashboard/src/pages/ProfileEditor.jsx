import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProfile, updateProfile } from '../api/profiles.js';
import { getCustomerById } from '../api/customers.js';
import { useAuth } from '../context/AuthContext.jsx';
import RoleGate from '../components/RoleGate.jsx';
import FieldEditor from '../components/FieldEditor.jsx';
import IndustryFields from '../components/IndustryFields.jsx';
import SignalBadge from '../components/SignalBadge.jsx';

const CORE_FIELDS = [
  { key: 'communication_dna',    label: 'Communication Style',   options: ['direct_blunt','detail_oriented','emotional_expressive','reserved_quiet','collaborative'] },
  { key: 'support_trigger',      label: 'Support Trigger',       options: ['critical_only','any_question','proactive','reactive'] },
  { key: 'emotional_baseline',   label: 'Emotional Baseline',    options: ['calm_rational','anxious','frustrated_default','already_escalated','apologetic'] },
  { key: 'resolution_preference',label: 'Resolution Preference', options: ['quick_fix','full_explanation','wants_options','acknowledgment_first','written_confirmation'] },
  { key: 'escalation_pattern',   label: 'Escalation Pattern',    options: ['escalates_quickly','specific_trigger','never_escalated','threatens_cancel','posts_publicly'] },
  { key: 'trust_level',          label: 'Trust Level',           options: ['loyal_advocate','neutral','skeptical','at_risk','retained_churner'] },
  { key: 'followup_behavior',    label: 'Follow-up Behavior',    options: ['follows_up_relentlessly','goes_quiet','needs_checkin','prefers_left_alone'] },
];
const SENSITIVITY_FLAGS = ['accessibility','language_barrier','billing_anxiety','legal_aware','personal_hardship','advocate_present'];
const ROLE_RANK = { agent:1, lead:2, csm:3, manager:4 };

export default function ProfileEditor() {
  const { customerId } = useParams();
  const { user, company } = useAuth();
  const [profile, setProfile]   = useState(null);
  const [signal, setSignal]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [draft, setDraft]       = useState({});

  useEffect(() => {
    Promise.all([getProfile(customerId), getCustomerById(customerId)]).then(([pRes, cRes]) => {
      setProfile(pRes.data);
      setSignal(cRes.data?.signal);
      setDraft({
        core_fields:     { ...(pRes.data.core_fields     || {}) },
        industry_fields: { ...(pRes.data.industry_fields || {}) },
        new_agent_brief: pRes.data.new_agent_brief || '',
        agent_note:      pRes.data.agent_note      || '',
      });
    }).finally(() => setLoading(false));
  }, [customerId]);

  async function save() {
    setSaving(true);
    try {
      const res = await updateProfile(customerId, draft);
      setProfile(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  const setCoreField = (key, val) => setDraft(d => ({ ...d, core_fields: { ...d.core_fields, [key]: val } }));

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <Link to="/" className="text-blue-600 text-sm hover:underline">← Customers</Link>
        <div className="flex items-center gap-3">
          <Link to={`/customers/${customerId}/history`} className="text-sm text-gray-500 hover:underline">History</Link>
          <button onClick={save} disabled={saving}
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
            placeholder="Brief a first-time agent on this customer in 2-3 sentences..." />
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Core Behavioral Fields</h2>
          <div className="space-y-3">
            {CORE_FIELDS.map(f => (
              <FieldEditor key={f.key} field={f} value={draft.core_fields?.[f.key] || ''} onChange={v => setCoreField(f.key, v)} />
            ))}
          </div>
          <RoleGate minRole="lead" userRole={user?.role}>
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sensitivity Flags</label>
              {SENSITIVITY_FLAGS.map(flag => (
                <label key={flag} className="flex items-center gap-2 mb-1 text-sm">
                  <input type="checkbox"
                    checked={(draft.core_fields?.sensitivity_flags || []).includes(flag)}
                    onChange={e => {
                      const cur  = draft.core_fields?.sensitivity_flags || [];
                      const next = e.target.checked ? [...cur, flag] : cur.filter(f => f !== flag);
                      setCoreField('sensitivity_flags', next);
                    }} />
                  {flag.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          </RoleGate>
        </div>
        {company?.industry === 'saas' && (
          <IndustryFields values={draft.industry_fields || {}} onChange={v => setDraft(d => ({ ...d, industry_fields: v }))} />
        )}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Notes</h2>
          <div className="space-y-3">
            {[['What has worked (500 chars)', 'what_has_worked'], ['What to avoid (500 chars)', 'what_to_avoid']].map(([label, key]) => (
              <div key={key}>
                <label className="text-sm text-gray-600 block mb-1">{label}</label>
                <textarea rows={2} maxLength={500} className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  value={draft.core_fields?.[key] || ''}
                  onChange={e => setCoreField(key, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
