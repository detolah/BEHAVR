import React, { useState } from 'react';

export default function BulletEditor({ label, value, onChange, placeholder }) {
  const items = Array.isArray(value) ? value : (value ? [value] : []);
  const [input, setInput] = useState('');

  function add() {
    const trimmed = input.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setInput('');
  }

  function remove(i) {
    onChange(items.filter((_, idx) => idx !== i));
  }

  function handleKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  }

  return (
    <div>
      <label className="text-sm text-gray-600 block mb-1">{label}</label>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-800">
              <span className="mt-0.5 text-gray-400">•</span>
              <span className="flex-1">{item}</span>
              <button type="button" onClick={() => remove(i)}
                className="text-gray-300 hover:text-red-400 text-xs leading-tight mt-0.5">✕</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder || 'Add a point... (Enter to add)'}
          className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button type="button" onClick={add}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-sm">
          + Add
        </button>
      </div>
    </div>
  );
}
