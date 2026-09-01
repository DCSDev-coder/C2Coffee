import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import Pagination from './Pagination';
import {
  createAdminMarketingBanner,
  deleteAdminMarketingBanner,
  getAdminApiBaseUrl,
  loadAdminMarketingBanners,
  loadAdminMenu,
  loadAdminVouchers,
  updateAdminMarketingBanner,
  uploadAdminMenuImage
} from '../lib/adminApi';

const ITEMS_PER_PAGE = 8;

const DEFAULT_FORM = {
  title: '',
  subtitle: '',
  imageSource: '',
  bannerType: 'general',
  destinationType: 'menu',
  targetValue: '',
  startsAt: '',
  endsAt: '',
  placement: 'both',
  floatingPriority: false,
  isActive: true
};

const bannerTypeOptions = [
  { value: 'general', label: 'General poster' },
  { value: 'voucher', label: 'Voucher poster' },
  { value: 'event', label: 'Event poster' },
  { value: 'new_item', label: 'New item poster' }
];

const destinationLabelMap = {
  reward_section: 'Reward section',
  menu: 'Menu',
  calendar: 'Calendar'
};

const statusClassMap = {
  Active: 'bg-[#D1FADF] text-[#039855]',
  Live: 'bg-[#D1FADF] text-[#039855]',
  Scheduled: 'bg-[#FEF0C7] text-[#B54708]',
  Ended: 'bg-[#FEE4E2] text-[#D92D20]',
  Inactive: 'bg-[#E5E7EB] text-[#4B5563]'
};

function resolveImageUrl(imageSource) {
  const value = String(imageSource ?? '').trim();
  if (!value) {
    return '/c2_logo.png';
  }

  if (/^data:/i.test(value) || /^blob:/i.test(value) || /^https?:\/\//i.test(value)) {
    return value;
  }

  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${getAdminApiBaseUrl()}${normalized}`;
}

function formatDateTimeLabel(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (input) => String(input).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function flattenMenuItems(menuResponse) {
  const categories = Array.isArray(menuResponse?.categories) ? menuResponse.categories : [];
  return categories.flatMap((category) => {
    const items = Array.isArray(category.items) ? category.items : [];
    return items.map((item) => ({
      code: item.code,
      name: item.name,
      categoryName: category.name,
      isActive: item.is_active ?? item.isAvailable ?? true
    }));
  });
}

function makeEmptyForm() {
  return { ...DEFAULT_FORM };
}

function bannerStatusLabel(banner) {
  if (!banner.isActive) {
    return 'Inactive';
  }

  if (banner.bannerType !== 'event' || !banner.startsAt || !banner.endsAt) {
    return 'Active';
  }

  const now = Date.now();
  const startsAt = new Date(banner.startsAt).getTime();
  const endsAt = new Date(banner.endsAt).getTime();

  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) {
    return 'Active';
  }
  if (now < startsAt) {
    return 'Scheduled';
  }
  if (now > endsAt) {
    return 'Ended';
  }
  return 'Live';
}

function routeLabel(banner) {
  if (banner.bannerType === 'event') {
    return 'Calendar before start · Menu during event';
  }
  if (banner.bannerType === 'voucher') {
    return banner.destinationType === 'reward_section' ? 'Reward section' : 'Menu';
  }
  if (banner.bannerType === 'new_item') {
    return 'Menu · specific item';
  }
  return destinationLabelMap[banner.destinationType] || 'Menu';
}

const Marketing = () => {
  const [banners, setBanners] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [voucherTemplates, setVoucherTemplates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedPlacement, setSelectedPlacement] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState('');
  const [formData, setFormData] = useState(makeEmptyForm());

  useEffect(() => {
    if (!selectedImageFile) {
      setSelectedImagePreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedImageFile);
    setSelectedImagePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImageFile]);

  const loadPageData = async () => {
    try {
      setError('');
      setLoading(true);
      const [bannerResponse, menuResponse, voucherResponse] = await Promise.all([
        loadAdminMarketingBanners(),
        loadAdminMenu(),
        loadAdminVouchers()
      ]);

      setBanners(Array.isArray(bannerResponse?.banners) ? bannerResponse.banners : []);
      setMenuItems(flattenMenuItems(menuResponse));
      setVoucherTemplates(Array.isArray(voucherResponse?.vouchers) ? voucherResponse.vouchers : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load posters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPageData();
  }, []);

  const filteredBanners = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return banners.filter((banner) => {
      const matchesSearch = !q
        || String(banner.title ?? '').toLowerCase().includes(q)
        || String(banner.subtitle ?? '').toLowerCase().includes(q)
        || String(banner.targetLabel ?? '').toLowerCase().includes(q)
        || String(banner.bannerType ?? '').toLowerCase().includes(q);

      const matchesType = selectedType ? banner.bannerType === selectedType : true;
      const matchesPlacement = selectedPlacement ? banner.placement === selectedPlacement : true;
      const matchesStatus = selectedStatus ? bannerStatusLabel(banner).toLowerCase() === selectedStatus.toLowerCase() : true;

      return matchesSearch && matchesType && matchesPlacement && matchesStatus;
    });
  }, [banners, searchTerm, selectedType, selectedPlacement, selectedStatus]);

  const summaryCards = useMemo(() => {
    const activeCount = banners.filter((banner) => {
      const status = bannerStatusLabel(banner);
      return status === 'Active' || status === 'Live';
    }).length;
    const scheduledCount = banners.filter((banner) => bannerStatusLabel(banner) === 'Scheduled').length;

    return [
      { label: 'Total posters', value: banners.length, note: 'Configured in Marketing' },
      { label: 'Active now', value: activeCount, note: 'Visible or live to users' },
      { label: 'Scheduled', value: scheduledCount, note: 'Future event posters' }
    ];
  }, [banners]);

  const totalPages = Math.max(1, Math.ceil(filteredBanners.length / ITEMS_PER_PAGE));
  const currentRows = filteredBanners.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const openCreateModal = () => {
    setEditingBanner(null);
    setFormData(makeEmptyForm());
    setSelectedImageFile(null);
    setIsModalOpen(true);
  };

  const openEditModal = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      imageSource: banner.imageSource || '',
      bannerType: banner.bannerType === 'event' || banner.destinationType === 'calendar' ? 'event' : (banner.bannerType || 'general'),
      destinationType: banner.destinationType || 'menu',
      targetValue: banner.targetValue || '',
      startsAt: toDateTimeLocalValue(banner.startsAt),
      endsAt: toDateTimeLocalValue(banner.endsAt),
      placement: banner.placement || 'both',
      floatingPriority: Boolean(banner.floatingPriority),
      isActive: Boolean(banner.isActive)
    });
    setSelectedImageFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBanner(null);
    setSelectedImageFile(null);
    setFormData(makeEmptyForm());
  };

  const updateBannerType = (bannerType) => {
    setFormData((current) => {
      const next = {
        ...current,
        bannerType,
        targetValue: '',
        startsAt: bannerType === 'event' ? current.startsAt : '',
        endsAt: bannerType === 'event' ? current.endsAt : ''
      };

      if (bannerType === 'event') {
        next.destinationType = 'calendar';
      } else if (bannerType === 'new_item') {
        next.destinationType = 'menu';
      } else if (bannerType === 'voucher' && !['reward_section', 'menu'].includes(current.destinationType)) {
        next.destinationType = 'reward_section';
      } else if (bannerType === 'general' && !['reward_section', 'menu'].includes(current.destinationType)) {
        next.destinationType = 'menu';
      }

      return next;
    });
  };

  const submitBanner = async (event) => {
    event.preventDefault();

    const needsTarget = formData.bannerType === 'voucher' || formData.bannerType === 'new_item';
    const needsSchedule = formData.bannerType === 'event' || formData.destinationType === 'calendar';
    const resolvedBannerType = formData.destinationType === 'calendar' ? 'event' : formData.bannerType;
    const resolvedDestinationType = resolvedBannerType === 'event' ? 'calendar' : formData.destinationType;
    const bannerTarget = String(formData.targetValue ?? '').trim();

    if (needsTarget && !bannerTarget) {
      setError('Select a target voucher or menu item.');
      return;
    }
    if (needsSchedule && (!formData.startsAt || !formData.endsAt)) {
      setError('Event posters need both start and end date.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      let imageSource = String(formData.imageSource ?? '').trim();
      if (selectedImageFile) {
        const uploadResponse = await uploadAdminMenuImage(selectedImageFile);
        imageSource = uploadResponse.image_url;
      }

      const payload = {
        title: formData.title.trim(),
        subtitle: formData.subtitle.trim(),
        imageSource,
        bannerType: resolvedBannerType,
        destinationType: resolvedDestinationType,
        targetValue: needsTarget ? bannerTarget : null,
        startsAt: needsSchedule ? toIsoOrNull(formData.startsAt) : null,
        endsAt: needsSchedule ? toIsoOrNull(formData.endsAt) : null,
        placement: formData.placement,
        floatingPriority: Boolean(formData.floatingPriority),
        isActive: Boolean(formData.isActive)
      };

      if (editingBanner) {
        await updateAdminMarketingBanner(editingBanner.id, payload);
      } else {
        await createAdminMarketingBanner(payload);
      }

      await loadPageData();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save poster.');
    } finally {
      setSaving(false);
    }
  };

  const removeBanner = async (banner) => {
    if (!window.confirm(`Delete poster "${banner.title}"?`)) {
      return;
    }

    try {
      setSaving(true);
      await deleteAdminMarketingBanner(banner.id);
      await loadPageData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete poster.');
    } finally {
      setSaving(false);
    }
  };

  const bannerTypeLabel = (value) => bannerTypeOptions.find((option) => option.value === value)?.label || value;

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="px-6 py-5 lg:px-8 lg:py-6 w-full h-full flex flex-col gap-4">
        <div className="shrink-0 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="text-[1.55rem] leading-tight font-bold text-gray-900">Marketing</h1>
            <p className="text-sm text-gray-500">Manage the posters shown in the mobile app home and profile surfaces.</p>
            <p className="text-xs text-gray-400">
              Voucher posters can route to rewards or menu. Event posters can point to calendar before start and to menu during the event. New item posters can link to a specific menu item.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadPageData()}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw size={16} /> Refresh
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1F3A34] text-white text-sm font-semibold rounded-lg hover:bg-[#162A26] transition-colors cursor-pointer shadow-sm"
            >
              <Plus size={16} /> Add Poster
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
          {summaryCards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="mt-1 text-xs text-gray-500">{card.note}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col flex-1 min-h-[440px]">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col xl:flex-row justify-between gap-3 shrink-0">
            <div className="relative w-full xl:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search poster title, target, or type..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F3A34] text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
              <div className="relative">
                <select
                  value={selectedType}
                  onChange={(event) => {
                    setSelectedType(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer min-w-[160px]"
                >
                  <option value="">All types</option>
                  {bannerTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
              </div>

              <div className="relative">
                <select
                  value={selectedPlacement}
                  onChange={(event) => {
                    setSelectedPlacement(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer min-w-[160px]"
                >
                  <option value="">All placements</option>
                  <option value="home">Home</option>
                  <option value="profile">Profile</option>
                  <option value="both">Both</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
              </div>

              <div className="relative">
                <select
                  value={selectedStatus}
                  onChange={(event) => {
                    setSelectedStatus(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="peer appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none cursor-pointer min-w-[160px]"
                >
                  <option value="">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Live">Live</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Ended">Ended</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Poster</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Type</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Route</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Placement</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Status</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight">Floating</th>
                  <th className="px-6 py-3 font-semibold text-[13px] text-gray-900 border-b border-gray-100 leading-tight text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentRows.length > 0 ? currentRows.map((banner) => (
                  <tr key={banner.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={resolveImageUrl(banner.imageSource)}
                          alt={banner.title}
                          className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0 bg-gray-50"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{banner.title}</p>
                          <p className="text-xs text-gray-500 truncate">{banner.subtitle}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-[#EAF2EF] text-[#1F3A34]">
                        {bannerTypeLabel(banner.bannerType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      <div>
                        <p className="font-medium text-gray-900">{routeLabel(banner)}</p>
                        {banner.targetLabel ? (
                          <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">{banner.targetLabel}</p>
                        ) : null}
                        {banner.bannerType === 'event' && banner.scheduleLabel ? (
                          <p className="text-xs text-gray-500 mt-0.5">{banner.scheduleLabel}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{destinationLabelMap[banner.destinationType] || banner.destinationType}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${statusClassMap[bannerStatusLabel(banner)] || statusClassMap.Active}`}>
                        {bannerStatusLabel(banner)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {banner.floatingPriority ? (
                        <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-[#D1FADF] text-[#039855]">
                          Floating banner
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-500">
                          Not priority
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(banner)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeBanner(banner)}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-300 text-gray-500 bg-white hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                      {loading ? 'Loading posters...' : 'No posters configured yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex shrink-0">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filteredBanners.length}
              itemName="posters"
            />
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{editingBanner ? 'Edit Poster' : 'Create Poster'}</h2>
                <p className="text-xs text-gray-500 mt-1">Keep the copy short. The image and route do the heavy lifting.</p>
              </div>
              <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitBanner} className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Poster Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                      placeholder="e.g. Free Drink Voucher"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Subtitle</label>
                    <textarea
                      value={formData.subtitle}
                      onChange={(event) => setFormData((current) => ({ ...current, subtitle: event.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] min-h-[92px]"
                      placeholder="A short line for the poster"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Poster Type</label>
                    <div className="relative">
                      <select
                        value={formData.bannerType}
                        onChange={(event) => updateBannerType(event.target.value)}
                        className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                      >
                        {bannerTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Placement</label>
                    <div className="relative">
                      <select
                        value={formData.placement}
                        onChange={(event) => setFormData((current) => ({ ...current, placement: event.target.value }))}
                        className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                      >
                        <option value="home">Home</option>
                        <option value="profile">Profile</option>
                        <option value="both">Both</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                    <label className="flex items-start gap-3 text-sm text-gray-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.floatingPriority}
                        onChange={(event) => setFormData((current) => ({ ...current, floatingPriority: event.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#1F3A34] focus:ring-[#1F3A34]"
                      />
                      <span>
                        Use as floating banner
                        <span className="block mt-1 text-xs font-normal text-gray-500">
                          Mark any posters you want to appear as floating ads. Multiple posters can be selected.
                        </span>
                      </span>
                    </label>
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
                        className="h-4 w-4 rounded border-gray-300 text-[#1F3A34] focus:ring-[#1F3A34]"
                      />
                      Publish now
                    </label>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Poster Image</label>
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setSelectedImageFile(event.target.files?.[0] || null)}
                        className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#1F3A34] file:text-white hover:file:bg-[#162A26]"
                      />
                      <p className="text-[10px] text-gray-500 mt-2">Upload a PNG, JPG, or WEBP poster.</p>
                      {(selectedImageFile || formData.imageSource) && (
                        <div className="mt-4 flex items-center gap-3">
                          <img
                            src={selectedImagePreview || resolveImageUrl(formData.imageSource)}
                            alt="Poster preview"
                            className="w-20 h-20 object-cover rounded-xl border border-gray-200 bg-white"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {selectedImageFile ? selectedImageFile.name : 'Current image'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{formData.imageSource || 'Ready to upload'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {formData.bannerType === 'voucher' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Route on Click</label>
                        <div className="relative">
                          <select
                            value={formData.destinationType}
                            onChange={(event) => setFormData((current) => ({ ...current, destinationType: event.target.value }))}
                            className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                          >
                            <option value="reward_section">Reward section</option>
                            <option value="menu">Menu</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Target Voucher</label>
                        <div className="relative">
                          <select
                            value={formData.targetValue}
                            onChange={(event) => setFormData((current) => ({ ...current, targetValue: event.target.value }))}
                            className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                          >
                            <option value="">Select a voucher</option>
                            {voucherTemplates.map((voucher) => (
                              <option key={voucher.id} value={voucher.id}>
                                {voucher.name} · {voucher.id}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.bannerType === 'new_item' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Route on Click</label>
                        <div className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-gray-50">
                          Menu
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Target Menu Item</label>
                        <div className="relative">
                          <select
                            value={formData.targetValue}
                            onChange={(event) => setFormData((current) => ({ ...current, targetValue: event.target.value }))}
                            className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                          >
                            <option value="">Select a menu item</option>
                            {menuItems.map((item) => (
                              <option key={item.code} value={item.code}>
                                {item.name} · {item.code}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.bannerType === 'event' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Event Route</label>
                        <div className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-gray-50">
                          Calendar before start · Menu during the event
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Starts At</label>
                          <input
                            type="datetime-local"
                            value={formData.startsAt}
                            onChange={(event) => setFormData((current) => ({ ...current, startsAt: event.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Ends At</label>
                          <input
                            type="datetime-local"
                            value={formData.endsAt}
                            onChange={(event) => setFormData((current) => ({ ...current, endsAt: event.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {formData.bannerType === 'general' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Route on Click</label>
                      <div className="relative">
                        <select
                          value={formData.destinationType}
                          onChange={(event) => {
                            const destinationType = event.target.value;
                            setFormData((current) => ({
                              ...current,
                              destinationType,
                              bannerType: destinationType === 'calendar' ? 'event' : current.bannerType
                            }));
                          }}
                          className="peer appearance-none w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm outline-none focus:border-[#1F3A34] bg-white"
                        >
                          <option value="menu">Menu</option>
                          <option value="reward_section">Reward section</option>
                          <option value="calendar">Calendar</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={16} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-6 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">
                  {formData.bannerType === 'event'
                    ? 'Event posters route to calendar before they start and to menu while active.'
                    : 'Use short copy and let the image carry the promotion. The floating banner is chosen manually.'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-lg bg-[#1F3A34] text-white text-sm font-semibold hover:bg-[#162A26] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : editingBanner ? 'Save Changes' : 'Create Poster'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
};

export default Marketing;
