(function () {
  'use strict';

  const client = ZAFClient.init();
  let API_BASE, currentCustomerId, currentCore;

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
    const rows = fields.filter(([,v]) => v).map(([l,v]) =>
      `<div class="field-row"><span class="field-label">${l}</span>${fmt(v)}</div>`
    ).join('');
    if (!rows) return '';
    return `<div class="section"><div class="section-title">Product Behavior</div>${rows}</div>`;
  }

  function renderSignal(signal) {
    if (!signal) return '';
    return `<div class="section"><div class="section-title">Signals</div><div class="signal-row">
      <span class="signal-badge">Contacts <strong>${signal.contact_count}</strong></span>
      <span class="signal-badge">Escalations <strong>${signal.escalation_count}</strong></span>
      ${signal.avg_sentiment_score != null ? `<span class="signal-badge">Sentiment <strong>${signal.avg_sentiment_score.toFixed(2)}</strong></span>` : ''}
    </div></div>`;
  }

  function parseBullets(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      if (val.startsWith('[')) { try { return JSON.parse(val); } catch {} }
      return val ? [val] : [];
    }
    return [];
  }

  function renderBulletSection(title, val, key, avoidClass) {
    const items = parseBullets(val);
    const listHtml = items.length
      ? `<ul class="obs-list${avoidClass ? ' obs-avoid' : ''}" id="obs-list-${key}">${items.map(i => `<li>${i}</li>`).join('')}</ul>`
      : `<p class="hint" id="obs-list-${key}">None recorded yet.</p>`;
    return `<div class="section" id="section-${key}">
      <div class="section-title">${title}</div>
      ${listHtml}
    </div>`;
  }

  function renderObservationForm() {
    return `<div class="obs-add-wrap">
      <button class="obs-toggle" id="obs-toggle">+ Add observation</button>
      <div class="obs-form state-hidden" id="obs-form">
        <div class="obs-type-row">
          <label class="obs-type-label">
            <input type="radio" name="obs-type" value="what_has_worked" checked> What worked
          </label>
          <label class="obs-type-label">
            <input type="radio" name="obs-type" value="what_to_avoid"> What to avoid
          </label>
        </div>
        <input type="text" id="obs-input" class="obs-input" placeholder="Describe the observation..." maxlength="200" />
        <div class="obs-actions">
          <button class="obs-cancel" id="obs-cancel">Cancel</button>
          <button class="obs-save" id="obs-save">Save</button>
        </div>
      </div>
    </div>`;
  }

  function renderProfile(profile, signal) {
    const core = profile.core_fields;
    const ind  = profile.industry_fields;
    currentCore = core ? { ...core } : {};

    const briefItems = parseBullets(profile.new_agent_brief);
    const briefHtml = briefItems.length
      ? `<div class="brief-box">
          <div class="brief-label">New Agent Brief</div>
          <ul class="brief-list">${briefItems.map(i => `<li>${i}</li>`).join('')}</ul>
        </div>`
      : '';

    document.getElementById('profile-card').innerHTML = `<div class="profile-card">
      ${briefHtml}
      <div class="section"><div class="section-title">Behavioral Profile</div>${renderCore(core)}</div>
      ${core && core.sensitivity_flags && core.sensitivity_flags.length ? `<div class="section"><div class="section-title">Sensitivity Flags</div>${renderFlags(core.sensitivity_flags)}</div>` : ''}
      ${renderIndustry(ind)}
      ${renderSignal(signal)}
      ${renderBulletSection('What Works', core && core.what_has_worked, 'what_has_worked', false)}
      ${renderBulletSection('What to Avoid', core && core.what_to_avoid, 'what_to_avoid', true)}
      ${renderObservationForm()}
    </div>`;

    document.getElementById('obs-toggle').addEventListener('click', () => {
      const form = document.getElementById('obs-form');
      const btn  = document.getElementById('obs-toggle');
      const open = form.classList.contains('state-hidden');
      form.classList.toggle('state-hidden', !open);
      btn.textContent = open ? '✕ Cancel' : '+ Add observation';
      if (open) document.getElementById('obs-input').focus();
    });

    document.getElementById('obs-cancel').addEventListener('click', () => {
      document.getElementById('obs-form').classList.add('state-hidden');
      document.getElementById('obs-toggle').textContent = '+ Add observation';
      document.getElementById('obs-input').value = '';
    });

    document.getElementById('obs-save').addEventListener('click', async () => {
      const text = document.getElementById('obs-input').value.trim();
      if (!text || !currentCustomerId) return;
      const type = document.querySelector('input[name="obs-type"]:checked').value;
      const existing = parseBullets(currentCore[type]);
      const updated  = [...existing, text];
      const saveBtn  = document.getElementById('obs-save');
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;
      try {
        await api('PATCH', `/api/profiles/${currentCustomerId}`, {
          core_fields: { [type]: updated }
        });
        currentCore[type] = updated;
        const listEl = document.getElementById(`obs-list-${type}`);
        if (listEl) {
          if (listEl.tagName === 'P') {
            const ul = document.createElement('ul');
            ul.className = `obs-list${type === 'what_to_avoid' ? ' obs-avoid' : ''}`;
            ul.id = `obs-list-${type}`;
            ul.innerHTML = `<li>${text}</li>`;
            listEl.replaceWith(ul);
          } else {
            const li = document.createElement('li');
            li.textContent = text;
            listEl.appendChild(li);
          }
        }
        document.getElementById('obs-input').value = '';
        document.getElementById('obs-form').classList.add('state-hidden');
        document.getElementById('obs-toggle').textContent = '+ Add observation';
      } catch {
        saveBtn.textContent = 'Error — retry';
      } finally {
        saveBtn.textContent = 'Save';
        saveBtn.disabled = false;
      }
    });

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
