// dashboard/src/pages/InterventionQueue.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInterventions } from '../api/churn.js';

const URGENCY_COLORS = {
  critical: 'bg-red-100 text-red-800 border border-red-200',
  high:     'bg-orange-100 text-orange-800 border border-orange-200',
  medium:   'bg-yellow-100 text-yellow-800 border border-yellow-200',
  low:      'bg-blue-100 text-blue-800 border border-blue-200',
  none:     'bg-gray-100 text-gray-600 border border-gray-200',
};

function scoreColor(score) {
  if (score >= 60) return 'text-red-600 font-bold';
  if (score >= 30) return 'text-yellow-600 font-semibold';
  return 'text-green-600';
}

export default function InterventionQueue() {
  const [interventions, setInterventions] = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInterventions()
      .then(r => { setInterventions(r.data.interventions); setTotal(r.data.total); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <Link to="/" className="text-blue-600 text-sm hover:underline">← Customers</Link>
        <span className="font-bold text-gray-900">Intervention Queue</span>
        <span className="text-sm text-gray-500">{total} at risk</span>
      </nav>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Customers at Risk</h1>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : interventions.length === 0 ? (
          <p className="text-gray-500 text-sm">No customers above risk threshold.</p>
        ) : (
          <div className="space-y-3">
            {interventions.map(item => (
              <div key={item.customer.id} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <Link to={`/customers/${item.customer.id}/profile`}
                        className="font-medium text-gray-900 hover:text-blue-600 truncate">
                        {item.customer.name || item.customer.email}
                      </Link>
                      <span className={`text-sm ${scoreColor(item.score)}`}>
                        {Math.round(item.score)}/100
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{item.customer.email}</p>
                    <div className="flex gap-2 flex-wrap">
                      {item.trust_level && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {item.trust_level.replace(/_/g, ' ')}
                        </span>
                      )}
                      {item.escalation_pattern && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {item.escalation_pattern.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 max-w-[220px]">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${URGENCY_COLORS[item.playbook.urgency]}`}>
                      {item.playbook.title}
                    </span>
                    <p className="text-xs text-gray-500 mt-2">{item.playbook.action}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
