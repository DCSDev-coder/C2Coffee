import React, { useCallback, useEffect, useState } from 'react';
import { adminRequest, loadAdminMenu, loadAdminStores } from '../lib/adminApi';
import { showAdminError, showAdminSuccess } from '../lib/adminToast';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const empty = { name: '', store_id: '', menu_item_id: '', days: [1, 2, 3, 4, 5], start: '11:00', end: '14:00', start_date: '', end_date: '', price_rm: '', price_tokens: '', is_active: false };
const minutes = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const clock = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export default function MobilePriceSchedules() {
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [menu, outletData, result] = await Promise.all([
      loadAdminMenu(), loadAdminStores(), adminRequest('/v1/admin/mobile-price-schedules'),
    ]);
    setItems((menu.categories || []).flatMap((category) => category.items || []).filter((item) => item.is_active));
    setStores(outletData.stores || []);
    setSchedules(result.schedules || []);
  }, []);
  useEffect(() => { load().catch((error) => showAdminError(error.message)); }, [load]);
  const update = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const edit = (schedule) => {
    setEditing(schedule.id);
    setForm({ ...schedule, start: clock(schedule.start_minute), end: clock(schedule.end_minute),
      start_date: schedule.start_date || '', end_date: schedule.end_date || '', price_rm: String(schedule.price_rm), price_tokens: String(schedule.price_tokens) });
  };
  const save = async (event) => {
    event.preventDefault();
    if (!form.days.length) { showAdminError('Select at least one day.'); return; }
    setBusy(true);
    try {
      await adminRequest(editing ? `/v1/admin/mobile-price-schedules/${editing}` : '/v1/admin/mobile-price-schedules', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({ name: form.name, store_id: Number(form.store_id), menu_item_id: Number(form.menu_item_id),
          days: form.days, start_minute: minutes(form.start), end_minute: minutes(form.end),
          start_date: form.start_date || null, end_date: form.end_date || null,
          price_rm: Number(form.price_rm), price_tokens: Number(form.price_tokens), is_active: form.is_active }),
      });
      showAdminSuccess('Schedule saved.'); setEditing(null); setForm(empty); await load();
    } catch (error) { showAdminError(error.message || 'Unable to save schedule.'); } finally { setBusy(false); }
  };
  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2';
  return <div className="space-y-5 p-4">
    <div><h1 className="text-2xl font-bold">Mobile Scheduled Prices</h1><p>Set RM and token prices for an item at an outlet. Special-priced items cannot receive voucher discounts.</p></div>
    <form onSubmit={save} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
      <label>Name<input className={input} required maxLength={160} value={form.name} onChange={(e) => update('name', e.target.value)} /></label>
      <label>Outlet<select className={input} required disabled={!!editing} value={form.store_id} onChange={(e) => update('store_id', e.target.value)}><option value="">Select outlet</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
      <label>Item<select className={input} required disabled={!!editing} value={form.menu_item_id} onChange={(e) => update('menu_item_id', e.target.value)}><option value="">Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <fieldset><legend>Days</legend><div className="flex flex-wrap gap-2">{days.map((day, index) => <label key={day}><input type="checkbox" checked={form.days.includes(index + 1)} onChange={(e) => update('days', e.target.checked ? [...form.days, index + 1] : form.days.filter((d) => d !== index + 1))} /> {day}</label>)}</div></fieldset>
      <label>Start time<input className={input} type="time" required value={form.start} onChange={(e) => update('start', e.target.value)} /></label>
      <label>End time<input className={input} type="time" required value={form.end} onChange={(e) => update('end', e.target.value)} /></label>
      <label>Start date (optional)<input className={input} type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} /></label>
      <label>End date (optional)<input className={input} type="date" value={form.end_date} onChange={(e) => update('end_date', e.target.value)} /></label>
      <label>Special RM price<input className={input} required type="number" min="0" max="1000000" step="0.01" value={form.price_rm} onChange={(e) => update('price_rm', e.target.value)} /></label>
      <label>Special token price<input className={input} required type="number" min="0" max="1000000" step="1" value={form.price_tokens} onChange={(e) => update('price_tokens', e.target.value)} /></label>
      <label><input type="checkbox" checked={form.is_active} onChange={(e) => update('is_active', e.target.checked)} /> Enable schedule</label>
      <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-emerald-800 px-4 py-2 text-white">{editing ? 'Save changes' : 'Create schedule'}</button>{editing && <button type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}</div>
    </form>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Session</th><th>Outlet</th><th>Item</th><th>Days and time</th><th>RM / tokens</th><th>Status</th><th /></tr></thead><tbody>{schedules.map((schedule) => <tr key={schedule.id}><td>{schedule.name}</td><td>{schedule.store_name}</td><td>{schedule.item_name}</td><td>{schedule.days.map((d) => days[d - 1]).join(', ')} {clock(schedule.start_minute)}–{clock(schedule.end_minute)}</td><td>RM {schedule.price_rm} / {schedule.price_tokens}</td><td>{schedule.is_active ? 'Enabled' : 'Disabled'}</td><td><button type="button" onClick={() => edit(schedule)}>Edit</button></td></tr>)}</tbody></table></div>
  </div>;
}
