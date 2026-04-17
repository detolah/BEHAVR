// dashboard/src/pages/CohortAnalysis.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCohorts } from '../api/churn.js';

function Bar({ label, value, max, colorClass }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm mb-2">
      <span className="w-40 text-gray-600 shrink-0 truncate capitalize">{label.replace(/_/g, ' ')}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-gray-500 text-xs">{value}</span>
    </div>
  );
}

export default function CohortAnalysis() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCohorts().then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;
  if (!data)   return <div className="p-8 text-red-500 text-sm">Failed to load cohort data.</div>;

  const trustTotal      = Object.values(data.trust_breakdown).reduce((a, b) => a + b, 0);
  const escalationTotal = Object.values(data.escalation_breakdown).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <Link to="/" className="text-blue-600 text-sm hover:underline">← Customers</Link>
        <span className="font-bold text-gray-900">Cohort Analysis</span>
        <span />
      </nav>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Cohort Analysis</h1>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{data.total_customers}</p>
            <p className="text-xs text-gray-500 mt-1">Scored Customers</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{data.avg_churn_score}</p>
            <p className="text-xs text-gray-500 mt-1">Avg Churn Score</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{data.churn_distribution.high}</p>
            <p className="text-xs text-gray-500 mt-1">High Risk (70+)</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Churn Risk Distribution</h2>
          <Bar label="Low (0–54)"     value={data.churn_distribution.low}    max={data.total_customers} colorClass="bg-green-500" />
          <Bar label="Medium (55–69)" value={data.churn_distribution.medium} max={data.total_customers} colorClass="bg-yellow-500" />
          <Bar label="High (70–100)"  value={data.churn_distribution.high}   max={data.total_customers} colorClass="bg-red-500" />
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Trust Level Breakdown</h2>
          {trustTotal === 0 ? (
            <p className="text-gray-400 text-sm">No trust level data yet.</p>
          ) : (
            Object.entries(data.trust_breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([k, v]) => <Bar key={k} label={k} value={v} max={trustTotal} colorClass="bg-blue-500" />)
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Escalation Pattern Breakdown</h2>
          {escalationTotal === 0 ? (
            <p className="text-gray-400 text-sm">No escalation data yet.</p>
          ) : (
            Object.entries(data.escalation_breakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([k, v]) => <Bar key={k} label={k} value={v} max={escalationTotal} colorClass="bg-orange-500" />)
          )}
        </div>
      </div>
    </div>
  );
}
