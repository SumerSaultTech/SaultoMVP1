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

  // Test Snowflake connection only
  app.post("/api/test/snowflake", async (_req, res) => {
    try {
      console.log("Testing Snowflake connection only...");
      
      // Test basic connection
      const connectionResult = await snowflakeService.testConnection();
      if (!connectionResult.success) {
        throw new Error(`Snowflake connection failed: ${connectionResult.error}`);
      }

      // Test database creation
      const dbResult = await snowflakeService.createCompanyDatabase("test_company");
      if (!dbResult.success) {
        throw new Error(`Database creation failed: ${dbResult.error}`);
      }

      res.json({ 
        success: true, 
        message: "Snowflake connection and database creation successful!",
        databaseName: dbResult.databaseName 
      });
    } catch (error: any) {
      console.error("Snowflake test failed:", error);
      res.status(500).json({ message: error.message });
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

  const httpServer = createServer(app);
  return httpServer;
}
