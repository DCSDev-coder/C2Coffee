import React, { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { loadAdminStores } from '../lib/adminApi';

export default function OutletFilter({ value, onChange, includeArchived = true, className = '' }) {
  const [outlets, setOutlets] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadAdminStores()
      .then((response) => {
        if (!active) return;
        setOutlets(Array.isArray(response?.stores) ? response.stores : []);
        setError('');
      })
      .catch(() => {
        if (active) setError('Outlet list unavailable');
      });
    return () => { active = false; };
  }, []);

  const visibleOutlets = includeArchived ? outlets : outlets.filter((outlet) => outlet.status === 'active');

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <Building2 size={15} className="pointer-events-none absolute left-3 text-[#2E5E58]" />
      <select
        value={value || ''}
        onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
        aria-label="Outlet filter"
        title={error || 'Filter by outlet'}
        className="min-w-48 rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-8 text-xs font-semibold text-gray-700 shadow-sm"
      >
        <option value="">All outlets</option>
        {visibleOutlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}{outlet.status === 'inactive' ? ' (Archived)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
