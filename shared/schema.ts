import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric, bigint, unique } from "drizzle-orm/pg-core";
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
  status: text("status").default("active"), // 'active', 'invited', 'disabled', 'suspended', 'locked', 'inactive'
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id),
  role: text("role").default("user"), // 'admin', 'user', 'viewer', 'company_admin'
  permissions: jsonb("permissions").default([]), // Array of permission strings
  mfaEnabled: boolean("mfa_enabled").default(false),
  mfaSecret: text("mfa_secret"), // TOTP secret for 2FA
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

  // Session Management & Security
  loginAttempts: integer("login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  lastActivityAt: timestamp("last_activity_at"),
  sessionCount: integer("session_count").default(0),
  maxSessions: integer("max_sessions").default(3),

  // Password Security
  passwordChangedAt: timestamp("password_changed_at"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  mustChangePassword: boolean("must_change_password").default(false),
  passwordHistory: jsonb("password_history").default([]), // Store last 5 password hashes

  // Account Lifecycle
  accountLockedBy: integer("account_locked_by"),
  accountLockedReason: text("account_locked_reason"),
  accountLockedAt: timestamp("account_locked_at"),
  deactivatedAt: timestamp("deactivated_at"),
  deactivatedBy: integer("deactivated_by"),
  deactivationReason: text("deactivation_reason"),
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

// Session tracking for enhanced security
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionId: text("session_id").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  lastActivity: timestamp("last_activity").defaultNow(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
});

// User invitation system
export const userInvitations = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  role: text("role").notNull(),
  invitedBy: integer("invited_by").references(() => users.id),
  invitationToken: text("invitation_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  status: text("status").default("pending"), // 'pending', 'accepted', 'expired', 'cancelled'
});

// MFA devices for enhanced security
export const mfaDevices = pgTable("mfa_devices", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  deviceName: text("device_name").notNull(),
  deviceType: text("device_type").notNull(), // 'totp', 'sms', 'email'
  secret: text("secret"), // For TOTP
  phoneNumber: text("phone_number"), // For SMS
  isPrimary: boolean("is_primary").default(false),
  verifiedAt: timestamp("verified_at"),
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
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  name: text("name").notNull().unique(),
  layer: text("layer").notNull(), // 'stg', 'int', 'core'
  sqlContent: text("sql_content").notNull(),
  status: text("status").notNull().default("pending"), // 'deployed', 'pending', 'error'
  deployedAt: timestamp("deployed_at"),
  dependencies: text("dependencies").array().default([]),
});

// Metrics table removed - now tenant-specific in analytics_company_{id}.metrics
// Keep type definition for reference

// Metric history table removed - now tenant-specific in analytics_company_{id}.metric_history

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

// Custom validation schemas for tenant-specific tables
export const insertMetricSchema = z.object({
  companyId: z.number().optional(),
  metricKey: z.string(),
  name: z.string(),
  description: z.string().optional(),
  sourceTable: z.string(),
  exprSql: z.string(),
  filters: z.any().optional(),
  dateColumn: z.string().default("created_at"),
  category: z.string().default("revenue"),
  format: z.string().default("currency").optional(),
  unit: z.string().default("count").optional(),
  yearlyGoal: z.string().optional(),
  quarterlyGoals: z.any().optional(),
  monthlyGoals: z.any().optional(),
  goalType: z.string().default("yearly").optional(),
  isIncreasing: z.boolean().default(true).optional(),
  isNorthStar: z.boolean().default(false).optional(),
  useCalculatedField: z.boolean().default(false).optional(),
  calculationType: z.string().optional(),
  dateFromColumn: z.string().optional(),
  dateToColumn: z.string().optional(),
  timeUnit: z.string().optional(),
  conditionalField: z.string().optional(),
  conditionalOperator: z.string().optional(),
  conditionalValue: z.string().optional(),
  convertToNumber: z.boolean().default(false).optional(),
  handleNulls: z.boolean().default(true).optional(),
  tags: z.array(z.string()).optional(),
  priority: z.number().default(1).optional(),
  isActive: z.boolean().default(true).optional(),
});

export const insertMetricHistorySchema = z.object({
  companyId: z.number().optional(),
  metricId: z.number(),
  value: z.string(),
  period: z.string(),
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

// Note: Metric and MetricHistory types are defined below for tenant-specific tables

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
// Goals table removed - now tenant-specific in analytics_company_{id}.goals

// metricRegistry table removed - consolidated into metrics table

// Type definitions for tenant-specific tables (for reference)
export type Metric = {
  id: number;
  companyId: number;
  metricKey: string;
  name: string;
  description?: string;
  sourceTable: string;
  exprSql: string;
  filters?: any;
  dateColumn: string;
  category: string;
  format?: string;
  unit?: string;
  yearlyGoal?: string;
  quarterlyGoals?: any;
  monthlyGoals?: any;
  goalType?: string;
  isIncreasing?: boolean;
  isNorthStar?: boolean;
  useCalculatedField?: boolean;
  calculationType?: string;
  dateFromColumn?: string;
  dateToColumn?: string;
  timeUnit?: string;
  conditionalField?: string;
  conditionalOperator?: string;
  conditionalValue?: string;
  convertToNumber?: boolean;
  handleNulls?: boolean;
  tags?: string[];
  priority?: number;
  isActive?: boolean;
  lastCalculatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export type InsertMetric = Omit<Metric, 'id' | 'createdAt' | 'updatedAt' | 'lastCalculatedAt'>;

export type Goal = {
  id: number;
  metricKey: string;
  granularity: string;
  periodStart: string;
  target: number;
  createdAt?: Date;
};

export type InsertGoal = Omit<Goal, 'id' | 'createdAt'>;

export type MetricHistory = {
  id: number;
  metricId: number;
  date: string;
  actualValue?: number;
  goalValue?: number;
  numerator?: number;
  denominator?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

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

// Note: Goal type is already defined above. Removed duplicate definition.
// MetricRegistry types removed - consolidated into Metric types

// Custom metric categories table (tenant-specific)
export const metricCategories = pgTable("metric_categories", {
  id: serial("id").primaryKey(),
  companyId: bigint("company_id", { mode: "number" }).references(() => companies.id).notNull(),
  name: text("name").notNull(), // e.g., "Marketing", "Finance", "Operations"
  value: text("value").notNull(), // e.g., "marketing", "finance", "operations" (slug)
  color: text("color").default("bg-blue-100 text-blue-800"), // Tailwind color classes
  isDefault: boolean("is_default").default(false), // System default categories
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Ensure unique category values per company
  uniqueCompanyValue: unique().on(table.companyId, table.value),
}));

// Types for new RBAC and audit tables
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Types for metric categories
export type MetricCategory = typeof metricCategories.$inferSelect;
export const insertMetricCategorySchema = createInsertSchema(metricCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMetricCategory = z.infer<typeof insertMetricCategorySchema>;
