import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, CircleAlert, Plus, Printer, RefreshCw, Save, Server, Trash2 } from 'lucide-react';
import {
  adminRequest,
  createAdminOperationalIntegration,
  createAdminPrinterTarget,
  loadAdminOperationalSetup,
  saveAdminWeeklySchedule
} from '../lib/adminApi';

const days = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' }
];

const printerModes = [
  { value: 'android_direct', label: 'Direct Android tablet', hint: 'Bluetooth MAC address or printer IP' },
  { value: 'local_print_bridge', label: 'Windows Print Bridge', hint: 'Bridge printer name' },
  { value: 'pos_adapter', label: 'POS adapter', hint: 'Printer ID supplied by the POS provider' },
  { value: 'network_printer', label: 'Managed network printer', hint: 'Printer IP address or hostname' }
];

const providers = [
  { value: 'manual', label: 'Manual configuration' },
  { value: 'storehub', label: 'StoreHub' },
  { value: 'feedme', label: 'FeedMe' },
  { value: 'local_print_bridge', label: 'Windows Print Bridge' }
];

const initialShift = { barista_id: '', weekday: 1, starts_at: '09:00', ends_at: '17:00' };
const initialPrinter = { name: '', delivery_mode: 'android_direct', printer_reference: '', is_default: false };
const initialIntegration = { provider_code: 'manual', display_name: '', connection_reference: '' };

function displayTime(value) {
  return value?.slice(0, 5) || '--:--';
}

function printerModeLabel(mode) {
  return printerModes.find((item) => item.value === mode)?.label || mode;
}

export default function Operations() {
  const [activeTab, setActiveTab] = useState('timetable');
  const [baristas, setBaristas] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [shiftForm, setShiftForm] = useState(initialShift);
  const [printerForm, setPrinterForm] = useState(initialPrinter);
  const [integrationForm, setIntegrationForm] = useState(initialIntegration);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [savingPrinter, setSavingPrinter] = useState(false);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [operations, baristaResponse] = await Promise.all([
        loadAdminOperationalSetup(),
        adminRequest('/v1/admin/baristas')
      ]);
      setSchedule(operations.weekly_schedule || []);
      setPrinters(operations.printers || []);
      setIntegrations(operations.integrations || []);
      setBaristas((baristaResponse.baristas || []).filter((barista) => barista.is_active));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load operations setup.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const addShift = (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const baristaId = Number(shiftForm.barista_id);
    if (!baristaId) {
      setError('Choose the barista assigned to this shift.');
      return;
    }
    if (shiftForm.ends_at <= shiftForm.starts_at) {
      setError('Shift end time must be after start time.');
      return;
    }

    const barista = baristas.find((item) => Number(item.id) === baristaId);
    const duplicate = schedule.some((item) => Number(item.barista_id) === baristaId
      && Number(item.weekday) === Number(shiftForm.weekday)
      && displayTime(item.starts_at) === shiftForm.starts_at);
    if (duplicate) {
      setError('This barista already has a shift with the same start time.');
      return;
    }

    setSchedule((current) => [...current, {
      id: `draft-${Date.now()}`,
      barista_id: baristaId,
      barista_name: barista?.name || 'Barista',
      weekday: Number(shiftForm.weekday),
      starts_at: shiftForm.starts_at,
      ends_at: shiftForm.ends_at,
      is_active: true
    }]);
    setShiftForm(initialShift);
  };

  const removeShift = (id) => {
    setSchedule((current) => current.filter((entry) => entry.id !== id));
    setNotice('');
  };

  const publishSchedule = async () => {
    setSavingSchedule(true);
    setError('');
    setNotice('');
    try {
      const entries = schedule.map((entry) => ({
        barista_id: Number(entry.barista_id),
        weekday: Number(entry.weekday),
        starts_at: displayTime(entry.starts_at),
        ends_at: displayTime(entry.ends_at)
      }));
      await saveAdminWeeklySchedule(entries);
      setNotice(`Weekly timetable published with ${entries.length} shift${entries.length === 1 ? '' : 's'}.`);
      await loadData();
    } catch (saveError) {
      setError(saveError.message || 'Unable to publish the weekly timetable.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const addPrinter = async (event) => {
    event.preventDefault();
    setSavingPrinter(true);
    setError('');
    setNotice('');
    try {
      await createAdminPrinterTarget({ ...printerForm, status: 'pending' });
      setPrinterForm(initialPrinter);
      setNotice('Printer route saved as pending. It will only become connected after a verified connector is added.');
      await loadData();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save printer configuration.');
    } finally {
      setSavingPrinter(false);
    }
  };

  const addIntegration = async (event) => {
    event.preventDefault();
    setSavingIntegration(true);
    setError('');
    setNotice('');
    try {
      await createAdminOperationalIntegration({ ...integrationForm, status: 'pending' });
      setIntegrationForm(initialIntegration);
      setNotice('POS connection saved as pending. Credentials and provider API mapping are still required before data can sync.');
      await loadData();
    } catch (saveError) {
      setError(saveError.message || 'Unable to save POS configuration.');
    } finally {
      setSavingIntegration(false);
    }
  };

  const groupedSchedule = days.map((day) => ({
    ...day,
    entries: schedule
      .filter((entry) => Number(entry.weekday) === day.value)
      .sort((left, right) => displayTime(left.starts_at).localeCompare(displayTime(right.starts_at)))
  }));
  const selectedPrinterMode = printerModes.find((item) => item.value === printerForm.delivery_mode);

  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB]">
      <div className="mx-auto w-full max-w-7xl p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5C867F]">Store operations</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Timetable &amp; printing</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">Publish the weekly staffing plan and register receipt delivery routes. A configured route is not treated as connected until a real device or POS connector verifies it.</p>
          </div>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="mt-6 flex gap-2 border-b border-slate-200">
          <button type="button" onClick={() => setActiveTab('timetable')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'timetable' ? 'border-[#2E5E58] text-[#2E5E58]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <CalendarDays size={17} /> Weekly timetable
          </button>
          <button type="button" onClick={() => setActiveTab('printers')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'printers' ? 'border-[#2E5E58] text-[#2E5E58]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Printer size={17} /> Printers &amp; POS
          </button>
        </div>

        {(error || notice) && <div className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error ? <CircleAlert size={18} className="mt-0.5 shrink-0" /> : <Check size={18} className="mt-0.5 shrink-0" />}
          <span>{error || notice}</span>
        </div>}

        {activeTab === 'timetable' && <section className="mt-6 grid gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
          <form onSubmit={addShift} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Add weekly shift</h2>
            <p className="mt-1 text-sm text-slate-500">The timetable is read-only in the barista tablet. Publish after all changes are ready.</p>
            <label className="mt-5 block text-sm font-bold text-slate-700">Barista
              <select value={shiftForm.barista_id} onChange={(event) => setShiftForm((current) => ({ ...current, barista_id: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" required>
                <option value="">Choose barista</option>
                {baristas.map((barista) => <option key={barista.id} value={barista.id}>{barista.name}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-bold text-slate-700">Day
              <select value={shiftForm.weekday} onChange={(event) => setShiftForm((current) => ({ ...current, weekday: Number(event.target.value) }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]">
                {days.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </label>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block text-sm font-bold text-slate-700">Starts
                <input type="time" value={shiftForm.starts_at} onChange={(event) => setShiftForm((current) => ({ ...current, starts_at: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" required />
              </label>
              <label className="block text-sm font-bold text-slate-700">Ends
                <input type="time" value={shiftForm.ends_at} onChange={(event) => setShiftForm((current) => ({ ...current, ends_at: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" required />
              </label>
            </div>
            <button type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E5E58] px-4 py-3 text-sm font-bold text-white hover:bg-[#244B46]">
              <Plus size={17} /> Add shift
            </button>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-lg font-bold text-slate-900">Weekly coverage</h2><p className="mt-1 text-sm text-slate-500">Draft changes appear here before publishing.</p></div>
              <button type="button" onClick={() => void publishSchedule()} disabled={savingSchedule || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#142b26] disabled:opacity-50">
                <Save size={16} /> {savingSchedule ? 'Publishing...' : 'Publish timetable'}
              </button>
            </div>
            {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading timetable...</p> : <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {groupedSchedule.map((day) => <div key={day.value} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-bold text-slate-800">{day.label}</h3>
                {day.entries.length === 0 ? <p className="mt-3 text-sm text-slate-400">No shift published</p> : <div className="mt-3 space-y-2">
                  {day.entries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 shadow-sm">
                    <div><p className="text-sm font-bold text-slate-800">{entry.barista_name}</p><p className="text-xs text-slate-500">{displayTime(entry.starts_at)} - {displayTime(entry.ends_at)}</p></div>
                    <button type="button" onClick={() => removeShift(entry.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${entry.barista_name} shift`}><Trash2 size={16} /></button>
                  </div>)}
                </div>}
              </div>)}
            </div>}
          </div>
        </section>}

        {activeTab === 'printers' && <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <form onSubmit={addPrinter} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex gap-3"><div className="rounded-xl bg-[#E8F1EF] p-3 text-[#2E5E58]"><Printer size={22} /></div><div><h2 className="text-lg font-bold text-slate-900">Register receipt printer</h2><p className="mt-1 text-sm text-slate-500">Save its route first. Device delivery is activated only after connector verification.</p></div></div>
              <label className="mt-5 block text-sm font-bold text-slate-700">Printer name<input value={printerForm.name} onChange={(event) => setPrinterForm((current) => ({ ...current, name: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" placeholder="Counter receipt printer" required /></label>
              <label className="mt-4 block text-sm font-bold text-slate-700">Delivery route<select value={printerForm.delivery_mode} onChange={(event) => setPrinterForm((current) => ({ ...current, delivery_mode: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]">{printerModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
              <label className="mt-4 block text-sm font-bold text-slate-700">Printer reference<input value={printerForm.printer_reference} onChange={(event) => setPrinterForm((current) => ({ ...current, printer_reference: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" placeholder={selectedPrinterMode?.hint} required /><span className="mt-1 block text-xs font-normal text-slate-500">Use {selectedPrinterMode?.hint?.toLowerCase()}. Do not enter provider passwords here.</span></label>
              <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={printerForm.is_default} onChange={(event) => setPrinterForm((current) => ({ ...current, is_default: event.target.checked }))} className="h-4 w-4 accent-[#2E5E58]" /> Use as default receipt printer</label>
              <button type="submit" disabled={savingPrinter} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E5E58] px-4 py-3 text-sm font-bold text-white hover:bg-[#244B46] disabled:opacity-50"><Plus size={17} /> {savingPrinter ? 'Saving...' : 'Save printer route'}</button>
            </form>
            <form onSubmit={addIntegration} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex gap-3"><div className="rounded-xl bg-amber-50 p-3 text-amber-700"><Server size={22} /></div><div><h2 className="text-lg font-bold text-slate-900">Register POS connection</h2><p className="mt-1 text-sm text-slate-500">This records the intended provider. API credentials and mappings are added when the provider documentation is available.</p></div></div>
              <label className="mt-5 block text-sm font-bold text-slate-700">Provider<select value={integrationForm.provider_code} onChange={(event) => setIntegrationForm((current) => ({ ...current, provider_code: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]">{providers.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}</select></label>
              <label className="mt-4 block text-sm font-bold text-slate-700">Connection name<input value={integrationForm.display_name} onChange={(event) => setIntegrationForm((current) => ({ ...current, display_name: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" placeholder="Main counter StoreHub" required /></label>
              <label className="mt-4 block text-sm font-bold text-slate-700">Reference (optional)<input value={integrationForm.connection_reference} onChange={(event) => setIntegrationForm((current) => ({ ...current, connection_reference: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" placeholder="Outlet or integration reference" /></label>
              <button type="submit" disabled={savingIntegration} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#2E5E58] bg-white px-4 py-3 text-sm font-bold text-[#2E5E58] hover:bg-[#E8F1EF] disabled:opacity-50"><Plus size={17} /> {savingIntegration ? 'Saving...' : 'Save POS connection'}</button>
            </form>
          </div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">Registered printers</h2><p className="mt-1 text-sm text-slate-500">A pending route cannot print yet.</p><div className="mt-4 divide-y divide-slate-100">{printers.length === 0 ? <p className="py-5 text-sm text-slate-500">No receipt printer has been registered.</p> : printers.map((printer) => <div key={printer.id} className="flex items-center justify-between gap-4 py-4"><div><div className="flex items-center gap-2"><p className="font-bold text-slate-800">{printer.name}</p>{printer.is_default && <span className="rounded-full bg-[#E8F1EF] px-2 py-0.5 text-[11px] font-bold text-[#2E5E58]">Default</span>}</div><p className="mt-1 text-sm text-slate-500">{printerModeLabel(printer.delivery_mode)}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{printer.status.replace('_', ' ')}</span></div>)}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-slate-900">POS connections</h2><p className="mt-1 text-sm text-slate-500">Current registrations are not live data syncs.</p><div className="mt-4 divide-y divide-slate-100">{integrations.length === 0 ? <p className="py-5 text-sm text-slate-500">No POS or print bridge has been registered.</p> : integrations.map((integration) => <div key={integration.id} className="flex items-center justify-between gap-4 py-4"><div><p className="font-bold text-slate-800">{integration.display_name}</p><p className="mt-1 text-sm capitalize text-slate-500">{integration.provider_code.replace('_', ' ')}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">{integration.status.replace('_', ' ')}</span></div>)}</div></div>
          </div>
        </section>}
      </div>
    </div>
  );
}
