import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, CircleAlert, Clock3, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  adminRequest,
  loadAdminAttendance,
  loadAdminOperationalSetup,
  saveAdminShiftSchedule
} from '../lib/adminApi';

const initialShift = { barista_id: '', shift_date: isoDate(), starts_at: '09:00', ends_at: '17:00' };

function displayTime(value) {
  return value?.slice(0, 5) || '--:--';
}

function isoDate(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function planningDates() {
  return Array.from({ length: 31 }, (_, index) => isoDate(index));
}

function displayDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

const attendanceLabel = (status) => ({ completed: 'Completed', late: 'Late arrival', clocked_in: 'Clocked in', clocked_in_late: 'Clocked in late', missing_clock_out: 'Missing clock-out', missed_clock_in: 'Missed clock-in', unscheduled: 'No shift planned' })[status] || status;

export default function Operations() {
  const [activeTab, setActiveTab] = useState('timetable');
  const [baristas, setBaristas] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({ active_now: 0, late_arrivals: 0, missing_clock_out: 0, missed_clock_in: 0 });
  const [attendanceFrom, setAttendanceFrom] = useState(isoDate(-29));
  const [attendanceTo, setAttendanceTo] = useState(isoDate());
  const [attendanceBaristaId, setAttendanceBaristaId] = useState('');
  const [shiftForm, setShiftForm] = useState(initialShift);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
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
      setSchedule(operations.scheduled_shifts || []);
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

  const loadAttendance = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadAdminAttendance({ from: attendanceFrom, to: attendanceTo, baristaId: attendanceBaristaId || undefined });
      setAttendance(result.attendance || []);
      setAttendanceSummary(result.summary || { active_now: 0, late_arrivals: 0, missing_clock_out: 0, missed_clock_in: 0 });
    } catch (loadError) {
      setError(loadError.message || 'Unable to load attendance history.');
    } finally {
      setLoading(false);
    }
  };

  const selectTab = (tab) => {
    setActiveTab(tab);
    // Attendance has a meaningful default date range, so populate it when
    // the manager opens the tab instead of requiring an extra Load click.
    if (tab === 'attendance') {
      void loadAttendance();
    }
  };

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
    if (!planningDates().includes(shiftForm.shift_date)) {
      setError('Choose a date from today through the next 30 days.');
      return;
    }
    const duplicate = schedule.some((item) => Number(item.barista_id) === baristaId
      && item.shift_date === shiftForm.shift_date
      && displayTime(item.starts_at) === shiftForm.starts_at);
    if (duplicate) {
      setError('This barista already has a shift with the same start time.');
      return;
    }

    setSchedule((current) => [...current, {
      id: `draft-${Date.now()}`,
      barista_id: baristaId,
      barista_name: barista?.name || 'Barista',
      shift_date: shiftForm.shift_date,
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
        shift_date: entry.shift_date,
        starts_at: displayTime(entry.starts_at),
        ends_at: displayTime(entry.ends_at)
      }));
      await saveAdminShiftSchedule(entries);
      setNotice(`Timetable published for the next 31 days with ${entries.length} shift${entries.length === 1 ? '' : 's'}.`);
      await loadData();
    } catch (saveError) {
      setError(saveError.message || 'Unable to publish the weekly timetable.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const groupedSchedule = planningDates().map((date) => ({
    date,
    label: displayDate(date),
    entries: schedule
      .filter((entry) => entry.shift_date === date)
      .sort((left, right) => displayTime(left.starts_at).localeCompare(displayTime(right.starts_at)))
  }));
  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB]">
      <div className="mx-auto w-full max-w-7xl p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5C867F]">Store operations</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Store operations</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">Publish the weekly staffing plan and review attendance. Receipt printers are set up directly on each Android Barista tablet.</p>
          </div>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="mt-6 flex gap-2 border-b border-slate-200">
          <button type="button" onClick={() => selectTab('timetable')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'timetable' ? 'border-[#2E5E58] text-[#2E5E58]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <CalendarDays size={17} /> Timetable
          </button>
          <button type="button" onClick={() => selectTab('attendance')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'attendance' ? 'border-[#2E5E58] text-[#2E5E58]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Clock3 size={17} /> Attendance
          </button>
        </div>

        {(error || notice) && <div className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error ? <CircleAlert size={18} className="mt-0.5 shrink-0" /> : <Check size={18} className="mt-0.5 shrink-0" />}
          <span>{error || notice}</span>
        </div>}

        {activeTab === 'timetable' && <section className="mt-6 grid gap-6 xl:grid-cols-[370px_minmax(0,1fr)]">
          <form onSubmit={addShift} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Add shift</h2>
            <p className="mt-1 text-sm text-slate-500">Plan from today through the next 30 days. Baristas see published future shifts in their workspace.</p>
            <label className="mt-5 block text-sm font-bold text-slate-700">Barista
              <select value={shiftForm.barista_id} onChange={(event) => setShiftForm((current) => ({ ...current, barista_id: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" required>
                <option value="">Choose barista</option>
                {baristas.map((barista) => <option key={barista.id} value={barista.id}>{barista.name}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-bold text-slate-700">Date
              <select value={shiftForm.shift_date} onChange={(event) => setShiftForm((current) => ({ ...current, shift_date: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]">
                {planningDates().map((date) => <option key={date} value={date}>{displayDate(date)}</option>)}
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
              <div><h2 className="text-lg font-bold text-slate-900">Next 31 days</h2><p className="mt-1 text-sm text-slate-500">Draft changes appear here before publishing.</p></div>
              <button type="button" onClick={() => void publishSchedule()} disabled={savingSchedule || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#142b26] disabled:opacity-50">
                <Save size={16} /> {savingSchedule ? 'Publishing...' : 'Publish timetable'}
              </button>
            </div>
            {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading timetable...</p> : <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {groupedSchedule.map((day) => <div key={day.date} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
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

        {activeTab === 'attendance' && <section className="mt-6 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-bold text-slate-900">Attendance history</h2><p className="mt-1 text-sm text-slate-500">Compare server-recorded clock-ins and clock-outs with shifts published on or before each date. A current open shift is not marked as a missing clock-out.</p></div><div className="flex flex-wrap gap-3"><input type="date" value={attendanceFrom} onChange={(event) => setAttendanceFrom(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><input type="date" value={attendanceTo} onChange={(event) => setAttendanceTo(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><select value={attendanceBaristaId} onChange={(event) => setAttendanceBaristaId(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All baristas</option>{baristas.map((barista) => <option key={barista.id} value={barista.id}>{barista.name}</option>)}</select><button type="button" onClick={() => void loadAttendance()} className="inline-flex items-center gap-2 rounded-xl bg-[#2E5E58] px-4 py-2 text-sm font-bold text-white"><RefreshCw size={16} /> Load</button></div></div></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[['Working now', attendanceSummary.active_now, 'bg-emerald-50 text-emerald-700'], ['Late arrivals', attendanceSummary.late_arrivals, 'bg-amber-50 text-amber-700'], ['Missing clock-out', attendanceSummary.missing_clock_out, 'bg-red-50 text-red-700'], ['Missed clock-in', attendanceSummary.missed_clock_in, 'bg-red-50 text-red-700']].map(([label, value, color]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{label}</p><p className={`mt-2 inline-flex rounded-lg px-3 py-1 text-2xl font-bold ${color}`}>{value}</p></div>)}</div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Date</th><th className="px-5 py-4">Barista</th><th className="px-5 py-4">Planned</th><th className="px-5 py-4">Actual</th><th className="px-5 py-4">Duration</th><th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{attendance.length === 0 ? <tr><td colSpan="6" className="px-5 py-12 text-center text-slate-500">Choose a date range and load attendance history.</td></tr> : attendance.map((record) => <tr key={record.id}><td className="px-5 py-4 font-medium text-slate-800">{record.date}</td><td className="px-5 py-4">{record.barista_name}</td><td className="px-5 py-4">{record.planned_start ? `${record.planned_start} - ${record.planned_end}` : 'No shift planned'}</td><td className="px-5 py-4">{record.clocked_in_at ? `${new Date(record.clocked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${record.clocked_out_at ? new Date(record.clocked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Open'}` : '--'}</td><td className="px-5 py-4">{record.duration_minutes == null ? '--' : `${Math.floor(record.duration_minutes / 60)}h ${record.duration_minutes % 60}m`}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${record.status === 'completed' || record.status === 'clocked_in' ? 'bg-emerald-50 text-emerald-700' : record.status === 'clocked_in_late' || record.status === 'late' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{attendanceLabel(record.status)}{record.late_minutes ? ` (${record.late_minutes}m)` : ''}</span></td></tr>)}</tbody></table></div>
        </section>}
      </div>
    </div>
  );
}
