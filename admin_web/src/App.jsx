import React, { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import DashboardHome from './components/DashboardHome';
import Customers from './components/Customers';
import Orders from './components/Orders';
import Profile from './components/Profile';
import Vouchers from './components/Vouchers';
import LoyaltyTokens from './components/LoyaltyTokens';
import Menu from './components/Menu';
import Marketing from './components/Marketing';
import Finance from './components/Finance';
import RevenueReport from './components/RevenueReport';
import AllTransactions from './components/AllTransactions';
import ExpenseBreakdownFull from './components/ExpenseBreakdownFull';
import AdminManagement from './components/AdminManagement';
import BaristaManagement from './components/BaristaManagement';
import TierManagement from './components/TierManagement';
import ReportByProduct from './components/ReportByProduct';
import AuditLogs from './components/AuditLogs';
import Settings from './components/Settings';
import {
  adminRequest,
  clearAdminTokens,
  loadAdminTokens,
  saveAdminTokens
} from './lib/adminApi';
import { canAccessAdminPage, firstAccessibleAdminPage } from './lib/adminPermissions';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('Dashboard');
  const [prevPage, setPrevPage] = useState('Dashboard');

  useEffect(() => {
    const restoreAdminSession = async () => {
      const tokens = loadAdminTokens();
      if (!tokens.refreshToken) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const response = await adminRequest('/v1/admin/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: tokens.refreshToken })
        });

        saveAdminTokens({
          accessToken: response.access_token,
          refreshToken: response.refresh_token
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

  const handleLoginSuccess = ({ accessToken, refreshToken, tenant, user }) => {
    saveAdminTokens({ accessToken, refreshToken });
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
    <Layout
      currentPage={layoutCurrentPage}
      setCurrentPage={handleNavigate}
      onLogout={handleLogout}
      currentTenant={currentTenant}
      currentUser={currentUser}
    >
      {currentPage === 'Dashboard' && <DashboardHome setCurrentPage={handleNavigate} />}
      {currentPage === 'Customers' && <Customers currentUser={currentUser} />}
      {currentPage === 'Orders' && <Orders initialShowRefunds={false} />}
      {currentPage === 'Refunds' && (
        <Orders
          initialShowRefunds={true}
          onBackToOrders={() => handleNavigate('Orders')}
        />
      )}
      {currentPage === 'Profile' && <Profile onBack={() => handleNavigate(prevPage || 'Dashboard')} currentUser={currentUser} onUpdateUser={handleUpdateUser} />}
      {currentPage === 'Voucher' && <Vouchers onBack={() => handleNavigate(prevPage || 'Dashboard')} />}
      {currentPage === 'Loyalty & Tokens' && <LoyaltyTokens onBack={() => handleNavigate(prevPage || 'Dashboard')} onNavigate={handleNavigate} />}
      {currentPage === 'Tier Management' && <TierManagement onBack={() => handleNavigate('Loyalty & Tokens')} />}
      {currentPage === 'Menu' && <Menu />}
      {currentPage === 'Marketing' && <Marketing setCurrentPage={handleNavigate} />}
      {currentPage === 'Finance' && <Finance setCurrentPage={handleNavigate} />}
      {currentPage === 'RevenueReport' && <RevenueReport onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'AllTransactions' && <AllTransactions onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'ExpenseBreakdownFull' && <ExpenseBreakdownFull onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'Product Report' && <ReportByProduct onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'Admin Management' && <AdminManagement currentUser={currentUser} />}
      {currentPage === 'Barista Management' && <BaristaManagement />}
      {currentPage === 'Audit Logs' && <AuditLogs onNavigate={handleNavigate} currentUser={currentUser} />}
      {currentPage === 'Settings' && <Settings setCurrentPage={handleNavigate} currentUser={currentUser} />}
    </Layout>
  );
}

export default App;
