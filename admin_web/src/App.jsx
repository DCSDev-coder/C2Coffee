import React, { useEffect, useState } from 'react';
import Layout from './components/Layout';
import Login from './components/Login';
import DashboardHome from './components/DashboardHome';
import Customers from './components/Customers';
import Orders from './components/Orders';
import RecentActivities from './components/RecentActivities';
import Notifications from './components/Notifications';
import Profile from './components/Profile';
import Vouchers from './components/Vouchers';
import LoyaltyTokens from './components/LoyaltyTokens';
import Menu from './components/Menu';
import Marketing from './components/Marketing';
import Finance from './components/Finance';
import GenerateInvoice from './components/GenerateInvoice';
import RecordExpense from './components/RecordExpense';
import RevenueReport from './components/RevenueReport';
import ExportStatement from './components/ExportStatement';
import AllTransactions from './components/AllTransactions';
import ExpenseBreakdownFull from './components/ExpenseBreakdownFull';
import AllCampaigns from './components/AllCampaigns';
import AllPushNotifications from './components/AllPushNotifications';
import AllContentPerformance from './components/AllContentPerformance';
import AdminManagement from './components/AdminManagement';
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

  const handleNavigate = (newPage) => {
    if (currentPage !== newPage) {
      if (currentPage !== 'Notifications' && currentPage !== 'Profile') {
        setPrevPage(currentPage);
      }
      setCurrentPage(newPage);
    }
  };

  const handleUpdateUser = (updates) => {
    setCurrentUser(prev => ({ ...prev, ...updates }));
  };

  const layoutCurrentPage = ['Refunds'].includes(currentPage) ? 'Orders'
    : ['GenerateInvoice', 'RecordExpense', 'RevenueReport', 'ExportStatement', 'AllTransactions', 'ExpenseBreakdownFull'].includes(currentPage) ? 'Finance'
      : ['AllCampaigns', 'AllPushNotifications', 'AllContentPerformance'].includes(currentPage) ? 'Marketing'
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
      {currentPage === 'Customers' && <Customers />}
      {currentPage === 'Orders' && <Orders initialShowRefunds={false} />}
      {currentPage === 'Refunds' && (
        <Orders
          initialShowRefunds={true}
          onBackToOrders={() => handleNavigate('Orders')}
        />
      )}
      {currentPage === 'Recent Activities' && <RecentActivities onBack={() => handleNavigate('Dashboard')} />}
      {currentPage === 'Notifications' && <Notifications onBack={() => handleNavigate(prevPage || 'Orders')} />}
      {currentPage === 'Profile' && <Profile onBack={() => handleNavigate(prevPage || 'Dashboard')} currentUser={currentUser} onUpdateUser={handleUpdateUser} />}
      {currentPage === 'Voucher' && <Vouchers onBack={() => handleNavigate(prevPage || 'Dashboard')} />}
      {currentPage === 'Loyalty & Tokens' && <LoyaltyTokens onBack={() => handleNavigate(prevPage || 'Dashboard')} onNavigate={handleNavigate} />}
      {currentPage === 'Tier Management' && <TierManagement onBack={() => handleNavigate('Loyalty & Tokens')} />}
      {currentPage === 'Menu' && <Menu />}
      {currentPage === 'Marketing' && <Marketing setCurrentPage={handleNavigate} />}
      {currentPage === 'AllCampaigns' && <AllCampaigns onBack={() => handleNavigate('Marketing')} />}
      {currentPage === 'AllPushNotifications' && <AllPushNotifications onBack={() => handleNavigate('Marketing')} />}
      {currentPage === 'AllContentPerformance' && <AllContentPerformance onBack={() => handleNavigate('Marketing')} />}
      {currentPage === 'Finance' && <Finance setCurrentPage={handleNavigate} />}
      {currentPage === 'GenerateInvoice' && <GenerateInvoice onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'RecordExpense' && <RecordExpense onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'RevenueReport' && <RevenueReport onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'ExportStatement' && <ExportStatement onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'AllTransactions' && <AllTransactions onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'ExpenseBreakdownFull' && <ExpenseBreakdownFull onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'Product Report' && <ReportByProduct onBack={() => handleNavigate('Finance')} />}
      {currentPage === 'Admin Management' && <AdminManagement currentUser={currentUser} />}
      {currentPage === 'Audit Logs' && <AuditLogs onNavigate={handleNavigate} currentUser={currentUser} />}
      {currentPage === 'Settings' && <Settings setCurrentPage={handleNavigate} currentUser={currentUser} />}
    </Layout>
  );
}

export default App;
