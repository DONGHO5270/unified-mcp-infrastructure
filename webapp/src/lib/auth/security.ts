/**
 * Authentication & Security Module
 * 통합 MCP 인프라를 위한 인증 및 보안 모듈
 */

import { jwtDecode } from 'jwt-decode';
import { AuthToken, User, Permission, Role } from '../../types';
import { apiClient } from '../api/client';
import { logger } from '../utils/logger';
import { ErrorHandler, AuthenticationError, AuthorizationError } from '../utils/error-handler';
import { PermissionService as PermissionServiceClass } from './permissions';

// ============ JWT Token Management ============

export interface JWTPayload {
  sub: string; // User ID
  username: string;
  email?: string;
  roles: string[];
  permissions: string[];
  iat: number; // Issued at
  exp: number; // Expires at
  iss: string; // Issuer
  aud: string; // Audience
}

export class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'mcp_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'mcp_refresh_token';
  private static readonly USER_KEY = 'mcp_user';

  /**
   * JWT 토큰 저장
   */
  static setTokens(accessToken: string, refreshToken?: string): void {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      if (refreshToken) {
        localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
      }
      
      // API 클라이언트에 토큰 설정
      apiClient.setAuthToken(accessToken);
      
      logger.debug('Tokens stored successfully');
    } catch (error) {
      logger.error('Failed to store tokens', error as Error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * 액세스 토큰 조회
   */
  static getAccessToken(): string | null {
    try {
      return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    } catch (error) {
      logger.error('Failed to retrieve access token', error as Error);
      return null;
    }
  }

  /**
   * 리프레시 토큰 조회
   */
  static getRefreshToken(): string | null {
    try {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    } catch (error) {
      logger.error('Failed to retrieve refresh token', error as Error);
      return null;
    }
  }

  /**
   * JWT 토큰 디코딩
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwtDecode<JWTPayload>(token);
      if (!decoded) {
        logger.error('Failed to decode JWT token: Invalid token format');
        return null;
      }
      return decoded;
    } catch (error) {
      logger.error('Failed to decode JWT token', error as Error);
      return null;
    }
  }

  /**
   * 토큰 유효성 검사
   */
  static isTokenValid(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload) {
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > currentTime;
  }

  /**
   * 토큰 만료 시간 확인
   */
  static getTokenExpiration(token: string): Date | null {
    const payload = this.decodeToken(token);
    if (!payload) {
      return null;
    }

    return new Date(payload.exp * 1000);
  }

  /**
   * 사용자 정보 저장
   */
  static setUser(user: User): void {
    try {
      console.log('[TokenManager.setUser] Called with user:', user);
      console.log('[TokenManager.setUser] User type:', typeof user);
      console.log('[TokenManager.setUser] User is array?', Array.isArray(user));
      
      if (!user) {
        console.error('[TokenManager.setUser] User is null or undefined!');
        throw new Error('User object is null or undefined');
      }
      
      // Validate user object structure
      const userKeys = Object.keys(user);
      console.log('[TokenManager.setUser] User keys:', userKeys);
      
      // Check if user is wrapped in another object
      if (typeof user === 'object' && !user.id && Object.keys(user).length === 1) {
        const keys = Object.keys(user);
        console.warn('[TokenManager.setUser] User might be wrapped, keys:', keys);
        if (keys[0] === 'user' && (user as any).user) {
          console.warn('[TokenManager.setUser] Unwrapping nested user object');
          user = (user as any).user;
        }
      }
      
      // Detailed property validation
      console.log('[TokenManager.setUser] Validating user properties...');
      console.log('[TokenManager.setUser] user.id:', user.id);
      console.log('[TokenManager.setUser] user.id type:', typeof user.id);
      console.log('[TokenManager.setUser] user.username:', user.username);
      console.log('[TokenManager.setUser] user.email:', user.email);
      console.log('[TokenManager.setUser] user.roles:', user.roles);
      console.log('[TokenManager.setUser] user.roles length:', user.roles?.length);
      
      if (!user.id) {
        console.error('[TokenManager.setUser] User.id is missing!', user);
        console.error('[TokenManager.setUser] User keys:', Object.keys(user));
        console.error('[TokenManager.setUser] User JSON:', JSON.stringify(user, null, 2));
        throw new Error('User ID is missing');
      }
      
      if (!user.username) {
        console.error('[TokenManager.setUser] User.username is missing!', user);
        throw new Error('User username is missing');
      }
      
      if (!user.roles || !Array.isArray(user.roles)) {
        console.error('[TokenManager.setUser] User.roles is invalid!', user.roles);
        throw new Error('User roles is missing or not an array');
      }
      
      // Validate each role
      user.roles.forEach((role, index) => {
        if (!role || typeof role !== 'object') {
          console.error(`[TokenManager.setUser] Invalid role at index ${index}:`, role);
          throw new Error(`Invalid role structure at index ${index}`);
        }
        if (!role.id) {
          console.error(`[TokenManager.setUser] Role missing id at index ${index}:`, role);
          throw new Error(`Role missing id at index ${index}`);
        }
      });
      
      console.log('[TokenManager.setUser] All validations passed, storing user...');
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      logger.debug('User information stored', { userId: user.id, username: user.username });
    } catch (error) {
      console.error('[TokenManager.setUser] Error occurred:', error);
      console.error('[TokenManager.setUser] Error message:', (error as Error).message);
      console.error('[TokenManager.setUser] Error stack:', (error as Error).stack);
      logger.error('Failed to store user information', error as Error);
      throw error; // Re-throw to see where it's caught
    }
  }

  /**
   * 사용자 정보 조회
   */
  static getUser(): User | null {
    try {
      const userData = localStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      logger.error('Failed to retrieve user information', error as Error);
      return null;
    }
  }

  /**
   * 모든 인증 정보 삭제
   */
  static clearAll(): void {
    try {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      
      // API 클라이언트에서 토큰 제거
      apiClient.clearAuthToken();
      
      logger.debug('All authentication data cleared');
    } catch (error) {
      logger.error('Failed to clear authentication data', error as Error);
    }
  }

  /**
   * 토큰 자동 갱신
   */
  static async refreshTokenIfNeeded(): Promise<boolean> {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();

    if (!accessToken || !refreshToken) {
      return false;
    }

    // 토큰이 5분 이내에 만료되면 갱신
    const expirationTime = this.getTokenExpiration(accessToken);
    if (!expirationTime) {
      return false;
    }

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (expirationTime > fiveMinutesFromNow) {
      return true; // 갱신 불필요
    }

    try {
      const response = await apiClient.request('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });

      if (response.success && response.data) {
        const data = response.data as any;
        this.setTokens(data.accessToken, data.refreshToken);
        logger.info('Token refreshed successfully');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to refresh token', error as Error);
      this.clearAll();
      return false;
    }
  }
}

// ============ Authentication Service ============

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export class AuthService {
  /**
   * 로그인
   */
  static async login(credentials: LoginCredentials): Promise<User> {
    try {
      logger.info('Attempting login', { username: credentials.username });

      const response = await apiClient.request<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      console.log('[AuthService.login] API Response:', response);

      if (!response.success || !response.data) {
        throw new AuthenticationError(response.error || 'Login failed');
      }

      console.log('[AuthService.login] Response data:', response.data);
      console.log('[AuthService.login] Response data type:', typeof response.data);
      console.log('[AuthService.login] Response data keys:', Object.keys(response.data || {}));

      // Safely extract data with enhanced null checks
      const loginData = response.data;
      if (!loginData || typeof loginData !== 'object' || Array.isArray(loginData)) {
        console.error('[AuthService.login] Invalid response data structure:', loginData);
        throw new AuthenticationError('Invalid response data structure');
      }

      // Check for required properties before destructuring
      if (!('user' in loginData) || !('accessToken' in loginData)) {
        console.error('[AuthService.login] Missing required fields in response:', Object.keys(loginData));
        throw new AuthenticationError('Missing required fields in login response');
      }

      const { user: rawUser, accessToken, refreshToken } = loginData;

      console.log('[AuthService.login] Extracted raw user:', rawUser);
      console.log('[AuthService.login] Extracted accessToken:', accessToken);
      console.log('[AuthService.login] Extracted refreshToken:', refreshToken);

      if (!rawUser || typeof rawUser !== 'object' || Array.isArray(rawUser)) {
        console.error('[AuthService.login] User object is missing or invalid:', rawUser);
        throw new AuthenticationError('User data is missing from server response');
      }

      // Enhanced user validation with specific property checks
      if (!rawUser.hasOwnProperty('id') || !rawUser.id || typeof rawUser.id !== 'string' || rawUser.id.trim() === '') {
        console.error('[AuthService.login] User ID is missing or invalid:', rawUser);
        throw new AuthenticationError('User ID is missing or invalid in server response');
      }

      if (!rawUser.hasOwnProperty('username') || !rawUser.username || typeof rawUser.username !== 'string') {
        console.error('[AuthService.login] Username is missing or invalid:', rawUser);
        throw new AuthenticationError('Username is missing or invalid in server response');
      }

      if (!accessToken || typeof accessToken !== 'string' || accessToken.trim() === '') {
        console.error('[AuthService.login] Access token is missing or invalid');
        throw new AuthenticationError('Access token is missing or invalid from server response');
      }

      // Transform backend user format to frontend User interface
      console.log('[AuthService.login] Starting user transformation...');
      console.log('[AuthService.login] rawUser.roles:', rawUser.roles);
      console.log('[AuthService.login] rawUser.permissions:', (rawUser as any).permissions);
      
      // Enhanced safe role transformation with array validation
      let transformedRoles: any[] = [];
      try {
        // First validate that roles is an array
        if (!Array.isArray(rawUser.roles)) {
          console.warn('[AuthService.login] User roles is not an array, defaulting to empty array');
          rawUser.roles = [];
        }

        transformedRoles = rawUser.roles
          .filter((role, index) => {
            if (!role || typeof role !== 'object' || Array.isArray(role)) {
              console.warn(`[AuthService.login] Skipping invalid role at index ${index}:`, role);
              return false;
            }
            return true;
          })
          .map((role: any, index: number) => {
            console.log(`[AuthService.login] Processing role ${index}:`, role);
            
            // Use safe property access
            const roleId = role?.id;
            const roleName = role?.name || `Role${index}`;
            
            if (!roleId || typeof roleId !== 'string') {
              console.warn(`[AuthService.login] Role at index ${index} missing valid ID, using fallback`);
              return {
                id: `role_${index}_${Date.now()}`,
                name: roleName,
                permissions: [],
                description: `Generated role for ${roleName}`
              };
            }
            
            return {
              id: roleId,
              name: roleName,
              permissions: Array.isArray((rawUser as any).permissions) ? 
                (rawUser as any).permissions.map((perm: string) => ({
                  resource: '*',
                  actions: perm === '*' ? ['*'] : [perm]
                })) : [],
              description: role.description || `${roleName} role`
            };
          });
        console.log('[AuthService.login] Roles transformed successfully:', transformedRoles);
      } catch (roleError) {
        console.error('[AuthService.login] Role transformation error:', roleError);
        // Use fallback roles instead of throwing error
        transformedRoles = [{
          id: 'user',
          name: 'User',
          permissions: [],
          description: 'Default user role'
        }];
        console.log('[AuthService.login] Using fallback roles:', transformedRoles);
      }

      // Create user object with safe property access and defaults
      const user: User = {
        id: rawUser.id, // Already validated above
        username: rawUser.username, // Already validated above
        email: rawUser.email || `${rawUser.username}@localhost`, // Provide fallback
        roles: transformedRoles,
        lastLogin: (rawUser as any).lastLogin || new Date().toISOString(),
        isActive: (rawUser as any).isActive !== undefined ? (rawUser as any).isActive : true,
        preferences: (rawUser as any).preferences || {
          theme: 'auto' as const,
          language: 'en',
          timezone: 'UTC',
          notificationSettings: {
            email: true,
            browser: true,
            alertLevels: ['warn', 'error', 'critical'] as const
          }
        }
      };

      console.log('[AuthService.login] Transformed user for frontend:', user);

      // Final user object validation before storage
      console.log('[AuthService.login] FINAL USER VALIDATION BEFORE setUser:');
      console.log('[AuthService.login] user:', user);
      console.log('[AuthService.login] user.id:', user.id);
      console.log('[AuthService.login] user type:', typeof user);
      
      // Critical validation - ensure user object is complete
      if (!user || typeof user !== 'object' || !user.id || !user.username) {
        console.error('[AuthService.login] CRITICAL: Final user object is invalid!', user);
        throw new AuthenticationError('Failed to create valid user object');
      }

      // 토큰 및 사용자 정보 저장
      TokenManager.setTokens(accessToken, refreshToken);
      console.log('[AuthService.login] user is null/undefined:', user == null);
      console.log('[AuthService.login] user has id property:', 'id' in user);
      console.log('[AuthService.login] user.id is truthy:', !!user.id);
      
      // Safe user storage with enhanced error handling
      try {
        console.log('[AuthService.login] Attempting to store user:', JSON.stringify(user, null, 2));
        
        // Create a deep clone to prevent reference issues
        const userClone = JSON.parse(JSON.stringify(user));
        console.log('[AuthService.login] User clone created:', userClone);
        
        TokenManager.setUser(userClone);
        console.log('[AuthService.login] User stored successfully in TokenManager');
        
      } catch (setUserError) {
        console.error('[AuthService.login] CRITICAL: Failed to store user in TokenManager:', setUserError);
        console.error('[AuthService.login] User object that failed to store:', user);
        throw new AuthenticationError(`Failed to store user data: ${setUserError instanceof Error ? setUserError.message : String(setUserError)}`);
      }

      logger.info('Login successful', { userId: user.id, username: user.username });
      return user;
    } catch (error) {
      logger.error('Login failed', error as Error, { username: credentials.username });
      
      // Log the full error for debugging
      console.error('[AuthService.login] Full error:', error);
      if (error instanceof Error) {
        console.error('[AuthService.login] Error stack:', error.stack);
      }
      
      throw ErrorHandler.handle(error, { endpoint: '/api/auth/login' });
    }
  }

  /**
   * 로그아웃
   */
  static async logout(): Promise<void> {
    try {
      const refreshToken = TokenManager.getRefreshToken();
      
      if (refreshToken) {
        // 서버에 로그아웃 요청 (옵션)
        await apiClient.request('/api/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }

      TokenManager.clearAll();
      logger.info('Logout successful');
    } catch (error) {
      logger.error('Logout error', error as Error);
      // 로그아웃 실패해도 로컬 데이터는 삭제
      TokenManager.clearAll();
    }
  }

  /**
   * 현재 사용자 조회
   */
  static getCurrentUser(): User | null {
    const accessToken = TokenManager.getAccessToken();
    if (!accessToken || !TokenManager.isTokenValid(accessToken)) {
      return null;
    }

    return TokenManager.getUser();
  }

  /**
   * 인증 상태 확인
   */
  static isAuthenticated(): boolean {
    const accessToken = TokenManager.getAccessToken();
    return accessToken !== null && TokenManager.isTokenValid(accessToken);
  }

  /**
   * 계정 잠금 해제 요청
   */
  static async requestPasswordReset(email: string): Promise<void> {
    try {
      const response = await apiClient.request('/api/auth/password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (!response.success) {
        throw new Error(response.error || 'Password reset request failed');
      }

      logger.info('Password reset requested', { email });
    } catch (error) {
      logger.error('Password reset request failed', error as Error);
      throw ErrorHandler.handle(error);
    }
  }
}

// ============ Authorization & Permissions ============

export { PermissionService } from './permissions';

// ============ Security Utilities ============

export class SecurityUtils {
  /**
   * 문자열 XSS 방지
   */
  static sanitizeHtml(input: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };

    return input.replace(/[&<>"'/]/g, s => map[s]);
  }

  /**
   * SQL 인젝션 방지 (기본적인 검증)
   */
  static validateInput(input: string): boolean {
    const dangerousPatterns = [
      /('|(\\')|(;|\\;)|(--))/, // SQL injection patterns
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /javascript:/gi, // JavaScript protocol
      /on\w+\s*=/gi, // Event handlers
    ];

    return !dangerousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * 비밀번호 강도 검사
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length < 8) {
      feedback.push('비밀번호는 최소 8자 이상이어야 합니다.');
    } else {
      score += 1;
    }

    if (!/[a-z]/.test(password)) {
      feedback.push('소문자를 포함해야 합니다.');
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('대문자를 포함해야 합니다.');
    } else {
      score += 1;
    }

    if (!/\d/.test(password)) {
      feedback.push('숫자를 포함해야 합니다.');
    } else {
      score += 1;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      feedback.push('특수문자를 포함해야 합니다.');
    } else {
      score += 1;
    }

    return {
      isValid: score >= 4,
      score,
      feedback
    };
  }

  /**
   * 난수 문자열 생성
   */
  static generateRandomString(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      result += charset[array[i] % charset.length];
    }
    
    return result;
  }

  /**
   * UUID 생성
   */
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * CSRF 토큰 생성
   */
  static generateCSRFToken(): string {
    return this.generateRandomString(32);
  }

  /**
   * 해시 생성 (브라우저 환경)
   */
  static async hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 이메일 형식 검증
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * URL 형식 검증
   */
  static validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// ============ High-Order Components & Hooks ============

/**
 * 권한 확인 고차 함수
 */
export function requireAuth<T extends any[]>(
  fn: (...args: T) => any,
  requiredPermissions?: Array<{ resource: string; action: string }>
) {
  return (...args: T) => {
    if (!AuthService.isAuthenticated()) {
      throw new AuthenticationError('Authentication required');
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const user = AuthService.getCurrentUser();
      if (!user || !PermissionServiceClass.hasAllPermissions(user, requiredPermissions)) {
        throw new AuthorizationError('Insufficient permissions');
      }
    }

    return fn(...args);
  };
}

/**
 * 역할 확인 고차 함수
 */
export function requireRole<T extends any[]>(
  fn: (...args: T) => any,
  requiredRoles: string[]
) {
  return (...args: T) => {
    if (!AuthService.isAuthenticated()) {
      throw new AuthenticationError('Authentication required');
    }

    const user = AuthService.getCurrentUser();
    if (!user) {
      throw new AuthorizationError('User not found');
    }
    
    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.some(role => 
      user.roles.some(userRole => userRole.id === role)
    );
    if (!hasRequiredRole) {
      throw new AuthorizationError('Insufficient role permissions');
    }

    return fn(...args);
  };
}

// ============ Auto Token Refresh ============

// 자동 토큰 갱신 설정
let tokenRefreshInterval: NodeJS.Timeout | null = null;

export function startAutoTokenRefresh(intervalMs: number = 4 * 60 * 1000): void {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
  }

  tokenRefreshInterval = setInterval(async () => {
    if (AuthService.isAuthenticated()) {
      try {
        await TokenManager.refreshTokenIfNeeded();
      } catch (error) {
        logger.error('Auto token refresh failed', error as Error);
      }
    }
  }, intervalMs);
}

export function stopAutoTokenRefresh(): void {
  if (tokenRefreshInterval) {
    clearInterval(tokenRefreshInterval);
    tokenRefreshInterval = null;
  }
}

// 페이지 로드 시 자동 갱신 시작
if (typeof window !== 'undefined') {
  startAutoTokenRefresh();
  
  // 페이지 언로드 시 정리
  window.addEventListener('beforeunload', () => {
    stopAutoTokenRefresh();
  });
}