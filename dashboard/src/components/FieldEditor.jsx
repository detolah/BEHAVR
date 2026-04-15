import React from 'react';

export default function FieldEditor({ field, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-gray-700 flex-1">{field.label}</label>
      <select className="border border-gray-300 rounded px-2 py-1 text-sm flex-1 max-w-xs"
        value={value || ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">— Not observed —</option>
        {field.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
      </select>
    </div>
  );
}
