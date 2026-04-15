import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { importCsv, importZendesk } from '../api/customers.js';
import { useAuth } from '../context/AuthContext.jsx';

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], error: 'CSV must have a header row and at least one data row.' };
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const emailIdx = headers.indexOf('email');
  const nameIdx  = headers.indexOf('name');
  if (emailIdx === -1) return { rows: [], error: 'CSV must include an "email" column.' };
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    return { email: cols[emailIdx] || '', name: nameIdx !== -1 ? cols[nameIdx] || '' : '' };
  }).filter(r => r.email);
  return { rows, error: null };
}

export default function Import() {
  const { company } = useAuth();
  const [tab, setTab]           = useState('csv');
  const [csvText, setCsvText]   = useState('');
  const [preview, setPreview]   = useState(null);
  const [parseErr, setParseErr] = useState('');
  const [zdForm, setZdForm]     = useState({ subdomain: company?.zendesk_subdomain || '', email: '', api_token: '' });
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState('');
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result;
      setCsvText(text);
      const { rows, error } = parseCSV(text);
      setParseErr(error || '');
      setPreview(error ? null : rows);
      setResult(null);
    };
    reader.readAsText(file);
  }

  async function runCsvImport() {
    if (!preview?.length) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await importCsv(preview);
      setResult(res.data);
      setPreview(null); setCsvText(''); fileRef.current.value = '';
    } catch (e) {
      setError(e.response?.data?.error || 'Import failed');
    } finally { setLoading(false); }
  }

  async function runZendeskImport() {
    const { subdomain, email, api_token } = zdForm;
    if (!subdomain || !email || !api_token) { setError('All fields required'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await importZendesk(subdomain, email, api_token);
      setResult(res.data);
      setZdForm(f => ({ ...f, api_token: '' }));
    } catch (e) {
      setError(e.response?.data?.error || 'Import failed');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Link to="/" className="text-blue-600 text-sm hover:underline">← Customers</Link>
        <h1 className="text-sm font-semibold text-gray-900">Import Customers</h1>
        <div />
      </nav>

      <div className="max-w-xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {[['csv','CSV File'],['zendesk','From Zendesk']].map(([key, label]) => (
            <button key={key} onClick={() => { setTab(key); setResult(null); setError(''); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Result */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="font-semibold text-green-800 mb-1">Import complete</p>
            <p className="text-sm text-green-700">{result.imported} imported · {result.skipped} skipped (already existed)</p>
            {result.total_fetched !== undefined && <p className="text-sm text-green-700">{result.total_fetched} users fetched from Zendesk</p>}
            {result.errors?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-red-600">{result.errors.length} errors:</p>
                <ul className="text-xs text-red-500 mt-1 list-disc list-inside">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e.email}: {e.reason}</li>)}
                  {result.errors.length > 5 && <li>...and {result.errors.length - 5} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 mb-6 text-sm">{error}</div>}

        {/* CSV Tab */}
        {tab === 'csv' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-3">Upload a CSV with <code className="bg-gray-100 px-1 rounded">name</code> and <code className="bg-gray-100 px-1 rounded">email</code> columns. Maximum 1000 rows.</p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" id="csv-file" />
                <label htmlFor="csv-file" className="cursor-pointer">
                  <p className="text-sm font-medium text-blue-600">Click to choose a CSV file</p>
                  <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
                </label>
              </div>
            </div>

            {parseErr && <p className="text-sm text-red-600">{parseErr}</p>}

            {preview && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{preview.length} rows ready to import</p>
                <div className="border border-gray-200 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Name</th>
                        <th className="px-3 py-2 text-left text-gray-500 font-medium">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 5).map((r, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-700">{r.name || <span className="text-gray-400 italic">—</span>}</td>
                          <td className="px-3 py-2 text-gray-700">{r.email}</td>
                        </tr>
                      ))}
                      {preview.length > 5 && (
                        <tr className="border-t border-gray-100">
                          <td colSpan={2} className="px-3 py-2 text-gray-400 italic text-center">...and {preview.length - 5} more rows</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button onClick={runCsvImport} disabled={loading}
                  className="mt-4 w-full bg-blue-600 text-white py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
                  {loading ? 'Importing...' : `Import ${preview.length} customers`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Zendesk Tab */}
        {tab === 'zendesk' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <p className="text-sm text-gray-600">Fetches all end-users from your Zendesk account and imports them as customers.</p>
            {[
              ['Zendesk Subdomain', 'subdomain', 'text', 'e.g. behavr'],
              ['Your Zendesk Email', 'email', 'email', 'agent@yourcompany.com'],
              ['API Token', 'api_token', 'password', 'From Zendesk Admin → Apps & Integrations → API'],
            ].map(([label, key, type, placeholder]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type={type} placeholder={placeholder}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={zdForm[key]}
                  onChange={e => setZdForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <p className="text-xs text-gray-400">The API token is used once for this import and is not stored.</p>
            <button onClick={runZendeskImport} disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Fetching from Zendesk...' : 'Fetch & Import'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
