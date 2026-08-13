import React, { useState } from 'react';
import Layout from './components/Layout';
import DashboardHome from './components/DashboardHome';
import Customers from './components/Customers';

function App() {
  const [currentPage, setCurrentPage] = useState('Customers');

  return (
    <Layout currentPage={currentPage} setCurrentPage={setCurrentPage}>
      {currentPage === 'Dashboard' && <DashboardHome />}
      {currentPage === 'Customers' && <Customers />}
    </Layout>
  );
}

export default App;
