import React from 'react';

export default function SignalBadge({ signal }) {
  if (!signal) return null;
  return (
    <div className="flex gap-3 flex-wrap">
      <Stat label="Contacts"    value={signal.contact_count}    color="blue" />
      <Stat label="Escalations" value={signal.escalation_count} color="red" />
      {signal.avg_sentiment_score != null &&
        <Stat label="Avg Sentiment" value={signal.avg_sentiment_score.toFixed(1)} color="green" />}
    </div>
  );
}

function Stat({ label, value, color }) {
  const colors = { blue:'bg-blue-50 border-blue-200 text-blue-700', red:'bg-red-50 border-red-200 text-red-700', green:'bg-green-50 border-green-200 text-green-700' };
  return (
    <div className={`border rounded-lg px-4 py-3 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-70">{label}</p>
    </div>
  );
}
