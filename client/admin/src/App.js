import React, { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

import Sidebar from './components/Sidebar';

const Users = lazy(() => import('./pages/Users'));
const Login = lazy(() => import('./pages/Login'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 min-h-screen">
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-bgDark">
        <Toaster position="top-right" reverseOrder={false} />
        <Routes>
          <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
          <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/users" replace />} />
          <Route path="*" element={<Navigate to="/users" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
