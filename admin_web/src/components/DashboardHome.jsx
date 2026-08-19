import React, { useState, forwardRef } from 'react';
import { Wallet, ShoppingBag, UserPlus, Megaphone, Users, Coins, Ticket, Coffee, BadgeDollarSign, Calendar, Gift, ShoppingCart, User, AlertCircle, Clock, TrendingUp, CheckCircle, ArrowUp, ArrowRight, ChevronDown } from 'lucide-react';
import Pagination from './Pagination';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const revenueData = [
  { time: '12AM', value: 0 },
  { time: '4AM', value: 1200 },
  { time: '8AM', value: 800 },
  { time: '12PM', value: 1800 },
  { time: '4PM', value: 2400 },
  { time: '8PM', value: 3800 },
];

const ordersData = [
  { time: '12AM', value: 2 },
  { time: '4AM', value: 22 },
  { time: '8AM', value: 12 },
  { time: '12PM', value: 18 },
  { time: '4PM', value: 15 },
  { time: '8PM', value: 35 },
];

const TopCard = ({ title, value, change, iconColor, icon: Icon, onClickChange }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0">
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-white ${iconColor} shadow-sm`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      {change && (
        onClickChange ? (
          <div className="flex items-center gap-1 mt-1">
            <button onClick={onClickChange} className="text-[11px] text-green-600 font-medium leading-tight hover:underline cursor-pointer whitespace-normal">
              {change}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-1">
            <p className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal">
              {change.includes('%') && !change.includes('of total') && !change.includes('↑') && !change.includes('↓') && change.includes('vs') ? `↑ ${change}` : change}
            </p>
          </div>
        )
      )}
    </div>
  </div>
);

const ChartCard = ({ title, value, change, data, dataKey, color, id }) => {
  const [filter, setFilter] = React.useState('Today');
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-72">
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <div className="relative">
          <select
            className="peer absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
          >
            <option>Today</option>
            <option>Yesterday</option>
            <option>This Week</option>
            <option>This Month</option>
          </select>
          <div className="flex items-center space-x-1 border border-gray-200 rounded-md px-2 py-1 pointer-events-none bg-white hover:bg-gray-50 transition-colors">
            <span className="text-[10px] font-medium text-gray-700">{filter}</span>
            <span className={`text-[8px] text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>v</span>
          </div>
        </div>
      </div>
      <div className="mb-4 flex items-end space-x-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <div className="flex items-center gap-1 pb-1">
          <p className="text-xs text-gray-500 font-medium whitespace-normal">
            {change.includes('%') && !change.includes('of total') && !change.includes('↑') && !change.includes('↓') && change.includes('vs') ? `↑ ${change}` : change}
          </p>
        </div>
      </div>
      <div className="flex-1 w-full h-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} dy={10} />
            <YAxis axisLine={{ stroke: '#E5E7EB' }} tickLine={false} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F3A34', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
              itemStyle={{ color: '#fff' }}
            />
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fillOpacity={1} fill={`url(#${id})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const ActionItem = ({ title, desc, iconColor, icon: Icon, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-0 cursor-pointer text-left">
    <div className="flex items-center space-x-3">
      <div className={`w-10 h-10 rounded-full ${iconColor} flex items-center justify-center text-white`}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <div className="text-left">
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-[10px] text-gray-500">{desc}</p>
      </div>
    </div>
    <span className="text-gray-400">›</span>
  </button>
);

const DashboardHome = ({ setCurrentPage }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentPage, setCurrentPageNumber] = useState(1);

  const CustomDateInput = forwardRef(({ value, onClick }, ref) => (
    <div
      onClick={onClick}
      ref={ref}
      className="flex items-center space-x-2 border border-gray-200 px-3 py-1.5 rounded-lg bg-white shadow-sm text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <span>{value || 'Select Date'}</span>
      <ChevronDown size={14} className="text-gray-500 transition-transform duration-200 peer-focus:-rotate-180" />
    </div>
  ));

  const orders = [
    { id: 'ORD-0510-001', user: 'miraelys', city: 'Beranang', total: 'RM 15.90', status: 'Completed', pay: 'Paid', time: '10:21 AM' },
    { id: 'ORD-0510-002', user: 'miraelys', city: 'Semenyih', total: 'RM 15.90', status: 'Preparing', pay: 'Paid', time: '10:18 AM' },
    { id: 'ORD-0510-003', user: 'miraelys', city: 'Kajang', total: 'RM 15.90', status: 'Ready', pay: 'Paid', time: '10:15 AM' },
    { id: 'ORD-0510-004', user: 'miraelys', city: 'Ampang', total: 'RM 15.90', status: 'Canceled', pay: 'Refunded', time: '10:10 AM' },
    { id: 'ORD-0510-005', user: 'miraelys', city: 'Bangi', total: 'RM 15.90', status: 'Refund Requested', pay: 'Paid', time: '10:05 AM' },
    { id: 'ORD-0510-006', user: 'alex_chong', city: 'KLCC', total: 'RM 32.50', status: 'Completed', pay: 'Paid', time: '9:50 AM' },
    { id: 'ORD-0510-007', user: 'sarah_lee', city: 'Mid Valley', total: 'RM 45.00', status: 'Completed', pay: 'Paid', time: '9:45 AM' },
    { id: 'ORD-0510-008', user: 'khai_rul', city: 'Sunway', total: 'RM 18.20', status: 'Completed', pay: 'Paid', time: '9:30 AM' },
    { id: 'ORD-0510-009', user: 'jane_doe', city: 'Semenyih', total: 'RM 22.00', status: 'Completed', pay: 'Paid', time: '9:15 AM' },
    { id: 'ORD-0510-010', user: 'ahmad_z', city: 'Bangi', total: 'RM 12.50', status: 'Preparing', pay: 'Paid', time: '9:00 AM' },
  ];

  const getStatusColor = (s) => {
    if (s === 'Completed') return 'bg-green-100 text-green-700';
    if (s === 'Preparing') return 'bg-[#E07A5F]/10 text-[#E07A5F]';
    if (s === 'Ready') return 'bg-blue-100 text-blue-700';
    if (s === 'Canceled') return 'bg-red-100 text-red-700';
    return 'bg-purple-100 text-purple-700'; // Refund requested
  };

  const getPayColor = (p) => {
    if (p === 'Paid') return 'bg-green-100 text-green-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="px-8 pb-8 mt-0" style={{ fontFamily: '"DM Sans", sans-serif' }}>

      <div className="flex justify-end mb-6">
        <DatePicker portalId="root-portal" popperPlacement="bottom-end"
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          customInput={<CustomDateInput />}
          dateFormat="MMM d, yyyy"
          popperPlacement="bottom-end"
        />
      </div>

      {/* 1. Stat Cards Row */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <TopCard title="Revenue Today" value="RM 2,560" change="12.6% vs yesterday" iconColor="bg-[#1F3A34]" icon={Wallet} />
        <TopCard title="Orders Today" value="218" change="8.2% vs yesterday" iconColor="bg-[#2E5E58]" icon={ShoppingBag} />
        <TopCard title="New Customers" value="19" change="17.1% vs yesterday" iconColor="bg-[#6F9F96]" icon={UserPlus} />
        <TopCard title="Active Promotions" value="4" change="View all" iconColor="bg-[#A8C4A2]" icon={Megaphone} onClickChange={() => setCurrentPage && setCurrentPage('Marketing')} />
        <TopCard title="Loyalty Members" value="1,245" change="9.3% vs yesterday" iconColor="bg-[#E07A5F]" icon={Users} />
        <TopCard title="Tokens Issued" value="128,560" change="6.6% vs yesterday" iconColor="bg-[#D4AF7A]" icon={Coins} />
      </div>

      {/* 2. Middle Row */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-5">
          <ChartCard
            title="Revenue Overview"
            value="RM 2,560"
            change="12.6% vs yesterday"
            data={revenueData}
            dataKey="value"
            color="#2E5E58"
            id="revenueGrad"
          />
        </div>
        <div className="col-span-4">
          <ChartCard
            title="Orders Overview"
            value="218"
            change="8.2% vs yesterday"
            data={ordersData}
            dataKey="value"
            color="#E7A054"
            id="ordersGrad"
          />
        </div>
        <div className="col-span-3 bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-72">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="flex-1 overflow-y-auto pr-1">
            <ActionItem title="Create Voucher" desc="Create a new voucher template" iconColor="bg-[#1F3A34]" icon={Ticket} onClick={() => setCurrentPage && setCurrentPage('Voucher')} />
            <ActionItem title="Send Campaign" desc="Send notification campaign" iconColor="bg-[#2E5E58]" icon={Megaphone} onClick={() => setCurrentPage && setCurrentPage('Marketing')} />
            <ActionItem title="Add Menu Item" desc="Add new drink or food" iconColor="bg-[#E07A5F]" icon={Coffee} onClick={() => setCurrentPage && setCurrentPage('Menu')} />
            <ActionItem title="View Refunds" desc="Review refund requests" iconColor="bg-[#D4AF7A]" icon={BadgeDollarSign} onClick={() => setCurrentPage && setCurrentPage('Refunds')} />
          </div>
        </div>
      </div>

      {/* 3. Bottom Row */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-8 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
            <button
              onClick={() => setCurrentPage && setCurrentPage('Orders')}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              View All <ArrowRight size={14} className="ml-0.5" />
            </button>
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 font-bold text-gray-900">Order ID</th>
                <th className="pb-3 font-bold text-gray-900">Username</th>
                <th className="pb-3 font-bold text-gray-900">City</th>
                <th className="pb-3 font-bold text-gray-900">Total</th>
                <th className="pb-3 font-bold text-gray-900">Status</th>
                <th className="pb-3 font-bold text-gray-900">Payment</th>
                <th className="pb-3 font-bold text-gray-900">Time</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 text-green-700 font-medium">{o.id}</td>
                  <td className="py-3 font-medium text-gray-800">{o.user}</td>
                  <td className="py-3 text-gray-600">{o.city}</td>
                  <td className="py-3 font-semibold text-gray-800">{o.total}</td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${getStatusColor(o.status)}`}>{o.status}</span>
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${getPayColor(o.pay)}`}>{o.pay}</span>
                  </td>
                  <td className="py-3 font-medium text-gray-600">{o.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex w-full">
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(218 / 5)}
              setCurrentPage={setCurrentPageNumber}
              itemsPerPage={5}
              totalItems={218}
              itemName="orders"
            />
          </div>
        </div>
        <div className="col-span-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
              <button
                onClick={() => setCurrentPage && setCurrentPage('Recent Activities')}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                View All <ArrowRight size={14} className="ml-0.5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-green-50 text-green-700 flex-shrink-0 flex items-center justify-center">
                  <Gift size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">miraelys issued a voucher (Free Latte) <br /><span className="text-gray-500 font-normal">to miraelys</span></p>
                </div>
                <div className="ml-auto text-[9px] text-gray-400 font-medium pt-1">10:21 AM</div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-[#E07A5F]/10 text-[#E07A5F] flex-shrink-0 flex items-center justify-center">
                  <UserPlus size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">Refund approved for order ORD-0510-002 <br /><span className="text-gray-500 font-normal">by miraelys</span></p>
                </div>
                <div className="ml-auto text-[9px] text-gray-400 font-medium pt-1">10:18 AM</div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-green-50 text-green-700 flex-shrink-0 flex items-center justify-center">
                  <Megaphone size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">New campaign "Happy Hour 3PM - 5PM" <br /><span className="text-gray-500 font-normal">published</span></p>
                </div>
                <div className="ml-auto text-[9px] text-gray-400 font-medium pt-1">9:45 AM</div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-yellow-50 text-yellow-600 flex-shrink-0 flex items-center justify-center">
                  <User size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">New customer registered: Daniel Ho <br /><span className="text-gray-500 font-normal">via Mobile App</span></p>
                </div>
                <div className="ml-auto text-[9px] text-gray-400 font-medium pt-1">9:30 AM</div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-green-50 text-green-700 flex-shrink-0 flex items-center justify-center">
                  <Coffee size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800 leading-tight">Caramel Macchiato is now back in stock <br /><span className="text-gray-500 font-normal">at Semenyih</span></p>
                </div>
                <div className="ml-auto text-[9px] text-gray-400 font-medium pt-1">9:12 AM</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Very Bottom Row */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gray-900">Top Selling Drinks (Today)</h2>
        </div>
        <div className="flex justify-between px-2">
          {[
            { id: 1, name: 'Shakerato Bianco', cups: '56 cups', color: 'bg-[#D4AF7A]', img: '/SHAKERATO BIANCO.png' },
            { id: 2, name: 'Blue Cloud Coconut', cups: '48 cups', color: 'bg-[#D4AF7A]', img: '/BLUE CLOUD COCONUT COFFEE.png' },
            { id: 3, name: 'Bloody Peach', cups: '42 cups', color: 'bg-[#D4AF7A]', img: '/BLOODY PEACH.png' },
            { id: 4, name: 'Pinky Promise Matcha', cups: '31 cups', color: 'bg-[#D4AF7A]', img: '/PINKY PROMISE MATCHA.png' },
            { id: 5, name: 'Espresso Bomb', cups: '28 cups', color: 'bg-[#D4AF7A]', img: '/ESPRESSO BOMB.png' },
          ].map((item) => (
            <div key={item.id} className="flex flex-col items-center relative">
              <span className={`absolute -top-2 left-0 ${item.color} text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full z-10`}>{item.id}</span>
              <div className="w-16 h-16 rounded-full flex items-center justify-center overflow-hidden mb-3 shadow-md">
                <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-gray-900 leading-tight mb-1">{item.name}</p>
                <p className="text-lg font-bold text-gray-800 leading-none">{item.cups.split(' ')[0]} <span className="text-[10px] text-gray-500 font-normal">cups</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default DashboardHome;
