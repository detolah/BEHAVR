import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getHistory } from '../api/profiles.js';

function HistoryValue({ label, value, className }) {
  if (!value || value === 'null') return null;
  let parsed = value;
  try { parsed = JSON.parse(value); } catch { /* plain string */ }
  if (Array.isArray(parsed)) {
    return (
      <div className={className}>
        <span className="text-gray-400 not-italic">{label}: </span>
        <ul className="list-disc list-inside mt-0.5 space-y-0.5">
          {parsed.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    );
  }
  return (
    <p className={className}>
      <span className="text-gray-400 not-italic">{label}:</span> {parsed || '—'}
    </p>
  );
}

export default function History() {
  const { customerId } = useParams();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory(customerId).then(r => setHistory(r.data)).finally(() => setLoading(false));
  }, [customerId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3">
        <Link to={`/customers/${customerId}/profile`} className="text-blue-600 text-sm hover:underline">← Back to Profile</Link>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Profile Change History</h1>
        {loading ? <p className="text-gray-500 text-sm">Loading...</p> :
         history.length === 0 ? <p className="text-gray-500 text-sm">No changes recorded yet.</p> : (
          <div className="space-y-2">
            {history.map(e => (
              <div key={e.id} className="bg-white border border-gray-200 rounded-lg px-5 py-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{e.field_name.replace(/[._]/g, ' ')}</p>
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      <HistoryValue label="was" value={e.old_value} className="line-through text-red-400" />
                      <HistoryValue label="now" value={e.new_value} className="text-green-600" />
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>{new Date(e.changed_at).toLocaleDateString()}</p>
                    <p>{new Date(e.changed_at).toLocaleTimeString()}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-1">by {e.changed_by}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
