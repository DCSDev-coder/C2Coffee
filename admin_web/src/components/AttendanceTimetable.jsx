import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';

const STAFF_PALETTE = [
  { bg: 'bg-[#1F5E4B]/10', border: 'border-[#1F5E4B]/25', text: 'text-[#1F5E4B]', avatar: 'bg-[#1F5E4B]/15 text-[#1F5E4B]' },
  { bg: 'bg-[#1E5F8A]/10', border: 'border-[#1E5F8A]/25', text: 'text-[#1E5F8A]', avatar: 'bg-[#1E5F8A]/15 text-[#1E5F8A]' },
  { bg: 'bg-[#8C5A1E]/10', border: 'border-[#8C5A1E]/25', text: 'text-[#8C5A1E]', avatar: 'bg-[#8C5A1E]/15 text-[#8C5A1E]' },
  { bg: 'bg-[#6B3E8E]/10', border: 'border-[#6B3E8E]/25', text: 'text-[#6B3E8E]', avatar: 'bg-[#6B3E8E]/15 text-[#6B3E8E]' },
  { bg: 'bg-[#9E3B42]/10', border: 'border-[#9E3B42]/25', text: 'text-[#9E3B42]', avatar: 'bg-[#9E3B42]/15 text-[#9E3B42]' },
  { bg: 'bg-[#2E6F6D]/10', border: 'border-[#2E6F6D]/25', text: 'text-[#2E6F6D]', avatar: 'bg-[#2E6F6D]/15 text-[#2E6F6D]' }
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toLocalIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(iso) {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function mondayOf(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatShortDate(date) {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

function formatTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMinutes(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return '--';
  const total = Math.max(0, Math.round(Number(minutes)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function isNeedsReview(record) {
  return record.status === 'needs_review' || record.status === 'missing_clock_out';
}

export default function AttendanceTimetable({ attendance = [], attendanceByDate = [] }) {
  const [viewMode, setViewMode] = useState('timetable');
  const [selectedBarista, setSelectedBarista] = useState('');
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));

  const baristas = useMemo(
    () => [...new Set(attendance.map((r) => r.barista_name).filter(Boolean))].sort(),
    [attendance]
  );

  // Snap to the latest record's week if the current week has no records
  useEffect(() => {
    if (!attendance.length) return;
    const currentMon = mondayOf(new Date());
    const currentSun = addDays(currentMon, 6);
    const currentMonIso = toLocalIsoDate(currentMon);
    const currentSunIso = toLocalIsoDate(currentSun);
    const hasCurrentWeek = attendance.some((r) => r.date >= currentMonIso && r.date <= currentSunIso);
    if (hasCurrentWeek) {
      setWeekStart(currentMon);
      return;
    }
    const latestIso = attendance.reduce((max, r) => (r.date > max ? r.date : max), '');
    const latestDate = parseIsoDate(latestIso);
    if (latestDate) setWeekStart(mondayOf(latestDate));
  }, [attendance]);

  const effectiveBarista = selectedBarista && baristas.includes(selectedBarista) ? selectedBarista : '';
  const visibleBaristas = effectiveBarista ? [effectiveBarista] : baristas;

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const todayIso = toLocalIsoDate(new Date());
  const currentMonIso = toLocalIsoDate(mondayOf(new Date()));
  const isCurrentWeek = toLocalIsoDate(weekStart) === currentMonIso;

  const grouped = useMemo(() => {
    const map = new Map();
    const firstIso = toLocalIsoDate(weekDays[0]);
    const lastIso = toLocalIsoDate(weekDays[6]);
    attendance.forEach((record) => {
      if (!record.date || record.date < firstIso || record.date > lastIso) return;
      if (!map.has(record.barista_name)) map.set(record.barista_name, new Map());
      const dayMap = map.get(record.barista_name);
      if (!dayMap.has(record.date)) dayMap.set(record.date, []);
      dayMap.get(record.date).push(record);
    });
    map.forEach((dayMap) => {
      dayMap.forEach((list) => {
        list.sort((a, b) => String(a.clocked_in_at || '').localeCompare(String(b.clocked_in_at || '')));
      });
    });
    return map;
  }, [attendance, weekDays]);

  const filteredByDate = useMemo(() => {
    if (!effectiveBarista) return attendanceByDate;
    return attendanceByDate
      .map(([date, records]) => [date, records.filter((r) => r.barista_name === effectiveBarista)])
      .filter(([, records]) => records.length > 0);
  }, [attendanceByDate, effectiveBarista]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Timetable</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Weekly shift schedule by barista and day.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setViewMode('timetable')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'timetable'
                  ? 'bg-[#1F3A34] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid size={14} /> Timetable
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-[#1F3A34] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays size={14} /> Daily cards
            </button>
          </div>

          {viewMode === 'timetable' && (
            <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-1.5 py-1">
              <button
                type="button"
                onClick={() => setWeekStart((prev) => addDays(prev, -7))}
                className="rounded-lg p-1 text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer"
                title="Previous week"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 text-xs font-extrabold text-[#1F3A34]">
                {formatShortDate(weekDays[0])} – {formatShortDate(weekDays[6])}
              </span>
              <button
                type="button"
                onClick={() => setWeekStart((prev) => addDays(prev, 7))}
                className="rounded-lg p-1 text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer"
                title="Next week"
              >
                <ChevronRight size={16} />
              </button>
              {!isCurrentWeek && (
                <button
                  type="button"
                  onClick={() => setWeekStart(mondayOf(new Date()))}
                  className="ml-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#2E5E58] border border-slate-200 hover:bg-slate-100 cursor-pointer"
                >
                  Today
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {baristas.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedBarista('')}
            className={`rounded-full px-3 py-1 text-xs font-bold border transition-colors cursor-pointer ${
              effectiveBarista === ''
                ? 'border-[#1F3A34] bg-[#1F3A34] text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            All staff
          </button>
          {baristas.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedBarista((prev) => (prev === name ? '' : name))}
              className={`rounded-full px-3 py-1 text-xs font-bold border transition-colors cursor-pointer ${
                effectiveBarista === name
                  ? 'border-[#1F3A34] bg-[#1F3A34] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {attendance.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
          No attendance records in the selected range.
        </div>
      ) : viewMode === 'timetable' ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[920px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="w-[180px] px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Barista
                </th>
                {weekDays.map((day, idx) => {
                  const iso = toLocalIsoDate(day);
                  const isToday = iso === todayIso;
                  return (
                    <th
                      key={iso}
                      className={`border-l border-slate-200 px-3 py-2.5 text-center ${
                        isToday ? 'bg-[#1F3A34]/8' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`text-xs font-extrabold ${isToday ? 'text-[#1F3A34]' : 'text-slate-500'}`}>
                          {WEEKDAYS[idx]}
                        </span>
                        {isToday && (
                          <span className="rounded-full bg-[#1F3A34] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                            Today
                          </span>
                        )}
                      </div>
                      <div className={`mt-0.5 text-xs font-bold ${isToday ? 'text-[#1F3A34]' : 'text-slate-800'}`}>
                        {formatShortDate(day)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleBaristas.map((name) => {
                const palette = STAFF_PALETTE[baristas.indexOf(name) % STAFF_PALETTE.length];
                const dayMap = grouped.get(name) || new Map();
                const weekRecords = [...dayMap.values()].flat();
                const weeklyMinutes = weekRecords.reduce(
                  (sum, r) => sum + (Number.isFinite(Number(r.duration_minutes)) ? Number(r.duration_minutes) : 0),
                  0
                );
                const hasActive = weekRecords.some((r) => !r.clocked_out_at && !isNeedsReview(r));

                return (
                  <tr key={name} className="align-top">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${palette.avatar}`}>
                          {name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-bold text-slate-900">{name}</span>
                            {hasActive && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="Currently clocked in" />
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-500">
                            {weekRecords.length === 0 ? 'No shifts' : formatMinutes(weeklyMinutes)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {weekDays.map((day) => {
                      const iso = toLocalIsoDate(day);
                      const isToday = iso === todayIso;
                      const shifts = dayMap.get(iso) || [];

                      return (
                        <td
                          key={iso}
                          className={`border-l border-slate-200 p-2 align-middle ${
                            isToday ? 'bg-[#1F3A34]/[0.03]' : 'bg-white'
                          }`}
                        >
                          {shifts.length === 0 ? (
                            <div className="py-2 text-center text-xs font-bold text-slate-300">—</div>
                          ) : (
                            <div className="space-y-1.5">
                              {shifts.map((record) => {
                                const review = isNeedsReview(record);
                                const active = !record.clocked_out_at && !review;
                                const pillClasses = review
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : active
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : `${palette.border} ${palette.bg} ${palette.text}`;

                                return (
                                  <div
                                    key={record.id}
                                    className={`rounded-lg border px-2 py-1.5 ${pillClasses}`}
                                  >
                                    <div className="flex items-center gap-1 text-[11px] font-extrabold leading-tight">
                                      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />}
                                      <span className="truncate">
                                        {formatTime(record.clocked_in_at)} –{' '}
                                        {review ? 'Review' : active ? 'Active' : formatTime(record.clocked_out_at)}
                                      </span>
                                    </div>
                                    <div className="mt-0.5 text-[10px] font-bold opacity-80">
                                      {review
                                        ? 'Needs review'
                                        : active
                                        ? 'Clocked in'
                                        : formatMinutes(record.duration_minutes)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {filteredByDate.map(([date, records]) => (
            <article key={date} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900">{date}</h3>
                <span className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600">
                  {records.length} shift{records.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {records.map((record) => {
                  const review = isNeedsReview(record);
                  return (
                    <div key={record.id} className="rounded-xl border border-slate-200/80 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-slate-900">{record.barista_name}</span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            review
                              ? 'bg-red-50 text-red-700'
                              : record.clocked_out_at
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {review ? 'Needs review' : record.clocked_out_at ? 'Completed' : 'Still clocked in'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                        <span>
                          In
                          <br />
                          <strong className="text-sm text-slate-700">{formatTime(record.clocked_in_at)}</strong>
                        </span>
                        <span>
                          Out
                          <br />
                          <strong className="text-sm text-slate-700">{formatTime(record.clocked_out_at)}</strong>
                        </span>
                        <span>
                          Duration
                          <br />
                          <strong className="text-sm text-slate-700">{formatMinutes(record.duration_minutes)}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
