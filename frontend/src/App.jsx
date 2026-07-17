import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import Login from './pages/auth/Login';
import Dashboard from './pages/admin/Dashboard';
import ViewReports from './pages/admin/ViewReports';
import Clients from './pages/admin/Clients';
import AssignReports from './pages/admin/AssignReports';
import ReportLogs from './pages/admin/ReportLogs';
import Profile from './pages/client/Profile';
import GenerateReport from './pages/client/GenerateReport';
import ReportHistory from './pages/client/ReportHistory';
import AdminLayout from './components/AdminLayout';
import ClientLayout from './components/ClientLayout';

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute role="ADMIN"><AdminLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"    element={<Dashboard />} />
            <Route path="view-reports" element={<ViewReports />} />
            <Route path="clients"      element={<Clients />} />
            <Route path="assign"       element={<AssignReports />} />
            <Route path="logs"         element={<ReportLogs />} />
          </Route>

          {/* Client Routes */}
          <Route path="/client" element={<ProtectedRoute role="CLIENT"><ClientLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="generate" replace />} />
            <Route path="profile"  element={<Profile />} />
            <Route path="generate" element={<GenerateReport />} />
            <Route path="history"  element={<ReportHistory />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
