import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { adminRequest, getAdminApiBaseUrl, uploadAdminVoucherImage } from '../lib/adminApi';
import {
  Search, ChevronDown, Download, Plus,
  Edit3, MoreVertical, X, Copy,
  Trash2, Percent, Gift,
  Tag
} from "lucide-react";
import Pagination from './Pagination';
import VouchersAnalytics from "./VouchersAnalytics";
import { exportToCSV } from '../utils/exportToCSV';
import { requestAdminConfirm, requestAdminPrompt } from '../lib/adminDialog';
import { showAdminError } from '../lib/adminToast';

// Stat Card Component (Matched to Customers & Orders KPICard) 
const StatCard = ({ title, value, change, icon: Icon, iconBg, iconColor = "text-white" }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      {change && (
        <div className="flex items-center gap-1 mt-1">
          <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal">
            {change.includes('%') && !change.includes('of total') && !change.includes('↑') && !change.includes('↓') && change.includes('vs') ? `↑ ${change}` : change}
          </p>
        </div>
      )}
    </div>
  </div>
);

const STATUS_TYPES = ["All Status", "Active", "Expired", "Draft"];
const ITEMS_PER_PAGE = 10;
const ALL_ITEMS_OPTION = 'All Items';
const BENEFIT_TYPE_OPTIONS = [
  { value: "Percentage Off", label: "Discount" },
  { value: "Free Drink", label: "Free Drink" },
  { value: "Free Food", label: "Free Food" },
  { value: "Birthday Voucher", label: "Birthday Voucher" }
];
const PAYMENT_MODE_OPTIONS = [
  { value: "both", label: "Both token and RM payment" },
  { value: "token", label: "Token payment only" },
  { value: "direct", label: "RM payment only" }
];
const PROMOTION_KIND_OPTIONS = [
  { value: "standard", label: "Simple Voucher" },
  { value: "bundle", label: "Buy & Get" }
];
const SUGGESTED_TYPE_LABELS = [
  "Happy Hour",
  "Weekend Promo",
  "Wednesday Special",
  "Merdeka Campaign",
  "Staff Discount",
  "Birthday Treat",
  "Referral Bonus"
];
const AUDIENCE_OPTIONS = [
  { value: "all_customers", label: "All Customers" },
  { value: "employee_only", label: "Employee Only" },
  { value: "manual_issue_only", label: "Manual Issue Only" }
];
const DEFAULT_PRODUCT_KIND_OPTIONS = [
  { value: 'drink', label: 'Drinks' },
  { value: 'food', label: 'Food' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'candle', label: 'Candles' }
];
const AVAILABILITY_MODE_OPTIONS = [
  { value: "always", label: "Always Available" },
  { value: "daily", label: "Every Day, Time Window" },
  { value: "weekly", label: "Specific Days + Time" },
  { value: "monthly", label: "Every Month on a Date" },
  { value: "annual", label: "Every Year on a Date" },
  { value: "birthday", label: "Every Customer Birthday" }
];
const WEEKDAY_OPTIONS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];
const REMINDER_LEAD_OPTIONS = [
  { value: 0, label: 'At the exact time' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '24 hours before' }
];

const createEmptyVoucherForm = () => ({
  name: "",
  type: "Happy Hour",
  benefitType: "Free Drink",
  paymentMode: "both",
  promotionKind: "standard",
  topupRewardMinTokens: null,
  status: "Active",
  tier: "All Tiers",
  reward: "",
  discountValue: "",
  productKinds: [],
  subcategoryCodes: [],
  categoryCodes: [],
  eligibleItems: [],
  rewardProductKinds: [],
  rewardSubcategoryCodes: [],
  rewardCategoryCodes: [],
  rewardItems: [],
  qualifyingQuantity: 1,
  rewardQuantity: 1,
  totalQty: 1000,
  limitPerUser: 1,
  description: "",
  usageInstructions: "",
  imageUrl: null,
  audience: "all_customers",
  availabilityMode: "always",
  expiry: "",
  activeDays: [],
  startTime: "",
  endTime: "",
  startReminderEnabled: false,
  startReminderMinutesBefore: 0,
  endReminderEnabled: false,
  endReminderMinutesBefore: 60,
  annualDate: "",
  monthlyDay: ""
});

const normalizeVoucherForm = (voucher) => ({
  ...createEmptyVoucherForm(),
  ...voucher,
  benefitType: voucher?.benefitType || voucher?.type || "Free Drink",
  paymentMode: voucher?.paymentMode || (voucher?.benefitType === "Token Discount" ? "token" : "both"),
  type: voucher?.type || voucher?.benefitType || "Voucher",
  promotionKind: voucher?.promotionKind || "standard",
  productKinds: Array.isArray(voucher?.productKinds) ? voucher.productKinds : [],
  subcategoryCodes: Array.isArray(voucher?.subcategoryCodes) ? voucher.subcategoryCodes : [],
  categoryCodes: Array.isArray(voucher?.categoryCodes) ? voucher.categoryCodes : [],
  eligibleItems: Array.isArray(voucher?.eligibleItems) ? voucher.eligibleItems : [],
  rewardProductKinds: Array.isArray(voucher?.rewardProductKinds)
    ? voucher.rewardProductKinds
    : Array.isArray(voucher?.productKinds)
      ? voucher.productKinds
      : [],
  rewardSubcategoryCodes: Array.isArray(voucher?.rewardSubcategoryCodes)
    ? voucher.rewardSubcategoryCodes
    : Array.isArray(voucher?.subcategoryCodes)
      ? voucher.subcategoryCodes
      : [],
  rewardCategoryCodes: Array.isArray(voucher?.rewardCategoryCodes)
    ? voucher.rewardCategoryCodes
    : Array.isArray(voucher?.categoryCodes)
      ? voucher.categoryCodes
      : [],
  rewardItems: Array.isArray(voucher?.rewardItems)
    ? voucher.rewardItems
    : Array.isArray(voucher?.eligibleItems)
      ? voucher.eligibleItems
      : [],
  qualifyingQuantity: Number(voucher?.qualifyingQuantity) || 1,
  rewardQuantity: Number(voucher?.rewardQuantity) || 1,
  topupRewardMinTokens: voucher?.topupRewardMinTokens == null || voucher?.topupRewardMinTokens === ''
    ? null
    : Number(voucher.topupRewardMinTokens),
  activeDays: Array.isArray(voucher?.activeDays) ? voucher.activeDays : [],
  startTime: voucher?.startTime || "",
  endTime: voucher?.endTime || "",
  startReminderEnabled: voucher?.startReminderEnabled === true || voucher?.startReminderEnabled === 1,
  startReminderMinutesBefore: Number(voucher?.startReminderMinutesBefore) || 0,
  endReminderEnabled: voucher?.endReminderEnabled === true || voucher?.endReminderEnabled === 1,
  endReminderMinutesBefore: Number(voucher?.endReminderMinutesBefore) || 60,
  annualDate: voucher?.annualDate ? `2026-${voucher.annualDate}` : "",
  monthlyDay: voucher?.monthlyDay || "",
  audience: voucher?.audience || "all_customers",
  availabilityMode: voucher?.availabilityMode || "always",
  expiry: voucher?.expiry || ""
});

const audienceLabel = (value) =>
  AUDIENCE_OPTIONS.find((option) => option.value === value)?.label || "All Customers";

const benefitTypeLabel = (value) => {
  if (value === "Percentage Off" || value === "Cash Voucher" || value === "Token Discount") {
    return "Discount";
  }

  return value || "-";
};

const paymentModeLabel = (value) =>
  PAYMENT_MODE_OPTIONS.find((option) => option.value === value)?.label || 'Both token and RM payment';

const limitPerUserLabel = "Max Uses Per Customer";

const resolveVoucherArtworkUrl = (imageUrl) => {
  const value = String(imageUrl ?? '').trim();
  if (!value || /^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  return `${getAdminApiBaseUrl()}${value.startsWith('/') ? value : `/${value}`}`;
};

const VoucherArtworkField = ({ imageUrl, onChange }) => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadArtwork = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await uploadAdminVoucherImage(file);
      onChange(response.image_url || null);
    } catch (error) {
      showAdminError(`Unable to upload voucher artwork: ${error.message}`);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="rounded-xl border border-dashed border-[#BFD3CE] bg-[#F8FBFA] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label className="block font-bold text-gray-900">Customer reward image</label>
          <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">Optional. It appears on this voucher in My Rewards after an eligible customer receives it. It does not publish a menu poster.</p>
        </div>
        {imageUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="shrink-0 text-[11px] font-bold text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
        <div className="aspect-[2/1] overflow-hidden rounded-xl border border-[#D7E4E0] bg-white shadow-sm">
          {imageUrl ? (
            <img src={resolveVoucherArtworkUrl(imageUrl)} alt="Voucher artwork preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center text-[11px] text-gray-400">
              <span className="font-bold text-[#5C7770]">2:1 preview</span>
              <span>Reward image</span>
            </div>
          )}
        </div>
        <div>
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-[#1E433A] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#16342D] disabled:cursor-not-allowed disabled:opacity-60">
            {isUploading ? 'Uploading...' : imageUrl ? 'Replace image' : 'Choose image'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={uploadArtwork}
              disabled={isUploading}
              className="sr-only"
            />
          </label>
          <p className="mt-2 text-[11px] font-medium text-gray-700">Recommended: 1200 × 600 px (2:1 landscape)</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-500">PNG, JPEG, or WebP, up to 8 MB. To advertise this reward publicly, create a Voucher poster in Marketing.</p>
        </div>
      </div>
      {isUploading && <p className="mt-2 text-[11px] font-medium text-[#2E5E58]">Uploading and optimizing artwork...</p>}
    </div>
  );
};

const formatAvailabilityMode = (value) =>
  AVAILABILITY_MODE_OPTIONS.find((option) => option.value === value)?.label || "Always Available";

const reminderSettingsFromVoucher = (voucher) => ({
  startReminderEnabled: voucher?.startReminderEnabled === true || voucher?.startReminderEnabled === 1,
  startReminderMinutesBefore: Number(voucher?.startReminderMinutesBefore) || 0,
  endReminderEnabled: voucher?.endReminderEnabled === true || voucher?.endReminderEnabled === 1,
  endReminderMinutesBefore: Number(voucher?.endReminderMinutesBefore) || 60
});

const nonReminderVoucherForm = (voucher) => {
  const normalized = normalizeVoucherForm(voucher);
  const rest = { ...normalized };
  delete rest.startReminderEnabled;
  delete rest.startReminderMinutesBefore;
  delete rest.endReminderEnabled;
  delete rest.endReminderMinutesBefore;
  return rest;
};

const VoucherFormSection = ({ number, title, description }) => (
  <div className="flex items-start gap-3.5 border-t border-gray-100 pt-5 first:border-t-0 first:pt-0">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1E433A] text-[11px] font-bold text-white shadow-xs">
      {number}
    </span>
    <div className="min-w-0 flex-1">
      <h4 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h4>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{description}</p>
    </div>
  </div>
);

const VoucherReminderSettings = ({ value, onChange }) => (
  <div className="col-span-2 rounded-xl border border-[#D7E4E0] bg-[#F4F8F7] p-4">
    <div>
      <h4 className="text-sm font-bold text-[#1F3A34]">Customer reminders</h4>
      <p className="mt-0.5 text-xs leading-relaxed text-gray-600">
        Optional reminders for customers who have received this voucher. These are separate from Marketing broadcasts.
      </p>
    </div>
    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      <label className="rounded-lg border border-gray-200 bg-white p-3">
        <span className="flex items-center gap-2 text-xs font-bold text-gray-900">
          <input
            type="checkbox"
            checked={value.startReminderEnabled}
            onChange={(e) => onChange({ startReminderEnabled: e.target.checked })}
            className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
          />
          Remind when voucher starts
        </span>
        <select
          disabled={!value.startReminderEnabled}
          value={value.startReminderMinutesBefore}
          onChange={(e) => onChange({ startReminderMinutesBefore: Number(e.target.value) })}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-100 disabled:text-gray-400"
        >
          {REMINDER_LEAD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="rounded-lg border border-gray-200 bg-white p-3">
        <span className="flex items-center gap-2 text-xs font-bold text-gray-900">
          <input
            type="checkbox"
            checked={value.endReminderEnabled}
            onChange={(e) => onChange({ endReminderEnabled: e.target.checked })}
            className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
          />
          Remind before voucher ends
        </span>
        <select
          disabled={!value.endReminderEnabled}
          value={value.endReminderMinutesBefore}
          onChange={(e) => onChange({ endReminderMinutesBefore: Number(e.target.value) })}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs disabled:bg-gray-100 disabled:text-gray-400"
        >
          {REMINDER_LEAD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
    </div>
  </div>
);

const deriveMenuTaxonomy = (response) => {
  const categories = (response?.categories || [])
    .filter((category) => category.is_active)
    .map((category) => ({
      ...category,
      items: (category.items || []).filter(
        (item) => item.is_active !== false && item.is_available !== false
      )
    }))
    .filter((category) => category.items.length > 0);
  const subcategories = response?.subcategories || [];
  const items = [];
  const productKinds = [];
  const seenProductKinds = new Set();

  const groupedItems = categories.reduce((acc, category) => {
    const productKindCode = category.product_kind_code || 'other';
    if (!seenProductKinds.has(productKindCode)) {
      seenProductKinds.add(productKindCode);
      productKinds.push({
        value: productKindCode,
        label: category.product_kind_name || productKindCode
      });
    }

    // The admin menu endpoint includes archived items so the Menu page can
    // display history and support restoration. Voucher eligibility must only
    // use currently active items; otherwise archived items can reappear here.
    (category.items || []).forEach((item) => {
      items.push({
        id: item.id,
        name: item.name,
        categoryLabel: item.subcategory_name || category.name,
        productKindCode: item.product_kind_code || category.product_kind_code || 'drink',
        subcategoryCode: item.subcategory_code || '',
        subcategoryName: item.subcategory_name || '',
        categoryCode: category.code
      });
      const groupLabel = item.subcategory_name || category.name;
      if (!acc[groupLabel]) {
        acc[groupLabel] = [];
      }
      acc[groupLabel].push(item.name);
      });
    return acc;
  }, {});

  Object.keys(groupedItems).forEach((key) => {
    groupedItems[key] = Array.from(new Set(groupedItems[key])).sort((a, b) => a.localeCompare(b));
  });

  return {
    categories: categories.map((category) => ({
      code: category.code,
      name: category.name,
      itemCount: category.items.length
    })),
    groupedItems,
    subcategories: subcategories.filter((subcategory) => subcategory.is_active),
    productKinds: productKinds.length > 0 ? productKinds : DEFAULT_PRODUCT_KIND_OPTIONS,
    items
  };
};

const buildCategoryGroupedItems = (menuTaxonomy, selectedCategoryCodes = []) => {
  const categoryCodes = new Set(normalizeSelection(selectedCategoryCodes));
  if (categoryCodes.size === 0) return {};

  return (menuTaxonomy.items || []).reduce((groups, item) => {
    if (!categoryCodes.has(item.categoryCode)) return groups;
    const category = (menuTaxonomy.categories || []).find((entry) => entry.code === item.categoryCode);
    const label = category?.name || item.categoryLabel || 'Items';
    if (!groups[label]) groups[label] = [];
    groups[label].push(item.name);
    return groups;
  }, {});
};

const toggleListValue = (list = [], value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const formatScopeSelection = (voucher, prefix = "", productKindLabels = {}) => {
  const categories = Array.isArray(voucher?.[`${prefix}CategoryCodes`])
    ? voucher[`${prefix}CategoryCodes`]
    : [];
  const productKinds = Array.isArray(voucher?.[`${prefix}ProductKinds`])
    ? voucher[`${prefix}ProductKinds`]
    : [];
  const subcategories = Array.isArray(voucher?.[`${prefix}SubcategoryCodes`])
    ? voucher[`${prefix}SubcategoryCodes`]
    : [];
  const items = Array.isArray(voucher?.[`${prefix}Items`])
    ? voucher[`${prefix}Items`]
    : [];
  const parts = [];

  if (categories.length > 0) {
    parts.push(...categories);
  }

  if (productKinds.length > 0) {
    parts.push(...productKinds.map((value) => productKindLabels[value] || value));
  }
  if (subcategories.length > 0) {
    parts.push(...subcategories);
  }
  if (items.length > 0 && !items.includes(ALL_ITEMS_OPTION)) {
    if (items.length > 3) {
      parts.push(`${items.slice(0, 3).join(", ")} +${items.length - 3} more`);
    } else {
      parts.push(...items);
    }
  }

  if (parts.length === 0 || items.includes(ALL_ITEMS_OPTION)) {
    return "All Items";
  }

  return parts.join(", ");
};

const formatVoucherEligibility = (voucher, productKindLabels = {}) => {
  const buyScope = formatScopeSelection(voucher, "", productKindLabels);
  const rewardScope = formatScopeSelection(voucher, "reward", productKindLabels);
  const bundleQty = Number(voucher?.qualifyingQuantity) || 1;
  const rewardQty = Number(voucher?.rewardQuantity) || 1;

  if ((voucher?.promotionKind || "standard") === "bundle") {
    return `Buy ${bundleQty} from ${buyScope}, get ${rewardQty} from ${rewardScope}`;
  }

  return buyScope;
};

const ScrollableCheckboxList = ({ groupedItems = {}, selected = [], onChange }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const currentSelected = selected || [];

  const toggleOption = (option) => {
    let newSelected;

    if (currentSelected.includes(option)) {
      newSelected = currentSelected.filter((item) => item !== option);
    } else {
      newSelected = [...currentSelected.filter((item) => item !== ALL_ITEMS_OPTION), option];
    }

    onChange(newSelected);
  };

  const toggleCategory = (items) => {
    let newSelected = [...currentSelected.filter((item) => item !== ALL_ITEMS_OPTION)];

    const allSelected = items.every(item => currentSelected.includes(item));

    if (allSelected) {
      newSelected = newSelected.filter(item => !items.includes(item));
    } else {
      items.forEach(item => {
        if (!newSelected.includes(item)) newSelected.push(item);
      });
    }

    onChange(newSelected);
  };

  const filteredGroups = Object.entries(groupedItems).map(([category, items]) => {
    const filteredItems = items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()));
    return { category, originalItems: items, items: filteredItems };
  }).filter(group => group.items.length > 0);

  return (
    <div className="w-full border border-gray-300 rounded-lg overflow-hidden flex flex-col bg-white">
      <div className="p-2 border-b border-gray-100 bg-gray-50 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
          <input
            type="text"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#2E5E58]"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="max-h-56 overflow-y-auto p-2">
        <div className="mb-3 border-b border-gray-100 px-2 pb-2 text-[11px] text-gray-500">
          Leave every item unchecked to include all active items in the selected categories.
        </div>
        {filteredGroups.length > 0 ? (
          filteredGroups.map(({ category, originalItems, items }) => {
            const allSelected = originalItems.every(item => (selected || []).includes(item));
            return (
              <div key={category} className="mb-3 last:mb-0">
                <div className="flex items-center px-2 mb-1 group">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => toggleCategory(originalItems)}
                    className="mr-2 rounded text-gray-400 focus:ring-gray-400 cursor-pointer"
                  />
                  <h4
                    className="text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer group-hover:text-gray-700 transition-colors"
                    onClick={() => toggleCategory(originalItems)}
                  >
                    {category}
                  </h4>
                </div>
                <div className="space-y-1">
                  {items.map((option) => (
                    <label key={option} className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer pl-6">
                      <input
                        type="checkbox"
                        checked={(selected || []).includes(option)}
                        onChange={() => toggleOption(option)}
                        className="mr-2.5 rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                      />
                      <span className="text-xs font-medium text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-4 text-xs text-gray-500 text-center">No items found matching "{searchTerm}"</div>
        )}
      </div>
    </div>
  );
};

const normalizeSelection = (values = []) =>
  Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));


const ScopeSelectionSection = ({
  categoriesLabel,
  specificItemsLabel,
  menuTaxonomy,
  selectedCategoryCodes,
  selectedItems,
  onCategoryCodesChange,
  onItemsChange
}) => {
  const categories = menuTaxonomy.categories || [];
  const availableCategoryCodes = categories.map((category) => category.code);
  const selectedCategories = normalizeSelection(selectedCategoryCodes);
  const selectedScopeItems = normalizeSelection(selectedItems);
  const isAllMenuItems = selectedCategories.length === 0 && selectedScopeItems.length === 0;
  const itemGroups = buildCategoryGroupedItems(menuTaxonomy, selectedCategories);

  const updateCategoryCodes = (nextCategoryCodes) => {
    const normalized = normalizeSelection(nextCategoryCodes).filter((code) =>
      availableCategoryCodes.includes(code)
    );
    const allowedItems = new Set(
      (menuTaxonomy.items || [])
        .filter((item) => normalized.includes(item.categoryCode))
        .map((item) => item.name)
    );
    onCategoryCodesChange(normalized);
    onItemsChange(selectedScopeItems.filter((item) => allowedItems.has(item)));
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block font-bold text-gray-900 mb-1">{categoriesLabel}</label>
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 mb-3">
          <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 font-semibold border-b border-gray-100 pb-2 mb-1">
            <input
              type="checkbox"
              checked={isAllMenuItems}
              onChange={() => {
                onCategoryCodesChange([]);
                onItemsChange([]);
              }}
              className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
            />
            All menu items
          </label>
          {categories.map((category) => (
            <label key={category.code} className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={selectedCategories.includes(category.code)}
                onChange={() => updateCategoryCodes(toggleListValue(selectedCategories, category.code))}
                className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
              />
              <span>{category.name}</span>
              <span className="text-[10px] text-gray-400">({category.itemCount})</span>
            </label>
          ))}
        </div>
      </div>

      <div className="col-span-2">
        <label className="block font-bold text-gray-900 mb-1">{specificItemsLabel}</label>
        {selectedCategories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-[11px] text-gray-500">
            All active menu items are eligible. Select one or more categories to optionally choose specific items.
          </div>
        ) : (
          <ScrollableCheckboxList
            groupedItems={itemGroups}
            selected={selectedScopeItems}
            onChange={onItemsChange}
          />
        )}
      </div>
    </div>
  );
};

const Vouchers = ({ onNavigate }) => {
  const [vouchers, setVouchers] = useState([]);
  const [, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [voucherIssuances, setVoucherIssuances] = useState([]);
  const [issuancesLoading, setIssuancesLoading] = useState(false);
  const [menuTaxonomy, setMenuTaxonomy] = useState(() => deriveMenuTaxonomy({ categories: [], subcategories: [] }));

  const [typeFilter, setTypeFilter] = useState("All Type");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("Details");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [actionMenuId, setActionMenuId] = useState(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issuingVoucher, setIssuingVoucher] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [issueReason, setIssueReason] = useState("");
  const [issuePhone, setIssuePhone] = useState("");
  const [issueRequestKey, setIssueRequestKey] = useState("");
  const [issueInProgress, setIssueInProgress] = useState(false);

  const productKindLabels = Object.fromEntries(
    (menuTaxonomy.productKinds || []).map((option) => [option.value, option.label])
  );

  const selectVoucher = (voucher) => {
    setSelectedVoucher(voucher);
    setActiveTab("Details");
    setActionMenuId(null);
  };

  // New Voucher Form State
  const [newVoucher, setNewVoucher] = useState(createEmptyVoucherForm());

  const refreshMenuTaxonomy = async () => {
    const response = await adminRequest('/v1/admin/menu');
    setMenuTaxonomy(deriveMenuTaxonomy(response));
  };

  const refreshVouchers = async ({
    selectedVoucherId = selectedVoucher?.id,
    keepSelection = true,
    silent = false
  } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }
    const response = await adminRequest('/v1/admin/vouchers');
    const nextVouchers = response.vouchers || [];
    setVouchers(nextVouchers);
    if (keepSelection && selectedVoucherId) {
      const updated = nextVouchers.find((voucher) => voucher.id === selectedVoucherId);
      setSelectedVoucher(updated || null);
    }
    return nextVouchers;
  };

  const loadVoucherIssuances = async (voucherId) => {
    if (!voucherId) {
      setVoucherIssuances([]);
      return;
    }

    setIssuancesLoading(true);
    try {
      const response = await adminRequest(`/v1/admin/vouchers/${voucherId}/issuances`);
      setVoucherIssuances(response.issuances || []);
    } catch (err) {
      console.error('Failed to fetch voucher issuances', err);
      setVoucherIssuances([]);
    } finally {
      setIssuancesLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchVouchers = async () => {
      try {
        await Promise.all([
          refreshVouchers({ keepSelection: false, silent: false }),
          refreshMenuTaxonomy()
        ]);
      } catch (err) {
        console.error('Failed to fetch vouchers', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchVouchers();

    const refreshData = () => {
      void Promise.all([
        refreshVouchers({ keepSelection: true, silent: true }),
        refreshMenuTaxonomy()
      ]).catch((err) => {
        console.error('Failed to refresh vouchers', err);
      });
    };

    const intervalId = window.setInterval(refreshData, 30000);
    const handleFocus = () => refreshData();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setActionMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    void loadVoucherIssuances(selectedVoucher?.id);
  }, [selectedVoucher?.id]);

  useEffect(() => {
    if (!showIssueModal) {
      setCustomerResults([]);
      setCustomerSearch("");
      setSelectedCustomer(null);
      setIssueReason("");
      setIssuePhone("");
      return;
    }

    if (customerSearch.trim().length < 2) {
      setCustomerResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setCustomerSearchLoading(true);
      try {
        const response = await adminRequest(`/v1/admin/customers/search?q=${encodeURIComponent(customerSearch.trim())}`);
        setCustomerResults(response.customers || []);
      } catch (err) {
        console.error('Failed to search customers', err);
        setCustomerResults([]);
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [showIssueModal, customerSearch]);

  if (showAnalytics) {
    return <VouchersAnalytics onBack={() => setShowAnalytics(false)} vouchers={vouchers} />;
  }

  const resetPage = () => setCurrentPage(1);

  const typeFilterOptions = ["All Type", ...Array.from(new Set(vouchers.map((voucher) => voucher.type).filter(Boolean)))];

  const filtered = vouchers.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch =
      v.name.toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q) ||
      (v.reward || v.name || '').toLowerCase().includes(q) ||
      v.type.toLowerCase().includes(q);
    const matchType = typeFilter === "All Type" || v.type === typeFilter;
    const matchStatus = statusFilter === "All Status" || v.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Compute Analytics
  const totalVouchersCount = vouchers.length;
  const activeVouchersCount = vouchers.filter(v => v.status === 'Active').length;
  const vouchersIssuedCount = vouchers.reduce((acc, v) => acc + (v.issued || 0), 0);
  const vouchersRedeemedCount = vouchers.reduce((acc, v) => acc + (v.redeemed || 0), 0);
  const redemptionRateStr = vouchersIssuedCount > 0
    ? ((vouchersRedeemedCount / vouchersIssuedCount) * 100).toFixed(1) + '%'
    : '0%';

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    const payload = {
      code: `VCH-${1000 + vouchers.length + 1}`,
      name: newVoucher.name,
      type: newVoucher.type,
      benefitType: newVoucher.benefitType,
      paymentMode: newVoucher.paymentMode,
      promotionKind: newVoucher.promotionKind,
      topupRewardMinTokens: newVoucher.topupRewardMinTokens === null || newVoucher.topupRewardMinTokens === '' ? null : Number(newVoucher.topupRewardMinTokens),
      status: newVoucher.status,
      tier: 'All Tiers',
      discountValue: Number(newVoucher.discountValue) || 0,
      productKinds: newVoucher.productKinds,
      subcategoryCodes: newVoucher.subcategoryCodes,
      categoryCodes: newVoucher.categoryCodes,
      eligibleItems: newVoucher.eligibleItems.length > 0 ? newVoucher.eligibleItems : [ALL_ITEMS_OPTION],
      rewardProductKinds: newVoucher.rewardProductKinds,
      rewardSubcategoryCodes: newVoucher.rewardSubcategoryCodes,
      rewardCategoryCodes: newVoucher.rewardCategoryCodes,
      rewardItems: newVoucher.rewardItems.length > 0 ? newVoucher.rewardItems : [],
      qualifyingQuantity: Number(newVoucher.qualifyingQuantity) || 1,
      rewardQuantity: Number(newVoucher.rewardQuantity) || 1,
      expiry: newVoucher.benefitType === 'Birthday Voucher' ? null : (newVoucher.expiry || null),
      totalQty: newVoucher.totalQty === null || newVoucher.totalQty === "" ? null : Number(newVoucher.totalQty),
      limitPerUser: Number(newVoucher.limitPerUser) || 1,
      description: newVoucher.description || `Redeem ${newVoucher.name}`,
      usageInstructions: newVoucher.usageInstructions || "",
      imageUrl: newVoucher.imageUrl || null,
      audience: newVoucher.audience,
      availabilityMode: newVoucher.availabilityMode,
      activeDays: newVoucher.activeDays,
      startTime: newVoucher.startTime || null,
      endTime: newVoucher.endTime || null,
      startReminderEnabled: newVoucher.startReminderEnabled,
      startReminderMinutesBefore: Number(newVoucher.startReminderMinutesBefore) || 0,
      endReminderEnabled: newVoucher.endReminderEnabled,
      endReminderMinutesBefore: Number(newVoucher.endReminderMinutesBefore) || 60,
      annualDate: newVoucher.annualDate || null,
      monthlyDay: newVoucher.monthlyDay === "" ? null : Number(newVoucher.monthlyDay)
    };

    try {
      await adminRequest('/v1/admin/vouchers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await refreshVouchers();
    } catch (err) {
      showAdminError('Error creating voucher: ' + err.message);
    } finally {
      setShowCreateModal(false);
      setNewVoucher(createEmptyVoucherForm());
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: editingVoucher.id,
        name: editingVoucher.name,
        type: editingVoucher.type,
        benefitType: editingVoucher.benefitType,
        paymentMode: editingVoucher.paymentMode,
        promotionKind: editingVoucher.promotionKind,
        topupRewardMinTokens: editingVoucher.topupRewardMinTokens === null || editingVoucher.topupRewardMinTokens === '' ? null : Number(editingVoucher.topupRewardMinTokens),
        status: editingVoucher.status,
        tier: 'All Tiers',
        discountValue: Number(editingVoucher.discountValue) || 0,
        productKinds: editingVoucher.productKinds || [],
        subcategoryCodes: editingVoucher.subcategoryCodes || [],
        categoryCodes: editingVoucher.categoryCodes || [],
        eligibleItems: editingVoucher.eligibleItems,
        rewardProductKinds: editingVoucher.rewardProductKinds || [],
        rewardSubcategoryCodes: editingVoucher.rewardSubcategoryCodes || [],
        rewardCategoryCodes: editingVoucher.rewardCategoryCodes || [],
        rewardItems: editingVoucher.rewardItems || [],
        qualifyingQuantity: Number(editingVoucher.qualifyingQuantity) || 1,
        rewardQuantity: Number(editingVoucher.rewardQuantity) || 1,
        expiry: editingVoucher.benefitType === 'Birthday Voucher' ? null : (editingVoucher.expiry || null),
        totalQty: editingVoucher.totalQty === null || editingVoucher.totalQty === "" ? null : Number(editingVoucher.totalQty),
        limitPerUser: Number(editingVoucher.limitPerUser) || 1,
        description: editingVoucher.description,
        usageInstructions: editingVoucher.usageInstructions || "",
        imageUrl: editingVoucher.imageUrl || null,
        audience: editingVoucher.audience,
        availabilityMode: editingVoucher.availabilityMode,
        activeDays: editingVoucher.activeDays,
        startTime: editingVoucher.startTime || null,
        endTime: editingVoucher.endTime || null,
        startReminderEnabled: editingVoucher.startReminderEnabled,
        startReminderMinutesBefore: Number(editingVoucher.startReminderMinutesBefore) || 0,
        endReminderEnabled: editingVoucher.endReminderEnabled,
        endReminderMinutesBefore: Number(editingVoucher.endReminderMinutesBefore) || 60,
        annualDate: editingVoucher.annualDate || null,
        monthlyDay: editingVoucher.monthlyDay === "" ? null : Number(editingVoucher.monthlyDay)
      };

      const updatedVoucher = await adminRequest(`/v1/admin/vouchers/${editingVoucher.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        successMessage: 'Voucher changes saved successfully.'
      });
      if ((updatedVoucher.imageUrl || null) !== payload.imageUrl) {
        throw new Error('Voucher artwork was not saved. Please try again.');
      }
      await refreshVouchers(editingVoucher.id);
      setEditingVoucher(null);
    } catch (err) {
      const originalVoucher = vouchers.find((voucher) => voucher.id === editingVoucher.id);
      const originalReminderSettings = reminderSettingsFromVoucher(originalVoucher);
      const requestedReminderSettings = reminderSettingsFromVoucher(editingVoucher);
      const reminderChanged = JSON.stringify(originalReminderSettings) !== JSON.stringify(requestedReminderSettings);
      const nonReminderRulesUnchanged = JSON.stringify(nonReminderVoucherForm(originalVoucher)) === JSON.stringify(nonReminderVoucherForm(editingVoucher));

      if (err.code === 'voucher_has_issuances' && reminderChanged && nonReminderRulesUnchanged) {
        try {
          await adminRequest(`/v1/admin/vouchers/${editingVoucher.id}/reminders`, {
            method: 'PATCH',
            body: JSON.stringify(requestedReminderSettings),
            successMessage: 'Voucher reminder settings saved successfully.'
          });
          await refreshVouchers(editingVoucher.id);
          setEditingVoucher(null);
          return;
        } catch (reminderError) {
          showAdminError('Error updating voucher reminders: ' + reminderError.message);
          return;
        }
      }
      const originalExpiry = originalVoucher?.expiry ? originalVoucher.expiry.slice(0, 10) : '';
      const requestedExpiry = editingVoucher.benefitType === 'Birthday Voucher'
        ? ''
        : (editingVoucher.expiry ? editingVoucher.expiry.slice(0, 10) : '');

      if (err.code === 'voucher_has_issuances' && requestedExpiry !== originalExpiry) {
        try {
          await adminRequest(`/v1/admin/vouchers/${editingVoucher.id}/expiry`, {
            method: 'PATCH',
            body: JSON.stringify({ expiry: requestedExpiry || null }),
            successMessage: 'Voucher redeem-until date updated successfully.'
          });
          await refreshVouchers(editingVoucher.id);
          setEditingVoucher(null);
          return;
        } catch (expiryError) {
          showAdminError('Error updating redeem-until date: ' + expiryError.message);
          return;
        }
      }
      showAdminError('Error updating voucher: ' + err.message);
    }
  };

  const handleDiscountChange = (e, isEdit = false) => {
    const val = e.target.value;

    if (isEdit) {
      setEditingVoucher({
        ...editingVoucher,
        discountValue: val
      });
    } else {
      setNewVoucher({
        ...newVoucher,
        discountValue: val
      });
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await requestAdminConfirm({
      title: 'Archive voucher?',
      message: 'This voucher will no longer appear as active, while its redemption history remains protected.',
      confirmLabel: 'Archive',
      cancelLabel: 'Back',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      await adminRequest(`/v1/admin/vouchers/${id}`, { method: 'DELETE' });

      if (selectedVoucher?.id === id) setSelectedVoucher(null);
      await refreshVouchers();
    } catch (err) {
      showAdminError('Error deleting voucher: ' + err.message);
    }
  };

  const handleDuplicate = async (voucher) => {
    try {
      const payload = {
        code: `VCH-${1000 + vouchers.length + 1}`,
        name: `${voucher.name} (Copy)`,
        type: voucher.type,
        benefitType: voucher.benefitType || voucher.type,
        paymentMode: voucher.paymentMode || 'both',
        promotionKind: voucher.promotionKind || 'standard',
        status: 'Draft',
        tier: voucher.tier,
        discountValue: Number(voucher.discountValue) || 0,
        productKinds: voucher.productKinds || [],
        subcategoryCodes: voucher.subcategoryCodes || [],
        categoryCodes: voucher.categoryCodes || [],
        eligibleItems: voucher.eligibleItems,
        rewardProductKinds: voucher.rewardProductKinds || voucher.productKinds || [],
        rewardSubcategoryCodes: voucher.rewardSubcategoryCodes || voucher.subcategoryCodes || [],
        rewardCategoryCodes: voucher.rewardCategoryCodes || voucher.categoryCodes || [],
        rewardItems: voucher.rewardItems || [],
        qualifyingQuantity: Number(voucher.qualifyingQuantity) || 1,
        rewardQuantity: Number(voucher.rewardQuantity) || 1,
        topupRewardMinTokens: voucher.topupRewardMinTokens == null
          ? null
          : Number(voucher.topupRewardMinTokens),
        expiry: voucher.benefitType === 'Birthday Voucher' ? null : (voucher.expiry || null),
        totalQty: Number(voucher.totalQty) || 1000,
        limitPerUser: Number(voucher.limitPerUser) || 1,
        description: voucher.description,
        imageUrl: voucher.imageUrl || null,
        usageInstructions: voucher.usageInstructions || "",
        audience: voucher.audience || 'all_customers',
        availabilityMode: voucher.availabilityMode || 'always',
        activeDays: voucher.activeDays || [],
        startTime: voucher.startTime || null,
        endTime: voucher.endTime || null,
        startReminderEnabled: voucher.startReminderEnabled === true || voucher.startReminderEnabled === 1,
        startReminderMinutesBefore: Number(voucher.startReminderMinutesBefore) || 0,
        endReminderEnabled: voucher.endReminderEnabled === true || voucher.endReminderEnabled === 1,
        endReminderMinutesBefore: Number(voucher.endReminderMinutesBefore) || 60,
        annualDate: voucher.annualDate || null,
        monthlyDay: voucher.monthlyDay || null
      };
      await adminRequest('/v1/admin/vouchers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await refreshVouchers();
    } catch (err) {
      showAdminError('Error duplicating voucher: ' + err.message);
    }
  };

  const openIssueModal = (voucher) => {
    setIssuingVoucher(voucher);
    setIssueReason(`Admin issued ${voucher.name}`);
    setIssuePhone("");
    setIssueRequestKey(
      globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    setShowIssueModal(true);
  };

  const isAutomaticDailyEmployeeVoucher = (voucher) =>
    voucher?.audience === 'employee_only' && voucher?.availabilityMode === 'daily';

  const handleIssueVoucher = async (e) => {
    e.preventDefault();
    if (!issuingVoucher || (!selectedCustomer && !issuePhone.trim())) {
      showAdminError('Select a customer or enter a phone number before issuing the voucher.');
      return;
    }

    if (issueInProgress) return;
    setIssueInProgress(true);
    try {
      await adminRequest(`/v1/admin/vouchers/${issuingVoucher.id}/issuances`, {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedCustomer?.id,
          phone: issuePhone.trim() || undefined,
          issuedReason: issueReason.trim() || `Admin issued ${issuingVoucher.name}`,
          issueCaseRef: `admin:${issueRequestKey}`
        })
      });
      await refreshVouchers(issuingVoucher.id);
      await loadVoucherIssuances(issuingVoucher.id);
      setShowIssueModal(false);
      setIssuingVoucher(null);
    } catch (err) {
      showAdminError('Error issuing voucher: ' + err.message);
    } finally {
      setIssueInProgress(false);
    }
  };

  const handleRevokeIssuedVoucher = async (issuedVoucherId) => {
    const reason = await requestAdminPrompt({ title: 'Revoke issued voucher', message: 'Explain why this customer voucher is being revoked. The reason is retained in the audit history.', inputLabel: 'Reason', defaultValue: 'Admin revoked voucher', multiline: true, confirmLabel: 'Revoke', tone: 'danger' });
    if (!reason) {
      return;
    }

    try {
      await adminRequest(`/v1/admin/user-vouchers/${issuedVoucherId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
      await refreshVouchers(selectedVoucher?.id);
      await loadVoucherIssuances(selectedVoucher?.id);
    } catch (err) {
      showAdminError('Error revoking issued voucher: ' + err.message);
    }
  };

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6">
      {/* 1. Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Vouchers</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Create public or manually issued vouchers. Tier and birthday-tier rewards are managed separately.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#D7E4E0] bg-[#F4F8F7] p-4 text-xs text-gray-700 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-[#1F3A34]">Use this page for campaign vouchers</p>
          <p className="mt-1 leading-relaxed">Customers see a voucher only after it is issued and while it remains redeemable.</p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => onNavigate?.('Tier Management')}
            className="inline-flex items-center justify-center rounded-lg border border-[#9FBEB7] bg-white px-3 py-2 text-xs font-bold text-[#1F3A34] transition-colors hover:bg-[#EAF4F1]"
          >
            Manage tier and birthday rewards
          </button>
        </div>
      </div>

      {/* 2. Stat Cards Row (key overview only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Voucher templates"
          value={totalVouchersCount.toLocaleString()}
          change="Updated just now"
          icon={Percent}
          iconBg="bg-[#1F3A34]"
        />
        <StatCard
          title="Active Vouchers"
          value={activeVouchersCount.toLocaleString()}
          change="Updated just now"
          icon={Gift}
          iconBg="bg-[#2E5E58]"
        />
        <StatCard
          title="Redemption Rate"
          value={redemptionRateStr}
          change="Updated just now"
          icon={Tag}
          iconBg="bg-[#D4AF7A]"
        />
      </div>

      {/* 3. Filter and Actions Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        {/* Search */}
        <div className="relative w-full max-w-[400px]">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search vouchers by name, code or benefit..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-[#2E5E58] focus:border-[#2E5E58] text-sm"
          />
        </div>

        {/* Filters and Buttons */}
        <div className="flex items-center gap-3 overflow-x-auto pb-1 -mb-1 whitespace-nowrap">
          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}
              onFocus={() => setTypeOpen(true)}
              onBlur={() => setTypeOpen(false)}
              className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
            >
              {typeFilterOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${typeOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative transition-transform duration-200 peer-focus:-rotate-180">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }}
              onFocus={() => setStatusOpen(true)}
              onBlur={() => setStatusOpen(false)}
              className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
            >
              {STATUS_TYPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* + New Voucher Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center px-4 py-2 bg-[#1F3A34] text-white border-transparent text-sm font-bold rounded-lg hover:bg-[#2E5E58] transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={16} className="mr-2" /> New Voucher
          </button>
        </div>
      </div>

      {/* 4. Main Content: Vouchers Table + Right Side Details Panel */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        {/* Table Card */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0">
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-gray-100 text-xs">
              <thead>
                <tr className="bg-white text-gray-900 font-bold border-b border-gray-100">
                  <th className="px-6 py-4 text-left">Voucher</th>
                  <th className="px-6 py-4 text-left">Reward</th>
                  <th className="px-6 py-4 text-left">Who can receive it</th>
                  <th className="px-6 py-4 text-left">Availability</th>
                  <th className="px-6 py-4 text-left">Status &amp; usage</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {paginated.length > 0 ? (
                  paginated.map((v) => {
                    const isSelected = selectedVoucher?.id === v.id;
                    const usagePercent = Math.min(100, Math.round(((v.issued || 0) / (v.totalQty || 1)) * 100));

                    return (
                      <tr
                        key={v.id}
                        onClick={() => selectVoucher(v)}
                        className={`hover:bg-gray-50/70 transition-colors ${isSelected ? "bg-gray-50" : ""
                          } cursor-pointer`}
                      >
                        {/* Voucher Name */}
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full bg-[#1F3A34] text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                              {v.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{v.name}</p>
                              <p className="text-[10px] text-gray-400">{v.id}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-3.5 text-gray-700">
                          <p className="font-semibold">{benefitTypeLabel(v.benefitType)}</p>
                          <p className="mt-0.5 max-w-[180px] truncate text-[10px] text-gray-500" title={Array.isArray(v.eligibleItems) ? v.eligibleItems.join(', ') : "All Items"}>
                            {formatVoucherEligibility(v, productKindLabels)}
                          </p>
                        </td>

                        <td className="px-6 py-3.5 text-gray-700">
                          <p className="font-medium">{audienceLabel(v.audience)}</p>
                        </td>

                        {/* Availability */}
                        <td className="px-6 py-3.5 whitespace-nowrap text-gray-600 font-medium">
                          {v.availabilityLabel || "-"}
                        </td>

                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <div className="w-32">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${v.status === "Active"
                                ? "bg-green-100 text-green-800"
                                : v.status === "Expired"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-700"
                                }`}
                            >
                              {v.status}
                            </span>
                            <p className="text-[11px] font-bold text-gray-800 mb-1">
                              {(v.issued || 0).toLocaleString()} / {v.totalQty === null ? 'Unlimited' : (v.totalQty || 0).toLocaleString()}
                            </p>
                            {v.totalQty !== null && (
                              <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-[#1F3A34] h-full rounded-full transition-all duration-300"
                                  style={{ width: `${usagePercent}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Row selection opens details; keep only record-changing actions here. */}
                        <td className="px-6 py-3.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center space-x-1.5 relative">
                            {/* Edit Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingVoucher(normalizeVoucherForm(v));
                              }}
                              className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                              title="Edit Voucher"
                            >
                              <Edit3 size={14} />
                            </button>

                            {/* More Actions Menu Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuId(actionMenuId === v.id ? null : v.id);
                              }}
                              className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                              title="More Options"
                            >
                              <MoreVertical size={14} />
                            </button>

                            {/* Dropdown Menu */}
                            {actionMenuId === v.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-100 text-left"
                              >
                                <button
                                  onClick={() => {
                                    handleDuplicate(v);
                                    setActionMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Copy size={13} /> Duplicate
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingVoucher(normalizeVoucherForm(v));
                                    setActionMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Edit3 size={13} /> Edit
                                </button>
                                <button
                                  onClick={() => {
                                    handleDelete(v.id);
                                    setActionMenuId(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <Trash2 size={13} /> Archive
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                      No vouchers found matching your filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAnalytics(true)}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Analytics
              </button>

            </div>

            <div className="flex items-center gap-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                setCurrentPage={setCurrentPage}
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filtered.length}
                itemName="vouchers"
              />
              <button
                onClick={() => {
                  const rows = [
                    ["Voucher Code", "Name", "Type", "Benefit", "Tier", "Status", "Issued", "Redeemed", "Limit", "Availability", "Audience"],
                    ...filtered.map((voucher) => [
                      `"${voucher.id}"`,
                      `"${voucher.name}"`,
                      `"${voucher.type}"`,
                      `"${voucher.benefitType || ''}"`,
                      `"${voucher.tier}"`,
                      `"${voucher.status}"`,
                      voucher.issued,
                      voucher.redeemed,
                      voucher.limitPerUser,
                      `"${voucher.availabilityLabel || ''}"`,
                      `"${audienceLabel(voucher.audience)}"`
                    ])
                  ];
                  exportToCSV(rows, "vouchers.csv");
                }}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <Download size={16} className="mr-2" /> Export
              </button>
            </div>
          </div>
        </div>

        {/* Right-Side Voucher Detail Drawer (Matching Mockup exactly) */}
        {selectedVoucher && (
          <div className="w-[360px] lg:w-[380px] bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col shrink-0 overflow-y-auto space-y-5 animate-in fade-in duration-200">
            {/* Top Close Icon and Avatar */}
            <div className="relative">
              <button
                onClick={() => setSelectedVoucher(null)}
                className="absolute top-0 right-0 text-gray-500 hover:text-black cursor-pointer"
                title="Close"
              >
                <X size={20} strokeWidth={2.5} />
              </button>

              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-[#1F3A34] text-white flex items-center justify-center font-bold text-2xl shrink-0 shadow-sm">
                  {selectedVoucher.name.charAt(0)}
                </div>
                <div className="min-w-0 pr-6">
                  <h3 className="text-base font-bold text-gray-900 leading-tight">
                    {selectedVoucher.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedVoucher.id} - Created on {selectedVoucher.created}
                  </p>
                </div>
              </div>
            </div>

            {/* Detail Tabs */}
            <div className="flex border-b border-gray-200 text-xs font-bold text-gray-500">
              {["Details", "Usage", "History"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 pb-2 text-center transition-colors cursor-pointer ${activeTab === tab
                    ? "text-gray-900 border-b-2 border-[#1F3A34]"
                    : "hover:text-gray-900"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab 1: Details Fields */}
            {activeTab === "Details" && (
              <div className="space-y-3.5 text-xs">
                <div>
                  <p className="text-gray-500 text-[11px] font-semibold mb-0.5">Description</p>
                  <p className="font-semibold text-gray-900 leading-snug">
                    {selectedVoucher.description}
                  </p>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Voucher Label</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.type}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Benefit</span>
                  <span className="font-bold text-gray-900">{benefitTypeLabel(selectedVoucher.benefitType)}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Payment mode</span>
                  <span className="font-bold text-gray-900 text-right max-w-[220px]">{paymentModeLabel(selectedVoucher.paymentMode)}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Audience</span>
                  <span className="font-bold text-gray-900">{audienceLabel(selectedVoucher.audience)}</span>
                </div>


                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Items</span>
                  <span className="font-bold text-gray-900 truncate max-w-[200px]" title={Array.isArray(selectedVoucher.eligibleItems) ? selectedVoucher.eligibleItems.join(', ') : "All Items"}>
                    {formatVoucherEligibility(selectedVoucher, productKindLabels)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Availability</span>
                  <span className="font-bold text-gray-900 text-right max-w-[200px]">{selectedVoucher.availabilityLabel || formatAvailabilityMode(selectedVoucher.availabilityMode)}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Total Quantity</span>
                  <span className="font-bold text-gray-900">
                    {selectedVoucher.totalQty === null ? "Unlimited" : (selectedVoucher.totalQty || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Issued</span>
                  <span className="font-bold text-gray-900">
                    {(selectedVoucher.issued || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Redeemed</span>
                  <span className="font-bold text-gray-900">
                    {(selectedVoucher.redeemed || 0).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Redemption Rate</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900">{selectedVoucher.rate}</span>
                    <div className="w-14 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#1F3A34] h-full rounded-full w-3/5"></div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">{limitPerUserLabel}</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.limitPerUser}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Status</span>
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-800">
                    {selectedVoucher.status}
                  </span>
                </div>
              </div>
            )}

            {/* Tab 2: Usage */}
            {activeTab === "Usage" && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-gray-500 text-[11px]">Remaining Allocation</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {selectedVoucher.totalQty === null
                      ? 'Unlimited'
                      : `${Math.max(0, (selectedVoucher.totalQty || 0) - (selectedVoucher.issued || 0)).toLocaleString()} units`}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-gray-500 text-[11px]">Redemption Success Rate</p>
                  <p className="text-lg font-bold text-green-700 mt-1">
                    {selectedVoucher.rate}
                  </p>
                </div>
                {isAutomaticDailyEmployeeVoucher(selectedVoucher) ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-900">
                    <span className="block font-bold">Issued automatically to employees</span>
                    Mark the customer as an Employee in Customers. Their daily voucher is created when they next open or refresh the customer app, with one voucher per Kuala Lumpur calendar day.
                  </div>
                ) : (
                  <button
                    onClick={() => openIssueModal(selectedVoucher)}
                    className="w-full py-2 px-3 bg-[#1F3A34] text-white rounded-lg text-sm font-bold hover:bg-[#2E5E58] transition-colors cursor-pointer"
                  >
                    Issue Voucher To Customer
                  </button>
                )}
              </div>
            )}

            {/* Tab 3: History */}
            {activeTab === "History" && (
              <div className="space-y-2.5 text-xs">
                {issuancesLoading ? (
                  <div className="p-3 bg-gray-50 rounded-lg text-gray-500">Loading issuance history...</div>
                ) : voucherIssuances.length === 0 ? (
                  <div className="p-3 bg-gray-50 rounded-lg text-gray-500">No issued vouchers yet for this template.</div>
                ) : (
                  voucherIssuances.map((issuance) => (
                    <div key={issuance.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-gray-900">{issuance.customer.displayName}</p>
                          <p className="text-[10px] text-gray-500">
                            {issuance.customer.email || issuance.customer.phone}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Issued {new Date(issuance.issuedAt).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "numeric", hour12: true })}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            Expires {new Date(issuance.expiresAt).toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "numeric", hour12: true })}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            Reason: {issuance.issuedReason}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${issuance.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : issuance.status === 'redeemed'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                            {issuance.status}
                          </span>
                          {issuance.status === 'active' && (
                            <button
                              onClick={() => handleRevokeIssuedVoucher(issuance.id)}
                              className="text-[10px] font-bold text-red-600 hover:text-red-700 cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Bottom Action Buttons */}
            <div className="pt-4 border-t border-gray-100 grid grid-cols-4 gap-2 mt-auto">
              <button
                onClick={() => openIssueModal(selectedVoucher)}
                className="py-2 px-2 border border-gray-800 rounded-lg text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> Issue
              </button>
              <button
                onClick={() => handleDuplicate(selectedVoucher)}
                className="py-2 px-2 border border-gray-800 rounded-lg text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Copy size={12} /> Duplicate
              </button>

              <button
                onClick={() => setEditingVoucher(normalizeVoucherForm(selectedVoucher))}
                className="py-2 px-2 border border-gray-800 rounded-lg text-xs font-bold text-gray-900 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Edit3 size={12} /> Edit
              </button>

              <button
                onClick={() => handleDelete(selectedVoucher.id)}
                className="py-2 px-2 border border-gray-800 rounded-lg text-xs font-bold text-gray-900 hover:bg-red-50 hover:text-red-700 transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 size={12} /> Archive
              </button>
            </div>
          </div>
        )}
      </div>

      {showIssueModal && issuingVoucher && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 bg-white/80 backdrop-blur-xs">
              <div>
                <h3 className="text-base font-bold text-gray-900 tracking-tight">Issue Voucher</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Assign <span className="font-semibold text-gray-700">{issuingVoucher.name}</span> to a customer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowIssueModal(false);
                  setIssuingVoucher(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleIssueVoucher}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block font-bold text-gray-900 mb-1 text-xs">Employee / Customer Phone Number</label>
                  <input
                    type="text"
                    value={issuePhone}
                    onChange={(e) => setIssuePhone(e.target.value)}
                    placeholder="e.g. +60123456789"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58] text-sm"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-900 mb-1 text-xs">Or Search Existing Customer</label>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by name, email, phone, or customer ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58] text-sm"
                  />
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200">
                    {customerSearchLoading ? (
                      <div className="px-3 py-3 text-xs text-gray-500">Searching customers...</div>
                    ) : customerResults.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-gray-500">
                        {customerSearch.trim().length < 2 ? 'Type at least 2 characters to search.' : 'No customers found.'}
                      </div>
                    ) : (
                      customerResults.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => setSelectedCustomer(customer)}
                          className={`w-full px-3 py-3 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer ${selectedCustomer?.id === customer.id ? 'bg-[#F3F7F6]' : ''
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900">{customer.displayName}</p>
                              <p className="text-xs text-gray-500">{customer.email || customer.phone}</p>
                            </div>
                            <span className="text-[10px] font-bold text-[#2E5E58]">{customer.tier}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-gray-900 mb-1 text-xs">Issued Reason</label>
                  <input
                    type="text"
                    value={issueReason}
                    onChange={(e) => setIssueReason(e.target.value)}
                    placeholder="Why this voucher is being issued"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58] text-sm"
                  />
                </div>

                {selectedCustomer && (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 px-3.5 py-3 text-xs text-emerald-900">
                    Selected customer: <span className="font-bold text-gray-900">{selectedCustomer.displayName}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/70">
                <button
                  type="button"
                  onClick={() => {
                    setShowIssueModal(false);
                    setIssuingVoucher(null);
                  }}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={issueInProgress}
                  className="px-6 py-2.5 bg-[#1E433A] text-white rounded-xl text-xs font-bold hover:bg-[#16342D] shadow-xs transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {issueInProgress ? 'Issuing...' : 'Issue Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Create New Voucher Modal */}
      {showCreateModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 bg-white/80 backdrop-blur-xs shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 tracking-tight">Create New Voucher</h3>
                <p className="text-xs text-gray-500 mt-0.5">Configure reward details, audience eligibility, and usage rules.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={19} />
              </button>
            </div>

            {/* Modal Form Scrollable Body */}
            <form onSubmit={handleCreateVoucher} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar text-xs flex-1">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-[11px] text-emerald-900/80 flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1E433A] mt-1 shrink-0" />
                  <div>
                    <strong className="block text-xs font-semibold text-[#1E433A]">Set up a customer reward in four steps</strong>
                    <span className="mt-0.5 block text-gray-600">Reward, eligible customers, eligible menu items, then availability and limits.</span>
                  </div>
                </div>
                <VoucherFormSection
                  number="1"
                  title="Reward"
                  description="Name the reward, choose what it gives, and optionally add the image customers see in My Rewards."
                />
                  <div>
                    <label className="block font-bold text-gray-900 mb-1">Voucher Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Free Latte, 20% Weekend Promo"
                      value={newVoucher.name}
                      onChange={(e) => setNewVoucher({ ...newVoucher, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                    />
                  </div>

                  <VoucherArtworkField
                    imageUrl={newVoucher.imageUrl}
                    onChange={(imageUrl) => setNewVoucher({ ...newVoucher, imageUrl })}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Staff label</label>
                      <input
                        list="voucher-type-labels"
                        value={newVoucher.type}
                        onChange={(e) => setNewVoucher({ ...newVoucher, type: e.target.value })}
                        placeholder="e.g. Wednesday Happy Hour"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      />
                      <datalist id="voucher-type-labels">
                        {SUGGESTED_TYPE_LABELS.map((label) => (
                          <option key={label} value={label} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Benefit</label>
                      <select
                        value={newVoucher.benefitType}
                        onChange={(e) => setNewVoucher({
                          ...newVoucher,
                          benefitType: e.target.value,
                          availabilityMode: e.target.value === 'Birthday Voucher'
                            ? 'birthday'
                            : newVoucher.availabilityMode
                        })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {BENEFIT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block font-bold text-gray-900 mb-1">Payment mode</label>
                    <select
                      value={newVoucher.paymentMode}
                      onChange={(e) => setNewVoucher({ ...newVoucher, paymentMode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                    >
                      {PAYMENT_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Choose whether this voucher can be used with C2 Tokens, future RM direct payment, or both.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#B8DDD5] bg-[#F2FBF8] p-3">
                    <label className="flex items-start gap-2 text-sm font-bold text-gray-900">
                      <input
                        type="checkbox"
                        checked={newVoucher.topupRewardMinTokens != null}
                        onChange={(e) => setNewVoucher({
                          ...newVoucher,
                          topupRewardMinTokens: e.target.checked ? 1 : null
                        })}
                        className="mt-1 h-4 w-4 accent-[#2E5E58]"
                      />
                      <span>Issue automatically after a qualifying top-up</span>
                    </label>
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-600">
                      The customer receives this voucher once after one successful top-up that meets the token amount below. Earlier top-ups are not rewarded automatically.
                    </p>
                    {newVoucher.topupRewardMinTokens != null && (
                      <div className="mt-3 max-w-xs">
                        <label className="block text-xs font-bold text-gray-800">Minimum tokens in one top-up</label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={newVoucher.topupRewardMinTokens}
                          onChange={(e) => setNewVoucher({ ...newVoucher, topupRewardMinTokens: e.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                  </div>

                  <VoucherFormSection
                    number="2"
                    title="Who can receive it"
                    description="Choose the customer group. Tier unlock rewards are linked from Tier Management. Referral campaigns are managed in Referral Program."
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Status</label>
                      <select
                        value={newVoucher.status}
                        onChange={(e) => setNewVoucher({ ...newVoucher, status: e.target.value })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        <option value="Active">Active</option>
                        <option value="Expired">Expired</option>
                        <option value="Draft">Draft</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Audience</label>
                      <select
                        value={newVoucher.audience}
                        onChange={(e) => setNewVoucher({ ...newVoucher, audience: e.target.value })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {AUDIENCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Reward rule</label>
                      <select
                        value={newVoucher.promotionKind}
                        onChange={(e) => setNewVoucher({
                          ...newVoucher,
                          promotionKind: e.target.value,
                          qualifyingQuantity: e.target.value === 'bundle' ? Math.max(Number(newVoucher.qualifyingQuantity) || 2, 2) : 1,
                          rewardQuantity: e.target.value === 'bundle' ? Math.max(Number(newVoucher.rewardQuantity) || 1, 1) : 1,
                          rewardProductKinds: e.target.value === 'bundle' ? newVoucher.rewardProductKinds : [],
                          rewardSubcategoryCodes: e.target.value === 'bundle' ? newVoucher.rewardSubcategoryCodes : [],
                          rewardCategoryCodes: e.target.value === 'bundle' ? newVoucher.rewardCategoryCodes : [],
                          rewardItems: e.target.value === 'bundle' ? newVoucher.rewardItems : []
                        })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {PROMOTION_KIND_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    {newVoucher.promotionKind === 'bundle' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">Buy Quantity</label>
                          <p className="text-[10px] text-gray-500 mb-1">Quantity the customer must buy first.</p>
                          <input
                            type="number"
                            min="1"
                            value={newVoucher.qualifyingQuantity}
                            onChange={(e) => setNewVoucher({ ...newVoucher, qualifyingQuantity: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">Get Quantity</label>
                          <p className="text-[10px] text-gray-500 mb-1">Free items granted after the buy condition is met.</p>
                          <input
                            type="number"
                            min="1"
                            value={newVoucher.rewardQuantity}
                            onChange={(e) => setNewVoucher({ ...newVoucher, rewardQuantity: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">Items per redemption</label>
                        <p className="text-[10px] text-gray-500 mb-1">How many items this voucher gives per use.</p>
                        <input
                          type="number"
                          min="1"
                          value={newVoucher.rewardQuantity}
                          onChange={(e) => setNewVoucher({ ...newVoucher, rewardQuantity: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                  </div>


                  {(newVoucher.benefitType !== "Free Drink" && newVoucher.benefitType !== "Free Food" && newVoucher.benefitType !== "Birthday Voucher") && (
                    <div className="w-1/2 pr-1.5">
                      <label className="block font-bold text-gray-900 mb-1">Discount Value</label>
                      <input
                        type="number"
                        placeholder="e.g. 20"
                        value={newVoucher.discountValue}
                        onChange={(e) => handleDiscountChange(e, false)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      />
                    </div>
                  )}

                  <VoucherFormSection
                    number="3"
                    title="Eligible menu items"
                    description="Choose what this reward can be used on. Leave it as All Items for the simplest setup."
                  />
                  <ScopeSelectionSection
                    categoriesLabel="Menu categories"
                    specificItemsLabel="Specific items (optional)"
                    menuTaxonomy={menuTaxonomy}
                    selectedCategoryCodes={newVoucher.categoryCodes || []}
                    selectedItems={newVoucher.eligibleItems || []}
                    onCategoryCodesChange={(categoryCodes) =>
                      setNewVoucher((current) => ({
                        ...current,
                        categoryCodes,
                        productKinds: [],
                        subcategoryCodes: []
                      }))
                    }
                    onItemsChange={(eligibleItems) =>
                      setNewVoucher((current) => ({ ...current, eligibleItems }))
                    }
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <VoucherFormSection
                        number="4"
                        title="Availability and limits"
                        description="Choose when it can be used and how many times it is available."
                      />
                      <label className="block font-bold text-gray-900 mb-1 mt-3">Availability schedule</label>
                      <select
                        value={newVoucher.availabilityMode}
                        disabled={newVoucher.benefitType === 'Birthday Voucher'}
                        onChange={(e) => setNewVoucher({
                          ...newVoucher,
                          availabilityMode: e.target.value,
                          activeDays: [],
                          annualDate: "",
                          monthlyDay: "",
                          ...(e.target.value === 'always' ? { startTime: '', endTime: '' } : {})
                        })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {AVAILABILITY_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    {newVoucher.benefitType !== 'Birthday Voucher' && (
                      <div className="col-span-2">
                        <label className="block font-bold text-gray-900 mb-1">
                          {newVoucher.availabilityMode === 'always' ? 'Redeem until' : 'Campaign end date'} <span className="font-normal text-gray-400">(optional)</span>
                        </label>
                        <input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={newVoucher.expiry ? newVoucher.expiry.slice(0, 10) : ''}
                          onChange={(e) => setNewVoucher({ ...newVoucher, expiry: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          {newVoucher.availabilityMode === 'always'
                            ? 'The voucher can be redeemed until the end of this date.'
                            : 'Stops new recurring vouchers after this date. Each issued voucher closes at the end of its daily time window.'}
                        </p>
                      </div>
                    )}
                    {newVoucher.availabilityMode !== "always" && (
                      <>
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">Start Time <span className="font-normal text-gray-400">(optional)</span></label>
                          <input
                            type="time"
                            value={newVoucher.startTime}
                            onChange={(e) => setNewVoucher({ ...newVoucher, startTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">End Time <span className="font-normal text-gray-400">(optional)</span></label>
                          <input
                            type="time"
                            value={newVoucher.endTime}
                            onChange={(e) => setNewVoucher({ ...newVoucher, endTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                      </>
                    )}
                    <VoucherReminderSettings
                      value={newVoucher}
                      onChange={(changes) => setNewVoucher((current) => ({ ...current, ...changes }))}
                    />
                    {newVoucher.availabilityMode === "annual" && (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">Annual Day <span className="font-normal text-gray-400">(repeats yearly)</span></label>
                        <input
                          type="date"
                          value={newVoucher.annualDate}
                          onChange={(e) => setNewVoucher({ ...newVoucher, annualDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                    {newVoucher.availabilityMode === "monthly" && (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">Day of Month <span className="font-normal text-gray-400">(1-28)</span></label>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={newVoucher.monthlyDay}
                          onChange={(e) => setNewVoucher({ ...newVoucher, monthlyDay: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                  </div>
                  {(newVoucher.availabilityMode === "annual" || newVoucher.availabilityMode === "birthday" || newVoucher.availabilityMode === "monthly") && (
                    <p className="-mt-1 text-xs leading-5 text-gray-500">
                      {newVoucher.availabilityMode === "birthday"
                        ? 'Available only during the customer\'s birthday month. The customer\'s saved birthday determines eligibility.'
                        : 'A new reward is issued once per customer during each matching repeat period. Times are optional.'}
                    </p>
                  )}

                  {newVoucher.availabilityMode === "weekly" && (
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Available Days</label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3">
                        {WEEKDAY_OPTIONS.map((day) => (
                          <label key={day} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={newVoucher.activeDays.includes(day)}
                              onChange={() => {
                                const activeDays = newVoucher.activeDays.includes(day)
                                  ? newVoucher.activeDays.filter((value) => value !== day)
                                  : [...newVoucher.activeDays, day];
                                setNewVoucher({ ...newVoucher, activeDays });
                              }}
                              className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-900">
                          {newVoucher.availabilityMode === 'always' ? 'Total vouchers available' : 'Total vouchers per occurrence'}
                        </label>
                        <label className="flex items-center text-[10px] text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newVoucher.totalQty === null || newVoucher.totalQty === ""}
                            onChange={(e) => setNewVoucher({ ...newVoucher, totalQty: e.target.checked ? null : 1000 })}
                            className="mr-1 rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                          />
                          Unlimited
                        </label>
                      </div>
                      <input
                        type="number"
                        min="1"
                        disabled={newVoucher.totalQty === null || newVoucher.totalQty === ""}
                        value={newVoucher.totalQty === null ? "" : newVoucher.totalQty}
                        onChange={(e) => setNewVoucher({ ...newVoucher, totalQty: e.target.value })}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58] ${newVoucher.totalQty === null || newVoucher.totalQty === "" ? 'bg-gray-100 text-gray-400' : ''}`}
                        placeholder={newVoucher.totalQty === null || newVoucher.totalQty === "" ? "Unlimited" : "e.g. 1000"}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">
                        {newVoucher.availabilityMode === 'always' ? limitPerUserLabel : 'Max uses per customer per occurrence'}
                      </label>
                      <p className="text-[10px] text-gray-500 mb-1">
                        {newVoucher.availabilityMode !== 'always'
                          ? 'The allocation and customer limit reset for each matching day, month, year, or birthday period.'
                          : 'The same customer can use this voucher only this many times.'}
                      </p>
                      <input
                        type="number"
                        min="1"
                        value={newVoucher.limitPerUser}
                        onChange={(e) => setNewVoucher({ ...newVoucher, limitPerUser: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      />
                    </div>
                  </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Description</label>
                      <textarea
                        rows="2"
                        placeholder="Terms and redemption instructions..."
                        value={newVoucher.description}
                        onChange={(e) => setNewVoucher({ ...newVoucher, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      ></textarea>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">How to use</label>
                      <p className="text-[10px] text-gray-500 mb-1">
                        Write the customer-facing redemption steps. This text appears in the app.
                      </p>
                      <textarea
                        rows="3"
                        placeholder="e.g. Add one eligible drink, then apply this voucher in Checkout."
                        value={newVoucher.usageInstructions}
                        onChange={(e) => setNewVoucher({ ...newVoucher, usageInstructions: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      ></textarea>
                    </div>
                  </div>

                  {/* Modal Sticky Footer */}
                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/70 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-[#1E433A] text-white rounded-xl text-xs font-bold hover:bg-[#16342D] shadow-xs transition-all cursor-pointer"
                    >
                      Create Voucher
                    </button>
                  </div>
                </form>
          </div>
        </div>,
        document.body
      )}

      {/*Edit Voucher Modal*/}
      {editingVoucher && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 sm:p-6 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 bg-white/80 backdrop-blur-xs shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight">Edit Voucher</h3>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[11px] font-bold text-[#1E433A] border border-emerald-100">
                    {editingVoucher.id}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Modify voucher settings, customer eligibility, or redemption rules.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingVoucher(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X size={19} />
              </button>
            </div>

            {/* Modal Form Scrollable Body */}
            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto px-6 py-5 space-y-4 custom-scrollbar text-xs flex-1">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-[11px] text-emerald-900/80 flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#1E433A] mt-1 shrink-0" />
                  <div>
                    <strong className="block text-xs font-semibold text-[#1E433A]">Update this reward in four steps</strong>
                    <span className="mt-0.5 block text-gray-600">Reward, eligible customers, eligible menu items, then availability and limits.</span>
                  </div>
                </div>
                <VoucherFormSection
                  number="1"
                  title="Reward"
                  description="Update the reward name, benefit, and the image customers see in My Rewards."
                />
                  <div>
                    <label className="block font-bold text-gray-900 mb-1">Voucher Name</label>
                    <input
                      type="text"
                      required
                      value={editingVoucher.name}
                      onChange={(e) => setEditingVoucher({ ...editingVoucher, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                    />
                  </div>

                  <VoucherArtworkField
                    imageUrl={editingVoucher.imageUrl}
                    onChange={(imageUrl) => setEditingVoucher({ ...editingVoucher, imageUrl })}
                  />

                  <VoucherFormSection
                    number="2"
                    title="Who can receive it"
                    description="Choose the customer group. Tier unlock rewards are linked from Tier Management. Referral campaigns are managed in Referral Program."
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Staff label</label>
                      <input
                        list="voucher-type-labels"
                        value={editingVoucher.type}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Benefit</label>
                      <select
                        value={editingVoucher.benefitType}
                        onChange={(e) => setEditingVoucher({
                          ...editingVoucher,
                          benefitType: e.target.value,
                          availabilityMode: e.target.value === 'Birthday Voucher'
                            ? 'birthday'
                            : editingVoucher.availabilityMode
                        })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {BENEFIT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block font-bold text-gray-900 mb-1">Payment mode</label>
                    <select
                      value={editingVoucher.paymentMode}
                      onChange={(e) => setEditingVoucher({ ...editingVoucher, paymentMode: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                    >
                      {PAYMENT_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Existing vouchers default to both modes unless they are token-discount vouchers.
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#B8DDD5] bg-[#F2FBF8] p-3">
                    <label className="flex items-start gap-2 text-sm font-bold text-gray-900">
                      <input
                        type="checkbox"
                        checked={editingVoucher.topupRewardMinTokens != null}
                        disabled={Number(editingVoucher.issued || 0) > 0}
                        onChange={(e) => setEditingVoucher({
                          ...editingVoucher,
                          topupRewardMinTokens: e.target.checked ? 1 : null
                        })}
                        className="mt-1 h-4 w-4 accent-[#2E5E58] disabled:cursor-not-allowed disabled:opacity-50"
                      />
                      <span>Issue automatically after a qualifying top-up</span>
                    </label>
                    <p className="mt-1 text-[11px] leading-relaxed text-gray-600">
                      Issues once after one successful top-up that meets this minimum. It does not retrospectively issue vouchers for earlier payments.
                    </p>
                    {Number(editingVoucher.issued || 0) > 0 && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-900">
                        This setting is locked because this voucher has already been issued. Duplicate it to create a new top-up reward without changing rewards customers already received.
                      </p>
                    )}
                    {editingVoucher.topupRewardMinTokens != null && (
                      <div className="mt-3 max-w-xs">
                        <label className="block text-xs font-bold text-gray-800">Minimum tokens in one top-up</label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={editingVoucher.topupRewardMinTokens}
                          disabled={Number(editingVoucher.issued || 0) > 0}
                          onChange={(e) => setEditingVoucher({ ...editingVoucher, topupRewardMinTokens: e.target.value })}
                          className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Status</label>
                      <select
                        value={editingVoucher.status}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, status: e.target.value })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        <option value="Active">Active</option>
                        <option value="Expired">Expired</option>
                        <option value="Draft">Draft</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Audience</label>
                      <select
                        value={editingVoucher.audience}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, audience: e.target.value })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {AUDIENCE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Reward rule</label>
                      <select
                        value={editingVoucher.promotionKind}
                        onChange={(e) => setEditingVoucher({
                          ...editingVoucher,
                          promotionKind: e.target.value,
                          qualifyingQuantity: e.target.value === 'bundle' ? Math.max(Number(editingVoucher.qualifyingQuantity) || 2, 2) : 1,
                          rewardQuantity: e.target.value === 'bundle' ? Math.max(Number(editingVoucher.rewardQuantity) || 1, 1) : 1,
                          rewardProductKinds: e.target.value === 'bundle' ? editingVoucher.rewardProductKinds : [],
                          rewardSubcategoryCodes: e.target.value === 'bundle' ? editingVoucher.rewardSubcategoryCodes : [],
                          rewardCategoryCodes: e.target.value === 'bundle' ? editingVoucher.rewardCategoryCodes : [],
                          rewardItems: e.target.value === 'bundle' ? editingVoucher.rewardItems : []
                        })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {PROMOTION_KIND_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    {editingVoucher.promotionKind === 'bundle' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">Buy Quantity</label>
                          <p className="text-[10px] text-gray-500 mb-1">Quantity the customer must buy first.</p>
                          <input
                            type="number"
                            min="1"
                            value={editingVoucher.qualifyingQuantity}
                            onChange={(e) => setEditingVoucher({ ...editingVoucher, qualifyingQuantity: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">Get Quantity</label>
                          <p className="text-[10px] text-gray-500 mb-1">Free items granted after the buy condition is met.</p>
                          <input
                            type="number"
                            min="1"
                            value={editingVoucher.rewardQuantity}
                            onChange={(e) => setEditingVoucher({ ...editingVoucher, rewardQuantity: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">Items per redemption</label>
                        <p className="text-[10px] text-gray-500 mb-1">How many items this voucher gives per use.</p>
                        <input
                          type="number"
                          min="1"
                          value={editingVoucher.rewardQuantity}
                          onChange={(e) => setEditingVoucher({ ...editingVoucher, rewardQuantity: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                  </div>


                  {(editingVoucher.benefitType !== "Free Drink" && editingVoucher.benefitType !== "Free Food" && editingVoucher.benefitType !== "Birthday Voucher") && (
                    <div className="w-1/2 pr-1.5">
                      <label className="block font-bold text-gray-900 mb-1">Discount Value</label>
                      <input
                        type="number"
                        placeholder="e.g. 20"
                        value={editingVoucher.discountValue || ""}
                        onChange={(e) => handleDiscountChange(e, true)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      />
                    </div>
                  )}

                  <VoucherFormSection
                    number="3"
                    title="Eligible menu items"
                    description="Choose what this reward can be used on. Leave it as All Items for the simplest setup."
                  />
                  <ScopeSelectionSection
                    categoriesLabel="Menu categories"
                    specificItemsLabel="Specific items (optional)"
                    menuTaxonomy={menuTaxonomy}
                    selectedCategoryCodes={editingVoucher.categoryCodes || []}
                    selectedItems={editingVoucher.eligibleItems || []}
                    onCategoryCodesChange={(categoryCodes) =>
                      setEditingVoucher((current) => ({
                        ...current,
                        categoryCodes,
                        productKinds: [],
                        subcategoryCodes: []
                      }))
                    }
                    onItemsChange={(eligibleItems) =>
                      setEditingVoucher((current) => ({ ...current, eligibleItems }))
                    }
                  />

                  {editingVoucher.promotionKind === 'bundle' && (
                    <ScopeSelectionSection
                      categoriesLabel="Reward menu categories"
                      specificItemsLabel="Reward specific items (optional)"
                      menuTaxonomy={menuTaxonomy}
                      selectedCategoryCodes={editingVoucher.rewardCategoryCodes || []}
                      selectedItems={editingVoucher.rewardItems || []}
                      onCategoryCodesChange={(rewardCategoryCodes) =>
                        setEditingVoucher((current) => ({
                          ...current,
                          rewardCategoryCodes,
                          rewardProductKinds: [],
                          rewardSubcategoryCodes: []
                        }))
                      }
                      onItemsChange={(rewardItems) =>
                        setEditingVoucher((current) => ({ ...current, rewardItems }))
                      }
                    />
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <VoucherFormSection
                        number="4"
                        title="Availability and limits"
                        description="Choose when it can be used and how many times it is available."
                      />
                      <label className="block font-bold text-gray-900 mb-1 mt-3">Availability schedule</label>
                      <select
                        value={editingVoucher.availabilityMode}
                        disabled={editingVoucher.benefitType === 'Birthday Voucher'}
                        onChange={(e) => setEditingVoucher({
                          ...editingVoucher,
                          availabilityMode: e.target.value,
                          activeDays: [],
                          annualDate: "",
                          monthlyDay: "",
                          ...(e.target.value === 'always' ? { startTime: '', endTime: '' } : {})
                        })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {AVAILABILITY_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    {editingVoucher.benefitType !== 'Birthday Voucher' && (
                      <div className="col-span-2">
                        <label className="block font-bold text-gray-900 mb-1">
                          {editingVoucher.availabilityMode === 'always' ? 'Redeem until' : 'Campaign end date'} <span className="font-normal text-gray-400">(optional)</span>
                        </label>
                        <input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={editingVoucher.expiry ? editingVoucher.expiry.slice(0, 10) : ''}
                          onChange={(e) => setEditingVoucher({ ...editingVoucher, expiry: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          {editingVoucher.availabilityMode === 'always'
                            ? 'The voucher can be redeemed until the end of this date.'
                            : 'Stops new recurring vouchers after this date. Each issued voucher closes at the end of its daily time window.'}
                        </p>
                      </div>
                    )}
                    {editingVoucher.availabilityMode !== "always" && (
                      <>
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">Start Time <span className="font-normal text-gray-400">(optional)</span></label>
                          <input
                            type="time"
                            value={editingVoucher.startTime || ""}
                            onChange={(e) => setEditingVoucher({ ...editingVoucher, startTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">End Time <span className="font-normal text-gray-400">(optional)</span></label>
                          <input
                            type="time"
                            value={editingVoucher.endTime || ""}
                            onChange={(e) => setEditingVoucher({ ...editingVoucher, endTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                      </>
                    )}
                    <VoucherReminderSettings
                      value={editingVoucher}
                      onChange={(changes) => setEditingVoucher((current) => ({ ...current, ...changes }))}
                    />
                    {editingVoucher.availabilityMode === "annual" && (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">Annual Day <span className="font-normal text-gray-400">(repeats yearly)</span></label>
                        <input
                          type="date"
                          value={editingVoucher.annualDate || ""}
                          onChange={(e) => setEditingVoucher({ ...editingVoucher, annualDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                    {editingVoucher.availabilityMode === "monthly" && (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">Day of Month <span className="font-normal text-gray-400">(1-28)</span></label>
                        <input
                          type="number"
                          min="1"
                          max="28"
                          value={editingVoucher.monthlyDay || ""}
                          onChange={(e) => setEditingVoucher({ ...editingVoucher, monthlyDay: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                  </div>
                  {(editingVoucher.availabilityMode === "annual" || editingVoucher.availabilityMode === "birthday" || editingVoucher.availabilityMode === "monthly") && (
                    <p className="-mt-1 text-xs leading-5 text-gray-500">
                      {editingVoucher.availabilityMode === "birthday"
                        ? 'Available only during the customer\'s birthday month. The customer\'s saved birthday determines eligibility.'
                        : 'A new reward is issued once per customer during each matching repeat period. Times are optional.'}
                    </p>
                  )}

                  {editingVoucher.availabilityMode === "weekly" && (
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Available Days</label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3">
                        {WEEKDAY_OPTIONS.map((day) => (
                          <label key={day} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={(editingVoucher.activeDays || []).includes(day)}
                              onChange={() => {
                                const activeDays = (editingVoucher.activeDays || []).includes(day)
                                  ? editingVoucher.activeDays.filter((value) => value !== day)
                                  : [...(editingVoucher.activeDays || []), day];
                                setEditingVoucher({ ...editingVoucher, activeDays });
                              }}
                              className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-bold text-gray-900">
                          {editingVoucher.availabilityMode === 'always' ? 'Total vouchers available' : 'Total vouchers per occurrence'}
                        </label>
                        <label className="flex items-center text-[10px] text-gray-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingVoucher.totalQty === null || editingVoucher.totalQty === ""}
                            onChange={(e) => setEditingVoucher({ ...editingVoucher, totalQty: e.target.checked ? null : 1000 })}
                            className="mr-1 rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                          />
                          Unlimited
                        </label>
                      </div>
                      <input
                        type="number"
                        min="1"
                        disabled={editingVoucher.totalQty === null || editingVoucher.totalQty === ""}
                        value={editingVoucher.totalQty === null ? "" : editingVoucher.totalQty}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, totalQty: e.target.value })}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58] ${editingVoucher.totalQty === null || editingVoucher.totalQty === "" ? 'bg-gray-100 text-gray-400' : ''}`}
                        placeholder={editingVoucher.totalQty === null || editingVoucher.totalQty === "" ? "Unlimited" : "e.g. 1000"}
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">
                        {editingVoucher.availabilityMode === 'always' ? limitPerUserLabel : 'Max uses per customer per occurrence'}
                      </label>
                      <p className="text-[10px] text-gray-500 mb-1">
                        {editingVoucher.availabilityMode !== 'always'
                          ? 'The allocation and customer limit reset for each matching day, month, year, or birthday period.'
                          : 'The same customer can use this voucher only this many times.'}
                      </p>
                      <input
                        type="number"
                        min="1"
                        value={editingVoucher.limitPerUser}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, limitPerUser: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      />
                    </div>
                  </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Description</label>
                      <textarea
                        rows="2"
                        value={editingVoucher.description}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      ></textarea>
                    </div>

                    <div>
                      <label className="block font-bold text-gray-900 mb-1">How to use</label>
                      <p className="text-[10px] text-gray-500 mb-1">
                        Write the customer-facing redemption steps. This text appears in the app.
                      </p>
                      <textarea
                        rows="3"
                        placeholder="e.g. Add one eligible drink, then apply this voucher in Checkout."
                        value={editingVoucher.usageInstructions || ""}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, usageInstructions: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      ></textarea>
                    </div>
                  </div>

                  {/* Modal Sticky Footer */}
                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/70 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingVoucher(null)}
                      className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-[#1E433A] text-white rounded-xl text-xs font-bold hover:bg-[#16342D] shadow-xs transition-all cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Vouchers;
