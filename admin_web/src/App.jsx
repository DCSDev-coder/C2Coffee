import React, { useState } from 'react';
import Layout from './components/Layout';
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

function App() {
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

  return (
    <Layout currentPage={currentPage === 'Refunds' ? 'Orders' : currentPage} setCurrentPage={handleNavigate}>
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
      {currentPage === 'Marketing' && <Marketing />}
    </Layout>
  );
}

export default App;
