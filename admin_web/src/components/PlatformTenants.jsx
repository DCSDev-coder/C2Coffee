import React, { useEffect, useState } from 'react';
import { loadPlatformTenants } from '../lib/adminApi';

export default function PlatformTenants({ currentUser }) {
  const allowed = currentUser?.roles?.includes('super_admin');
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    loadPlatformTenants().then((response) => {
      if (!cancelled) setTenants(response.tenants || []);
    }).catch(() => {
      if (!cancelled) setError('Could not load deployment details. Reload to try again.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [allowed]);

  if (!allowed) return null;
  return <main className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8">
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold text-gray-900">Cafe Deployment</h1>
      <p className="mt-3 text-gray-600">One cafe business per backend and database. Manage this cafe's branches in Outlets.</p>
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="font-bold text-gray-900">Adding an independent cafe</h2>
        <p className="mt-2 text-sm text-gray-600">The operator must provision a separate database, backend, credentials, media storage, and branded app using the shared codebase. Creating another cafe inside this database is disabled.</p>
        <p className="mt-2 text-sm text-gray-600">This page describes this deployment only; it is not a central management console for other cafes.</p>
      </section>
      {loading && <p className="mt-6" role="status">Loading deployment...</p>}
      {error && <p className="mt-6" role="alert">{error}</p>}
      {!loading && !error && tenants.map((tenant) => <section key={tenant.id} className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-xl font-bold">{tenant.display_name}</h2>
        <p className="mt-2 text-sm text-gray-600">{tenant.code} | {tenant.status}</p>
        <p className="mt-3">{tenant.store_count} outlets | {tenant.admin_count} admin accounts</p>
      </section>)}
    </div>
  </main>;
}
