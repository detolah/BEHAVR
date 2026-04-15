(function () {
  'use strict';

  const client = ZAFClient.init();
  let API_BASE, currentCustomerId;

  client.invoke('resize', { width: '100%', height: '600px' });

  const STATES = ['loading','error','new-customer','profile-card','post-ticket-nudge'];
  function show(id) {
    STATES.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.className = s === id ? '' : 'state-hidden';
    });
  }

  function showError(msg) {
    const el = document.getElementById('error');
    el.className = 'error-box';
    el.textContent = msg;
    // hide others manually since show() expects exact id match
    STATES.filter(s => s !== 'error').forEach(s => {
      const el2 = document.getElementById(s);
      if (el2) el2.className = 'state-hidden';
    });
  }

  function fmt(val) {
    if (val === null || val === undefined || val === '') {
      return '<span class="field-value null">Not observed</span>';
    }
    return `<span class="field-value">${String(val).replace(/_/g, ' ')}</span>`;
  }

  function renderFlags(flags) {
    if (!flags || !flags.length) return '<span class="field-value null">None</span>';
    return `<div class="flag-list">${flags.map(f => `<span class="flag-badge">${f.replace(/_/g, ' ')}</span>`).join('')}</div>`;
  }

  function renderCore(core) {
    if (!core) return '<p class="hint">No fields recorded yet.</p>';
    const fields = [
      ['Communication', core.communication_dna],
      ['Support Trigger', core.support_trigger],
      ['Emotional Baseline', core.emotional_baseline],
      ['Resolution Preference', core.resolution_preference],
      ['Escalation Pattern', core.escalation_pattern],
      ['Trust Level', core.trust_level],
      ['Follow-up', core.followup_behavior],
    ];
    return fields.map(([l, v]) => `<div class="field-row"><span class="field-label">${l}</span>${fmt(v)}</div>`).join('');
  }

  function renderIndustry(ind) {
    if (!ind) return '';
    const fields = [
      ['Technical Literacy', ind.technical_literacy],
      ['Downtime Tolerance', ind.downtime_tolerance],
      ['Integration Dep.', ind.integration_dependency],
      ['Self-Service', ind.self_service_behavior],
      ['Adoption Stage', ind.adoption_stage],
      ['Channel Preference', ind.channel_preference],
    ];
    return `<div class="section"><div class="section-title">Product Behavior</div>${
      fields.map(([l, v]) => `<div class="field-row"><span class="field-label">${l}</span>${fmt(v)}</div>`).join('')
    }</div>`;
  }

  function renderSignal(signal) {
    if (!signal) return '';
    return `<div class="section"><div class="section-title">Signals</div><div class="signal-row">
      <span class="signal-badge">Contacts <strong>${signal.contact_count}</strong></span>
      <span class="signal-badge">Escalations <strong>${signal.escalation_count}</strong></span>
      ${signal.avg_sentiment_score != null ? `<span class="signal-badge">Sentiment <strong>${signal.avg_sentiment_score.toFixed(1)}</strong></span>` : ''}
    </div></div>`;
  }

  function renderProfile(profile, signal) {
    const core = profile.core_fields;
    const ind  = profile.industry_fields;
    document.getElementById('profile-card').innerHTML = `<div class="profile-card">
      ${profile.new_agent_brief ? `<div class="brief-box"><div class="brief-label">New Agent Brief</div><div class="brief-text">${profile.new_agent_brief}</div></div>` : ''}
      <div class="section"><div class="section-title">Behavioral Profile</div>${renderCore(core)}</div>
      ${core && core.sensitivity_flags && core.sensitivity_flags.length ? `<div class="section"><div class="section-title">Sensitivity Flags</div>${renderFlags(core.sensitivity_flags)}</div>` : ''}
      ${renderIndustry(ind)}
      ${renderSignal(signal)}
      ${core && core.what_has_worked ? `<div class="section"><div class="section-title">What Works</div><p style="font-size:12px;line-height:1.5">${core.what_has_worked}</p></div>` : ''}
      ${core && core.what_to_avoid ? `<div class="section"><div class="section-title">Avoid</div><p style="font-size:12px;color:#cc3340;line-height:1.5">${core.what_to_avoid}</p></div>` : ''}
    </div>`;
    show('profile-card');
  }

  async function api(method, path, body) {
    const opts = {
      url: `${API_BASE}${path}`,
      type: method,
      headers: { 'x-api-key': '{{setting.api_key}}' },
      contentType: 'application/json',
      secure: true,
    };
    if (body) opts.data = JSON.stringify(body);
    return client.request(opts);
  }

  async function loadProfile(email) {
    show('loading');
    try {
      const data = await api('GET', `/api/customers/${encodeURIComponent(email)}`);
      currentCustomerId = data.customer.id;

      if (data.isNew || !data.profile.core_fields) {
        const link = document.getElementById('dashboard-link');
        if (link) link.href = `https://behavr.vercel.app/customers/${currentCustomerId}/profile`;
        show('new-customer');
        return;
      }

      const [profile, customerData] = await Promise.all([
        api('GET', `/api/profiles/${currentCustomerId}`),
        api('GET', `/api/customers/${encodeURIComponent(email)}`),
      ]);
      renderProfile(profile, customerData.signal);
    } catch {
      showError('Could not load profile. Check API key and server connection.');
    }
  }

  async function init() {
    try {
      const meta = await client.metadata();
      API_BASE = (meta.settings.api_base_url || '').replace(/\/$/, '');
      if (!API_BASE) throw new Error('missing api_base_url');
    } catch {
      showError('Widget config missing. Set api_base_url in app settings.');
      return;
    }

    const ticketData = await client.get('ticket.requester.email');
    const email = ticketData['ticket.requester.email'];
    if (!email) { showError('No requester email on this ticket.'); return; }

    await loadProfile(email);

    client.on('ticket.status.changed', (status) => {
      if (status === 'solved') {
        document.getElementById('post-ticket-nudge').className = '';
      }
    });
  }

  document.getElementById('nudge-submit').addEventListener('click', async () => {
    const val = document.getElementById('nudge-baseline').value;
    if (!val || !currentCustomerId) return;
    try {
      await api('PATCH', `/api/profiles/${currentCustomerId}`, { core_fields: { emotional_baseline: val } });
      document.getElementById('post-ticket-nudge').className = 'state-hidden';
    } catch { /* non-critical */ }
  });

  document.getElementById('new-submit').addEventListener('click', async () => {
    const val = document.getElementById('new-baseline').value;
    if (!val || !currentCustomerId) return;
    try {
      await api('PATCH', `/api/profiles/${currentCustomerId}`, { core_fields: { emotional_baseline: val } });
      document.getElementById('new-customer').className = 'state-hidden';
      show('profile-card');
      document.getElementById('profile-card').innerHTML = '<p class="hint" style="padding:16px">First observation saved. Open the dashboard to build the full profile.</p>';
    } catch { /* non-critical */ }
  });

  init();
})();
