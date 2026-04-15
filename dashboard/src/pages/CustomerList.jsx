import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { listCustomers } from '../api/customers.js';

const CORE_KEYS = ['communication_dna','support_trigger','emotional_baseline','resolution_preference','escalation_pattern','trust_level','followup_behavior'];

function pct(profile) {
  if (!profile?.core_fields) return 0;
  return Math.round(CORE_KEYS.filter(k => profile.core_fields[k] != null).length / CORE_KEYS.length * 100);
}

export default function CustomerList() {
  const { user, logout } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    listCustomers().then(r => setCustomers(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter(c =>
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <span className="font-bold text-gray-900">BEHAVR</span>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{user?.name} ({user?.role})</span>
          <button onClick={logout} className="text-red-500 hover:underline">Logout</button>
        </div>
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Customers</h1>
        <input className="w-full border border-gray-300 rounded px-4 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by email or name..." value={search} onChange={e => setSearch(e.target.value)} />
        {loading ? <p className="text-gray-500 text-sm">Loading...</p> :
         filtered.length === 0 ? <p className="text-gray-500 text-sm">No customers found.</p> : (
          <div className="space-y-2">
            {filtered.map(c => {
              const p = pct(c.profile);
              return (
                <Link key={c.id} to={`/customers/${c.id}/profile`}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-4 hover:border-blue-400 transition-colors">
                  <div>
                    <p className="font-medium text-gray-900">{c.name || c.email}</p>
                    <p className="text-xs text-gray-500">{c.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-1">Profile {p}%</p>
                      <div className="w-24 h-1.5 bg-gray-200 rounded-full">
                        <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${p}%` }} />
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
