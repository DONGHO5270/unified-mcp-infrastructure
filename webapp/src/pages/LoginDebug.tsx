import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuthStoreDebug } from '../stores/auth-debug';
import { MockAuthServer } from '../lib/auth/mock-auth-server';

export const LoginDebug: React.FC = () => {
  const { login, isAuthenticated, isLoading, error } = useAuthStoreDebug();
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [useMockServer, setUseMockServer] = useState(false);

  useEffect(() => {
    if (useMockServer) {
      MockAuthServer.setupMockEndpoint();
      addDebugInfo('Mock auth server enabled');
    }
  }, [useMockServer]);

  const addDebugInfo = (info: string) => {
    console.log('[LoginDebug]', info);
    setDebugInfo(prev => [...prev, `[${new Date().toISOString()}] ${info}`]);
  };

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDebugInfo([]); // Clear previous debug info
    
    addDebugInfo('Form submitted');
    addDebugInfo(`Username: ${credentials.username}`);
    addDebugInfo('Password: ***');
    
    try {
      addDebugInfo('Calling login function...');
      await login(credentials);
      addDebugInfo('Login function completed successfully');
    } catch (error) {
      addDebugInfo(`Login error caught: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('[LoginDebug] Full error:', error);
    }
  };

  // Test direct API call
  const testDirectApiCall = async () => {
    setDebugInfo([]);
    addDebugInfo('Testing direct API call to /api/auth/login');
    
    try {
      const response = await fetch('http://localhost:3100/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: credentials.username || 'admin',
          password: credentials.password || 'admin123'
        })
      });
      
      addDebugInfo(`Response status: ${response.status} ${response.statusText}`);
      addDebugInfo(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
      
      const text = await response.text();
      addDebugInfo(`Raw response: ${text}`);
      
      try {
        const json = JSON.parse(text);
        addDebugInfo(`Parsed JSON: ${JSON.stringify(json, null, 2)}`);
      } catch (parseError) {
        addDebugInfo(`JSON parse error: ${parseError}`);
      }
    } catch (error) {
      addDebugInfo(`Fetch error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('[LoginDebug] Direct API call error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-gray-100">
              Debug Login to MCP Infrastructure
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
              This is a debug version with extensive logging
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                  placeholder="Enter your username"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white pr-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                )}
                <LogIn className="h-4 w-4 mr-2" />
                Sign in (Debug)
              </button>

              <button
                type="button"
                onClick={testDirectApiCall}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Test Direct API Call
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Debug Info Panel */}
      <div className="w-1/2 bg-gray-900 text-gray-100 p-4 overflow-auto">
        <h3 className="text-lg font-semibold mb-4">Debug Information</h3>
        <div className="space-y-1 font-mono text-xs">
          {debugInfo.map((info, index) => (
            <div key={index} className="whitespace-pre-wrap break-all">
              {info}
            </div>
          ))}
          {debugInfo.length === 0 && (
            <div className="text-gray-500">Debug info will appear here...</div>
          )}
        </div>
        
        <div className="mt-8">
          <h4 className="text-sm font-semibold mb-2">Instructions:</h4>
          <ul className="text-xs space-y-1 text-gray-400">
            <li>1. Enter credentials and click "Sign in (Debug)"</li>
            <li>2. Watch the debug panel for detailed logging</li>
            <li>3. Check the browser console for more details</li>
            <li>4. Use "Test Direct API Call" to test the API endpoint</li>
            <li>5. Enable "Use Mock Server" to bypass backend issues</li>
          </ul>
        </div>

        <div className="mt-4">
          <label className="flex items-center space-x-2 text-xs">
            <input
              type="checkbox"
              checked={useMockServer}
              onChange={(e) => setUseMockServer(e.target.checked)}
              className="rounded border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span>Use Mock Server (bypasses backend)</span>
          </label>
        </div>

        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-2">Test Credentials:</h4>
          <ul className="text-xs space-y-1 text-gray-400">
            <li>Username: admin</li>
            <li>Password: admin123</li>
          </ul>
        </div>
      </div>
    </div>
  );
};