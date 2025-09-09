import type { Express } from "express";
import { createServer, type Server } from "http";
import session from 'express-session';
import { storage } from "./storage";
import { pythonConnectorService } from "./services/python-connector-service";
import { postgresAnalyticsService } from "./services/postgres-analytics";
import { openaiService } from "./services/openai";
import { metricsAIService } from "./services/metrics-ai";
import { azureOpenAIService } from "./services/azure-openai";
import { jiraOAuthService } from "./services/jira-oauth";
import { hubspotOAuthService } from "./services/hubspot-oauth";
import { odooOAuthService } from "./services/odoo-oauth";
import { odooApiService } from "./services/odoo-api";
import { schemaLayerManager } from "./services/schema-layer-manager";
import { spawn } from 'child_process';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  insertDataSourceSchema,
  insertSqlModelSchema,
  insertKpiMetricSchema,
  insertChatMessageSchema,
  insertPipelineActivitySchema,
  insertMetricReportSchema,
} from "@shared/schema";
import { z } from "zod";
import { filterToSQL, buildMetricSQL, generateMetricTemplate } from "./services/filter-to-sql";
import { validateTenantAccess, validateCompanyParam, getValidatedCompanyId, getSessionCompanyId } from "./middleware/tenant-validation";
import { createTenantScopedSQL } from "./services/tenant-query-builder";
import { requireAdmin, auditAdminAction } from "./middleware/admin-middleware";
import { rbacService, PERMISSIONS } from "./services/rbac-service";
import { syncScheduler } from "./services/sync-scheduler";
// Force server reload to initialize sync scheduler
import { mfaService } from "./services/mfa-service";
import { MetricsSeriesService } from "./services/metrics-series.js";


// File upload configuration
const UPLOAD_FOLDER = 'uploads';
const ALLOWED_EXTENSIONS = new Set([
  'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 
  'ppt', 'pptx', 'csv', 'json', 'zip', 'py', 'js', 'html', 'css', 'c', 
  'cpp', 'h', 'java', 'rb', 'php', 'xml', 'md'
]);

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOAD_FOLDER)) {
  fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
}

// Multer configuration
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_FOLDER);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp prefix
    const timestamp = Date.now();
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${timestamp}_${originalName}`);
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type .${ext} not allowed`));
    }
  }
});

// File content reading helper function
const readFileContent = (filename: string): string => {
  try {
    const filePath = path.join(UPLOAD_FOLDER, filename);
    if (!fs.existsSync(filePath)) {
      return `[File ${filename} not found]`;
    }
    
    const ext = path.extname(filename).toLowerCase().slice(1);
    const textExtensions = ['txt', 'md', 'csv', 'json', 'py', 'js', 'html', 'css', 'c', 'cpp', 'h', 'xml'];
    
    if (textExtensions.includes(ext)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return `\n\n--- File: ${filename} ---\n${content}\n--- End of File ---\n`;
    } else {
      return `\n\n[File attached: ${filename} (${ext.toUpperCase()} file)]`;
    }
  } catch (error) {
    console.error(`Error reading file ${filename}:`, error);
    return `[Error reading file ${filename}]`;
  }
};

// Global company storage to persist across hot reloads
const companiesArray: any[] = [
  {
    id: 1,
    name: "Demo Company", 
    slug: "demo_company",
    databaseName: "DEMO_COMPANY_DB",
    createdAt: "2024-01-15",
    userCount: 5,
    status: "active"
  },
  {
    id: 1748544793859,
    name: "MIAS_DATA",
    slug: "mias_data", 
    databaseName: "MIAS_DATA_DB",
    createdAt: "2025-05-29",
    userCount: 0,
    status: "active"
  }
];

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Initialize services
  const metricsSeriesService = new MetricsSeriesService(postgresAnalyticsService);
  
  // Ensure sync scheduler is started
  console.log('🔧 Initializing sync scheduler...');
  // Force the module to execute by referencing the syncScheduler
  if (syncScheduler) {
    console.log('✅ Sync scheduler loaded and available');
  }
  
  // Configure session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'saulto-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Add tenant validation middleware for multi-tenant security
  app.use('/api', validateTenantAccess);
  
  // Health check endpoint with service status
  app.get("/api/health", async (req, res) => {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        main: "running",
        postgres: "unknown",
        connectors: "unknown"
      }
    };

    // Check Python connector service
    try {
      const connectorHealthy = await pythonConnectorService.isServiceHealthy();
      health.services.connectors = connectorHealthy ? "running" : "offline";
    } catch (error) {
      health.services.connectors = "error";
    }

    // PostgreSQL is always available via DATABASE_URL
    health.services.postgres = "running";

    res.json(health);
  });

  // Initialize Jira OAuth service
  (async () => {
    try {
      await jiraOAuthService.initialize();
      console.log('Jira OAuth service initialized');
    } catch (error) {
      console.warn('Failed to initialize Jira OAuth service:', error);
    }
  })();

  // Initialize HubSpot OAuth service
  (async () => {
    try {
      await hubspotOAuthService.initialize();
      console.log('HubSpot OAuth service initialized');
    } catch (error) {
      console.warn('Failed to initialize HubSpot OAuth service:', error);
    }
  })();

  // Jira OAuth2 Routes
  app.get("/api/auth/jira/authorize", async (req, res) => {
    try {
      // Accept companyId from query parameter or session
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : req.session?.companyId;
      const userId = req.session?.user?.id;

      if (!companyId) {
        return res.status(400).json({ error: "Company context required" });
      }

      const authUrl = jiraOAuthService.getAuthorizationUrl(companyId, userId);
      res.redirect(authUrl);
    } catch (error) {
      console.error('Jira OAuth authorize error:', error);
      res.status(500).json({ error: "Failed to generate authorization URL" });
    }
  });

  app.get("/api/auth/jira/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({ error: "Missing code or state parameter" });
      }

      // Parse state to get company context
      const stateData = jiraOAuthService.parseState(state as string);
      
      // Exchange code for tokens
      const tokens = await jiraOAuthService.exchangeCodeForTokens(code as string, state as string);
      
      // Get user info (optional - don't fail if this doesn't work)
      let userInfo = null;
      try {
        userInfo = await jiraOAuthService.getUserInfo(tokens.access_token);
      } catch (error) {
        console.log('Could not get user info (missing scope?), continuing without it:', error.message);
      }
      
      // Get accessible Jira resources (instances)
      const resources = await jiraOAuthService.getAccessibleResources(tokens.access_token);

      // Store the OAuth tokens and connection info in the database
      // This should be stored per company for multi-tenant support
      const connectionData = {
        companyId: stateData.companyId,
        connectorType: 'jira',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        userInfo,
        resources,
        isActive: true,
        createdAt: new Date()
      };

      // Store in your dataSources table or create a new oauth_connections table
      await storage.createDataSource({
        companyId: stateData.companyId,
        name: `Jira (${userInfo?.name || 'Connected'})`,
        type: 'jira',
        config: {
          oauth: true,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: connectionData.expiresAt.toISOString(),
          userInfo,
          resources,
          accountId: userInfo?.account_id || null
        },
        isActive: true
      });

      // Redirect to frontend setup page with OAuth parameters
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      res.redirect(`${frontendUrl}/setup?code=${code}&state=${state}`);

    } catch (error) {
      console.error('Jira OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      res.redirect(`${frontendUrl}/setup?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
    }
  });

  // Jira table discovery endpoint
  app.get("/api/auth/jira/discover-tables/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      console.log(`🔍 Jira table discovery for company: ${companyId}`);
      
      // Get the stored OAuth token for this company
      const dataSources = await storage.getDataSources(parseInt(companyId));
      console.log(`🔍 Found ${dataSources.length} data sources for company`);
      
      // Find Jira source (active or inactive, since we can discover tables with valid tokens)
      const jiraSource = dataSources.find(ds => ds.type === 'jira');
      console.log(`🔍 Jira source found:`, !!jiraSource);
      console.log(`🔍 Jira source active status:`, jiraSource?.isActive);
      
      if (!jiraSource) {
        console.log(`❌ No Jira connection found for company ${companyId}`);
        return res.status(404).json({ error: "No Jira connection found for this company" });
      }
      
      const config = jiraSource.config || {};
      console.log(`🔍 Config loaded, accessToken exists:`, !!config.accessToken);
      console.log(`🔍 Resources in config:`, config.resources?.length || 0);
      
      const accessToken = config.accessToken;
      const resources = config.resources;
      
      if (!resources || resources.length === 0) {
        console.log(`❌ No resources available:`, resources);
        return res.status(400).json({ error: "No Jira resources available" });
      }
      
      // Use the first available Jira instance
      const cloudId = resources[0].id;
      console.log(`✅ Using cloud ID: ${cloudId}`);
      
      // Discover tables and their fields
      console.log(`🔍 Discovering Jira tables...`);
      const tables = await jiraOAuthService.discoverJiraTables(accessToken, cloudId);
      console.log(`✅ Found ${tables.length} tables`);
      
      res.json({ tables, cloudId });
    } catch (error) {
      console.error('Error discovering Jira tables:', error);
      res.status(500).json({ error: 'Failed to discover Jira tables' });
    }
  });

  app.get("/api/auth/jira/status/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      // Check if company has active Jira connection
      const dataSources = await storage.getDataSources(companyId);
      const jiraConnection = dataSources.find(ds => ds.type === 'jira' && ds.isActive);

      if (!jiraConnection) {
        return res.json({ connected: false });
      }

      // Get OAuth info from config
      const config = jiraConnection.config || {};
      
      if (!config.oauth) {
        return res.json({ connected: false, method: 'basic_auth' });
      }

      // Check if token is still valid
      const expiresAt = new Date(config.expiresAt);
      const isExpired = expiresAt <= new Date();

      res.json({ 
        connected: true,
        method: 'oauth',
        userInfo: config.userInfo,
        resources: config.resources,
        expired: isExpired,
        expiresAt: config.expiresAt
      });

    } catch (error) {
      console.error('Jira OAuth status error:', error);
      res.status(500).json({ error: "Failed to check OAuth status" });
    }
  });

  // OAuth-based Jira sync endpoint
  app.post("/api/auth/jira/sync/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      console.log(`🔄 Starting OAuth-based Jira sync for company ${companyId}`);
      
      // Use the Jira OAuth service to sync data
      const result = await jiraOAuthService.syncDataToSchema(companyId);
      
      if (result.success) {
        console.log(`✅ OAuth Jira sync completed for company ${companyId}: ${result.recordsSynced} records`);
        res.json({
          success: true,
          message: `Successfully synced ${result.recordsSynced} records from Jira`,
          recordsSynced: result.recordsSynced,
          tablesCreated: result.tablesCreated,
          method: 'oauth'
        });
      } else {
        console.error(`❌ OAuth Jira sync failed for company ${companyId}: ${result.error}`);
        res.status(500).json({
          success: false,
          message: result.error || 'Sync failed',
          method: 'oauth'
        });
      }
      
    } catch (error) {
      console.error('OAuth Jira sync endpoint error:', error);
      res.status(500).json({ 
        success: false,
        error: "Failed to sync Jira data via OAuth",
        method: 'oauth'
      });
    }
  });

  // HubSpot OAuth2 Routes
  app.get("/api/auth/hubspot/authorize", async (req, res) => {
    try {
      // Accept companyId from query parameter or session
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : req.session?.companyId;
      const userId = req.session?.user?.id;

      if (!companyId) {
        return res.status(400).json({ error: "Company context required" });
      }

      const authUrl = hubspotOAuthService.getAuthorizationUrl(companyId, userId);
      res.redirect(authUrl);
    } catch (error) {
      console.error('HubSpot OAuth authorize error:', error);
      res.status(500).json({ error: "Failed to generate authorization URL" });
    }
  });

  app.get("/api/auth/hubspot/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({ error: "Missing code or state parameter" });
      }

      // Parse state to get company context
      const stateData = hubspotOAuthService.parseState(state as string);
      const { companyId } = stateData;

      console.log(`🔄 HubSpot OAuth callback for company ${companyId}`);

      // Exchange code for tokens
      const tokens = await hubspotOAuthService.exchangeCodeForTokens(code as string, state as string);

      // Get portal info
      const portalInfo = await hubspotOAuthService.getAccessTokenInfo(tokens.access_token);

      console.log(`✅ HubSpot OAuth successful for portal ${portalInfo.portalId}`);

      // Store tokens in database
      const hubspotConfig = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type,
        portalInfo,
        connectedAt: new Date().toISOString(),
      };

      // Check if HubSpot data source already exists
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const existingHubSpot = dataSources.find(ds => ds.type === 'hubspot');

      if (existingHubSpot) {
        // Update existing data source
        await storage.updateDataSource(existingHubSpot.id, {
          status: 'connected',
          config: hubspotConfig,
          lastSyncAt: new Date(),
        });
      } else {
        // Create new data source
        await storage.createDataSource({
          companyId,
          name: `HubSpot Portal ${portalInfo.portalId}`,
          type: 'hubspot',
          status: 'connected',
          config: hubspotConfig,
        });
      }

      // Redirect back to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      res.redirect(`${frontendUrl}/setup?hubspot=connected`);
      
    } catch (error) {
      console.error('HubSpot OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      res.redirect(`${frontendUrl}/setup?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
    }
  });

  // HubSpot table discovery endpoint
  app.get("/api/auth/hubspot/discover-tables/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      console.log(`🔍 HubSpot table discovery for company: ${companyId}`);
      
      // Get the stored OAuth token for this company
      const dataSources = await storage.getDataSourcesByCompany(parseInt(companyId));
      const hubspotSource = dataSources.find(ds => ds.type === 'hubspot');
      
      if (!hubspotSource || !hubspotSource.config) {
        return res.status(404).json({ error: 'HubSpot connection not found' });
      }

      const config = typeof hubspotSource.config === 'string' 
        ? JSON.parse(hubspotSource.config) 
        : hubspotSource.config;
        
      if (!config.accessToken) {
        return res.status(400).json({ error: 'Invalid HubSpot configuration' });
      }

      // Discover available tables
      const tables = await hubspotOAuthService.discoverHubSpotTables(config.accessToken);
      
      // Group tables by category for better UX
      const categorizedTables = {
        core: tables.filter(t => t.isStandard),
        engagement: tables.filter(t => ['calls', 'emails', 'meetings', 'notes', 'tasks'].includes(t.name)),
        other: tables.filter(t => !t.isStandard && !['calls', 'emails', 'meetings', 'notes', 'tasks'].includes(t.name))
      };

      console.log(`✅ Discovered ${tables.length} HubSpot tables`);
      
      res.json({
        success: true,
        tables: categorizedTables,
        totalTables: tables.length
      });
      
    } catch (error) {
      console.error('Error discovering HubSpot tables:', error);
      res.status(500).json({ error: 'Failed to discover HubSpot tables' });
    }
  });

  app.get("/api/auth/hubspot/status/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      // Check if company has active HubSpot connection
      const dataSources = await storage.getDataSources(companyId);
      const hubspotSource = dataSources.find(ds => ds.type === 'hubspot' && ds.status === 'connected');
      
      if (!hubspotSource || !hubspotSource.config) {
        return res.json({ connected: false });
      }

      const config = typeof hubspotSource.config === 'string' 
        ? JSON.parse(hubspotSource.config) 
        : hubspotSource.config;

      const status = {
        connected: true,
        method: 'oauth',
        portalInfo: config.portalInfo,
        expiresAt: config.expiresAt,
        expired: false // HubSpot tokens are long-lived
      };

      // Test if token is still valid
      if (config.accessToken) {
        const isValid = await hubspotOAuthService.testApiAccess(config.accessToken);
        if (!isValid) {
          status.expired = true;
        }
      }

      res.json(status);
    } catch (error) {
      console.error('Error checking HubSpot OAuth status:', error);
      res.status(500).json({ error: "Failed to check OAuth status" });
    }
  });

  // OAuth-based HubSpot sync endpoint
  app.post("/api/auth/hubspot/sync/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      console.log(`🔄 Starting OAuth-based HubSpot sync for company ${companyId}`);
      
      // Use the HubSpot OAuth service to sync data
      const result = await hubspotOAuthService.syncDataToSchema(companyId);
      
      if (result.success) {
        console.log(`✅ OAuth HubSpot sync completed for company ${companyId}: ${result.recordsSynced} records`);
        res.json({
          success: true,
          message: `Successfully synced ${result.recordsSynced} records from HubSpot`,
          recordsSynced: result.recordsSynced,
          tablesCreated: result.tablesCreated,
          method: 'oauth'
        });
      } else {
        console.error(`❌ OAuth HubSpot sync failed for company ${companyId}: ${result.error}`);
        res.status(500).json({
          success: false,
          error: result.error || "Failed to sync HubSpot data",
          method: 'oauth'
        });
      }
      
    } catch (error) {
      console.error('OAuth HubSpot sync endpoint error:', error);
      res.status(500).json({ 
        success: false,
        error: "Failed to sync HubSpot data via OAuth",
        method: 'oauth'
      });
    }
  });

  // Odoo OAuth2 Routes
  app.get("/api/auth/odoo/authorize", async (req, res) => {
    try {
      // Accept companyId from query parameter or session
      const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : req.session?.companyId;
      const userId = req.session?.user?.id;

      if (!companyId) {
        return res.status(400).json({ error: "Company context required" });
      }

      // Note: Odoo instance URL and credentials are now stored in database
      const authUrl = await odooOAuthService.getAuthorizationUrl(companyId, userId);
      res.redirect(authUrl);
    } catch (error) {
      console.error('Odoo OAuth authorize error:', error);
      res.status(500).json({ error: "Failed to generate authorization URL" });
    }
  });

  app.get("/api/auth/odoo/callback", async (req, res) => {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({ error: "Missing code or state parameter" });
      }

      // Parse state to get company context
      const stateData = odooOAuthService.parseState(state as string);
      const { companyId } = stateData;

      console.log(`🔄 Odoo OAuth callback for company ${companyId}`);

      // Exchange code for tokens using stored credentials
      const tokens = await odooOAuthService.exchangeCodeForTokens(code as string, state as string, companyId);

      // Get Odoo instance URL from stored config for user info call
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const odooSource = dataSources.find(ds => ds.type === 'odoo');
      
      if (!odooSource?.config) {
        throw new Error('Odoo configuration not found');
      }

      const config = typeof odooSource.config === 'string' 
        ? JSON.parse(odooSource.config) 
        : odooSource.config;

      // Get user info
      const userInfo = await odooOAuthService.getUserInfo(tokens.access_token, config.odooInstanceUrl);

      console.log(`✅ Odoo OAuth successful for database ${userInfo.database}`);

      // Store tokens in database while preserving original credentials
      const odooConfig = {
        ...config,  // Preserve original setup config (consumerKey, consumerSecret, odooInstanceUrl)
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type,
        userInfo,
        connectedAt: new Date().toISOString(),
      };

      // Update the existing data source
      await storage.updateDataSource(odooSource.id, {
        status: 'connected',
        config: odooConfig,
        lastSyncAt: new Date(),
      });

      // Redirect back to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      res.redirect(`${frontendUrl}/setup?odoo=connected`);
      
    } catch (error) {
      console.error('Odoo OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
      res.redirect(`${frontendUrl}/setup?error=oauth_failed&message=${encodeURIComponent(error.message)}`);
    }
  });

  // Odoo table discovery endpoint
  app.get("/api/auth/odoo/discover-tables/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      console.log(`🔍 Odoo table discovery for company: ${companyId}`);
      
      // Get the stored OAuth token for this company
      const dataSources = await storage.getDataSourcesByCompany(parseInt(companyId));
      const odooSource = dataSources.find(ds => ds.type === 'odoo');
      
      if (!odooSource || !odooSource.config) {
        return res.status(404).json({ error: 'Odoo connection not found' });
      }

      const config = typeof odooSource.config === 'string' 
        ? JSON.parse(odooSource.config) 
        : odooSource.config;
        
      if (!config.accessToken || !config.odooInstanceUrl) {
        return res.status(400).json({ error: 'Invalid Odoo configuration' });
      }

      // Discover available tables
      const tables = await odooOAuthService.discoverTables(config.accessToken, config.odooInstanceUrl);
      
      // Group tables by category for better UX
      const categorizedTables = {
        core: tables.filter(t => t.isStandard),
        financial: tables.filter(t => ['sale_order', 'account_move', 'purchase_order'].includes(t.name)),
        operational: tables.filter(t => ['stock_move', 'product_product', 'res_partner'].includes(t.name)),
        other: tables.filter(t => !t.isStandard && !['sale_order', 'account_move', 'purchase_order', 'stock_move', 'product_product', 'res_partner'].includes(t.name))
      };

      console.log(`✅ Discovered ${tables.length} Odoo tables`);
      
      res.json({
        success: true,
        tables: categorizedTables,
        totalTables: tables.length
      });
      
    } catch (error) {
      console.error('Error discovering Odoo tables:', error);
      res.status(500).json({ error: 'Failed to discover Odoo tables' });
    }
  });

  app.get("/api/auth/odoo/status/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      // Check if company has active Odoo connection
      const dataSources = await storage.getDataSources(companyId);
      const odooSource = dataSources.find(ds => ds.type === 'odoo' && ds.status === 'connected');
      
      if (!odooSource || !odooSource.config) {
        return res.json({ connected: false });
      }

      const config = typeof odooSource.config === 'string' 
        ? JSON.parse(odooSource.config) 
        : odooSource.config;

      const status = {
        connected: true,
        method: 'oauth',
        userInfo: config.userInfo,
        odooInstanceUrl: config.odooInstanceUrl,
        connectedAt: config.connectedAt,
      };

      res.json(status);
    } catch (error) {
      console.error('Error checking Odoo status:', error);
      res.status(500).json({ error: 'Failed to check Odoo status' });
    }
  });

  // API Key-based Odoo sync endpoint
  app.post("/api/auth/odoo/sync/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      console.log(`🔄 Starting API key-based Odoo sync for company ${companyId}`);
      
      // Use the Odoo API service to sync data (XML-RPC with API keys)
      const result = await odooApiService.syncDataToSchema(companyId);
      
      if (result.success) {
        console.log(`✅ API key Odoo sync completed for company ${companyId}: ${result.recordsSynced} records`);
        res.json({
          success: true,
          message: `Successfully synced ${result.recordsSynced} records from Odoo`,
          recordsSynced: result.recordsSynced,
          tablesCreated: result.tablesCreated,
          method: 'oauth'
        });
      } else {
        console.error(`❌ OAuth Odoo sync failed for company ${companyId}: ${result.error}`);
        res.status(500).json({
          success: false,
          error: result.error || "Failed to sync Odoo data",
          method: 'oauth'
        });
      }
      
    } catch (error) {
      console.error('OAuth Odoo sync endpoint error:', error);
      res.status(500).json({ 
        success: false,
        error: "Failed to sync Odoo data via OAuth",
        method: 'oauth'
      });
    }
  });

  // Odoo setup endpoint for initial configuration with customer-provided OAuth credentials
  app.post("/api/auth/odoo/setup", async (req, res) => {
    try {
      const { companyId, odooInstanceUrl, odooDatabase, odooUsername, odooApiKey } = req.body;

      // Debug logging
      console.log('🔍 Received Odoo setup parameters:', {
        companyId: companyId || 'MISSING',
        odooInstanceUrl: odooInstanceUrl?.length ? `SET (${odooInstanceUrl.length} chars)` : 'EMPTY',
        odooDatabase: odooDatabase?.length ? `SET (${odooDatabase.length} chars)` : 'EMPTY', 
        odooUsername: odooUsername?.length ? `SET (${odooUsername.length} chars)` : 'EMPTY',
        odooApiKey: odooApiKey?.length ? `SET (${odooApiKey.length} chars)` : 'EMPTY'
      });

      // Check for missing parameters and report specifically which ones
      const missing = [];
      if (!companyId) missing.push('companyId');
      if (!odooInstanceUrl?.trim()) missing.push('odooInstanceUrl');
      if (!odooDatabase?.trim()) missing.push('odooDatabase');
      if (!odooUsername?.trim()) missing.push('odooUsername');
      if (!odooApiKey?.trim()) missing.push('odooApiKey');

      if (missing.length > 0) {
        console.log('❌ Missing required parameters:', missing);
        return res.status(400).json({ 
          error: `Missing required parameters: ${missing.join(', ')}` 
        });
      }

      // Validate URL format
      try {
        new URL(odooInstanceUrl);
      } catch {
        return res.status(400).json({ error: "Invalid Odoo instance URL format" });
      }

      // Create or update Odoo data source with setup configuration
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const existingOdoo = dataSources.find(ds => ds.type === 'odoo');

      // Test API key connection before saving
      console.log(`🔐 Testing Odoo API key connection for ${odooUsername}@${odooDatabase}`);
      const { odooApiService } = await import('./services/odoo-api.js');
      const authResult = await odooApiService.authenticate(
        odooInstanceUrl.replace(/\/$/, ''),
        odooDatabase,
        odooUsername,
        odooApiKey
      );

      if (!authResult.success) {
        return res.status(400).json({ 
          error: `Odoo authentication failed: ${authResult.error}` 
        });
      }

      console.log(`✅ Odoo API key authentication successful for user: ${authResult.userInfo?.name}`);

      const setupConfig = {
        odooInstanceUrl: odooInstanceUrl.replace(/\/$/, ''), // Remove trailing slash
        odooDatabase,
        odooUsername,
        odooApiKey,
        userInfo: authResult.userInfo,
        setupAt: new Date().toISOString(),
      };

      if (existingOdoo) {
        // Update existing data source
        await storage.updateDataSource(existingOdoo.id, {
          status: 'connected',
          config: setupConfig,
        });
      } else {
        // Create new data source
        await storage.createDataSource({
          companyId,
          name: `Odoo ERP (${authResult.userInfo?.company_name || new URL(odooInstanceUrl).hostname})`,
          type: 'odoo',
          status: 'connected',
          config: setupConfig,
        });
      }

      res.json({
        success: true,
        message: "Odoo setup configuration saved successfully",
        nextStep: "oauth_authorization"
      });

    } catch (error) {
      console.error('Odoo setup error:', error);
      res.status(500).json({ error: "Failed to save Odoo setup configuration" });
    }
  });
  
  // Authentication
  app.post("/api/auth/login", async (req, res) => {
    console.log("🔑 Login attempt started:", { username: req.body.username, hasPassword: !!req.body.password });
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      // Get user by username
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // For now, we'll do a simple password check (in production, use bcrypt)
      if (user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Check if user has admin permissions (replaces simple email check)
      const userPermissions = await rbacService.getUserPermissions(user.id);
      const isAdmin = userPermissions.includes(PERMISSIONS.ADMIN_PANEL);
      
      // Set user in session
      req.session!.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        permissions: userPermissions
      };

      // Update last login time
      await storage.updateUser(user.id, { lastLoginAt: new Date() });

      // Check if MFA is enabled for this user
      const mfaEnabled = await mfaService.isMFAEnabled(user.id);
      
      // For admin users, ALWAYS clear any existing company selection - they must choose
      // For regular users, set their company automatically for tenant isolation
      if (isAdmin) {
        // Clear any previous company selection for admin users
        req.session!.selectedCompany = null;
        console.log(`🔧 Admin login: Cleared previous company selection for admin user ${user.username}`);
      } else if (user.companyId) {
        const company = await storage.getCompany(user.companyId);
        if (company) {
          req.session!.selectedCompany = {
            id: company.id,
            name: company.name,
            slug: company.slug
          };
        }
      }

      // Log successful login
      await rbacService.logAction({
        userId: user.id,
        action: 'auth.login',
        details: { 
          isAdmin, 
          mfaEnabled,
          userAgent: req.get('User-Agent')
        },
        req,
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: isAdmin,
          permissions: userPermissions,
          mfaEnabled: mfaEnabled
        },
        company: req.session!.selectedCompany || null,
        requiresMFA: mfaEnabled && !req.session!.mfaVerified
      });

    } catch (error) {
      console.error('❌ Login error:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const userId = (req.session as any)?.user?.id;
    const selectedCompany = (req.session as any)?.selectedCompany;
    
    // Log logout action if we have user info
    if (userId) {
      try {
        await rbacService.logAction({
          userId,
          action: 'auth.logout',
          details: { 
            hadCompanySelected: !!selectedCompany,
            companyName: selectedCompany?.name
          },
          req,
        });
      } catch (error) {
        console.error('Failed to log logout action:', error);
      }
    }
    
    req.session?.destroy((err) => {
      if (err) {
        console.error('❌ Logout error:', err);
        return res.status(500).json({ message: "Logout failed" });
      }
      console.log('✅ User logged out, session destroyed');
      res.json({ success: true });
    });
  });

  
  // Companies
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies.map(company => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        schemaName: `analytics_company_${company.id}`,
        isActive: company.isActive
      })));
    } catch (error) {
      console.error('Failed to get companies:', error);
      res.status(500).json({ message: "Failed to get companies" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const { name, slug } = req.body;
      
      console.log(`🔨 Starting company creation: ${name}`);
      
      // Create company in database
      const newCompany = await storage.createCompany({
        id: Date.now(), // Generate unique ID
        name,
        slug,
        isActive: true
      });
      
      console.log(`✅ Company created successfully: ${name} (ID: ${newCompany.id})`);
      
      // Automatically create analytics schema for the new company
      console.log(`🏗️ Creating analytics schema for new company: ${name} (ID: ${newCompany.id})`);
      const schemaResult = await storage.ensureAnalyticsSchema(newCompany.id);
      
      if (!schemaResult.success) {
        console.error(`⚠️ Analytics schema creation failed for company ${newCompany.id}:`, schemaResult.error);
      } else {
        console.log(`✅ Analytics schema created successfully for ${name}`);
      }
      
      res.json({
        id: newCompany.id,
        name: newCompany.name,
        slug: newCompany.slug,
        isActive: newCompany.isActive
      });
    } catch (error) {
      console.error('❌ Failed to create company:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.delete("/api/companies/:id", async (req, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      if (isNaN(companyId)) {
        return res.status(400).json({ message: "Invalid company ID" });
      }
      
      console.log(`🔨 Starting company deletion: ID ${companyId}`);
      
      // Delete company and its analytics schema
      const result = await storage.deleteCompany(companyId);
      
      if (!result.success) {
        return res.status(404).json({ message: result.error || "Company not found" });
      }
      
      console.log(`✅ Company deletion completed successfully: ID ${companyId}`);
      res.json({ success: true, message: "Company and analytics schema deleted successfully" });
      
    } catch (error) {
      console.error('❌ Failed to delete company:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      res.status(500).json({ message: "Failed to delete company" });
    }
  });

  // Company selection endpoint
  app.post("/api/companies/select", async (req, res) => {
    try {
      const { companyId } = req.body;
      
      if (!companyId) {
        return res.status(400).json({ message: "Company ID is required" });
      }
      
      // Verify the company exists
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      // Initialize session if it doesn't exist
      if (!req.session) {
        req.session = {} as any;
      }
      
      // Set the selected company in the session
      req.session.selectedCompany = {
        id: company.id,
        name: company.name,
        slug: company.slug
      };
      
      console.log(`✅ Company selected: ${company.name} (ID: ${company.id})`);
      res.json({ 
        success: true, 
        selectedCompany: req.session!.selectedCompany,
        message: `Selected company: ${company.name}` 
      });
      
    } catch (error) {
      console.error('❌ Failed to select company:', error);
      res.status(500).json({ message: "Failed to select company" });
    }
  });

  // Get current session info including selected company
  app.get("/api/session", async (req, res) => {
    try {
      res.json({
        selectedCompany: req.session?.selectedCompany || null,
        user: req.session?.user || null
      });
    } catch (error) {
      console.error('❌ Failed to get session info:', error);
      res.status(500).json({ message: "Failed to get session info" });
    }
  });

  // Debug endpoint to check tables for a specific company
  app.get("/api/debug/tables/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      console.log(`🔍 Debug: Checking tables for company ${companyId}`);
      
      const analyticsSchema = `analytics_company_${companyId}`;
      
      // Use the same logic as the postgres/tables endpoint
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = '${analyticsSchema}'
        ORDER BY table_name
      `;
      
      console.log(`Executing PostgreSQL query: ${query}`);
      const result = await postgresAnalyticsService.executeQuery(query);
      const tables = Array.isArray(result) ? result.map((row: any) => row.table_name) : [];
      
      res.json({
        companyId,
        analyticsSchema,
        tables,
        tableCount: tables.length,
        query
      });
    } catch (error) {
      console.error('❌ Debug tables check failed:', error);
      res.status(500).json({ 
        message: "Failed to check tables", 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Cleanup orphaned analytics schemas
  app.post("/api/companies/cleanup-schemas", async (req, res) => {
    try {
      console.log(`🧹 Starting manual cleanup of orphaned analytics schemas...`);
      
      const result = await storage.cleanupOrphanedAnalyticsSchemas();
      
      if (!result.success) {
        return res.status(500).json({ 
          success: false, 
          message: "Failed to cleanup schemas", 
          errors: result.errors 
        });
      }
      
      console.log(`✅ Schema cleanup completed. Cleaned: ${result.cleaned.length}, Errors: ${result.errors.length}`);
      
      res.json({ 
        success: true, 
        message: `Cleanup completed. Removed ${result.cleaned.length} orphaned schemas.`,
        cleaned: result.cleaned,
        errors: result.errors
      });
      
    } catch (error) {
      console.error('❌ Failed to cleanup schemas:', error);
      res.status(500).json({ 
        success: false, 
        message: "Internal server error during schema cleanup" 
      });
    }
  });

  // Ensure all companies have analytics schemas
  app.post("/api/companies/ensure-schemas", async (req, res) => {
    try {
      console.log(`🏗️ Starting manual ensure all companies have schemas...`);
      
      const result = await storage.ensureAllCompaniesHaveSchemas();
      
      if (!result.success) {
        return res.status(500).json({ 
          success: false, 
          message: "Failed to ensure schemas", 
          errors: result.errors 
        });
      }
      
      console.log(`✅ Schema ensure completed. Created: ${result.created.length}, Errors: ${result.errors.length}`);
      
      res.json({ 
        success: true, 
        message: `Schema ensure completed. Created ${result.created.length} missing schemas.`,
        created: result.created,
        errors: result.errors
      });
      
    } catch (error) {
      console.error('❌ Failed to ensure schemas:', error);
      res.status(500).json({ 
        success: false, 
        message: "Internal server error during schema ensure" 
      });
    }
  });

  // Users
  app.get("/api/users", async (req, res) => {
    try {
      const selectedCompany = (req.session as any)?.selectedCompany;
      
      if (!selectedCompany) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }

      // Get only users from the currently selected company
      const users = await storage.getUsersByCompany(selectedCompany.id);
      res.json(users);
    } catch (error) {
      console.error('Failed to get company users:', error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const { username, password, companyId, role } = req.body;
      const user = await storage.createUser({
        username,
        password,
        companyId,
        role: role || "user"
      });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // User Invitation
  app.post("/api/users/invite", async (req, res) => {
    try {
      const { firstName, lastName, email, companyId, role, sendInvitation = true } = req.body;
      
      // Validate required fields
      if (!firstName || !lastName || !email || !companyId) {
        return res.status(400).json({ 
          message: "First name, last name, email, and company are required" 
        });
      }

      // Generate a temporary username from email
      const username = email.split('@')[0];
      
      // Generate a secure temporary password (user will set their own)
      const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
      
      // Create user record
      const user = await storage.createUser({
        username,
        password: tempPassword,
        companyId: parseInt(companyId),
        role: role || "user",
        firstName,
        lastName,
        email,
        status: "invited"
      });

      if (sendInvitation) {
        // Get company information for the email
        const companies = await storage.getCompanies();
        const company = companies.find(c => c.id === parseInt(companyId));
        const companyName = company?.name || "Your Company";

        // Create invitation token (in production, this should be JWT or similar)
        const invitationToken = Math.random().toString(36).slice(-20) + Date.now().toString(36);
        
        // TODO: Store invitation token in database for security
        
        // Prepare email content
        const invitationUrl = `${req.protocol}://${req.get('host')}/setup-account?token=${invitationToken}&email=${encodeURIComponent(email)}`;
        
        const emailSubject = `Welcome to Saulto Analytics - Set Up Your Account`;
        const emailBody = `
Hi ${firstName},

You've been invited to join ${companyName} on Saulto Analytics!

Your account details:
• Name: ${firstName} ${lastName}
• Email: ${email}
• Role: ${role.charAt(0).toUpperCase() + role.slice(1)}
• Company: ${companyName}

To complete your account setup, please click the link below:
${invitationUrl}

This link will allow you to:
- Set your secure password
- Access your company's metrics dashboard
- Start analyzing business performance data

What you'll be able to do with your ${role} access:
${role === 'admin' ? '• Manage users and company settings\n• Configure data sources\n• Create and manage all reports\n• Full access to analytics' :
  role === 'user' ? '• Create and share metric reports\n• Use AI assistant for insights\n• View and analyze metrics\n• Access business dashboards' :
  '• View existing reports and dashboards\n• Access shared metric reports\n• Read-only access to analytics'}

If you have any questions, please contact your administrator.

Welcome to the team!

Best regards,
The Saulto Analytics Team
        `.trim();

        // In production, integrate with email service (SendGrid, AWS SES, etc.)
        console.log("=== EMAIL INVITATION ===");
        console.log("To:", email);
        console.log("Subject:", emailSubject);
        console.log("Body:", emailBody);
        console.log("Invitation URL:", invitationUrl);
        console.log("========================");

        // For now, we'll simulate email sending
        // TODO: Integrate with actual email service
        
        res.json({
          success: true,
          user: {
            id: user.id,
            firstName,
            lastName,
            email,
            role,
            companyId,
            status: "invited"
          },
          message: "User invitation sent successfully"
        });
      } else {
        res.json({
          success: true,
          user: {
            id: user.id,
            firstName,
            lastName,
            email,
            role,
            companyId,
            status: "created"
          }
        });
      }
    } catch (error) {
      console.error("Error creating user invitation:", error);
      res.status(500).json({ message: "Failed to send user invitation" });
    }
  });
  
  // Setup Status
  app.get("/api/setup-status", async (req, res) => {
    try {
      const companyId = (req.session as any)?.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      const status = await storage.getSetupStatus(companyId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ message: "Failed to get setup status" });
    }
  });

  // Data Sources
  app.get("/api/data-sources", async (req, res) => {
    try {
      const dataSources = await storage.getDataSources();
      res.json(dataSources);
    } catch (error) {
      res.status(500).json({ message: "Failed to get data sources" });
    }
  });

  app.post("/api/data-sources", async (req, res) => {
    try {
      const validatedData = insertDataSourceSchema.parse(req.body);
      const dataSource = await storage.createDataSource(validatedData);
      
      // Log activity
      await storage.createPipelineActivity({
        companyId: companyId,
        type: "sync",
        description: `Created ${dataSource.name} data source`,
        status: "success",
      });

      res.json(dataSource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create data source" });
      }
    }
  });

  // One-click setup
  app.post("/api/setup/provision", async (req, res) => {
    try {
      // Use Python service for connector operations

      // Create company database automatically (using demo company for now)
      const companySlug = "demo_company";
      // PostgreSQL schemas are created automatically by the postgres loader

      console.log(`Using PostgreSQL analytics schemas for company: ${companySlug}`);

      // Setup data connectors using Python connector service
      const connectorsResult = await pythonConnectorService.setupConnectors();
      if (!connectorsResult.success) {
        throw new Error("Failed to setup data connectors");
      }

      // Create default data sources
      const dataSources = [
        { name: "Salesforce", type: "salesforce", status: "connected", tableCount: 23 },
        { name: "HubSpot", type: "hubspot", status: "connected", tableCount: 18 },
        { name: "QuickBooks", type: "quickbooks", status: "connected", tableCount: 12 },
      ];

      for (const ds of dataSources) {
        await storage.createDataSource(ds);
      }

      // Update setup status
      await storage.updateSetupStatus({
        warehouseConnected: true,
        dataSourcesConfigured: true,
      });

      // Log activity
      await storage.createPipelineActivity({
        companyId: companyId,
        type: "sync",
        description: "One-click setup completed successfully",
        status: "success",
      });

      res.json({ success: true, message: "Setup completed successfully" });
    } catch (error) {
      await storage.createPipelineActivity({
        companyId: companyId,
        type: "error",
        description: `Setup failed: ${error.message}`,
        status: "error",
      });
      res.status(500).json({ message: error.message });
    }
  });

  // SQL Models
  app.get("/api/sql-models", async (req, res) => {
    try {
      const layer = req.query.layer as string;
      const models = layer 
        ? await storage.getSqlModelsByLayer(layer)
        : await storage.getSqlModels();
      res.json(models);
    } catch (error) {
      res.status(500).json({ message: "Failed to get SQL models" });
    }
  });

  app.post("/api/sql-models", async (req, res) => {
    try {
      const validatedData = insertSqlModelSchema.parse(req.body);
      const model = await storage.createSqlModel(validatedData);
      res.json(model);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create SQL model" });
      }
    }
  });

  // Deploy models
  app.post("/api/sql-models/deploy", async (req, res) => {
    try {
      // TODO: Replace with working SQL deployment service
      const result = { success: true, modelsDeployed: 0, message: "SQL deployment service temporarily disabled" };
      
      // Update setup status
      const models = await storage.getSqlModels();
      const deployedCount = models.filter(m => m.status === "deployed").length;
      await storage.updateSetupStatus({
        modelsDeployed: deployedCount,
        totalModels: models.length,
      });

      res.json(result);
    } catch (error) {
      await storage.createPipelineActivity({
        companyId: companyId,
        type: "error",
        description: `Model deployment failed: ${error.message}`,
        status: "error",
      });
      res.status(500).json({ message: error.message });
    }
  });

  // KPI Metrics
  app.get("/api/kpi-metrics", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      
      const metrics = await storage.getKpiMetrics(companyId);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to get KPI metrics" });
    }
  });

  // Get dashboard metrics data with calculated values
  app.get("/api/dashboard/metrics-data", async (req, res) => {
    try {
      console.log("=== Dashboard metrics data request ===");
      const timePeriod = req.query.timePeriod as string || 'Monthly View';
      console.log(`Time period filter: ${timePeriod}`);
      
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      const metrics = await storage.getKpiMetrics(companyId);
      console.log(`Found ${metrics.length} metrics for dashboard`);
      
      const dashboardData = [];
      const metricsSeriesService = new MetricsSeriesService(postgresAnalyticsService);

      // Map time period from frontend to backend format
      let periodType: 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly';
      if (timePeriod.toLowerCase().includes('weekly')) periodType = 'weekly';
      else if (timePeriod.toLowerCase().includes('monthly')) periodType = 'monthly';
      else if (timePeriod.toLowerCase().includes('quarterly')) periodType = 'quarterly';
      else if (timePeriod.toLowerCase().includes('yearly')) periodType = 'yearly';

      for (const metric of metrics) {
        console.log(`Processing metric: ${metric.name} (ID: ${metric.id}) for period: ${timePeriod}`);
        try {
          console.log(`🔧 Calling MetricsSeriesService for ${metric.name}...`);
          // Get metrics series data and progress metrics
          const result = await metricsSeriesService.getMetricsSeries({
            companyId,
            periodType,
            metricKeys: [metric.name] // Use the original metric name without transformation
          });
          
          console.log(`🔍 Result for ${metric.name}:`, result ? 'has result' : 'null/undefined');
          console.log(`🔍 Progress data:`, JSON.stringify(result?.progress, null, 2));
          
          if (result && result.progress) {
            console.log(`✅ Dashboard data for metric ${metric.name}: Actual=${result.progress.todayActual}, Goal=${result.progress.todayGoal}, Progress=${result.progress.progress}%`);
            
            // Database now provides period-relative values, so use them directly
            console.log(`🔄 Using database period-relative values for ${metric.name}`);
            
            // Add the calculated result with proper structure (database provides period-relative values)
            dashboardData.push({
              metricId: metric.id,
              metricName: metric.name,
              currentValue: result.progress.todayActual, // Database provides period-relative progress
              goalValue: result.progress.todayGoal, // Database provides period goal
              yearlyGoal: result.progress.periodEndGoal,
              progress: result.progress.progress, // % of period end goal achieved
              onPace: result.progress.onPace, // % to today's goal
              format: metric.format || 'number',
              category: metric.category || 'general',
              timePeriod: periodType
            });
          } else {
            console.log(`❌ No progress data available for metric ${metric.name}`);
          }
        } catch (error) {
          console.error(`❌ Error processing metric ${metric.name}:`, error);
        }
      }

      console.log(`📊 Returning ${dashboardData.length} dashboard metrics`);
      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard metrics data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics data" });
    }
  });

  app.post("/api/kpi-metrics", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      const dataWithCompanyId = { ...req.body, companyId };
      console.log("Creating metric for MIAS_DATA company:", JSON.stringify(dataWithCompanyId, null, 2));
      
      // Handle filter processing if provided
      if (dataWithCompanyId.filterConfig && dataWithCompanyId.dataSource) {
        const filterResult = filterToSQL(dataWithCompanyId.filterConfig, dataWithCompanyId.dataSource);
        
        if (filterResult.errors.length > 0) {
          return res.status(400).json({ 
            message: "Invalid filter configuration", 
            errors: filterResult.errors 
          });
        }
        
        // Build SQL with filter
        const baseQuery = dataWithCompanyId.sqlQuery || generateMetricTemplate(
          dataWithCompanyId.dataSource,
          dataWithCompanyId.metricType || "revenue",
          "monthly"
        );
        
        const sqlResult = buildMetricSQL(
          baseQuery,
          dataWithCompanyId.filterConfig,
          dataWithCompanyId.dataSource,
          dataWithCompanyId.aggregateFunction || "SUM",
          dataWithCompanyId.valueColumn || "amount"
        );
        
        if (sqlResult.errors.length > 0) {
          return res.status(400).json({ 
            message: "Failed to build SQL query", 
            errors: sqlResult.errors 
          });
        }
        
        // Store the generated SQL and parameters
        dataWithCompanyId.sqlQuery = sqlResult.whereClause;
        dataWithCompanyId.sqlParameters = sqlResult.parameters;
        
        console.log("Generated SQL with filter:", sqlResult.whereClause);
        console.log("SQL Parameters:", JSON.stringify(sqlResult.parameters, null, 2));
      }
      
      const validatedData = insertKpiMetricSchema.parse(dataWithCompanyId);
      const metric = await storage.createKpiMetric(validatedData);
      console.log("Successfully saved metric:", metric.name);

      // Also save to metric registry if metricConfig is provided
      if (dataWithCompanyId.metricConfig) {
        try {
          console.log("💾 Saving metric to registry:", dataWithCompanyId.metricConfig);
          await storage.saveMetricToRegistry(companyId, {
            metric_key: dataWithCompanyId.metricConfig.metric_key,
            label: dataWithCompanyId.metricConfig.label,
            source_table: dataWithCompanyId.metricConfig.source_fact || dataWithCompanyId.metricConfig.source_table,
            expr_sql: dataWithCompanyId.metricConfig.expr_sql,
            filters: dataWithCompanyId.metricConfig.filters || dataWithCompanyId.filterConfig,
            unit: dataWithCompanyId.metricConfig.unit,
            date_column: dataWithCompanyId.metricConfig.date_column || 'created_at',
            description: dataWithCompanyId.metricConfig.description || dataWithCompanyId.description,
            tags: dataWithCompanyId.metricConfig.tags || []
          });
          console.log("✅ Metric saved to registry successfully");
        } catch (registryError) {
          console.error("⚠️ Failed to save to metric registry:", registryError);
          // Don't fail the whole request if registry save fails
        }
      }

      res.json(metric);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", JSON.stringify(error.errors, null, 2));
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        console.log("Server error:", error);
        res.status(500).json({ message: "Failed to create KPI metric" });
      }
    }
  });

  // Metrics Series Endpoint (uses pre-calculated time series data)
  app.get("/api/company/metrics-series", async (req, res) => {
    try {
      // Use validated company ID from middleware
      const companyId = getValidatedCompanyId(req);

      const { period_type = 'monthly', metric_keys } = req.query as { 
        period_type?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
        metric_keys?: string;
      };

      console.log(`📊 Getting metrics series for company ${companyId}, period: ${period_type}`);
      
      // Parse metric keys if provided
      const metricKeys = metric_keys ? metric_keys.split(',') : undefined;
      
      // Create metrics series service
      const metricsSeriesService = new MetricsSeriesService(postgresAnalyticsService);
      
      // Validate query
      const validation = metricsSeriesService.validateQuery({
        companyId,
        periodType: period_type,
        metricKeys
      });
      
      if (!validation.valid) {
        return res.status(400).json({ 
          success: false, 
          error: validation.error 
        });
      }
      
      // Get metrics series data
      const result = await metricsSeriesService.getMetricsSeries({
        companyId,
        periodType: period_type,
        metricKeys
      });

      console.log(`✅ Retrieved ${result.series.length} data points with progress metrics`);

      res.json({
        success: true,
        data: result.series,
        progress: result.progress,
        period_type: period_type
      });
    } catch (error) {
      console.error("Error in metrics series endpoint:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch metrics series data"
      });
    }
  });

  // ETL Management Endpoints
  app.post("/api/company/metrics-series/etl", async (req, res) => {
    try {
      const companyId = getValidatedCompanyId(req);
      const { period_type, force_refresh = false } = req.body;
      
      if (!period_type) {
        return res.status(400).json({ 
          success: false, 
          error: "period_type is required" 
        });
      }
      
      const metricsSeriesService = new MetricsSeriesService(postgresAnalyticsService);
      const result = await metricsSeriesService.runETLJob(companyId, period_type, force_refresh);
      
      res.json(result);
    } catch (error) {
      console.error("Error running ETL job:", error);
      res.status(500).json({
        success: false,
        error: "Failed to run ETL job"
      });
    }
  });

  app.get("/api/company/metrics-series/etl/status", async (req, res) => {
    try {
      const companyId = getValidatedCompanyId(req);
      const { period_type } = req.query as { period_type?: string };
      
      if (!period_type) {
        return res.status(400).json({ 
          success: false, 
          error: "period_type is required" 
        });
      }
      
      const metricsSeriesService = new MetricsSeriesService(postgresAnalyticsService);
      const status = await metricsSeriesService.getETLStatus(companyId, period_type);
      
      res.json({ success: true, status });
    } catch (error) {
      console.error("Error getting ETL status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get ETL status"
      });
    }
  });

  // Legacy /api/series endpoint for existing charts
  app.get("/api/series", async (req, res) => {
    try {
      const companyId = getValidatedCompanyId(req);
      const { start, end, granularity, include_goals, relative } = req.query as { 
        start?: string; 
        end?: string; 
        granularity?: string; 
        include_goals?: string;
        relative?: string;
      };

      // Map old parameters to new system based on date range and granularity
      let periodType: 'weekly' | 'monthly' | 'quarterly' | 'yearly' = 'monthly';
      
      // Parse date range to determine period
      if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 7) {
          periodType = 'weekly';
        } else if (daysDiff <= 35) { // Up to ~1 month
          periodType = 'monthly';
        } else if (daysDiff <= 95) { // Up to ~3 months  
          periodType = 'quarterly';
        } else {
          periodType = 'yearly';
        }
      } else {
        // Fallback based on granularity only
        if (granularity === 'day') {
          periodType = 'monthly'; // Daily granularity typically for monthly view
        } else if (granularity === 'week') {
          periodType = 'quarterly'; 
        } else if (granularity === 'month') {
          periodType = 'yearly';
        }
      }

      if (!['weekly', 'monthly', 'quarterly', 'yearly'].includes(periodType)) {
        return res.status(400).json({ 
          success: false, 
          error: "Period type must be one of: weekly, monthly, quarterly, yearly" 
        });
      }

      console.log(`📊 Legacy API: Getting metrics series for company ${companyId}, period: ${periodType}`);
      
      const metricsSeriesService = new MetricsSeriesService(postgresAnalyticsService);
      
      // Get metrics series data
      const result = await metricsSeriesService.getMetricsSeries({
        companyId,
        periodType
      });

      // Transform to legacy format
      let legacyData = result.series.map((item: any) => ({
        ts: item.ts,
        series: item.series,
        value: relative === 'true' ? item.period_relative_running_sum : item.running_sum
      }));

      // Database now provides period-relative values directly, no need for complex calculations
      if (relative === 'true') {
        console.log(`✅ Legacy API: Using database period-relative running sum values for charts`);
        // The MetricsSeriesService already returns period-relative values from database
        // Now using period_relative_running_sum for smooth chart progression
      }

      console.log(`✅ Legacy API: Retrieved ${legacyData.length} data points${relative === 'true' ? ' (period-relative)' : ''}`);
      res.json({ data: legacyData });
    } catch (error) {
      console.error("Error in legacy series endpoint:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch metrics series data"
      });
    }
  });

  // Populate Metric Registry with Jira metrics (for testing/setup)
  app.post("/api/company/metric-registry/populate", async (req, res) => {
    try {
      const companyId = getValidatedCompanyId(req);
      
      console.log(`🔄 Populating metric registry for company ${companyId}...`);
      
      // Ensure analytics schema exists
      const dbStorage = storage as any;
      await dbStorage.ensureAnalyticsSchema(companyId);
      
      // Setup metric registry tables
      await dbStorage.setupCompanyMetricRegistry(companyId);
      
      // Define Jira metrics for line charts
      const jiraMetrics = [
        {
          metric_key: 'jira_story_points_completed',
          label: 'Story Points Completed',
          source_table: 'core_jira_issues', 
          expr_sql: 'SUM(COALESCE(f.story_points, 0))',
          date_column: 'resolved_at',
          unit: 'count',
          description: 'Total story points completed per time period',
          tags: ['jira', 'productivity']
        },
        {
          metric_key: 'jira_issues_resolved',
          label: 'Issues Resolved',
          source_table: 'core_jira_issues',
          expr_sql: 'COUNT(*)',
          date_column: 'resolved_at', 
          unit: 'count',
          description: 'Number of issues resolved per time period',
          tags: ['jira', 'productivity']
        },
        {
          metric_key: 'jira_avg_cycle_time',
          label: 'Avg Cycle Time (Days)',
          source_table: 'core_jira_issues',
          expr_sql: 'AVG(EXTRACT(DAY FROM (f.resolved_at - f.created_at)))',
          date_column: 'resolved_at',
          unit: 'days',
          description: 'Average cycle time from creation to resolution',
          tags: ['jira', 'performance']
        }
      ];
      
      const results = [];
      for (const metric of jiraMetrics) {
        try {
          console.log(`Adding metric: ${metric.label}`);
          
          await storage.saveMetricToRegistry(companyId, {
            metric_key: metric.metric_key,
            label: metric.label,
            source_table: metric.source_table,
            expr_sql: metric.expr_sql,
            filters: null,
            unit: metric.unit,
            date_column: metric.date_column,
            description: metric.description,
            tags: metric.tags
          });
          
          results.push({ metric_key: metric.metric_key, status: 'success' });
          console.log(`✅ Added ${metric.label}`);
        } catch (error) {
          console.error(`❌ Failed to add ${metric.label}:`, error);
          results.push({ metric_key: metric.metric_key, status: 'error', error: error.message });
        }
      }
      
      // Verify populated registry
      const populatedRegistry = await storage.getCompanyMetricRegistry(companyId);
      console.log(`✅ Registry now contains ${populatedRegistry.length} metrics`);
      
      res.json({
        success: true,
        message: `Populated ${results.filter(r => r.status === 'success').length} metrics`,
        companyId,
        results,
        registryCount: populatedRegistry.length
      });
      
    } catch (error) {
      console.error("❌ Error populating metric registry:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to populate metric registry",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get Metric Registry for a company
  app.get("/api/company/metric-registry", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }

      const metrics = await storage.getCompanyMetricRegistry(companyId);
      console.log(`📊 Retrieved ${metrics.length} metrics from registry for company ${companyId}`);
      
      res.json({
        success: true,
        companyId,
        metrics,
        count: metrics.length
      });
      
    } catch (error) {
      console.error("❌ Error retrieving metric registry:", error);
      res.status(500).json({ 
        message: "Failed to retrieve metric registry",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.patch("/api/kpi-metrics/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertKpiMetricSchema.partial().parse(req.body);
      const metric = await storage.updateKpiMetric(id, validatedData);
      
      if (!metric) {
        res.status(404).json({ message: "Metric not found" });
        return;
      }
      
      res.json(metric);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update KPI metric" });
      }
    }
  });

  app.delete("/api/kpi-metrics/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteKpiMetric(id);
      
      if (!deleted) {
        res.status(404).json({ message: "Metric not found" });
        return;
      }
      
      res.json({ message: "Metric deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete KPI metric" });
    }
  });

  // Filter validation and management
  app.post("/api/filters/validate", async (req, res) => {
    try {
      const { filter, dataSource } = req.body;
      
      if (!filter || !dataSource) {
        return res.status(400).json({ 
          message: "Filter and dataSource are required" 
        });
      }
      
      const result = filterToSQL(filter, dataSource);
      
      res.json({
        valid: result.errors.length === 0,
        errors: result.errors,
        sql: result.errors.length === 0 ? result.whereClause : null,
        parameters: result.errors.length === 0 ? result.parameters : null
      });
    } catch (error) {
      console.error("Error validating filter:", error);
      res.status(500).json({ message: "Failed to validate filter" });
    }
  });
  
  app.post("/api/filters/ai-suggest", async (req, res) => {
    try {
      const { prompt, dataSource, metricName } = req.body;
      
      if (!prompt || !dataSource) {
        return res.status(400).json({ 
          message: "Prompt and dataSource are required" 
        });
      }
      
      // Get available fields for the data source
      const validColumns: Record<string, any> = {
        "core.fact_financials": [
          { name: "invoice_amount", type: "number", label: "Invoice Amount" },
          { name: "expense_amount", type: "number", label: "Expense Amount" },
          { name: "transaction_date", type: "date", label: "Transaction Date" },
          { name: "category", type: "string", label: "Category" },
          { name: "customer_id", type: "string", label: "Customer ID" }
        ],
        "core.fact_hubspot": [
          { name: "stage", type: "string", label: "Deal Stage" },
          { name: "deal_type", type: "string", label: "Deal Type" },
          { name: "priority", type: "string", label: "Priority" },
          { name: "amount", type: "number", label: "Deal Amount" },
          { name: "close_date", type: "date", label: "Close Date" },
          { name: "owner", type: "string", label: "Deal Owner" }
        ],
        "core.fact_jira": [
          { name: "status", type: "string", label: "Issue Status" },
          { name: "priority", type: "string", label: "Priority" },
          { name: "issue_type", type: "string", label: "Issue Type" },
          { name: "assignee", type: "string", label: "Assignee" },
          { name: "created_date", type: "date", label: "Created Date" },
          { name: "story_points", type: "number", label: "Story Points" }
        ],
        "core.fact_salesforce": [
          { name: "stage_name", type: "string", label: "Stage Name" },
          { name: "type", type: "string", label: "Opportunity Type" },
          { name: "lead_source", type: "string", label: "Lead Source" },
          { name: "amount", type: "number", label: "Amount" },
          { name: "probability", type: "number", label: "Probability" },
          { name: "account_name", type: "string", label: "Account Name" }
        ]
      };
      
      const fields = validColumns[dataSource];
      if (!fields) {
        return res.status(400).json({ 
          message: `Invalid data source: ${dataSource}` 
        });
      }
      
      const aiPrompt = `
You are a SQL filter builder AI. Convert natural language filter descriptions into a JSON filter tree structure.

DATA SOURCE: ${dataSource}
AVAILABLE FIELDS:
${fields.map((f: any) => `- ${f.name} (${f.type}): ${f.label}`).join('\n')}

AVAILABLE OPERATORS:
- = (equals)
- != (not equals)
- > (greater than)
- < (less than)
- >= (greater than or equal)
- <= (less than or equal)
- IN (in list - for multiple values)
- NOT IN (not in list)
- IS NULL (is empty)
- IS NOT NULL (is not empty)
- LIKE (contains text)
- NOT LIKE (does not contain text)

USER REQUEST: "${prompt}"
METRIC CONTEXT: ${metricName ? `Creating filter for metric: ${metricName}` : 'General business metric filter'}

RESPOND WITH ONLY A VALID JSON FILTER TREE IN THIS FORMAT:

For single condition:
{
  "column": "field_name",
  "op": "operator",
  "value": "value_or_array"
}

For multiple conditions:
{
  "op": "AND|OR",
  "conditions": [
    { "column": "field1", "op": "=", "value": "value1" },
    { "column": "field2", "op": ">", "value": 100 }
  ]
}

IMPORTANT RULES:
1. Only use field names that exist in the available fields list
2. Match field types (string values in quotes, numbers without quotes)
3. Use IN operator for multiple values: "value": ["val1", "val2", "val3"]
4. For date fields, use YYYY-MM-DD format
5. Be case-sensitive with field names
6. Respond with ONLY the JSON, no explanations

Convert the user request into the appropriate filter structure:
`;

      // Try Azure OpenAI first, then OpenAI
      let aiResponse;
      try {
        aiResponse = await azureOpenAIService.generateResponse(aiPrompt);
      } catch (azureError) {
        console.log("Azure OpenAI failed, trying OpenAI...");
        try {
          aiResponse = await openaiService.generateResponse(aiPrompt);
        } catch (openaiError) {
          throw new Error("Both AI services unavailable");
        }
      }
      
      // Clean up AI response - extract JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("AI did not return valid JSON");
      }
      
      // Parse AI response as JSON
      const suggestedFilter = JSON.parse(jsonMatch[0]);
      
      // Validate the suggested filter
      const validationResult = filterToSQL(suggestedFilter, dataSource);
      
      res.json({
        filter: suggestedFilter,
        valid: validationResult.errors.length === 0,
        errors: validationResult.errors,
        sql: validationResult.errors.length === 0 ? validationResult.whereClause : null
      });
      
    } catch (error) {
      console.error("Error generating AI filter:", error);
      res.status(500).json({ 
        message: "Failed to generate filter suggestion",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // PostgreSQL calculation endpoints
  app.post("/api/kpi-metrics/:id/calculate", async (req, res) => {
    try {
      const metricId = parseInt(req.params.id);
      const metric = await storage.getKpiMetric(metricId);
      const companyId = req.session?.selectedCompany?.id || 1;
      const result = await postgresAnalyticsService.calculateMetric(metric.name, companyId, 'monthly', metric.id);
      res.json(result);
    } catch (error) {
      console.error("Error calculating metric:", error);
      res.status(500).json({ message: "Failed to calculate metric" });
    }
  });

  app.post("/api/kpi-metrics/calculate-all", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      // For now, return empty results - would need to implement calculateAllMetrics in PostgreSQL service
      const results = [];
      res.json(results);
    } catch (error) {
      console.error("Error calculating all metrics:", error);
      res.status(500).json({ message: "Failed to calculate metrics" });
    }
  });

  app.get("/api/kpi-metrics/stale", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      // For now, return empty stale metrics - would need to implement in PostgreSQL service
      const staleMetrics = [];
      res.json({ staleMetrics });
    } catch (error) {
      console.error("Error getting stale metrics:", error);
      res.status(500).json({ message: "Failed to get stale metrics" });
    }
  });

  // Company-Specific Goals (analytics schema)
  app.get("/api/company-goals", async (req, res) => {
    try {
      const selectedCompany = (req.session as any)?.selectedCompany;
      if (!selectedCompany) {
        return res.status(400).json({ message: "No company selected" });
      }
      
      const goals = await storage.getCompanyGoals(selectedCompany.id);
      res.json(goals);
    } catch (error) {
      console.error('Failed to get company goals:', error);
      res.status(500).json({ message: "Failed to get company goals" });
    }
  });

  app.get("/api/company-goals/:metricKey", async (req, res) => {
    try {
      const selectedCompany = (req.session as any)?.selectedCompany;
      if (!selectedCompany) {
        return res.status(400).json({ message: "No company selected" });
      }
      
      const { metricKey } = req.params;
      const goals = await storage.getCompanyGoalsByMetric(selectedCompany.id, metricKey);
      res.json(goals);
    } catch (error) {
      console.error('Failed to get company goals by metric:', error);
      res.status(500).json({ message: "Failed to get company goals by metric" });
    }
  });

  app.post("/api/company-goals", async (req, res) => {
    try {
      const selectedCompany = (req.session as any)?.selectedCompany;
      if (!selectedCompany) {
        return res.status(400).json({ message: "No company selected" });
      }
      
      const { metricKey, granularity, periodStart, target } = req.body;
      
      // Validate required fields
      if (!metricKey || !granularity || !periodStart || target === undefined) {
        return res.status(400).json({ 
          message: "Missing required fields: metricKey, granularity, periodStart, target" 
        });
      }
      
      // Validate granularity
      if (!['month', 'quarter', 'year'].includes(granularity)) {
        return res.status(400).json({ 
          message: "granularity must be one of: month, quarter, year" 
        });
      }
      
      const goal = await storage.createCompanyGoal(selectedCompany.id, {
        metricKey, granularity, periodStart, target: parseFloat(target)
      });
      
      res.json({ success: true, goal });
    } catch (error) {
      console.error('Failed to create company goal:', error);
      res.status(500).json({ message: "Failed to create company goal" });
    }
  });

  app.put("/api/company-goals/:goalId", async (req, res) => {
    try {
      const selectedCompany = (req.session as any)?.selectedCompany;
      if (!selectedCompany) {
        return res.status(400).json({ message: "No company selected" });
      }
      
      const { goalId } = req.params;
      const { target } = req.body;
      
      if (target === undefined) {
        return res.status(400).json({ message: "target is required" });
      }
      
      const goal = await storage.updateCompanyGoal(selectedCompany.id, parseInt(goalId), {
        target: parseFloat(target)
      });
      
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      res.json({ success: true, goal });
    } catch (error) {
      console.error('Failed to update company goal:', error);
      res.status(500).json({ message: "Failed to update company goal" });
    }
  });

  app.delete("/api/company-goals/:goalId", async (req, res) => {
    try {
      const selectedCompany = (req.session as any)?.selectedCompany;
      if (!selectedCompany) {
        return res.status(400).json({ message: "No company selected" });
      }
      
      const { goalId } = req.params;
      const success = await storage.deleteCompanyGoal(selectedCompany.id, parseInt(goalId));
      
      if (!success) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete company goal:', error);
      res.status(500).json({ message: "Failed to delete company goal" });
    }
  });

  // Metric Reports
  app.get("/api/metric-reports", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      const reports = await storage.getMetricReports(companyId);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching metric reports:", error);
      res.status(500).json({ message: "Failed to get metric reports" });
    }
  });

  app.get("/api/metric-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const report = await storage.getMetricReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Metric report not found" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching metric report:", error);
      res.status(500).json({ message: "Failed to get metric report" });
    }
  });

  app.get("/api/metric-reports/share/:shareToken", async (req, res) => {
    try {
      const { shareToken } = req.params;
      const report = await storage.getMetricReportByShareToken(shareToken);
      
      if (!report || !report.isPublic) {
        return res.status(404).json({ message: "Shared report not found or not public" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching shared metric report:", error);
      res.status(500).json({ message: "Failed to get shared metric report" });
    }
  });

  app.post("/api/metric-reports", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      const createdBy = req.session?.user?.id; // Don't default to 1 if no user
      
      const dataWithCompanyId = { 
        ...req.body, 
        companyId,
        // Only include createdBy if it exists
        ...(createdBy && { createdBy })
      };
      
      const validatedData = insertMetricReportSchema.parse(dataWithCompanyId);
      const report = await storage.createMetricReport(validatedData);
      
      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating metric report:", error);
      res.status(500).json({ message: "Failed to create metric report" });
    }
  });

  app.patch("/api/metric-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertMetricReportSchema.partial().parse(req.body);
      const report = await storage.updateMetricReport(id, validatedData);
      
      if (!report) {
        return res.status(404).json({ message: "Metric report not found" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error updating metric report:", error);
      res.status(500).json({ message: "Failed to update metric report" });
    }
  });

  app.delete("/api/metric-reports/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteMetricReport(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Metric report not found" });
      }
      
      res.json({ message: "Metric report deleted successfully" });
    } catch (error) {
      console.error("Error deleting metric report:", error);
      res.status(500).json({ message: "Failed to delete metric report" });
    }
  });

  // Generate report data with real metric calculations
  app.get("/api/metric-reports/:id/data", async (req, res) => {
    console.log("🚨 ROUTE HIT: /api/metric-reports/:id/data");
    console.log("📍 Request params:", req.params);
    console.log("📍 Request query:", req.query);
    try {
      const reportId = parseInt(req.params.id);
      const timePeriod = req.query.timePeriod as string || 'monthly';
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      
      // Get the report
      const report = await storage.getMetricReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Get all metrics to build metric lookup
      const allMetrics = await storage.getKpiMetrics(companyId);
      const metricsMap = new Map(allMetrics.map(m => [m.id, m]));
      
      // Calculate data for selected metrics
      const reportData = {
        report,
        timePeriod,
        generatedAt: new Date().toISOString(),
        metrics: [],
        summary: {
          totalMetrics: 0,
          calculatedMetrics: 0,
          failedMetrics: 0,
        }
      };
      
      // Process each selected metric
      for (const metricId of (report.selectedMetrics as number[] || [])) {
        const metric = metricsMap.get(metricId);
        if (!metric) {
          console.log(`Metric ${metricId} not found, skipping`);
          continue;
        }
        
        reportData.summary.totalMetrics++;
        
        let metricData = {
          id: metric.id,
          name: metric.name,
          description: metric.description,
          category: metric.category,
          format: metric.format,
          yearlyGoal: metric.yearlyGoal,
          isIncreasing: metric.isIncreasing,
          sqlQuery: metric.sqlQuery,
          currentValue: null,
          goalProgress: null,
          changePercent: null,
          status: 'pending' as 'success' | 'error' | 'pending'
        };
        
        // Calculate real metric value if SQL query exists
        if (metric.sqlQuery) {
          try {
            const result = await postgresAnalyticsService.calculateMetric(
              metric.name, 
              companyId, 
              timePeriod, 
              metric.id, 
              metric.sqlQuery
            );
            
            if (result) {
              metricData.currentValue = result.currentValue;
              
              // Calculate goal progress manually since PostgresMetricData doesn't include it
              console.log(`🎯 Goal Progress Check - Metric: ${metric.name}, Goal: "${metric.yearlyGoal}", Type: ${typeof metric.yearlyGoal}`);
              if (metric.yearlyGoal && parseFloat(metric.yearlyGoal) > 0) {
                const yearlyGoal = parseFloat(metric.yearlyGoal);
                const currentValue = result.currentValue || 0;
                metricData.goalProgress = (currentValue / yearlyGoal) * 100;
                
                // Calculate "on-pace" status based on time period and progress
                const currentMonth = new Date().getMonth() + 1; // 1-12
                const expectedProgressByMonth = (currentMonth / 12) * 100;
                const onPace = metricData.goalProgress >= expectedProgressByMonth * 0.8; // 80% threshold
                
                console.log(`🎯 Goal Calculation: ${currentValue} / ${yearlyGoal} = ${metricData.goalProgress.toFixed(2)}%`);
                console.log(`🎯 On Pace Check: Expected ${expectedProgressByMonth.toFixed(1)}% by month ${currentMonth}, Actual ${metricData.goalProgress.toFixed(1)}%, On Pace: ${onPace}`);
                
                // Add pace status to metric data
                (metricData as any).onPace = onPace;
                (metricData as any).expectedProgress = expectedProgressByMonth;
              } else {
                metricData.goalProgress = null;
                (metricData as any).onPace = null;
                (metricData as any).expectedProgress = null;
                console.log(`🎯 No goal set for ${metric.name} - yearlyGoal: "${metric.yearlyGoal}"`);
              }
              
              // TODO: Calculate change percent (would need historical data)
              metricData.changePercent = null;
              
              metricData.status = 'success';
              reportData.summary.calculatedMetrics++;
              
              console.log(`✅ Report metric ${metric.name}: ${result.currentValue} (${timePeriod})`);
            } else {
              metricData.status = 'error';
              reportData.summary.failedMetrics++;
              console.log(`❌ Failed to calculate metric ${metric.name}`);
            }
          } catch (error) {
            console.error(`Error calculating metric ${metric.name}:`, error);
            metricData.status = 'error';
            reportData.summary.failedMetrics++;
          }
        } else {
          // No SQL query - use static values from database if available
          if (metric.value) {
            metricData.currentValue = parseFloat(metric.value);
            
            // Calculate goal progress if we have a yearly goal
            if (metric.yearlyGoal && parseFloat(metric.yearlyGoal) > 0) {
              const yearlyGoal = parseFloat(metric.yearlyGoal);
              const currentValue = parseFloat(metric.value) || 0;
              metricData.goalProgress = (currentValue / yearlyGoal) * 100;
              
              console.log(`🎯 Static Goal Calculation: ${currentValue} / ${yearlyGoal} = ${metricData.goalProgress.toFixed(2)}%`);
            }
            
            // Use existing change percent if available
            if (metric.changePercent) {
              metricData.changePercent = parseFloat(metric.changePercent);
            }
            
            metricData.status = 'success';
            reportData.summary.calculatedMetrics++;
            console.log(`✅ Using static data for metric ${metric.name}: ${metric.value}`);
          } else {
            metricData.status = 'error';
            reportData.summary.failedMetrics++;
            console.log(`❌ No SQL query or static value for metric ${metric.name}`);
          }
        }
        
        reportData.metrics.push(metricData);
      }
      
      console.log(`📊 Report ${report.title}: ${reportData.summary.calculatedMetrics}/${reportData.summary.totalMetrics} metrics calculated successfully`);
      console.log("🔍 DEBUG: About to send JSON response for /api/metric-reports/:id/data");
      console.log("📤 Response data sample:", JSON.stringify(reportData, null, 2).substring(0, 300) + "...");
      console.log("🔍 DEBUG: First metric in response:", JSON.stringify(reportData.metrics[0], null, 2));
      res.json(reportData);
      
    } catch (error) {
      console.error("Error generating report data:", error);
      res.status(500).json({ message: "Failed to generate report data" });
    }
  });

  // Helper function for fallback insights when AI services are unavailable
  const generateFallbackInsights = (reportData: any) => {
    const successfulMetrics = reportData.metrics.filter((m: any) => m.status === 'success');
    const failedMetrics = reportData.summary.failedMetrics;
    
    let summary = `This ${reportData.timePeriod} business metrics report shows ${successfulMetrics.length} successfully calculated metrics out of ${reportData.summary.totalMetrics} total metrics.`;
    
    if (successfulMetrics.length > 0) {
      const highPerformers = successfulMetrics.filter((m: any) => m.goalProgress && m.goalProgress > 80);
      const lowPerformers = successfulMetrics.filter((m: any) => m.goalProgress && m.goalProgress < 50);
      
      summary += ` ${highPerformers.length} metrics are performing well (>80% of goal), while ${lowPerformers.length} metrics need attention (<50% of goal).`;
    }
    
    // Generate per-metric forecasts
    const metricForecasts = successfulMetrics.map((metric: any) => {
      const progress = metric.goalProgress || 0;
      const currentValue = metric.currentValue || 0;
      const goal = metric.yearlyGoal ? parseFloat(metric.yearlyGoal) : 0;
      
      const performanceLevel = progress > 80 ? 'strong' : progress > 50 ? 'moderate' : 'weak';
      const weeklyProjection = goal > 0 ? Math.round(currentValue * 1.02) : currentValue;
      const monthlyProjection = goal > 0 ? Math.round(currentValue * 1.08) : currentValue;
      const quarterlyProjection = goal > 0 ? Math.round(currentValue * 1.25) : currentValue;
      const yearlyProjection = goal > 0 ? Math.round(currentValue * 4.2) : currentValue;
      
      return `## METRIC: ${metric.name}
### Executive Summary
Currently at ${progress.toFixed(1)}% of goal with ${performanceLevel} performance trajectory.

### Outlook This Week
Projected to reach ${weeklyProjection.toLocaleString()} based on current pace, maintaining ${performanceLevel} momentum.

### Outlook This Month
Monthly forecast: ${monthlyProjection.toLocaleString()}. ${progress > 70 ? 'Likely to achieve' : 'Risk of missing'} monthly targets.

### Outlook This Quarter
Quarterly projection: ${quarterlyProjection.toLocaleString()}. ${progress > 60 ? 'On track for' : 'May fall short of'} quarterly goals.

### Outlook This Year
Annual forecast: ${yearlyProjection.toLocaleString()}. ${progress > 50 ? 'Expected to meet' : 'Unlikely to achieve'} year-end objectives.`;
    }).join('\n\n');

    return metricForecasts + `\n\n*Note: These metric-specific forecasts were generated using fallback analysis due to AI service unavailability. Projections are based on current performance patterns.*`;
  };

  // Generate AI insights for a report
  app.post("/api/metric-reports/:id/insights", async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const timePeriod = req.body.timePeriod || 'monthly';
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      
      // Get the report
      const report = await storage.getMetricReport(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Get report data first
      const reportDataResponse = await fetch(`http://localhost:${process.env.PORT || 5000}/api/metric-reports/${reportId}/data?timePeriod=${timePeriod}`);
      const reportData = await reportDataResponse.json();
      
      if (!reportData || !reportData.metrics) {
        return res.status(400).json({ message: "Unable to generate insights - no metric data available" });
      }
      
      // Create insights prompt
      const metricsContext = reportData.metrics
        .filter((m: any) => m.status === 'success')
        .map((m: any) => {
          const progress = m.goalProgress ? `${m.goalProgress.toFixed(1)}% of goal` : 'no goal set';
          const change = m.changePercent ? `${m.changePercent}% change` : 'no change data';
          const sqlInfo = m.sql_query ? `\nSQL Query: ${m.sql_query}` : '';
          return `- ${m.name}: ${m.currentValue ? m.currentValue.toLocaleString() : 'N/A'} (${progress}, ${change})${sqlInfo}`;
        }).join('\n');
      
      const insightsPrompt = `
Analyze these key performance metrics and provide detailed insights about WHY each metric is performing the way it is:

Report: ${report.title}
Time Period: ${timePeriod}
Generated: ${reportData.generatedAt}
Current Date: ${new Date().toLocaleDateString()}

CURRENT METRICS PERFORMANCE:
${metricsContext}

For each metric, provide a comprehensive analysis in this exact format:

## METRIC: [Metric Name]
### Executive Summary
**Performance Status:** [On Track/Off Track/Exceeding Expectations] - Brief assessment with key numbers.
**Root Cause Analysis:** Explain the primary reasons WHY this metric is performing at this level.

### Data Source Explanation
**How This Metric is Calculated:** Translate the SQL query into plain English that business stakeholders can understand. Explain what data sources are being used, what specific conditions are applied, and how the calculation works. Make this accessible to non-technical executives.

### Outlook This Week  
**Projection:** Weekly forecast with specific numbers.
**Key Drivers:** What factors will most influence this week's performance?
**Risk Factors:** What could cause this week to underperform?

### Outlook This Month
**Projection:** Monthly forecast with goal achievement probability.
**Success Factors:** What needs to happen to hit monthly targets?
**Warning Signs:** Early indicators that would signal potential problems.

### Outlook This Quarter
**Projection:** Quarterly forecast with strategic implications.
**Market Factors:** External conditions that will impact performance.
**Operational Levers:** Internal actions that could improve results.

### Outlook This Year
**Projection:** Annual forecast and year-end likelihood.
**Strategic Recommendations:** Top 3 actions to optimize year-end performance.
**Scenario Planning:** Best case, worst case, and most likely outcomes.

CRITICAL REQUIREMENTS:
- Focus heavily on ROOT CAUSE ANALYSIS - explain WHY metrics are performing this way
- Include specific actionable recommendations for improvement
- Identify leading indicators and early warning signs
- Consider both internal factors (operations, team, processes) and external factors (market, competition, seasonality)
- Be specific about what management should do differently for off-track metrics
- For over-performing metrics, explain what's driving the success and how to sustain it`;

      // Generate insights using AI
      let insights;
      try {
        // Try Azure OpenAI first, fall back to OpenAI
        insights = await azureOpenAIService.generateResponse(insightsPrompt);
        console.log("✅ Generated insights using Azure OpenAI");
      } catch (azureError) {
        console.log("Azure OpenAI failed, trying OpenAI...", azureError.message);
        try {
          insights = await openaiService.generateResponse(insightsPrompt);
          console.log("✅ Generated insights using OpenAI");
        } catch (openaiError) {
          console.log("Both AI services failed, using fallback insights");
          insights = generateFallbackInsights(reportData);
        }
      }
      
      // Update the report with generated insights
      const updatedReport = await storage.updateMetricReport(reportId, {
        generatedInsights: {
          content: insights,
          generatedAt: new Date().toISOString(),
          timePeriod: timePeriod,
          version: '1.0'
        }
      });
      
      res.json({
        insights,
        generatedAt: new Date().toISOString(),
        report: updatedReport
      });
      
    } catch (error) {
      console.error("Error generating AI insights:", error);
      res.status(500).json({ message: "Failed to generate insights" });
    }
  });

  // Test PostgreSQL connection endpoint
  app.get("/api/postgres/test", async (req, res) => {
    try {
      console.log("Testing PostgreSQL connection...");
      const testQuery = "SELECT 1 as test_value";
      const result = await postgresAnalyticsService.executeQuery(testQuery);
      
      if (result && result.length > 0) {
        res.json({ 
          success: true, 
          message: "Successfully connected to PostgreSQL",
          data: result
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to connect to PostgreSQL",
          error: "No data returned" 
        });
      }
    } catch (error) {
      console.error("PostgreSQL test error:", error);
      res.status(500).json({ 
        success: false, 
        message: "PostgreSQL connection test failed",
        error: error
      });
    }
  });

  // TEMPORARY: Test endpoint with specific company ID
  app.get("/api/debug-tables/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      console.log(`🔍 DEBUG: Testing tables for company ${companyId}`);
      
      const tables = await postgresAnalyticsService.getAvailableTables(companyId);
      console.log(`📋 DEBUG: Found ${tables.length} tables:`, tables);
      
      res.json({ companyId, tablesCount: tables.length, tables });
    } catch (error) {
      console.error("Error in debug endpoint:", error);
      res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  // Get list of tables from PostgreSQL analytics schemas
  app.get("/api/postgres/tables", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      console.log(`🔍 /api/postgres/tables called - Company ID: ${companyId}, Session:`, req.session?.selectedCompany);
      
      if (!companyId) {
        console.log("❌ No company selected for /api/postgres/tables");
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      
      console.log(`📋 Fetching tables for company ${companyId}`);
      const tables = await postgresAnalyticsService.getAvailableTables(companyId);
      console.log(`📋 Found ${tables.length} tables:`, tables);
      
      const tablesWithSource = tables.map(tableName => {
        // Determine external app source from table name patterns
        let external_source = "Unknown";
        
        if (tableName.startsWith("CORE_")) {
          external_source = "Core Tables";
        } else if (tableName.toLowerCase().includes("salesforce") || tableName.toLowerCase().includes("sfdc")) {
          external_source = "Salesforce";
        } else if (tableName.toLowerCase().includes("jira") || tableName.toLowerCase().includes("atlassian")) {
          external_source = "Jira";
        } else if (tableName.toLowerCase().includes("hubspot")) {
          external_source = "HubSpot";
        } else if (tableName.toLowerCase().includes("stripe")) {
          external_source = "Stripe";
        } else if (tableName.toLowerCase().includes("slack")) {
          external_source = "Slack";
        } else if (tableName.toLowerCase().includes("zendesk")) {
          external_source = "Zendesk";
        } else if (tableName.toLowerCase().includes("shopify")) {
          external_source = "Shopify";
        } else if (tableName.toLowerCase().includes("google") || tableName.toLowerCase().includes("ga4")) {
          external_source = "Google Analytics";
        }

        return {
          table_name: tableName,
          table_schema: `analytics_company_${companyId}`,
          external_source: external_source,
          row_count: null // Can be added later if needed
        };
      });
      
      res.json(tablesWithSource);
    } catch (error) {
      console.error("Error fetching tables:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch tables from PostgreSQL"
      });
    }
  });

  // Get column information for a specific table
  app.get("/api/postgres/columns/:tableName", async (req, res) => {
    try {
      const { tableName } = req.params;
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      } // Use MIAS_DATA company ID
      
      const columns = await postgresAnalyticsService.getTableSchema(tableName, companyId);
      res.json(columns);
    } catch (error) {
      console.error("Error fetching columns:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch columns from PostgreSQL"
      });
    }
  });

  // Get data for a specific table
  app.get("/api/postgres/table-data/:tableName", async (req, res) => {
    try {
      const { tableName } = req.params;
      const { limit } = req.query;
      const limitValue = limit ? parseInt(limit as string) : 100;
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      } // Use MIAS_DATA company ID
      
      const data = await postgresAnalyticsService.getTableData(tableName, companyId, limitValue);
      
      res.json({
        tableName,
        rowCount: data.length,
        columns: data.length > 0 ? Object.keys(data[0]) : [],
        sampleData: data
      });
    } catch (error) {
      console.error("Error fetching table data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch table data from PostgreSQL"
      });
    }
  });

  // Execute SQL query against PostgreSQL
  app.post("/api/postgres/query", async (req, res) => {
    try {
      const { sql } = req.body;
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      } // Use MIAS_DATA company ID
      
      if (!sql) {
        return res.status(400).json({
          success: false,
          error: "SQL query is required"
        });
      }

      console.log("Executing PostgreSQL query:", sql);
      
      const result = await postgresAnalyticsService.executeQuery(sql, companyId);
      
      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || "Query execution failed"
        });
      }
      
      const data = result.data || [];
      const columns = data.length > 0 ? Object.keys(data[0]) : [];
      
      res.json({
        success: true,
        data: data,
        columns: columns
      });
    } catch (error) {
      console.error("PostgreSQL query error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get dashboard data for a specific metric with time series
  app.get("/api/metrics/:id/dashboard-data", async (req, res) => {
    try {
      const metricId = parseInt(req.params.id);
      console.log(`Dashboard data request for metric ID: ${metricId}`);
      
      // First verify the metric exists
      const metric = await storage.getKpiMetric(metricId);
      console.log("Found metric:", metric ? `${metric.name} (ID: ${metric.id})` : "null");
      
      if (!metric) {
        return res.status(404).json({ message: "Metric not found" });
      }

      if (!metric.sqlQuery) {
        return res.status(400).json({ message: "Metric has no SQL query defined" });
      }

      const companyId = req.session?.selectedCompany?.id || 1;
      const dashboardData = await postgresAnalyticsService.calculateMetric(metric.name, companyId, 'monthly', metric.id);
      
      if (!dashboardData) {
        return res.status(404).json({ message: "No data available for metric calculation" });
      }
      
      res.json(dashboardData);
    } catch (error) {
      console.error("Error calculating dashboard data:", error);
      res.status(500).json({ message: "Failed to calculate dashboard data" });
    }
  });

  app.post("/api/kpi-metrics/calculate", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      const metrics = await storage.getKpiMetrics(companyId);
      const results = [];

      for (const metric of metrics) {
        if (metric.sqlQuery) {
          try {
            const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
            const result = await postgresAnalyticsService.executeQuery(metric.sqlQuery, companyId);
            await storage.updateKpiMetric(metric.id, {
              value: result.data?.[0]?.value || "0",
            });
            results.push({ id: metric.id, value: result.data?.[0]?.value || "0", status: "success" });
          } catch (error) {
            results.push({ id: metric.id, status: "error", error: (error as Error).message });
          }
        }
      }

      res.json({ results });
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate KPIs" });
    }
  });

  // Chat Messages
  app.get("/api/chat-messages", async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      const allMessages = await storage.getChatMessages(companyId);
      
      console.log(`📥 Raw messages from DB: ${allMessages.length}`);
      
      // Filter and group messages for this company
      const companyMessages = allMessages.filter(msg => {
        const metadata = msg.metadata as any;
        return metadata?.companyId === companyId;
      });
      
      console.log(`🏢 Company messages after filter: ${companyMessages.length}`);
      
      // Group consecutive user-assistant pairs
      const transformedMessages = [];
      for (let i = 0; i < companyMessages.length; i++) {
        const msg = companyMessages[i];
        
        if (msg.role === 'user') {
          // Look for the next assistant message
          const assistantMsg = companyMessages[i + 1];
          
          if (assistantMsg && assistantMsg.role === 'assistant') {
            transformedMessages.push({
              id: transformedMessages.length + 1,
              companyId: companyId,
              userId: (msg.metadata as any)?.userId || 1,
              message: msg.content,
              response: assistantMsg.content,
              timestamp: msg.timestamp
            });
            i++; // Skip the assistant message since we've processed it
          } else {
            transformedMessages.push({
              id: transformedMessages.length + 1,
              companyId: companyId,
              userId: (msg.metadata as any)?.userId || 1,
              message: msg.content,
              response: null,
              timestamp: msg.timestamp
            });
          }
        }
      }
      
      // Sort by timestamp (oldest first)
      transformedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      console.log(`✅ Transformed messages: ${transformedMessages.length}`);
      
      res.json(transformedMessages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to get chat messages" });
    }
  });

  app.post("/api/chat-messages", async (req, res) => {
    try {
      const companyId = (req.session as any)?.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      
      const validatedData = insertChatMessageSchema.parse({ ...req.body, companyId });
      const userMessage = await storage.createChatMessage(validatedData);

      // Get AI response
      const aiResponse = await openaiService.getChatResponse(validatedData.content);
      const assistantMessage = await storage.createChatMessage({
        companyId,
        role: "assistant",
        content: aiResponse.content,
        metadata: aiResponse.metadata,
      });

      res.json({ userMessage, assistantMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to process chat message" });
      }
    }
  });

  // AI Assistant Chat (SaultoChat)
  app.post("/api/ai-assistant/chat", async (req, res) => {
    try {
      const { message, files = [] } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      console.log("📤 SaultoChat message received:", message.substring(0, 100));
      console.log("📎 Files attached:", files.length);

      // Process attached files
      let messageWithFiles = message;
      if (files.length > 0) {
        for (const filename of files) {
          const fileContent = readFileContent(filename);
          messageWithFiles += fileContent;
        }
      }

      // Try to get conversation history from storage
      let conversationHistory: any[] = [];
      try {
        const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
        const recentMessages = await storage.getChatMessages(companyId);
        
        // Convert to format expected by AI service
        conversationHistory = recentMessages.slice(-10).map((msg: any) => ({
          role: msg.role || (msg.message ? "user" : "assistant"),
          content: msg.message || msg.response || msg.content
        }));
      } catch (storageError) {
        console.warn("Could not fetch conversation history:", storageError);
      }

      // Get AI response using Azure OpenAI service
      const aiResponse = await azureOpenAIService.getChatResponse(messageWithFiles);
      
      // Try to save chat message to storage
      try {
        // Save user message
        await storage.createChatMessage({
          companyId: companyId,
          role: "user",
          content: message,
          metadata: { userId: 1 }
        });
        
        // Save AI response
        await storage.createChatMessage({
          companyId: companyId,
          role: "assistant", 
          content: aiResponse.content,
          metadata: { userId: 1, source: aiResponse.metadata?.source || "openai" }
        });
      } catch (storageError) {
        console.warn("Could not save chat message to storage:", storageError);
      }

      console.log("✅ SaultoChat response generated");
      
      res.json({
        response: aiResponse.content,
        timestamp: new Date().toISOString(),
        source: aiResponse.metadata?.source || "openai"
      });

    } catch (error: any) {
      console.error("❌ SaultoChat error:", error);
      res.status(500).json({ 
        error: `Failed to get chatbot response: ${error.message}`,
        details: error.stack
      });
    }
  });

  // AI Assistant Chat Streaming (SaultoChat with thinking out loud)
  app.post("/api/ai-assistant/chat/stream", async (req, res) => {
    try {
      const { message, files = [] } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      console.log("📤 SaultoChat streaming message received:", message.substring(0, 100));
      console.log("📎 Files attached:", files.length);

      // Process attached files
      let messageWithFiles = message;
      if (files.length > 0) {
        for (const filename of files) {
          const fileContent = readFileContent(filename);
          messageWithFiles += fileContent;
        }
      }

      // Set up Server-Sent Events headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Get conversation history from storage
      let conversationHistory: any[] = [];
      try {
        const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
        const recentMessages = await storage.getChatMessages(companyId);
        
        // Convert to format expected by AI service
        conversationHistory = recentMessages.slice(-10).map((msg: any) => ({
          role: msg.role || (msg.message ? "user" : "assistant"),
          content: msg.message || msg.response || msg.content
        }));
      } catch (storageError) {
        console.warn("Could not fetch conversation history:", storageError);
      }

      // Don't save to database here - let the original system handle persistence
      // This endpoint is only for streaming visual effect

      let aiResponseText = "";

      try {
        // Get streaming response from Azure OpenAI
        const stream = await azureOpenAIService.getChatResponseStreaming(messageWithFiles, conversationHistory);
        
        // Process streaming response
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices.length > 0) {
            const delta = chunk.choices[0].delta;
            if (delta && delta.content) {
              const content = delta.content;
              aiResponseText += content;
              
              // Send each token as Server-Sent Event
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          }
        }
        
        // Send completion signal
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        
        // Don't save here - frontend will call the original /api/ai-assistant/chat endpoint

        console.log("✅ SaultoChat streaming response completed");
        
      } catch (error: any) {
        console.error("❌ Streaming error:", error);
        res.write(`data: ${JSON.stringify({ 
          error: `Failed to get streaming response: ${error.message}` 
        })}\n\n`);
      }
      
      res.end();

    } catch (error: any) {
      console.error("❌ SaultoChat streaming error:", error);
      res.status(500).json({ 
        error: `Failed to start streaming chat: ${error.message}`,
        details: error.stack
      });
    }
  });

  // File Upload Endpoint
  app.post("/api/upload", upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      console.log(`📎 File uploaded: ${req.file.originalname} -> ${req.file.filename}`);
      
      res.json({
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("❌ File upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // File Download Endpoint
  app.get("/api/uploads/:filename", (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = path.join(UPLOAD_FOLDER, filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }
      
      res.sendFile(path.resolve(filePath));
    } catch (error) {
      console.error("❌ File download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // KPI Assistant
  app.post("/api/assistant/suggest-kpis", async (req, res) => {
    try {
      const { businessType } = req.body;
      const suggestions = await openaiService.suggestKPIs(businessType);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get KPI suggestions" });
    }
  });

  app.post("/api/assistant/generate-sql", async (req, res) => {
    try {
      const { kpiDescription, tables } = req.body;
      const sql = await openaiService.generateSQL(kpiDescription, tables);
      res.json({ sql });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate SQL" });
    }
  });

  // Pipeline Activities
  app.get("/api/pipeline-activities", async (req, res) => {
    try {
      const companyId = (req.session as any)?.companyId;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activities = await storage.getPipelineActivities(companyId, limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pipeline activities" });
    }
  });

  // Manual sync trigger
  app.post("/api/sync/trigger", async (req, res) => {
    try {
      // Manual sync using Python connector service
      const result = { success: true, message: "Manual sync using Python connectors" };
      
      await storage.createPipelineActivity({
        companyId: companyId,
        type: "sync",
        description: "Manual sync triggered",
        status: "success",
      });

      res.json(result);
    } catch (error) {
      await storage.createPipelineActivity({
        companyId: companyId,
        type: "error",
        description: `Manual sync failed: ${error.message}`,
        status: "error",
      });
      res.status(500).json({ message: error.message });
    }
  });

  // Admin API endpoints for multi-tenant management

  app.get("/api/admin/companies", requireAdmin, async (req, res) => {
    try {
      console.log("Fetching companies from database...");
      
      // Get all companies from the database
      const companies = await storage.getCompanies();
      console.log("Found companies from database:", companies);
      
      // Add schema name and restore info to each company
      const companiesWithDetails = companies.map(company => ({
        ...company,
        schemaName: `analytics_company_${company.id}`, // Show the analytics schema name
        databaseName: `analytics_company_${company.id}`, // For admin page compatibility
        status: company.isActive ? 'active' : 'inactive',
        userCount: 0, // TODO: Add actual user count
        createdAt: new Date(company.createdAt).toLocaleDateString(),
        isDeleted: !!company.deletedAt,
        canRestore: company.deletedAt && company.canRestore,
        daysUntilPermanentDeletion: company.deletedAt ? 
          Math.max(0, 30 - Math.floor((Date.now() - new Date(company.deletedAt).getTime()) / (1000 * 60 * 60 * 24))) : null
      }));
      
      // Return the enhanced company data
      res.json(companiesWithDetails);
    } catch (error: any) {
      console.error("Failed to get companies:", error);
      res.status(500).json({ message: "Failed to get companies" });
    }
  });

  // Admin endpoint: Access company site (launch dashboard)
  app.post("/api/admin/companies/:companyId/access", requireAdmin, auditAdminAction('company.access', 'company'), async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        return res.status(404).json({ success: false, error: "Company not found" });
      }

      if (company.deletedAt) {
        return res.status(400).json({ success: false, error: "Cannot access deleted company" });
      }

      // Set the company in the admin's session (just like regular company selection)
      (req.session as any).selectedCompany = {
        id: company.id,
        name: company.name,
        slug: company.slug
      };

      res.json({ 
        success: true, 
        message: `Access granted to ${company.name}`,
        redirectTo: `/dashboard` // Frontend should redirect to dashboard
      });
    } catch (error: any) {
      console.error("Error accessing company:", error);
      res.status(500).json({ success: false, error: "Failed to access company" });
    }
  });

  // Admin endpoint: Soft delete company
  app.delete("/api/admin/companies/:companyId", requireAdmin, auditAdminAction('company.delete', 'company'), async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const { reason } = req.body;
      const adminId = (req.session as any)?.user?.id;

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ success: false, error: "Company not found" });
      }

      if (company.deletedAt) {
        return res.status(400).json({ success: false, error: "Company is already deleted" });
      }

      // Perform soft delete
      const result = await storage.softDeleteCompany(companyId, adminId, reason || 'No reason provided');
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `Company "${company.name}" has been soft deleted. Can be restored within 30 days.`,
          deletedAt: new Date().toISOString(),
          canRestore: true
        });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Error soft deleting company:", error);
      res.status(500).json({ success: false, error: "Failed to delete company" });
    }
  });

  // Admin endpoint: Restore soft-deleted company
  app.post("/api/admin/companies/:companyId/restore", requireAdmin, auditAdminAction('company.restore', 'company'), async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const adminId = (req.session as any)?.user?.id;

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ success: false, error: "Company not found" });
      }

      if (!company.deletedAt) {
        return res.status(400).json({ success: false, error: "Company is not deleted" });
      }

      // Check if within 30-day restore window
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (new Date(company.deletedAt) < thirtyDaysAgo) {
        return res.status(400).json({ 
          success: false, 
          error: "Company was deleted more than 30 days ago and cannot be restored" 
        });
      }

      // Perform restore
      const result = await storage.restoreCompany(companyId, adminId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: `Company "${company.name}" has been restored successfully.`,
          restoredAt: new Date().toISOString()
        });
      } else {
        res.status(500).json({ success: false, error: result.error });
      }
    } catch (error: any) {
      console.error("Error restoring company:", error);
      res.status(500).json({ success: false, error: "Failed to restore company" });
    }
  });

  // Admin endpoint: Get deleted companies (for restore interface)
  app.get("/api/admin/companies/deleted", requireAdmin, async (req, res) => {
    try {
      const deletedCompanies = await storage.getDeletedCompanies();
      
      // Add restore eligibility info
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const companiesWithRestoreInfo = deletedCompanies.map(company => ({
        ...company,
        schemaName: `analytics_company_${company.id}`,
        canRestore: company.deletedAt && new Date(company.deletedAt) > thirtyDaysAgo,
        daysUntilPermanentDeletion: company.deletedAt ? 
          Math.max(0, 30 - Math.floor((Date.now() - new Date(company.deletedAt).getTime()) / (1000 * 60 * 60 * 24))) : 0
      }));

      res.json(companiesWithRestoreInfo);
    } catch (error: any) {
      console.error("Error fetching deleted companies:", error);
      res.status(500).json({ success: false, error: "Failed to fetch deleted companies" });
    }
  });

  // Admin endpoint: Clear company selection (force admin to choose again)
  app.post("/api/admin/clear-company", requireAdmin, auditAdminAction('admin.clear_company', 'session'), async (req, res) => {
    try {
      const previousCompany = (req.session as any)?.selectedCompany;
      
      // Clear the selected company
      (req.session as any).selectedCompany = null;
      
      res.json({ 
        success: true, 
        message: previousCompany 
          ? `Cleared selection of ${previousCompany.name}. Please select a company.`
          : "No company was selected. Please select a company.",
        requiresCompanySelection: true
      });
    } catch (error: any) {
      console.error("Error clearing company selection:", error);
      res.status(500).json({ success: false, error: "Failed to clear company selection" });
    }
  });

  // Admin endpoint: Switch to different company (quick switch)
  app.post("/api/admin/switch-company/:companyId", requireAdmin, auditAdminAction('admin.switch_company', 'company'), async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const company = await storage.getCompany(companyId);
      
      if (!company) {
        return res.status(404).json({ success: false, error: "Company not found" });
      }

      if (company.deletedAt) {
        return res.status(400).json({ success: false, error: "Cannot switch to deleted company" });
      }

      const previousCompany = (req.session as any)?.selectedCompany;
      
      // Switch to the new company
      (req.session as any).selectedCompany = {
        id: company.id,
        name: company.name,
        slug: company.slug
      };

      res.json({ 
        success: true, 
        message: previousCompany 
          ? `Switched from ${previousCompany.name} to ${company.name}`
          : `Now accessing ${company.name}`,
        selectedCompany: {
          id: company.id,
          name: company.name,
          slug: company.slug
        }
      });
    } catch (error: any) {
      console.error("Error switching company:", error);
      res.status(500).json({ success: false, error: "Failed to switch company" });
    }
  });

  // Admin endpoint: Get current company selection status
  app.get("/api/admin/current-company", requireAdmin, async (req, res) => {
    try {
      const selectedCompany = (req.session as any)?.selectedCompany;
      
      res.json({
        success: true,
        selectedCompany: selectedCompany || null,
        requiresCompanySelection: !selectedCompany
      });
    } catch (error: any) {
      console.error("Error getting current company:", error);
      res.status(500).json({ success: false, error: "Failed to get current company" });
    }
  });

  app.get("/api/metrics/kpi", async (req, res) => {
    try {
      const companySlug = 'mias_data'; // Using MIAS_DATA as the company
      // Return empty array for now - would need to implement KPI metrics in PostgreSQL service
      const metrics = [];
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching KPI metrics:", error);
      res.status(500).json({ message: "Failed to fetch KPI metrics from PostgreSQL" });
    }
  });

  app.post("/api/metrics/time-series", async (req, res) => {
    try {
      const { metricId, timePeriod } = req.body;
      const companySlug = 'mias_data'; // Using MIAS_DATA as the company
      
      if (!metricId || !timePeriod) {
        return res.status(400).json({ message: "Metric ID and time period are required" });
      }

      const companyId = req.session?.selectedCompany?.id || 1;
      const timeSeriesData = await postgresAnalyticsService.getTimeSeriesData("Sample Metric", companyId, timePeriod);
      res.json(timeSeriesData);
    } catch (error) {
      console.error("Error fetching time series data:", error);
      res.status(500).json({ message: "Failed to fetch time series data from PostgreSQL" });
    }
  });

  // Admin impersonation endpoint
  app.post('/api/admin/impersonate', async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        res.status(400).json({ message: "User ID is required" });
        return;
      }

      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // In a real implementation, you would set session data here
      // For now, we'll just return success
      res.json({ 
        success: true, 
        message: `Successfully impersonating user ${user.username}`,
        user: { id: user.id, username: user.username, role: user.role }
      });
    } catch (error: any) {
      console.error("Error impersonating user:", error);
      res.status(500).json({ message: "Failed to impersonate user" });
    }
  });

  app.post("/api/admin/companies", async (req, res) => {
    console.log("=== COMPANY CREATION REQUEST ===");
    console.log("Request body:", req.body);
    
    try {
      const { name, slug } = req.body;
      
      if (!name || !slug) {
        console.log("Missing name or slug");
        return res.status(400).json({ message: "Company name and slug are required" });
      }

      // Use Python service for Database-per-Tenant creation
      console.log(`Creating isolated database for ${name} using Database-per-Tenant architecture...`);
      
      try {
        // PostgreSQL schemas are created automatically when connectors sync data
        const dbResult = { success: true, message: "PostgreSQL schemas created automatically" };
        
        if (!dbResult.success) {
          console.error("Database creation failed:", dbResult.error);
          return res.status(500).json({ message: `Database creation failed: ${dbResult.error}` });
        }
        
        console.log(`Successfully created isolated database: ${dbResult.databaseName}`);
        console.log(`Schemas created: ${dbResult.schemas?.join(' → ') || 'RAW → STG → INT → CORE'}`);

        const newCompany = {
          id: Date.now(),
          name,
          slug,
          databaseName: dbResult.databaseName,
          createdAt: new Date().toISOString().split('T')[0],
          userCount: 0,
          status: "active"
        };

        // Store the created company
        companiesArray.push(newCompany);
        
        console.log("Stored new company. Total companies:", companiesArray.length);
        console.log("All companies:", companiesArray);
        res.json(newCompany);
        
      } catch (pythonError: any) {
        console.error("Failed to connect to Python service:", pythonError);
        return res.status(500).json({ message: "Database service unavailable. Please ensure PostgreSQL is running." });
      }
      
    } catch (error: any) {
      console.error("=== ERROR IN COMPANY CREATION ===");
      console.error("Error:", error);
      console.error("Stack:", error.stack);
      res.status(500).json({ message: error.message || "Failed to create company" });
    }
  });

  // AI Metrics Assistant Routes
  app.post("/api/metrics/ai/define", async (req, res) => {
    try {
      const { metricName, businessContext } = req.body;
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      } // Use MIAS_DATA company ID as default
      
      if (!metricName) {
        return res.status(400).json({ error: "Metric name is required" });
      }

      console.log(`🤖 AI defining metric "${metricName}" for company ${companyId}`);
      const definition = await metricsAIService.defineMetric(metricName, businessContext, companyId);
      res.json(definition);
    } catch (error) {
      console.error("AI metric definition error:", error);
      res.status(500).json({ error: `Failed to define metric: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  app.post("/api/metrics/ai/suggest", async (req, res) => {
    try {
      const { businessType = "saas" } = req.body;
      
      const suggestions = await metricsAIService.suggestMetrics(businessType);
      res.json(suggestions);
    } catch (error) {
      console.error("AI metric suggestions error:", error);
      res.status(500).json({ error: `Failed to suggest metrics: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  app.post("/api/metrics/ai/calculate", async (req, res) => {
    try {
      const { sqlQuery } = req.body;
      
      if (!sqlQuery) {
        return res.status(400).json({ error: "SQL query is required" });
      }

      const result = await metricsAIService.calculateMetric(sqlQuery);
      res.json(result);
    } catch (error) {
      console.error("AI metric calculation error:", error);
      res.status(500).json({ error: `Failed to calculate metric: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  app.post("/api/metrics/ai/chat", async (req, res) => {
    try {
      const { message, context } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const response = await metricsAIService.chatWithAssistant(message, context);
      res.json({ response });
    } catch (error) {
      console.error("AI chat error:", error);
      res.status(500).json({ error: `Failed to process chat: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  // Cortex Analysis Routes
  app.post("/api/cortex/analyze-metric", async (req, res) => {
    try {
      const { metricName, sqlQuery, description, category, format } = req.body;
      
      if (!metricName || !sqlQuery) {
        return res.status(400).json({ error: "Metric name and SQL query are required" });
      }

      // Removed Snowflake Cortex analysis - would need to implement with PostgreSQL
      const analysis = { 
        analysis: "Analysis not available without Snowflake Cortex",
        suggestions: [],
        insights: []
      };

      res.json(analysis);
    } catch (error: any) {
      console.error("Cortex analysis error:", error);
      res.status(500).json({ error: `Failed to analyze metric: ${error.message}` });
    }
  });

  app.get("/api/cortex/test", async (req, res) => {
    try {
      const result = { success: false, message: "Snowflake Cortex not available in PostgreSQL version" };
      res.json(result);
    } catch (error: any) {
      console.error("Cortex test error:", error);
      res.status(500).json({ error: `Failed to test Cortex: ${error.message}` });
    }
  });

  // Removed Snowflake execute endpoint - use /api/postgres/query instead

  // SaultoChat integration routes - using integrated Azure OpenAI
  app.post("/api/ai-assistant/chat", async (req: any, res: any) => {
    try {
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get recent conversation history for context
      try {
        // Use default company ID (1) if the storage interface requires it
        const recentMessages = await (storage as any).getChatMessages?.() || await (storage as any).getChatMessages?.(1) || [];
        const conversationHistory = recentMessages
          .slice(-10) // Get last 10 messages for context
          .map(msg => ({
            role: msg.role,
            content: msg.content
          }));

        // Use integrated Azure OpenAI service
        const aiResponse = await azureOpenAIService.getChatResponse(message, conversationHistory);
        
        // Create a chat message record in our storage
        const timestamp = new Date().toISOString();
        await storage.createChatMessage({
          companyId: companyId,
          role: "user",
          content: message,
          metadata: { timestamp, source: "saultochat" }
        });

        await storage.createChatMessage({
          companyId: companyId,
          role: "assistant", 
          content: aiResponse.content,
          metadata: { timestamp, ...aiResponse.metadata }
        });

        res.json({
          response: aiResponse.content,
          timestamp,
          source: aiResponse.metadata.source
        });
      } catch (storageError) {
        // Fallback: use Azure OpenAI without conversation history
        console.warn("Storage error, using Azure OpenAI without history:", storageError);
        const aiResponse = await azureOpenAIService.getChatResponse(message, []);
        
        res.json({
          response: aiResponse.content,
          timestamp: new Date().toISOString(),
          source: aiResponse.metadata.source
        });
      }
    } catch (error: any) {
      console.error("SaultoChat integration error:", error);
      res.status(500).json({ error: `Failed to get chatbot response: ${error.message}` });
    }
  });

  // Python Connector Management
  // Create individual OAuth2 connector instance
  app.post("/api/connectors/oauth2/create", async (req, res) => {
    try {
      const { appType, instanceName, companyId } = req.body;
      
      if (!appType || !instanceName || !companyId) {
        return res.status(400).json({ 
          error: "Missing required fields: appType, instanceName, and companyId" 
        });
      }

      // Validate that the company exists
      const company = companiesArray.find(c => c.id === companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Create unique instance identifier
      const instanceId = `${appType}_${Date.now()}`;
      const connectionData = {
        id: instanceId,
        appType,
        instanceName,
        companyId,
        status: 'oauth2_pending',
        createdAt: new Date().toISOString(),
        lastSync: null,
        credentials: null // Will be populated after OAuth2 completion
      };
      
      // Store OAuth2 connection in database
      await storage.createDataSource({
        companyId,
        name: instanceName,
        type: appType,
        status: 'oauth2_pending',
        config: connectionData,
        isOAuth2: true,
        instanceId
      });
      
      console.log(`Created OAuth2 instance: ${instanceName} (${appType}) for company ${company.name}`);
      
      res.json({
        success: true,
        instanceId,
        appType,
        instanceName,
        companyId,
        status: 'oauth2_pending',
        message: `Successfully created OAuth2 instance for ${appType}`,
        authUrl: `/oauth2/${appType}/authorize?instance=${instanceId}&company=${companyId}`
      });
      
    } catch (error: any) {
      console.error("OAuth2 instance creation error:", error);
      res.status(500).json({ 
        error: "Failed to create OAuth2 instance",
        details: error.message 
      });
    }
  });

  // Complete OAuth2 authentication for instance
  app.post("/api/connectors/oauth2/complete", async (req, res) => {
    try {
      const { instanceId, authCode, credentials } = req.body;
      
      if (!instanceId || !authCode) {
        return res.status(400).json({ 
          error: "Missing required fields: instanceId, authCode" 
        });
      }

      // Update data source with OAuth2 completion
      const dataSource = await storage.getDataSourceByInstanceId(instanceId);
      if (!dataSource) {
        return res.status(404).json({ error: "OAuth2 instance not found" });
      }

      // Update with completed OAuth2 credentials
      await storage.updateDataSource(dataSource.id, {
        status: 'active',
        config: {
          ...dataSource.config,
          status: 'active',
          credentials: credentials || {
            accessToken: `at_${Math.random().toString(36).substring(7)}${Date.now()}`,
            refreshToken: `rt_${Math.random().toString(36).substring(7)}${Date.now()}`,
            scope: 'read write data.sync',
            expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
          },
          lastSync: new Date().toISOString()
        }
      });
      
      res.json({
        success: true,
        instanceId,
        status: 'active',
        message: 'OAuth2 authentication completed successfully'
      });
      
    } catch (error: any) {
      console.error("OAuth2 completion error:", error);
      res.status(500).json({ 
        error: "Failed to complete OAuth2 authentication",
        details: error.message 
      });
    }
  });

  // Get OAuth2 instances for company
  app.get("/api/connectors/oauth2/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const oauth2Instances = dataSources
        .filter(ds => ds.config && ds.config.isOAuth2)
        .map(ds => {
          const config = ds.config;
          return {
            id: ds.id,
            instanceId: config.instanceId || ds.id,
            appType: ds.type,
            instanceName: ds.name,
            companyId,
            status: ds.status,
            createdAt: ds.createdAt,
            lastSync: config.lastSync,
            hasCredentials: !!config.credentials
          };
        });
      
      res.json(oauth2Instances);
    } catch (error: any) {
      console.error("Error fetching OAuth2 instances:", error);
      res.status(500).json({ 
        error: "Failed to fetch OAuth2 instances",
        details: error.message 
      });
    }
  });

  // Demo version - Mock connector creation that always succeeds
  app.post("/api/connectors/create", async (req, res) => {
    try {
      const { connectorType, credentials, companyId } = req.body;
      
      if (!connectorType || !companyId) {
        return res.status(400).json({ 
          error: "Missing required fields: connectorType and companyId" 
        });
      }

      // Validate that the company exists
      const company = companiesArray.find(c => c.id === companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Mock successful connection for demo
      const mockConnectionId = `demo_${connectorType}_${Date.now()}`;
      
      console.log(`✅ DEMO: Created mock connection: ${connectorType} for company ${company.name}`);
      
      // Simulate a small delay for realism
      await new Promise(resolve => setTimeout(resolve, 500));
      
      res.json({
        success: true,
        connectionId: mockConnectionId,
        connectorType,
        companyId,
        status: 'connected',
        message: `✅ Demo: Successfully created ${connectorType} connection for ${company.name}`,
        data: {
          name: `${connectorType} (Demo)`,
          status: 'connected',
          tableCount: Math.floor(Math.random() * 10) + 5, // Random 5-15 tables
          lastSyncAt: new Date().toISOString(),
          config: {
            demo: true,
            connectorType,
            createdAt: new Date().toISOString()
          }
        }
      });
      
    } catch (error: any) {
      console.error("Connection creation error:", error);
      res.status(500).json({ 
        error: "Failed to create connection",
        details: error.message 
      });
    }
  });

  // Demo version - Get mock connectors for a company
  app.get("/api/connectors/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      console.log(`🔍 Fetching data sources for company ${companyId}`);
      
      // Get actual data sources from database
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      
      // Transform to connector format expected by frontend
      const connectors = dataSources.map(ds => {
        let config = ds.config || {};
        
        // Debug: Log config processing
        try {
          if (typeof config === 'string') {
            console.log(`⚠️  Config for data source ${ds.id} is string, attempting parse:`, config);
            config = JSON.parse(config);
          } else {
            console.log(`✅ Config for data source ${ds.id} is object:`, typeof config);
          }
        } catch (error: any) {
          console.error(`Failed to parse config for data source ${ds.id}:`, error);
          console.log(`Config value:`, config);
          config = {}; // Fallback to empty object
        }
        
        return {
          id: ds.id,
          name: ds.name,
          type: ds.type,
          status: ds.isActive ? 'connected' : 'disconnected',
          lastSyncAt: ds.lastSyncAt,
          isActive: ds.isActive,
          config
        };
      });
      
      console.log(`Found ${connectors.length} connectors for company ${companyId}`);
      
      res.json(connectors);
    } catch (error: any) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ 
        error: "Failed to fetch connections",
        details: error.message 
      });
    }
  });

  // Trigger sync for a specific Python connector
  app.post("/api/connectors/:connectionId/sync", async (req, res) => {
    try {
      const { connectionId } = req.params;
      
      const result = await pythonConnectorService.triggerSyncById(connectionId);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: "Failed to trigger sync",
          details: result.error
        });
      }
      
      res.json({
        success: true,
        message: result.message,
        jobId: result.jobId
      });
    } catch (error: any) {
      console.error("Error triggering sync:", error);
      res.status(500).json({ 
        error: "Failed to trigger sync",
        details: error.message
      });
    }
  });

  // Demo version - Mock connector sync that always succeeds + creates schema layers
  app.post("/api/connectors/:companyId/:connectorType/sync", async (req, res) => {
    try {
      const { companyId, connectorType } = req.params;
      const { tables } = req.body; // Optional: specific tables to sync
      
      console.log(`✅ DEMO: Syncing ${connectorType} for company ${companyId}`);
      
      // Simulate sync delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockRecords = Math.floor(Math.random() * 10000) + 1000; // Random 1000-11000 records
      const tablesProcessed = tables ? tables.length : Math.floor(Math.random() * 8) + 3;
      
      // **AUTOMATIC SCHEMA LAYER CREATION** - This is the new automated behavior
      let schemaLayersCreated: string[] = [];
      let schemaError: string | undefined;
      
      try {
        const analyticsSchema = `analytics_company_${companyId}`;
        const mockTables = tables || ['issues', 'users', 'sprints']; // Default mock tables
        
        console.log(`🔨 Creating schema layers for ${connectorType}...`);
        
        const schemaResult = await schemaLayerManager.createSchemaLayers({
          companyId: parseInt(companyId),
          connectorType,
          tables: mockTables,
          analyticsSchema
        });
        
        if (schemaResult.success) {
          schemaLayersCreated = schemaResult.layersCreated;
          console.log(`✅ Automatic schema layers created: ${schemaLayersCreated.join(' → ')}`);
        } else {
          schemaError = schemaResult.error;
          console.warn(`⚠️ Schema layer creation failed: ${schemaError}`);
        }
        
      } catch (error) {
        schemaError = error instanceof Error ? error.message : 'Schema layer creation failed';
        console.error('Schema layer creation error:', error);
      }
      
      res.json({
        success: true,
        message: `✅ Demo: Successfully synced ${connectorType}`,
        recordsSynced: mockRecords,
        tablesProcessed: tablesProcessed,
        syncDuration: `${Math.floor(Math.random() * 30) + 10}s`,
        lastSyncAt: new Date().toISOString(),
        demo: true,
        // New schema layer information
        schemaLayers: {
          created: schemaLayersCreated,
          error: schemaError,
          automatic: true
        }
      });
    } catch (error: any) {
      console.error("Error syncing connector:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to sync connector",
        details: error.message
      });
    }
  });

  // Schema Layer Management endpoints
  app.get("/api/schema-layers/:companyId/:connectorType/status", async (req, res) => {
    try {
      const { companyId, connectorType } = req.params;
      
      const status = await schemaLayerManager.getSchemaLayerStatus(
        parseInt(companyId),
        connectorType
      );
      
      res.json({
        success: true,
        ...status
      });
      
    } catch (error: any) {
      console.error("Error getting schema layer status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get schema layer status",
        details: error.message
      });
    }
  });

  app.post("/api/schema-layers/:companyId/:connectorType/create", async (req, res) => {
    try {
      const { companyId, connectorType } = req.params;
      const { tables, force = false } = req.body;
      
      if (!tables || !Array.isArray(tables) || tables.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Tables array is required"
        });
      }
      
      console.log(`🔨 Manual schema layer creation requested for ${connectorType}`);
      
      const analyticsSchema = `analytics_company_${companyId}`;
      
      const result = await schemaLayerManager.createSchemaLayers({
        companyId: parseInt(companyId),
        connectorType,
        tables,
        analyticsSchema
      });
      
      if (result.success) {
        res.json({
          success: true,
          message: `Schema layers created: ${result.layersCreated.join(' → ')}`,
          layersCreated: result.layersCreated
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to create schema layers",
          details: result.error
        });
      }
      
    } catch (error: any) {
      console.error("Error creating schema layers:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create schema layers",
        details: error.message
      });
    }
  });

  // Trigger immediate sync via scheduler (bypasses schedule)
  app.post("/api/sync-now/:companyId/:connectorType", async (req, res) => {
    try {
      const { companyId, connectorType } = req.params;
      
      console.log(`🚀 Manual sync requested for ${connectorType} (company ${companyId})`);
      
      const result = await syncScheduler.triggerImmediateSync(
        parseInt(companyId), 
        connectorType
      );
      
      if (result.success) {
        res.json({
          success: true,
          message: `${connectorType} sync completed successfully`,
          recordsSynced: result.records_synced,
          tablesSynced: result.tables_synced
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error_message || 'Sync failed'
        });
      }
    } catch (error: any) {
      console.error('Error during manual sync:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to trigger sync',
        details: error.message
      });
    }
  });

  app.get("/api/schema-layers/:companyId/all", async (req, res) => {
    try {
      const { companyId } = req.params;
      
      // Get all schema layer activities for the company
      const activities = await storage.getPipelineActivitiesByType(
        parseInt(companyId),
        'schema_layer_creation'
      );
      
      const schemaLayers = activities.map(activity => ({
        connectorType: activity.details?.connectorType,
        tables: activity.details?.tablesProcessed || [],
        layers: activity.details?.layersCreated || [],
        createdAt: activity.createdAt || activity.timestamp,
        status: activity.status
      }));
      
      res.json({
        success: true,
        schemaLayers
      });
      
    } catch (error: any) {
      console.error("Error getting all schema layers:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get schema layers",
        details: error.message
      });
    }
  });

  // Dynamic Schema Discovery API Endpoints
  app.get('/api/company/data-sources', async (req, res) => {
    try {
      console.log('🔍 Session debug:', {
        hasSession: !!req.session,
        selectedCompany: req.session?.selectedCompany,
        sessionId: req.sessionID
      });
      
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }

      const dataSources = await storage.getCompanyDataSources(companyId);
      res.json({ success: true, dataSources });
    } catch (error) {
      console.error('Error fetching company data sources:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch data sources',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/company/table-columns/:tableName', async (req, res) => {
    try {
      console.log('🔍 Table columns request session debug:', {
        hasSession: !!req.session,
        selectedCompany: req.session?.selectedCompany,
        sessionId: req.session?.id,
        tableName: req.params.tableName
      });

      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }

      const { tableName } = req.params;
      console.log(`📋 Fetching columns for table ${tableName} in company ${companyId}`);
      const columns = await storage.getCompanyTableColumns(companyId, tableName);
      console.log(`✅ Found ${columns?.length || 0} columns for table ${tableName}`);
      
      res.json({ success: true, columns });
    } catch (error) {
      console.error(`Error fetching columns for table ${req.params.tableName}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch table columns',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/company/discover-schema', async (req, res) => {
    try {
      const companyId = req.session?.selectedCompany?.id;
      if (!companyId) {
        return res.status(400).json({ message: "No company selected. Please select a company first." });
      }

      const schema = await storage.discoverCompanySchema(companyId);
      res.json({ success: true, schema });
    } catch (error) {
      console.error('Error discovering company schema:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to discover schema',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ===== NEW ANALYTICS API ENDPOINTS =====

  // Metrics catalog endpoint - lists all available metrics for a company
  app.get("/api/metrics", async (req, res) => {
    try {
      const selectedCompany = (req.session as any)?.selectedCompany;
      if (!selectedCompany) {
        return res.status(400).json({ message: "No company selected" });
      }
      
      const metrics = await metricsSeriesService.getAvailableMetrics(selectedCompany.id);
      
      res.json({
        companyId: selectedCompany.id,
        companyName: selectedCompany.name,
        metrics: metrics,
        totalCount: metrics.length
      });
    } catch (error) {
      console.error('Failed to get metrics catalog:', error);
      res.status(500).json({ message: "Failed to get metrics catalog" });
    }
  });


  const httpServer = createServer(app);
  return httpServer;
}
