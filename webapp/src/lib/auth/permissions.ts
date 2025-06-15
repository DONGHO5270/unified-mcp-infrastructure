/**
 * Enhanced Permission Management System
 * Phase 3 - 권한 관리 시스템 강화
 */

import { User, Role, Permission } from '../../types';
import { useAuthStore } from '../../stores';

// Permission definitions
export const PERMISSIONS = {
  // Service permissions
  SERVICE_VIEW: 'service:view',
  SERVICE_CREATE: 'service:create',
  SERVICE_UPDATE: 'service:update',
  SERVICE_DELETE: 'service:delete',
  SERVICE_RESTART: 'service:restart',
  SERVICE_DEPLOY: 'service:deploy',
  SERVICE_SCALE: 'service:scale',
  
  // Tool permissions
  TOOL_LIST: 'tool:list',
  TOOL_EXECUTE: 'tool:execute',
  TOOL_EXECUTE_DANGEROUS: 'tool:execute:dangerous',
  
  // Log permissions
  LOG_VIEW: 'log:view',
  LOG_STREAM: 'log:stream',
  LOG_EXPORT: 'log:export',
  
  // Metrics permissions
  METRICS_VIEW: 'metrics:view',
  METRICS_EXPORT: 'metrics:export',
  
  // System permissions
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',
  
  // User management
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  
  // Role management
  ROLE_VIEW: 'role:view',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete'
} as const;

// Role definitions
export const ROLES: Record<string, Role> = {
  ADMIN: {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access',
    permissions: Object.values(PERMISSIONS).map(resource => ({
      resource,
      actions: ['*'],
      conditions: {}
    }))
  },
  
  DEVELOPER: {
    id: 'developer',
    name: 'Developer',
    description: 'Development and debugging access',
    permissions: [
      { resource: PERMISSIONS.SERVICE_VIEW, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.SERVICE_UPDATE, actions: ['write'], conditions: {} },
      { resource: PERMISSIONS.SERVICE_RESTART, actions: ['execute'], conditions: {} },
      { resource: PERMISSIONS.TOOL_LIST, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.TOOL_EXECUTE, actions: ['execute'], conditions: {} },
      { resource: PERMISSIONS.LOG_VIEW, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.LOG_STREAM, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.METRICS_VIEW, actions: ['read'], conditions: {} }
    ]
  },
  
  OPERATOR: {
    id: 'operator',
    name: 'Operator',
    description: 'Service operation access',
    permissions: [
      { resource: PERMISSIONS.SERVICE_VIEW, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.SERVICE_RESTART, actions: ['execute'], conditions: {} },
      { resource: PERMISSIONS.LOG_VIEW, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.LOG_STREAM, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.METRICS_VIEW, actions: ['read'], conditions: {} }
    ]
  },
  
  VIEWER: {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      { resource: PERMISSIONS.SERVICE_VIEW, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.TOOL_LIST, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.LOG_VIEW, actions: ['read'], conditions: {} },
      { resource: PERMISSIONS.METRICS_VIEW, actions: ['read'], conditions: {} }
    ]
  }
};

// Permission checking functions
export class PermissionService {
  /**
   * Check if user has permission
   */
  static hasPermission(
    user: User | null,
    resource: string,
    action: string = 'read',
    conditions?: Record<string, any>
  ): boolean {
    if (!user) return false;
    
    // Check each role
    for (const role of user.roles) {
      // Check each permission in role
      for (const permission of role.permissions) {
        if (this.matchesPermission(permission, resource, action, conditions)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Check if user has any of the permissions
   */
  static hasAnyPermission(
    user: User | null,
    permissions: Array<{ resource: string; action?: string }>
  ): boolean {
    if (!user) return false;
    
    return permissions.some(p => 
      this.hasPermission(user, p.resource, p.action || 'read')
    );
  }
  
  /**
   * Check if user has all permissions
   */
  static hasAllPermissions(
    user: User | null,
    permissions: Array<{ resource: string; action?: string }>
  ): boolean {
    if (!user) return false;
    
    return permissions.every(p => 
      this.hasPermission(user, p.resource, p.action || 'read')
    );
  }
  
  /**
   * Get user's effective permissions
   */
  static getUserPermissions(user: User | null): Permission[] {
    if (!user) return [];
    
    const permissions: Permission[] = [];
    const seen = new Set<string>();
    
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        const key = `${permission.resource}:${permission.actions.join(',')}`;
        if (!seen.has(key)) {
          seen.add(key);
          permissions.push(permission);
        }
      }
    }
    
    return permissions;
  }
  
  /**
   * Check if permission matches
   */
  private static matchesPermission(
    permission: Permission,
    resource: string,
    action: string,
    conditions?: Record<string, any>
  ): boolean {
    // Check resource match
    if (permission.resource !== resource && permission.resource !== '*') {
      return false;
    }
    
    // Check action match
    if (!permission.actions.includes(action) && !permission.actions.includes('*')) {
      return false;
    }
    
    // Check conditions
    if (permission.conditions && conditions) {
      for (const [key, value] of Object.entries(permission.conditions)) {
        if (conditions[key] !== value) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Filter services by user permissions
   */
  static filterServicesByPermission(
    services: any[],
    user: User | null,
    permission: string = PERMISSIONS.SERVICE_VIEW
  ): any[] {
    if (!user) return [];
    
    // Admin sees all
    if (this.hasPermission(user, '*', '*')) {
      return services;
    }
    
    // Filter based on permissions
    return services.filter(service => {
      // Check if user has permission for this specific service
      return this.hasPermission(user, permission, 'read', { serviceId: service.id });
    });
  }
  
  /**
   * Check if action requires CLI
   */
  static requiresCLI(action: string): boolean {
    const cliOnlyActions = [
      'restart',
      'deploy',
      'scale',
      'delete',
      'backup',
      'restore',
      'config'
    ];
    
    return cliOnlyActions.includes(action);
  }
  
  /**
   * Get CLI command for action
   */
  static getCLICommand(action: string, serviceId?: string, args?: any): string {
    switch (action) {
      case 'restart':
        return `mcp-cli call ${serviceId} restart`;
      case 'deploy':
        return `mcp-cli call ${serviceId} deploy --version=${args?.version || 'latest'}`;
      case 'scale':
        return `mcp-cli call ${serviceId} scale --replicas=${args?.replicas || 1}`;
      case 'backup':
        return `mcp-cli backup ${serviceId}`;
      case 'restore':
        return `mcp-cli restore ${serviceId} --backup=${args?.backupId}`;
      default:
        return `mcp-cli ${action} ${serviceId || ''}`;
    }
  }
}


export function usePermission(
  resource: string,
  action: string = 'read',
  conditions?: Record<string, any>
): boolean {
  const { user } = useAuthStore();
  return PermissionService.hasPermission(user, resource, action, conditions);
}

export function usePermissions(): {
  hasPermission: (resource: string, action?: string) => boolean;
  hasAnyPermission: (permissions: Array<{ resource: string; action?: string }>) => boolean;
  hasAllPermissions: (permissions: Array<{ resource: string; action?: string }>) => boolean;
  requiresCLI: (action: string) => boolean;
  getCLICommand: (action: string, serviceId?: string, args?: any) => string;
} {
  const { user } = useAuthStore();
  
  return {
    hasPermission: (resource: string, action = 'read') => 
      PermissionService.hasPermission(user, resource, action),
    hasAnyPermission: (permissions) => 
      PermissionService.hasAnyPermission(user, permissions),
    hasAllPermissions: (permissions) => 
      PermissionService.hasAllPermissions(user, permissions),
    requiresCLI: PermissionService.requiresCLI,
    getCLICommand: PermissionService.getCLICommand
  };
}