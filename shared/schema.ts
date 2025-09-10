import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companies = pgTable("companies", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(), // Used for analytics schema naming: analytics_company_{id}
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  // Soft delete fields
  deletedAt: timestamp("deleted_at"), // When company was soft deleted
  deletedBy: integer("deleted_by"), // Admin who deleted it (no FK to avoid circular ref)
  deleteReason: text("delete_reason"), // Reason for deletion
  canRestore: boolean("can_restore").default(true), // Can be restored within 30 days
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  status: text("status").default("active"), // 'active', 'invited', 'disabled'
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id),
  role: text("role").default("user"), // 'admin', 'user', 'viewer'
  permissions: jsonb("permissions").default([]), // Array of permission strings
  mfaEnabled: boolean("mfa_enabled").default(false),
  mfaSecret: text("mfa_secret"), // TOTP secret for 2FA
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Permissions table for RBAC
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // e.g., 'companies:read', 'users:write'
  description: text("description"),
  category: text("category"), // e.g., 'companies', 'users', 'audit'
  createdAt: timestamp("created_at").defaultNow(),
});

// Role-Permission mapping
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // 'admin', 'user', 'viewer'
  permissionId: integer("permission_id").references(() => permissions.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit log for admin actions
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(), // e.g., 'company.select', 'user.impersonate'
  resource: text("resource"), // e.g., 'company:123', 'user:456'
  details: jsonb("details"), // Additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dataSources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'salesforce', 'hubspot', 'quickbooks'
  status: text("status").notNull().default("disconnected"), // 'connected', 'syncing', 'error', 'disconnected'
  connectorId: text("connector_id"),
  tableCount: integer("table_count").default(0),
  lastSyncAt: timestamp("last_sync_at"),
  config: jsonb("config"),
  credentials: jsonb("credentials"), // Encrypted API credentials
  syncTables: text("sync_tables").array().default([]), // List of tables to sync
  syncFrequency: text("sync_frequency").default("daily"), // 'hourly', 'daily', 'weekly'
  lastSyncRecords: integer("last_sync_records").default(0),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const metrics = pgTable("metrics", {
  // Core Identity
  id: serial("id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  metricKey: text("metric_key").notNull(), // for ETL reference, auto-generated from name
  name: text("name").notNull(),
  description: text("description"),
  
  // Calculation Logic (from metricRegistry)
  sourceTable: text("source_table").notNull(), // e.g., "analytics_company_123.core_jira_issues"
  exprSql: text("expr_sql").notNull(), // SQL expression for calculation
  filters: jsonb("filters"), // JSON filter tree
  dateColumn: text("date_column").notNull().default("created_at"), // date column for time-based queries
  
  // Display & Goals (from kpiMetrics)
  category: text("category").notNull().default("revenue"), // revenue, growth, retention, efficiency
  format: text("format").default("currency"), // currency, percentage, number
  unit: text("unit").default("count"), // measurement unit
  yearlyGoal: text("yearly_goal"),
  quarterlyGoals: jsonb("quarterly_goals"), // {Q1: value, Q2: value, Q3: value, Q4: value}
  monthlyGoals: jsonb("monthly_goals"), // {Jan: value, Feb: value, ...}
  goalType: text("goal_type").default("yearly"), // yearly, quarterly, monthly
  isIncreasing: boolean("is_increasing").default(true), // whether higher values are better
  isNorthStar: boolean("is_north_star").default(false), // whether this is a North Star metric
  
  // Calculated Fields Configuration
  useCalculatedField: boolean("use_calculated_field").default(false),
  calculationType: text("calculation_type"), // time_difference, conditional_count, conditional_sum
  dateFromColumn: text("date_from_column"),
  dateToColumn: text("date_to_column"),
  timeUnit: text("time_unit"), // days, hours, weeks
  conditionalField: text("conditional_field"),
  conditionalOperator: text("conditional_operator"),
  conditionalValue: text("conditional_value"),
  convertToNumber: boolean("convert_to_number").default(false),
  handleNulls: boolean("handle_nulls").default(true),
  
  // Metadata
  tags: jsonb("tags").$type<string[]>(), // array of tags
  priority: integer("priority").default(1), // 1-12 for ordering
  isActive: boolean("is_active").default(true),
  lastCalculatedAt: timestamp("last_calculated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Composite unique constraint: metricKey is unique per company
  companyMetricKey: unique().on(table.companyId, table.metricKey),
}));

export const metricHistory = pgTable("metric_history", {
  id: serial("id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  metricId: integer("metric_id").references(() => metrics.id),
  value: text("value").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
  period: text("period").notNull(), // daily, weekly, monthly, quarterly
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  role: text("role").notNull(), // 'user', 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});

export const pipelineActivities = pgTable("pipeline_activities", {
  id: serial("id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  type: text("type").notNull(), // 'sync', 'deploy', 'error', 'kpi_update'
  description: text("description").notNull(),
  status: text("status").notNull(), // 'success', 'error', 'warning'
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});

export const setupStatus = pgTable("setup_status", {
  id: serial("id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  warehouseConnected: boolean("warehouse_connected").default(false),
  dataSourcesConfigured: boolean("data_sources_configured").default(false),
  modelsDeployed: integer("models_deployed").default(0),
  totalModels: integer("total_models").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const metricReports = pgTable("metric_reports", {
  id: serial("id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  selectedMetrics: jsonb("selected_metrics").notNull(), // Array of metric IDs
  customGroupings: jsonb("custom_groupings"), // Custom category groupings {groupName: [metricIds]}
  reportConfig: jsonb("report_config"), // Report settings and preferences
  generatedInsights: jsonb("generated_insights"), // AI-generated insights cache
  shareToken: text("share_token").unique(), // For public sharing
  isPublic: boolean("is_public").default(false),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const insertMetricSchema = createInsertSchema(metrics).omit({
  id: true,
  lastCalculatedAt: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  companyId: true,
}).extend({
  companyId: z.number().optional(),
});

export const insertMetricHistorySchema = createInsertSchema(metricHistory).omit({
  id: true,
  recordedAt: true,
}).partial({
  companyId: true,
}).extend({
  companyId: z.number().optional(),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
}).partial({
  companyId: true,
}).extend({
  companyId: z.number().optional(),
});

export const insertPipelineActivitySchema = createInsertSchema(pipelineActivities).omit({
  id: true,
  timestamp: true,
}).partial({
  companyId: true,
}).extend({
  companyId: z.number().optional(),
});

export const insertSetupStatusSchema = createInsertSchema(setupStatus).omit({
  id: true,
  lastUpdated: true,
}).partial({
  companyId: true,
}).extend({
  companyId: z.number().optional(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertMetricReportSchema = createInsertSchema(metricReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  shareToken: true,
}).partial({
  companyId: true,
}).extend({
  companyId: z.number().optional(),
});

// Types
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;

export type InsertSqlModel = z.infer<typeof insertSqlModelSchema>;
export type SqlModel = typeof sqlModels.$inferSelect;

export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Metric = typeof metrics.$inferSelect;

export type InsertMetricHistory = z.infer<typeof insertMetricHistorySchema>;
export type MetricHistory = typeof metricHistory.$inferSelect;

export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertPipelineActivity = z.infer<typeof insertPipelineActivitySchema>;
export type PipelineActivity = typeof pipelineActivities.$inferSelect;

export type InsertMetricReport = z.infer<typeof insertMetricReportSchema>;
export type MetricReport = typeof metricReports.$inferSelect;

export type InsertSetupStatus = z.infer<typeof insertSetupStatusSchema>;
export type SetupStatus = typeof setupStatus.$inferSelect;

export type User = typeof users.$inferSelect;
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;

// Metric Registry and Goals Tables
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  tenantId: bigint("tenant_id", { mode: "number" }).references(() => companies.id).notNull(),
  metricKey: text("metric_key").notNull(),
  granularity: text("granularity").notNull(), // 'month', 'quarter', 'year'
  periodStart: text("period_start").notNull(), // date string
  target: numeric("target").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// metricRegistry table removed - consolidated into metrics table

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
  createdAt: true,
}).extend({
  tenantId: z.number().optional(),
});

// insertMetricRegistrySchema removed - consolidated into insertMetricSchema

// Schema validation for new tables
export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

// Types for Goals and Metric Registry
export type Goal = typeof goals.$inferSelect;
export type InsertGoal = z.infer<typeof insertGoalSchema>;
// MetricRegistry types removed - consolidated into Metric types

// Types for new RBAC and audit tables
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
