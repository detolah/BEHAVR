import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerCompany } from '../api/companies.js';

const INDUSTRIES = ['saas','ecommerce','healthcare','finance','education','other'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:'', industry:'saas', zendesk_subdomain:'', adminEmail:'', adminPassword:'', adminName:'' });
  const [result, setResult] = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true); setError('');
    try { setResult((await registerCompany(form)).data); }
    catch (err) { setError(err.response?.data?.error || 'Registration failed'); }
    finally { setLoading(false); }
  }

  if (result) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 w-full max-w-lg">
        <h2 className="text-xl font-bold text-green-700 mb-4">Company Registered!</h2>
        <div className="bg-gray-50 rounded p-4 font-mono text-sm space-y-1">
          <p><strong>Company ID:</strong> {result.company.id}</p>
          <p><strong>API Key:</strong> {result.api_key}</p>
        </div>
        <p className="text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-3 mt-4 text-sm">Save your API key — it will not be shown again.</p>
        <button onClick={() => navigate('/login')} className="mt-4 w-full bg-blue-600 text-white py-2 rounded text-sm font-medium">Go to Login</button>
      </div>
    </div>
  );

  const field = (label, key, type = 'text', required = true) => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} required={required}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 w-full max-w-lg">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Register Your Company</h1>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {field('Company Name', 'name')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          {field('Zendesk Subdomain', 'zendesk_subdomain', 'text', false)}
          {field('Admin Name', 'adminName')}
          {field('Admin Email', 'adminEmail', 'email')}
          {field('Admin Password', 'adminPassword', 'password')}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
