import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'snowflake', 'fivetran'
  config: jsonb("config").notNull(),
  status: text("status").notNull().default("disconnected"), // 'connected', 'disconnected', 'error'
  lastSync: timestamp("last_sync"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'salesforce', 'hubspot', 'quickbooks'
  connectorId: text("connector_id"),
  status: text("status").notNull().default("inactive"), // 'active', 'inactive', 'syncing', 'error'
  lastSync: timestamp("last_sync"),
  recordCount: integer("record_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sqlModels = pgTable("sql_models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  layer: text("layer").notNull(), // 'stg', 'int', 'core'
  description: text("description"),
  sqlContent: text("sql_content").notNull(),
  status: text("status").notNull().default("not_deployed"), // 'deployed', 'not_deployed', 'error'
  lastDeployed: timestamp("last_deployed"),
  rowCount: integer("row_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const kpis = pgTable("kpis", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  sqlQuery: text("sql_query").notNull(),
  value: text("value"),
  changePercent: text("change_percent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user', 'assistant'
  sqlGenerated: text("sql_generated"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pipelineRuns = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'full_sync', 'model_deploy', 'kpi_refresh'
  status: text("status").notNull(), // 'running', 'completed', 'failed'
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  logs: text("logs"),
  metadata: jsonb("metadata"),
});

// Insert schemas
export const insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true,
  lastSync: true,
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({
  id: true,
  createdAt: true,
  lastSync: true,
  recordCount: true,
});

export const insertSqlModelSchema = createInsertSchema(sqlModels).omit({
  id: true,
  createdAt: true,
  lastDeployed: true,
  rowCount: true,
});

export const insertKpiSchema = createInsertSchema(kpis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertPipelineRunSchema = createInsertSchema(pipelineRuns).omit({
  id: true,
  startTime: true,
  endTime: true,
});

// Types
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;

export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;

export type InsertSqlModel = z.infer<typeof insertSqlModelSchema>;
export type SqlModel = typeof sqlModels.$inferSelect;

export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type Kpi = typeof kpis.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertPipelineRun = z.infer<typeof insertPipelineRunSchema>;
export type PipelineRun = typeof pipelineRuns.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
