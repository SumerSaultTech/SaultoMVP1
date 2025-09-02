import type { Request, Response, NextFunction } from 'express';
import { validateTenantSchema } from '../services/tenant-query-builder';
import { storage } from '../storage';

// Extend Request type to include validated company info
declare global {
  namespace Express {
    interface Request {
      validatedCompany?: {
        id: number;
        name: string;
        hasValidSchema: boolean;
      };
    }
  }
}

/**
 * Middleware to validate tenant access and ensure schema exists
 * Must be used after session middleware
 */
export async function validateTenantAccess(req: Request, res: Response, next: NextFunction) {
  try {
    // Skip validation for non-tenant routes
    const path = req.path;
    console.log(`🔍 Middleware checking path: ${path}, Method: ${req.method}`);
    console.log(`🔍 Path length: ${path.length}, First 10 chars: "${path.substring(0, 10)}"`);
    console.log(`🔍 Starts with '/auth': ${path.startsWith('/auth')}`);
    
    if (path.startsWith('/auth') ||
        path.startsWith('/health') || 
        path.startsWith('/companies') ||
        path === '/setup-status') {
      console.log(`✅ Skipping tenant validation for: ${path}`);
      return next();
    }

    // Check if session exists and has selected company
    if (!req.session?.selectedCompany?.id) {
      return res.status(401).json({
        success: false,
        error: 'No company selected. Please select a company first.',
        requiresCompanySelection: true
      });
    }

    const companyId = req.session.selectedCompany.id;
    
    // Validate company exists in database
    const company = await storage.getCompany(companyId);
    if (!company) {
      return res.status(404).json({
        success: false,
        error: `Company with ID ${companyId} not found`,
        requiresCompanySelection: true
      });
    }

    // For routes that need analytics data, validate schema exists
    const requiresAnalyticsSchema = (
      path.startsWith('/api/postgres') ||
      path.startsWith('/api/metrics') ||
      path.startsWith('/api/dashboard') ||
      path.includes('metric-registry') ||
      path.includes('goals')
    );

    let hasValidSchema = true;
    if (requiresAnalyticsSchema) {
      const dbStorage = storage as any;
      if (dbStorage.sql) {
        hasValidSchema = await validateTenantSchema(dbStorage.sql, companyId);
        
        if (!hasValidSchema) {
          return res.status(400).json({
            success: false,
            error: `Analytics schema not found for company ${companyId}. Please ensure the company is properly set up.`,
            requiresSetup: true
          });
        }
      }
    }

    // Attach validated company info to request
    req.validatedCompany = {
      id: company.id,
      name: company.name,
      hasValidSchema
    };

    console.log(`✅ Tenant validation passed for company ${company.id} (${company.name}) - Schema valid: ${hasValidSchema}`);
    next();
  } catch (error) {
    console.error('❌ Tenant validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate tenant access',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Middleware specifically for company-scoped API routes
 * Extracts companyId from route params and validates access
 */
export async function validateCompanyParam(req: Request, res: Response, next: NextFunction) {
  try {
    const companyId = parseInt(req.params.companyId);
    
    if (isNaN(companyId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid company ID parameter'
      });
    }

    // Check if user has access to this company
    if (!req.session?.selectedCompany || req.session.selectedCompany.id !== companyId) {
      return res.status(403).json({
        success: false,
        error: `Access denied to company ${companyId}. Please select this company first.`
      });
    }

    next();
  } catch (error) {
    console.error('❌ Company parameter validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate company parameter'
    });
  }
}

/**
 * Helper function to get validated company ID from request
 * Should only be called after validateTenantAccess middleware
 */
export function getValidatedCompanyId(req: Request): number {
  if (!req.validatedCompany?.id) {
    throw new Error('Company not validated. Ensure validateTenantAccess middleware is used.');
  }
  return req.validatedCompany.id;
}

/**
 * Helper function to safely extract company ID from session
 */
export function getSessionCompanyId(req: Request): number | null {
  return req.session?.selectedCompany?.id || null;
}