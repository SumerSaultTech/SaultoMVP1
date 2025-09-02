import { permissions, rolePermissions, auditLogs, users, type Permission, type AuditLog, type InsertAuditLog } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import type { Request } from "express";

// Define permission constants
export const PERMISSIONS = {
  // Company management
  COMPANIES_READ: 'companies:read',
  COMPANIES_WRITE: 'companies:write',
  COMPANIES_DELETE: 'companies:delete',
  
  // User management
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  USERS_IMPERSONATE: 'users:impersonate',
  
  // Admin actions
  ADMIN_PANEL: 'admin:panel',
  ADMIN_SETTINGS: 'admin:settings',
  
  // Audit logs
  AUDIT_READ: 'audit:read',
  
  // Data access
  DATA_READ: 'data:read',
  DATA_WRITE: 'data:write',
  DATA_DELETE: 'data:delete',
} as const;

// Default permissions for each role
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: [
    PERMISSIONS.COMPANIES_READ,
    PERMISSIONS.COMPANIES_WRITE,
    PERMISSIONS.COMPANIES_DELETE,
    PERMISSIONS.USERS_READ,
    PERMISSIONS.USERS_WRITE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_IMPERSONATE,
    PERMISSIONS.ADMIN_PANEL,
    PERMISSIONS.ADMIN_SETTINGS,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.DATA_READ,
    PERMISSIONS.DATA_WRITE,
    PERMISSIONS.DATA_DELETE,
  ],
  user: [
    PERMISSIONS.DATA_READ,
    PERMISSIONS.DATA_WRITE,
  ],
  viewer: [
    PERMISSIONS.DATA_READ,
  ],
};

export class RBACService {
  constructor(private db: any) {}

  /**
   * Initialize default permissions and role mappings
   */
  async initializePermissions(): Promise<void> {
    try {
      console.log('🔧 Initializing RBAC permissions...');
      
      // Create permissions if they don't exist
      const permissionList = Object.values(PERMISSIONS).map(permission => ({
        name: permission,
        description: `Permission for ${permission}`,
        category: permission.split(':')[0],
      }));

      for (const perm of permissionList) {
        try {
          await this.db.insert(permissions).values(perm).onConflictDoNothing();
        } catch (error) {
          // Permission might already exist
        }
      }

      // Set up role-permission mappings
      for (const [role, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        for (const permName of perms) {
          try {
            const [permission] = await this.db.select().from(permissions).where(eq(permissions.name, permName));
            if (permission) {
              await this.db.insert(rolePermissions).values({
                role,
                permissionId: permission.id,
              }).onConflictDoNothing();
            }
          } catch (error) {
            // Mapping might already exist
          }
        }
      }

      console.log('✅ RBAC permissions initialized');
    } catch (error) {
      console.error('❌ Failed to initialize permissions:', error);
    }
  }

  /**
   * Get user permissions based on their role
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.id, userId));
      if (!user) return [];

      // Get permissions from user's role
      const rolePerms = await this.db
        .select({ name: permissions.name })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.role, user.role));

      // Also get direct user permissions (if any)
      const directPerms = user.permissions as string[] || [];

      const allPermissions = [...rolePerms.map(p => p.name), ...directPerms];
      return [...new Set(allPermissions)]; // Remove duplicates
    } catch (error) {
      console.error('❌ Failed to get user permissions:', error);
      return [];
    }
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: number, permission: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return userPermissions.includes(permission);
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId: number, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some(perm => userPermissions.includes(perm));
  }

  /**
   * Log admin action for audit trail
   */
  async logAction(params: {
    userId: number;
    action: string;
    resource?: string;
    details?: any;
    req?: Request;
    companyId?: number;
  }): Promise<void> {
    try {
      const auditEntry: InsertAuditLog = {
        userId: params.userId,
        action: params.action,
        resource: params.resource,
        details: params.details || null,
        ipAddress: params.req?.ip || null,
        userAgent: params.req?.get('User-Agent') || null,
        sessionId: params.req?.sessionID || null,
        companyId: params.companyId || null,
      };

      await this.db.insert(auditLogs).values(auditEntry);
      console.log(`📋 Audit logged: ${params.action} by user ${params.userId}`);
    } catch (error) {
      console.error('❌ Failed to log audit action:', error);
    }
  }

  /**
   * Get audit logs with optional filtering
   */
  async getAuditLogs(options: {
    userId?: number;
    companyId?: number;
    action?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<AuditLog[]> {
    try {
      let query = this.db.select().from(auditLogs);
      
      // Apply filters
      if (options.userId) {
        query = query.where(eq(auditLogs.userId, options.userId));
      }
      if (options.companyId) {
        query = query.where(eq(auditLogs.companyId, options.companyId));
      }
      if (options.action) {
        query = query.where(eq(auditLogs.action, options.action));
      }

      // Apply pagination
      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.offset(options.offset);
      }

      return await query.orderBy(auditLogs.createdAt);
    } catch (error) {
      console.error('❌ Failed to get audit logs:', error);
      return [];
    }
  }

  /**
   * Middleware to check permission before allowing access to routes
   */
  checkPermission(requiredPermission: string) {
    return async (req: any, res: any, next: any) => {
      try {
        const userId = req.session?.user?.id;
        if (!userId) {
          return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const hasPermission = await this.hasPermission(userId, requiredPermission);
        if (!hasPermission) {
          // Log unauthorized access attempt
          await this.logAction({
            userId,
            action: 'access.denied',
            resource: `permission:${requiredPermission}`,
            details: { route: req.path, method: req.method },
            req,
          });

          return res.status(403).json({ 
            success: false, 
            error: `Insufficient permissions. Required: ${requiredPermission}` 
          });
        }

        next();
      } catch (error) {
        console.error('❌ Permission check failed:', error);
        res.status(500).json({ success: false, error: 'Permission check failed' });
      }
    };
  }
}

// Create singleton instance
export const rbacService = new RBACService(null); // Will be initialized with db instance