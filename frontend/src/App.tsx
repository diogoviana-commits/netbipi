import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import Tickets from './pages/Tickets';
import Assets from './pages/Assets';
import Logs from './pages/Logs';
import Network from './pages/Network';
import KnowledgeBase from './pages/KnowledgeBase';
import Reports from './pages/Reports';
import CloudPanel from './pages/CloudPanel';
import ShiftDashboard from './pages/ShiftDashboard';
import InfraMap from './pages/InfraMap';
import KioskMode from './pages/KioskMode';
import { FullPageLoader } from './components/ui/LoadingSpinner';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <FullPageLoader message="Verificando autenticação..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  const { init } = useAuthStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Kiosk mode — fullscreen, no layout wrapper */}
        <Route
          path="/kiosk"
          element={
            <ProtectedRoute>
              <KioskMode />
            </ProtectedRoute>
          }
        />

        {/* Main app with layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="assets" element={<Assets />} />
          <Route path="logs" element={<Logs />} />
          <Route path="network" element={<Network />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="reports" element={<Reports />} />
          <Route path="cloud" element={<CloudPanel />} />
          <Route path="shift" element={<ShiftDashboard />} />
          <Route path="map" element={<InfraMap />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
