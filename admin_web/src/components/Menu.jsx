import React, { useState } from 'react';
import { 
  Search, ChevronDown, Download, Plus, 
  ClipboardList, Layers, CheckCircle2, XCircle, Tag,
  MoreVertical, Edit2, Copy, Trash2, X, Eye
} from 'lucide-react';
import Pagination from './Pagination';

const KPICard = ({ title, value, change, icon: Icon, iconBg, iconColor = "text-white" }) => (
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

import { initialMenuData, optionsConfig } from '../data/menuData';

const Menu = () => {
  const [menuItems, setMenuItems] = useState(initialMenuData);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeTab, setActiveTab] = useState("Details");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this menu item?")) {
      setMenuItems(menuItems.filter(item => item.id !== id));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }
    }
  };

  const handleDuplicate = (item) => {
    const newId = `MENU-${String(menuItems.length + 1).padStart(3, '0')}`;
    const duplicatedItem = { ...item, id: newId, name: `${item.name} (Copy)` };
    setMenuItems([duplicatedItem, ...menuItems]);
    setSelectedItem(duplicatedItem);
  };

  const handleEditClick = (item) => {
    setEditFormData({ ...item });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setMenuItems((prev) => {
      if (prev.find(item => item.id === editFormData.id)) {
        return prev.map((item) => (item.id === editFormData.id ? editFormData : item));
      }
      return [editFormData, ...prev];
    });
    if (selectedItem?.id === editFormData.id) {
      setSelectedItem(editFormData);
    }
    setIsEditModalOpen(false);
  };

  const handleAddNewMenu = () => {
    const newId = `MENU-${String(menuItems.length + 1).padStart(3, '0')}`;
    setEditFormData({
      id: newId,
      name: "",
      description: "",
      category: "C2 Coffee Craft",
      price: "RM 0.00",
      status: "Available",
      sales: "0",
      isBestSeller: false,
      image: "https://via.placeholder.com/150",
      prepTime: "2 mins",
      rewardToken: "0 tokens",
      options: []
    });
    setIsEditModalOpen(true);
  };

  const uniqueCategories = [
    "All",
    "C2 Coffee Craft",
    "C2 Barista Craft",
    "C2 Mocktails",
    "C2 Matcha",
    "C2 Chocolate",
    "C2 Pour Over",
    "C2 Coffee",
    "C2 Flavoured Coffee",
    "C2 Pastries",
    "C2 Merchandise",
    "5luxes Candles"
  ];

  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesStatus = selectedStatus === "All" || item.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredMenuItems.length / ITEMS_PER_PAGE));
  const paginatedItems = filteredMenuItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const resetPage = () => setCurrentPage(1);

  return (
    <div className="h-full flex flex-col px-8 pb-8 pt-2 space-y-6 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your menu items, categories and availability.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard title="Total Menu Items" value="72" change="↑ 12.6% vs last month" icon={ClipboardList} iconBg="bg-[#1F3A34]" />
          <KPICard title="Categories" value="12" change="↑ 8.2% vs last month" icon={Layers} iconBg="bg-[#2E5E58]" />
          <KPICard title="Available Items" value="65" change="90.3% of total" icon={CheckCircle2} iconBg="bg-[#6F9F96]" />
          <KPICard title="Unavailable Items" value="7" change="9.7% of total" icon={XCircle} iconBg="bg-[#E07A5F]" />
          <KPICard title="Average Price" value="RM12.45" change="↑ 9.3% vs last month" icon={Tag} iconBg="bg-[#D4AF7A]" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative w-full lg:max-w-[400px]">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3A34]"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
            {/* Category Dropdown */}
            <div className="relative">
              <select 
                value={selectedCategory} 
                onChange={(e) => { setSelectedCategory(e.target.value); resetPage(); }}
                onFocus={() => setCategoryOpen(true)}
                onBlur={() => setCategoryOpen(false)}
                className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
              >
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat === "All" ? "All Categories" : cat}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${categoryOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
            
            {/* Status Dropdown */}
            <div className="relative">
              <select 
                value={selectedStatus} 
                onChange={(e) => { setSelectedStatus(e.target.value); resetPage(); }}
                onFocus={() => setStatusOpen(true)}
                onBlur={() => setStatusOpen(false)}
                className="pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Available">Available</option>
                <option value="Unavailable">Unavailable</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 ${statusOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
            
            <button 
              onClick={() => alert("Exporting menu data to CSV...")}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer"
            >
              <Download size={16} className="mr-1.5" /> Export
            </button>
            <button 
              onClick={handleAddNewMenu}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-pointer"
            >
              + New Menu
            </button>
          </div>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex gap-6 min-h-0">
        
        {/* Table */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden min-w-0">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-900 font-bold border-b border-gray-200 sticky top-0 bg-white z-10">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">Menu Item</th>
                  <th className="px-6 py-4 whitespace-nowrap">Category</th>
                  <th className="px-6 py-4 whitespace-nowrap">Price (RM)</th>
                  <th className="px-6 py-4 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 whitespace-nowrap">Sales</th>
                  <th className="px-6 py-4 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.map((item) => (
                  <tr 
                    key={item.id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img src={item.image} alt={item.name} className="w-10 h-10 object-contain shrink-0 drop-shadow-sm" />
                        <div>
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-400 font-medium">ID: {item.id}</span>
                            {item.isBestSeller && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#D4AF7A]/20 text-[#A8824A]">Best Seller</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-700">{item.category}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">{item.price}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                        item.status === "Available" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-red-100 text-red-700"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{item.sales}</td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          className="p-1.5 bg-[#1F3A34] text-white rounded hover:bg-[#2E5E58] transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
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

        {/* Side Panel */}
        {selectedItem && (
          <div className="w-[400px] shrink-0 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-5 flex flex-col h-full">
              {/* Panel Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex gap-4">
                  <img src={selectedItem.image} alt={selectedItem.name} className="w-16 h-16 object-contain shrink-0 drop-shadow-md" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-gray-900">{selectedItem.name}</h2>
                      <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">Available</span>
                      {selectedItem.isBestSeller && (
                        <span className="px-2 py-0.5 rounded bg-[#D4AF7A]/20 text-[#A8824A] text-[10px] font-bold">Best Seller</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">ID : {selectedItem.id}</p>
                    <p className="text-[10px] text-gray-500 font-medium mt-0.5">Created on : 19 Aug 2026 - Updated on 19 Aug 2026</p>
                  </div>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-1 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100">
                  <X size={20} />
                </button>
              </div>

              {/* Tabs */}
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

              {/* Panel Scrollable Content */}
              <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-5 text-sm">
                {activeTab === 'Details' && (
                  <>
                    <div className="mb-4">
                      <p className="text-gray-500 font-medium text-xs mb-1">Description</p>
                      <p className="text-gray-900">{selectedItem.description}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2">
                        <p className="text-gray-500 font-medium">Category</p>
                        <p className="text-gray-900 font-medium">{selectedItem.category}</p>
                      </div>
                      <div className="grid grid-cols-2">
                        <p className="text-gray-500 font-medium">Price (RM)</p>
                        <p className="text-gray-900 font-medium">{selectedItem.price.replace('RM ', 'RM ')}</p>
                      </div>
                      <div className="grid grid-cols-2">
                        <p className="text-gray-500 font-medium">Status</p>
                        <p className="text-gray-900 font-medium">Availability</p>
                      </div>
                      <div className="grid grid-cols-2">
                        <p className="text-gray-500 font-medium">Prep Time</p>
                        <p className="text-gray-900 font-medium">{selectedItem.prepTime}</p>
                      </div>

                      {(!["C2 Pastries", "C2 Merchandise", "5luxes Candles"].includes(selectedItem.category)) && (
                        <div className="grid grid-cols-2">
                          <p className="text-gray-500 font-medium">Reward Token</p>
                          <p className="text-gray-900 font-medium">{selectedItem.rewardToken}</p>
                        </div>
                      )}
                    </div>

                    {(!["C2 Pastries", "C2 Merchandise", "5luxes Candles"].includes(selectedItem.category)) && (
                      <div className="pt-4 mt-4 border-t border-gray-100">
                        <h4 className="font-bold text-gray-900 mb-3 text-sm">Available Options</h4>
                        <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                          {Object.keys(optionsConfig).filter(optKey => selectedItem.options?.includes(optKey)).map(optKey => {
                            const config = optionsConfig[optKey];
                            if (!config) return null;
                            return (
                              <div key={optKey} className={optKey === 'sweetness' ? 'col-span-2' : ''}>
                                <p className="text-[11px] text-gray-500 font-medium mb-2">{config.label}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {config.values.map(val => (
                                    <span key={val} className="px-2.5 py-1 bg-gray-900 text-white text-[11px] rounded-lg font-medium">{val}</span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          <div>
                            <p className="text-[11px] text-gray-500 font-medium mb-2">Order Type</p>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="px-2.5 py-1 bg-gray-900 text-white text-[11px] rounded-lg font-medium">Pick Up</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <p className="text-[10px] text-gray-500 font-medium mb-2">Item Image</p>
                      <img src={selectedItem.image} alt={selectedItem.name} className="w-16 h-16 object-contain shrink-0 drop-shadow-md" />
                    </div>
                  </>
                )}
                {activeTab === 'Sales' && (
                  <div className="space-y-6">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Total Sales</p>
                        <p className="text-lg font-bold text-gray-900">{selectedItem.sales}</p>
                        <p className="text-[10px] text-green-600 font-medium mt-1">+12% this month</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <p className="text-xs text-gray-500 font-medium mb-1">Total Revenue</p>
                        <p className="text-lg font-bold text-gray-900">
                          RM {(parseInt(selectedItem.sales.replace(/,/g, '')) * parseFloat(selectedItem.price.replace('RM ', ''))).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </p>
                        <p className="text-[10px] text-green-600 font-medium mt-1">+8% this month</p>
                      </div>
                    </div>


                  </div>
                )}
                {activeTab === 'History' && (
                  <div className="space-y-6">
                    <div className="relative border-l-2 border-gray-100 ml-3 space-y-8 pb-4">
                      <div className="relative pl-6">
                        <div className="absolute w-3 h-3 bg-[#1F3A34] rounded-full -left-[7px] top-1.5 ring-4 ring-white"></div>
                        <p className="text-sm font-bold text-gray-900">Price Updated</p>
                        <p className="text-xs text-gray-500 mt-0.5">Changed from RM 15.90 to RM 16.90</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-1">19 Aug 2026 • by Admin</p>
                      </div>
                      
                      <div className="relative pl-6">
                        <div className="absolute w-3 h-3 bg-gray-200 rounded-full -left-[7px] top-1.5 ring-4 ring-white"></div>
                        <p className="text-sm font-bold text-gray-900">Status Changed</p>
                        <p className="text-xs text-gray-500 mt-0.5">Changed to Available</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-1">19 Aug 2026 • by Admin</p>
                      </div>

                      <div className="relative pl-6">
                        <div className="absolute w-3 h-3 bg-gray-200 rounded-full -left-[7px] top-1.5 ring-4 ring-white"></div>
                        <p className="text-sm font-bold text-gray-900">Item Created</p>
                        <p className="text-xs text-gray-500 mt-0.5">Added to C2 Coffee Craft category</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-1">19 Aug 2026 • by System</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-200 shrink-0 grid grid-cols-3 gap-3">
                <button 
                  onClick={() => handleDuplicate(selectedItem)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Copy size={14} /> Duplicate
                </button>
                <button 
                  onClick={() => handleEditClick(selectedItem)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button 
                  onClick={() => handleDelete(selectedItem.id)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Edit Modal */}
      {isEditModalOpen && editFormData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Edit Menu Item</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                <input 
                  type="text" 
                  value={editFormData.name} 
                  onChange={e => setEditFormData({...editFormData, name: e.target.value})} 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <textarea 
                  value={editFormData.description} 
                  onChange={e => setEditFormData({...editFormData, description: e.target.value})} 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] resize-none h-20" 
                />
              </div>
              
              <div className="flex gap-4 items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="w-16 h-16 bg-white border border-gray-200 rounded-lg shrink-0 flex items-center justify-center p-1">
                  <img src={editFormData.image} alt={editFormData.name} className="w-full h-full object-contain drop-shadow-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-900 mb-1.5">Drink Image</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const newImageUrl = URL.createObjectURL(e.target.files[0]);
                        setEditFormData({ ...editFormData, image: newImageUrl });
                      }
                    }}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-[#1F3A34] file:text-white hover:file:bg-[#2E5E58] cursor-pointer" 
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <input type="text" value={editFormData.category} onChange={e => setEditFormData({...editFormData, category: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Price (RM)</label>
                  <input type="text" value={editFormData.price} onChange={e => setEditFormData({...editFormData, price: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select value={editFormData.status} onChange={e => setEditFormData({...editFormData, status: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]">
                    <option value="Available">Available</option>
                    <option value="Unavailable">Unavailable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Sales</label>
                  <input type="text" value={editFormData.sales} onChange={e => setEditFormData({...editFormData, sales: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Prep Time</label>
                  <input type="text" value={editFormData.prepTime} onChange={e => setEditFormData({...editFormData, prepTime: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
                </div>

                {(!["C2 Pastries", "C2 Merchandise", "5luxes Candles"].includes(editFormData.category)) && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Reward Token</label>
                    <input type="text" value={editFormData.rewardToken} onChange={e => setEditFormData({...editFormData, rewardToken: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" />
                  </div>
                )}
                <div className="flex items-center gap-2 mt-6">
                  <input type="checkbox" checked={editFormData.isBestSeller} onChange={e => setEditFormData({...editFormData, isBestSeller: e.target.checked})} className="w-4 h-4 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]" id="isBestSeller" />
                  <label htmlFor="isBestSeller" className="text-sm font-medium text-gray-700">Best Seller</label>
                </div>
              </div>

              {(!["C2 Pastries", "C2 Merchandise", "5luxes Candles"].includes(editFormData.category)) && (
                <div className="pt-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-gray-900 mb-2">Available Options</label>
                  <div className="grid grid-cols-3 gap-y-3 gap-x-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    {Object.entries(optionsConfig).map(([key, config]) => (
                      <div key={key} className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id={`opt-${key}`}
                          checked={(editFormData.options || []).includes(key)}
                          onChange={(e) => {
                            const currentOptions = editFormData.options || [];
                            if (e.target.checked) {
                              setEditFormData({...editFormData, options: [...currentOptions, key]});
                            } else {
                              setEditFormData({...editFormData, options: currentOptions.filter(o => o !== key)});
                            }
                          }}
                          className="w-3.5 h-3.5 text-[#1F3A34] rounded border-gray-300 accent-[#1F3A34]"
                        />
                        <label htmlFor={`opt-${key}`} className="text-xs font-medium text-gray-700 cursor-pointer select-none">
                          {config.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="pt-4 flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Menu;
