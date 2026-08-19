import React, { useState } from 'react';
import { ArrowLeft, Plus, MoreVertical, Edit3, Trash2, Award, Users, X, Coffee, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

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

const initialTiers = [
  { id: 1, name: 'Kawan', requiredCups: '0 - 9', promotion: 'Less RM 1 for all drinks', status: 'Active' },
  { id: 2, name: 'Dilamun', requiredCups: '10 - 19', promotion: 'Less RM 2 for all drinks', status: 'Active' },
  { id: 3, name: 'Ketagih', requiredCups: '20 - 29', promotion: 'Less RM 3 for all drinks', status: 'Active' },
  { id: 4, name: 'Legend', requiredCups: '30+', promotion: 'Less RM 3 for all drinks', status: 'Active' }
];

const getTierColor = (tier) => {
  switch (tier) {
    case 'Kawan': return 'bg-blue-100 text-blue-600';
    case 'Dilamun': return 'bg-[#E07A5F]/15 text-[#E07A5F]';
    case 'Ketagih': return 'bg-purple-100 text-purple-600';
    case 'Legend': return 'bg-[#D4AF7A]/20 text-[#A8824A]';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const tierDistributionData = [
  { name: 'Kawan', users: 4520, color: '#3B82F6' },
  { name: 'Dilamun', users: 2150, color: '#E07A5F' },
  { name: 'Ketagih', users: 850, color: '#9333EA' },
  { name: 'Legend', users: 230, color: '#D4AF7A' }
];

const TierManagement = () => {
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [tiers, setTiers] = useState(initialTiers);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addFormData, setAddFormData] = useState({ name: '', requiredCups: '', promotion: '', status: 'Active' });

  const handleSaveAdd = (e) => {
    e.preventDefault();
    setTiers([...tiers, { id: Date.now(), ...addFormData }]);
    setIsAddModalOpen(false);
    setAddFormData({ name: '', requiredCups: '', promotion: '', status: 'Active' });
  };

  const handleEdit = (id) => {
    const tierToEdit = tiers.find(t => t.id === id);
    if (tierToEdit) {
      setEditFormData({ ...tierToEdit });
      setIsEditModalOpen(true);
    }
    setOpenDropdownId(null);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    setTiers(tiers.map(t => t.id === editFormData.id ? editFormData : t));
    setIsEditModalOpen(false);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this tier?")) {
      setTiers(tiers.filter(t => t.id !== id));
    }
    setOpenDropdownId(null);
  };

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6 overflow-y-auto bg-gray-50/30">
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tier Management</h1>
            <p className="text-sm text-gray-500 mt-1">Configure customer loyalty tiers and cup requirements.</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F3A34] text-white text-sm font-bold rounded-lg border-transparent hover:bg-[#2E5E58] transition-colors shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Plus size={16} /> New Tier
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <StatCard title="Total Members" value="7,750" change="12.6% vs last month" icon={Users} iconBg="bg-[#1F3A34]" />
        <StatCard title="Active Tiers" value="4" change="" icon={Award} iconBg="bg-[#2E5E58]" />
        <StatCard title="Legend Members" value="230" change="8.2% vs last month" icon={Award} iconBg="bg-[#E07A5F]" />
        <StatCard title="Total Cups Logged" value="142,560" change="17.1% vs last month" icon={Coffee} iconBg="bg-[#D4AF7A]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col min-h-[300px]">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Users by Tier</h2>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }} />
                <Tooltip 
                  cursor={{fill: '#F3F4F6'}}
                  contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value) => [value, "Users"]}
                />
                <Bar dataKey="users" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {tierDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col justify-center items-center text-center">
          <div className="w-16 h-16 bg-[#1F3A34]/10 text-[#1F3A34] rounded-full flex items-center justify-center mb-4">
            <Users size={32} />
          </div>
          <h3 className="text-4xl font-bold text-gray-900">7,750</h3>
          <p className="text-sm font-medium text-gray-500 mt-1">Total Loyalty Members</p>
          <div className="mt-8 w-full pt-6 border-t border-gray-100 flex justify-between items-center px-4">
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">+12%</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">vs Last Month</p>
            </div>
            <div className="w-px h-10 bg-gray-200"></div>
            <div className="text-center">
              <p className="text-lg font-bold text-[#1F3A34]">230</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">New Legends</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Tier Name</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100">Required Cups</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-center">Promotion</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-gray-900 border-b border-gray-100 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tiers.map((tier) => (
                <tr key={tier.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${getTierColor(tier.name)}`}>
                        <Award size={16} />
                      </div>
                      <span className="font-semibold text-gray-900">{tier.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 font-medium">{tier.requiredCups}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md font-bold text-xs">{tier.promotion}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-md font-bold text-xs">{tier.status}</span>
                  </td>
                  <td className="px-6 py-4 text-center relative">
                    <button 
                      onClick={() => setOpenDropdownId(openDropdownId === tier.id ? null : tier.id)}
                      className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {openDropdownId === tier.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                        <div className="absolute right-8 top-1/2 -translate-y-1/2 mt-2 w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 flex flex-col overflow-hidden">
                          <button
                            onClick={() => handleEdit(tier.id)}
                            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-medium transition-colors border-b border-gray-50"
                          >
                            <Edit3 size={14} className="text-gray-400" /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(tier.id)}
                            className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium transition-colors"
                          >
                            <Trash2 size={14} className="text-red-400" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && editFormData && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Edit Tier Details</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tier Name</label>
                <input 
                  type="text" 
                  value={editFormData.name} 
                  onChange={e => setEditFormData({...editFormData, name: e.target.value})} 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Required Cups</label>
                <input 
                  type="text" 
                  value={editFormData.requiredCups} 
                  onChange={e => setEditFormData({...editFormData, requiredCups: e.target.value})} 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Promotion / Rewards</label>
                <input 
                  type="text" 
                  value={editFormData.promotion} 
                  onChange={e => setEditFormData({...editFormData, promotion: e.target.value})} 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select 
                  value={editFormData.status} 
                  onChange={e => setEditFormData({...editFormData, status: e.target.value})} 
                  className="peer w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg cursor-pointer shadow-sm">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Add New Tier</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveAdd} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tier Name</label>
                <input 
                  type="text" 
                  value={addFormData.name} 
                  onChange={e => setAddFormData({...addFormData, name: e.target.value})} 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Required Cups</label>
                <input 
                  type="text" 
                  value={addFormData.requiredCups} 
                  onChange={e => setAddFormData({...addFormData, requiredCups: e.target.value})} 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Promotion / Rewards</label>
                <input 
                  type="text" 
                  value={addFormData.promotion} 
                  onChange={e => setAddFormData({...addFormData, promotion: e.target.value})} 
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select 
                  value={addFormData.status} 
                  onChange={e => setAddFormData({...addFormData, status: e.target.value})} 
                  className="peer w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              
              <div className="pt-4 flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200 cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-[#1F3A34] hover:bg-[#2E5E58] rounded-lg cursor-pointer shadow-sm">Add Tier</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TierManagement;
