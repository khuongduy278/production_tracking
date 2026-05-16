import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OrderList from './pages/OrderList';
import OrderDetail from './pages/OrderDetail';
import OutsourcingList from './pages/OutsourcingList';
import OutsourcingDetail from './pages/OutsourcingDetail';
import LogsPage from './pages/LogsPage';
import WelcomePage from './pages/WelcomePage';

export default function App() {
  const { userData, loading } = useAuth();
  
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Đang tải...</div>;
  }

  if (!userData) {
    return <WelcomePage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<OrderList />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="outsourcing" element={<OutsourcingList />} />
        <Route path="outsourcing/:id" element={<OutsourcingDetail />} />
        <Route path="logs" element={<LogsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
