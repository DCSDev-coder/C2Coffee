import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

import { adminRequest } from '../lib/adminApi';

/**
 * Tells admins which menu items customers cannot order right now because a
 * recipe ingredient is out of stock ("Sold out", greyed in the app) or has no
 * stock record at the outlet ("Not set up", hidden from the app).
 */
export default function StockAvailabilityAlert() {
  const [issues, setIssues] = useState([]);

  useEffect(() => {
    let cancelled = false;
    adminRequest('/v1/admin/inventory/availability-issues')
      .then((response) => { if (!cancelled) setIssues(response.issues || []); })
      .catch(() => { if (!cancelled) setIssues([]); });
    return () => { cancelled = true; };
  }, []);

  if (issues.length === 0) return null;

  const byItem = new Map();
  issues.forEach((issue) => {
    const key = `${issue.store_id}:${issue.menu_item_id}`;
    const entry = byItem.get(key) || { ...issue, ingredients: [] };
    if (issue.status === 'coming_soon') entry.status = 'coming_soon';
    entry.ingredients.push(issue.inventory_item_name);
    byItem.set(key, entry);
  });
  const rows = [...byItem.values()];

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-2xs">
      <div className="flex items-center gap-2 font-bold">
        <AlertTriangle size={15} className="shrink-0" />
        {rows.length} menu item{rows.length === 1 ? '' : 's'} cannot be ordered because of stock
      </div>
      <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
        {rows.map((row) => (
          <li key={`${row.store_id}:${row.menu_item_id}`}>
            <strong>{row.menu_item_name}</strong> at {row.store_name}:{' '}
            {row.status === 'coming_soon'
              ? `stock not set up for ${row.ingredients.join(', ')} (hidden in the app)`
              : `${row.ingredients.join(', ')} ran out (shown as Sold out)`}
          </li>
        ))}
      </ul>
    </div>
  );
}
