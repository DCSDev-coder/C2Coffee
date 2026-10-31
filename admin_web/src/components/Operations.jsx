import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, Check, CircleAlert, ClipboardCheck, Clock3, Plus, RefreshCw, Save, Trash2, Volume2, X } from 'lucide-react';
import {
  adminRequest,
  createAdminSideWorkBatch,
  loadAdminAttendance,
  loadAdminOperationalSetup,
  saveAdminShiftSchedule
} from '../lib/adminApi';
import InfoTooltip from './InfoTooltip';

function SortableHeader({ label, columnKey, currentKey, direction, onSort, info, className = "" }) {
  const isSorted = currentKey === columnKey;
  return (
    <th className={`px-5 py-4 font-bold text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap ${className}`}>
      <div className={`flex items-center gap-1.5 ${className.includes('text-right') ? 'justify-end' : className.includes('text-center') ? 'justify-center' : ''}`}>
        <button
          type="button"
          onClick={() => onSort(columnKey)}
          className={`group inline-flex items-center gap-1.5 hover:text-[#1E433A] cursor-pointer focus:outline-none transition-colors select-none ${
            isSorted ? "text-[#1E433A] font-bold" : ""
          }`}
          title={`Sort by ${label} ${isSorted && direction === "asc" ? "(Descending)" : "(Ascending)"}`}
        >
          <span>{label}</span>
          <span className="inline-flex items-center">
            {isSorted ? (
              direction === "asc" ? (
                <ArrowUp size={13} className="text-[#1E433A]" strokeWidth={2.5} />
              ) : (
                <ArrowDown size={13} className="text-[#1E433A]" strokeWidth={2.5} />
              )
            ) : (
              <ArrowUpDown size={12} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            )}
          </span>
        </button>
        {info && <InfoTooltip content={info} title={label} />}
      </div>
    </th>
  );
}

const initialShift = { barista_id: '', shift_date: isoDate(), starts_at: '09:00', ends_at: '17:00', repeat: false, repeat_until: isoDate(30), repeat_weekdays: [weekdayForDate(isoDate())] };
const initialSideWork = { title: '', instructions: '', scheduled_date: isoDate(), scheduled_time: '14:00', repeat: false, repeat_until: isoDate(30), repeat_weekdays: [weekdayForDate(isoDate())] };
const initialSoundSettings = {
  volume_percent: 70,
  incoming_order_enabled: true,
  incoming_order_beeps: 4,
  incoming_order_style: 'two_tone',
  clock_in_beeps: 1,
  clock_in_style: 'short',
  clock_out_beeps: 2,
  clock_out_style: 'long',
  side_work_beeps: 3,
  side_work_style: 'two_tone'
};

const soundStyleLabels = {
  short: 'Short beep',
  long: 'Long beep',
  two_tone: 'Two-tone beep'
};

function previewBeeps(count, volumePercent, style) {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return;
  const context = new AudioContextConstructor();
  const volume = Math.max(0, Math.min(100, Number(volumePercent))) / 100;
  const interval = style === 'long' ? 0.76 : style === 'two_tone' ? 0.52 : 0.24;
  const scheduleTone = (startsAt, frequency, duration) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, startsAt);
    gain.gain.linearRampToValueAtTime(volume * 0.22, startsAt + 0.01);
    gain.gain.setValueAtTime(volume * 0.22, startsAt + Math.max(0.02, duration - 0.03));
    gain.gain.linearRampToValueAtTime(0, startsAt + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + 0.01);
  };
  Array.from({ length: Number(count) }, (_, index) => index).forEach((index) => {
    const startsAt = context.currentTime + index * interval;
    if (style === 'long') {
      scheduleTone(startsAt, 780, 0.65);
    } else if (style === 'two_tone') {
      scheduleTone(startsAt, 880, 0.16);
      scheduleTone(startsAt + 0.19, 660, 0.22);
    } else {
      scheduleTone(startsAt, 880, 0.14);
    }
  });
  window.setTimeout(() => void context.close(), Number(count) * interval * 1000 + 400);
}

function displayTime(value) {
  return value?.slice(0, 5) || '--:--';
}

function dateKey(value) {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : '';
}

function endsNextDay(startsAt, endsAt) {
  return displayTime(endsAt) < displayTime(startsAt);
}

function displayShiftTime(startsAt, endsAt, nextDay = endsNextDay(startsAt, endsAt)) {
  return `${displayTime(startsAt)} - ${displayTime(endsAt)}${nextDay ? ' (next day)' : ''}`;
}

const coverageColors = [
  'border-sky-200 bg-sky-50 text-sky-950',
  'border-violet-200 bg-violet-50 text-violet-950',
  'border-amber-200 bg-amber-50 text-amber-950',
  'border-emerald-200 bg-emerald-50 text-emerald-950',
  'border-rose-200 bg-rose-50 text-rose-950'
];

function minutesSinceMidnight(value) {
  const [hours, minutes] = displayTime(value).split(':').map(Number);
  return hours * 60 + minutes;
}

function coverageColorByShiftId(entries) {
  const colors = {};
  let colorIndex = -1;
  let currentCoverageEndsAt = -1;
  [...entries]
    .sort((left, right) => minutesSinceMidnight(left.starts_at) - minutesSinceMidnight(right.starts_at))
    .forEach((entry) => {
      const startsAt = minutesSinceMidnight(entry.starts_at);
      let endsAt = minutesSinceMidnight(entry.ends_at);
      if (endsAt <= startsAt) endsAt += 24 * 60;
      if (startsAt >= currentCoverageEndsAt) {
        colorIndex += 1;
        currentCoverageEndsAt = endsAt;
      } else {
        currentCoverageEndsAt = Math.max(currentCoverageEndsAt, endsAt);
      }
      colors[entry.id] = coverageColors[colorIndex % coverageColors.length];
    });
  return colors;
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

function weekdayForDate(value) {
  const day = new Date(`${value}T12:00:00+08:00`).getUTCDay();
  return day === 0 ? 7 : day;
}

function datesForRepeat(startDate, endDate, weekdays) {
  const selected = new Set(weekdays.map(Number));
  return planningDates().filter((date) => date >= startDate && date <= endDate && selected.has(weekdayForDate(date)));
}

const weekdayOptions = [
  [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']
];

function displayDate(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

const attendanceLabel = (status) => ({ completed: 'Completed', late: 'Late arrival', clocked_in: 'Clocked in', clocked_in_late: 'Clocked in late', missing_clock_out: 'Missing clock-out', missed_clock_in: 'Missed clock-in', unscheduled: 'No shift planned' })[status] || status;

export default function Operations() {
  const [activeTab, setActiveTab] = useState('timetable');
  const [baristas, setBaristas] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [scheduleRevision, setScheduleRevision] = useState(0);
  const [attendance, setAttendance] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({ active_now: 0, late_arrivals: 0, missing_clock_out: 0, missed_clock_in: 0 });
  const [attendanceFrom, setAttendanceFrom] = useState(isoDate(-29));
  const [attendanceTo, setAttendanceTo] = useState(isoDate());
  const [attendanceBaristaId, setAttendanceBaristaId] = useState('');
  const [attendanceSortKey, setAttendanceSortKey] = useState('date');
  const [attendanceSortDirection, setAttendanceSortDirection] = useState('desc');

  const handleAttendanceSort = (key) => {
    if (attendanceSortKey === key) {
      setAttendanceSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setAttendanceSortKey(key);
      setAttendanceSortDirection(key === 'date' ? 'desc' : 'asc');
    }
  };

  const sortedAttendance = useMemo(() => {
    const list = [...attendance];
    list.sort((a, b) => {
      let aVal = a[attendanceSortKey];
      let bVal = b[attendanceSortKey];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      if (aVal < bVal) return attendanceSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return attendanceSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [attendance, attendanceSortKey, attendanceSortDirection]);
  const [shiftForm, setShiftForm] = useState(initialShift);
  const [sideWork, setSideWork] = useState([]);
  const [sideWorkForm, setSideWorkForm] = useState(initialSideWork);
  const [savingSideWork, setSavingSideWork] = useState(false);
  const [soundOutlets, setSoundOutlets] = useState([]);
  const [selectedSoundStoreId, setSelectedSoundStoreId] = useState('');
  const [soundForm, setSoundForm] = useState(initialSoundSettings);
  const [savingSound, setSavingSound] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [operations, baristaResponse, sideWorkResponse, soundResponse] = await Promise.all([
        loadAdminOperationalSetup(),
        adminRequest('/v1/admin/baristas'),
        adminRequest(`/v1/admin/side-work?from=${isoDate()}&to=${isoDate(30)}`),
        adminRequest('/v1/admin/barista-sound-settings')
      ]);
      setSchedule((operations.scheduled_shifts || []).map((shift) => ({
        ...shift,
        shift_date: dateKey(shift.shift_date)
      })));
      setScheduleRevision(Number(operations.schedule_revision || 0));
      setBaristas((baristaResponse.baristas || []).filter((barista) => barista.is_active));
      setSideWork(Array.isArray(sideWorkResponse.tasks) ? sideWorkResponse.tasks : []);
      const outlets = Array.isArray(soundResponse.outlets) ? soundResponse.outlets : [];
      setSoundOutlets(outlets);
      const selected = outlets.find((outlet) => String(outlet.store_id) === String(selectedSoundStoreId)) || outlets[0];
      if (selected) {
        setSelectedSoundStoreId(String(selected.store_id));
        setSoundForm({
          volume_percent: Number(selected.volume_percent),
          incoming_order_enabled: selected.incoming_order_enabled !== false && Number(selected.incoming_order_enabled) !== 0,
          incoming_order_beeps: Number(selected.incoming_order_beeps || 4),
          incoming_order_style: selected.incoming_order_style || 'two_tone',
          clock_in_beeps: Number(selected.clock_in_beeps),
          clock_in_style: selected.clock_in_style || 'short',
          clock_out_beeps: Number(selected.clock_out_beeps),
          clock_out_style: selected.clock_out_style || 'long',
          side_work_beeps: Number(selected.side_work_beeps),
          side_work_style: selected.side_work_style || 'two_tone'
        });
      }
    } catch (loadError) {
      setError(loadError.message || 'Unable to load operations setup.');
    } finally {
      setLoading(false);
    }
  }, [selectedSoundStoreId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    if (shiftForm.ends_at === shiftForm.starts_at) {
      setError('Start and end time cannot be the same. An earlier end time means the shift finishes the next day.');
      return;
    }

    const barista = baristas.find((item) => Number(item.id) === baristaId);
    if (!planningDates().includes(shiftForm.shift_date)) {
      setError('Choose a date from today through the next 30 days.');
      return;
    }
    const dates = shiftForm.repeat
      ? datesForRepeat(shiftForm.shift_date, shiftForm.repeat_until, shiftForm.repeat_weekdays)
      : [shiftForm.shift_date];
    if (shiftForm.repeat && dates.length === 0) {
      setError('Choose at least one weekday within the repeat period.');
      return;
    }
    const duplicate = dates.some((date) => schedule.some((item) => Number(item.barista_id) === baristaId
      && item.shift_date === date
      && displayTime(item.starts_at) === shiftForm.starts_at));
    if (duplicate) {
      setError('This barista already has a shift with the same start time.');
      return;
    }

    setSchedule((current) => [...current, ...dates.map((date) => ({
      id: `draft-${Date.now()}-${date}-${Math.random().toString(36).slice(2, 7)}`,
      barista_id: baristaId,
      barista_name: barista?.name || 'Barista',
      shift_date: date,
      starts_at: shiftForm.starts_at,
      ends_at: shiftForm.ends_at,
      is_active: true
    }))]);
    setNotice(shiftForm.repeat ? `Added ${dates.length} repeated shifts.` : 'Shift added.');
    setShiftForm({ ...initialShift, shift_date: selectedDate || shiftForm.shift_date, repeat_weekdays: [weekdayForDate(selectedDate || shiftForm.shift_date)] });
  };

  const openShiftEditor = (date) => {
    setSelectedDate(date);
    setShiftForm({ ...initialShift, shift_date: date, repeat_until: isoDate(30), repeat_weekdays: [weekdayForDate(date)] });
    setError('');
    setNotice('');
  };

  const removeShift = (id) => {
    setSchedule((current) => current.filter((entry) => entry.id !== id));
    setNotice('');
  };

  const addSideWork = async (event) => {
    event.preventDefault();
    setSavingSideWork(true);
    setError('');
    setNotice('');
    try {
      const dates = sideWorkForm.repeat
        ? datesForRepeat(sideWorkForm.scheduled_date, sideWorkForm.repeat_until, sideWorkForm.repeat_weekdays)
        : [sideWorkForm.scheduled_date];
      if (sideWorkForm.repeat && dates.length === 0) {
        throw new Error('Choose at least one weekday within the repeat period.');
      }
      const result = await createAdminSideWorkBatch({
        title: sideWorkForm.title,
        instructions: sideWorkForm.instructions || null,
        scheduled_dates: dates,
        scheduled_time: sideWorkForm.scheduled_time
      });
      setSideWorkForm({ ...initialSideWork, scheduled_date: sideWorkForm.scheduled_date, repeat_weekdays: [weekdayForDate(sideWorkForm.scheduled_date)] });
      const saved = Number(result?.saved || 0);
      const skipped = Number(result?.skipped || 0);
      setNotice(`${saved} side-work task${saved === 1 ? '' : 's'} scheduled${skipped > 0 ? `; ${skipped} existing duplicate${skipped === 1 ? ' was' : 's were'} skipped` : ''}.`);
      await loadData();
    } catch (saveError) {
      setError(saveError.message || 'Unable to schedule side work.');
    } finally {
      setSavingSideWork(false);
    }
  };

  const removeSideWork = async (taskId) => {
    setError('');
    setNotice('');
    try {
      await adminRequest(`/v1/admin/side-work/${taskId}`, { method: 'DELETE' });
      setSideWork((current) => current.filter((task) => Number(task.id) !== Number(taskId)));
      setNotice('Side-work task removed.');
    } catch (deleteError) {
      setError(deleteError.message || 'Unable to remove the side-work task.');
    }
  };

  const chooseSoundOutlet = (storeId) => {
    setSelectedSoundStoreId(storeId);
    const outlet = soundOutlets.find((item) => String(item.store_id) === String(storeId));
    if (outlet) setSoundForm({
      volume_percent: Number(outlet.volume_percent),
      incoming_order_enabled: outlet.incoming_order_enabled !== false && Number(outlet.incoming_order_enabled) !== 0,
      incoming_order_beeps: Number(outlet.incoming_order_beeps || 4),
      incoming_order_style: outlet.incoming_order_style || 'two_tone',
      clock_in_beeps: Number(outlet.clock_in_beeps),
      clock_in_style: outlet.clock_in_style || 'short',
      clock_out_beeps: Number(outlet.clock_out_beeps),
      clock_out_style: outlet.clock_out_style || 'long',
      side_work_beeps: Number(outlet.side_work_beeps),
      side_work_style: outlet.side_work_style || 'two_tone'
    });
  };

  const saveSoundSettings = async (event) => {
    event.preventDefault();
    const patterns = [soundForm.incoming_order_beeps, soundForm.clock_in_beeps, soundForm.clock_out_beeps, soundForm.side_work_beeps].map(Number);
    if (new Set(patterns).size !== patterns.length) {
      setError('Use a different beep count for incoming orders, clock-in, clock-out, and side work.');
      setNotice('');
      return;
    }
    setSavingSound(true);
    setError('');
    setNotice('');
    try {
      await adminRequest(`/v1/admin/barista-sound-settings/${selectedSoundStoreId}`, {
        method: 'PUT',
        body: JSON.stringify({
          volume_percent: Number(soundForm.volume_percent),
          incoming_order_enabled: Boolean(soundForm.incoming_order_enabled),
          incoming_order_beeps: Number(soundForm.incoming_order_beeps),
          incoming_order_style: soundForm.incoming_order_style,
          clock_in_beeps: Number(soundForm.clock_in_beeps),
          clock_in_style: soundForm.clock_in_style,
          clock_out_beeps: Number(soundForm.clock_out_beeps),
          clock_out_style: soundForm.clock_out_style,
          side_work_beeps: Number(soundForm.side_work_beeps),
          side_work_style: soundForm.side_work_style
        })
      });
      setSoundOutlets((current) => current.map((outlet) => String(outlet.store_id) === String(selectedSoundStoreId) ? { ...outlet, ...soundForm } : outlet));
      setNotice('Barista beep patterns saved. The C2 Store device will receive them automatically.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the barista beep patterns.');
    } finally {
      setSavingSound(false);
    }
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
      const result = await saveAdminShiftSchedule(entries, scheduleRevision);
      if (Number(result?.saved) !== entries.length) {
        throw new Error('The timetable could not be confirmed. No changes were published.');
      }
      setScheduleRevision(Number(result.schedule_revision ?? scheduleRevision + 1));
      setNotice(`Timetable published for the next 31 days with ${entries.length} shift${entries.length === 1 ? '' : 's'}.`);
      await loadData();
    } catch (saveError) {
      setError(saveError.message || 'Unable to publish the weekly timetable.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const groupedSchedule = planningDates().map((date) => {
    const entries = schedule
      .filter((entry) => entry.shift_date === date)
      .sort((left, right) => displayTime(left.starts_at).localeCompare(displayTime(right.starts_at)));
    return { date, label: displayDate(date), entries, colors: coverageColorByShiftId(entries) };
  });
  return (
    <div className="flex-1 overflow-y-auto bg-[#F9FAFB]">
      <div className="mx-auto w-full max-w-7xl p-6 lg:p-8">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5C867F]">Store operations</p>
              <InfoTooltip content="Timetable scheduling, side work checklists, sound beeps, and attendance records." title="Store Operations" />
            </div>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Store operations</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">Publish the weekly staffing plan and review attendance. Receipt printers are set up directly on each Android C2 Store device.</p>
          </div>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer shadow-2xs">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto border-b border-slate-200">
          <button type="button" onClick={() => selectTab('timetable')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'timetable' ? 'border-[#2E5E58] text-[#2E5E58]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <CalendarDays size={17} /> Timetable
          </button>
          <button type="button" onClick={() => selectTab('attendance')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'attendance' ? 'border-[#2E5E58] text-[#2E5E58]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Clock3 size={17} /> Attendance
          </button>
          <button type="button" onClick={() => selectTab('side-work')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'side-work' ? 'border-[#2E5E58] text-[#2E5E58]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <ClipboardCheck size={17} /> Side work
          </button>
          <button type="button" onClick={() => selectTab('sounds')} className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold ${activeTab === 'sounds' ? 'border-[#2E5E58] text-[#2E5E58]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Volume2 size={17} /> Sounds
          </button>
        </div>

        {(error || notice) && <div className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {error ? <CircleAlert size={18} className="mt-0.5 shrink-0" /> : <Check size={18} className="mt-0.5 shrink-0" />}
          <span>{error || notice}</span>
        </div>}

        {activeTab === 'timetable' && <section className="mt-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-lg font-bold text-slate-900">Next 31 days</h2><p className="mt-1 text-sm text-slate-500">Click a date to add a shift. Matching colours mean those baristas are working at the same time.</p></div>
              <button type="button" onClick={() => void publishSchedule()} disabled={savingSchedule || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#142b26] disabled:opacity-50">
                <Save size={16} /> {savingSchedule ? 'Publishing...' : 'Publish timetable'}
              </button>
            </div>
            {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading timetable...</p> : <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {groupedSchedule.map((day) => <div key={day.date} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <button type="button" onClick={() => openShiftEditor(day.date)} className="flex w-full items-center justify-between text-left"><span className="text-sm font-bold text-slate-800">{day.label}</span><span className="rounded-md bg-white px-2 py-1 text-xs font-bold text-[#2E5E58] shadow-sm">+ Add shift</span></button>
                {day.entries.length === 0 ? <button type="button" onClick={() => openShiftEditor(day.date)} className="mt-3 w-full rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-sm text-slate-400 hover:border-[#5C867F] hover:text-[#2E5E58]">No shift planned</button> : <div className="mt-3 space-y-2">
                  {day.entries.map((entry) => <div key={entry.id} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 shadow-sm ${day.colors[entry.id]}`}>
                    <div><p className="text-sm font-bold">{entry.barista_name}</p><p className="text-xs opacity-75">{displayShiftTime(entry.starts_at, entry.ends_at)}</p></div>
                    <button type="button" onClick={() => removeShift(entry.id)} className="rounded-lg p-1.5 opacity-60 hover:bg-white hover:text-red-600 hover:opacity-100" aria-label={`Remove ${entry.barista_name} shift`}><Trash2 size={16} /></button>
                  </div>)}
                </div>}
              </div>)}
            </div>}
          </div>
          {selectedDate && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="add-shift-title">
              <form onSubmit={addShift} className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-gray-100 my-auto animate-in zoom-in-95 duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5C867F]">Timetable</p>
                    <div className="flex items-center gap-2 mt-1">
                      <h2 id="add-shift-title" className="text-xl font-bold text-slate-900">Add shift for {displayDate(selectedDate)}</h2>
                      <InfoTooltip content="Assign a barista to work between selected hours. Shifts extending past midnight are treated as next day." title="Add Shift" />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">An earlier end time means the shift finishes the next day.</p>
                  </div>
                  <button type="button" onClick={() => setSelectedDate(null)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer" aria-label="Close add shift">
                    <X size={20} />
                  </button>
                </div>
                {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                <label className="mt-6 block text-sm font-bold text-slate-700">
                  Barista
                  <select value={shiftForm.barista_id} onChange={(event) => setShiftForm((current) => ({ ...current, barista_id: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" required>
                    <option value="">Choose barista</option>
                    {baristas.map((barista) => <option key={barista.id} value={barista.id}>{barista.name}</option>)}
                  </select>
                </label>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label className="block text-sm font-bold text-slate-700">
                    Starts
                    <input type="time" value={shiftForm.starts_at} onChange={(event) => setShiftForm((current) => ({ ...current, starts_at: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" required />
                  </label>
                  <label className="block text-sm font-bold text-slate-700">
                    Ends
                    <input type="time" value={shiftForm.ends_at} onChange={(event) => setShiftForm((current) => ({ ...current, ends_at: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" required />
                  </label>
                </div>
                <label className="mt-5 flex items-start gap-3 rounded-xl border border-[#CFE3DE] bg-[#F4FAF8] p-3 text-sm text-slate-700">
                  <input type="checkbox" checked={shiftForm.repeat} onChange={(event) => setShiftForm((current) => ({ ...current, repeat: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#2E5E58]" />
                  <span><span className="font-bold">Repeat on selected weekdays</span><span className="mt-1 block text-xs text-slate-500">Creates the same shift from the selected date through the next 30 days.</span></span>
                </label>
                {shiftForm.repeat && <div className="mt-3 rounded-xl border border-slate-200 p-3">
                  <label className="block text-sm font-bold text-slate-700">Repeat until<input type="date" min={shiftForm.shift_date} max={isoDate(30)} value={shiftForm.repeat_until} onChange={(event) => setShiftForm((current) => ({ ...current, repeat_until: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Weekdays</p>
                  <div className="mt-2 flex flex-wrap gap-2">{weekdayOptions.map(([value, label]) => <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-bold ${shiftForm.repeat_weekdays.includes(value) ? 'border-[#2E5E58] bg-[#E7F3EF] text-[#1F3A34]' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={shiftForm.repeat_weekdays.includes(value)} onChange={(event) => setShiftForm((current) => ({ ...current, repeat_weekdays: event.target.checked ? [...current.repeat_weekdays, value] : current.repeat_weekdays.filter((day) => day !== value) }))} className="sr-only" />{label}</label>)}</div>
                </div>}
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setSelectedDate(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer">
                    Close
                  </button>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-[#2E5E58] hover:bg-[#244B46] px-5 py-2.5 text-sm font-bold text-white shadow-xs cursor-pointer">
                    <Plus size={17} /> Add shift
                  </button>
                </div>
              </form>
            </div>,
            document.body
          )}
        </section>}

        {activeTab === 'side-work' && <section className="mt-6 grid gap-5 xl:grid-cols-[380px_1fr]">
          <form onSubmit={addSideWork} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
            <h2 className="text-lg font-bold text-slate-900">Schedule side work</h2>
            <p className="mt-1 text-sm text-slate-500">Create timed cleaning and upkeep reminders for the barista team.</p>
            <label className="mt-5 block text-sm font-bold text-slate-700">Task name<input required maxLength="120" value={sideWorkForm.title} onChange={(event) => setSideWorkForm((current) => ({ ...current, title: event.target.value }))} placeholder="Mop the service floor" className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" /></label>
            <label className="mt-4 block text-sm font-bold text-slate-700">Instructions<textarea maxLength="500" rows="4" value={sideWorkForm.instructions} onChange={(event) => setSideWorkForm((current) => ({ ...current, instructions: event.target.value }))} placeholder="Include the area, supplies, and completion standard." className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2E5E58]" /></label>
            <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm font-bold text-slate-700">Start date<input required type="date" min={isoDate()} max={isoDate(30)} value={sideWorkForm.scheduled_date} onChange={(event) => setSideWorkForm((current) => ({ ...current, scheduled_date: event.target.value, repeat_weekdays: [weekdayForDate(event.target.value)] }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label><label className="text-sm font-bold text-slate-700">Time<input required type="time" value={sideWorkForm.scheduled_time} onChange={(event) => setSideWorkForm((current) => ({ ...current, scheduled_time: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label></div>
            <label className="mt-5 flex items-start gap-3 rounded-xl border border-[#CFE3DE] bg-[#F4FAF8] p-3 text-sm text-slate-700"><input type="checkbox" checked={sideWorkForm.repeat} onChange={(event) => setSideWorkForm((current) => ({ ...current, repeat: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#2E5E58]" /><span><span className="font-bold">Repeat on selected weekdays</span><span className="mt-1 block text-xs text-slate-500">Creates the same task from the start date through the next 30 days.</span></span></label>
            {sideWorkForm.repeat && <div className="mt-3 rounded-xl border border-slate-200 p-3"><label className="block text-sm font-bold text-slate-700">Repeat until<input type="date" min={sideWorkForm.scheduled_date} max={isoDate(30)} value={sideWorkForm.repeat_until} onChange={(event) => setSideWorkForm((current) => ({ ...current, repeat_until: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></label><p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Weekdays</p><div className="mt-2 flex flex-wrap gap-2">{weekdayOptions.map(([value, label]) => <label key={value} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm font-bold ${sideWorkForm.repeat_weekdays.includes(value) ? 'border-[#2E5E58] bg-[#E7F3EF] text-[#1F3A34]' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={sideWorkForm.repeat_weekdays.includes(value)} onChange={(event) => setSideWorkForm((current) => ({ ...current, repeat_weekdays: event.target.checked ? [...current.repeat_weekdays, value] : current.repeat_weekdays.filter((day) => day !== value) }))} className="sr-only" />{label}</label>)}</div></div>}
            <button disabled={savingSideWork} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F3A34] hover:bg-[#2E5E58] px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"><Plus size={17} />{savingSideWork ? 'Scheduling...' : 'Schedule task'}</button>
          </form>
          <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
            <div><h2 className="text-lg font-bold text-slate-900">Next 31 days</h2><p className="mt-1 text-sm text-slate-500">Completion is recorded against the clocked-in barista who confirms the task.</p></div>
            <div className="mt-5 space-y-3">{sideWork.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">No side work scheduled.</p> : sideWork.map((task) => <div key={task.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-shadow bg-white"><div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-900">{task.title}</p>{task.completed_at && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Completed by {task.completed_by_barista_name}</span>}</div><p className="mt-1 text-sm font-semibold text-[#2E5E58]">{displayDate(task.scheduled_date)} at {displayTime(task.scheduled_time)}</p>{task.instructions && <p className="mt-2 text-sm leading-6 text-slate-600">{task.instructions}</p>}</div><button type="button" onClick={() => void removeSideWork(task.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer" aria-label={`Remove ${task.title}`}><Trash2 size={17} /></button></div>)}</div>
          </article>
        </section>}

        {activeTab === 'sounds' && <section className="mt-6">
          <form onSubmit={saveSoundSettings} className="max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F0F8F6] text-[#1F3A34]"><Volume2 size={22} /></div><div><h2 className="text-lg font-bold text-slate-900">Barista beep patterns</h2><p className="mt-1 text-sm leading-6 text-slate-500">Configure the sound played on the C2 Store device when a new order is claimed for printing, plus clock-in, clock-out, and side-work reminders. The printer still prints at the same time. The tablet's media volume remains the final hardware limit.</p></div></div>
            <label className="mt-6 block text-sm font-bold text-slate-700">Outlet<select value={selectedSoundStoreId} onChange={(event) => chooseSoundOutlet(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" disabled={!soundOutlets.length}>{soundOutlets.map((outlet) => <option key={outlet.store_id} value={outlet.store_id}>{outlet.store_name}</option>)}</select></label>
            <label className="mt-5 block text-sm font-bold text-slate-700"><span className="flex items-center justify-between"><span>Beep volume</span><span className="text-[#2E5E58]">{soundForm.volume_percent}%</span></span><input type="range" min="0" max="100" step="5" value={soundForm.volume_percent} onChange={(event) => setSoundForm((current) => ({ ...current, volume_percent: Number(event.target.value) }))} className="mt-3 w-full accent-[#2E5E58]" /></label>
            <label className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><input type="checkbox" checked={Boolean(soundForm.incoming_order_enabled)} onChange={(event) => setSoundForm((current) => ({ ...current, incoming_order_enabled: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#2E5E58]" /><span><span className="font-bold">Beep when an incoming order prints</span><span className="mt-1 block text-xs leading-5 text-amber-800">The beep and printer job start together when the device claims a new order.</span></span></label>
            <div className="mt-6 grid gap-4 md:grid-cols-2">{[
              ['Incoming order', 'incoming_order_beeps', 'incoming_order_style'],
              ['Clock in', 'clock_in_beeps', 'clock_in_style'],
              ['Clock out', 'clock_out_beeps', 'clock_out_style'],
              ['Side work due', 'side_work_beeps', 'side_work_style']
            ].map(([label, countKey, styleKey]) => <div key={countKey} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-bold text-slate-800">{label}</p><label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sound style<select value={soundForm[styleKey]} onChange={(event) => setSoundForm((current) => ({ ...current, [styleKey]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-800">{Object.entries(soundStyleLabels).map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}</select></label><label className="mt-3 block text-xs font-semibold uppercase tracking-wide text-slate-500">Repeat<select value={soundForm[countKey]} onChange={(event) => setSoundForm((current) => ({ ...current, [countKey]: Number(event.target.value) }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-800">{[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count} time{count === 1 ? '' : 's'}</option>)}</select></label><button type="button" onClick={() => previewBeeps(soundForm[countKey], soundForm.volume_percent, soundForm[styleKey])} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#5C867F] px-3 py-2 text-sm font-bold text-[#2E5E58] hover:bg-white cursor-pointer"><Volume2 size={15} /> Preview</button></div>)}</div>
            <p className="mt-4 text-xs leading-5 text-slate-500">Each event must use a different count so staff can identify it without looking at the screen. Setting volume to 0% mutes all patterns, including incoming-order alerts.</p>
            <button type="submit" disabled={savingSound || !selectedSoundStoreId} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1F3A34] hover:bg-[#2E5E58] px-5 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"><Save size={16} />{savingSound ? 'Saving...' : 'Save beep patterns'}</button>
          </form>
        </section>}

        {activeTab === 'attendance' && <section className="mt-6 space-y-5">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-lg font-bold text-slate-900">Attendance history</h2><p className="mt-1 text-sm text-slate-500">Compare server-recorded clock-ins and clock-outs with shifts published on or before each date. A current open shift is not marked as a missing clock-out.</p></div><div className="flex flex-wrap gap-3"><input type="date" value={attendanceFrom} onChange={(event) => setAttendanceFrom(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><input type="date" value={attendanceTo} onChange={(event) => setAttendanceTo(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><select value={attendanceBaristaId} onChange={(event) => setAttendanceBaristaId(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">All baristas</option>{baristas.map((barista) => <option key={barista.id} value={barista.id}>{barista.name}</option>)}</select><button type="button" onClick={() => void loadAttendance()} className="inline-flex items-center gap-2 rounded-xl bg-[#2E5E58] hover:bg-[#244B46] px-4 py-2 text-sm font-bold text-white transition-colors cursor-pointer shadow-xs"><RefreshCw size={16} /> Load</button></div></div></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Working now', value: attendanceSummary.active_now, color: 'bg-emerald-50 text-emerald-700', info: 'Baristas currently clocked in at the physical workstation.' },
              { label: 'Late arrivals', value: attendanceSummary.late_arrivals, color: 'bg-amber-50 text-amber-700', info: 'Clock-ins recorded after the scheduled shift start time.' },
              { label: 'Missing clock-out', value: attendanceSummary.missing_clock_out, color: 'bg-red-50 text-red-700', info: 'Shifts past scheduled end time with no recorded sign-out.' },
              { label: 'Missed clock-in', value: attendanceSummary.missed_clock_in, color: 'bg-red-50 text-red-700', info: 'Scheduled shifts where the barista never clocked in.' }
            ].map(({ label, value, color, info }) => (
              <div key={label} className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-2xs hover:shadow-xs transition-shadow">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-slate-500">{label}</p>
                  <InfoTooltip content={info} title={label} />
                </div>
                <p className={`mt-2 inline-flex rounded-xl px-3.5 py-1 text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-200/80 bg-white shadow-2xs">
            <table className="min-w-[850px] w-full text-left text-sm">
              <thead className="bg-slate-50/95 backdrop-blur-sm border-b border-gray-200">
                <tr>
                  <SortableHeader label="Date" columnKey="date" currentKey={attendanceSortKey} direction={attendanceSortDirection} onSort={handleAttendanceSort} info="Date of shift or attendance event" />
                  <SortableHeader label="Barista" columnKey="barista_name" currentKey={attendanceSortKey} direction={attendanceSortDirection} onSort={handleAttendanceSort} info="Barista profile name" />
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wide text-slate-500">Planned</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wide text-slate-500">Actual</th>
                  <SortableHeader label="Duration" columnKey="duration_minutes" currentKey={attendanceSortKey} direction={attendanceSortDirection} onSort={handleAttendanceSort} info="Total clocked duration on workstation" />
                  <SortableHeader label="Status" columnKey="status" currentKey={attendanceSortKey} direction={attendanceSortDirection} onSort={handleAttendanceSort} info="Punctuality and completion status" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAttendance.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center text-slate-500">
                      Choose a date range and load attendance history.
                    </td>
                  </tr>
                ) : (
                  sortedAttendance.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-800">{record.date}</td>
                      <td className="px-5 py-4 font-semibold text-gray-900">{record.barista_name}</td>
                      <td className="px-5 py-4 text-slate-600">{record.planned_start ? displayShiftTime(record.planned_start, record.planned_end, record.planned_ends_next_day) : 'No shift planned'}</td>
                      <td className="px-5 py-4 text-slate-600">{record.clocked_in_at ? `${new Date(record.clocked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${record.clocked_out_at ? new Date(record.clocked_out_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Open'}` : '--'}</td>
                      <td className="px-5 py-4 font-medium text-slate-700">{record.duration_minutes == null ? '--' : `${Math.floor(record.duration_minutes / 60)}h ${record.duration_minutes % 60}m`}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          record.status === 'completed' || record.status === 'clocked_in'
                            ? 'bg-emerald-50 text-emerald-700'
                            : record.status === 'clocked_in_late' || record.status === 'late'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {attendanceLabel(record.status)}{record.late_minutes ? ` (${record.late_minutes}m)` : ''}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>}
      </div>
    </div>
  );
}
