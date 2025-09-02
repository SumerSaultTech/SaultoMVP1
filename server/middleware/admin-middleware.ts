import type { Request, Response, NextFunction } from 'express';
import { rbacService, PERMISSIONS } from '../services/rbac-service';

/**
 * Middleware to ensure user is an admin (has admin panel access)
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.session as any)?.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Check if user has admin panel permission
    const hasAdminAccess = await rbacService.hasPermission(userId, PERMISSIONS.ADMIN_PANEL);
    
    if (!hasAdminAccess) {
      // Log unauthorized admin access attempt
      await rbacService.logAction({
        userId,
        action: 'admin.access.denied',
        details: { route: req.path, method: req.method },
        req,
      });

      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    // Log admin access for audit
    await rbacService.logAction({
      userId,
      action: 'admin.access',
      resource: `route:${req.path}`,
      details: { method: req.method },
      req,
    });

    next();
  } catch (error) {
    console.error('❌ Admin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Admin access check failed'
    });
  }
}

/**
 * Middleware to log all admin actions
 */
export function auditAdminAction(action: string, resourceType?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.session as any)?.user?.id;
      const companyId = (req.session as any)?.selectedCompany?.id;
      
      if (userId) {
        let resource = resourceType;
        if (req.params.id) {
          resource = `${resourceType}:${req.params.id}`;
        }

        await rbacService.logAction({
          userId,
          action,
          resource,
          details: {
            method: req.method,
            path: req.path,
            params: req.params,
            body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined,
          },
          req,
          companyId,
        });
      }
      
      next();
    } catch (error) {
      console.error('❌ Audit middleware error:', error);
      next(); // Continue even if audit fails
    }
  };
}