import React, { useState } from 'react';
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

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [currentPage, setCurrentPage] = useState('Dashboard');
  const [prevPage, setPrevPage] = useState('Dashboard');

  const handleNavigate = (newPage) => {
    if (currentPage !== newPage) {
      if (currentPage !== 'Notifications' && currentPage !== 'Profile') {
        setPrevPage(currentPage);
      }
      setCurrentPage(newPage);
    }
  };

  const layoutCurrentPage = ['Refunds'].includes(currentPage) ? 'Orders'
    : ['GenerateInvoice', 'RecordExpense', 'RevenueReport', 'ExportStatement', 'AllTransactions', 'ExpenseBreakdownFull'].includes(currentPage) ? 'Finance'
    : ['AllCampaigns', 'AllPushNotifications', 'AllContentPerformance'].includes(currentPage) ? 'Marketing'
    : currentPage;

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <Layout currentPage={layoutCurrentPage} setCurrentPage={handleNavigate} onLogout={() => setIsLoggedIn(false)}>
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
      {currentPage === 'Profile' && <Profile onBack={() => handleNavigate(prevPage || 'Dashboard')} />}
      {currentPage === 'Voucher' && <Vouchers onBack={() => handleNavigate(prevPage || 'Dashboard')} />}
      {currentPage === 'Loyalty & Tokens' && <LoyaltyTokens onBack={() => handleNavigate(prevPage || 'Dashboard')} />}
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
      {currentPage === 'Admin Management' && <AdminManagement />}
    </Layout>
  );
}

export default App;
