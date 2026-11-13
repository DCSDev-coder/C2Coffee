import React, { lazy, Suspense, useEffect, useState } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import {
  clearAdminExplicitLogout,
  clearAdminTokens,
  logoutAdminSession,
  refreshAdminSession,
  saveAdminTokens,
  wasAdminExplicitlyLoggedOut
} from './lib/adminApi';
import { isTerminalAdminSessionFailure } from './lib/adminSessionPolicy';
import { canAccessAdminPage, firstAccessibleAdminPage } from './lib/adminPermissions';
import { UnsavedChangesProvider, useUnsavedChanges } from './utils/UnsavedChangesContext';

const DashboardHome = lazy(() => import('./components/DashboardHome'));
const BaristaConsole = lazy(() => import('./components/BaristaConsole'));
const Customers = lazy(() => import('./components/Customers'));
const Orders = lazy(() => import('./components/Orders'));
const Profile = lazy(() => import('./components/Profile'));
const Vouchers = lazy(() => import('./components/Vouchers'));
const GiftCards = lazy(() => import('./components/GiftCards'));
const ReferralProgram = lazy(() => import('./components/ReferralProgram'));
const LoyaltyTokens = lazy(() => import('./components/LoyaltyTokens'));
const Menu = lazy(() => import('./components/Menu'));
const OptionsNutrition = lazy(() => import('./components/OptionsNutrition'));
const Marketing = lazy(() => import('./components/Marketing'));
const Finance = lazy(() => import('./components/Finance'));
const RevenueReport = lazy(() => import('./components/RevenueReport'));
const AllTransactions = lazy(() => import('./components/AllTransactions'));
const ExpenseBreakdownFull = lazy(() => import('./components/ExpenseBreakdownFull'));
const AdminManagement = lazy(() => import('./components/AdminManagement'));
const BaristaManagement = lazy(() => import('./components/BaristaManagement'));
const TierManagement = lazy(() => import('./components/TierManagement'));
const ReportByProduct = lazy(() => import('./components/ReportByProduct'));
const AuditLogs = lazy(() => import('./components/AuditLogs'));
const Settings = lazy(() => import('./components/Settings'));
const Operations = lazy(() => import('./components/Operations'));
const StaffGuides = lazy(() => import('./components/StaffGuides'));
const Outlets = lazy(() => import('./components/Outlets'));
const CounterDevices = lazy(() => import('./components/CounterDevices'));
const PlatformTenants = lazy(() => import('./components/PlatformTenants'));
const DataRetention = lazy(() => import('./components/DataRetention'));
const Inventory = lazy(() => import('./components/Inventory'));

const LAST_ADMIN_PAGE_KEY = 'c2_admin_last_page';

function readLastAdminPage() {
  try {
    return window.localStorage.getItem(LAST_ADMIN_PAGE_KEY) || 'Dashboard';
  } catch {
    return 'Dashboard';
  }
}

function saveLastAdminPage(page) {
  try {
    window.localStorage.setItem(LAST_ADMIN_PAGE_KEY, page);
  } catch {
    // Page persistence is a convenience and must never block navigation.
  }
}

function clearLastAdminPage() {
  try {
    window.localStorage.removeItem(LAST_ADMIN_PAGE_KEY);
  } catch {
    // Ignore storage failures during logout/session cleanup.
  }
}

function AppContent({
  layoutCurrentPage,
  currentPage,
  handleLogout,
  currentTenant,
  currentUser,
  handleUpdateUser,
  prevPage,
}) {
  const { navigateWithPrompt } = useUnsavedChanges();

  return (
    <Layout
      currentPage={layoutCurrentPage}
      setCurrentPage={navigateWithPrompt}
      onLogout={handleLogout}
      currentTenant={currentTenant}
      currentUser={currentUser}
    >
      <Suspense fallback={<div className="flex min-h-[320px] items-center justify-center text-sm font-semibold text-[#2E5E58]">Loading page...</div>}>
        {currentPage === 'Barista Console' && <BaristaConsole currentUser={currentUser} />}
        {currentPage === 'Barista Workspace' && <BaristaConsole currentUser={currentUser} view="workspace" />}
        {currentPage === 'Dashboard' && <DashboardHome setCurrentPage={navigateWithPrompt} />}
        {currentPage === 'Customers' && <Customers currentUser={currentUser} />}
        {currentPage === 'Orders' && <Orders initialShowRefunds={false} currentUser={currentUser} />}
        {currentPage === 'Refunds' && (
          <Orders
            initialShowRefunds={true}
            currentUser={currentUser}
            onBackToOrders={() => navigateWithPrompt('Orders')}
          />
        )}
        {currentPage === 'Profile' && <Profile onBack={() => navigateWithPrompt(prevPage || 'Dashboard')} currentUser={currentUser} onUpdateUser={handleUpdateUser} />}
        {currentPage === 'Voucher' && <Vouchers onBack={() => navigateWithPrompt(prevPage || 'Dashboard')} onNavigate={navigateWithPrompt} />}
        {currentPage === 'Gift Cards' && <GiftCards currentUser={currentUser} />}
        {currentPage === 'Referral Program' && <ReferralProgram />}
        {currentPage === 'C2 Credit Ledger' && <LoyaltyTokens onBack={() => navigateWithPrompt(prevPage || 'Dashboard')} onNavigate={navigateWithPrompt} />}
        {currentPage === 'Tier Management' && <TierManagement onBack={() => navigateWithPrompt('C2 Credit Ledger')} />}
        {currentPage === 'Menu' && <Menu onNavigate={navigateWithPrompt} />}
        {currentPage === 'Options & Nutrition' && <OptionsNutrition />}
        {currentPage === 'Inventory' && <Inventory />}
        {currentPage === 'Marketing' && <Marketing setCurrentPage={navigateWithPrompt} />}
        {currentPage === 'Finance' && <Finance setCurrentPage={navigateWithPrompt} />}
        {currentPage === 'RevenueReport' && <RevenueReport onBack={() => navigateWithPrompt('Finance')} />}
        {currentPage === 'AllTransactions' && <AllTransactions onBack={() => navigateWithPrompt('Finance')} />}
        {currentPage === 'ExpenseBreakdownFull' && <ExpenseBreakdownFull onBack={() => navigateWithPrompt('Finance')} />}
        {currentPage === 'Product Report' && <ReportByProduct onBack={() => navigateWithPrompt('Finance')} />}
        {currentPage === 'Admin Management' && <AdminManagement currentUser={currentUser} />}
        {currentPage === 'Barista Management' && <BaristaManagement />}
        {currentPage === 'Outlets' && <Outlets currentUser={currentUser} />}
        {currentPage === 'C2 Store Devices' && <CounterDevices currentUser={currentUser} />}
        {currentPage === 'Operations' && <Operations />}
        {currentPage === 'Staff Guides' && <StaffGuides />}
        {currentPage === 'Audit Logs' && <AuditLogs onNavigate={navigateWithPrompt} currentUser={currentUser} />}
        {currentPage === 'Settings' && <Settings setCurrentPage={navigateWithPrompt} currentUser={currentUser} />}
        {currentPage === 'Deployment' && <PlatformTenants currentUser={currentUser} />}
        {currentPage === 'Data Retention' && <DataRetention />}
      </Suspense>
    </Layout>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [sessionRestoreError, setSessionRestoreError] = useState('');
  const [sessionRestoreAttempt, setSessionRestoreAttempt] = useState(0);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(readLastAdminPage);
  const [prevPage, setPrevPage] = useState('Dashboard');

  useEffect(() => {
    const restoreAdminSession = async () => {
      if (wasAdminExplicitlyLoggedOut()) {
        clearAdminTokens();
        setIsBootstrapping(false);
        return;
      }
      try {
        const response = await refreshAdminSession();

        saveAdminTokens({
          accessToken: response.access_token,
          refreshToken: null
        });
        setCurrentTenant(response.user?.tenant_code ? {
          code: response.user.tenant_code,
          name: response.user.tenant_name,
          display_name: response.user.tenant_display_name
        } : null);
        setCurrentUser(response.user || null);
        setIsLoggedIn(true);
        setSessionRestoreError('');
      } catch (error) {
        if (isTerminalAdminSessionFailure(error)) {
          clearAdminTokens();
          setIsLoggedIn(false);
          setCurrentTenant(null);
          setCurrentUser(null);
          setSessionRestoreError('');
        } else {
          setSessionRestoreError('We could not restore your admin session. Check the connection and try again.');
        }
      } finally {
        setIsBootstrapping(false);
      }
    };

    void restoreAdminSession();
  }, [sessionRestoreAttempt]);

  useEffect(() => {
    const handleSessionExpired = () => {
      setIsLoggedIn(false);
      setCurrentTenant(null);
      setCurrentUser(null);
      setCurrentPage('Dashboard');
      setPrevPage('Dashboard');
      clearLastAdminPage();
    };

    window.addEventListener('c2-admin-session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('c2-admin-session-expired', handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      saveLastAdminPage(currentPage);
    }
  }, [currentPage, isLoggedIn]);

  const handleNavigate = (newPage) => {
    if (newPage !== 'Profile' && !canAccessAdminPage(currentUser?.roles, newPage)) {
      return;
    }
    if (currentPage !== newPage) {
      if (currentPage !== 'Profile') {
        setPrevPage(currentPage);
      }
      setCurrentPage(newPage);
    }
  };

  useEffect(() => {
    if (isLoggedIn && currentPage !== 'Profile' && !canAccessAdminPage(currentUser?.roles, currentPage)) {
      setCurrentPage(firstAccessibleAdminPage(currentUser?.roles));
    }
  }, [currentPage, currentUser?.roles, isLoggedIn]);

  const handleUpdateUser = (updates) => {
    setCurrentUser(prev => ({ ...prev, ...updates }));
  };

  const layoutCurrentPage = ['Refunds'].includes(currentPage) ? 'Orders'
    : ['RevenueReport', 'AllTransactions', 'ExpenseBreakdownFull'].includes(currentPage) ? 'Finance'
      : currentPage;

  const handleLogout = async () => {
    try {
      await logoutAdminSession();
    } catch {
      // Keep the explicit-logout marker so a failed network request cannot
      // silently restore the refresh-cookie session on the next page load.
    }

    clearAdminTokens();
    setIsLoggedIn(false);
    setCurrentTenant(null);
    setCurrentUser(null);
    setCurrentPage('Dashboard');
    setPrevPage('Dashboard');
    clearLastAdminPage();
  };

  const handleLoginSuccess = ({ accessToken, tenant, user }) => {
    clearAdminExplicitLogout();
    saveAdminTokens({ accessToken, refreshToken: null });
    if (tenant) {
      setCurrentTenant(tenant);
    }
    if (user) {
      setCurrentUser(user);
    }
    setIsLoggedIn(true);
    const savedPage = readLastAdminPage();
    setCurrentPage(canAccessAdminPage(user?.roles, savedPage) ? savedPage : firstAccessibleAdminPage(user?.roles));
  };

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE] text-[#2E5E58] font-semibold">
        Restoring admin session...
      </div>
    );
  }

  if (sessionRestoreError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE] px-6 text-center">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-bold text-[#1F3A34]">Connection needed</h1>
          <p className="mt-3 text-sm text-gray-600">{sessionRestoreError}</p>
          <button
            type="button"
            onClick={() => {
              setIsBootstrapping(true);
              setSessionRestoreError('');
              setSessionRestoreAttempt((attempt) => attempt + 1);
            }}
            className="mt-6 rounded-lg bg-[#1F3A34] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2E5E58]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <UnsavedChangesProvider onNavigate={handleNavigate}>
      <AppContent
        layoutCurrentPage={layoutCurrentPage}
        currentPage={currentPage}
        handleLogout={handleLogout}
        currentTenant={currentTenant}
        currentUser={currentUser}
        handleUpdateUser={handleUpdateUser}
        prevPage={prevPage}
      />
    </UnsavedChangesProvider>
  );
}

export default App;
