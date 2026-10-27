import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  ChevronDown,
  Download,
  Plus,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Edit2,
  Copy,
  Archive,
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  ImagePlus,
  Trash2,
  X,
} from 'lucide-react';
import Pagination from './Pagination';
import { exportToCSV } from '../utils/exportToCSV';
import {
  createAdminMenuCategory,
  createAdminMenuSubcategory,
  deleteAdminMenuCategory,
  deleteAdminMenuSubcategory,
  createAdminMenuItem,
  deleteAdminMenuItem,
  loadAdminMenu,
  getAdminApiBaseUrl,
  uploadAdminMenuImage,
  updateAdminMenuCategory,
  updateAdminMenuSubcategory,
  updateAdminMenuItem,
  loadAdminOptionLibrary,
  loadAdminHomeFeatured,
  saveAdminHomeFeaturedGroups
} from '../lib/adminApi';
import { showAdminError, showAdminSuccess } from '../lib/adminToast';
import { requestAdminConfirm } from '../lib/adminDialog';
import { adminRequest } from '../lib/adminApi';

const ITEMS_PER_PAGE = 10;
const LAST_SELECTED_ITEM_KEY = 'c2_admin_menu_last_selected_item_id';
const MENU_PANEL_DISMISSED_KEY = 'c2_admin_menu_panel_dismissed';
const MENU_PRODUCT_KIND_OPTIONS = [
  { value: 'drink', label: 'Drinks' },
  { value: 'food', label: 'Food' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'candle', label: 'Candles' },
  { value: 'other', label: 'Other' }
];

const MenuStat = ({ title, value, change, icon: Icon, iconBg, iconColor = 'text-white' }) => (
  <div className="flex items-center gap-3 min-w-0 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-sm`}>
      <Icon size={18} strokeWidth={2.2} />
    </div>
    <div className="min-w-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <span className="text-lg font-bold text-gray-900 leading-none">{value}</span>
      </div>
      {change && (
        <p className="mt-0.5 text-[11px] text-gray-500 font-medium leading-tight">{change}</p>
      )}
    </div>
  </div>
);

const formatToken = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return '-';
  }
  return `${numericValue.toLocaleString('en-MY')} tokens`;
};

const parseMoneyInput = (value) => {
  const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
};

const parseIntegerInput = (value, fallback = 0) => {
  const numeric = Number.parseInt(String(value), 10);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const nullableText = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed.length > 0 ? trimmed : '';
};

const generateMenuCode = (value) => {
  const code = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return code || 'item';
};

const nextSortOrder = (items) =>
  items.reduce((max, item) => {
    const sortOrder = Number(item?.sort_order);
    return Number.isFinite(sortOrder) ? Math.max(max, sortOrder) : max;
  }, -1) + 1;

const normalizeMatch = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const MENU_ITEM_TEMPLATES = {
  custom: {
    label: 'Custom',
    description: 'Start from scratch.',
    categoryHints: [],
    subcategoryHints: [],
    defaults: {}
  },
  espresso_drink: {
    label: 'Coffee / Espresso',
    description: 'Best for latte, espresso, cappuccino, and barista drinks.',
    categoryHints: ['coffee', 'espresso', 'barista'],
    subcategoryHints: ['barista craft', 'coffee', 'flavoured coffee', 'pour over'],
    defaults: {
      is_handcrafted_drink: true,
      is_qualifying_cup: true,
      allow_remarks: true
    }
  },
  non_coffee_drink: {
    label: 'Non-Coffee Drink',
    description: 'Best for matcha, chocolate, milkshake, tea, and sparkling drinks.',
    categoryHints: ['non coffee', 'non_coffee', 'tea', 'matcha', 'sparkling'],
    subcategoryHints: ['matcha', 'chocolate', 'milkshake', 'sparkling', 'mocktails'],
    defaults: {
      is_handcrafted_drink: true,
      is_qualifying_cup: true,
      allow_remarks: true
    }
  },
  food_item: {
    label: 'Food',
    description: 'Best for pastries, snacks, and meals.',
    categoryHints: ['food', 'pastries'],
    subcategoryHints: ['pastries'],
    defaults: {
      is_handcrafted_drink: false,
      is_qualifying_cup: false,
      allow_remarks: false
    }
  },
  merchandise_item: {
    label: 'Merchandise',
    description: 'Best for cups, bottles, and retail items.',
    categoryHints: ['merchandise'],
    subcategoryHints: ['merchandise'],
    defaults: {
      is_handcrafted_drink: false,
      is_qualifying_cup: false,
      allow_remarks: false
    }
  }
};

const findMatchingCode = (items, hints, accessor) => {
  if (!Array.isArray(items) || hints.length === 0) {
    return '';
  }

  for (const hint of hints) {
    const normalizedHint = normalizeMatch(hint);
    const match = items.find((item) => {
      const value = normalizeMatch(accessor(item));
      return value.includes(normalizedHint);
    });
    if (match) {
      return match.code;
    }
  }

  return '';
};

const getTemplateKeyForCategory = (category) => {
  if (!category) {
    return 'custom';
  }

  const productKind = String(category.product_kind_code || '').toLowerCase();
  const categoryText = normalizeMatch(`${category.code} ${category.name}`);

  if (productKind === 'drink') {
    if (
      categoryText.includes('non coffee') ||
      categoryText.includes('non coffee') ||
      categoryText.includes('noncof') ||
      categoryText.includes('matcha') ||
      categoryText.includes('chocolate') ||
      categoryText.includes('milkshake') ||
      categoryText.includes('sparkling') ||
      categoryText.includes('mocktail')
    ) {
      return 'non_coffee_drink';
    }

    return 'espresso_drink';
  }

  if (productKind === 'food') {
    return 'food_item';
  }

  if (productKind === 'merchandise') {
    return 'merchandise_item';
  }

  return 'custom';
};

const resolveMenuImageUrl = (imageUrl) => {
  const trimmed = String(imageUrl ?? '').trim();
  if (!trimmed) {
    return '/c2_logo.png';
  }

  if (/^data:/i.test(trimmed) || /^blob:/i.test(trimmed)) {
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${getAdminApiBaseUrl()}${normalizedPath}`;
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const buildEmptyForm = (categoryCode) => ({
  id: null,
  category_code: categoryCode || '',
  subcategory_code: '',
  name: '',
  description: '',
  base_price_rm: '',
  base_price_token: '',
  image_url: '',
  is_active: true,
  is_handcrafted_drink: false,
  is_qualifying_cup: false,
  allow_remarks: false,
  option_group_ids: [],
  excluded_option_ids: []
});

const buildFormFromItem = (item, optionGroups = []) => {
  const selectedGroupIds = optionGroups
    .filter((group) => group.applies_to === 'selected_items' && group.menu_item_ids.includes(item.id))
    .map((group) => group.id);
  const enabledGroupIds = new Set([
    ...selectedGroupIds,
    ...optionGroups
      .filter((group) => group.applies_to === 'all_drinks')
      .map((group) => group.id)
  ]);

  return {
    id: item.id,
    category_code: item.category_code,
    subcategory_code: item.subcategory_code || '',
    name: item.name || '',
    description: item.description || '',
    base_price_rm: item.base_price_rm ? String(item.base_price_rm) : '',
    base_price_token: item.base_price_token !== undefined && item.base_price_token !== null
      ? String(item.base_price_token)
      : '',
    image_url: item.image_url || '',
    is_active: item.is_active,
    is_handcrafted_drink: item.is_handcrafted_drink,
    is_qualifying_cup: item.is_qualifying_cup,
    allow_remarks: Boolean(item.allow_remarks),
    option_group_ids: selectedGroupIds,
    // Ignore old exclusions for groups that are no longer assigned to this item.
    excluded_option_ids: [...new Set(optionGroups.flatMap((group) =>
      enabledGroupIds.has(group.id)
        ? (group.options || [])
          .filter((option) => option.excluded_menu_item_ids?.includes(item.id))
          .map((option) => option.id)
        : []
    ))]
  };
};

const flattenMenuData = (categories) =>
  categories
    .flatMap((category) =>
      (category.items || []).map((item) => ({
        ...item,
        category_id: category.id,
        category_code: category.code,
        category_name: category.name,
        category_sort_order: category.sort_order,
        category_is_active: category.is_active
      }))
    )
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

const Menu = () => {
  const [menuCategories, setMenuCategories] = useState([]);
  const [menuSubcategories, setMenuSubcategories] = useState([]);
  const [optionGroups, setOptionGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('Active');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const dismissed = window.localStorage.getItem(MENU_PANEL_DISMISSED_KEY) === '1';
    if (dismissed) {
      return null;
    }

    const savedId = window.localStorage.getItem(LAST_SELECTED_ITEM_KEY);
    const parsedId = Number(savedId);
    return Number.isFinite(parsedId) && parsedId > 0 ? parsedId : null;
  });
  const [activeTab, setActiveTab] = useState('Details');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editMode, setEditMode] = useState('create');
  const [editFormData, setEditFormData] = useState(buildEmptyForm(''));
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMenuTemplate, setSelectedMenuTemplate] = useState('custom');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
  const [isHomePicksOpen, setIsHomePicksOpen] = useState(false);
  const [homeGroups, setHomeGroups] = useState([]);
  const [isSavingHomePicks, setIsSavingHomePicks] = useState(false);
  const [drinkGuides, setDrinkGuides] = useState([]);
  const [sopFile, setSopFile] = useState(null);
  const [isSavingSop, setIsSavingSop] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    id: null,
    code: '',
    name: '',
    product_kind_code: 'drink',
    sort_order: 0,
    is_active: true
  });
  const [subcategoryForm, setSubcategoryForm] = useState({
    id: null,
    category_code: '',
    code: '',
    name: '',
    sort_order: 0,
    is_active: true
  });

  const loadMenu = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const [response, homePicks, library] = await Promise.all([
        loadAdminMenu(),
        loadAdminHomeFeatured(),
        loadAdminOptionLibrary()
      ]);
      const categories = response.categories || [];
      const subcategories = response.subcategories || [];
      setMenuCategories(categories);
      setMenuSubcategories(subcategories);
      setOptionGroups(library.groups || []);
      const activeCategoryIds = new Set(categories.filter((category) => category.is_active).map((category) => category.id));
      const activeItemIds = new Set(categories.flatMap((category) => category.is_active
        ? (category.items || []).filter((item) => item.is_active).map((item) => item.id)
        : []));
      setHomeGroups((homePicks.groups || []).map((group) => ({
        ...group,
        category_ids: (group.category_ids || []).filter((id) => activeCategoryIds.has(id)),
        item_ids: (group.item_ids || []).filter((id) => activeItemIds.has(id))
      })));

      setSelectedCategory((currentCategory) => (
        currentCategory !== 'All' && !categories.some((category) => category.code === currentCategory)
          ? 'All'
          : currentCategory
      ));

      if (typeof window !== 'undefined') {
        const dismissed = window.localStorage.getItem(MENU_PANEL_DISMISSED_KEY) === '1';
        if (!dismissed) {
          const savedId = Number(window.localStorage.getItem(LAST_SELECTED_ITEM_KEY));
          if (Number.isFinite(savedId) && savedId > 0) {
            const savedItemExists = categories.some((category) =>
              (category.items || []).some((item) => item.id === savedId)
            );
            if (savedItemExists) {
              setSelectedItemId(savedId);
            }
          }
        }
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load menu data.');
      setMenuCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMenu();
  }, [loadMenu]);

  const loadDrinkGuides = async () => {
    try {
      const response = await adminRequest('/v1/admin/barista-guides');
      setDrinkGuides((response.guides || []).filter((guide) => guide.guide_type === 'drink'));
    } catch (error) {
      setErrorMessage(error.message || 'Unable to load drink SOPs.');
    }
  };

  useEffect(() => {
    void loadDrinkGuides();
  }, []);

  const activeMenuCategories = menuCategories.filter((category) => category.is_active);
  const categoryOptions = [
    { value: 'All', label: 'All Categories' },
    ...activeMenuCategories.map((category) => ({
      value: category.code,
      label: category.name
    }))
  ];

  const allMenuItems = flattenMenuData(menuCategories);
  const activeHomeItems = flattenMenuData(activeMenuCategories).filter((item) => item.is_active);
  const optionGroupsForItem = (itemId) => optionGroups.filter((group) =>
    group.applies_to === 'all_drinks' || group.menu_item_ids.includes(itemId)
  );

  const saveHomePicks = async () => {
    setIsSavingHomePicks(true);
    setErrorMessage('');
    try {
      await saveAdminHomeFeaturedGroups(homeGroups.map((group, index) => ({
        ...group,
        sort_order: index + 1,
        category_ids: group.category_ids || [],
        item_ids: group.item_ids || []
      })));
      setIsHomePicksOpen(false);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save Top Picks.');
    } finally {
      setIsSavingHomePicks(false);
    }
  };
  const addHomeGroup = () => setHomeGroups((groups) => [...groups, {
    title: 'New featured group', selection_mode: 'automatic', category_ids: [], item_ids: [],
    display_limit: 6, sort_order: groups.length + 1, is_active: true
  }]);
  const updateHomeGroup = (index, changes) => setHomeGroups((groups) =>
    groups.map((group, groupIndex) => groupIndex === index ? { ...group, ...changes } : group));
  const selectedCategoryRecord = menuCategories.find((category) => category.code === editFormData.category_code) || null;
  const selectedProductKind = selectedCategoryRecord?.product_kind_code || 'drink';
  const showDrinkControls = selectedProductKind === 'drink';

  const filteredMenuItems = allMenuItems.filter((item) => {
    const search = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search) ||
      item.code.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search) ||
      item.category_name.toLowerCase().includes(search);
    const matchesCategory = selectedCategory === 'All' || item.category_code === selectedCategory;
    const matchesStatus =
      selectedStatus === 'All' ||
      (selectedStatus === 'Active' && item.is_active) ||
      (selectedStatus === 'Archived' && !item.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMenuItems.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredMenuItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const selectedItem = allMenuItems.find((item) => item.id === selectedItemId) || null;
  const selectedItemIsDrink = selectedItem && String(
    selectedItem.product_kind_code || menuCategories.find((category) => category.code === selectedItem.category_code)?.product_kind_code || ''
  ).toLowerCase() === 'drink';

  const totalMenuItems = allMenuItems.length;
  const activeItems = allMenuItems.filter((item) => item.is_active).length;
  const archivedItems = totalMenuItems - activeItems;
  const archivedItemsDueForReview = allMenuItems.filter((item) =>
    !item.is_active && item.retention_review_due
  );

  const showArchiveReviewItems = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedStatus('Archived');
    setCurrentPage(1);
    if (archivedItemsDueForReview[0]) {
      openSelectedItem(archivedItemsDueForReview[0].id);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatus]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (selectedItemId) {
      window.localStorage.setItem(LAST_SELECTED_ITEM_KEY, String(selectedItemId));
      window.localStorage.setItem(MENU_PANEL_DISMISSED_KEY, '0');
      return;
    }

    if (window.localStorage.getItem(MENU_PANEL_DISMISSED_KEY) !== '1') {
      window.localStorage.removeItem(LAST_SELECTED_ITEM_KEY);
    }
  }, [selectedItemId]);

  useEffect(() => {
    setSopFile(null);
  }, [selectedItemId]);

  const refreshAndSelect = async (itemId = null) => {
    await loadMenu();
    if (itemId !== null) {
      setSelectedItemId(itemId);
    }
  };

  const openSelectedItem = (itemId) => {
    setSelectedItemId(itemId);
  };

  const closeSelectedItem = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MENU_PANEL_DISMISSED_KEY, '1');
    }
    setSelectedItemId(null);
  };

  const openCreateModal = () => {
    const fallbackCategory = selectedCategory !== 'All'
      ? selectedCategory
      : menuCategories[0]?.code || '';
    const fallbackCategoryRecord = menuCategories.find((category) => category.code === fallbackCategory) || null;
    setEditMode('create');
    setEditFormData(buildEmptyForm(fallbackCategory));
    setSelectedMenuTemplate(getTemplateKeyForCategory(fallbackCategoryRecord));
    setSelectedImageFile(null);
    setSelectedImagePreview('');
    setIsEditModalOpen(true);
  };

  const openCategoryModal = (productKindCode = 'drink') => {
    setCategoryForm({
      id: null,
      code: '',
      name: '',
      product_kind_code: productKindCode,
      sort_order: nextSortOrder(menuCategories),
      is_active: true
    });
    setIsCategoryModalOpen(true);
  };

  const editCategory = (category) => {
    setCategoryForm({
      id: category.id,
      code: category.code,
      name: category.name,
      product_kind_code: category.product_kind_code || 'drink',
      sort_order: category.sort_order || 0,
      is_active: category.is_active
    });
    setIsCategoryModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditMode('edit');
    setEditFormData(buildFormFromItem(item, optionGroups));
    setSelectedMenuTemplate(getTemplateKeyForCategory(
      menuCategories.find((category) => category.code === item.category_code)
    ));
    setSelectedImageFile(null);
    setSelectedImagePreview(resolveMenuImageUrl(item.image_url));
    setIsEditModalOpen(true);
  };

  const handleDuplicate = (item) => {
    setEditMode('create');
    setEditFormData({
      ...buildFormFromItem(item, optionGroups),
      id: null,
      name: `${item.name} (Copy)`
    });
    setIsEditModalOpen(true);
  };

  const handleArchive = async (item) => {
    if (item.is_active) {
      if (!await requestAdminConfirm({ title: 'Archive menu item?', message: `“${item.name}” will stop appearing in the active menu and remain available in history.`, confirmLabel: 'Archive', tone: 'danger' })) {
        return;
      }

      setIsSubmitting(true);
      try {
        await deleteAdminMenuItem(item.id);
        setSelectedItemId(null);
        await loadMenu();
      } catch (error) {
        setErrorMessage(error.message || 'Unable to archive menu item.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!await requestAdminConfirm({ title: 'Restore menu item?', message: `Restore “${item.name}” to the active customer menu?`, confirmLabel: 'Restore' })) {
      return;
    }

    setIsSubmitting(true);
    try {
      await updateAdminMenuItem(item.id, { is_active: true });
      await loadMenu();
      setSelectedItemId(item.id);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to restore menu item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePermanentDelete = (item) => {
    setDeleteConfirmation({
      type: 'menu-item',
      id: item.id,
      name: item.name,
      itemCount: 0,
      subcategoryCount: 0,
      willArchive: false
    });
  };

  const uploadDrinkSop = async () => {
    if (!selectedItem || !sopFile) return;
    setIsSavingSop(true);
    setErrorMessage('');
    try {
      const dataUrl = await fileToDataUrl(sopFile);
      const upload = await adminRequest('/v1/admin/barista-guides/uploads', {
        method: 'POST', body: JSON.stringify({ file_name: sopFile.name, data_url: dataUrl })
      });
      await adminRequest('/v1/admin/barista-guides', {
        method: 'POST', body: JSON.stringify({ guide_type: 'drink', menu_item_id: selectedItem.id, image_url: upload.image_url })
      });
      setSopFile(null);
      await loadDrinkGuides();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to upload the drink SOP.');
    } finally {
      setIsSavingSop(false);
    }
  };

  const deleteDrinkSop = async (guideId) => {
    if (!await requestAdminConfirm({ title: 'Delete SOP image?', message: 'This preparation image will be removed from the barista library.', confirmLabel: 'Delete', tone: 'danger' })) return;
    try {
      await adminRequest(`/v1/admin/barista-guides/${guideId}`, { method: 'DELETE' });
      await loadDrinkGuides();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to delete the drink SOP.');
    }
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    let imageUrl = nullableText(editFormData.image_url);
    if (selectedImageFile) {
      const uploadResponse = await uploadAdminMenuImage(selectedImageFile);
      imageUrl = uploadResponse.image_url;
    }

    const payload = {
      category_code: editFormData.category_code,
      subcategory_code: editFormData.subcategory_code || '',
      name: editFormData.name.trim(),
      description: nullableText(editFormData.description),
      base_price_rm: parseMoneyInput(editFormData.base_price_rm),
      base_price_token: parseIntegerInput(editFormData.base_price_token, 0),
      image_url: imageUrl,
      is_active: Boolean(editFormData.is_active),
      is_handcrafted_drink: Boolean(editFormData.is_handcrafted_drink),
      is_qualifying_cup: Boolean(editFormData.is_qualifying_cup),
      allow_remarks: Boolean(editFormData.allow_remarks)
    };

    try {
      let response;
      if (editMode === 'create') {
        response = await createAdminMenuItem(payload);
      } else {
        response = await updateAdminMenuItem(editFormData.id, payload);
      }

      const itemId = response.item?.id ?? editFormData.id;

      closeEditModal();
      await refreshAndSelect(itemId);
    } catch (error) {
      const msg = error.message || 'Unable to save menu item.';
      setErrorMessage(msg);
      showAdminError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportRows = [
    [
      'Menu Item',
      'Category',
      'RM Price',
      'Token Price',
      'Status',
      'Sales',
      'ID'
    ],
    ...filteredMenuItems.map((item) => [
      item.name,
      item.category_name,
      item.base_price_rm,
      item.base_price_token,
      item.is_active ? 'Active' : 'Archived',
      String(item.sales_count ?? 0),
      item.code
    ])
  ];

  useEffect(() => {
    if (!selectedImageFile) {
      return;
    }

    const previewUrl = URL.createObjectURL(selectedImageFile);
    setSelectedImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedImageFile]);

  const handleImageFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      const msg = 'Please upload a PNG, JPEG, or WEBP image.';
      setErrorMessage(msg);
      showAdminError(msg);
      event.target.value = '';
      return;
    }

    const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_IMAGE_FILE_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const msg = `The selected image (${sizeMb} MB) exceeds the 10 MB limit. Please compress or resize the image before uploading.`;
      setErrorMessage(msg);
      showAdminError(msg);
      event.target.value = '';
      return;
    }

    setErrorMessage('');
    setSelectedImageFile(file);
  };

  const clearSelectedImage = () => {
    setSelectedImageFile(null);
    setSelectedImagePreview('');
    setEditFormData((current) => ({ ...current, image_url: '' }));
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedImageFile(null);
    setSelectedImagePreview('');
    setErrorMessage('');
  };

  const handleSaveCategory = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const payload = {
        code: categoryForm.code.trim() || generateMenuCode(categoryForm.name),
        name: categoryForm.name.trim(),
        product_kind_code: categoryForm.product_kind_code,
        sort_order: parseIntegerInput(categoryForm.sort_order, 0),
        is_active: Boolean(categoryForm.is_active)
      };
      const response = categoryForm.id
        ? await updateAdminMenuCategory(categoryForm.id, payload)
        : await createAdminMenuCategory(payload);

      setIsCategoryModalOpen(false);
      await loadMenu();

      if (response?.category?.code) {
        setEditFormData((current) => ({
          ...current,
          category_code: response.category.code,
          subcategory_code: ''
        }));
      }
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save main category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editSubcategory = (subcategory) => {
    setSubcategoryForm({
      id: subcategory.id,
      category_code: subcategory.category_code,
      code: subcategory.code,
      name: subcategory.name,
      sort_order: subcategory.sort_order || 0,
      is_active: subcategory.is_active
    });
    setIsSubcategoryModalOpen(true);
  };

  const handleSaveSubcategory = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const payload = {
        category_code: subcategoryForm.category_code,
        code: subcategoryForm.code.trim() || generateMenuCode(subcategoryForm.name),
        name: subcategoryForm.name.trim(),
        sort_order: parseIntegerInput(subcategoryForm.sort_order, 0),
        is_active: Boolean(subcategoryForm.is_active)
      };
      if (subcategoryForm.id) {
        await updateAdminMenuSubcategory(subcategoryForm.id, payload);
      } else {
        await createAdminMenuSubcategory(payload);
      }
      setIsSubcategoryModalOpen(false);
      await loadMenu();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save subcategory.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = () => {
    if (!categoryForm.id) {
      return;
    }

    const category = menuCategories.find((entry) => entry.id === categoryForm.id);
    const itemCount = category?.items?.length || 0;
    const subcategoryCount = menuSubcategories.filter((subcategory) => subcategory.category_id === categoryForm.id).length;

    setDeleteConfirmation({
      type: 'category',
      id: categoryForm.id,
      name: category?.name || categoryForm.name || 'this category',
      itemCount,
      subcategoryCount,
      willArchive: itemCount > 0 || subcategoryCount > 0
    });
  };

  const confirmDeleteCategory = async (confirmation) => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const result = await deleteAdminMenuCategory(confirmation.id, { suppressSuccessToast: true });
      setDeleteConfirmation(null);
      setIsCategoryModalOpen(false);
      await loadMenu();
      showAdminSuccess(result.mode === 'archived'
        ? `${confirmation.name} was archived. Existing menu and sales history remain safely stored.`
        : `${confirmation.name} was permanently deleted.`);
    } catch (error) {
      setDeleteConfirmation(null);
      setErrorMessage(error.message || 'We could not remove this category. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubcategory = () => {
    if (!subcategoryForm.id) {
      return;
    }

    const itemCount = menuCategories
      .flatMap((category) => category.items || [])
      .filter((item) => item.subcategory_id === subcategoryForm.id).length;

    setDeleteConfirmation({
      type: 'subcategory',
      id: subcategoryForm.id,
      name: subcategoryForm.name || 'this family',
      itemCount,
      subcategoryCount: 0,
      willArchive: itemCount > 0
    });
  };

  const confirmDeleteSubcategory = async (confirmation) => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const result = await deleteAdminMenuSubcategory(confirmation.id, { suppressSuccessToast: true });
      setDeleteConfirmation(null);
      setIsSubcategoryModalOpen(false);
      await loadMenu();
      showAdminSuccess(result.mode === 'archived'
        ? `${confirmation.name} was hidden. Existing menu and sales history remain safely stored.`
        : `${confirmation.name} was permanently deleted.`);
    } catch (error) {
      setDeleteConfirmation(null);
      setErrorMessage(error.message || 'We could not remove this family. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteSelection = () => {
    if (!deleteConfirmation || isSubmitting) {
      return;
    }

    if (deleteConfirmation.type === 'category') {
      void confirmDeleteCategory(deleteConfirmation);
      return;
    }

    if (deleteConfirmation.type === 'menu-item') {
      setIsSubmitting(true);
      setErrorMessage('');
      void deleteAdminMenuItem(deleteConfirmation.id, { permanent: true })
        .then(async () => {
          setDeleteConfirmation(null);
          setSelectedItemId(null);
          await loadMenu();
          showAdminSuccess(`${deleteConfirmation.name} was permanently deleted.`);
        })
        .catch((error) => {
          setDeleteConfirmation(null);
          setErrorMessage(error.message || 'We could not permanently delete this menu item.');
        })
        .finally(() => setIsSubmitting(false));
      return;
    }

    void confirmDeleteSubcategory(deleteConfirmation);
  };

  const applyMenuTemplate = (templateKey) => {
    const template = MENU_ITEM_TEMPLATES[templateKey] || MENU_ITEM_TEMPLATES.custom;
    setSelectedMenuTemplate(templateKey);

    const nextCategoryCode = findMatchingCode(menuCategories, template.categoryHints, (item) => `${item.code} ${item.name}`) || editFormData.category_code;
    setEditFormData((current) => ({
      ...current,
      category_code: nextCategoryCode || current.category_code,
      // Categories are the only grouping staff choose for new items.
      subcategory_code: '',
      is_handcrafted_drink: Boolean(template.defaults.is_handcrafted_drink),
      is_qualifying_cup: Boolean(template.defaults.is_qualifying_cup),
      allow_remarks: Boolean(template.defaults.allow_remarks)
    }));
  };

  return (
    <div className="h-full flex flex-col px-8 pb-8 pt-2 space-y-6 overflow-hidden">
      <div className="shrink-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Manage your menu listing, prices, availability, and token pricing without editing the database directly.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <MenuStat title="Total Menu Items" value={String(totalMenuItems)} change="Live catalog items" icon={ClipboardList} iconBg="bg-[#1F3A34]" />
          <MenuStat title="Active Items" value={String(activeItems)} change={`${totalMenuItems > 0 ? ((activeItems / totalMenuItems) * 100).toFixed(1) : '0.0'}% active`} icon={CheckCircle2} iconBg="bg-[#6F9F96]" />
          <MenuStat title="Archived Items" value={String(archivedItems)} change="Soft-archived items" icon={XCircle} iconBg="bg-[#E07A5F]" />
        </div>

        {archivedItemsDueForReview.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-bold">
                  {archivedItemsDueForReview.length} archived menu {archivedItemsDueForReview.length === 1 ? 'item is' : 'items are'} due for review
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  These items have been archived for at least five years. Review them before permanent deletion; protected order and loyalty history will remain archived.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={showArchiveReviewItems}
              className="shrink-0 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              Review archived items
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative w-full lg:max-w-[400px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3A34]"
            />
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                onFocus={() => setCategoryOpen(true)}
                onBlur={() => setCategoryOpen(false)}
                className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
              >
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown
                  size={16}
                  className={`text-gray-500 transition-transform duration-200 ${categoryOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                onFocus={() => setStatusOpen(true)}
                onBlur={() => setStatusOpen(false)}
                className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Archived">Archived</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown
                  size={16}
                  className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            <button
              onClick={() => setIsHomePicksOpen(true)}
              className="flex items-center px-4 py-2 border border-[#1F3A34] rounded-lg text-sm font-medium text-[#1F3A34] bg-white hover:bg-[#F3F7F5] whitespace-nowrap"
            >
              Top Picks
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer"
            >
              <Plus size={16} className="mr-1.5" /> New Menu Item
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex gap-6 min-h-0">
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-w-0">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-900 font-bold border-b border-gray-200 sticky top-0 bg-white z-10">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Menu Item</th>
                  <th className="px-6 py-4 whitespace-nowrap">Category</th>
                  <th className="px-6 py-4 whitespace-nowrap">RM Price</th>
                  <th className="px-6 py-4 whitespace-nowrap">Token Price</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 whitespace-nowrap">Sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                      Loading menu data...
                    </td>
                  </tr>
                ) : paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                      No menu items found.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50 cursor-pointer ${selectedItemId === item.id ? 'bg-gray-50' : ''}`}
                      onClick={() => openSelectedItem(item.id)}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={resolveMenuImageUrl(item.image_url)}
                            alt={item.name}
                            className="w-10 h-10 object-contain shrink-0 drop-shadow-sm"
                          />
                          <div>
                            <p className="font-bold text-gray-900">{item.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium">ID: {item.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-700">
                        <div>{item.category_name}</div>
                        <div className="text-[10px] text-gray-400">{item.subcategory_name || 'General'}</div>
                      </td>
                      <td className="px-6 py-3 font-medium text-gray-900">{item.base_price_rm}</td>
                      <td className="px-6 py-3 font-medium text-gray-900">{formatToken(item.base_price_token)}</td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`px-2 py-1 rounded-md text-[10px] font-bold ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}
                          >
                            {item.is_active ? 'Active' : 'Archived'}
                          </span>
                          {item.retention_review_due && (
                            <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">
                              5-year review due
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{(item.sales_count || 0).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-4 shrink-0 bg-white">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filteredMenuItems.length}
              itemName="menu items"
            />
            <button
              onClick={() => exportToCSV(exportRows, 'menu.csv')}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer"
            >
              <Download size={16} className="mr-1.5" /> Export
            </button>
          </div>
        </div>

        {selectedItem && (
          <div className="w-[420px] shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4">
                  <img
                    src={resolveMenuImageUrl(selectedItem.image_url)}
                    alt={selectedItem.name}
                    className="w-16 h-16 object-contain shrink-0 drop-shadow-md"
                  />
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h2 className="text-lg font-bold text-gray-900">{selectedItem.name}</h2>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedItem.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {selectedItem.is_active ? 'Active' : 'Archived'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">ID: {selectedItem.code}</p>
                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                      Updated on {new Date(selectedItem.updated_at).toLocaleDateString('en-MY', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeSelectedItem}
                  className="p-1 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100"
                >
                  <X size={20} />
                </button>
              </div>

              {!selectedItem.is_active && selectedItem.archived_at && (
                <div className={`mb-4 rounded-xl border px-4 py-3 ${selectedItem.retention_review_due
                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                  : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <CalendarClock className={`mt-0.5 h-4 w-4 shrink-0 ${selectedItem.retention_review_due ? 'text-amber-700' : 'text-gray-500'}`} />
                    <div>
                      <p className="text-xs font-bold">
                        {selectedItem.retention_review_due ? 'Archive review due' : 'Archive retention review'}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed">
                        Archived on {new Date(selectedItem.archived_at).toLocaleDateString('en-MY', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}. {selectedItem.retention_review_due
                          ? 'Review whether it can be permanently deleted.'
                          : `Review from ${new Date(selectedItem.retention_review_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}.`}
                        {' '}Items linked to orders or loyalty records must remain archived.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-6 border-b border-gray-200 mb-5 shrink-0 text-sm">
                <button
                  onClick={() => setActiveTab('Details')}
                  className={`pb-2 font-medium border-b-2 transition-colors ${activeTab === 'Details' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('Sales')}
                  className={`pb-2 font-medium border-b-2 transition-colors ${activeTab === 'Sales' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  Sales & Analytics
                </button>
                <button
                  onClick={() => setActiveTab('History')}
                  className={`pb-2 font-medium border-b-2 transition-colors ${activeTab === 'History' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  History
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-5 text-sm">
                {activeTab === 'Details' && (
                  <>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">Menu Category</p>
                        <p className="text-gray-900 font-medium">{selectedItem.category_name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">Menu Type</p>
                        <p className="text-gray-900 font-medium">{selectedItem.product_kind_name || 'Other'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">RM Price</p>
                        <p className="text-gray-900 font-medium">{selectedItem.base_price_rm}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">Token Price</p>
                        <p className="text-gray-900 font-medium">{formatToken(selectedItem.base_price_token)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">Counts for loyalty cups</p>
                        <p className="text-gray-900 font-medium">{selectedItem.is_qualifying_cup ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">Made-to-order drink</p>
                        <p className="text-gray-900 font-medium">{selectedItem.is_handcrafted_drink ? 'Yes' : 'No'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">Customizations</p>
                        <div className="text-gray-900 font-medium">
                          <div className="flex flex-wrap gap-2">
                            {optionGroupsForItem(selectedItem.id).length > 0 ? (
                              optionGroupsForItem(selectedItem.id).map((group) => (
                                <span
                                  key={group.id}
                                  className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"
                                >
                                  {group.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-500">None</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <p className="text-[10px] text-gray-500 font-medium mb-2">Item Image</p>
                      <img
                        src={resolveMenuImageUrl(selectedItem.image_url)}
                        alt={selectedItem.name}
                        className="w-16 h-16 object-contain shrink-0 drop-shadow-md"
                      />
                    </div>
                    {selectedItemIsDrink && (
                      <div className="rounded-xl border border-[#B9D6D0] bg-[#F3FAF8] p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-white p-2 text-[#2E5E58]"><ImagePlus size={18} /></div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-gray-900">Drink SOP</p>
                            <p className="mt-1 text-xs leading-5 text-gray-600">Upload preparation images for {selectedItem.name}. They appear in the C2 Store Barista Workspace library and when this drink is being prepared.</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setSopFile(event.target.files?.[0] || null)} className="min-w-0 flex-1 text-xs" />
                          <button type="button" disabled={!sopFile || isSavingSop} onClick={() => void uploadDrinkSop()} className="rounded-lg bg-[#2E5E58] px-3 py-2 text-xs font-bold text-white hover:bg-[#244B46] disabled:cursor-not-allowed disabled:opacity-50">{isSavingSop ? 'Uploading...' : 'Add SOP image'}</button>
                        </div>
                        <div className="mt-4 space-y-2">
                          {drinkGuides.filter((guide) => Number(guide.menu_item_id) === Number(selectedItem.id)).length === 0 ? <p className="text-xs text-gray-500">No SOP image uploaded for this drink yet.</p> : drinkGuides.filter((guide) => Number(guide.menu_item_id) === Number(selectedItem.id)).map((guide) => <div key={guide.id} className="flex items-center justify-between gap-3 rounded-lg bg-white p-2"><img src={`${getAdminApiBaseUrl()}${guide.image_url}`} alt={`${selectedItem.name} SOP`} className="h-12 w-12 rounded object-cover" /><span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-700">Preparation image</span><button type="button" onClick={() => void deleteDrinkSop(guide.id)} className="rounded p-1.5 text-red-600 hover:bg-red-50" aria-label="Delete SOP image"><Trash2 size={16} /></button></div>)}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'Sales' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Total Sales</p>
                        <p className="text-lg font-bold text-gray-900">{(selectedItem.sales_count || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-green-600 font-medium mt-1">Live from order history</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Total Revenue</p>
                        <p className="text-lg font-bold text-gray-900">{selectedItem.total_revenue_rm || 'Tokens 0.00'}</p>
                        <p className="text-[10px] text-green-600 font-medium mt-1">Completed orders only</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'History' && (
                  <div className="space-y-6">
                    <div className="relative border-l-2 border-gray-100 ml-3 space-y-8 pb-4">
                      <div className="relative pl-6">
                        <div className="absolute w-3 h-3 bg-[#1F3A34] rounded-full -left-[7px] top-1.5 ring-4 ring-white"></div>
                        <p className="text-sm font-bold text-gray-900">Last Updated</p>
                        <p className="text-xs text-gray-500 mt-0.5">Edited from the admin web menu page</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-1">
                          {new Date(selectedItem.updated_at).toLocaleDateString('en-MY', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>

                      <div className="relative pl-6">
                        <div className="absolute w-3 h-3 bg-gray-200 rounded-full -left-[7px] top-1.5 ring-4 ring-white"></div>
                        <p className="text-sm font-bold text-gray-900">Item Created</p>
                        <p className="text-xs text-gray-500 mt-0.5">Stored in the catalog database</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-1">
                          {new Date(selectedItem.created_at).toLocaleDateString('en-MY', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-200 shrink-0 grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleDuplicate(selectedItem)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Copy size={14} /> Duplicate
                </button>
                <button
                  onClick={() => openEditModal(selectedItem)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  onClick={() => handleArchive(selectedItem)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <Archive size={14} /> {selectedItem.is_active ? 'Archive' : 'Restore'}
                </button>
                {!selectedItem.is_active && (
                  <button
                    onClick={() => handlePermanentDelete(selectedItem)}
                    className="col-span-3 flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={14} /> Delete permanently
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isHomePicksOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between border-b border-gray-100 bg-white/80 backdrop-blur-xs px-6 py-5">
              <div><h2 className="text-lg font-bold text-gray-900">Home featured groups</h2><p className="mt-1 text-sm text-gray-500">Create promotional groups from several categories, selected products, or both.</p></div>
              <button onClick={() => setIsHomePicksOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"><X size={20} /></button>
            </div>
            <div className="max-h-[60vh] space-y-6 overflow-y-auto px-6 py-5">
              {homeGroups.map((group, index) => <div key={group.id || index} className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex gap-3"><input value={group.title} onChange={(event) => updateHomeGroup(index, { title: event.target.value })} className="flex-1 rounded-lg border border-gray-200 px-3 py-2 font-bold" placeholder="Group title" /><button onClick={() => setHomeGroups((groups) => groups.filter((_, itemIndex) => itemIndex !== index))} className="text-red-600"><Trash2 size={18} /></button></div>
                <div className="grid grid-cols-2 gap-3"><select value={group.selection_mode} onChange={(event) => updateHomeGroup(index, { selection_mode: event.target.value })} className="rounded-lg border border-gray-200 px-3 py-2"><option value="automatic">Automatic best sellers</option><option value="manual">Manual products</option><option value="mixed">Pinned + automatic</option></select><input type="number" min="1" max="12" value={group.display_limit} onChange={(event) => updateHomeGroup(index, { display_limit: Number(event.target.value) })} className="rounded-lg border border-gray-200 px-3 py-2" /></div>
                {group.selection_mode !== 'manual' && <div><p className="mb-2 text-xs font-bold text-gray-600">Source categories</p><div className="grid grid-cols-2 gap-2">{activeMenuCategories.map((category) => <label key={category.id} className="flex gap-2 text-sm"><input type="checkbox" checked={(group.category_ids || []).includes(category.id)} onChange={() => updateHomeGroup(index, { category_ids: (group.category_ids || []).includes(category.id) ? group.category_ids.filter((id) => id !== category.id) : [...(group.category_ids || []), category.id] })} />{category.name}</label>)}</div></div>}
                {group.selection_mode !== 'automatic' && <div><p className="mb-2 text-xs font-bold text-gray-600">{group.selection_mode === 'mixed' ? 'Pinned products' : 'Products'}</p><div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">{activeHomeItems.map((item) => <label key={item.id} className="flex gap-2 text-sm"><input type="checkbox" checked={(group.item_ids || []).includes(item.id)} onChange={() => updateHomeGroup(index, { item_ids: (group.item_ids || []).includes(item.id) ? group.item_ids.filter((id) => id !== item.id) : [...(group.item_ids || []), item.id] })} />{item.name}</label>)}</div></div>}
                <label className="flex gap-2 text-sm"><input type="checkbox" checked={group.is_active} onChange={(event) => updateHomeGroup(index, { is_active: event.target.checked })} />Active on Home</label>
              </div>)}
              <button onClick={addHomeGroup} className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm font-bold text-[#1E433A]">+ Add featured group</button>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4">
              <button onClick={() => setIsHomePicksOpen(false)} className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 shadow-2xs transition-all cursor-pointer">Cancel</button>
              <button disabled={isSavingHomePicks} onClick={saveHomePicks} className="px-6 py-2.5 bg-[#1E433A] text-white rounded-xl text-xs font-bold hover:bg-[#16342D] shadow-xs transition-all cursor-pointer disabled:opacity-60">{isSavingHomePicks ? 'Saving...' : 'Save Home Groups'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isEditModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-gray-100 bg-white/80 backdrop-blur-xs flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                {editMode === 'create' ? 'Create New Menu Item' : 'Edit Menu Item'}
              </h2>
              <button onClick={closeEditModal} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {errorMessage && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 flex items-start gap-2 shadow-xs">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-red-800">Error</p>
                    <p className="mt-0.5 text-xs text-red-700 leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(event) => setEditFormData({ ...editFormData, name: event.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Customer Description <span className="font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(event) => setEditFormData({ ...editFormData, description: event.target.value })}
                    rows={3}
                    maxLength={5000}
                    placeholder="Describe the taste, use, scent, material, or what makes this item special."
                    className="w-full resize-y border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Shown on the mobile product page. Leave blank to hide it for this item.
                  </p>
                </div>

                <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-900">Quick Setup</label>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Start with a preset, then fine tune the main type and family.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyMenuTemplate('custom')}
                      className="text-xs font-bold text-gray-600 hover:text-gray-900"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                    {Object.entries(MENU_ITEM_TEMPLATES)
                      .filter(([key]) => key !== 'custom')
                      .map(([key, template]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyMenuTemplate(key)}
                          className={`rounded-xl border px-3 py-3 text-left transition-colors ${selectedMenuTemplate === key
                            ? 'border-[#1F3A34] bg-white shadow-sm'
                            : 'border-gray-200 bg-white hover:bg-gray-100'
                            }`}
                        >
                          <p className="text-sm font-bold text-gray-900">{template.label}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500">{template.description}</p>
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Menu Category</label>
                  <div className="flex gap-2">
                    <select
                      value={editFormData.category_code}
                      onChange={(event) => {
                        const nextCategoryCode = event.target.value;
                        const nextCategory = menuCategories.find((category) => category.code === nextCategoryCode);
                        const nextTemplateKey = getTemplateKeyForCategory(nextCategory);
                        setEditFormData({
                          ...editFormData,
                          category_code: nextCategoryCode,
                          subcategory_code: '',
                          option_group_ids: nextCategory?.product_kind_code === 'drink'
                            ? editFormData.option_group_ids
                            : [],
                          ...(nextTemplateKey === 'custom'
                            ? {}
                            : {
                              ...MENU_ITEM_TEMPLATES[nextTemplateKey].defaults
                            })
                        });
                        setSelectedMenuTemplate(nextTemplateKey);
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                      required
                    >
                      {activeMenuCategories.map((category) => (
                        <option key={category.code} value={category.code}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const selectedCategory = menuCategories.find((category) => category.code === editFormData.category_code);
                        openCategoryModal(selectedCategory?.product_kind_code || 'drink');
                      }}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <Plus size={14} /> New Menu Category
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Choose the customer-facing category, such as Coffee, Matcha, Chocolate, Pastries, or Merchandise. Its menu type controls whether it is a drink, food, or retail item.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={editFormData.is_active ? 'active' : 'inactive'}
                    onChange={(event) => setEditFormData({ ...editFormData, is_active: event.target.value === 'active' })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">RM Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.base_price_rm}
                    onChange={(event) => setEditFormData({ ...editFormData, base_price_rm: event.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Token Price</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editFormData.base_price_token}
                    onChange={(event) => setEditFormData({ ...editFormData, base_price_token: event.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    placeholder="Token price"
                    required
                  />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Product Photo</label>
                  <div className="rounded-2xl border border-dashed border-[#BFD3CE] bg-[#F8FBFA] p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                      <div className="w-full md:w-44 shrink-0">
                        <div className="aspect-square rounded-xl border border-[#D7E4E0] bg-white overflow-hidden flex items-center justify-center shadow-sm">
                          <img
                            src={selectedImagePreview || resolveMenuImageUrl(editFormData.image_url)}
                            alt={editFormData.name || 'Menu item preview'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="flex-1 pt-1">
                        <div>
                          <label className="inline-flex cursor-pointer items-center rounded-lg bg-[#1F3A34] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#2E5E58]">
                            {selectedImageFile || editFormData.image_url ? 'Replace image' : 'Choose image'}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              onChange={handleImageFileChange}
                              className="sr-only"
                            />
                          </label>
                          <p className="mt-3 text-xs font-semibold text-gray-700">
                            Recommended: 1200 × 1200 px (square)
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">
                            PNG, JPEG, or WebP, up to 8 MB. The image is cropped to a square and optimized so the mobile menu displays it consistently.
                          </p>
                        </div>
                        {(selectedImageFile || editFormData.image_url) && (
                          <button
                            type="button"
                            onClick={clearSelectedImage}
                            className="text-xs font-bold text-red-600 hover:text-red-700"
                          >
                            Remove image
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-900">Item Options</label>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Set the options that apply to this item type.
                      </p>
                    </div>
                  </div>

                  {showDrinkControls ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={editFormData.is_handcrafted_drink}
                            onChange={(event) => setEditFormData({ ...editFormData, is_handcrafted_drink: event.target.checked })}
                            className="mt-1 w-4 h-4 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]"
                            id="isHandcraftedDrink"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-gray-900">Made-to-order drink</span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">Use for drinks prepared fresh for each order.</span>
                          </span>
                        </label>

                        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={editFormData.is_qualifying_cup}
                            onChange={(event) => setEditFormData({ ...editFormData, is_qualifying_cup: event.target.checked })}
                            className="mt-1 w-4 h-4 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]"
                            id="isQualifyingCup"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-gray-900">Counts for loyalty cups</span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">Use this when the item should count toward cup rewards.</span>
                          </span>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={Boolean(editFormData.allow_remarks)}
                            onChange={(event) => setEditFormData({ ...editFormData, allow_remarks: event.target.checked })}
                            className="mt-1 w-4 h-4 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]"
                          />
                          <span>
                            <span className="block text-sm font-semibold text-gray-900">Customer remarks</span>
                            <span className="block text-[11px] text-gray-500 mt-0.5">Let customers add a note to this drink.</span>
                          </span>
                        </label>
                      </div>

                    </>
                  ) : (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-700">
                      This item type does not need drink options. Keep the category, family, price, image, and status only.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving...' : editMode === 'create' ? 'Create Menu Item' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {isSubcategoryModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-gray-100 bg-white/80 backdrop-blur-xs flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Manage Subcategories</h2>
              <button onClick={() => setIsSubcategoryModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] min-h-0">
              <div className="border-r border-gray-100 overflow-y-auto max-h-[70vh]">
                <div className="p-4 space-y-3">
                  {menuSubcategories.map((subcategory) => (
                    <button
                      key={subcategory.id}
                      type="button"
                      onClick={() => editSubcategory(subcategory)}
                      className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{subcategory.name}</p>
                          <p className="text-[11px] text-gray-500">
                            {subcategory.product_kind_name} • {subcategory.category_name}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${subcategory.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {subcategory.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSaveSubcategory} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Main Type</label>
                  <select
                    value={subcategoryForm.category_code}
                    onChange={(event) => setSubcategoryForm({ ...subcategoryForm, category_code: event.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  >
                    {activeMenuCategories.map((category) => (
                      <option key={category.code} value={category.code}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sub Type Name</label>
                  <input
                    type="text"
                    value={subcategoryForm.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      setSubcategoryForm((current) => ({
                        ...current,
                        name,
                        code: current.id ? current.code : generateMenuCode(name)
                      }));
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    The internal code is generated automatically from this name.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    id="subcategory-active"
                    type="checkbox"
                    checked={Boolean(subcategoryForm.is_active)}
                    onChange={(event) => setSubcategoryForm({ ...subcategoryForm, is_active: event.target.checked })}
                    className="w-4 h-4 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]"
                  />
                  <label htmlFor="subcategory-active" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>

                <div className="pt-4 flex justify-between gap-3">
                  <div>
                    {subcategoryForm.id && (
                      <button
                        type="button"
                        onClick={handleDeleteSubcategory}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 disabled:opacity-60"
                      >
                        {isSubmitting ? 'Deleting...' : 'Delete Family'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSubcategoryModalOpen(false)}
                    className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg disabled:opacity-60"
                  >
                    {isSubmitting ? 'Saving...' : subcategoryForm.id ? 'Save Subcategory' : 'Create Subcategory'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isCategoryModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-900/35 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 border-b border-gray-100 bg-white/80 backdrop-blur-xs flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Manage Menu Categories</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] min-h-0">
              <div className="border-r border-gray-100 overflow-y-auto max-h-[70vh]">
                <div className="p-4 space-y-3">
                  {menuCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => editCategory(category)}
                      className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{category.name}</p>
                          <p className="text-[11px] text-gray-500">
                            {MENU_PRODUCT_KIND_OPTIONS.find((option) => option.value === category.product_kind_code)?.label || 'Other'} • {category.code}
                          </p>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${category.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {category.is_active ? 'Active' : 'Hidden'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSaveCategory} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Menu Type</label>
                  <select
                    value={categoryForm.product_kind_code}
                    onChange={(event) => setCategoryForm({ ...categoryForm, product_kind_code: event.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  >
                    {MENU_PRODUCT_KIND_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Menu Category Name</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(event) => {
                      const name = event.target.value;
                      setCategoryForm((current) => ({
                        ...current,
                        name,
                        code: current.id ? current.code : generateMenuCode(name)
                      }));
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    The internal code is generated automatically from this name.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sidebar order</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={categoryForm.sort_order}
                    onChange={(event) => setCategoryForm({ ...categoryForm, sort_order: event.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Lower numbers appear first in the customer menu sidebar. Use gaps such as 10, 20, and 30.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    id="category-active"
                    type="checkbox"
                    checked={Boolean(categoryForm.is_active)}
                    onChange={(event) => setCategoryForm({ ...categoryForm, is_active: event.target.checked })}
                    className="w-4 h-4 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]"
                  />
                  <label htmlFor="category-active" className="text-sm font-medium text-gray-700">
                    Active
                  </label>
                </div>

                <div className="pt-4 flex justify-between gap-3">
                  <div>
                    {categoryForm.id && (
                      <button
                        type="button"
                        onClick={handleDeleteCategory}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg border border-red-200 disabled:opacity-60"
                      >
                        {isSubmitting ? 'Deleting...' : 'Delete Category'}
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg disabled:opacity-60"
                  >
                  {isSubmitting ? 'Saving...' : categoryForm.id ? 'Save Category' : 'Create Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {deleteConfirmation && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="menu-delete-confirmation-title"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 sm:p-7">
              <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${deleteConfirmation.willArchive ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                {deleteConfirmation.willArchive
                  ? <Archive className="h-6 w-6" aria-hidden="true" />
                  : <AlertTriangle className="h-6 w-6" aria-hidden="true" />}
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2E5E58]">
                {deleteConfirmation.type === 'category'
                  ? 'Menu category'
                  : deleteConfirmation.type === 'subcategory'
                    ? 'Menu family'
                    : 'Menu item'}
              </p>
              <h3 id="menu-delete-confirmation-title" className="mt-1 text-xl font-bold text-gray-900">
                {deleteConfirmation.type === 'menu-item'
                  ? `Delete ${deleteConfirmation.name} permanently?`
                  : deleteConfirmation.willArchive
                  ? `Archive ${deleteConfirmation.name}?`
                  : `Delete ${deleteConfirmation.name}?`}
              </h3>

              <p className="mt-3 text-sm leading-6 text-gray-600">
                {deleteConfirmation.type === 'menu-item'
                  ? 'This permanently removes the archived item from the menu catalog. The system will allow this only when no order or loyalty history refers to it.'
                  : deleteConfirmation.willArchive
                  ? 'This group has existing menu information, so it will be hidden from active selections while its sales and order history remain safely stored.'
                  : 'This group is empty and can be permanently deleted. This action cannot be undone.'}
              </p>

              {deleteConfirmation.willArchive && (
                <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
                  <p className="text-sm font-semibold text-amber-900">
                    {deleteConfirmation.itemCount} menu {deleteConfirmation.itemCount === 1 ? 'item' : 'items'}
                    {deleteConfirmation.type === 'category' && (
                      <> · {deleteConfirmation.subcategoryCount} {deleteConfirmation.subcategoryCount === 1 ? 'family' : 'families'}</>
                    )}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    You can review this group later under hidden or archived records.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/80 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                disabled={isSubmitting}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
              >
                {deleteConfirmation.type === 'menu-item'
                  ? 'Keep item archived'
                  : deleteConfirmation.type === 'category' ? 'Keep category' : 'Keep family'}
              </button>
              <button
                type="button"
                onClick={confirmDeleteSelection}
                disabled={isSubmitting}
                autoFocus
                className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-60 ${deleteConfirmation.willArchive ? 'bg-[#1F3A34] hover:bg-[#2E5E58]' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {isSubmitting
                  ? 'Please wait...'
                  : deleteConfirmation.type === 'menu-item'
                    ? 'Delete permanently'
                    : deleteConfirmation.willArchive
                    ? (deleteConfirmation.type === 'category' ? 'Archive category' : 'Hide family')
                    : (deleteConfirmation.type === 'category' ? 'Delete category' : 'Delete family')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Menu;
