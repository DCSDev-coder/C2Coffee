import React, { useEffect, useState } from 'react';
import { Building2, Store, Users, CheckCircle2, AlertTriangle, ShieldCheck, Server } from 'lucide-react';
import { loadPlatformTenants } from '../lib/adminApi';
import InfoTooltip from './InfoTooltip';

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

  return (
    <main className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cafe Deployment</h1>
            <InfoTooltip
              title="Deployment Architecture"
              content="Multi-tenant deployment architecture and infrastructure boundaries. Each independent brand is deployed with dedicated database isolation."
            />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            One cafe business per backend and database. Manage this cafe's physical branches in Outlets.
          </p>
        </div>

        {/* Architecture Notice Banner */}
        <section className="rounded-2xl border border-[#1F3A34]/15 bg-linear-to-r from-[#1F3A34]/5 via-[#2E5E58]/5 to-transparent p-5 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1F3A34] text-white shadow-xs">
              <Server className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Adding an Independent Cafe Brand</h2>
                <InfoTooltip
                  title="Tenant Isolation"
                  content="For strict compliance and data protection, different cafe brands run on completely isolated database containers rather than shared tables."
                />
              </div>
              <p className="text-xs leading-relaxed text-gray-600">
                The operator must provision a separate database, backend, credentials, media storage, and branded app using the shared codebase. Creating another cafe inside this database is disabled.
              </p>
              <p className="text-xs text-gray-500">
                This page reflects this local deployment only; it is not a central cross-tenant control console for other businesses.
              </p>
            </div>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-gray-200/80 bg-white py-12 shadow-2xs" role="status">
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1F3A34] border-t-transparent" />
              <span>Loading deployment telemetry...</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-2xs" role="alert">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Tenants Cards */}
        {!loading && !error && tenants.map((tenant) => {
          const isActive = (tenant.status || '').toLowerCase() === 'active';
          return (
            <section
              key={tenant.id}
              className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xs transition-shadow hover:shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1F3A34]/10 text-[#1F3A34]">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{tenant.display_name}</h2>
                    <p className="text-xs font-mono text-gray-500">Code: {tenant.code || tenant.id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    isActive ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20' : 'bg-gray-100 text-gray-700 ring-1 ring-gray-400/20'
                  }`}>
                    {isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {tenant.status ? tenant.status.toUpperCase() : 'ACTIVE'}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-2xs">
                    <Store className="h-5 w-5 text-[#1F3A34]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Configured Outlets</p>
                    <p className="text-lg font-bold text-gray-900">{tenant.store_count ?? 0} <span className="text-xs font-normal text-gray-500">stores</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-2xs">
                    <Users className="h-5 w-5 text-[#2E5E58]" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Admin Accounts</p>
                    <p className="text-lg font-bold text-gray-900">{tenant.admin_count ?? 0} <span className="text-xs font-normal text-gray-500">admins</span></p>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
