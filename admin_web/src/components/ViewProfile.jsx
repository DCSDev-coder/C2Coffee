import React from 'react';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import { calculateTierProgress } from './Customers';

const ViewProfile = ({ customer, onBack }) => {
  const progress = calculateTierProgress(customer.orders);
  return (
    <div className="px-8 pb-8 pt-2 h-full flex flex-col">
      <div className="mb-6 shrink-0">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 -ml-1 text-gray-700 hover:text-black rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">Customer Profile</h1>
        </div>
        <p className={`text-gray-500 text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
          Details for {customer.username}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
        <div className="col-span-1 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col items-center shadow-sm h-fit">
          <div className="w-24 h-24 bg-[#2E5E58] rounded-full text-white flex items-center justify-center text-3xl font-bold mb-4 shadow-md">
            {customer.username.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{customer.username}</h2>
          <p className="text-sm text-gray-500 mb-6">{customer.email}</p>
          <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-500">Current Tier</span>
              <span className="text-sm font-bold text-[#E07A5F]">{progress.tier}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-[#E07A5F] h-2 rounded-full" style={{ width: `${progress.percentage}%` }}></div>
            </div>
            <p className="text-xs text-gray-500 text-center">
              {progress.tier === 'Legend' ? 'Maximum tier reached' : `${progress.remaining} cups to ${progress.nextTier}`}
            </p>
          </div>
        </div>
        <div className="col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Personal Information</h3>
            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1 flex items-center"><User size={14} className="mr-1" /> Username</p>
                <p className="text-sm font-semibold text-gray-900">{customer.username}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1 flex items-center"><Mail size={14} className="mr-1" /> Email Address</p>
                <p className="text-sm font-semibold text-gray-900">{customer.email}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1 flex items-center"><Phone size={14} className="mr-1" /> Phone Number</p>
                <p className="text-sm font-semibold text-gray-900">{customer.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1 flex items-center"><Calendar size={14} className="mr-1" /> Joined Date</p>
                <p className="text-sm font-semibold text-gray-900">Jan 12, 2025</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Addresses</h3>
            <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <MapPin className="text-[#2E5E58] mt-0.5 flex-shrink-0" size={18} />
              <div>
                <p className="text-sm font-bold text-gray-900">Home</p>
                <p className="text-sm text-gray-600 mt-1">123 Jalan Ampang, Kuala Lumpur, 50450, Malaysia</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewProfile;
