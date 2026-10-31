import React, { useEffect, useState } from 'react';
import { Archive, MapPin, Plus, RotateCcw, Save } from 'lucide-react';
import { createAdminStore, loadAdminStores, updateAdminStore } from '../lib/adminApi';
import InfoTooltip from './InfoTooltip';

const dayRows = [
  ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
  ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
];
const defaultWeeklyHours = Object.fromEntries(dayRows.map(([key]) => [key, { closed: false, open: '08:00', close: '22:00' }]));

const emptyOutlet = {
  code: '', name: '', address_line_1: '', address_line_2: '', city: '', state: '', postcode: '',
  timezone: 'Asia/Kuala_Lumpur', supports_pickup: true, pickup_lead_minutes: 15, is_customer_facing: false,
  latitude: null, longitude: null, temporarily_closed: false, weekly_hours: defaultWeeklyHours
};

function OutletForm({ initialValue = emptyOutlet, onSave, saving, actionLabel, password, setPassword }) {
  const withSchedule = (value) => ({ ...value, weekly_hours: value.weekly_hours || defaultWeeklyHours });
  const [form, setForm] = useState(withSchedule(initialValue));
  useEffect(() => setForm(withSchedule(initialValue)), [initialValue]);
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const changeHours = (day, key, value) => setForm((current) => ({
    ...current,
    weekly_hours: { ...(current.weekly_hours || defaultWeeklyHours), [day]: { ...(current.weekly_hours?.[day] || defaultWeeklyHours[day]), [key]: value } },
  }));
  const routingLocked = Boolean(initialValue.id && initialValue.is_customer_facing);

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); onSave(form); }}>
      <label className="text-sm font-semibold text-gray-700">
        Outlet code
        <input
          required
          value={form.code || ''}
          disabled={Boolean(initialValue.id)}
          onChange={(e) => change('code', e.target.value.toUpperCase())}
          placeholder="C2-BANGI"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700">
        Outlet name
        <input
          required
          value={form.name || ''}
          onChange={(e) => change('name', e.target.value)}
          placeholder="C2 Bangi"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700 md:col-span-2">
        Address
        <input
          required
          value={form.address_line_1 || ''}
          onChange={(e) => change('address_line_1', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700 md:col-span-2">
        Address line 2 (optional)
        <input
          value={form.address_line_2 || ''}
          onChange={(e) => change('address_line_2', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700">
        City
        <input
          required
          value={form.city || ''}
          onChange={(e) => change('city', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700">
        State
        <input
          required
          value={form.state || ''}
          onChange={(e) => change('state', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700">
        Postcode
        <input
          required
          value={form.postcode || ''}
          onChange={(e) => change('postcode', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700">
        Pickup lead time (minutes)
        <input
          required
          min="0"
          max="240"
          type="number"
          value={form.pickup_lead_minutes ?? 15}
          onChange={(e) => change('pickup_lead_minutes', Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700">
        Timezone
        <input
          required
          value={form.timezone || ''}
          onChange={(e) => change('timezone', e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700">
        Latitude
        <input
          required
          type="number"
          min="-90"
          max="90"
          step="0.0000001"
          value={form.latitude ?? ''}
          onChange={(e) => change('latitude', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="2.9381000"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      <label className="text-sm font-semibold text-gray-700">
        Longitude
        <input
          required
          type="number"
          min="-180"
          max="180"
          step="0.0000001"
          value={form.longitude ?? ''}
          onChange={(e) => change('longitude', e.target.value === '' ? null : Number(e.target.value))}
          placeholder="101.7875000"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>
      {initialValue.id && (
        <label className="text-sm font-semibold text-gray-700">
          Status
          <select
            value={form.status || 'active'}
            disabled={routingLocked}
            onChange={(e) => change('status', e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 bg-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Archived</option>
          </select>
        </label>
      )}

      <div className="md:col-span-2 flex flex-wrap gap-5 text-sm font-medium text-gray-700 pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(form.supports_pickup)}
            onChange={(e) => change('supports_pickup', e.target.checked)}
            className="rounded border-gray-300 text-[#1F3A34] focus:ring-[#2E5E58] h-4 w-4"
          />
          Supports pickup
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(form.is_customer_facing)}
            onChange={(e) => change('is_customer_facing', e.target.checked)}
            className="rounded border-gray-300 text-[#1F3A34] focus:ring-[#2E5E58] h-4 w-4"
          />
          Available in customer app
        </label>
        <label className="flex items-center gap-2 text-red-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(form.temporarily_closed)}
            onChange={(e) => change('temporarily_closed', e.target.checked)}
            className="rounded border-red-300 text-red-600 focus:ring-red-500 h-4 w-4"
          />
          Temporarily closed
        </label>
      </div>

      <fieldset className="md:col-span-2 rounded-2xl border border-gray-200/80 bg-gray-50/40 p-4">
        <legend className="px-2 text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <span>Opening hours</span>
          <InfoTooltip content="Weekly operating schedule for mobile app order pickup and counter operations." title="Opening Hours" />
        </legend>
        <div className="space-y-3">
          {dayRows.map(([key, label]) => {
            const hours = form.weekly_hours?.[key] || defaultWeeklyHours[key];
            return (
              <div key={key} className="grid grid-cols-[100px_1fr_1fr] items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!hours.closed}
                    onChange={(event) => changeHours(key, 'closed', !event.target.checked)}
                    className="rounded border-gray-300 text-[#1F3A34] focus:ring-[#2E5E58] h-4 w-4"
                  />
                  {label}
                </label>
                <input
                  aria-label={`${label} opening time`}
                  disabled={hours.closed}
                  required={!hours.closed}
                  type="time"
                  value={hours.open || ''}
                  onChange={(event) => changeHours(key, 'open', event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                />
                <input
                  aria-label={`${label} closing time`}
                  disabled={hours.closed}
                  required={!hours.closed}
                  type="time"
                  value={hours.close || ''}
                  onChange={(event) => changeHours(key, 'close', event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-gray-500">Untick a day when the outlet is closed. Closing times earlier than opening times are treated as overnight hours.</p>
      </fieldset>

      {routingLocked && (
        <p className="md:col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg font-medium">
          Turn off customer-app availability before archiving this outlet.
        </p>
      )}

      <label className="text-sm font-semibold text-gray-700 md:col-span-2">
        Confirm with current password
        <input
          required
          minLength="8"
          autoComplete="current-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent"
        />
      </label>

      <button
        disabled={saving}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#1F3A34] hover:bg-[#2E5E58] px-5 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60 cursor-pointer shadow-xs"
      >
        <Save size={16} />
        {saving ? 'Saving...' : actionLabel}
      </button>
    </form>
  );
}

export default function Outlets({ currentUser }) {
  const [outlets, setOutlets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = async () => {
    try {
      const response = await loadAdminStores();
      setOutlets(response.stores || []);
    } catch {
      setMessage('Could not load outlets.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (form) => {
    if (!password) return setMessage('Enter your current password to confirm this outlet change.');
    setSaving(true);
    setMessage('');
    try {
      if (selected?.id) await updateAdminStore(selected.id, { ...form, confirmation_password: password });
      else await createAdminStore({ ...form, confirmation_password: password });
      setPassword('');
      setAdding(false);
      setSelected(null);
      setMessage('Outlet saved. You can now assign its workstation under C2 Store Devices.');
      await load();
    } catch (error) {
      setMessage(error?.message || 'Outlet could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const changeArchiveStatus = async () => {
    if (!selected?.id || !password) return setMessage('Enter your current password to confirm this outlet change.');
    const nextStatus = selected.status === 'active' ? 'inactive' : 'active';
    setSaving(true);
    setMessage('');
    try {
      await updateAdminStore(selected.id, { status: nextStatus, confirmation_password: password });
      setPassword('');
      setSelected(null);
      setMessage(nextStatus === 'inactive' ? 'Outlet archived. Historical sales remain available in reports.' : 'Outlet reactivated.');
      await load();
    } catch (error) {
      setMessage(error?.message || 'Outlet status could not be changed.');
    } finally {
      setSaving(false);
    }
  };

  const visibleOutlets = showArchived ? outlets : outlets.filter((outlet) => outlet.status === 'active');

  if (!Array.isArray(currentUser?.roles) || !currentUser.roles.some((role) => ['super_admin', 'operations_admin'].includes(role))) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB] p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2E5E58]">Store network</p>
              <InfoTooltip content="Physical branch locations configuring operational hours and pickup availability." title="Store Network" />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-3xl font-bold text-gray-900">Outlets</h1>
            </div>
            <p className="mt-2 text-sm text-gray-500">Add branches for this cafe only. Archive closed outlets while preserving their sales history.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="rounded border-gray-300 text-[#1F3A34] focus:ring-[#2E5E58] h-4 w-4"
              />
              Show archived
            </label>
            <button
              disabled={saving}
              onClick={() => { setAdding(true); setSelected(null); setPassword(''); setMessage(''); }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1F3A34] hover:bg-[#2E5E58] px-4.5 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-60 cursor-pointer shadow-xs"
            >
              <Plus size={17} /> Add outlet
            </button>
          </div>
        </div>

        {message && (
          <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200/80 px-4 py-3 text-sm text-amber-800 font-medium shadow-2xs">
            {message}
          </div>
        )}

        <div className="mt-7 grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
          <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Branches</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {visibleOutlets.length} {visibleOutlets.length === 1 ? 'outlet' : 'outlets'}
              </span>
            </div>
            {visibleOutlets.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">
                {outlets.length ? 'No active outlets. Turn on Show archived to review closed branches.' : 'No outlets yet.'}
              </p>
            ) : (
              visibleOutlets.map((outlet) => (
                <button
                  disabled={saving}
                  key={outlet.id}
                  onClick={() => { setSelected(outlet); setAdding(false); setPassword(''); setMessage(''); }}
                  className={`mb-2 w-full rounded-xl p-4 text-left transition-all cursor-pointer disabled:opacity-60 ${
                    selected?.id === outlet.id
                      ? 'bg-[#1F3A34] text-white shadow-sm'
                      : 'border border-gray-100 hover:border-gray-200 hover:bg-gray-50/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${selected?.id === outlet.id ? 'bg-white/15 text-white' : 'bg-emerald-50 text-[#1F3A34]'}`}>
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{outlet.name}</p>
                      <p className={`text-xs mt-0.5 truncate ${selected?.id === outlet.id ? 'text-white/70' : 'text-gray-500'}`}>
                        {outlet.code} · {outlet.city}, {outlet.state} · {outlet.status === 'inactive' ? 'Archived' : 'Active'}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </section>

          <section className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-2xs hover:shadow-xs transition-shadow">
            <h2 className="text-lg font-bold text-gray-900">
              {adding ? 'New outlet' : selected ? `Edit ${selected.name}` : 'Select an outlet'}
            </h2>
            {(adding || selected) ? (
              <>
                <p className="mt-1 text-sm text-gray-500">New outlets stay hidden from the customer app until you explicitly publish them.</p>
                <div className="mt-5">
                  <OutletForm
                    initialValue={selected || emptyOutlet}
                    saving={saving}
                    actionLabel={adding ? 'Create outlet' : 'Save outlet'}
                    onSave={save}
                    password={password}
                    setPassword={setPassword}
                  />
                  {selected && (
                    <button
                      type="button"
                      disabled={saving || selected.is_customer_facing}
                      onClick={changeArchiveStatus}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-300 hover:bg-gray-50 px-4 py-2 text-sm font-bold text-gray-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                      {selected.status === 'active' ? <Archive size={16} /> : <RotateCcw size={16} />}
                      {selected.status === 'active' ? 'Archive outlet' : 'Reactivate outlet'}
                    </button>
                  )}
                  {selected?.is_customer_facing && (
                    <p className="mt-2 text-xs text-amber-700">Turn off customer-app availability before archiving this outlet.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Select an outlet to update its branch details, or add a new outlet.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
