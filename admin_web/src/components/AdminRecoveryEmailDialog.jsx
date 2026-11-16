import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MailCheck, ShieldCheck, X } from 'lucide-react';
import {
  confirmAdminRecoveryEmailVerification,
  requestAdminRecoveryEmailVerification
} from '../lib/adminApi';

export default function AdminRecoveryEmailDialog({ open, onClose, currentUser, onVerified }) {
  const [step, setStep] = useState('details');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [requestId, setRequestId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep('details');
    setEmail(currentUser?.email || '');
    setCurrentPassword('');
    setCode('');
    setRequestId('');
    setMessage('');
  }, [open, currentUser?.email]);

  if (!open || typeof document === 'undefined') return null;

  const requestCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await requestAdminRecoveryEmailVerification({
        email,
        current_password: currentPassword
      });
      setRequestId(response.request_id);
      setCurrentPassword('');
      setStep('verify');
      setMessage('A six-digit verification code was sent to this email.');
    } catch (error) {
      setMessage(error.message || 'We could not send the verification code.');
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await confirmAdminRecoveryEmailVerification({
        request_id: requestId,
        otp_code: code
      });
      onVerified?.(response.user);
      onClose?.();
    } catch (error) {
      setMessage(error.message || 'We could not verify this email.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#1F3A34]">
              <MailCheck size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Verify recovery email</h2>
              <p className="mt-1 text-sm text-gray-500">
                This address will be used only for security codes and account recovery.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Remind me later"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your password will not change and your current session will stay signed in.
        </div>

        {message && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${message.startsWith('A six') ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        {step === 'details' ? (
          <form onSubmit={requestCode} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Your recovery email
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-[#2E5E58]"
                placeholder="name@company.com"
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Current password
              <input
                required
                minLength={8}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-[#2E5E58]"
              />
            </label>
            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={onClose} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                Remind me later
              </button>
              <button disabled={busy || !email || currentPassword.length < 8} className="rounded-xl bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:opacity-50">
                {busy ? 'Sending...' : 'Send code'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={confirmCode} className="mt-5 space-y-4">
            <p className="text-sm text-gray-600">
              Enter the code sent to <span className="font-semibold text-gray-900">{email}</span>. It expires in 10 minutes.
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Verification code
              <input
                required
                autoFocus
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-3 text-center text-xl tracking-[0.35em] outline-none focus:border-[#2E5E58]"
              />
            </label>
            <div className="flex items-center justify-between gap-3 pt-1">
              <button type="button" onClick={() => { setStep('details'); setCode(''); setMessage(''); }} disabled={busy} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                Change email
              </button>
              <button disabled={busy || code.length !== 6} className="inline-flex items-center gap-2 rounded-xl bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2E5E58] disabled:opacity-50">
                <ShieldCheck size={17} /> {busy ? 'Verifying...' : 'Verify email'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
