import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { snowflakeService } from "./services/snowflake";
import { pythonConnectorService } from "./services/python-connector-service";
import { openaiService } from "./services/openai";
import { metricsAIService } from "./services/metrics-ai";
import { snowflakeCortexService } from "./services/snowflake-cortex";
import { snowflakeMetricsService } from "./services/snowflake-metrics";
import { snowflakeCalculatorService } from "./services/snowflake-calculator";
import { snowflakePythonService } from "./services/snowflake-python";
import { azureOpenAIService } from "./services/azure-openai";
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
} from "@shared/schema";
import { z } from "zod";


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
  
  // Health check endpoint with service status
  app.get("/api/health", async (req, res) => {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        main: "running",
        snowflake: "unknown",
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

    // Check Snowflake service (if available)
    try {
      const response = await fetch("http://localhost:5001/health", { signal: AbortSignal.timeout(2000) });
      health.services.snowflake = response.ok ? "running" : "error";
    } catch (error) {
      health.services.snowflake = "offline";
    }

    res.json(health);
  });
  
  // Companies
  app.get("/api/companies", async (req, res) => {
    try {
      res.json(companiesArray.map(company => ({
        id: company.id,
        name: company.name,
        slug: company.slug,
        snowflakeDatabase: company.databaseName,
        isActive: company.status === "active"
      })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get companies" });
    }
  });

  app.post("/api/companies", async (req, res) => {
    try {
      const { name, slug, snowflakeDatabase } = req.body;
      const newCompany = {
        id: Date.now(),
        name,
        slug,
        databaseName: snowflakeDatabase,
        createdAt: new Date().toISOString().split('T')[0],
        userCount: 0,
        status: "active"
      };
      companiesArray.push(newCompany);
      res.json({
        id: newCompany.id,
        name: newCompany.name,
        slug: newCompany.slug,
        snowflakeDatabase: newCompany.databaseName,
        isActive: true
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  // Users
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
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
  
  // Setup Status
  app.get("/api/setup-status", async (req, res) => {
    try {
      const status = await storage.getSetupStatus();
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
      // Use Python service for reliable Snowflake operations

      // Create company database automatically (using demo company for now)
      const companySlug = "demo_company";
      const dbCreation = await snowflakeService.createCompanyDatabase(companySlug);
      if (!dbCreation.success) {
        throw new Error(`Failed to create company database: ${dbCreation.error}`);
      }

      console.log(`Created company database: ${dbCreation.databaseName}`);

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
        type: "sync",
        description: "One-click setup completed successfully",
        status: "success",
      });

      res.json({ success: true, message: "Setup completed successfully" });
    } catch (error) {
      await storage.createPipelineActivity({
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
      const metrics = await storage.getKpiMetrics(1);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to get KPI metrics" });
    }
  });

  // Get dashboard metrics data with calculated values
  app.get("/api/dashboard/metrics-data", async (req, res) => {
    try {
      console.log("=== Dashboard metrics data request ===");
      const timePeriod = req.query.timePeriod as string || 'ytd';
      console.log(`Time period filter: ${timePeriod}`);
      
      const metrics = await storage.getKpiMetrics(1);
      console.log(`Found ${metrics.length} metrics for dashboard`);
      
      const dashboardData = [];

      for (const metric of metrics) {
        console.log(`Processing metric: ${metric.name} (ID: ${metric.id}) for period: ${timePeriod}`);
        if (metric.sqlQuery) {
          try {
            // Use calculateDashboardData with the time period parameter
            const dashboardResult = await snowflakeCalculatorService.calculateDashboardData(metric.id, timePeriod);
            
            if (dashboardResult) {
              console.log(`Dashboard data for metric ${metric.name}: ${dashboardResult.currentValue} from dashboard calculation (${timePeriod})`);
              dashboardData.push(dashboardResult);
            } else {
              console.log(`No dashboard data available for metric ${metric.name}`);
              // Add fallback with zero values
              dashboardData.push({
                metricId: metric.id,
                currentValue: 0,
                yearlyGoal: parseFloat(metric.yearlyGoal || "0"),
                format: metric.format || "currency",
                timeSeriesData: {
                  weekly: [],
                  monthly: [],
                  quarterly: [],
                  ytd: []
                }
              });
            }
          } catch (error) {
            console.error(`Error calculating metric ${metric.name}:`, error);
            // Provide fallback data structure with zero values
            dashboardData.push({
              metricId: metric.id,
              currentValue: 0,
              yearlyGoal: parseFloat(metric.yearlyGoal || "0"),
              format: metric.format || "number",
              timeSeriesData: {
                weekly: [
                  { period: "Week 1", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 52 },
                  { period: "Week 2", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 52 },
                  { period: "Week 3", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 52 },
                  { period: "Week 4", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 52 }
                ],
                monthly: [
                  { period: "Jan", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Feb", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Mar", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Apr", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "May", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Jun", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Jul", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Aug", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Sep", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Oct", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Nov", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 },
                  { period: "Dec", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 12 }
                ],
                quarterly: [
                  { period: "Q1", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 4 },
                  { period: "Q2", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 4 },
                  { period: "Q3", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 4 },
                  { period: "Q4", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") / 4 }
                ],
                ytd: [
                  { period: "YTD", actual: 0, goal: parseFloat(metric.yearlyGoal || "0") }
                ]
              }
            });
          }
        }
      }

      res.json(dashboardData);
    } catch (error) {
      console.error("Error fetching dashboard metrics data:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics data" });
    }
  });

  app.post("/api/kpi-metrics", async (req, res) => {
    try {
      // Use MIAS_DATA company ID for metric creation
      const dataWithCompanyId = { ...req.body, companyId: 1748544793859 };
      console.log("Creating metric for MIAS_DATA company:", JSON.stringify(dataWithCompanyId, null, 2));
      const validatedData = insertKpiMetricSchema.parse(dataWithCompanyId);
      const metric = await storage.createKpiMetric(validatedData);
      console.log("Successfully saved metric:", metric.name);
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

  // New Snowflake calculation endpoints
  app.post("/api/kpi-metrics/:id/calculate", async (req, res) => {
    try {
      const metricId = parseInt(req.params.id);
      const result = await snowflakeCalculatorService.calculateMetric(metricId);
      res.json(result);
    } catch (error) {
      console.error("Error calculating metric:", error);
      res.status(500).json({ message: "Failed to calculate metric" });
    }
  });

  app.post("/api/kpi-metrics/calculate-all", async (req, res) => {
    try {
      const companyId = 1748544793859; // MIAS_DATA company ID
      const results = await snowflakeCalculatorService.calculateAllMetrics(companyId);
      res.json(results);
    } catch (error) {
      console.error("Error calculating all metrics:", error);
      res.status(500).json({ message: "Failed to calculate metrics" });
    }
  });

  app.get("/api/kpi-metrics/stale", async (req, res) => {
    try {
      const companyId = 1748544793859; // MIAS_DATA company ID
      const staleMetrics = await snowflakeCalculatorService.getStaleMetrics(companyId);
      res.json({ staleMetrics });
    } catch (error) {
      console.error("Error getting stale metrics:", error);
      res.status(500).json({ message: "Failed to get stale metrics" });
    }
  });

  // Test Snowflake connection endpoint
  app.get("/api/snowflake/test", async (req, res) => {
    try {
      console.log("Testing Snowflake connection...");
      const testQuery = "SELECT 1 as test_value";
      const result = await snowflakeCalculatorService.testConnection(testQuery);
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: "Successfully connected to MIAS_DATA_DB",
          data: result.data
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Failed to connect to MIAS_DATA_DB",
          error: result.error 
        });
      }
    } catch (error) {
      console.error("Snowflake test error:", error);
      res.status(500).json({ 
        success: false, 
        message: "MIAS_DATA_DB connection test failed" 
      });
    }
  });

  // Get list of tables from MIAS_DATA_DB
  app.get("/api/snowflake/tables", async (req, res) => {
    try {
      const tablesQuery = `
        SELECT 
          TABLE_NAME,
          TABLE_SCHEMA,
          ROW_COUNT
        FROM MIAS_DATA_DB.INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA IN ('CORE', 'STG', 'INT')
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `;
      
      const result = await snowflakePythonService.executeQuery(tablesQuery);
      
      if (result.success) {
        res.json(result.data || []);
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Failed to fetch tables"
        });
      }
    } catch (error) {
      console.error("Error fetching tables:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch tables from MIAS_DATA_DB"
      });
    }
  });

  // Get column information for a specific table
  app.get("/api/snowflake/columns/:tableName", async (req, res) => {
    try {
      const { tableName } = req.params;
      
      const columnsQuery = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE
        FROM MIAS_DATA_DB.INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = 'CORE' 
        AND TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `;
      
      const result = await snowflakePythonService.executeQuery(columnsQuery);
      
      if (result.success) {
        res.json(result.data || []);
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Failed to fetch columns"
        });
      }
    } catch (error) {
      console.error("Error fetching columns:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch columns from MIAS_DATA_DB"
      });
    }
  });

  // Get data for a specific table
  app.get("/api/snowflake/table-data/:tableName", async (req, res) => {
    try {
      const { tableName } = req.params;
      const { limit } = req.query;
      const limitValue = limit ? parseInt(limit as string) : 100;
      
      // Simplified query - just get the data
      const dataQuery = `SELECT * FROM MIAS_DATA_DB.CORE.${tableName} LIMIT ${limitValue}`;
      
      console.log('Executing query:', dataQuery);
      const result = await snowflakePythonService.executeQuery(dataQuery);
      
      if (result.success && result.data) {
        const sampleData = result.data;
        const columns = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];
        
        console.log('Success! Got', sampleData.length, 'rows with columns:', columns);
        
        // Get row count in separate call if needed
        const rowCount = sampleData.length;
        
        res.json({
          tableName,
          rowCount,
          columns,
          sampleData
        });
      } else {
        console.error('Query failed:', result.error);
        res.status(500).json({
          success: false,
          error: result.error || "Failed to fetch table data"
        });
      }
    } catch (error) {
      console.error("Error fetching table data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch table data from MIAS_DATA_DB"
      });
    }
  });

  // Execute SQL query against MIAS_DATA_DB
  app.post("/api/snowflake/query", async (req, res) => {
    try {
      const { sql } = req.body;
      
      if (!sql) {
        return res.status(400).json({
          success: false,
          error: "SQL query is required"
        });
      }

      console.log("Executing SQL query:", sql);
      
      // Use the dedicated Python service for reliable execution
      const result = await new Promise<any>((resolve) => {
        const pythonProcess = spawn('python', ['snowflake_query_service.py', sql], {
          cwd: process.cwd()
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code: number) => {
          if (code === 0 && output) {
            try {
              const result = JSON.parse(output);
              resolve(result);
            } catch (e) {
              resolve({ success: false, error: "Failed to parse result" });
            }
          } else {
            resolve({ success: false, error: errorOutput || "Process failed" });
          }
        });
      });
      
      if (result.success) {
        // Format columns for frontend
        const columns = result.data && result.data.length > 0 
          ? Object.keys(result.data[0]) 
          : [];
        
        res.json({
          success: true,
          data: result.data || [],
          columns: columns
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || "Query execution failed"
        });
      }
    } catch (error) {
      console.error("SQL query error:", error);
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

      const { snowflakeCalculatorService } = await import("./services/snowflake-calculator");
      
      const dashboardData = await snowflakeCalculatorService.calculateDashboardData(metricId);
      
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
      const metrics = await storage.getKpiMetrics(1);
      const results = [];

      for (const metric of metrics) {
        if (metric.sqlQuery) {
          try {
            const result = await snowflakeService.executeQuery(metric.sqlQuery);
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
      const companyId = 1748544793859; // MIAS_DATA company ID
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
      const validatedData = insertChatMessageSchema.parse(req.body);
      const userMessage = await storage.createChatMessage(validatedData);

      // Get AI response
      const aiResponse = await openaiService.getChatResponse(validatedData.content);
      const assistantMessage = await storage.createChatMessage({
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
        const companyId = 1748544793859; // MIAS_DATA company ID
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
          role: "user",
          content: message,
          metadata: { companyId: 1748544793859, userId: 1 }
        });
        
        // Save AI response
        await storage.createChatMessage({
          role: "assistant", 
          content: aiResponse.content,
          metadata: { companyId: 1748544793859, userId: 1, source: aiResponse.metadata?.source || "openai" }
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
        const companyId = 1748544793859; // MIAS_DATA company ID
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
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const activities = await storage.getPipelineActivities(limit);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to get pipeline activities" });
    }
  });

  // Manual sync trigger
  app.post("/api/sync/trigger", async (req, res) => {
    try {
      // TODO: Replace with Python connector sync
      const result = { success: true, message: "Fivetran service removed - using Python connectors" };
      
      await storage.createPipelineActivity({
        type: "sync",
        description: "Manual sync triggered",
        status: "success",
      });

      res.json(result);
    } catch (error) {
      await storage.createPipelineActivity({
        type: "error",
        description: `Manual sync failed: ${error.message}`,
        status: "error",
      });
      res.status(500).json({ message: error.message });
    }
  });

  // Admin API endpoints for multi-tenant management

  app.get("/api/admin/companies", async (req, res) => {
    try {
      console.log("Fetching companies, current list:", companiesArray);
      res.json(companiesArray);
    } catch (error: any) {
      console.error("Failed to get companies:", error);
      res.status(500).json({ message: "Failed to get companies" });
    }
  });



  app.get("/api/metrics/kpi", async (req, res) => {
    try {
      const companySlug = 'mias_data'; // Using MIAS_DATA as the company
      const metrics = await snowflakeMetricsService.getKPIMetrics(companySlug);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching KPI metrics:", error);
      res.status(500).json({ message: "Failed to fetch KPI metrics from Snowflake" });
    }
  });

  app.post("/api/metrics/time-series", async (req, res) => {
    try {
      const { metricId, timePeriod } = req.body;
      const companySlug = 'mias_data'; // Using MIAS_DATA as the company
      
      if (!metricId || !timePeriod) {
        return res.status(400).json({ message: "Metric ID and time period are required" });
      }

      const timeSeriesData = await snowflakeMetricsService.getTimeSeriesData(companySlug, metricId, timePeriod);
      res.json(timeSeriesData);
    } catch (error) {
      console.error("Error fetching time series data:", error);
      res.status(500).json({ message: "Failed to fetch time series data from Snowflake" });
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
        const pythonResponse = await fetch('http://localhost:5001/api/create-snowflake-db', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            company_name: name,
            company_slug: slug
          })
        });

        const dbResult = await pythonResponse.json();
        
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
        return res.status(500).json({ message: "Database service unavailable. Please ensure Snowflake credentials are configured." });
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
      
      if (!metricName) {
        return res.status(400).json({ error: "Metric name is required" });
      }

      const definition = await metricsAIService.defineMetric(metricName, businessContext);
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

      const analysis = await snowflakeCortexService.analyzeMetricWithCortex({
        metricName,
        sqlQuery,
        description: description || "",
        category: category || "general",
        format: format || "number"
      });

      res.json(analysis);
    } catch (error: any) {
      console.error("Cortex analysis error:", error);
      res.status(500).json({ error: `Failed to analyze metric: ${error.message}` });
    }
  });

  app.get("/api/cortex/test", async (req, res) => {
    try {
      const result = await snowflakeCortexService.testCortexConnection();
      res.json(result);
    } catch (error: any) {
      console.error("Cortex test error:", error);
      res.status(500).json({ error: `Failed to test Cortex: ${error.message}` });
    }
  });

  // Snowflake SQL execution route
  app.post("/api/snowflake/execute", async (req, res) => {
    try {
      const { sql } = req.body;
      
      if (!sql) {
        return res.status(400).json({ error: "SQL query is required" });
      }

      const result = await snowflakeService.executeQuery(sql);
      res.json(result);
    } catch (error: any) {
      console.error("SQL execution error:", error);
      res.status(500).json({ error: `Failed to execute SQL: ${error.message}` });
    }
  });

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
          role: "user",
          content: message,
          metadata: { timestamp, source: "saultochat" }
        });

        await storage.createChatMessage({
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
  app.post("/api/connectors/create", async (req, res) => {
    try {
      const { connectorType, credentials, companyId } = req.body;
      
      if (!connectorType || !credentials || !companyId) {
        return res.status(400).json({ 
          error: "Missing required fields: connectorType, credentials, and companyId" 
        });
      }

      // Validate that the company exists
      const company = companiesArray.find(c => c.id === companyId);
      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // Create Python connector
      const result = await pythonConnectorService.createConnectorWithConfig({
        service: connectorType,
        config: { ...credentials, companyId }
      });
      
      console.log(`Created connection: ${connectorType} for company ${company.name}`);
      console.log(`Connection ID: ${result.id}`);
      
      res.json({
        success: true,
        connectionId: result.id,
        connectorType,
        companyId,
        status: result.status,
        message: `Successfully created ${connectorType} connection for ${company.name}`,
        data: {
          name: result.name,
          status: result.status,
          tableCount: result.tableCount,
          lastSyncAt: result.lastSyncAt,
          config: result.config
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

  // Get Python connectors for a company
  app.get("/api/connectors/:companyId", async (req, res) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      // Get available connector types from Python service
      const availableResult = await pythonConnectorService.getAvailableConnectors();
      
      if (!availableResult.success) {
        return res.status(500).json({ 
          error: "Failed to fetch available connectors",
          details: availableResult.error 
        });
      }
      
      // Check status for each connector type that might exist for this company
      const connectionsWithStatus = [];
      
      if (availableResult.connectors) {
        for (const connector of availableResult.connectors) {
          const status = await pythonConnectorService.getConnectorStatus(companyId, connector.name);
          
          // Only include connectors that exist (have been configured)
          if (status.exists) {
            connectionsWithStatus.push({
              id: `python_${connector.name}_${companyId}`,
              connectionId: `python_${connector.name}_${companyId}`,
              sourceType: connector.name,
              companyId: companyId,
              status: status.status,
              createdAt: new Date(), // We don't track creation time in the simple connector
              lastSync: null, // We don't track last sync time in the simple connector
              recordsSynced: 0
            });
          }
        }
      }
      
      res.json(connectionsWithStatus);
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

  // Direct connector sync route for setup page
  app.post("/api/connectors/:companyId/:connectorType/sync", async (req, res) => {
    try {
      const { companyId, connectorType } = req.params;
      const { tables } = req.body; // Optional: specific tables to sync
      
      const result = await pythonConnectorService.syncConnector(
        parseInt(companyId), 
        connectorType, 
        tables
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error syncing connector:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to sync connector",
        details: error.message
      });
    }
  });

  // Debug endpoint for Snowflake schema issues
  app.post("/api/debug/snowflake-schema", async (req, res) => {
    try {
      console.log("🔧 Debug: Testing Snowflake schema access...");
      
      // Test basic Snowflake connection
      const basicTest = await snowflakeService.executeQuery('SELECT CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_USER()');
      console.log("Basic test result:", basicTest);
      
      // Test SHOW TABLES (faster than information_schema)
      const tablesTest = await snowflakeService.executeQuery('SHOW TABLES IN SCHEMA MIAS_DATA_DB.CORE');
      console.log("Tables test result:", tablesTest);
      
      // Test simple schema query
      const schemaTest = await snowflakeService.executeQuery(`
        SELECT table_name, column_name, data_type
        FROM MIAS_DATA_DB.information_schema.columns
        WHERE table_schema = 'CORE'
        LIMIT 5
      `);
      console.log("Schema test result:", schemaTest);
      
      res.json({
        basicTest,
        tablesTest,
        schemaTest,
        message: "Check server logs for detailed output"
      });
    } catch (error) {
      console.error("Debug error:", error);
      res.status(500).json({ error: `Debug failed: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
