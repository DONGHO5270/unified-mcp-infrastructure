import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage, ServiceDetailPage, LoginPage, PredictiveAnalysisPage } from './pages';
import { LoginDebug } from './pages/LoginDebug';
import { useAuthStore, useUIStore } from './stores';
import { initializeLibrary } from './lib';
import { ProtectedRoute } from './components/ProtectedRoute';
import './i18n'; // i18n 초기화
import './App.css';

function App() {
  const { isAuthenticated } = useAuthStore();
  const { theme } = useUIStore();

  // Initialize library and stores
  useEffect(() => {
    let mounted = true;
    let analysisTimeout: NodeJS.Timeout;
    
    console.log('[App] Hot reload test - useEffect triggered for library initialization');
    
    const initLib = async () => {
      try {
        await initializeLibrary({
          apiBaseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3100',
          autoTokenRefresh: true
        });
        
        if (!mounted) return;
        
        console.log('[App] Library initialization completed');
        
        // Analyze initialization after a delay
        analysisTimeout = setTimeout(() => {
          if (mounted && (window as any).reactInitDebugger) {
            const analysis = (window as any).reactInitDebugger.analyzeIssues();
            console.warn('React Initialization Analysis:', analysis);
          }
        }, 2000);
        
        // Initialize stores if authenticated
        if (isAuthenticated) {
          const { initializeStores } = await import('./stores');
          if (mounted) {
            await initializeStores();
          }
        }
      } catch (error) {
        console.error('[App] Library initialization failed:', error);
      }
    };
    
    initLib();
    
    // Cleanup function to detect unmounts
    return () => {
      mounted = false;
      if (analysisTimeout) {
        clearTimeout(analysisTimeout);
      }
      console.log('[App] Component unmounting - cleaning up');
    };
  }, [isAuthenticated]); // Fixed dependency array

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <Router future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } />
        <Route path="/login-debug" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginDebug />
        } />
        
        {/* Protected routes */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        <Route path="/service/:serviceId" element={
          <ProtectedRoute>
            <ServiceDetailPage />
          </ProtectedRoute>
        } />
        <Route path="/predictive-analysis" element={
          <ProtectedRoute>
            <PredictiveAnalysisPage />
          </ProtectedRoute>
        } />
        
        {/* Catch all - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
