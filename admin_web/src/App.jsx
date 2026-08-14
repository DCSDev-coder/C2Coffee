import React, { useState } from 'react';
import Layout from './components/Layout';
import DashboardHome from './components/DashboardHome';
import Customers from './components/Customers';
import Orders from './components/Orders';
import RecentActivities from './components/RecentActivities';
import Notifications from './components/Notifications';

function App() {
  const [currentPage, setCurrentPage] = useState('Orders');
  const [prevPage, setPrevPage] = useState('Orders');

  const handleNavigate = (newPage) => {
    if (currentPage !== newPage) {
      if (currentPage !== 'Notifications') {
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
    </Layout>
  );
}

export default App;
