import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { snowflakeService } from "./services/snowflake";
import { fivetranService } from "./services/fivetran";
import { aiAssistantService } from "./services/ai-assistant";
import { sqlExecutorService } from "./services/sql-executor";
import { insertConnectionSchema, insertDataSourceSchema, insertKpiSchema, insertChatMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize SQL models from file system
  await sqlExecutorService.loadSQLFiles();

  // Health check
  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Dashboard overview
  app.get("/api/dashboard", async (req, res) => {
    try {
      const [connections, dataSources, kpis, latestRun] = await Promise.all([
        storage.getConnections(),
        storage.getDataSources(),
        storage.getActiveKpis(),
        storage.getLatestPipelineRun()
      ]);

      const snowflakeConnection = connections.find(c => c.type === "snowflake");
      const fivetranConnection = connections.find(c => c.type === "fivetran");

      res.json({
        status: {
          snowflake: snowflakeConnection?.status || "disconnected",
          fivetran: fivetranConnection?.status || "disconnected",
          lastSync: latestRun?.endTime || null
        },
        dataSources: dataSources.map(ds => ({
          id: ds.id,
          name: ds.name,
          type: ds.type,
          status: ds.status,
          lastSync: ds.lastSync,
          recordCount: ds.recordCount
        })),
        kpis: kpis.map(kpi => ({
          id: kpi.id,
          name: kpi.name,
          value: kpi.value,
          changePercent: kpi.changePercent
        }))
      });
    } catch (error) {
      console.error("Failed to get dashboard data:", error);
      res.status(500).json({ error: "Failed to load dashboard data" });
    }
  });

  // Connections management
  app.get("/api/connections", async (req, res) => {
    try {
      const connections = await storage.getConnections();
      res.json(connections);
    } catch (error) {
      res.status(500).json({ error: "Failed to get connections" });
    }
  });

  app.post("/api/connections", async (req, res) => {
    try {
      const connectionData = insertConnectionSchema.parse(req.body);
      const connection = await storage.createConnection(connectionData);
      
      // Attempt to connect based on type
      if (connection.type === "snowflake") {
        const connected = await snowflakeService.connect(connection);
        await storage.updateConnection(connection.id, { 
          status: connected ? "connected" : "error" 
        });
      }
      
      res.json(connection);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid connection data", details: error.errors });
      } else {
        console.error("Failed to create connection:", error);
        res.status(500).json({ error: "Failed to create connection" });
      }
    }
  });

  app.patch("/api/connections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const connection = await storage.updateConnection(id, updates);
      
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }
      
      res.json(connection);
    } catch (error) {
      res.status(500).json({ error: "Failed to update connection" });
    }
  });

  // Data sources management
  app.get("/api/data-sources", async (req, res) => {
    try {
      const dataSources = await storage.getDataSources();
      res.json(dataSources);
    } catch (error) {
      res.status(500).json({ error: "Failed to get data sources" });
    }
  });

  app.post("/api/data-sources", async (req, res) => {
    try {
      const dataSourceData = insertDataSourceSchema.parse(req.body);
      const dataSource = await storage.createDataSource(dataSourceData);
      res.json(dataSource);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid data source data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create data source" });
      }
    }
  });

  // Setup and provisioning
  app.post("/api/setup/snowflake", async (req, res) => {
    try {
      const { account, username, password, warehouse, database, schema } = req.body;
      
      const connection = await storage.createConnection({
        name: "Primary Snowflake",
        type: "snowflake",
        config: { account, username, password, warehouse, database, schema },
        status: "connected"
      });

      const connected = await snowflakeService.connect(connection);
      
      if (connected) {
        // Create warehouse, database, and schema
        await snowflakeService.createWarehouse(warehouse);
        await snowflakeService.createDatabase(database);
        await snowflakeService.createSchema(database, schema);
        
        await storage.updateConnection(connection.id, { status: "connected" });
        res.json({ success: true, connectionId: connection.id });
      } else {
        await storage.updateConnection(connection.id, { status: "error" });
        res.status(400).json({ error: "Failed to connect to Snowflake" });
      }
    } catch (error) {
      console.error("Snowflake setup failed:", error);
      res.status(500).json({ error: "Snowflake setup failed" });
    }
  });

  app.post("/api/setup/fivetran-connectors", async (req, res) => {
    try {
      const { salesforce, hubspot, quickbooks } = req.body;
      const results = [];
      
      if (salesforce) {
        try {
          const connector = await fivetranService.createSalesforceConnector(salesforce);
          const dataSource = await storage.createDataSource({
            name: "Salesforce",
            type: "salesforce",
            connectorId: connector.id,
            status: "active"
          });
          results.push({ type: "salesforce", success: true, dataSourceId: dataSource.id });
        } catch (error) {
          results.push({ type: "salesforce", success: false, error: error instanceof Error ? error.message : "Unknown error" });
        }
      }
      
      if (hubspot) {
        try {
          const connector = await fivetranService.createHubSpotConnector(hubspot);
          const dataSource = await storage.createDataSource({
            name: "HubSpot",
            type: "hubspot",
            connectorId: connector.id,
            status: "active"
          });
          results.push({ type: "hubspot", success: true, dataSourceId: dataSource.id });
        } catch (error) {
          results.push({ type: "hubspot", success: false, error: error instanceof Error ? error.message : "Unknown error" });
        }
      }
      
      if (quickbooks) {
        try {
          const connector = await fivetranService.createQuickBooksConnector(quickbooks);
          const dataSource = await storage.createDataSource({
            name: "QuickBooks",
            type: "quickbooks",
            connectorId: connector.id,
            status: "active"
          });
          results.push({ type: "quickbooks", success: true, dataSourceId: dataSource.id });
        } catch (error) {
          results.push({ type: "quickbooks", success: false, error: error instanceof Error ? error.message : "Unknown error" });
        }
      }
      
      res.json({ results });
    } catch (error) {
      console.error("Fivetran setup failed:", error);
      res.status(500).json({ error: "Fivetran setup failed" });
    }
  });

  // SQL Models and deployment
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getSqlModels();
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: "Failed to get models" });
    }
  });

  app.get("/api/models/layer/:layer", async (req, res) => {
    try {
      const layer = req.params.layer;
      const models = await storage.getSqlModelsByLayer(layer);
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: "Failed to get models by layer" });
    }
  });

  app.post("/api/models/deploy", async (req, res) => {
    try {
      const { layers } = req.body;
      const result = await sqlExecutorService.deployModels(layers);
      res.json(result);
    } catch (error) {
      console.error("Model deployment failed:", error);
      res.status(500).json({ error: "Model deployment failed" });
    }
  });

  app.post("/api/models", async (req, res) => {
    try {
      const { name, layer, sql, description } = req.body;
      const model = await sqlExecutorService.createModelFromSQL(name, layer, sql, description);
      res.json(model);
    } catch (error) {
      console.error("Failed to create model:", error);
      res.status(500).json({ error: "Failed to create model" });
    }
  });

  // KPIs management
  app.get("/api/kpis", async (req, res) => {
    try {
      const kpis = await storage.getKpis();
      res.json(kpis);
    } catch (error) {
      res.status(500).json({ error: "Failed to get KPIs" });
    }
  });

  app.post("/api/kpis", async (req, res) => {
    try {
      const kpiData = insertKpiSchema.parse(req.body);
      const kpi = await storage.createKpi(kpiData);
      res.json(kpi);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid KPI data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create KPI" });
      }
    }
  });

  app.post("/api/kpis/:id/refresh", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const kpi = await storage.getKpi(id);
      
      if (!kpi) {
        return res.status(404).json({ error: "KPI not found" });
      }
      
      const result = await snowflakeService.getQueryResult(kpi.sqlQuery);
      const value = Object.values(result)[0] as string;
      
      const updatedKpi = await storage.updateKpi(id, { 
        value: value.toString(),
        updatedAt: new Date()
      });
      
      res.json(updatedKpi);
    } catch (error) {
      console.error("Failed to refresh KPI:", error);
      res.status(500).json({ error: "Failed to refresh KPI" });
    }
  });

  // AI Assistant
  app.post("/api/ai/suggest-kpis", async (req, res) => {
    try {
      const { businessType, schema } = req.body;
      const suggestions = await aiAssistantService.suggestKPIs(businessType, schema);
      res.json({ suggestions });
    } catch (error) {
      console.error("Failed to get KPI suggestions:", error);
      res.status(500).json({ error: "Failed to get KPI suggestions" });
    }
  });

  app.post("/api/ai/generate-sql", async (req, res) => {
    try {
      const { request, schema } = req.body;
      const result = await aiAssistantService.generateSQL(request, schema);
      res.json(result);
    } catch (error) {
      console.error("Failed to generate SQL:", error);
      res.status(500).json({ error: "Failed to generate SQL" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { message, context } = req.body;
      
      // Save user message
      await storage.createChatMessage({
        content: message,
        role: "user"
      });
      
      const response = await aiAssistantService.chatWithAssistant(message, context);
      
      // Save AI response
      await storage.createChatMessage({
        content: response,
        role: "assistant"
      });
      
      res.json({ response });
    } catch (error) {
      console.error("AI chat failed:", error);
      res.status(500).json({ error: "AI chat failed" });
    }
  });

  app.get("/api/chat/messages", async (req, res) => {
    try {
      const messages = await storage.getChatMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to get chat messages" });
    }
  });

  // Table browser
  app.get("/api/tables", async (req, res) => {
    try {
      const { schema } = req.query;
      const tables = await snowflakeService.getTables(schema as string);
      res.json(tables);
    } catch (error) {
      console.error("Failed to get tables:", error);
      res.status(500).json({ error: "Failed to get tables" });
    }
  });

  // Pipeline operations
  app.post("/api/pipeline/sync", async (req, res) => {
    try {
      const run = await storage.createPipelineRun({
        type: "full_sync",
        status: "running"
      });

      // Trigger sync for all connectors
      const dataSources = await storage.getDataSources();
      const syncResults = [];
      
      for (const dataSource of dataSources) {
        if (dataSource.connectorId) {
          const success = await fivetranService.syncConnector(dataSource.connectorId);
          syncResults.push({ dataSource: dataSource.name, success });
          
          if (success) {
            await storage.updateDataSource(dataSource.id, { 
              status: "syncing",
              lastSync: new Date()
            });
          }
        }
      }

      await storage.updatePipelineRun(run.id, {
        status: "completed",
        endTime: new Date(),
        metadata: { syncResults }
      });

      res.json({ success: true, runId: run.id, results: syncResults });
    } catch (error) {
      console.error("Pipeline sync failed:", error);
      res.status(500).json({ error: "Pipeline sync failed" });
    }
  });

  app.get("/api/pipeline/runs", async (req, res) => {
    try {
      const runs = await storage.getPipelineRuns();
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get pipeline runs" });
    }
  });

  // Execute custom SQL
  app.post("/api/sql/execute", async (req, res) => {
    try {
      const { sql } = req.body;
      const result = await sqlExecutorService.executeCustomSQL(sql);
      res.json(result);
    } catch (error) {
      console.error("SQL execution failed:", error);
      res.status(500).json({ error: "SQL execution failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
