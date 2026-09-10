import React, { lazy, Suspense, useEffect, useState } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import {
  adminRequest,
  clearAdminTokens,
  loadAdminTokens,
  saveAdminTokens
} from './lib/adminApi';
import { canAccessAdminPage, firstAccessibleAdminPage } from './lib/adminPermissions';
import { UnsavedChangesProvider, useUnsavedChanges } from './utils/UnsavedChangesContext';

const DashboardHome = lazy(() => import('./components/DashboardHome'));
const Customers = lazy(() => import('./components/Customers'));
const Orders = lazy(() => import('./components/Orders'));
const Profile = lazy(() => import('./components/Profile'));
const Vouchers = lazy(() => import('./components/Vouchers'));
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
        {currentPage === 'Voucher' && <Vouchers onBack={() => navigateWithPrompt(prevPage || 'Dashboard')} />}
        {currentPage === 'Token Ledger' && <LoyaltyTokens onBack={() => navigateWithPrompt(prevPage || 'Dashboard')} onNavigate={navigateWithPrompt} />}
        {currentPage === 'Tier Management' && <TierManagement onBack={() => navigateWithPrompt('Token Ledger')} />}
        {currentPage === 'Menu' && <Menu onNavigate={navigateWithPrompt} />}
        {currentPage === 'Options & Nutrition' && <OptionsNutrition />}
        {currentPage === 'Marketing' && <Marketing setCurrentPage={navigateWithPrompt} />}
        {currentPage === 'Finance' && <Finance setCurrentPage={navigateWithPrompt} />}
        {currentPage === 'RevenueReport' && <RevenueReport onBack={() => navigateWithPrompt('Finance')} />}
        {currentPage === 'AllTransactions' && <AllTransactions onBack={() => navigateWithPrompt('Finance')} />}
        {currentPage === 'ExpenseBreakdownFull' && <ExpenseBreakdownFull onBack={() => navigateWithPrompt('Finance')} />}
        {currentPage === 'Product Report' && <ReportByProduct onBack={() => navigateWithPrompt('Finance')} />}
        {currentPage === 'Admin Management' && <AdminManagement currentUser={currentUser} />}
        {currentPage === 'Barista Management' && <BaristaManagement />}
        {currentPage === 'Operations' && <Operations />}
        {currentPage === 'Audit Logs' && <AuditLogs onNavigate={navigateWithPrompt} currentUser={currentUser} />}
        {currentPage === 'Settings' && <Settings setCurrentPage={navigateWithPrompt} currentUser={currentUser} />}
      </Suspense>
    </Layout>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('Dashboard');
  const [prevPage, setPrevPage] = useState('Dashboard');

  useEffect(() => {
    const restoreAdminSession = async () => {
      try {
        const response = await adminRequest('/v1/admin/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({})
        });

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
      } catch {
        clearAdminTokens();
        setIsLoggedIn(false);
        setCurrentTenant(null);
        setCurrentUser(null);
      } finally {
        setIsBootstrapping(false);
      }
    };

    void restoreAdminSession();
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setIsLoggedIn(false);
      setCurrentTenant(null);
      setCurrentUser(null);
      setCurrentPage('Dashboard');
      setPrevPage('Dashboard');
    };

    window.addEventListener('c2-admin-session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('c2-admin-session-expired', handleSessionExpired);
    };
  }, []);

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
    const tokens = loadAdminTokens();
    if (tokens.accessToken) {
      try {
        await adminRequest('/v1/admin/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`
          }
        });
      } catch {
        // Ignore logout failures and clear local state anyway.
      }
    }

    clearAdminTokens();
    setIsLoggedIn(false);
    setCurrentTenant(null);
    setCurrentUser(null);
    setCurrentPage('Dashboard');
    setPrevPage('Dashboard');
  };

  const handleLoginSuccess = ({ accessToken, tenant, user }) => {
    saveAdminTokens({ accessToken, refreshToken: null });
    if (tenant) {
      setCurrentTenant(tenant);
    }
    if (user) {
      setCurrentUser(user);
    }
    setIsLoggedIn(true);
    setCurrentPage('Dashboard');
  };

  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F3EE] text-[#2E5E58] font-semibold">
        Restoring admin session...
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
