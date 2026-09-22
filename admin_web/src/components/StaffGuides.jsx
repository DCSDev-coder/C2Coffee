import React, { useEffect, useState } from 'react';
import { ImagePlus, Trash2, BookOpen } from 'lucide-react';
import { adminRequest, getAdminApiBaseUrl } from '../lib/adminApi';

const guideLabels = { attire: 'Attire guide', rules: 'Store rules', drink: 'Drink preparation' };

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
}

export default function StaffGuides() {
  const [guides, setGuides] = useState([]); const [menuItems, setMenuItems] = useState([]);
  const [type, setType] = useState('attire'); const [menuItemId, setMenuItemId] = useState(''); const [guideTitle, setGuideTitle] = useState('');
  const [file, setFile] = useState(null); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const visibleGuides = guides.filter((guide) => guide.guide_type === type);
  const load = async () => {
    const [guideData, menuData] = await Promise.all([adminRequest('/v1/admin/barista-guides'), adminRequest('/v1/admin/menu')]);
    setGuides(guideData.guides || []); setMenuItems((menuData.categories || []).flatMap((category) => category.items || []));
  };
  useEffect(() => { load().catch(() => setError('Unable to load staff guides. Please refresh.')); }, []);
  const addGuide = async (event) => {
    event.preventDefault(); if (!file || (type === 'drink' && !menuItemId)) { setError(type === 'drink' ? 'Select a drink and image first.' : 'Choose an image first.'); return; }
    setSaving(true); setError('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const upload = await adminRequest('/v1/admin/barista-guides/uploads', { method: 'POST', body: JSON.stringify({ file_name: file.name, data_url: dataUrl }) });
      await adminRequest('/v1/admin/barista-guides', { method: 'POST', body: JSON.stringify({ guide_type: type, menu_item_id: type === 'drink' ? Number(menuItemId) : null, guide_title: type === 'drink' ? null : (guideTitle.trim() || null), image_url: upload.image_url }) });
      setFile(null); setMenuItemId(''); setGuideTitle(''); await load();
    } catch (err) { setError(err.message || 'Unable to save the guide image.'); } finally { setSaving(false); }
  };
  const removeGuide = async (id) => { if (!window.confirm('Delete this staff guide image?')) return; await adminRequest(`/v1/admin/barista-guides/${id}`, { method: 'DELETE' }); await load(); };
  return <div className="p-6 lg:p-10 space-y-7">
    <div><h1 className="text-3xl font-bold text-gray-900">Staff Guides</h1><p className="mt-2 text-gray-500">Upload image-only attire, store-rule, and drink preparation guides for the Barista app.</p></div>
    <form onSubmit={addGuide} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm grid gap-4 md:grid-cols-4 items-end">
      <label className="text-sm font-semibold text-gray-700">Guide type<select value={type} onChange={(event) => { setType(event.target.value); setFile(null); setMenuItemId(''); setGuideTitle(''); }} className="mt-2 w-full rounded-lg border border-gray-300 p-3"><option value="attire">Attire guide</option><option value="rules">Store rules</option><option value="drink">Drink preparation</option></select></label>
      {type === 'drink' && <label className="text-sm font-semibold text-gray-700">Drink<select value={menuItemId} onChange={(event) => setMenuItemId(event.target.value)} className="mt-2 w-full rounded-lg border border-gray-300 p-3"><option value="">Select drink</option>{menuItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      {type !== 'drink' && <label className="text-sm font-semibold text-gray-700">Guide title <span className="font-normal text-gray-400">(optional)</span><input value={guideTitle} maxLength={120} onChange={(event) => setGuideTitle(event.target.value)} placeholder={type === 'attire' ? 'e.g. Opening uniform' : 'e.g. Closing checklist'} className="mt-2 w-full rounded-lg border border-gray-300 p-3" /></label>}
      <label className="text-sm font-semibold text-gray-700">Guide image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm" /></label>
      <button disabled={saving} className="rounded-xl bg-[#2E5E58] px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Upload guide'}</button>
      {error && <p className="md:col-span-4 text-sm font-medium text-red-600">{error}</p>}
    </form>
    <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-gray-900">{guideLabels[type]}</h2><span className="rounded-full bg-[#E8F2EF] px-3 py-1 text-xs font-bold text-[#1F3A34]">{visibleGuides.length} {visibleGuides.length === 1 ? 'guide' : 'guides'}</span></div>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleGuides.map((guide) => <article key={guide.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><img src={`${getAdminApiBaseUrl()}${guide.image_url}`} alt={guide.guide_title || guideLabels[guide.guide_type]} className="h-56 w-full object-contain bg-gray-50" /><div className="flex items-center gap-3 p-4"><BookOpen size={18} className="text-[#2E5E58]"/><div className="min-w-0 flex-1"><p className="font-bold">{guide.menu_item_name || guide.guide_title || guideLabels[guide.guide_type]}</p><p className="truncate text-sm text-gray-500">{guide.guide_type === 'drink' ? 'Drink preparation' : guideLabels[guide.guide_type]}</p></div><button onClick={() => removeGuide(guide.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Delete guide"><Trash2 size={18}/></button></div></article>)}</div>
    {!visibleGuides.length && <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-500"><ImagePlus className="mx-auto mb-3"/>No {guideLabels[type].toLowerCase()} images have been uploaded.</div>}
  </div>;
}
