import React, { useState, useEffect } from "react";
import { adminRequest } from '../lib/adminApi';
import {
  Search, ChevronDown, Download, Plus,
  Eye, Edit3, MoreVertical, X, Copy,
  Trash2, ArrowLeft, Percent, Gift,
  Tag
} from "lucide-react";
import Pagination from './Pagination';
import VouchersAnalytics from "./VouchersAnalytics";
import { exportToCSV } from '../utils/exportToCSV';

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
  "Referral Reward"
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
  { value: "annual", label: "Annual Event + Time" }
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

const createEmptyVoucherForm = () => ({
  name: "",
  type: "Happy Hour",
  benefitType: "Free Drink",
  promotionKind: "standard",
  status: "Active",
  tier: "All Tiers",
  reward: "",
  discountValue: "",
  productKinds: [],
  subcategoryCodes: [],
  eligibleItems: [],
  rewardProductKinds: [],
  rewardSubcategoryCodes: [],
  rewardItems: [],
  qualifyingQuantity: 1,
  rewardQuantity: 1,
  totalQty: 1000,
  limitPerUser: 1,
  description: "",
  audience: "all_customers",
  availabilityMode: "always",
  activeDays: [],
  startTime: "",
  endTime: "",
  annualDate: ""
});

const normalizeVoucherForm = (voucher) => ({
  ...createEmptyVoucherForm(),
  ...voucher,
  benefitType: voucher?.benefitType || voucher?.type || "Free Drink",
  type: voucher?.type || voucher?.benefitType || "Voucher",
  promotionKind: voucher?.promotionKind || "standard",
  productKinds: Array.isArray(voucher?.productKinds) ? voucher.productKinds : [],
  subcategoryCodes: Array.isArray(voucher?.subcategoryCodes) ? voucher.subcategoryCodes : [],
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
  rewardItems: Array.isArray(voucher?.rewardItems)
    ? voucher.rewardItems
    : Array.isArray(voucher?.eligibleItems)
      ? voucher.eligibleItems
      : [],
  qualifyingQuantity: Number(voucher?.qualifyingQuantity) || 1,
  rewardQuantity: Number(voucher?.rewardQuantity) || 1,
  activeDays: Array.isArray(voucher?.activeDays) ? voucher.activeDays : [],
  startTime: voucher?.startTime || "",
  endTime: voucher?.endTime || "",
  annualDate: voucher?.annualDate ? `2026-${voucher.annualDate}` : "",
  audience: voucher?.audience || "all_customers",
  availabilityMode: voucher?.availabilityMode || "always"
});

const audienceLabel = (value) =>
  AUDIENCE_OPTIONS.find((option) => option.value === value)?.label || "All Customers";

const benefitTypeLabel = (value) => {
  if (value === "Percentage Off" || value === "Cash Voucher" || value === "Token Discount") {
    return "Discount";
  }

  return value || "-";
};

const limitPerUserLabel = "Max Uses Per Customer";

const formatAvailabilityMode = (value) =>
  AVAILABILITY_MODE_OPTIONS.find((option) => option.value === value)?.label || "Always Available";

const deriveMenuTaxonomy = (response) => {
  const categories = response?.categories || [];
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
    groupedItems,
    subcategories: subcategories.filter((subcategory) => subcategory.is_active),
    productKinds: productKinds.length > 0 ? productKinds : DEFAULT_PRODUCT_KIND_OPTIONS,
    items
  };
};

const buildScopedGroupedItems = (menuTaxonomy, selectedProductKinds = [], selectedSubcategoryCodes = []) => {
  const productKinds = Array.isArray(selectedProductKinds) ? selectedProductKinds.filter(Boolean) : [];
  const subcategoryCodes = Array.isArray(selectedSubcategoryCodes) ? selectedSubcategoryCodes.filter(Boolean) : [];
  const hasProductKindFilter = productKinds.length > 0;
  const hasSubcategoryFilter = subcategoryCodes.length > 0;
  const scopedItems = (menuTaxonomy.items || []).filter((item) => {
    const matchesProductKind = !hasProductKindFilter || productKinds.includes(item.productKindCode);
    const matchesSubcategory = !hasSubcategoryFilter || (item.subcategoryCode && subcategoryCodes.includes(item.subcategoryCode));
    return matchesProductKind && matchesSubcategory;
  });

  const groupedItems = scopedItems.reduce((acc, item) => {
    const groupLabel = item.categoryLabel || 'Items';
    if (!acc[groupLabel]) {
      acc[groupLabel] = [];
    }
    acc[groupLabel].push(item.name);
    return acc;
  }, {});

  Object.keys(groupedItems).forEach((key) => {
    groupedItems[key] = Array.from(new Set(groupedItems[key])).sort((a, b) => a.localeCompare(b));
  });

  return groupedItems;
};

const toggleListValue = (list = [], value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const isAllValuesSelected = (selected = [], options = []) => {
  if (!Array.isArray(options) || options.length === 0) return false;
  const selectedSet = new Set((selected || []).filter(Boolean));
  return options.every((option) => selectedSet.has(option));
};

const toggleAllValues = (selected = [], options = []) =>
  isAllValuesSelected(selected, options) ? [] : Array.from(new Set(options.filter(Boolean)));

const formatScopeSelection = (voucher, prefix = "", productKindLabels = {}) => {
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

const ScrollableCheckboxList = ({ groupedItems = {}, selected = [], hasFilters = false, onChange }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const currentSelected = selected || [];
  const scopeItems = Object.values(groupedItems).flat();
  const allItemsSelected =
    currentSelected.includes(ALL_ITEMS_OPTION) ||
    (scopeItems.length > 0 && scopeItems.every((item) => currentSelected.includes(item)));

  const toggleOption = (option) => {
    let newSelected;

    if (option === ALL_ITEMS_OPTION) {
      onChange(allItemsSelected ? [] : Array.from(new Set(scopeItems)));
      return;
    }

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
        <div className="mb-3 border-b border-gray-100 pb-2">
          <label className="flex items-center px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={allItemsSelected}
              onChange={() => toggleOption(ALL_ITEMS_OPTION)}
              className="mr-2.5 rounded text-[#2E5E58] focus:ring-[#2E5E58]"
            />
            <span className="text-xs font-bold text-gray-700">{ALL_ITEMS_OPTION}</span>
          </label>
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

const Vouchers = () => {
  const [vouchers, setVouchers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [voucherIssuances, setVoucherIssuances] = useState([]);
  const [issuancesLoading, setIssuancesLoading] = useState(false);
  const [menuTaxonomy, setMenuTaxonomy] = useState(() => deriveMenuTaxonomy({ categories: [], subcategories: [] }));

  const [typeFilter, setTypeFilter] = useState("All Type");
  const [statusFilter, setStatusFilter] = useState("All Status");
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

  const refreshVouchers = async (selectedVoucherId = selectedVoucher?.id) => {
    const response = await adminRequest('/v1/admin/vouchers');
    const nextVouchers = response.vouchers || [];
    setVouchers(nextVouchers);
    if (selectedVoucherId) {
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
    const fetchVouchers = async () => {
      try {
        await Promise.all([
          refreshVouchers(),
          adminRequest('/v1/admin/menu').then((response) => setMenuTaxonomy(deriveMenuTaxonomy(response)))
        ]);
      } catch (err) {
        console.error('Failed to fetch vouchers', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVouchers();
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
      promotionKind: newVoucher.promotionKind,
      status: newVoucher.status,
      tier: newVoucher.tier,
      discountValue: Number(newVoucher.discountValue) || 0,
      productKinds: newVoucher.productKinds,
      subcategoryCodes: newVoucher.subcategoryCodes,
      eligibleItems: newVoucher.eligibleItems.length > 0 ? newVoucher.eligibleItems : [ALL_ITEMS_OPTION],
      rewardProductKinds: newVoucher.rewardProductKinds,
      rewardSubcategoryCodes: newVoucher.rewardSubcategoryCodes,
      rewardItems: newVoucher.rewardItems.length > 0 ? newVoucher.rewardItems : [],
      qualifyingQuantity: Number(newVoucher.qualifyingQuantity) || 1,
      rewardQuantity: Number(newVoucher.rewardQuantity) || 1,
      expiry: null,
      totalQty: newVoucher.totalQty === null || newVoucher.totalQty === "" ? null : Number(newVoucher.totalQty),
      limitPerUser: Number(newVoucher.limitPerUser) || 1,
      description: newVoucher.description || `Redeem ${newVoucher.name}`,
      audience: newVoucher.audience,
      availabilityMode: newVoucher.availabilityMode,
      activeDays: newVoucher.activeDays,
      startTime: newVoucher.startTime || null,
      endTime: newVoucher.endTime || null,
      annualDate: newVoucher.annualDate || null
    };

    try {
      await adminRequest('/v1/admin/vouchers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await refreshVouchers();
    } catch (err) {
      alert('Error creating voucher: ' + err.message);
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
        promotionKind: editingVoucher.promotionKind,
        status: editingVoucher.status,
        tier: editingVoucher.tier,
        discountValue: Number(editingVoucher.discountValue) || 0,
        productKinds: editingVoucher.productKinds || [],
        subcategoryCodes: editingVoucher.subcategoryCodes || [],
        eligibleItems: editingVoucher.eligibleItems,
        rewardProductKinds: editingVoucher.rewardProductKinds || [],
        rewardSubcategoryCodes: editingVoucher.rewardSubcategoryCodes || [],
        rewardItems: editingVoucher.rewardItems || [],
        qualifyingQuantity: Number(editingVoucher.qualifyingQuantity) || 1,
        rewardQuantity: Number(editingVoucher.rewardQuantity) || 1,
        expiry: null,
        totalQty: editingVoucher.totalQty === null || editingVoucher.totalQty === "" ? null : Number(editingVoucher.totalQty),
        limitPerUser: Number(editingVoucher.limitPerUser) || 1,
        description: editingVoucher.description,
        audience: editingVoucher.audience,
        availabilityMode: editingVoucher.availabilityMode,
        activeDays: editingVoucher.activeDays,
        startTime: editingVoucher.startTime || null,
        endTime: editingVoucher.endTime || null,
        annualDate: editingVoucher.annualDate || null
      };

      await adminRequest(`/v1/admin/vouchers/${editingVoucher.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      await refreshVouchers(editingVoucher.id);
      setEditingVoucher(null);
    } catch (err) {
      alert('Error updating voucher: ' + err.message);
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
    if (!confirm("Archive this voucher? It will no longer appear as active.")) {
      return;
    }

    try {
      await adminRequest(`/v1/admin/vouchers/${id}`, { method: 'DELETE' });

      if (selectedVoucher?.id === id) setSelectedVoucher(null);
      await refreshVouchers();
    } catch (err) {
      alert('Error deleting voucher: ' + err.message);
    }
  };

  const handleDuplicate = async (voucher) => {
    try {
      const payload = {
        code: `VCH-${1000 + vouchers.length + 1}`,
        name: `${voucher.name} (Copy)`,
        type: voucher.type,
        benefitType: voucher.benefitType || voucher.type,
        promotionKind: voucher.promotionKind || 'standard',
        status: 'Draft',
        tier: voucher.tier,
        discountValue: Number(voucher.discountValue) || 0,
        productKinds: voucher.productKinds || [],
        subcategoryCodes: voucher.subcategoryCodes || [],
        eligibleItems: voucher.eligibleItems,
        rewardProductKinds: voucher.rewardProductKinds || voucher.productKinds || [],
        rewardSubcategoryCodes: voucher.rewardSubcategoryCodes || voucher.subcategoryCodes || [],
        rewardItems: voucher.rewardItems || [],
        qualifyingQuantity: Number(voucher.qualifyingQuantity) || 1,
        rewardQuantity: Number(voucher.rewardQuantity) || 1,
        expiry: null,
        totalQty: Number(voucher.totalQty) || 1000,
        limitPerUser: Number(voucher.limitPerUser) || 1,
        description: voucher.description,
        audience: voucher.audience || 'all_customers',
        availabilityMode: voucher.availabilityMode || 'always',
        activeDays: voucher.activeDays || [],
        startTime: voucher.startTime || null,
        endTime: voucher.endTime || null,
        annualDate: voucher.annualDate || null
      };
      await adminRequest('/v1/admin/vouchers', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await refreshVouchers();
    } catch (err) {
      alert('Error duplicating voucher: ' + err.message);
    }
  };

  const openIssueModal = (voucher) => {
    setIssuingVoucher(voucher);
    setIssueReason(`Admin issued ${voucher.name}`);
    setIssuePhone("");
    setShowIssueModal(true);
  };

  const handleIssueVoucher = async (e) => {
    e.preventDefault();
    if (!issuingVoucher || (!selectedCustomer && !issuePhone.trim())) {
      alert('Select a customer or enter a phone number before issuing the voucher.');
      return;
    }

    try {
      await adminRequest(`/v1/admin/vouchers/${issuingVoucher.id}/issuances`, {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedCustomer?.id,
          phone: issuePhone.trim() || undefined,
          issuedReason: issueReason.trim() || `Admin issued ${issuingVoucher.name}`
        })
      });
      await refreshVouchers(issuingVoucher.id);
      await loadVoucherIssuances(issuingVoucher.id);
      setShowIssueModal(false);
      setIssuingVoucher(null);
    } catch (err) {
      alert('Error issuing voucher: ' + err.message);
    }
  };

  const handleRevokeIssuedVoucher = async (issuedVoucherId) => {
    const reason = window.prompt('Reason for revoking this issued voucher?', 'Admin revoked voucher');
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
      alert('Error revoking issued voucher: ' + err.message);
    }
  };

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6">
      {/* 1. Header */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Vouchers</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Create, manage, and track voucher campaigns and redemption.
        </p>
      </div>

      {/* 2. Stat Cards Row (key overview only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Total Voucher"
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
            placeholder="Search vouchers by name, code or reward..."
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
                  <th className="px-6 py-4 text-left">Voucher Name</th>
                  <th className="px-6 py-4 text-left">Type</th>
                  <th className="px-6 py-4 text-left">Benefit</th>
                  <th className="px-6 py-4 text-left">Tier</th>
                  <th className="px-6 py-4 text-left">Items</th>
                  <th className="px-6 py-4 text-left">Availability</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Usage</th>
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

                        {/* Type */}
                        <td className="px-6 py-3.5 whitespace-nowrap font-medium text-gray-700">
                          {v.type}
                        </td>

                        <td className="px-6 py-3.5 whitespace-nowrap font-medium text-gray-700">
                          {benefitTypeLabel(v.benefitType)}
                        </td>

                        {/* Tier */}
                        <td className="px-6 py-3.5 whitespace-nowrap font-medium text-gray-700">
                          {v.tier}
                        </td>

                        {/* Items */}
                        <td className="px-6 py-3.5 font-medium text-gray-700 max-w-[150px] truncate" title={Array.isArray(v.eligibleItems) ? v.eligibleItems.join(', ') : "All Items"}>
                          {formatVoucherEligibility(v, productKindLabels)}
                        </td>

                        {/* Availability */}
                        <td className="px-6 py-3.5 whitespace-nowrap text-gray-600 font-medium">
                          {v.availabilityLabel || "-"}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 rounded-md text-[10px] font-bold ${v.status === "Active"
                              ? "bg-green-100 text-green-800"
                              : v.status === "Expired"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                              }`}
                          >
                            {v.status}
                          </span>
                        </td>

                        {/* Usage Progress Bar */}
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          <div className="w-28">
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

                        {/* Action Buttons: Eye, Edit, More */}
                        <td className="px-6 py-3.5 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center space-x-1.5 relative">
                            {/* Eye / View Details Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isSelected) {
                                  setSelectedVoucher(null);
                                  setActionMenuId(null);
                                  return;
                                }
                                selectVoucher(v);
                              }}
                              className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>

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
                    <td colSpan="9" className="px-6 py-12 text-center text-gray-500">
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

              <button
                onClick={() => {
                  const rows = [
                    ["Voucher Code", "Name", "Type", "Benefit", "Tier", "Status", "Issued", "Redeemed", "Limit", "Availability", "Audience"],
                    ...filtered.map(v => [
                      `"${v.id}"`,
                      `"${v.name}"`,
                      `"${v.type}"`,
                      `"${v.benefitType || ''}"`,
                      `"${v.tier}"`,
                      `"${v.status}"`,
                      v.issued,
                      v.redeemed,
                      v.limitPerUser,
                      `"${v.availabilityLabel || ''}"`,
                      `"${audienceLabel(v.audience)}"`
                    ])
                  ];
                  exportToCSV(rows, "vouchers.csv");
                }}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <Download size={16} className="mr-2" /> Export
              </button>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filtered.length}
              itemName="vouchers"
            />
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
                  <span className="text-gray-500">Type</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.type}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Benefit</span>
                  <span className="font-bold text-gray-900">{benefitTypeLabel(selectedVoucher.benefitType)}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Audience</span>
                  <span className="font-bold text-gray-900">{audienceLabel(selectedVoucher.audience)}</span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Tier</span>
                  <span className="font-bold text-gray-900">{selectedVoucher.tier}</span>
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
                <button
                  onClick={() => openIssueModal(selectedVoucher)}
                  className="w-full py-2 px-3 bg-[#1F3A34] text-white rounded-lg text-sm font-bold hover:bg-[#2E5E58] transition-colors cursor-pointer"
                >
                  Issue Voucher To Customer
                </button>
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

      {showIssueModal && issuingVoucher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Issue Voucher</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Assign <span className="font-semibold text-gray-700">{issuingVoucher.name}</span> to a customer.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowIssueModal(false);
                    setIssuingVoucher(null);
                  }}
                  className="text-gray-400 hover:text-gray-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleIssueVoucher} className="space-y-4">
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
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-600">
                    Selected customer: <span className="font-bold text-gray-900">{selectedCustomer.displayName}</span>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowIssueModal(false);
                      setIssuingVoucher(null);
                    }}
                    className="flex-1 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-[#2E5E58] text-white rounded-lg font-bold hover:bg-[#1F3A34] transition-colors cursor-pointer"
                  >
                    Issue Voucher
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create New Voucher Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
            <div className="overflow-y-auto overflow-x-hidden w-full custom-scrollbar">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-gray-900">Create New Voucher</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleCreateVoucher} className="space-y-3.5 text-xs">
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Voucher Label</label>
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
                        onChange={(e) => setNewVoucher({ ...newVoucher, benefitType: e.target.value })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {BENEFIT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

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
                      <label className="block font-bold text-gray-900 mb-1">Voucher Type</label>
                      <select
                        value={newVoucher.promotionKind}
                        onChange={(e) => setNewVoucher({
                          ...newVoucher,
                          promotionKind: e.target.value,
                          qualifyingQuantity: e.target.value === 'bundle' ? Math.max(Number(newVoucher.qualifyingQuantity) || 2, 2) : 1,
                          rewardQuantity: e.target.value === 'bundle' ? Math.max(Number(newVoucher.rewardQuantity) || 1, 1) : 1,
                          rewardProductKinds: e.target.value === 'bundle' ? newVoucher.rewardProductKinds : [],
                          rewardSubcategoryCodes: e.target.value === 'bundle' ? newVoucher.rewardSubcategoryCodes : [],
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
                          <label className="block font-bold text-gray-900 mb-1">Buy</label>
                          <p className="text-[10px] text-gray-500 mb-1">Items the customer must buy first.</p>
                          <input
                            type="number"
                            min="1"
                            value={newVoucher.qualifyingQuantity}
                            onChange={(e) => setNewVoucher({ ...newVoucher, qualifyingQuantity: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">Reward Qty</label>
                          <p className="text-[10px] text-gray-500 mb-1">Free items given after the buy condition is met.</p>
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
                        <label className="block font-bold text-gray-900 mb-1">Reward Qty</label>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Tier</label>
                      <select
                        value={newVoucher.tier}
                        onChange={(e) => setNewVoucher({ ...newVoucher, tier: e.target.value })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        <option value="All Tiers">All Tiers</option>
                        <option value="Legend">Legend</option>
                        <option value="Kawan">Kawan</option>
                        <option value="Dilamun">Dilamun</option>
                        <option value="Ketagih">Ketagih</option>
                      </select>
                    </div>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block font-bold text-gray-900 mb-1">Applies To</label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 mb-3">
                        <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 font-semibold border-b border-gray-100 pb-2 mb-1">
                          <input
                            type="checkbox"
                            checked={isAllValuesSelected(newVoucher.productKinds || [], menuTaxonomy.productKinds.map((option) => option.value))}
                            onChange={() => setNewVoucher({ ...newVoucher, productKinds: toggleAllValues(newVoucher.productKinds || [], menuTaxonomy.productKinds.map((option) => option.value)) })}
                            className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                          />
                          All Items
                        </label>
                        {menuTaxonomy.productKinds.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={(newVoucher.productKinds || []).includes(option.value)}
                              onChange={() => setNewVoucher({ ...newVoucher, productKinds: toggleListValue(newVoucher.productKinds || [], option.value) })}
                              className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      <label className="block font-bold text-gray-900 mb-1">Menu Types</label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 mb-3 max-h-32 overflow-y-auto">
                        <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 font-semibold border-b border-gray-100 pb-2 mb-1">
                          <input
                            type="checkbox"
                            checked={isAllValuesSelected(newVoucher.subcategoryCodes || [], menuTaxonomy.subcategories.map((subcategory) => subcategory.code))}
                            onChange={() => setNewVoucher({ ...newVoucher, subcategoryCodes: toggleAllValues(newVoucher.subcategoryCodes || [], menuTaxonomy.subcategories.map((subcategory) => subcategory.code)) })}
                            className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                          />
                          All Items
                        </label>
                        {menuTaxonomy.subcategories.map((subcategory) => (
                          <label key={subcategory.id} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={(newVoucher.subcategoryCodes || []).includes(subcategory.code)}
                              onChange={() => setNewVoucher({ ...newVoucher, subcategoryCodes: toggleListValue(newVoucher.subcategoryCodes || [], subcategory.code) })}
                              className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                            />
                            {subcategory.name}
                          </label>
                        ))}
                      </div>
                      <label className="block font-bold text-gray-900 mb-1">Specific Items</label>
                      <ScrollableCheckboxList
                        hasFilters={(newVoucher.productKinds || []).length > 0 || (newVoucher.subcategoryCodes || []).length > 0}
                        groupedItems={buildScopedGroupedItems(menuTaxonomy, newVoucher.productKinds, newVoucher.subcategoryCodes)}
                        selected={newVoucher.eligibleItems}
                        onChange={(selected) => setNewVoucher({ ...newVoucher, eligibleItems: selected })}
                      />

                      {newVoucher.promotionKind === 'bundle' && (
                        <>
                          <label className="block font-bold text-gray-900 mb-1 mt-4">Reward Applies To</label>
                          <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 mb-3">
                            <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 font-semibold border-b border-gray-100 pb-2 mb-1">
                              <input
                                type="checkbox"
                                checked={isAllValuesSelected(newVoucher.rewardProductKinds || [], menuTaxonomy.productKinds.map((option) => option.value))}
                                onChange={() => setNewVoucher({ ...newVoucher, rewardProductKinds: toggleAllValues(newVoucher.rewardProductKinds || [], menuTaxonomy.productKinds.map((option) => option.value)) })}
                                className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                              />
                              All Items
                            </label>
                            {menuTaxonomy.productKinds.map((option) => (
                              <label key={option.value} className="flex items-center gap-2 text-xs text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={(newVoucher.rewardProductKinds || []).includes(option.value)}
                                  onChange={() => setNewVoucher({ ...newVoucher, rewardProductKinds: toggleListValue(newVoucher.rewardProductKinds || [], option.value) })}
                                  className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 mb-3 max-h-32 overflow-y-auto">
                            <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 font-semibold border-b border-gray-100 pb-2 mb-1">
                              <input
                                type="checkbox"
                                checked={isAllValuesSelected(newVoucher.rewardSubcategoryCodes || [], menuTaxonomy.subcategories.map((subcategory) => subcategory.code))}
                                onChange={() => setNewVoucher({ ...newVoucher, rewardSubcategoryCodes: toggleAllValues(newVoucher.rewardSubcategoryCodes || [], menuTaxonomy.subcategories.map((subcategory) => subcategory.code)) })}
                                className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                              />
                              All Items
                            </label>
                            {menuTaxonomy.subcategories.map((subcategory) => (
                              <label key={subcategory.id} className="flex items-center gap-2 text-xs text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={(newVoucher.rewardSubcategoryCodes || []).includes(subcategory.code)}
                                  onChange={() => setNewVoucher({ ...newVoucher, rewardSubcategoryCodes: toggleListValue(newVoucher.rewardSubcategoryCodes || [], subcategory.code) })}
                                  className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                                />
                                {subcategory.name}
                              </label>
                            ))}
                          </div>
                          <ScrollableCheckboxList
                            hasFilters={(newVoucher.rewardProductKinds || []).length > 0 || (newVoucher.rewardSubcategoryCodes || []).length > 0}
                            groupedItems={buildScopedGroupedItems(menuTaxonomy, newVoucher.rewardProductKinds, newVoucher.rewardSubcategoryCodes)}
                            selected={newVoucher.rewardItems}
                            onChange={(selected) => setNewVoucher({ ...newVoucher, rewardItems: selected })}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Availability</label>
                      <select
                        value={newVoucher.availabilityMode}
                        onChange={(e) => setNewVoucher({ ...newVoucher, availabilityMode: e.target.value, activeDays: [], annualDate: "" })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {AVAILABILITY_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={newVoucher.startTime}
                        onChange={(e) => setNewVoucher({ ...newVoucher, startTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      />
                    </div>
                    {newVoucher.availabilityMode !== "always" && (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">End Time</label>
                        <input
                          type="time"
                          value={newVoucher.endTime}
                          onChange={(e) => setNewVoucher({ ...newVoucher, endTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                    {newVoucher.availabilityMode === "annual" && (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">Annual Date</label>
                        <input
                          type="date"
                          value={newVoucher.annualDate}
                          onChange={(e) => setNewVoucher({ ...newVoucher, annualDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                  </div>

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
                        <label className="block font-bold text-gray-900">Total Quantity</label>
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
                      <label className="block font-bold text-gray-900 mb-1">{limitPerUserLabel}</label>
                      <p className="text-[10px] text-gray-500 mb-1">The same customer can use this voucher only this many times.</p>
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

                  <div className="pt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-[#2E5E58] text-white rounded-lg font-bold hover:bg-[#1F3A34] transition-colors cursor-pointer"
                    >
                      Create Voucher
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/*Edit Voucher Modal*/}
      {editingVoucher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
            <div className="overflow-y-auto overflow-x-hidden w-full custom-scrollbar">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-bold text-gray-900">Edit Voucher ({editingVoucher.id})</h3>
                  <button
                    onClick={() => setEditingVoucher(null)}
                    className="text-gray-400 hover:text-gray-700 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Voucher Label</label>
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
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, benefitType: e.target.value })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {BENEFIT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
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
                      <label className="block font-bold text-gray-900 mb-1">Voucher Type</label>
                      <select
                        value={editingVoucher.promotionKind}
                        onChange={(e) => setEditingVoucher({
                          ...editingVoucher,
                          promotionKind: e.target.value,
                          qualifyingQuantity: e.target.value === 'bundle' ? Math.max(Number(editingVoucher.qualifyingQuantity) || 2, 2) : 1,
                          rewardQuantity: e.target.value === 'bundle' ? Math.max(Number(editingVoucher.rewardQuantity) || 1, 1) : 1,
                          rewardProductKinds: e.target.value === 'bundle' ? editingVoucher.rewardProductKinds : [],
                          rewardSubcategoryCodes: e.target.value === 'bundle' ? editingVoucher.rewardSubcategoryCodes : [],
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
                          <label className="block font-bold text-gray-900 mb-1">Buy</label>
                          <p className="text-[10px] text-gray-500 mb-1">Items the customer must buy first.</p>
                          <input
                            type="number"
                            min="1"
                            value={editingVoucher.qualifyingQuantity}
                            onChange={(e) => setEditingVoucher({ ...editingVoucher, qualifyingQuantity: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-gray-900 mb-1">Reward Qty</label>
                          <p className="text-[10px] text-gray-500 mb-1">Free items given after the buy condition is met.</p>
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
                        <label className="block font-bold text-gray-900 mb-1">Reward Qty</label>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Tier</label>
                      <select
                        value={editingVoucher.tier}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, tier: e.target.value })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        <option value="All Tiers">All Tiers</option>
                        <option value="Legend">Legend</option>
                        <option value="Kawan">Kawan</option>
                        <option value="Dilamun">Dilamun</option>
                        <option value="Ketagih">Ketagih</option>
                      </select>
                    </div>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block font-bold text-gray-900 mb-1">Applies To</label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 mb-3">
                        <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 font-semibold border-b border-gray-100 pb-2 mb-1">
                          <input
                            type="checkbox"
                            checked={isAllValuesSelected(editingVoucher.productKinds || [], menuTaxonomy.productKinds.map((option) => option.value))}
                            onChange={() => setEditingVoucher({ ...editingVoucher, productKinds: toggleAllValues(editingVoucher.productKinds || [], menuTaxonomy.productKinds.map((option) => option.value)) })}
                            className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                          />
                          All Items
                        </label>
                        {menuTaxonomy.productKinds.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={(editingVoucher.productKinds || []).includes(option.value)}
                              onChange={() => setEditingVoucher({ ...editingVoucher, productKinds: toggleListValue(editingVoucher.productKinds || [], option.value) })}
                              className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                      <label className="block font-bold text-gray-900 mb-1">Menu Types</label>
                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 mb-3 max-h-32 overflow-y-auto">
                        <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 font-semibold border-b border-gray-100 pb-2 mb-1">
                          <input
                            type="checkbox"
                            checked={isAllValuesSelected(editingVoucher.subcategoryCodes || [], menuTaxonomy.subcategories.map((subcategory) => subcategory.code))}
                            onChange={() => setEditingVoucher({ ...editingVoucher, subcategoryCodes: toggleAllValues(editingVoucher.subcategoryCodes || [], menuTaxonomy.subcategories.map((subcategory) => subcategory.code)) })}
                            className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                          />
                          All Items
                        </label>
                        {menuTaxonomy.subcategories.map((subcategory) => (
                          <label key={subcategory.id} className="flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={(editingVoucher.subcategoryCodes || []).includes(subcategory.code)}
                              onChange={() => setEditingVoucher({ ...editingVoucher, subcategoryCodes: toggleListValue(editingVoucher.subcategoryCodes || [], subcategory.code) })}
                              className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                            />
                            {subcategory.name}
                          </label>
                        ))}
                      </div>
                      <label className="block font-bold text-gray-900 mb-1">Specific Items</label>
                      <ScrollableCheckboxList
                        hasFilters={(editingVoucher.productKinds || []).length > 0 || (editingVoucher.subcategoryCodes || []).length > 0}
                        groupedItems={buildScopedGroupedItems(menuTaxonomy, editingVoucher.productKinds, editingVoucher.subcategoryCodes)}
                        selected={editingVoucher.eligibleItems || []}
                        onChange={(selected) => setEditingVoucher({ ...editingVoucher, eligibleItems: selected })}
                      />

                      {editingVoucher.promotionKind === 'bundle' && (
                        <>
                          <label className="block font-bold text-gray-900 mb-1 mt-4">Reward Applies To</label>
                          <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 mb-3">
                            <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 font-semibold border-b border-gray-100 pb-2 mb-1">
                              <input
                                type="checkbox"
                                checked={isAllValuesSelected(editingVoucher.rewardProductKinds || [], menuTaxonomy.productKinds.map((option) => option.value))}
                                onChange={() => setEditingVoucher({ ...editingVoucher, rewardProductKinds: toggleAllValues(editingVoucher.rewardProductKinds || [], menuTaxonomy.productKinds.map((option) => option.value)) })}
                                className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                              />
                              All Items
                            </label>
                            {menuTaxonomy.productKinds.map((option) => (
                              <label key={option.value} className="flex items-center gap-2 text-xs text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={(editingVoucher.rewardProductKinds || []).includes(option.value)}
                                  onChange={() => setEditingVoucher({ ...editingVoucher, rewardProductKinds: toggleListValue(editingVoucher.rewardProductKinds || [], option.value) })}
                                  className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                                />
                                {option.label}
                              </label>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 p-3 mb-3 max-h-32 overflow-y-auto">
                            <label className="col-span-2 flex items-center gap-2 text-xs text-gray-700 font-semibold border-b border-gray-100 pb-2 mb-1">
                              <input
                                type="checkbox"
                                checked={isAllValuesSelected(editingVoucher.rewardSubcategoryCodes || [], menuTaxonomy.subcategories.map((subcategory) => subcategory.code))}
                                onChange={() => setEditingVoucher({ ...editingVoucher, rewardSubcategoryCodes: toggleAllValues(editingVoucher.rewardSubcategoryCodes || [], menuTaxonomy.subcategories.map((subcategory) => subcategory.code)) })}
                                className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                              />
                              All Items
                            </label>
                            {menuTaxonomy.subcategories.map((subcategory) => (
                              <label key={subcategory.id} className="flex items-center gap-2 text-xs text-gray-700">
                                <input
                                  type="checkbox"
                                  checked={(editingVoucher.rewardSubcategoryCodes || []).includes(subcategory.code)}
                                  onChange={() => setEditingVoucher({ ...editingVoucher, rewardSubcategoryCodes: toggleListValue(editingVoucher.rewardSubcategoryCodes || [], subcategory.code) })}
                                  className="rounded text-[#2E5E58] focus:ring-[#2E5E58]"
                                />
                                {subcategory.name}
                              </label>
                            ))}
                          </div>
                          <ScrollableCheckboxList
                            hasFilters={(editingVoucher.rewardProductKinds || []).length > 0 || (editingVoucher.rewardSubcategoryCodes || []).length > 0}
                            groupedItems={buildScopedGroupedItems(menuTaxonomy, editingVoucher.rewardProductKinds, editingVoucher.rewardSubcategoryCodes)}
                            selected={editingVoucher.rewardItems || []}
                            onChange={(selected) => setEditingVoucher({ ...editingVoucher, rewardItems: selected })}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Availability</label>
                      <select
                        value={editingVoucher.availabilityMode}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, availabilityMode: e.target.value, activeDays: [], annualDate: "" })}
                        className="peer w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      >
                        {AVAILABILITY_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-900 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={editingVoucher.startTime || ""}
                        onChange={(e) => setEditingVoucher({ ...editingVoucher, startTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                      />
                    </div>
                    {editingVoucher.availabilityMode !== "always" && (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">End Time</label>
                        <input
                          type="time"
                          value={editingVoucher.endTime || ""}
                          onChange={(e) => setEditingVoucher({ ...editingVoucher, endTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                    {editingVoucher.availabilityMode === "annual" && (
                      <div>
                        <label className="block font-bold text-gray-900 mb-1">Annual Date</label>
                        <input
                          type="date"
                          value={editingVoucher.annualDate || ""}
                          onChange={(e) => setEditingVoucher({ ...editingVoucher, annualDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                        />
                      </div>
                    )}
                  </div>

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
                        <label className="block font-bold text-gray-900">Total Quantity</label>
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
                      <label className="block font-bold text-gray-900 mb-1">{limitPerUserLabel}</label>
                      <p className="text-[10px] text-gray-500 mb-1">The same customer can use this voucher only this many times.</p>
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

                  <div className="pt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingVoucher(null)}
                      className="flex-1 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-[#2E5E58] text-white rounded-lg font-bold hover:bg-[#1F3A34] transition-colors cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vouchers;
