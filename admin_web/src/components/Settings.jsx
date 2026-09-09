import React, { useEffect, useState } from 'react';
import { FileText, KeyRound, ShieldCheck, Store } from 'lucide-react';
import { loadAdminStore, updateAdminStoreName } from '../lib/adminApi';

const Settings = ({ setCurrentPage, currentUser }) => {
  const canViewAuditLogs = Array.isArray(currentUser?.roles) && currentUser.roles.includes('super_admin');
  const canManageStore = Array.isArray(currentUser?.roles) && currentUser.roles.some((role) => ['super_admin', 'operations_admin'].includes(role));
  const [storeName, setStoreName] = useState('');
  const [storeMessage, setStoreMessage] = useState('');
  const [isSavingStore, setIsSavingStore] = useState(false);

  useEffect(() => {
    if (!canManageStore) return;
    loadAdminStore()
      .then(({ store }) => setStoreName(store?.name || ''))
      .catch(() => setStoreMessage('The outlet name could not be loaded. Please refresh and try again.'));
  }, [canManageStore]);

  const saveStoreName = async () => {
    const name = storeName.trim();
    if (name.length < 2) {
      setStoreMessage('Enter an outlet name with at least two characters.');
      return;
    }
    setIsSavingStore(true);
    setStoreMessage('');
    try {
      const { store } = await updateAdminStoreName(name);
      setStoreName(store?.name || name);
      setStoreMessage('Outlet name saved. This updates the customer app label only.');
    } catch {
      setStoreMessage('The outlet name could not be saved. Please try again.');
    } finally {
      setIsSavingStore(false);
    }
  };

  return (
  <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8">
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">Account security and system records.</p>

      <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1F3A34] text-white"><ShieldCheck size={23} /></div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Account Security</h2>
            <p className="mt-1 text-sm text-gray-500">Change your password with an email verification code.</p>
            <button onClick={() => setCurrentPage?.('Profile')} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E5E58]"><KeyRound size={16} /> Open Account Security</button>
          </div>
        </div>
      </section>

      {canManageStore && <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1F3A34] text-white"><Store size={23} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900">Customer Outlet</h2>
            <p className="mt-1 text-sm text-gray-500">C2 Coffee currently accepts customer orders for one outlet. You can change its displayed name here; location routing is managed separately.</p>
            <label className="mt-4 block text-sm font-bold text-gray-700" htmlFor="customer-outlet-name">Displayed outlet name</label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input id="customer-outlet-name" value={storeName} onChange={(event) => setStoreName(event.target.value)} maxLength={120} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#2E5E58]" />
              <button type="button" disabled={isSavingStore} onClick={saveStoreName} className="rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:cursor-not-allowed disabled:opacity-60">{isSavingStore ? 'Saving...' : 'Save name'}</button>
            </div>
            {storeMessage && <p className="mt-2 text-sm text-gray-600" role="status">{storeMessage}</p>}
          </div>
        </div>
      </section>}

      {canViewAuditLogs && <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#1F3A34] text-white"><FileText size={23} /></div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Audit Logs</h2>
            <p className="mt-1 text-sm text-gray-500">Review recorded administrative activity, including password changes.</p>
            <button onClick={() => setCurrentPage?.('Audit Logs')} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#1F3A34] px-4 py-2 text-sm font-bold text-[#1F3A34] hover:bg-[#F3F7F5]">View Audit Logs</button>
          </div>
        </div>
      </section>}
    </div>
  </div>
  );
};

export default Settings;
