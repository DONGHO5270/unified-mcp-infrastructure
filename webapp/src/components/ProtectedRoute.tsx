import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};