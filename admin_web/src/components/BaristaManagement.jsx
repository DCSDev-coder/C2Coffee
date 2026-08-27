import React, { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, Download, Plus, MoreVertical, Coffee, CheckCircle, XCircle, X, Edit3, Trash2 } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { exportToCSV } from '../utils/exportToCSV';
import Pagination from './Pagination';
import { adminRequest } from '../lib/adminApi';

const StatCard = ({ title, value, subtitle, icon: Icon, iconBgColor, iconColor }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBgColor} ${iconColor} shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      {subtitle && (
        <div className="flex items-center gap-1 mt-1">
          <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal">
            {subtitle}
          </p>
        </div>
      )}
    </div>
  </div>
);

const StatusTag = ({ status }) => {
  const isActive = status === 'Active';
  return (
    <span className={`px-3 py-1 rounded font-bold text-[13px] inline-flex items-center justify-center ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {status}
    </span>
  );
};

const BaristaManagement = () => {
  const [baristas, setBaristas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [currentPage, setCurrentPage] = useState(1);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Action menu and modals state
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBarista, setEditingBarista] = useState(null);
  
  // Modal form states
  const [formName, setFormName] = useState('');
  const [formStatus, setFormStatus] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const itemsPerPage = 10;
  
  const fetchBaristas = async () => {
    setIsLoading(true);
    try {
      const response = await adminRequest('/v1/admin/baristas');
      const formatted = (response.baristas || []).map(b => ({
        id: b.id,
        name: b.name,
        status: b.is_active ? 'Active' : 'Inactive',
        is_active: !!b.is_active,
        createdAt: new Date(b.created_at).toLocaleString(),
        raw: b
      }));
      setBaristas(formatted);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBaristas();
  }, []);

  // Derived filtered data
  const filteredBaristas = useMemo(() => {
    return baristas.filter(barista => {
      const matchesSearch = barista.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All Status' || barista.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [searchTerm, selectedStatus, baristas]);

  const totalPages = Math.ceil(filteredBaristas.length / itemsPerPage) || 1;
  const paginatedBaristas = filteredBaristas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Stats
  const totalBaristas = baristas.length;
  const activeBaristas = baristas.filter(a => a.status === 'Active').length;
  const inactiveBaristas = baristas.filter(a => a.status === 'Inactive').length;

  const handleExport = () => {
    const rows = [
      ["Name", "Status", "Created At"],
      ...filteredBaristas.map(a => [
        `"${a.name}"`, 
        `"${a.status}"`, 
        `"${a.createdAt}"`
      ])
    ];
    exportToCSV(rows, "barista_management.csv");
  };
  
  const openModal = (barista = null) => {
    setEditingBarista(barista);
    setFormName(barista ? barista.name : '');
    setFormStatus(barista ? !!barista.is_active : true);
    setFormError('');
    setIsModalOpen(true);
  };
  
  const handleDeleteBarista = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete barista ${name}?`)) return;
    
    try {
      await adminRequest(`/v1/admin/baristas/${id}`, { method: 'DELETE' });
      setBaristas(baristas.filter(a => a.id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete barista");
    }
  };

  const handleSaveBarista = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');
    
    try {
      if (editingBarista) {
        // Edit
        await adminRequest(`/v1/admin/baristas/${editingBarista.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formName,
            is_active: formStatus
          })
        });
      } else {
        // Create
        await adminRequest('/v1/admin/baristas', {
          method: 'POST',
          body: JSON.stringify({
            name: formName,
            is_active: formStatus
          })
        });
      }
      
      setIsModalOpen(false);
      fetchBaristas();
    } catch (err) {
      setFormError(err.message || 'An error occurred while saving the barista.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="p-6 lg:p-8 w-full h-full flex flex-col">
        <div className="mb-6 shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">Barista Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage the list of baristas who use the Barista App.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
          <StatCard
            title="Total Baristas"
            value={totalBaristas}
            subtitle="Registered baristas"
            icon={Coffee}
            iconBgColor="bg-[#1F3A34]"
            iconColor="text-white"
          />
          <StatCard
            title="Active Baristas"
            value={activeBaristas}
            subtitle="Currently working"
            icon={CheckCircle}
            iconBgColor="bg-[#6F9F96]"
            iconColor="text-white"
          />
          <StatCard
            title="Inactive Baristas"
            value={inactiveBaristas}
            subtitle="Not currently working"
            icon={XCircle}
            iconBgColor="bg-[#E07A5F]"
            iconColor="text-white"
          />
        </div>

        <div className="flex flex-col xl:flex-row justify-between items-center gap-4 mb-6">
          <div className="relative w-full xl:w-96 shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search barista by name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent bg-white h-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Status Filter */}
            <div className="relative z-30">
              <button
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="flex items-center justify-between space-x-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 h-10 w-40"
              >
                <span>{selectedStatus}</span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isStatusDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 transition-transform duration-200 peer-focus:-rotate-180">
                  {['All Status', 'Active', 'Inactive'].map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        setSelectedStatus(status);
                        setIsStatusDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 h-10"
            >
              <Download size={16} />
              <span>Export</span>
            </button>
            <button
              onClick={() => openModal()}
              className="flex items-center space-x-2 px-4 py-2 border border-transparent rounded-lg bg-[#1F3A34] text-white font-medium hover:bg-[#2E5E58] transition-colors h-10"
            >
              <Plus size={16} />
              <span>New Barista</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 border-b border-gray-200">
                <tr>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Created At</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-gray-500">
                      Loading baristas...
                    </td>
                  </tr>
                ) : paginatedBaristas.length > 0 ? (
                  paginatedBaristas.map((barista) => (
                    <tr key={barista.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-[#D4AF7A] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {barista.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">{barista.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <StatusTag status={barista.status} />
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">{barista.createdAt}</td>
                      <td className="py-4 px-6 text-center">
                        <div className="relative inline-block text-left">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === barista.id ? null : barista.id);
                            }}
                            className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openActionMenuId === barista.id && (
                            <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 z-50 overflow-hidden">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openModal(barista);
                                  setOpenActionMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 font-medium transition-colors text-gray-700 hover:bg-gray-50 border-b border-gray-50"
                              >
                                <Edit3 size={14} className="text-gray-400" /> Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBarista(barista.id, barista.name);
                                  setOpenActionMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                              >
                                <Trash2 size={14} className="text-red-400" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-12 text-center text-gray-500">
                      No baristas found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between shrink-0 bg-white w-full">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              setCurrentPage={setCurrentPage}
              itemsPerPage={itemsPerPage}
              totalItems={filteredBaristas.length}
              itemName="barista"
            />
          </div>
        </div>
      </div>
      {/* Barista Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{editingBarista ? 'Edit Barista' : 'New Barista'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 cursor-pointer transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBarista} className="space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barista Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                  placeholder="e.g. Nur"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select 
                  value={formStatus ? 'active' : 'inactive'}
                  onChange={(e) => setFormStatus(e.target.value === 'active')}
                  className="peer w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <div className="pt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#1F3A34] text-white rounded-lg text-sm font-medium hover:bg-[#2E5E58] transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingBarista ? 'Save Changes' : 'Create Barista'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BaristaManagement;
