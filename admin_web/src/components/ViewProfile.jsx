import React, { useEffect, useState } from 'react';
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar } from 'lucide-react';
import {
  loadAdminCustomers,
  loadAdminTierConfigs,
} from '../lib/adminApi';
import { resolveTierProgress } from './Customers';
import UserAvatar, { resolveUserAvatarUrl } from './UserAvatar';

const ViewProfile = ({ customer, progress, avatar, onBack }) => {
  const [enrichedCustomer, setEnrichedCustomer] = useState(null);
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    setEnrichedCustomer(null);
    if (progress && customer?.joinedAt) return undefined;

    let active = true;
    const loadDetails = async () => {
      try {
        const [customerRes, tierRes] = await Promise.all([
          loadAdminCustomers(),
          loadAdminTierConfigs().catch(() => ({ tiers: [] })),
        ]);
        if (!active) return;

        const nextTiers = Array.isArray(tierRes?.tiers) ? tierRes.tiers : [];
        setTiers(nextTiers);

        const customersList = Array.isArray(customerRes?.customers)
          ? customerRes.customers
          : [];
        const targetEmail = String(customer?.email || '').trim().toLowerCase();
        const targetMemberId = String(customer?.memberId || customer?.id || '').trim().toLowerCase();
        const targetUsername = String(customer?.username || '').trim().toLowerCase();

        const match =
          customersList.find((item) => targetEmail && String(item.email || '').trim().toLowerCase() === targetEmail) ||
          customersList.find((item) => targetMemberId && String(item.memberId || item.id || '').trim().toLowerCase() === targetMemberId) ||
          customersList.find((item) => targetUsername && String(item.username || '').trim().toLowerCase() === targetUsername) ||
          null;

        if (match) {
          setEnrichedCustomer(match);
        }
      } catch (err) {
        console.error('Failed to load full customer profile', err);
      }
    };

    void loadDetails();
    return () => {
      active = false;
    };
  }, [customer, progress]);

  const effectiveCustomer = enrichedCustomer
    ? { ...customer, ...enrichedCustomer }
    : (customer || {});

  const computedProgress =
    tiers.length > 0 || effectiveCustomer?.tierProgress
      ? resolveTierProgress(effectiveCustomer, tiers)
      : null;

  const effectiveProgress =
    (enrichedCustomer ? computedProgress : null) ||
    progress ||
    computedProgress || {
      tier: effectiveCustomer?.tier || 'Not yet tiered',
      nextTier: 'Max Tier',
      percentage: 0,
      remaining: 0,
    };

  const displayName = effectiveCustomer?.username || 'Customer';
  const displayEmail = effectiveCustomer?.email || 'Not provided';
  const displayPhone = effectiveCustomer?.phone || 'Not provided';
  const displayJoinedAt = effectiveCustomer?.joinedAt || 'Unknown';
  const avatarElement = resolveUserAvatarUrl(effectiveCustomer)
    ? <UserAvatar user={effectiveCustomer} size="xl" />
    : (avatar || <UserAvatar user={effectiveCustomer} size="xl" />);

  return (
    <div className="w-full min-w-0 max-w-full px-3 sm:px-6 md:px-8 pb-8 pt-2 h-full flex flex-col">
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Customer Profile</h1>
        </div>
        <p className={`text-gray-500 text-xs sm:text-sm mt-0.5 ${onBack ? "ml-8" : ""}`}>
          Details for {displayName}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 w-full min-w-0">
        <div className="w-full col-span-1 md:col-span-1 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 flex flex-col items-center shadow-sm h-fit">
          <div className="mb-3">{avatarElement}</div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">{displayName}</h2>
          <p className="text-xs sm:text-sm text-gray-500 mb-6 break-all">{displayEmail}</p>
          <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-500">Current Tier</span>
              <span className="text-xs sm:text-sm font-bold text-[#E07A5F]">{effectiveProgress.tier || 'Not yet tiered'}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div className="bg-[#E07A5F] h-2 rounded-full" style={{ width: `${Number(effectiveProgress.percentage) || 0}%` }}></div>
            </div>
            <p className="text-[11px] sm:text-xs text-gray-500 text-center">
              {effectiveProgress.nextTier === 'Max Tier'
                ? 'Maximum tier reached'
                : effectiveProgress.nextTier
                  ? `${effectiveProgress.remaining ?? 0} cups to ${effectiveProgress.nextTier}`
                  : 'Tier progress unavailable'}
            </p>
          </div>
        </div>
        <div className="w-full col-span-1 md:col-span-2 space-y-6 min-w-0">
          <div className="w-full bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Personal Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 sm:gap-y-6 gap-x-4">
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1 flex items-center"><User size={14} className="mr-1" /> Username</p>
                <p className="text-sm font-semibold text-gray-900">{displayName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1 flex items-center"><Mail size={14} className="mr-1" /> Email Address</p>
                <p className="text-sm font-semibold text-gray-900 break-all">{displayEmail}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1 flex items-center"><Phone size={14} className="mr-1" /> Phone Number</p>
                <p className="text-sm font-semibold text-gray-900">{displayPhone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1 flex items-center"><Calendar size={14} className="mr-1" /> Joined Date</p>
                <p className="text-sm font-semibold text-gray-900">{displayJoinedAt}</p>
              </div>
            </div>
          </div>
          {effectiveCustomer?.address?.formatted && (
            <div className="w-full bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 border-b border-gray-100 pb-3">Address</h3>
              <div className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <MapPin className="text-[#2E5E58] mt-0.5 flex-shrink-0" size={18} />
                <div>
                  <p className="text-sm font-bold text-gray-900">Saved address</p>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">{effectiveCustomer.address.formatted}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewProfile;
