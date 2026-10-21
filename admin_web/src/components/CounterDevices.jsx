import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, KeyRound, MonitorSmartphone, Plus, RefreshCw, ShieldOff, Wifi, WifiOff } from 'lucide-react';

import {
  createAdminCounterDevice,
  loadAdminCounterDevices,
  loadAdminStores,
  reissueAdminCounterDeviceActivation,
  updateAdminCounterDevice,
} from '../lib/adminApi';

function formatDate(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

export default function CounterDevices({ currentUser }) {
  const [devices, setDevices] = useState([]);
  const [stores, setStores] = useState([]);
  const [label, setLabel] = useState('');
  const [storeId, setStoreId] = useState('');
  const [password, setPassword] = useState('');
  const [activation, setActivation] = useState(null);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [copied, setCopied] = useState(false);
  const [presenceError, setPresenceError] = useState('');
  const [onlineWindowSeconds, setOnlineWindowSeconds] = useState(30);
  const devicesRequestInFlight = useRef(false);

  const canManage = Array.isArray(currentUser?.roles) &&
    currentUser.roles.some((role) => ['super_admin', 'operations_admin'].includes(role));

  const loadDevices = useCallback(async ({ showError = true } = {}) => {
    if (devicesRequestInFlight.current) return;
    devicesRequestInFlight.current = true;
    try {
      const deviceResponse = await loadAdminCounterDevices();
      setDevices(deviceResponse.devices || []);
      setOnlineWindowSeconds(deviceResponse.online_window_seconds || 30);
      setPresenceError('');
    } catch (error) {
      setPresenceError('Live device status is temporarily unavailable. The last displayed state may be stale.');
      if (showError) setMessage(error?.message || 'Counter devices could not be loaded.');
    } finally {
      devicesRequestInFlight.current = false;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [, storeResponse] = await Promise.all([
        loadDevices(),
        loadAdminStores(),
      ]);
      const activeStores = (storeResponse.stores || []).filter((store) => store.status === 'active');
      setStores(activeStores);
      setStoreId((current) => current || String(activeStores[0]?.id || ''));
    } catch (error) {
      setMessage(error?.message || 'Counter devices could not be loaded.');
    }
  }, [loadDevices]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const refreshPresence = () => {
      if (document.visibilityState === 'visible') void loadDevices({ showError: false });
    };
    const interval = window.setInterval(refreshPresence, 10000);
    document.addEventListener('visibilitychange', refreshPresence);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshPresence);
    };
  }, [loadDevices]);

  const requirePassword = () => {
    if (password.length < 8) {
      setMessage('Enter your current password to confirm this device change.');
      return false;
    }
    return true;
  };

  const createDevice = async (event) => {
    event.preventDefault();
    if (!requirePassword()) return;
    setBusyId('create');
    setMessage('');
    try {
      const response = await createAdminCounterDevice({
        label: label.trim(),
        store_id: Number(storeId),
        confirmation_password: password,
      });
      setActivation({
        code: response.activation_code,
        expiresAt: response.activation_expires_at,
        label: response.device?.label || label.trim(),
      });
      setLabel('');
      setPassword('');
      await load();
    } catch (error) {
      setMessage(error?.message || 'Counter device could not be created.');
    } finally {
      setBusyId(null);
    }
  };

  const changeStatus = async (device, status) => {
    if (!requirePassword()) return;
    setBusyId(device.id);
    setMessage('');
    try {
      await updateAdminCounterDevice(device.id, {
        status,
        confirmation_password: password,
      });
      setPassword('');
      setMessage(status === 'revoked'
        ? 'Device revoked. Its saved credential can no longer access this cafe.'
        : `Device marked ${status}.`);
      await load();
    } catch (error) {
      setMessage(error?.message || 'Device status could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const reissueActivation = async (device) => {
    if (!requirePassword()) return;
    setBusyId(device.id);
    setMessage('');
    try {
      const response = await reissueAdminCounterDeviceActivation(device.id, password);
      setActivation({
        code: response.activation_code,
        expiresAt: response.activation_expires_at,
        label: device.label,
      });
      setPassword('');
      await load();
    } catch (error) {
      setMessage(error?.message || 'A new activation code could not be issued.');
    } finally {
      setBusyId(null);
    }
  };

  const copyActivation = async () => {
    if (!activation?.code) return;
    await navigator.clipboard.writeText(activation.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (!canManage) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2E5E58]">Store network</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">C2 Store Devices</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-500">
          Register each physical Counter and Barista workstation separately. A device is permanently scoped to one cafe deployment and one outlet.
        </p>

        {message && <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</p>}

        {activation && (
          <section className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">One-time activation</p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">{activation.label}</h2>
                <p className="mt-1 text-sm text-gray-600">Enter this code in the installed C2 Store app before {formatDate(activation.expiresAt)}. It is not shown again.</p>
                <code className="mt-4 inline-block rounded-xl bg-white px-4 py-3 text-xl font-black tracking-wider text-[#1F3A34] shadow-sm">{activation.code}</code>
              </div>
              <button type="button" onClick={copyActivation} className="inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-bold text-white">
                {copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy code'}
              </button>
            </div>
          </section>
        )}

        <div className="mt-7 grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
          <form onSubmit={createDevice} className="h-fit rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3"><Plus className="text-[#2E5E58]" size={20} /><h2 className="text-lg font-bold">Add device</h2></div>
            <label className="mt-5 block text-sm font-semibold text-gray-700">Device label
              <input required minLength="2" maxLength="120" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Eco Forest Counter 1" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-gray-700">Assigned outlet
              <select required value={storeId} onChange={(event) => setStoreId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="">Choose outlet</option>
                {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold text-gray-700">Confirm with current password
              <input required minLength="8" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
            <button disabled={busyId === 'create' || !stores.length} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><KeyRound size={16} />{busyId === 'create' ? 'Creating...' : 'Create and issue code'}</button>
          </form>

          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between px-2 py-2"><div><h2 className="text-lg font-bold">Registered devices</h2><p className="mt-1 text-xs text-gray-500">Live status refreshes every 10 seconds. Online requires contact within {onlineWindowSeconds} seconds.</p></div><button type="button" onClick={() => loadDevices()} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Refresh devices"><RefreshCw size={17} /></button></div>
            {presenceError && <p className="mx-2 mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{presenceError}</p>}
            <div className="mt-2 space-y-3">
              {devices.length === 0 && <p className="p-4 text-sm text-gray-500">No C2 Store devices have been registered.</p>}
              {devices.map((device) => (
                <article key={device.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[#E8F1EE] p-2.5 text-[#2E5E58]"><MonitorSmartphone size={20} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-gray-900">{device.label}</h3>
                        {device.connection_status === 'online' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700"><Wifi size={12} />Online</span>}
                        {device.connection_status === 'offline' && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600"><WifiOff size={12} />Offline</span>}
                        {device.connection_status === 'awaiting_activation' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Awaiting activation</span>}
                        {device.connection_status === 'disabled' && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">Disabled</span>}
                        {device.connection_status === 'revoked' && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">Revoked</span>}
                        {device.status === 'active' && <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-500">Access enabled</span>}
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{device.store_name}</p>
                      <p className="mt-1 text-xs text-gray-400">Activated: {formatDate(device.activated_at)} · Last seen: {formatDate(device.last_seen_at)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button disabled={busyId === device.id} type="button" onClick={() => reissueActivation(device)} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50"><KeyRound size={14} /> Reissue activation</button>
                    {device.status === 'active' ? <button disabled={busyId === device.id} type="button" onClick={() => changeStatus(device, 'inactive')} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50">Disable</button> : device.status === 'inactive' ? <button disabled={busyId === device.id} type="button" onClick={() => changeStatus(device, 'active')} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 disabled:opacity-50">Enable</button> : null}
                    {device.status !== 'revoked' && <button disabled={busyId === device.id} type="button" onClick={() => changeStatus(device, 'revoked')} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"><ShieldOff size={14} /> Revoke</button>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
