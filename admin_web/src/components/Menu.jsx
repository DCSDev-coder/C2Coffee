import React, { useEffect, useState } from 'react';
import {
  Search,
  ChevronDown,
  Download,
  Plus,
  ClipboardList,
  Layers,
  CheckCircle2,
  XCircle,
  Tag,
  Edit2,
  Copy,
  Trash2,
  X,
  Eye
} from 'lucide-react';
import Pagination from './Pagination';
import { exportToCSV } from '../utils/exportToCSV';
import {
  createAdminMenuCategory,
  createAdminMenuSubcategory,
  createAdminMenuItem,
  deleteAdminMenuItem,
  loadAdminMenu,
  getAdminApiBaseUrl,
  uploadAdminMenuImage,
  updateAdminMenuCategory,
  updateAdminMenuSubcategory,
  updateAdminMenuItem
} from '../lib/adminApi';

const RESTRICTED_CATEGORIES = new Set(['C2 Pastries', 'C2 Merchandise', '5luxes Candles']);
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

const KPICard = ({ title, value, change, icon: Icon, iconBg, iconColor = 'text-white' }) => (
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
            {change}
          </p>
        </div>
      )}
    </div>
  </div>
);

const formatMoney = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 'Tokens 0.00';
  }

  return `Tokens ${numericValue.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

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

const createTempId = (prefix) => {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(16).slice(2, 10);
  return `${prefix}-${suffix}`;
};

const CUSTOMIZATION_FLAGS = [
  {
    key: 'allow_choice_of_beans',
    label: 'Choice of beans',
    description: 'Enable bean selection for espresso-based drinks.'
  },
  {
    key: 'allow_espresso_shot',
    label: 'Espresso shots',
    description: 'Allow extra espresso shots for the drink.'
  },
  {
    key: 'allow_choice_of_milk',
    label: 'Choice of milk',
    description: 'Show milk selection such as fresh milk or oat milk.'
  },
  {
    key: 'allow_choice_of_sweetness',
    label: 'Choice of sweetness',
    description: 'Show sweetness presets on the product page.'
  },
  {
    key: 'allow_ice_level',
    label: 'Ice level',
    description: 'Show ice level selection on the product page.'
  },
  {
    key: 'allow_temperature',
    label: 'Temperature',
    description: 'Show hot and cold options when the drink supports both.'
  },
  {
    key: 'allow_sparkling_mixer',
    label: 'Sparkling mixer',
    description: 'Enable sparkling mixer selection for drinks like Espresso Bomb.'
  },
  {
    key: 'allow_order_type',
    label: 'Order type',
    description: 'Show the take-away or dine-in order type choice.'
  },
  {
    key: 'allow_remarks',
    label: 'Remarks',
    description: 'Allow customers to leave a remark on the drink.'
  }
];

const emptyCustomizationFlags = () =>
  CUSTOMIZATION_FLAGS.reduce((acc, flag) => {
    acc[flag.key] = false;
    return acc;
  }, {});

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
  ...emptyCustomizationFlags()
});

const buildFormFromItem = (item) => ({
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
  ...CUSTOMIZATION_FLAGS.reduce((acc, flag) => {
    acc[flag.key] = Boolean(item[flag.key]);
    return acc;
  }, {})
});

const flattenMenuData = (categories) =>
  categories.flatMap((category) =>
    (category.items || []).map((item) => ({
      ...item,
      category_code: category.code,
      category_name: category.name,
      category_sort_order: category.sort_order,
      category_is_active: category.is_active
    }))
  );

const Menu = () => {
  const [menuCategories, setMenuCategories] = useState([]);
  const [menuSubcategories, setMenuSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
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
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSubcategoryModalOpen, setIsSubcategoryModalOpen] = useState(false);
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

  const loadMenu = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await loadAdminMenu();
      const categories = response.categories || [];
      const subcategories = response.subcategories || [];
      setMenuCategories(categories);
      setMenuSubcategories(subcategories);

      if (selectedCategory !== 'All' && !categories.some((category) => category.code === selectedCategory)) {
        setSelectedCategory('All');
      }

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
  };

  useEffect(() => {
    void loadMenu();
  }, []);

  const categoryOptions = [
    { value: 'All', label: 'All Categories' },
    ...menuCategories.map((category) => ({
      value: category.code,
      label: category.name
    }))
  ];

  const allMenuItems = flattenMenuData(menuCategories);
  const activeSubcategoryOptions = menuSubcategories.filter(
    (subcategory) => subcategory.category_code === editFormData.category_code && subcategory.is_active
  );

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
      (selectedStatus === 'Available' && item.is_active) ||
      (selectedStatus === 'Unavailable' && !item.is_active);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMenuItems.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredMenuItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const selectedItem = allMenuItems.find((item) => item.id === selectedItemId) || null;

  const totalMenuItems = allMenuItems.length;
  const availableItems = allMenuItems.filter((item) => item.is_active).length;
  const unavailableItems = totalMenuItems - availableItems;
  const averagePrice = totalMenuItems > 0
    ? allMenuItems.reduce((sum, item) => sum + parseMoneyInput(item.base_price_rm), 0) / totalMenuItems
    : 0;

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

  const resetPage = () => setCurrentPage(1);

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
    setEditMode('create');
    setEditFormData(buildEmptyForm(fallbackCategory));
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
      sort_order: menuCategories.length,
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
    setEditFormData(buildFormFromItem(item));
    setSelectedImageFile(null);
    setSelectedImagePreview(item.image_url || '');
    setIsEditModalOpen(true);
  };

  const handleDuplicate = (item) => {
    setEditMode('create');
    setEditFormData({
      ...buildFormFromItem(item),
      id: null,
      name: `${item.name} (Copy)`
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Deactivate "${item.name}"? It will stop appearing as active in the menu.`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await deleteAdminMenuItem(item.id);
      setSelectedItemId(null);
      await loadMenu();
    } catch (error) {
      setErrorMessage(error.message || 'Unable to deactivate menu item.');
    } finally {
      setIsSubmitting(false);
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
      allow_choice_of_beans: Boolean(editFormData.allow_choice_of_beans),
      allow_espresso_shot: Boolean(editFormData.allow_espresso_shot),
      allow_choice_of_milk: Boolean(editFormData.allow_choice_of_milk),
      allow_choice_of_sweetness: Boolean(editFormData.allow_choice_of_sweetness),
      allow_ice_level: Boolean(editFormData.allow_ice_level),
      allow_temperature: Boolean(editFormData.allow_temperature),
      allow_sparkling_mixer: Boolean(editFormData.allow_sparkling_mixer),
      allow_order_type: Boolean(editFormData.allow_order_type),
      allow_remarks: Boolean(editFormData.allow_remarks)
    };

    try {
      let response;
      if (editMode === 'create') {
        response = await createAdminMenuItem(payload);
      } else {
        response = await updateAdminMenuItem(editFormData.id, payload);
      }

      closeEditModal();
      await refreshAndSelect(response.item?.id ?? editFormData.id);
    } catch (error) {
      setErrorMessage(error.message || 'Unable to save menu item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportRows = [
    [
      'Menu Item',
      'Category',
      'Tokens Price',
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
      item.is_active ? 'Available' : 'Unavailable',
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
      setErrorMessage('Please upload a PNG, JPEG, or WEBP image.');
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
  };

  const openSubcategoryModal = (categoryCode = '') => {
    const fallbackCategory = categoryCode || menuCategories[0]?.code || '';
    setSubcategoryForm({
      id: null,
      category_code: fallbackCategory,
      code: '',
      name: '',
      sort_order: menuSubcategories.length,
      is_active: true
    });
    setIsSubcategoryModalOpen(true);
  };

  const handleSaveCategory = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const payload = {
        code: categoryForm.code.trim(),
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
        code: subcategoryForm.code.trim(),
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard title="Total Menu Items" value={String(totalMenuItems)} change="Live catalog items" icon={ClipboardList} iconBg="bg-[#1F3A34]" />
          <KPICard title="Categories" value={String(menuCategories.length)} change="Live menu groups" icon={Layers} iconBg="bg-[#2E5E58]" />
          <KPICard title="Available Items" value={String(availableItems)} change={`${totalMenuItems > 0 ? ((availableItems / totalMenuItems) * 100).toFixed(1) : '0.0'}% active`} icon={CheckCircle2} iconBg="bg-[#6F9F96]" />
          <KPICard title="Unavailable Items" value={String(unavailableItems)} change="Soft-deactivated items" icon={XCircle} iconBg="bg-[#E07A5F]" />
          <KPICard title="Average Price" value={formatMoney(averagePrice)} change="Tokens menu pricing" icon={Tag} iconBg="bg-[#D4AF7A]" />
        </div>

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
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown
                  size={16}
                  className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </div>

            <button
              onClick={() => openCategoryModal()}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer transition-transform duration-200"
            >
              <Layers size={16} className="mr-1.5" /> Manage Main Groups
            </button>

            <button
              onClick={() => openSubcategoryModal()}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer transition-transform duration-200"
            >
              <Layers size={16} className="mr-1.5" /> Manage Menu Types
            </button>

            <button
              onClick={() => exportToCSV(exportRows, 'menu.csv')}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer transition-transform duration-200"
            >
              <Download size={16} className="mr-1.5" /> Export
            </button>

            <button
              onClick={openCreateModal}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium whitespace-nowrap cursor-pointer"
            >
              <Plus size={16} className="mr-1.5" /> New Menu
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
                  <th className="px-6 py-4 whitespace-nowrap">Tokens Price</th>
                  <th className="px-6 py-4 whitespace-nowrap">Token Price</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 whitespace-nowrap">Sales</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Actions</th>
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
                        <span
                          className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                            item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {item.is_active ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-600">{(item.sales_count || 0).toLocaleString()}</td>
                      <td className="px-6 py-3 text-center">
                        <button
                          className="p-1.5 bg-[#1F3A34] text-white rounded hover:bg-[#2E5E58] transition-colors"
                          onClick={(event) => {
                            event.stopPropagation();
                            openSelectedItem(item.id);
                          }}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 flex shrink-0 bg-white">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filteredMenuItems.length}
              itemName="menu items"
            />
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
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedItem.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {selectedItem.is_active ? 'Available' : 'Unavailable'}
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
                        <p className="text-gray-500 font-medium">Category</p>
                        <p className="text-gray-900 font-medium">{selectedItem.category_name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">Subcategory</p>
                        <p className="text-gray-900 font-medium">{selectedItem.subcategory_name || 'General'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">Product Group</p>
                        <p className="text-gray-900 font-medium">{selectedItem.product_kind_name || 'Other'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <p className="text-gray-500 font-medium">Tokens Price</p>
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
                            {CUSTOMIZATION_FLAGS.filter((flag) => selectedItem[flag.key]).length > 0 ? (
                              CUSTOMIZATION_FLAGS.filter((flag) => selectedItem[flag.key]).map((flag) => (
                                <span
                                  key={flag.key}
                                  className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700"
                                >
                                  {flag.label}
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
                  onClick={() => handleDelete(selectedItem)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                {editMode === 'create' ? 'Create New Menu Item' : 'Edit Menu Item'}
              </h2>
              <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-1">
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

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Main Category</label>
                  <div className="flex gap-2">
                    <select
                      value={editFormData.category_code}
                      onChange={(event) => {
                        const nextCategoryCode = event.target.value;
                        const nextSubcategories = menuSubcategories.filter(
                          (subcategory) => subcategory.category_code === nextCategoryCode && subcategory.is_active
                        );
                        setEditFormData({
                          ...editFormData,
                          category_code: nextCategoryCode,
                          subcategory_code: nextSubcategories[0]?.code || ''
                        });
                      }}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                      required
                    >
                      {menuCategories.map((category) => (
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
                      <Plus size={14} /> New Group
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Use this for the broad product group such as Drinks, Food, Merchandise, or Candles.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Subcategory</label>
                  <div className="flex gap-2">
                    <select
                      value={editFormData.subcategory_code}
                      onChange={(event) => setEditFormData({ ...editFormData, subcategory_code: event.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    >
                      <option value="">General</option>
                      {activeSubcategoryOptions.map((subcategory) => (
                        <option key={subcategory.id} value={subcategory.code}>
                          {subcategory.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openSubcategoryModal(editFormData.category_code)}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <Plus size={14} /> New Type
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Add drink families like Matcha or Sparkling here so vouchers and tiers can detect them automatically.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    value={editFormData.is_active ? 'active' : 'inactive'}
                    onChange={(event) => setEditFormData({ ...editFormData, is_active: event.target.value === 'active' })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                  >
                    <option value="active">Available</option>
                    <option value="inactive">Unavailable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Base Price (Tokens)</label>
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
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start">
                      <div className="w-full md:w-36 shrink-0">
                        <div className="aspect-square rounded-xl border border-gray-200 bg-white overflow-hidden flex items-center justify-center">
                          <img
                            src={selectedImagePreview || resolveMenuImageUrl(editFormData.image_url)}
                            alt={editFormData.name || 'Menu item preview'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleImageFileChange}
                            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#1F3A34] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-[#2E5E58]"
                          />
                          <p className="mt-2 text-xs text-gray-500">
                            Upload a photo and we will store it under the public menu assets so the mobile app can display it automatically.
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

                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    checked={editFormData.is_handcrafted_drink}
                    onChange={(event) => setEditFormData({ ...editFormData, is_handcrafted_drink: event.target.checked })}
                    className="w-4 h-4 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]"
                    id="isHandcraftedDrink"
                  />
                  <label htmlFor="isHandcraftedDrink" className="text-sm font-medium text-gray-700">
                    Made-to-order drink
                  </label>
                </div>

                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    checked={editFormData.is_qualifying_cup}
                    onChange={(event) => setEditFormData({ ...editFormData, is_qualifying_cup: event.target.checked })}
                    className="w-4 h-4 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]"
                    id="isQualifyingCup"
                  />
                  <label htmlFor="isQualifyingCup" className="text-sm font-medium text-gray-700">
                    Counts for loyalty cups
                  </label>
                </div>

                <div className="md:col-span-2 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-900">Customization Options</label>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Turn each drink option on or off.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CUSTOMIZATION_FLAGS.map((flag) => (
                      <label
                        key={flag.key}
                        className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(editFormData[flag.key])}
                          onChange={(event) =>
                            setEditFormData({ ...editFormData, [flag.key]: event.target.checked })
                          }
                          className="mt-1 w-4 h-4 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-gray-900">{flag.label}</span>
                          <span className="block text-[11px] text-gray-500 mt-0.5">{flag.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
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
        </div>
      )}

      {isSubcategoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Manage Subcategories</h2>
              <button onClick={() => setIsSubcategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">Main Category</label>
                  <select
                    value={subcategoryForm.category_code}
                    onChange={(event) => setSubcategoryForm({ ...subcategoryForm, category_code: event.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  >
                    {menuCategories.map((category) => (
                      <option key={category.code} value={category.code}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Subcategory Name</label>
                  <input
                    type="text"
                    value={subcategoryForm.name}
                    onChange={(event) => setSubcategoryForm({ ...subcategoryForm, name: event.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Subcategory Code</label>
                  <input
                    type="text"
                    value={subcategoryForm.code}
                    onChange={(event) => setSubcategoryForm({ ...subcategoryForm, code: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    placeholder="matcha"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sort Order</label>
                    <input
                      type="number"
                      min="0"
                      value={subcategoryForm.sort_order}
                      onChange={(event) => setSubcategoryForm({ ...subcategoryForm, sort_order: event.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
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
                </div>

                <div className="pt-4 flex justify-end gap-3">
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
        </div>
      )}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Manage Main Categories</h2>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">Product Group</label>
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
                  <label className="block text-xs font-medium text-gray-500 mb-1">Main Category Name</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Main Category Code</label>
                  <input
                    type="text"
                    value={categoryForm.code}
                    onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_') })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    placeholder="coffee"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Sort Order</label>
                    <input
                      type="number"
                      min="0"
                      value={categoryForm.sort_order}
                      onChange={(event) => setCategoryForm({ ...categoryForm, sort_order: event.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-6">
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
                </div>

                <div className="pt-4 flex justify-end gap-3">
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
                    {isSubmitting ? 'Saving...' : categoryForm.id ? 'Save Main Category' : 'Create Main Category'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Menu;
