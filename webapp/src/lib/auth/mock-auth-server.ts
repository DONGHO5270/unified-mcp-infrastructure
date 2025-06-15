/**
 * Mock Auth Server for Testing
 * This creates a simple mock authentication endpoint for debugging
 */

export class MockAuthServer {
  static setupMockEndpoint() {
    // Override fetch for /api/auth/login
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.toString();
      
      // Intercept login requests
      if (url.includes('/api/auth/login')) {
        console.log('[MockAuthServer] Intercepting login request');
        
        const body = init?.body ? JSON.parse(init.body as string) : {};
        console.log('[MockAuthServer] Request body:', body);
        
        // Simulate successful login
        if (body.username === 'admin' && body.password === 'admin123') {
          const mockResponse = {
            success: true,
            data: {
              user: {
                id: 'user_123',
                username: 'admin',
                email: 'admin@example.com',
                displayName: 'Admin User',
                avatar: 'https://ui-avatars.com/api/?name=Admin+User',
                roles: [
                  {
                    id: 'role_admin',
                    name: 'Administrator',
                    permissions: ['*']
                  }
                ],
                preferences: {
                  theme: 'auto',
                  notifications: true,
                  language: 'en'
                },
                lastLoginAt: new Date().toISOString(),
                createdAt: '2024-01-01T00:00:00Z'
              },
              accessToken: 'mock_access_token_' + Date.now(),
              refreshToken: 'mock_refresh_token_' + Date.now(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            }
          };
          
          console.log('[MockAuthServer] Returning mock success response:', mockResponse);
          
          return new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        } else {
          // Invalid credentials
          const errorResponse = {
            success: false,
            error: 'Invalid username or password'
          };
          
          console.log('[MockAuthServer] Returning mock error response:', errorResponse);
          
          return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
      }
      
      // Pass through all other requests
      return originalFetch(input, init);
    };
    
    console.log('[MockAuthServer] Mock endpoint setup complete');
  }
  
  static removeMockEndpoint() {
    // This would need to store the original fetch to properly restore it
    console.log('[MockAuthServer] Mock endpoint removal not implemented');
  }
}