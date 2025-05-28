import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { snowflakeService } from "./services/snowflake";
import { dataConnectorService } from "./services/data-connector";
import { openaiService } from "./services/openai";
import { sqlRunner } from "./services/sqlRunner";
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
  }
];

export async function registerRoutes(app: Express): Promise<Server> {
  
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
      // Initialize Snowflake connection
      const snowflakeResult = await snowflakeService.testConnection();
      if (!snowflakeResult.success) {
        throw new Error("Failed to connect to Snowflake");
      }

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
      const metrics = await storage.getKpiMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: "Failed to get KPI metrics" });
    }
  });

  app.post("/api/kpi-metrics", async (req, res) => {
    try {
      const validatedData = insertKpiMetricSchema.parse(req.body);
      const metric = await storage.createKpiMetric(validatedData);
      res.json(metric);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create KPI metric" });
      }
    }
  });

  app.post("/api/kpi-metrics/calculate", async (req, res) => {
    try {
      const metrics = await storage.getKpiMetrics();
      const results = [];

      for (const metric of metrics) {
        if (metric.sqlQuery) {
          try {
            const result = await snowflakeService.executeQuery(metric.sqlQuery);
            await storage.updateKpiMetric(metric.id, {
              value: result.value,
              lastCalculatedAt: new Date(),
            });
            results.push({ id: metric.id, value: result.value, status: "success" });
          } catch (error) {
            results.push({ id: metric.id, status: "error", error: error.message });
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

  app.post("/api/admin/companies", async (req, res) => {
    console.log("=== COMPANY CREATION REQUEST ===");
    console.log("Request body:", req.body);
    
    try {
      const { name, slug } = req.body;
      
      if (!name || !slug) {
        console.log("Missing name or slug");
        return res.status(400).json({ message: "Company name and slug are required" });
      }

      console.log(`Testing Snowflake connection first...`);
      
      // Test connection first
      const connectionTest = await snowflakeService.testConnection();
      if (!connectionTest.success) {
        console.error("Snowflake connection test failed:", connectionTest.error);
        return res.status(500).json({ message: `Snowflake connection failed: ${connectionTest.error}` });
      }
      
      console.log("Snowflake connection test passed");

      // Use Python service to create the actual Snowflake database
      console.log(`Creating Snowflake database using Python service...`);
      
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
          console.error("Python service database creation failed:", dbResult.error);
          return res.status(500).json({ message: `Database creation failed: ${dbResult.error}` });
        }
        
        console.log(`Successfully created database: ${dbResult.databaseName}`);

        const newCompany = {
          id: Date.now(),
          name,
          slug,
          databaseName: dbResult.databaseName,
          createdAt: new Date().toISOString().split('T')[0],
          userCount: 0,
          status: "active"
        };
      } catch (pythonError: any) {
        console.error("Failed to connect to Python service:", pythonError);
        return res.status(500).json({ message: "Database service unavailable" });
      }

      // Store the created company
      companiesArray.push(newCompany);
      
      console.log("Stored new company. Total companies:", companiesArray.length);
      console.log("All companies:", companiesArray);
      res.json(newCompany);
      
    } catch (error: any) {
      console.error("=== ERROR IN COMPANY CREATION ===");
      console.error("Error:", error);
      console.error("Stack:", error.stack);
      res.status(500).json({ message: error.message || "Failed to create company" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
