import React, { useState } from 'react';
import { ArrowLeft, Search, Filter, Plus, MoreVertical } from 'lucide-react';

const generateCampaigns = () => Array(45).fill({
  name: 'New Barista Craft',
  desc: 'New drinks are here!',
  type: 'Promotion',
  status: 'Active',
  reach: '45,230',
  engagement: '45,230',
  conversion: '45,230',
}).map((item, i) => ({
  ...item,
  id: i + 1,
  name: i % 3 === 0 ? 'Double Point Weekend' : i % 3 === 1 ? 'Summer Blast' : 'New Barista Craft',
  status: i % 4 === 0 ? 'Expired' : 'Active',
  type: i % 2 === 1 ? 'Loyalty' : 'Promotion'
}));

const allCampaigns = generateCampaigns();

const AllCampaigns = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  
  const filtered = allCampaigns.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col space-y-6 overflow-y-auto bg-gray-50/30">
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button onClick={onBack} className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" title="Back">
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">All Campaigns</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
            <Filter size={16} /> Filter
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 bg-[#1F3A34] text-white text-sm font-bold rounded-lg hover:bg-[#162A26] transition-colors shadow-sm cursor-pointer">
            <Plus size={16} /> Create Campaign
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-[500px]">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="relative w-64">
            <input 
              type="text" 
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1F3A34] focus:border-[#1F3A34]"
            />
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-500">Showing {filtered.length} campaigns</p>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-gray-50/80 backdrop-blur-sm shadow-sm z-10">
              <tr className="border-b border-gray-200 text-left">
                <th className="px-5 py-4 font-bold text-gray-900 w-1/3">Campaign</th>
                <th className="px-5 py-4 font-bold text-gray-900">Type</th>
                <th className="px-5 py-4 font-bold text-gray-900">Status</th>
                <th className="px-5 py-4 font-bold text-gray-900">Reach</th>
                <th className="px-5 py-4 font-bold text-gray-900">Engagement</th>
                <th className="px-5 py-4 font-bold text-gray-900">Conversion</th>
                <th className="px-5 py-4 font-bold text-gray-900 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1F3A34] shrink-0"></div>
                      <div>
                        <p className="font-bold text-gray-900">{campaign.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{campaign.desc}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-medium text-gray-900">{campaign.type}</td>
                  <td className="px-5 py-4">
                    <span className={`px-3 py-1 text-xs font-bold rounded-md ${campaign.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-600 font-medium">{campaign.reach}</td>
                  <td className="px-5 py-4 text-gray-600 font-medium">{campaign.engagement}</td>
                  <td className="px-5 py-4 text-gray-600 font-medium">{campaign.conversion}</td>
                  <td className="px-5 py-4 text-center relative">
                    <button 
                      onClick={() => setOpenDropdownId(openDropdownId === campaign.id ? null : campaign.id)}
                      className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center"
                    >
                      <MoreVertical size={14} />
                    </button>
                    {openDropdownId === campaign.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                        <div className="absolute right-8 top-1/2 -translate-y-1/2 w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 flex flex-col">
                          <button onClick={() => { alert('Edit campaign'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
                          <button onClick={() => { alert('Pause campaign'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Pause</button>
                          <button onClick={() => { alert('Delete campaign'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
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
    </div>
  );
};

export default AllCampaigns;
