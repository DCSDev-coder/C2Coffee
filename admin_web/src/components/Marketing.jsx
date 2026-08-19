import React, { useState } from 'react';
import { Megaphone, CheckCircle, Users, MessageSquare, MousePointerClick, RefreshCw, MoreVertical, Bell, ArrowUp, ArrowRight, ChevronDown, Download, Plus, User, X } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { exportToCSV } from '../utils/exportToCSV';
import Pagination from './Pagination';

const MaleIcon = ({ size = 24, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
    <path d="M14 7h-4c-1.1 0-2 .9-2 2v6h2v7h4v-7h2V9c0-1.1-.9-2-2-2zm-2-5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
  </svg>
);

const FemaleIcon = ({ size = 24, className = "" }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
    <path d="M12 2C10.9 2 10 2.9 10 4C10 5.1 10.9 6 12 6C13.1 6 14 5.1 14 4C14 2.9 13.1 2 12 2ZM15 22V16H18L13.8 7C13.4 6.2 12.8 6 12 6C11.2 6 10.6 6.2 10.2 7L6 16H9V22H15Z"/>
  </svg>
);

const KPICard = ({ title, value, change, icon: Icon, iconBg, iconColor = "text-white" }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor} shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      {change && (
        <div className="flex items-center gap-1 mt-1">
          <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal flex items-center gap-0.5">
            <ArrowUp size={10} strokeWidth={3} className="text-gray-500" /> {change}
          </p>
        </div>
      )}
    </div>
  </div>
);

const Marketing = ({ setCurrentPage }) => {
  const [campaignPage, setCampaignPage] = useState(1);
  const [pushPage, setPushPage] = useState(1);
  const [contentPage, setContentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignDesc, setNewCampaignDesc] = useState("");
  const [newCampaignImage, setNewCampaignImage] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const itemsPerPage = 6;

  const kpiData = [
    { title: 'Total Campaign', value: '28', change: '12.6% vs last month', icon: Megaphone, iconBg: 'bg-[#1F3A34]' },
    { title: 'Active Campaign', value: '8', change: '8.2% vs last month', icon: CheckCircle, iconBg: 'bg-[#2E5E58]' },
    { title: 'Total Reach', value: '152,340', change: '17.1% vs last month', icon: Users, iconBg: 'bg-[#6F9F96]' },
    { title: 'Engagement Rate', value: '6.48%', change: '2.3% vs last month', icon: MessageSquare, iconBg: 'bg-[#A8C4A2]' },
    { title: 'Click Through Rate', value: '3.21%', change: '9.3% vs last month', icon: MousePointerClick, iconBg: 'bg-[#E07A5F]' },
    { title: 'Conversion', value: '2,865', change: '6.5% vs last month', icon: RefreshCw, iconBg: 'bg-[#D4AF7A]' },
  ];

  const topCampaigns = Array(218).fill({
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
    status: i % 2 === 1 ? 'Expired' : 'Active',
    type: i % 2 === 1 ? 'Loyalty' : 'Promotion'
  }));

  const chartData = [
    { name: 'May 1', reach: 0, engagement: 0, conversion: 0 },
    { name: 'May 6', reach: 15000, engagement: 5000, conversion: 2000 },
    { name: 'May 16', reach: 30000, engagement: 12000, conversion: 4000 },
    { name: 'May 21', reach: 45000, engagement: 20000, conversion: 8000 },
    { name: 'May 26', reach: 55000, engagement: 28000, conversion: 12000 },
    { name: 'May 31', reach: 60000, engagement: 35000, conversion: 15000 },
  ];

  const pushNotifications = [
    { campaign: 'Double Point Weekend', desc: 'Earn 2x points on all drinks.', status: 'Active', date: 'Aug 19, 2026', time: '10:15 AM' },
    { campaign: 'Double Point Weekend', desc: 'Earn 2x points on all drinks.', status: 'Scheduled', date: 'Aug 19, 2026', time: '10:15 AM' },
    { campaign: 'Double Point Weekend', desc: 'Earn 2x points on all drinks.', status: 'Active', date: 'Aug 19, 2026', time: '10:15 AM' },
    { campaign: 'Double Point Weekend', desc: 'Earn 2x points on all drinks.', status: 'Active', date: 'Aug 19, 2026', time: '10:15 AM' },
    { campaign: 'Double Point Weekend', desc: 'Earn 2x points on all drinks.', status: 'Active', date: 'Aug 19, 2026', time: '10:15 AM' },
    { campaign: 'Double Point Weekend', desc: 'Earn 2x points on all drinks.', status: 'Active', date: 'Aug 19, 2026', time: '10:15 AM' },
  ];

  const contentPerformance = [
    { content: 'New Barista Drink', desc: 'Image - 1200 x 900', type: 'Image', engagement: '3,245' },
    { content: 'New Barista Drink', desc: 'Image - 1200 x 900', type: 'Image', engagement: '3,245' },
    { content: 'New Barista Drink', desc: 'Image - 1200 x 900', type: 'Image', engagement: '3,245' },
    { content: 'New Barista Drink', desc: 'Image - 1200 x 900', type: 'Image', engagement: '3,245' },
    { content: 'New Barista Drink', desc: 'Image - 1200 x 900', type: 'Image', engagement: '3,245' },
    { content: 'New Barista Drink', desc: 'Image - 1200 x 900', type: 'Image', engagement: '3,245' },
  ];

  const pieData = [
    { name: 'Legend', value: 18.7, color: '#1F3A34' },
    { name: 'Dilamun', value: 31.2, color: '#2E5E58' },
    { name: 'Ketagih', value: 28.5, color: '#E07A5F' },
    { name: 'Kawan', value: 15.2, color: '#D9C4A9' },
  ];

  const totalPages = Math.ceil(topCampaigns.length / itemsPerPage);
  const paginatedCampaigns = topCampaigns.slice((campaignPage - 1) * itemsPerPage, campaignPage * itemsPerPage);

  const pushItemsPerPage = 5;
  const totalPushPages = Math.ceil(pushNotifications.length / pushItemsPerPage);
  const paginatedPush = pushNotifications.slice((pushPage - 1) * pushItemsPerPage, pushPage * pushItemsPerPage);

  const contentItemsPerPage = 5;
  const totalContentPages = Math.ceil(contentPerformance.length / contentItemsPerPage);
  const paginatedContent = contentPerformance.slice((contentPage - 1) * contentItemsPerPage, contentPage * contentItemsPerPage);

  return (
    <div className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F9FAFB]">
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full h-full flex flex-col">
        
        {/* Header */}
        <div className="mb-6 shrink-0">
          <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
          <p className="text-sm text-gray-500 mt-1">Create campaigns, manage content and track performance.</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6 shrink-0">
          {kpiData.map((kpi, idx) => (
            <KPICard key={idx} {...kpi} />
          ))}
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-end mb-6 gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <DatePicker portalId="root-portal" popperPlacement="bottom-end"
                selected={selectedDate}
                onChange={(date) => setSelectedDate(date)}
                dateFormat="d MMMM yyyy"
                customInput={
                  <div className="relative">
                    <button className="peer pl-4 pr-10 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer w-full text-left">
                      {selectedDate ? selectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Select Date'}
                    </button>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <ChevronDown size={16} className="text-gray-500 transition-transform duration-200 peer-focus:-rotate-180" />
                    </div>
                  </div>
                }
              />
            </div>
            <button 
              onClick={() => {
                const rows = [
                  ["Campaign", "Type", "Status", "Reach", "Engagement", "Conversion"],
                  ...topCampaigns.map(c => [
                    `"${c.name}"`,
                    `"${c.type}"`,
                    `"${c.status}"`,
                    `"${c.reach}"`,
                    `"${c.engagement}"`,
                    `"${c.conversion}"`
                  ])
                ];
                exportToCSV(rows, "marketing_campaigns.csv");
              }}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap cursor-pointer"
            >
              <Download size={16} className="mr-1.5" /> Export
            </button>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap cursor-pointer"
            >
              + Create Campaign
            </button>
          </div>
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 shrink-0">
          
          {/* Top Campaign Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[400px]">
            <div className="p-5 border-b border-gray-100 shrink-0 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Top Campaign</h2>
              <button onClick={() => setCurrentPage && setCurrentPage('AllCampaigns')} className="text-xs font-bold text-gray-900 hover:underline inline-flex items-center gap-1 cursor-pointer">
                View All <ArrowRight size={14} className="ml-0.5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white">
                  <tr>
                    <th className="px-5 py-3 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Campaign</th>
                    <th className="px-5 py-3 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Type</th>
                    <th className="px-5 py-3 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Status</th>
                    <th className="px-5 py-3 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Reach</th>
                    <th className="px-5 py-3 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Engagement</th>
                    <th className="px-5 py-3 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Conversion</th>
                    <th className="px-5 py-3 font-semibold text-gray-900 text-center bg-white sticky top-0 z-10 border-b border-gray-100">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedCampaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1F3A34] shrink-0"></div>
                          <div>
                            <p className="font-semibold text-gray-900">{campaign.name}</p>
                            <p className="text-[10px] text-gray-500">{campaign.desc}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-gray-900 font-medium">{campaign.type}</td>
                      <td className="px-5 py-2.5">
                        <span className={`px-3 py-1 text-[10px] font-bold rounded-md ${campaign.status === 'Active' ? 'bg-[#D1FADF] text-[#039855]' : 'bg-[#FEE4E2] text-[#D92D20]'}`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-gray-600">{campaign.reach}</td>
                      <td className="px-5 py-2.5 text-gray-600">{campaign.engagement}</td>
                      <td className="px-5 py-2.5 text-gray-600">{campaign.conversion}</td>
                      <td className="px-5 py-2.5 text-center relative">
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
                              <button onClick={() => { setIsCreateModalOpen(true); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
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
            <div className="p-4 border-t border-gray-100 flex shrink-0">
              <Pagination 
                currentPage={campaignPage}
                totalPages={totalPages}
                setCurrentPage={setCampaignPage}
                itemsPerPage={itemsPerPage}
                totalItems={topCampaigns.length}
                itemName="campaign"
              />
            </div>
          </div>

          {/* Campaign Performance Over Time */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Campaign Performance Over Time</h2>
            </div>
            <div className="flex gap-6 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#86B69E]"></div>
                <span className="text-sm font-bold text-gray-700">Reach</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#E07A5F]"></div>
                <span className="text-sm font-bold text-gray-700">Engagement</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#D9C4A9]"></div>
                <span className="text-sm font-bold text-gray-700">Conversion</span>
              </div>
            </div>
            
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#86B69E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#86B69E" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E07A5F" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#E07A5F" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorConversion" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D9C4A9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#D9C4A9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                  <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={(value) => `${value / 1000}K`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="reach" stroke="#86B69E" strokeWidth={2} fillOpacity={1} fill="url(#colorReach)" />
                  <Area type="monotone" dataKey="engagement" stroke="#E07A5F" strokeWidth={2} fillOpacity={1} fill="url(#colorEngagement)" />
                  <Area type="monotone" dataKey="conversion" stroke="#D9C4A9" strokeWidth={2} fillOpacity={1} fill="url(#colorConversion)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 shrink-0">
              <div className="bg-[#1F3A34] text-white p-3 rounded-xl flex flex-col items-center justify-center shadow-sm">
                <p className="text-[10px] text-white/80">Total Reach</p>
                <p className="text-sm font-bold">152,340</p>
              </div>
              <div className="bg-[#2E5E58] text-white p-3 rounded-xl flex flex-col items-center justify-center shadow-sm">
                <p className="text-[10px] text-white/80">Total Engagement</p>
                <p className="text-sm font-bold">152,340</p>
              </div>
              <div className="bg-[#86B69E] text-white p-3 rounded-xl flex flex-col items-center justify-center shadow-sm">
                <p className="text-[10px] text-white/80">Total Conversions</p>
                <p className="text-sm font-bold">152,340</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0 pb-6">
          
          {/* Push Notifications */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[350px]">
            <div className="p-5 border-b border-gray-100 shrink-0 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Push Notifications</h2>
              <button onClick={() => setCurrentPage && setCurrentPage('AllPushNotifications')} className="text-xs font-bold text-gray-900 hover:underline inline-flex items-center gap-1 cursor-pointer">
                View All <ArrowRight size={14} className="ml-0.5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-2 pb-2">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Campaign</th>
                    <th className="px-4 py-2 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Status</th>
                    <th className="px-4 py-2 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Date & Time</th>
                    <th className="w-10 px-4 py-2 bg-white sticky top-0 z-10 border-b border-gray-100"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedPush.map((noti, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1F3A34] shrink-0"></div>
                          <div>
                            <p className="font-semibold text-gray-900">{noti.campaign}</p>
                            <p className="text-[10px] text-gray-500">{noti.desc}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-md ${noti.status === 'Active' ? 'bg-[#D1FADF] text-[#039855]' : 'bg-[#FEE4E2] text-[#D92D20]'}`}>
                          {noti.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-900 font-medium">{noti.date}</p>
                        <p className="text-[10px] text-gray-500">{noti.time}</p>
                      </td>
                      <td className="px-4 py-3 relative text-right">
                        <button 
                          className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center"
                          onClick={() => setOpenDropdownId(openDropdownId === `push-${idx}` ? null : `push-${idx}`)}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {openDropdownId === `push-${idx}` && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 flex flex-col">
                              <button onClick={() => { setIsCreateModalOpen(true); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
                              <button onClick={() => { alert('Pause notification'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Pause</button>
                              <button onClick={() => { alert('Delete notification'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 flex shrink-0">
              <Pagination 
                currentPage={pushPage}
                totalPages={totalPushPages}
                setCurrentPage={setPushPage}
                itemsPerPage={pushItemsPerPage}
                totalItems={pushNotifications.length}
                itemName="notifications"
              />
            </div>
          </div>

          {/* Content Performance */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[350px]">
            <div className="p-5 border-b border-gray-100 shrink-0 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Content Performance</h2>
              <button onClick={() => setCurrentPage && setCurrentPage('AllContentPerformance')} className="text-xs font-bold text-gray-900 hover:underline inline-flex items-center gap-1 cursor-pointer">
                View All <ArrowRight size={14} className="ml-0.5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto px-2 pb-2">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Content</th>
                    <th className="px-4 py-2 font-semibold text-gray-900 bg-white sticky top-0 z-10 border-b border-gray-100">Type</th>
                    <th className="px-4 py-2 font-semibold text-gray-900 text-right bg-white sticky top-0 z-10 border-b border-gray-100">Engagement</th>
                    <th className="w-10 px-4 py-2 bg-white sticky top-0 z-10 border-b border-gray-100"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedContent.map((content, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1F3A34] shrink-0"></div>
                          <div>
                            <p className="font-semibold text-gray-900">{content.content}</p>
                            <p className="text-[10px] text-gray-500">{content.desc}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-900 font-medium">{content.type}</td>
                      <td className="px-4 py-3 text-right text-gray-600 font-medium">{content.engagement}</td>
                      <td className="px-4 py-3 relative text-right">
                        <button 
                          className="bg-[#1E293B] hover:bg-[#0F172A] text-white p-1.5 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center justify-center"
                          onClick={() => setOpenDropdownId(openDropdownId === `content-${idx}` ? null : `content-${idx}`)}
                        >
                          <MoreVertical size={14} />
                        </button>
                        {openDropdownId === `content-${idx}` && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)}></div>
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 w-32 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 flex flex-col">
                              <button onClick={() => { setIsCreateModalOpen(true); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
                              <button onClick={() => { alert('Pause content'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Pause</button>
                              <button onClick={() => { alert('Delete content'); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Delete</button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-100 flex shrink-0">
              <Pagination 
                currentPage={contentPage}
                totalPages={totalContentPages}
                setCurrentPage={setContentPage}
                itemsPerPage={contentItemsPerPage}
                totalItems={contentPerformance.length}
                itemName="content items"
              />
            </div>
          </div>

          {/* Audience Overview */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col h-[350px]">
            <div className="p-5 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Audience Overview</h2>
            </div>
            <div className="flex-1 p-5 overflow-y-auto">
              <div className="bg-[#1F3A34] text-white rounded-xl p-4 flex flex-col items-center justify-center mb-5 shadow-sm">
                <p className="text-xs text-white/80 font-medium mb-1">Total Audience</p>
                <p className="text-3xl font-bold">45,280</p>
                <p className="text-[10px] text-white/70 mt-1 flex items-center gap-0.5"><ArrowUp size={10} strokeWidth={3} /> 12.8% vs 1 Apr - 30 Apr</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Audience by Gender</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center text-gray-900"><MaleIcon size={24} /></div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">80.0%</p>
                        <p className="text-[10px] text-gray-500">(26,420)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center text-gray-900"><FemaleIcon size={24} /></div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">20.0%</p>
                        <p className="text-[10px] text-gray-500">(18,640)</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-3">
                  <h3 className="text-sm font-bold text-gray-900 mb-2 text-center">Audience By Tier</h3>
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-20 h-20 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={40}
                            paddingAngle={0}
                            dataKey="value"
                            stroke="none"
                          >
                            <Tooltip 
                              formatter={(value, name) => [`${value}%`, name]}
                              contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                              itemStyle={{ color: '#fff' }}
                            />
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1 w-full">
                      {pieData.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[9px] w-full px-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                            <span className="text-gray-900 font-medium">{item.name}</span>
                          </div>
                          <span className="text-gray-500">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create Campaign Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-gray-900">Create New Campaign</h2>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                alert(`Campaign "${newCampaignName}" created!`);
                setIsCreateModalOpen(false);
                setNewCampaignName("");
                setNewCampaignDesc("");
                setNewCampaignImage(null);
              }} className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Campaign Name</label>
                  <input 
                    type="text" 
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]" 
                    placeholder="e.g. Double Point Weekend"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea 
                    value={newCampaignDesc}
                    onChange={(e) => setNewCampaignDesc(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34] min-h-[80px]" 
                    placeholder="Enter campaign description..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                  <select className="peer w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1F3A34]">
                    <option>Promotion</option>
                    <option>Loyalty</option>
                    <option>Event</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Campaign Image</label>
                  <div className="w-full border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-[#1F3A34] transition-colors cursor-pointer relative">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => setNewCampaignImage(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    />
                    <svg className="w-6 h-6 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path>
                    </svg>
                    <p className="text-sm">{newCampaignImage ? newCampaignImage.name : "Click to upload or drag and drop"}</p>
                    <p className="text-xs text-gray-400 mt-1">SVG, PNG, JPG or GIF (max. 5MB)</p>
                  </div>
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full bg-[#1F3A34] text-white rounded-lg px-4 py-2.5 text-sm font-bold hover:bg-[#162A26] transition-colors">
                    Create Campaign
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Marketing;
