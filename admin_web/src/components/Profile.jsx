import React, { useState } from 'react';
import { ArrowLeft, KeyRound, ShieldCheck, X } from 'lucide-react';
import {
  clearAdminTokens,
  confirmAdminPasswordChange,
  requestAdminPasswordChange
} from '../lib/adminApi';

const Profile = ({ onBack, currentUser }) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('details');
  const [requestId, setRequestId] = useState('');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '', code: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const name = currentUser?.full_name || currentUser?.username || 'Admin';
  const email = currentUser?.email || '';
  const role = (currentUser?.roles?.[0] || 'admin').replaceAll('_', ' ');

  const close = () => {
    if (busy) return;
    setOpen(false);
    setStep('details');
    setRequestId('');
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '', code: '' });
    setMessage('');
  };

  const requestCode = async (event) => {
    event.preventDefault();
    setMessage('');
    if (form.newPassword !== form.confirmPassword) {
      setMessage('New password confirmation does not match.');
      return;
    }
    setBusy(true);
    try {
      const response = await requestAdminPasswordChange({
        current_password: form.currentPassword,
        new_password: form.newPassword,
        confirm_password: form.confirmPassword
      });
      setRequestId(response.request_id);
      setStep('verify');
      setMessage('A six-digit code was sent to your admin email.');
    } catch (error) {
      setMessage(error.message || 'We could not send a verification code.');
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (event) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    try {
      await confirmAdminPasswordChange({ request_id: requestId, otp_code: form.code });
      clearAdminTokens();
      window.dispatchEvent(new Event('c2-admin-session-expired'));
      setMessage('Password changed. Please sign in again.');
    } catch (error) {
      setMessage(error.message || 'We could not change your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          {onBack && <button onClick={onBack} className="rounded-lg p-1 text-gray-700 hover:bg-gray-100"><ArrowLeft size={22} /></button>}
          <div><h1 className="text-2xl font-bold text-gray-900">My Account</h1><p className="mt-1 text-sm text-gray-500">Your live admin account and security controls.</p></div>
        </div>

        <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1F3A34] text-xl font-bold text-white">{name.charAt(0).toUpperCase()}</div><div><h2 className="text-lg font-bold text-gray-900">{name}</h2><p className="mt-1 capitalize text-sm text-gray-500">{role}</p></div></div>
          <dl className="mt-6 divide-y divide-gray-100 border-y border-gray-100 text-sm"><div className="flex justify-between gap-4 py-4"><dt className="text-gray-500">Username</dt><dd className="font-semibold text-gray-900">{currentUser?.username || 'Not available'}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-gray-500">Admin email</dt><dd className="max-w-[65%] truncate font-semibold text-gray-900">{email || 'No email configured'}</dd></div><div className="flex justify-between gap-4 py-4"><dt className="text-gray-500">Last sign-in</dt><dd className="font-semibold text-gray-900">{currentUser?.last_login_at ? new Date(currentUser.last_login_at).toLocaleString() : 'Not available'}</dd></div></dl>
        </section>

        <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-5"><div><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-[#1F3A34]" /><h2 className="text-lg font-bold text-gray-900">Password</h2></div><p className="mt-2 text-sm text-gray-500">Changing your password requires your current password and a six-digit code sent to your admin email. All devices will need to sign in again.</p></div><button onClick={() => setOpen(true)} className="shrink-0 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white hover:bg-[#2E5E58]">Change Password</button></div></section>
      </div>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-bold text-gray-900"><KeyRound size={19} className="text-[#1F3A34]" /> Change Password</h2><button onClick={close} className="text-gray-400 hover:text-gray-700"><X size={20} /></button></div>{message && <div className={`mb-4 rounded-lg px-3 py-2 text-sm ${message.startsWith('A six') || message.startsWith('Password changed') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message}</div>}{step === 'details' ? <form onSubmit={requestCode} className="space-y-4"><label className="block text-sm font-medium text-gray-700">Current password<input required type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label><label className="block text-sm font-medium text-gray-700">New password<input required minLength="8" type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label><label className="block text-sm font-medium text-gray-700">Confirm new password<input required minLength="8" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label><button disabled={busy || !email} className="w-full rounded-lg bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Sending code...' : 'Send Verification Code'}</button>{!email && <p className="text-sm text-red-600">An admin email is required before you can change the password.</p>}</form> : <form onSubmit={confirmCode} className="space-y-4"><p className="text-sm text-gray-600">Enter the code sent to <span className="font-semibold">{email}</span>. It expires after 10 minutes.</p><label className="block text-sm font-medium text-gray-700">Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.replace(/\D/g, '') })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-xl tracking-[0.4em]" /></label><button disabled={busy || form.code.length !== 6} className="w-full rounded-lg bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Confirming...' : 'Confirm and Change Password'}</button></form>}</div></div>}
    </div>
  );
};

export default Profile;
