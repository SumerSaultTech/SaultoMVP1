import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(), // Used for database naming: company_slug_db
  snowflakeDatabase: text("snowflake_database").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  companyId: integer("company_id").references(() => companies.id),
  role: text("role").default("user"), // 'admin', 'user', 'viewer'
});

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'salesforce', 'hubspot', 'quickbooks'
  status: text("status").notNull().default("disconnected"), // 'connected', 'syncing', 'error', 'disconnected'
  connectorId: text("connector_id"),
  tableCount: integer("table_count").default(0),
  lastSyncAt: timestamp("last_sync_at"),
  config: jsonb("config"),
});

export const sqlModels = pgTable("sql_models", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull().unique(),
  layer: text("layer").notNull(), // 'stg', 'int', 'core'
  sqlContent: text("sql_content").notNull(),
  status: text("status").notNull().default("pending"), // 'deployed', 'pending', 'error'
  deployedAt: timestamp("deployed_at"),
  dependencies: text("dependencies").array().default([]),
});

export const kpiMetrics = pgTable("kpi_metrics", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  value: text("value"),
  changePercent: text("change_percent"),
  sqlQuery: text("sql_query"),
  yearlyGoal: text("yearly_goal"),
  currentProgress: text("current_progress"),
  goalProgress: text("goal_progress"), // percentage as string
  goalType: text("goal_type").default("yearly"), // yearly, quarterly, monthly
  quarterlyGoals: jsonb("quarterly_goals"), // {Q1: value, Q2: value, Q3: value, Q4: value}
  monthlyGoals: jsonb("monthly_goals"), // {Jan: value, Feb: value, ...}
  category: text("category").notNull().default("revenue"), // revenue, growth, retention, efficiency
  priority: integer("priority").default(1), // 1-12 for ordering
  format: text("format").default("currency"), // currency, percentage, number
  isIncreasing: boolean("is_increasing").default(true), // whether higher values are better
  lastCalculatedAt: timestamp("last_calculated_at"),
});

export const metricHistory = pgTable("metric_history", {
  id: serial("id").primaryKey(),
  metricId: integer("metric_id").references(() => kpiMetrics.id),
  value: text("value").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
  period: text("period").notNull(), // daily, weekly, monthly, quarterly
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // 'user', 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});

export const pipelineActivities = pgTable("pipeline_activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'sync', 'deploy', 'error', 'kpi_update'
  description: text("description").notNull(),
  status: text("status").notNull(), // 'success', 'error', 'warning'
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});

export const setupStatus = pgTable("setup_status", {
  id: serial("id").primaryKey(),
  warehouseConnected: boolean("warehouse_connected").default(false),
  dataSourcesConfigured: boolean("data_sources_configured").default(false),
  modelsDeployed: integer("models_deployed").default(0),
  totalModels: integer("total_models").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Insert schemas
export const insertDataSourceSchema = createInsertSchema(dataSources).omit({
  id: true,
  lastSyncAt: true,
});

export const insertSqlModelSchema = createInsertSchema(sqlModels).omit({
  id: true,
  deployedAt: true,
});

export const insertKpiMetricSchema = createInsertSchema(kpiMetrics).omit({
  id: true,
  lastCalculatedAt: true,
});

export const insertMetricHistorySchema = createInsertSchema(metricHistory).omit({
  id: true,
  recordedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertPipelineActivitySchema = createInsertSchema(pipelineActivities).omit({
  id: true,
  timestamp: true,
});

export const insertSetupStatusSchema = createInsertSchema(setupStatus).omit({
  id: true,
  lastUpdated: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;

export type InsertSqlModel = z.infer<typeof insertSqlModelSchema>;
export type SqlModel = typeof sqlModels.$inferSelect;

export type InsertKpiMetric = z.infer<typeof insertKpiMetricSchema>;
export type KpiMetric = typeof kpiMetrics.$inferSelect;

export type InsertMetricHistory = z.infer<typeof insertMetricHistorySchema>;
export type MetricHistory = typeof metricHistory.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertPipelineActivity = z.infer<typeof insertPipelineActivitySchema>;
export type PipelineActivity = typeof pipelineActivities.$inferSelect;

export type InsertSetupStatus = z.infer<typeof insertSetupStatusSchema>;
export type SetupStatus = typeof setupStatus.$inferSelect;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
