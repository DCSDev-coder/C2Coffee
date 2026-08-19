import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, Download, Plus, MoreVertical, Users, Menu, UserX, UserCog, Calendar, X, Edit3, Trash2 } from 'lucide-react';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { exportToCSV } from '../utils/exportToCSV';
import Pagination from './Pagination';

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

// Generate 218 mock admins
const generateAdmins = () => {
  const roles = ['Super Admin', 'Marketing Admin', 'Support Admin'];
  const statuses = ['Active', 'Inactive'];
  const names = ['miraelys', 'balqis', 'nur', 'alexander', 'sarahsmith'];

  return Array.from({ length: 218 }, (_, i) => {
    const role = roles[i % roles.length];
    const status = i % 5 === 0 ? 'Inactive' : 'Active';
    const name = names[i % names.length];

    // Spread dates over the last few days
    const date = new Date(2026, 4, 31 - (i % 5));
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = '10:21 AM';

    return {
      id: i + 1,
      username: name,
      email: `${name}@gmail.com`,
      role: role,
      status: status,
      lastLogin: `${dateStr} - ${timeStr}`,
      loginDate: date, // For filtering
    };
  });
};

const mockAdmins = generateAdmins();

const RoleTag = ({ role }) => {
  let bgColor = '';
  let textColor = '';
  switch (role) {
    case 'Super Admin':
      bgColor = 'bg-orange-100';
      textColor = 'text-orange-600';
      break;
    case 'Marketing Admin':
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-600';
      break;
    case 'Support Admin':
      bgColor = 'bg-green-100';
      textColor = 'text-green-700';
      break;
    default:
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-700';
  }
  return (
    <span className={`px-3 py-1 rounded font-bold text-[13px] inline-flex items-center justify-center ${bgColor} ${textColor}`}>
      {role}
    </span>
  );
};

const StatusTag = ({ status }) => {
  const isActive = status === 'Active';
  return (
    <span className={`px-3 py-1 rounded font-bold text-[13px] inline-flex items-center justify-center ${isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      {status}
    </span>
  );
};

const AdminManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('All Admin');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Action menu and modals state
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);

  const itemsPerPage = 10;

  // Derived filtered data
  const filteredAdmins = useMemo(() => {
    return mockAdmins.filter(admin => {
      const matchesSearch = admin.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = selectedRole === 'All Admin' || admin.role === selectedRole;
      const matchesStatus = selectedStatus === 'All Status' || admin.status === selectedStatus;

      let matchesDate = true;
      if (selectedDate) {
        matchesDate = admin.loginDate.toDateString() === selectedDate.toDateString();
      }

      return matchesSearch && matchesRole && matchesStatus && matchesDate;
    });
  }, [searchTerm, selectedRole, selectedStatus, selectedDate]);

  const totalPages = Math.ceil(filteredAdmins.length / itemsPerPage) || 1;
  const paginatedAdmins = filteredAdmins.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Stats
  const totalAdmins = mockAdmins.length;
  const activeAdmins = mockAdmins.filter(a => a.status === 'Active').length;
  const inactiveAdmins = mockAdmins.filter(a => a.status === 'Inactive').length;
  const rolesCount = new Set(mockAdmins.map(a => a.role)).size;

  const handleExport = () => {
    const rows = [
      ["Name", "Role", "Email", "Status", "Added Date"],
      ...admins.map(a => [
        `"${a.name}"`, 
        `"${a.role}"`, 
        `"${a.email}"`, 
        `"${a.status}"`, 
        `"${a.addedDate}"`
      ])
    ];
    exportToCSV(rows, "admin_management.csv");
  };
  const handleNewAdmin = () => alert("Opening new admin modal...");

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full h-full flex flex-col">
        <div className="mb-6 shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage admin accounts and their access.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
          <StatCard
            title="Total Admins"
            value={totalAdmins}
            subtitle="Registered accounts"
            icon={Users}
            iconBgColor="bg-[#1F3A34]"
            iconColor="text-white"
          />
          <StatCard
            title="Active Admins"
            value={activeAdmins}
            subtitle="Enabled accounts"
            icon={Menu}
            iconBgColor="bg-[#6F9F96]"
            iconColor="text-white"
          />
          <StatCard
            title="Inactive Admins"
            value={inactiveAdmins}
            subtitle="Disable accounts"
            icon={UserX}
            iconBgColor="bg-[#E07A5F]"
            iconColor="text-white"
          />
          <StatCard
            title="Roles"
            value={rolesCount}
            subtitle="System roles"
            icon={UserCog}
            iconBgColor="bg-[#D4AF7A]"
            iconColor="text-white"
          />
        </div>

        <div className="flex flex-col xl:flex-row justify-between items-center gap-4 mb-6">
          <div className="relative w-full xl:w-96 shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search admin by username or email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#2E5E58] focus:border-transparent bg-white h-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* Date Filter */}
            <div className="relative z-50">
              <DatePicker portalId="root-portal" popperPlacement="bottom-end"
                selected={selectedDate}
                onChange={(date) => {
                  setSelectedDate(date);
                  setCurrentPage(1);
                }}
                dateFormat="d MMMM yyyy"
                customInput={
                  <div className="relative">
                    <button className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer w-full text-left h-10 flex items-center">
                      {selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Select Date'}
                    </button>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <ChevronDown size={16} className="text-gray-400 transition-transform duration-200 peer-focus:-rotate-180" />
                    </div>
                    {selectedDate && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedDate(null); setCurrentPage(1); }}
                        className="absolute inset-y-0 right-8 flex items-center p-1 hover:bg-gray-100 rounded-full my-auto h-6 w-6 justify-center"
                      >
                        <X size={14} className="text-gray-500" />
                      </button>
                    )}
                  </div>
                }
              />
            </div>

            {/* Role Filter */}
            <div className="relative z-40">
              <button
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                className="flex items-center justify-between space-x-2 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 h-10 w-40"
              >
                <span className="truncate">{selectedRole}</span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${isRoleDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isRoleDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 transition-transform duration-200 peer-focus:-rotate-180">
                  {['All Admin', 'Super Admin', 'Marketing Admin', 'Support Admin'].map(role => (
                    <button
                      key={role}
                      onClick={() => {
                        setSelectedRole(role);
                        setIsRoleDropdownOpen(false);
                        setCurrentPage(1);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {role}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
              onClick={() => {
                setEditingAdmin(null);
                setIsModalOpen(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 border border-transparent rounded-lg bg-[#1F3A34] text-white font-medium hover:bg-[#2E5E58] transition-colors h-10"
            >
              <Plus size={16} />
              <span>New Admin</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="sticky top-0 bg-gray-50/95 backdrop-blur-sm z-10 border-b border-gray-200">
                <tr>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Username</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Email Address</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Role</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider">Last Login</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedAdmins.length > 0 ? (
                  paginatedAdmins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-[#1F3A34] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {admin.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-gray-900">{admin.username}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">{admin.email}</td>
                      <td className="py-4 px-6 text-center">
                        <RoleTag role={admin.role} />
                      </td>
                      <td className="py-4 px-6 text-center">
                        <StatusTag status={admin.status} />
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-600">{admin.lastLogin}</td>
                      <td className="py-4 px-6 text-center">
                        <div className="relative inline-block text-left">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === admin.id ? null : admin.id);
                            }}
                            className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openActionMenuId === admin.id && (
                            <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-gray-100 z-50 overflow-hidden">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAdmin(admin);
                                  setIsModalOpen(true);
                                  setOpenActionMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors border-b border-gray-50"
                              >
                                <Edit3 size={14} className="text-gray-400" /> Edit Admin
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  alert(`Delete admin ${admin.username}`);
                                  setOpenActionMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                              >
                                <Trash2 size={14} className="text-red-400" /> Delete Admin
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-500">
                      No admins found matching your filters.
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
              totalItems={filteredAdmins.length}
              itemName="admin"
            />
          </div>
        </div>
      </div>
      {/* Admin Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{editingAdmin ? 'Edit Admin' : 'New Admin'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900 cursor-pointer transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  defaultValue={editingAdmin?.username || ''}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  type="email"
                  defaultValue={editingAdmin?.email || ''}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select defaultValue={editingAdmin?.role || 'Super Admin'} className="peer w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] bg-white">
                    <option>Super Admin</option>
                    <option>Marketing Admin</option>
                    <option>Support Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select defaultValue={editingAdmin?.status || 'Active'} className="peer w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E5E58] bg-white">
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>
              <div className="pt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#1F3A34] text-white rounded-lg text-sm font-medium hover:bg-[#2E5E58] transition-colors"
                >
                  {editingAdmin ? 'Save Changes' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagement;
