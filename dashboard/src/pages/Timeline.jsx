// dashboard/src/pages/Timeline.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTimeline } from '../api/churn.js';
import { getCustomerById } from '../api/customers.js';

const EVENT_LABELS = {
  customer_created: 'Created',
  profile_update:   'Profile Update',
  contact:          'Contact',
  churn_scored:     'Risk Scored',
};

const EVENT_STYLES = {
  customer_created: 'bg-blue-50 border-blue-200',
  profile_update:   'bg-white border-gray-200',
  contact:          'bg-green-50 border-green-200',
  churn_scored:     'bg-purple-50 border-purple-200',
};

const LABEL_STYLES = {
  customer_created: 'bg-blue-100 text-blue-700',
  profile_update:   'bg-gray-100 text-gray-600',
  contact:          'bg-green-100 text-green-700',
  churn_scored:     'bg-purple-100 text-purple-700',
};

export default function Timeline() {
  const { customerId } = useParams();
  const [events, setEvents]     = useState([]);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getTimeline(customerId), getCustomerById(customerId)])
      .then(([tRes, cRes]) => { setEvents(tRes.data); setCustomer(cRes.data); })
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
        <Link to={`/customers/${customerId}/profile`} className="text-blue-600 text-sm hover:underline">
          ← Profile
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm text-gray-700">
          Timeline — {customer?.name || customer?.email}
        </span>
      </nav>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Customer Timeline</h1>
        {events.length === 0 ? (
          <p className="text-gray-500 text-sm">No events recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {events.map((event, i) => (
              <div key={i} className={`border rounded-lg px-4 py-3 ${EVENT_STYLES[event.type] || 'bg-white border-gray-200'}`}>
                <div className="flex items-start gap-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 mt-0.5 ${LABEL_STYLES[event.type] || 'bg-gray-100 text-gray-600'}`}>
                    {EVENT_LABELS[event.type] || event.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{event.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{new Date(event.timestamp).toLocaleString()}</span>
                      {event.actor && event.actor !== 'system' && <span>· {event.actor}</span>}
                    </div>
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
