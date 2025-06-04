import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { snowflakeService } from "./services/snowflake-stub";
import { dataConnectorService } from "./services/data-connector";
import { openaiService } from "./services/openai";
import { sqlRunner } from "./services/sqlRunner";
import { metricsAIService } from "./services/metrics-ai";
import { snowflakeCortexService } from "./services/snowflake-cortex";
import { snowflakeMetricsService } from "./services/snowflake-metrics";
import { snowflakeCalculatorService } from "./services/snowflake-calculator";
import { snowflakePythonService } from "./services/snowflake-python";
import {
  insertDataSourceSchema,
  insertSqlModelSchema,
  insertKpiMetricSchema,
  insertChatMessageSchema,
  insertPipelineActivitySchema,
} from "@shared/schema";
import { z } from "zod";

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

      // Setup data connectors using Airbyte
      const connectorsResult = await dataConnectorService.setupConnectors();
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
      const result = await sqlRunner.deployModels();
      
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
      const metrics = await storage.getKpiMetrics(1748544793859);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to get KPI metrics" });
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
      const { spawn } = require('child_process');
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

  app.post("/api/kpi-metrics/calculate", async (req, res) => {
    try {
      const metrics = await storage.getKpiMetrics(1748544793859);
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
      const messages = await storage.getChatMessages();
      res.json(messages);
    } catch (error) {
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
      const result = await fivetranService.triggerSync();
      
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

  const httpServer = createServer(app);
  return httpServer;
}
