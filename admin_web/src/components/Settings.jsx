import React from 'react';
import { FileText, KeyRound, ShieldCheck } from 'lucide-react';

const Settings = ({ setCurrentPage, currentUser }) => {
  const canViewAuditLogs = Array.isArray(currentUser?.roles) && currentUser.roles.includes('super_admin');

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
