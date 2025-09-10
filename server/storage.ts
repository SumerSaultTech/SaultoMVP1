import {
  companies,
  dataSources,
  sqlModels,
  metrics,
  chatMessages,
  pipelineActivities,
  setupStatus,
  users,
  metricReports,
  goals,
  type Company,
  type InsertCompany,
  type DataSource,
  type SqlModel,
  type Metric,
  type ChatMessage,
  type PipelineActivity,
  type SetupStatus,
  type User,
  type MetricReport,
  type Goal,
  type InsertDataSource,
  type InsertSqlModel,
  type InsertMetric,
  type InsertChatMessage,
  type InsertPipelineActivity,
  type InsertSetupStatus,
  type InsertUser,
  type InsertMetricReport,
  type InsertGoal,
} from "@shared/schema";

// Import postgres and drizzle for DatabaseStorage
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, eq, and, desc, isNotNull, isNull } from 'drizzle-orm';

// Import tenant-scoped query builder for multi-tenant safety
import { 
  createTenantScopedSQL, 
  getTenantTable, 
  getTenantMetricRegistry,
  getTenantGoals,
  getTenantTables,
  getTenantTableColumns,
  validateTenantSchema,
  ensureTenantSchema,
  type TenantQueryBuilder
} from './services/tenant-query-builder';


export interface IStorage {
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  deleteCompany(companyId: number): Promise<{ success: boolean; error?: string }>;
  // Soft delete methods
  softDeleteCompany(companyId: number, deletedBy: number, reason: string): Promise<{ success: boolean; error?: string }>;
  restoreCompany(companyId: number, restoredBy: number): Promise<{ success: boolean; error?: string }>;
  getDeletedCompanies(): Promise<Company[]>;

  // Users
  getUsers(): Promise<User[]>;
  getUsersByCompany(companyId: number): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;

  // Data Sources (company-scoped)
  getDataSources(companyId: number): Promise<DataSource[]>;
  getDataSource(id: number): Promise<DataSource | undefined>;
  createDataSource(dataSource: InsertDataSource): Promise<DataSource>;
  updateDataSource(id: number, updates: Partial<InsertDataSource>): Promise<DataSource | undefined>;
  getDataSourcesByCompany(companyId: number): Promise<DataSource[]>;
  getDataSourceByInstanceId(instanceId: string): Promise<DataSource | undefined>;
  updateDataSourceSyncTime(companyId: number, connectorType: string, syncTime: Date): Promise<void>;

  // SQL Models (company-scoped)
  getSqlModels(companyId: number): Promise<SqlModel[]>;
  getSqlModelsByLayer(companyId: number, layer: string): Promise<SqlModel[]>;
  getSqlModel(id: number): Promise<SqlModel | undefined>;
  getSqlModelByName(companyId: number, name: string): Promise<SqlModel | undefined>;
  createSqlModel(model: InsertSqlModel): Promise<SqlModel>;
  updateSqlModel(id: number, updates: Partial<InsertSqlModel>): Promise<SqlModel | undefined>;

  // Metrics (company-scoped)
  getMetrics(companyId: number): Promise<Metric[]>;
  getMetric(id: number): Promise<Metric | undefined>;
  createMetric(metric: InsertMetric): Promise<Metric>;
  updateMetric(id: number, updates: Partial<InsertMetric>): Promise<Metric | undefined>;
  deleteMetric(id: number): Promise<boolean>;
  
  // Legacy aliases for backward compatibility
  getKpiMetrics(companyId: number): Promise<Metric[]>;
  getKpiMetric(id: number): Promise<Metric | undefined>;
  createKpiMetric(metric: InsertMetric): Promise<Metric>;
  updateKpiMetric(id: number, updates: Partial<InsertMetric>): Promise<Metric | undefined>;
  deleteKpiMetric(id: number): Promise<boolean>;

  // Chat Messages (company-scoped)
  getChatMessages(companyId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Pipeline Activities (company-scoped)
  getPipelineActivities(companyId: number, limit?: number): Promise<PipelineActivity[]>;
  createPipelineActivity(activity: InsertPipelineActivity): Promise<PipelineActivity>;

  // Setup Status (company-scoped)
  getSetupStatus(companyId: number): Promise<SetupStatus | undefined>;
  updateSetupStatus(companyId: number, updates: Partial<InsertSetupStatus>): Promise<SetupStatus>;

  // Metric Reports (company-scoped)
  getMetricReports(companyId: number): Promise<MetricReport[]>;
  getMetricReport(id: number): Promise<MetricReport | undefined>;
  getMetricReportByShareToken(shareToken: string): Promise<MetricReport | undefined>;
  createMetricReport(report: InsertMetricReport): Promise<MetricReport>;
  updateMetricReport(id: number, updates: Partial<InsertMetricReport>): Promise<MetricReport | undefined>;
  deleteMetricReport(id: number): Promise<boolean>;

  // Goals (tenant-scoped)
  getGoals(tenantId: number): Promise<Goal[]>;
  getGoalsByMetric(tenantId: number, metricKey: string): Promise<Goal[]>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal | undefined>;
  deleteGoal(id: number): Promise<boolean>;

  // Metric Registry (company-specific)
  setupCompanyMetricRegistry(companyId: number): Promise<{ success: boolean; error?: string }>;
  getCompanyMetricRegistry(companyId: number): Promise<MetricRegistry[]>;
  getCompanyMetricRegistryEntry(companyId: number, metricKey: string): Promise<MetricRegistry | undefined>;
  createCompanyMetricRegistryEntry(companyId: number, entry: InsertMetricRegistry): Promise<MetricRegistry>;
  updateCompanyMetricRegistryEntry(companyId: number, metricKey: string, updates: Partial<InsertMetricRegistry>): Promise<MetricRegistry | undefined>;
  deleteCompanyMetricRegistryEntry(companyId: number, metricKey: string): Promise<boolean>;
  
  // Company-Specific Goals (analytics schema)
  getCompanyGoals(companyId: number): Promise<any[]>;
  getCompanyGoalsByMetric(companyId: number, metricKey: string): Promise<any[]>;
  createCompanyGoal(companyId: number, goal: { metricKey: string; granularity: 'month' | 'quarter' | 'year'; periodStart: string; target: number }): Promise<any>;
  updateCompanyGoal(companyId: number, goalId: number, updates: { target?: number }): Promise<any>;
  deleteCompanyGoal(companyId: number, goalId: number): Promise<boolean>;
  refreshCompanyGoalsDaily(companyId: number): Promise<void>;
  
  // Schema Layer Operations
  executeQuery(query: string): Promise<{ success: boolean; data?: any[]; error?: string }>;
  checkTableExists(schema: string, tableName: string): Promise<boolean>;
  
  // Dynamic Schema Introspection
  getCompanyDataSources(companyId: number): Promise<{ sourceType: string; tables: string[]; displayName: string }[]>;
  getCompanyTableColumns(companyId: number, tableName: string): Promise<{ columnName: string; dataType: string; description?: string }[]>;
  discoverCompanySchema(companyId: number): Promise<{ [sourceType: string]: { displayName: string; tables: { [tableName: string]: { columnName: string; dataType: string; description?: string }[] } } }>;
  getPipelineActivitiesByType(companyId: number, activityType: string): Promise<PipelineActivity[]>;
  insertPipelineActivity(activity: InsertPipelineActivity): Promise<PipelineActivity>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private dataSources: Map<number, DataSource>;
  private sqlModels: Map<number, SqlModel>;
  protected kpiMetrics: Map<number, KpiMetric>;
  private chatMessages: Map<number, ChatMessage>;
  private pipelineActivities: Map<number, PipelineActivity>;
  protected metricReports: Map<number, MetricReport>;
  private setupStatus: SetupStatus | undefined;
  protected currentId: number;

  constructor() {
    this.users = new Map();
    this.dataSources = new Map();
    this.sqlModels = new Map();
    this.kpiMetrics = new Map();
    this.chatMessages = new Map();
    this.pipelineActivities = new Map();
    this.metricReports = new Map();
    this.currentId = 1;

    // Initialize with default setup status
    this.setupStatus = {
      id: 1,
      warehouseConnected: false,
      dataSourcesConfigured: false,
      modelsDeployed: 0,
      totalModels: 0,
      lastUpdated: new Date(),
    };
  }

  // Users
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.companyId === companyId);
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { 
      ...insertUser, 
      id,
      companyId: insertUser.companyId || null,
      role: insertUser.role || "user",
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      email: insertUser.email || null,
      status: insertUser.status || "active",
      createdAt: insertUser.createdAt || new Date().toISOString(),
      updatedAt: insertUser.updatedAt || new Date().toISOString(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser: User = {
      ...existingUser,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Data Sources
  async getDataSources(): Promise<DataSource[]> {
    return Array.from(this.dataSources.values());
  }

  async getDataSource(id: number): Promise<DataSource | undefined> {
    return this.dataSources.get(id);
  }

  async createDataSource(insertDataSource: InsertDataSource): Promise<DataSource> {
    const id = this.currentId++;
    const dataSource: DataSource = { ...insertDataSource, id, lastSyncAt: null };
    this.dataSources.set(id, dataSource);
    return dataSource;
  }

  async updateDataSource(id: number, updates: Partial<InsertDataSource>): Promise<DataSource | undefined> {
    const existing = this.dataSources.get(id);
    if (!existing) return undefined;
    
    const updated: DataSource = { ...existing, ...updates };
    this.dataSources.set(id, updated);
    return updated;
  }

  // OAuth2 specific data source methods
  async getDataSourcesByCompany(companyId: number): Promise<DataSource[]> {
    return Array.from(this.dataSources.values()).filter(ds => 
      ds.companyId === companyId
    );
  }

  async getDataSourceByInstanceId(instanceId: string): Promise<DataSource | undefined> {
    return Array.from(this.dataSources.values()).find(ds => {
      if (ds.config) {
        try {
          const config = JSON.parse(ds.config);
          return config.instanceId === instanceId;
        } catch (e) {
          return false;
        }
      }
      return false;
    });
  }

  async updateDataSourceSyncTime(companyId: number, connectorType: string, syncTime: Date): Promise<void> {
    // Find the data source by company and type
    for (const [id, dataSource] of this.dataSources.entries()) {
      if (dataSource.companyId === companyId && dataSource.type === connectorType) {
        // Update the lastSyncAt time
        this.dataSources.set(id, { ...dataSource, lastSyncAt: syncTime });
        console.log(`✅ Updated ${connectorType} sync time for company ${companyId} (Mock)`);
        return;
      }
    }
    
    console.warn(`⚠️ No ${connectorType} data source found for company ${companyId} (Mock)`);
  }

  // SQL Models
  async getSqlModels(): Promise<SqlModel[]> {
    return Array.from(this.sqlModels.values());
  }

  async getSqlModelsByLayer(layer: string): Promise<SqlModel[]> {
    return Array.from(this.sqlModels.values()).filter(model => model.layer === layer);
  }

  async getSqlModel(id: number): Promise<SqlModel | undefined> {
    return this.sqlModels.get(id);
  }

  async getSqlModelByName(name: string): Promise<SqlModel | undefined> {
    return Array.from(this.sqlModels.values()).find(model => model.name === name);
  }

  async createSqlModel(insertModel: InsertSqlModel): Promise<SqlModel> {
    const id = this.currentId++;
    const model: SqlModel = { ...insertModel, id, deployedAt: null };
    this.sqlModels.set(id, model);
    return model;
  }

  async updateSqlModel(id: number, updates: Partial<InsertSqlModel>): Promise<SqlModel | undefined> {
    const existing = this.sqlModels.get(id);
    if (!existing) return undefined;
    
    const updated: SqlModel = { ...existing, ...updates };
    this.sqlModels.set(id, updated);
    return updated;
  }

  // KPI Metrics (company-scoped)
  async getKpiMetrics(companyId: number): Promise<KpiMetric[]> {
    return Array.from(this.kpiMetrics.values()).filter(metric => metric.companyId === companyId);
  }

  async getKpiMetric(id: number): Promise<KpiMetric | undefined> {
    return this.kpiMetrics.get(id);
  }

  async getKpiMetricById(id: number): Promise<KpiMetric | undefined> {
    return this.kpiMetrics.get(id);
  }

  async createKpiMetric(insertMetric: InsertKpiMetric): Promise<KpiMetric> {
    const id = this.currentId++;
    const metric: KpiMetric = { ...insertMetric, id, lastCalculatedAt: null };
    this.kpiMetrics.set(id, metric);
    return metric;
  }

  async updateKpiMetric(id: number, updates: Partial<InsertKpiMetric>): Promise<KpiMetric | undefined> {
    const existing = this.kpiMetrics.get(id);
    if (!existing) return undefined;
    
    const updated: KpiMetric = { ...existing, ...updates };
    this.kpiMetrics.set(id, updated);
    return updated;
  }

  async deleteKpiMetric(id: number): Promise<boolean> {
    return this.kpiMetrics.delete(id);
  }

  // Chat Messages
  async getChatMessages(companyId: number): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.companyId === companyId)
      .sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentId++;
    const message: ChatMessage = { ...insertMessage, id, timestamp: new Date() };
    this.chatMessages.set(id, message);
    return message;
  }

  // Pipeline Activities
  async getPipelineActivities(companyId: number, limit = 50): Promise<PipelineActivity[]> {
    return Array.from(this.pipelineActivities.values())
      .filter(activity => activity.companyId === companyId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async createPipelineActivity(insertActivity: InsertPipelineActivity): Promise<PipelineActivity> {
    const id = this.currentId++;
    const activity: PipelineActivity = { ...insertActivity, id, timestamp: new Date() };
    this.pipelineActivities.set(id, activity);
    return activity;
  }

  async getPipelineActivitiesByType(companyId: number, activityType: string): Promise<PipelineActivity[]> {
    return Array.from(this.pipelineActivities.values())
      .filter(activity => 
        activity.companyId === companyId && 
        activity.activityType === activityType
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async insertPipelineActivity(activity: InsertPipelineActivity): Promise<PipelineActivity> {
    return this.createPipelineActivity(activity);
  }

  async executeQuery(query: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    console.warn('MemStorage.executeQuery called - returning mock success for schema layer operations');
    return { success: true, data: [] };
  }

  async checkTableExists(schema: string, tableName: string): Promise<boolean> {
    console.warn(`MemStorage.checkTableExists called for ${schema}.${tableName} - returning true for demo`);
    return true;
  }

  // Setup Status
  async getSetupStatus(companyId: number): Promise<SetupStatus | undefined> {
    // In memory storage, we simulate company-specific setup status
    // In a real implementation, this would be filtered by companyId
    return this.setupStatus;
  }

  async updateSetupStatus(companyId: number, updates: Partial<InsertSetupStatus>): Promise<SetupStatus> {
    if (!this.setupStatus) {
      this.setupStatus = {
        id: 1,
        companyId: companyId,
        warehouseConnected: false,
        dataSourcesConfigured: false,
        modelsDeployed: 0,
        totalModels: 0,
        lastUpdated: new Date(),
        ...updates,
      };
    } else {
      this.setupStatus = { ...this.setupStatus, ...updates, lastUpdated: new Date() };
    }
    return this.setupStatus;
  }

  // Metric Reports
  async getMetricReports(companyId: number): Promise<MetricReport[]> {
    return Array.from(this.metricReports.values()).filter(report => report.companyId === companyId);
  }

  async getMetricReport(id: number): Promise<MetricReport | undefined> {
    return this.metricReports.get(id);
  }

  async getMetricReportByShareToken(shareToken: string): Promise<MetricReport | undefined> {
    return Array.from(this.metricReports.values()).find(report => report.shareToken === shareToken);
  }

  async createMetricReport(insertReport: InsertMetricReport): Promise<MetricReport> {
    const id = this.currentId++;
    const now = new Date();
    const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const report: MetricReport = {
      ...insertReport,
      id,
      shareToken,
      createdAt: now,
      updatedAt: now,
      companyId: insertReport.companyId, // Company ID must be provided
    };
    
    this.metricReports.set(id, report);
    return report;
  }

  async updateMetricReport(id: number, updates: Partial<InsertMetricReport>): Promise<MetricReport | undefined> {
    const existing = this.metricReports.get(id);
    if (!existing) return undefined;
    
    const updated: MetricReport = { 
      ...existing, 
      ...updates, 
      updatedAt: new Date() 
    };
    
    this.metricReports.set(id, updated);
    return updated;
  }

  async deleteMetricReport(id: number): Promise<boolean> {
    return this.metricReports.delete(id);
  }

  // Goals (stub implementations for MemStorage)
  async getGoals(tenantId: number): Promise<Goal[]> {
    console.warn('MemStorage.getGoals called - returning empty array');
    return [];
  }

  async getGoalsByMetric(tenantId: number, metricKey: string): Promise<Goal[]> {
    console.warn('MemStorage.getGoalsByMetric called - returning empty array');
    return [];
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    console.warn('MemStorage.createGoal called - returning mock goal');
    return { id: 1, ...goal, createdAt: new Date() } as Goal;
  }

  async updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal | undefined> {
    console.warn('MemStorage.updateGoal called - returning undefined');
    return undefined;
  }

  async deleteGoal(id: number): Promise<boolean> {
    console.warn('MemStorage.deleteGoal called - returning false');
    return false;
  }

  // Company-specific Metric Registry (stub implementations for MemStorage)
  async setupCompanyMetricRegistry(companyId: number): Promise<{ success: boolean; error?: string }> {
    console.warn(`MemStorage.setupCompanyMetricRegistry called for company ${companyId} - returning success`);
    return { success: true };
  }

  async getCompanyMetricRegistry(companyId: number): Promise<MetricRegistry[]> {
    console.warn(`MemStorage.getCompanyMetricRegistry called for company ${companyId} - returning empty array`);
    return [];
  }

  async getCompanyMetricRegistryEntry(companyId: number, metricKey: string): Promise<MetricRegistry | undefined> {
    console.warn(`MemStorage.getCompanyMetricRegistryEntry called for company ${companyId} - returning undefined`);
    return undefined;
  }

  async createCompanyMetricRegistryEntry(companyId: number, entry: InsertMetricRegistry): Promise<MetricRegistry> {
    console.warn(`MemStorage.createCompanyMetricRegistryEntry called for company ${companyId} - returning mock entry`);
    return { ...entry, createdAt: new Date(), updatedAt: new Date() } as MetricRegistry;
  }

  async updateCompanyMetricRegistryEntry(companyId: number, metricKey: string, updates: Partial<InsertMetricRegistry>): Promise<MetricRegistry | undefined> {
    console.warn(`MemStorage.updateCompanyMetricRegistryEntry called for company ${companyId} - returning undefined`);
    return undefined;
  }

  async deleteCompanyMetricRegistryEntry(companyId: number, metricKey: string): Promise<boolean> {
    console.warn(`MemStorage.deleteCompanyMetricRegistryEntry called for company ${companyId} - returning false`);
    return false;
  }

  // Dynamic Schema Introspection (stub implementations for MemStorage)
  async getCompanyDataSources(companyId: number): Promise<{ sourceType: string; tables: string[]; displayName: string }[]> {
    console.warn(`MemStorage.getCompanyDataSources called for company ${companyId} - returning mock data`);
    return [
      { sourceType: 'jira', tables: ['jira_issues', 'jira_projects'], displayName: 'Jira' },
      { sourceType: 'salesforce', tables: ['salesforce_opportunities', 'salesforce_accounts'], displayName: 'Salesforce' }
    ];
  }

  async getCompanyTableColumns(companyId: number, tableName: string): Promise<{ columnName: string; dataType: string; description?: string }[]> {
    console.warn(`MemStorage.getCompanyTableColumns called for company ${companyId}, table ${tableName} - returning mock data`);
    return [
      { columnName: 'id', dataType: 'integer', description: 'Primary key' },
      { columnName: 'created_at', dataType: 'timestamp', description: 'Creation timestamp' }
    ];
  }

  async discoverCompanySchema(companyId: number): Promise<{ [sourceType: string]: { displayName: string; tables: { [tableName: string]: { columnName: string; dataType: string; description?: string }[] } } }> {
    console.warn(`MemStorage.discoverCompanySchema called for company ${companyId} - returning mock data`);
    return {
      jira: {
        displayName: 'Jira',
        tables: {
          jira_issues: [
            { columnName: 'id', dataType: 'integer', description: 'Issue ID' },
            { columnName: 'status', dataType: 'text', description: 'Issue status' }
          ]
        }
      }
    };
  }
}

// DatabaseStorage is disabled - using Snowflake instead of PostgreSQL
import { snowflakeConfig } from "./db";

// Import RBAC and MFA services
import { rbacService } from './services/rbac-service';
import { mfaService } from './services/mfa-service';

export class DatabaseStorage implements IStorage {
  private db: any;
  private client: any; // Raw postgres client for direct SQL queries
  private sql: any; // Raw SQL query interface
  
  constructor() {
    // Initialize database connection using the same pattern as postgres-analytics
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      try {
        this.client = postgres(databaseUrl);
        this.sql = this.client; // Add sql property for raw SQL queries
        this.db = drizzle(this.client);
        console.log('✅ DatabaseStorage: Neon connection initialized successfully');
        
        // Initialize RBAC service with database instance
        this.initializeRBAC();
      } catch (error) {
        console.error('❌ DatabaseStorage: Failed to connect to Neon database:', error);
        throw new Error('Failed to initialize database storage');
      }
    } else {
      throw new Error('DATABASE_URL is required for DatabaseStorage');
    }
  }

  private async initializeRBAC(): Promise<void> {
    try {
      // Initialize RBAC service with database instance
      (rbacService as any).db = this.db;
      await rbacService.initializePermissions();
      
      // Initialize MFA service with database instance
      (mfaService as any).db = this.db;
      
      console.log('✅ RBAC and MFA services initialized');
    } catch (error) {
      console.error('❌ Failed to initialize RBAC services:', error);
    }
  }

  private throwError(): never {
    throw new Error("DatabaseStorage method not yet implemented for Neon");
  }

  // Companies (excludes soft deleted by default)
  async getCompanies(): Promise<Company[]> {
    try {
      const result = await this.db.select().from(companies).where(isNull(companies.deletedAt));
      return result;
    } catch (error) {
      console.error('Failed to get companies:', error);
      return [];
    }
  }
  
  async getCompany(id: number): Promise<Company | undefined> {
    try {
      const result = await this.db.select().from(companies).where(eq(companies.id, id));
      return result[0];
    } catch (error) {
      console.error('Failed to get company:', error);
      return undefined;
    }
  }
  
  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    try {
      const result = await this.db.insert(companies).values(insertCompany).returning();
      const newCompany = result[0];
      
      // Automatically set up metric registry for the new company
      try {
        console.log(`🏗️ Setting up metric registry for new company: ${newCompany.name} (ID: ${newCompany.id})`);
        const setupResult = await this.setupCompanyMetricRegistry(newCompany.id);
        
        if (setupResult.success) {
          console.log(`✅ Metric registry successfully set up for company ${newCompany.id}`);
        } else {
          console.warn(`⚠️ Failed to setup metric registry for company ${newCompany.id}: ${setupResult.error}`);
        }
      } catch (setupError) {
        console.error(`❌ Error during metric registry setup for company ${newCompany.id}:`, setupError);
        // Don't fail company creation if metric registry setup fails
      }
      
      return newCompany;
    } catch (error) {
      console.error('Failed to create company:', error);
      throw error;
    }
  }

  async deleteCompany(companyId: number): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🗑️ Deleting company with ID: ${companyId}`);
      
      // First, delete the analytics schema
      const schemaResult = await this.deleteAnalyticsSchema(companyId);
      if (!schemaResult.success) {
        console.error(`⚠️ Analytics schema deletion failed for company ${companyId}:`, schemaResult.error);
        // Continue with company deletion even if schema deletion fails
      }
      
      // Delete the company from the companies table
      const result = await this.db.delete(companies).where(eq(companies.id, companyId)).returning();
      
      if (result.length === 0) {
        return { success: false, error: 'Company not found' };
      }
      
      console.log(`✅ Company deleted successfully: ${result[0].name} (ID: ${companyId})`);
      return { success: true };
      
    } catch (error) {
      console.error('Failed to delete company:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Soft delete methods
  async softDeleteCompany(companyId: number, deletedBy: number, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🗑️ Soft deleting company ${companyId} by user ${deletedBy}`);
      
      const result = await this.db.update(companies)
        .set({
          deletedAt: new Date(),
          deletedBy: deletedBy,
          deleteReason: reason,
          canRestore: true,
          isActive: false
        })
        .where(eq(companies.id, companyId))
        .returning();
      
      if (result.length === 0) {
        return { success: false, error: 'Company not found' };
      }
      
      console.log(`✅ Company soft deleted successfully: ${result[0].name} (ID: ${companyId})`);
      return { success: true };
      
    } catch (error) {
      console.error('Failed to soft delete company:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async restoreCompany(companyId: number, restoredBy: number): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`🔄 Restoring company ${companyId} by user ${restoredBy}`);
      
      const result = await this.db.update(companies)
        .set({
          deletedAt: null,
          deletedBy: null,
          deleteReason: null,
          canRestore: true,
          isActive: true
        })
        .where(eq(companies.id, companyId))
        .returning();
      
      if (result.length === 0) {
        return { success: false, error: 'Company not found' };
      }
      
      console.log(`✅ Company restored successfully: ${result[0].name} (ID: ${companyId})`);
      return { success: true };
      
    } catch (error) {
      console.error('Failed to restore company:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getDeletedCompanies(): Promise<Company[]> {
    try {
      const result = await this.db.select()
        .from(companies)
        .where(isNotNull(companies.deletedAt));
      return result;
    } catch (error) {
      console.error('Failed to get deleted companies:', error);
      return [];
    }
  }

  // Users
  async getUsers(): Promise<User[]> {
    try {
      const result = await this.db.select().from(users);
      return result;
    } catch (error) {
      console.error('Failed to get users:', error);
      return [];
    }
  }

  async getUsersByCompany(companyId: number): Promise<User[]> {
    try {
      const result = await this.db.select().from(users).where(eq(users.companyId, companyId));
      return result;
    } catch (error) {
      console.error('Failed to get users by company:', error);
      return [];
    }
  }
  
  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await this.db.select().from(users).where(eq(users.id, id));
      return result[0];
    } catch (error) {
      console.error('Failed to get user:', error);
      return undefined;
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await this.db.select().from(users).where(eq(users.username, username));
      return result[0];
    } catch (error) {
      console.error('Failed to get user by username:', error);
      return undefined;
    }
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const result = await this.db.insert(users).values(insertUser).returning();
      return result[0];
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }
  
  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    try {
      const result = await this.db.update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Failed to update user:', error);
      return undefined;
    }
  }

  // Data Sources
  async getDataSources(companyId: number): Promise<DataSource[]> {
    try {
      const result = await this.db.select().from(dataSources).where(eq(dataSources.companyId, companyId));
      return result;
    } catch (error) {
      console.error('Failed to get data sources:', error);
      return [];
    }
  }
  
  async getDataSource(id: number): Promise<DataSource | undefined> {
    try {
      const result = await this.db.select().from(dataSources).where(eq(dataSources.id, id));
      return result[0];
    } catch (error) {
      console.error('Failed to get data source:', error);
      return undefined;
    }
  }
  
  async createDataSource(insertDataSource: InsertDataSource): Promise<DataSource> {
    try {
      const result = await this.db.insert(dataSources).values(insertDataSource).returning();
      return result[0];
    } catch (error) {
      console.error('Failed to create data source:', error);
      throw error;
    }
  }
  
  async updateDataSource(id: number, updates: Partial<InsertDataSource>): Promise<DataSource | undefined> {
    try {
      const result = await this.db.update(dataSources).set(updates).where(eq(dataSources.id, id)).returning();
      return result[0];
    } catch (error) {
      console.error('Failed to update data source:', error);
      return undefined;
    }
  }
  
  async getDataSourcesByCompany(companyId: number): Promise<DataSource[]> {
    return this.getDataSources(companyId);
  }
  
  async getDataSourceByInstanceId(instanceId: string): Promise<DataSource | undefined> {
    try {
      const result = await this.db.select().from(dataSources).where(eq(dataSources.instanceId, instanceId));
      return result[0];
    } catch (error) {
      console.error('Failed to get data source by instance ID:', error);
      return undefined;
    }
  }

  async updateDataSourceSyncTime(companyId: number, connectorType: string, syncTime: Date): Promise<void> {
    try {
      await this.db.update(dataSources)
        .set({ lastSyncAt: syncTime })
        .where(and(
          eq(dataSources.companyId, companyId),
          eq(dataSources.type, connectorType)
        ));
      
      console.log(`✅ Updated ${connectorType} sync time for company ${companyId}`);
    } catch (error) {
      console.error(`❌ Failed to update ${connectorType} sync time:`, error);
      throw error;
    }
  }

  // SQL Models
  async getSqlModels(companyId: number): Promise<SqlModel[]> { return this.throwError(); }
  async getSqlModelsByLayer(companyId: number, layer: string): Promise<SqlModel[]> { return this.throwError(); }
  async getSqlModel(id: number): Promise<SqlModel | undefined> { return this.throwError(); }
  async getSqlModelByName(companyId: number, name: string): Promise<SqlModel | undefined> { return this.throwError(); }
  async createSqlModel(insertModel: InsertSqlModel): Promise<SqlModel> { return this.throwError(); }
  async updateSqlModel(id: number, updates: Partial<InsertSqlModel>): Promise<SqlModel | undefined> { return this.throwError(); }

  // KPI Metrics - Updated to read from company-specific analytics schema
  async getKpiMetrics(companyId: number): Promise<Metric[]> {
    try {
      const schemaName = `analytics_company_${companyId}`;
      
      // Query the company-specific metrics table using raw SQL
      const result = await this.sql.unsafe(`
        SELECT 
          id, company_id as "companyId", metric_key as "metricKey", name, description,
          source_table as "sourceTable", expr_sql as "exprSql", filters, date_column as "dateColumn",
          category, format, unit, yearly_goal as "yearlyGoal", quarterly_goals as "quarterlyGoals", 
          monthly_goals as "monthlyGoals", goal_type as "goalType", is_increasing as "isIncreasing", 
          is_north_star as "isNorthStar", use_calculated_field as "useCalculatedField",
          calculation_type as "calculationType", date_from_column as "dateFromColumn", 
          date_to_column as "dateToColumn", time_unit as "timeUnit", conditional_field as "conditionalField",
          conditional_operator as "conditionalOperator", conditional_value as "conditionalValue",
          convert_to_number as "convertToNumber", handle_nulls as "handleNulls", tags, priority,
          is_active as "isActive", last_calculated_at as "lastCalculatedAt", 
          created_at as "createdAt", updated_at as "updatedAt"
        FROM ${schemaName}.metrics 
        WHERE company_id = ${companyId} AND is_active = true
        ORDER BY priority, id
      `);
      
      return result as Metric[];
    } catch (error) {
      console.error(`Error fetching metrics from ${`analytics_company_${companyId}`}:`, error);
      // Fallback to old table if new schema doesn't exist yet
      try {
        const result = await this.db.select()
          .from(kpiMetrics)
          .where(eq(kpiMetrics.companyId, companyId))
          .orderBy(kpiMetrics.priority, kpiMetrics.id);
        return result as any; // Type compatibility
      } catch (fallbackError) {
        console.error('Fallback to old kpi_metrics also failed:', fallbackError);
        throw error;
      }
    }
  }
  async getKpiMetric(id: number): Promise<KpiMetric | undefined> { return this.throwError(); }
  async createKpiMetric(insertMetric: InsertKpiMetric): Promise<KpiMetric> {
    try {
      const companyId = insertMetric.companyId;
      if (!companyId) {
        throw new Error('Company ID is required');
      }
      
      const schemaName = `analytics_company_${companyId}`;
      console.log(`🔄 Creating metric in schema ${schemaName}`);
      
      // Build INSERT query for company-specific schema
      const fields = [];
      const placeholders = [];
      const values = [];
      let paramIndex = 1;
      
      for (const [key, value] of Object.entries(insertMetric)) {
        // Skip undefined values
        if (value === undefined) continue;
        
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        fields.push(snakeKey);
        placeholders.push(`$${paramIndex}`);
        
        // Handle JSON fields that need to be stringified
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else if (Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
      
      const insertQuery = `
        INSERT INTO ${schemaName}.metrics (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING *
      `;
      
      console.log(`🔄 Executing create in ${schemaName}:`, insertQuery);
      
      const result = await this.sql.unsafe(insertQuery, values);
      
      if (result.length > 0) {
        console.log(`✅ Created metric in ${schemaName}`);
        // Convert snake_case back to camelCase
        const row = result[0];
        const camelRow: any = {};
        for (const [key, value] of Object.entries(row)) {
          const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          camelRow[camelKey] = value;
        }
        return camelRow as KpiMetric;
      }
      
      throw new Error('Failed to create metric');
      
    } catch (error) {
      console.error('Error creating KPI metric:', error);
      throw error;
    }
  }
  async updateKpiMetric(id: number, updates: Partial<InsertKpiMetric>, companyId?: number): Promise<KpiMetric | undefined> {
    console.log(`🔄 updateKpiMetric called for ID ${id}, companyId: ${companyId}`);
    
    try {
      if (companyId) {
        // Direct update with known company ID
        const schemaName = `analytics_company_${companyId}`;
        
        try {
          // Build UPDATE query for company-specific schema
          const updateFields = [];
          const values = [id];
          let paramIndex = 2;
          
          for (const [key, value] of Object.entries(updates)) {
            // Skip undefined values
            if (value === undefined) continue;
            
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            updateFields.push(`${snakeKey} = $${paramIndex}`);
            
            // Handle JSON fields that need to be stringified
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              values.push(JSON.stringify(value));
            } else if (Array.isArray(value)) {
              values.push(JSON.stringify(value));
            } else {
              values.push(value);
            }
            paramIndex++;
          }
          
          const updateQuery = `
            UPDATE ${schemaName}.metrics 
            SET ${updateFields.join(', ')}, updated_at = NOW()
            WHERE id = $1
            RETURNING *
          `;
          
          console.log(`🔄 Executing update in ${schemaName}:`, updateQuery);
          console.log(`🔄 Values:`, values);
          
          const result = await this.sql.unsafe(updateQuery, values);
          
          if (result.length > 0) {
            console.log(`✅ Updated metric in ${schemaName}`);
            // Convert snake_case back to camelCase
            const row = result[0];
            const camelRow: any = {};
            for (const [key, value] of Object.entries(row)) {
              const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
              camelRow[camelKey] = value;
            }
            return camelRow as KpiMetric;
          } else {
            console.log(`⚠️ Metric ${id} not found in ${schemaName}`);
            return undefined;
          }
          
        } catch (e) {
          console.log(`⚠️ Error updating metric in ${schemaName}:`, e);
          return undefined;
        }
        
      } else {
        // Fallback: Search all companies (original behavior)
        const activeCompanies = await this.db.select().from(companies).where(eq(companies.isActive, true));
        
        for (const company of activeCompanies) {
          const schemaName = `analytics_company_${company.id}`;
          try {
            // Check if metric exists in this company's schema
            const existsResult = await this.sql.unsafe(`
              SELECT id FROM ${schemaName}.metrics WHERE id = $1
            `, [id]);
            
            if (existsResult.length > 0) {
              console.log(`🎯 Found metric ${id} in schema ${schemaName}`);
              // Recursively call with the found companyId
              return this.updateKpiMetric(id, updates, company.id);
            }
          } catch (e) {
            console.log(`⚠️ Schema ${schemaName} doesn't exist or metric not found`);
            continue;
          }
        }
        
        console.error(`❌ Metric ${id} not found in any company schema`);
        return undefined;
      }
      
    } catch (error) {
      console.error('❌ Error updating KPI metric:', error);
      throw error;
    }
  }
  async deleteKpiMetric(id: number): Promise<boolean> {
    try {
      const result = await this.db
        .delete(kpiMetrics)
        .where(eq(kpiMetrics.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting KPI metric:', error);
      throw error;
    }
  }

  // Chat Messages
  async getChatMessages(companyId: number): Promise<ChatMessage[]> {
    try {
      const result = await this.db.select()
        .from(chatMessages)
        .where(eq(chatMessages.companyId, companyId))
        .orderBy(desc(chatMessages.timestamp))
        .limit(100);
      return result;
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      throw error;
    }
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    try {
      const result = await this.db.insert(chatMessages).values(insertMessage).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating chat message:', error);
      throw error;
    }
  }

  // Pipeline Activities
  async getPipelineActivities(companyId: number, limit = 50): Promise<PipelineActivity[]> {
    try {
      const result = await this.db.select()
        .from(pipelineActivities)
        .where(eq(pipelineActivities.companyId, companyId))
        .orderBy(desc(pipelineActivities.timestamp))
        .limit(limit);
      return result;
    } catch (error) {
      console.error('Failed to get pipeline activities:', error);
      return [];
    }
  }
  
  async createPipelineActivity(insertActivity: InsertPipelineActivity): Promise<PipelineActivity> {
    try {
      const result = await this.db.insert(pipelineActivities).values(insertActivity).returning();
      return result[0];
    } catch (error) {
      console.error('Failed to create pipeline activity:', error);
      throw error;
    }
  }
  async getPipelineActivitiesByType(companyId: number, activityType: string): Promise<PipelineActivity[]> {
    try {
      const result = await this.db.select()
        .from(pipelineActivities)
        .where(and(
          eq(pipelineActivities.companyId, companyId),
          eq(pipelineActivities.type, activityType)
        ))
        .orderBy(pipelineActivities.timestamp);
      return result;
    } catch (error) {
      console.error('Failed to get pipeline activities by type:', error);
      return [];
    }
  }
  
  async insertPipelineActivity(activity: InsertPipelineActivity): Promise<PipelineActivity> {
    return this.createPipelineActivity(activity);
  }
  
  async executeQuery(query: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const result = await this.db.execute(sql.raw(query));
      return {
        success: true,
        data: result || []
      };
    } catch (error) {
      console.error('Database query failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async checkTableExists(schema: string, tableName: string): Promise<boolean> {
    try {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = '${schema}' 
          AND table_name = '${tableName}'
        )
      `;
      
      const result = await this.executeQuery(query);
      return result.success && result.data && result.data[0]?.exists === true;
    } catch (error) {
      console.error(`Error checking if table ${schema}.${tableName} exists:`, error);
      return false;
    }
  }

  // Setup Status
  async getSetupStatus(companyId: number): Promise<SetupStatus | undefined> {
    try {
      const result = await this.db.select()
        .from(setupStatus)
        .where(eq(setupStatus.companyId, companyId))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching setup status:', error);
      return undefined;
    }
  }
  
  async updateSetupStatus(companyId: number, updates: Partial<InsertSetupStatus>): Promise<SetupStatus> {
    try {
      // First try to update existing
      const existing = await this.getSetupStatus(companyId);
      
      if (existing) {
        const result = await this.db.update(setupStatus)
          .set({ ...updates, lastUpdated: new Date() })
          .where(eq(setupStatus.companyId, companyId))
          .returning();
        return result[0];
      } else {
        // Create new if doesn't exist
        const result = await this.db.insert(setupStatus)
          .values({
            companyId,
            warehouseConnected: false,
            dataSourcesConfigured: false,
            modelsDeployed: 0,
            totalModels: 0,
            ...updates
          })
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error('Error updating setup status:', error);
      throw error;
    }
  }

  // Analytics Schema Management
  async ensureAnalyticsSchema(companyId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Use tenant-scoped schema management
      await ensureTenantSchema(this.sql, companyId);
      return { success: true };
      
    } catch (error) {
      console.error('Failed to ensure analytics schema:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteAnalyticsSchema(companyId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      
      console.log(`🗑️ Deleting analytics schema: ${tenantBuilder.schema}`);
      
      // Drop the analytics schema and all its contents (CASCADE removes all tables/views/functions)
      const dropSchemaQuery = `DROP SCHEMA IF EXISTS ${tenantBuilder.schema} CASCADE`;
      
      // Use the database connection directly
      const result = await this.db.execute(sql.raw(dropSchemaQuery));
      
      console.log(`✅ Analytics schema deleted: ${tenantBuilder.schema}`);
      return { success: true };
      
    } catch (error) {
      console.error('Failed to delete analytics schema:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async cleanupOrphanedAnalyticsSchemas(): Promise<{ success: boolean; cleaned: string[]; errors: string[] }> {
    try {
      console.log(`🧹 Starting cleanup of orphaned analytics schemas...`);
      
      // Get all existing company IDs
      const existingCompanies = await this.getCompanies();
      const existingCompanyIds = new Set(existingCompanies.map(c => c.id.toString()));
      
      console.log(`📊 Found ${existingCompanies.length} existing companies:`, Array.from(existingCompanyIds));
      
      // Get all analytics schemas using safe pattern matching
      const schemasResult = await this.sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'analytics_company_%' 
        ORDER BY schema_name
      `;
      
      console.log(`🔍 Found ${schemasResult.length} analytics schemas:`, schemasResult.map((s: any) => s.schema_name));
      
      const cleaned: string[] = [];
      const errors: string[] = [];
      
      // Check each schema and remove orphaned ones
      for (const schemaRow of schemasResult) {
        const schemaName = schemaRow.schema_name;
        
        // Extract company ID from schema name
        const match = schemaName.match(/^analytics_company_(\d+)$/);
        if (!match) {
          console.log(`⚠️ Skipping invalid schema name: ${schemaName}`);
          continue;
        }
        
        const companyId = match[1];
        
        // Check if company exists
        if (!existingCompanyIds.has(companyId)) {
          console.log(`🗑️ Removing orphaned schema: ${schemaName} (company ${companyId} not found)`);
          
          try {
            await this.sql`DROP SCHEMA IF EXISTS ${this.sql.unsafe(schemaName)} CASCADE`;
            cleaned.push(schemaName);
            console.log(`✅ Cleaned up orphaned schema: ${schemaName}`);
          } catch (error) {
            const errorMsg = `Failed to delete ${schemaName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }
        } else {
          console.log(`✅ Keeping valid schema: ${schemaName} (company ${companyId} exists)`);
        }
      }
      
      console.log(`🧹 Cleanup complete. Cleaned: ${cleaned.length}, Errors: ${errors.length}`);
      return { success: true, cleaned, errors };
      
    } catch (error) {
      console.error('Failed to cleanup orphaned analytics schemas:', error);
      return { 
        success: false, 
        cleaned: [], 
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async ensureAllCompaniesHaveSchemas(): Promise<{ success: boolean; created: string[]; errors: string[] }> {
    try {
      console.log(`🏗️ Ensuring all companies have analytics schemas...`);
      
      // Get all companies
      const companies = await this.getCompanies();
      console.log(`📊 Found ${companies.length} companies to check:`, companies.map(c => `${c.id} (${c.name})`));
      
      // Get existing schemas using safe query
      const schemasResult = await this.sql`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'analytics_company_%' 
        ORDER BY schema_name
      `;
      const existingSchemas = new Set(schemasResult.map((row: any) => row.schema_name));
      
      console.log(`🔍 Found ${existingSchemas.size} existing schemas:`, Array.from(existingSchemas));
      
      const created: string[] = [];
      const errors: string[] = [];
      
      // Check each company and create missing schemas
      for (const company of companies) {
        const tenantBuilder = createTenantScopedSQL(this.sql, company.id);
        const expectedSchema = tenantBuilder.schema;
        
        if (!existingSchemas.has(expectedSchema)) {
          console.log(`🏗️ Creating missing schema for company ${company.id} (${company.name}): ${expectedSchema}`);
          
          const result = await this.ensureAnalyticsSchema(company.id);
          if (result.success) {
            created.push(expectedSchema);
            console.log(`✅ Created schema: ${expectedSchema}`);
          } else {
            const errorMsg = `Failed to create ${expectedSchema}: ${result.error}`;
            errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }
        } else {
          console.log(`✅ Schema already exists: ${expectedSchema}`);
        }
      }
      
      console.log(`🏗️ Schema creation complete. Created: ${created.length}, Errors: ${errors.length}`);
      return { success: true, created, errors };
      
    } catch (error) {
      console.error('Failed to ensure all companies have schemas:', error);
      return { 
        success: false, 
        created: [], 
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Metric Reports
  async getMetricReports(companyId: number): Promise<MetricReport[]> {
    try {
      const result = await this.db.select()
        .from(metricReports)
        .where(eq(metricReports.companyId, companyId))
        .orderBy(desc(metricReports.updatedAt));
      return result;
    } catch (error) {
      console.error('Error fetching metric reports:', error);
      throw error;
    }
  }

  async getMetricReport(id: number): Promise<MetricReport | undefined> {
    try {
      const result = await this.db.select()
        .from(metricReports)
        .where(eq(metricReports.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching metric report:', error);
      throw error;
    }
  }

  async getMetricReportByShareToken(shareToken: string): Promise<MetricReport | undefined> {
    try {
      const result = await this.db.select()
        .from(metricReports)
        .where(eq(metricReports.shareToken, shareToken))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error fetching metric report by share token:', error);
      throw error;
    }
  }

  async createMetricReport(report: InsertMetricReport): Promise<MetricReport> {
    try {
      // Generate a unique share token
      const shareToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const reportWithToken = {
        ...report,
        shareToken
      };
      
      const result = await this.db.insert(metricReports).values(reportWithToken).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating metric report:', error);
      throw error;
    }
  }

  async updateMetricReport(id: number, updates: Partial<InsertMetricReport>): Promise<MetricReport | undefined> {
    try {
      const result = await this.db.update(metricReports)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(metricReports.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating metric report:', error);
      throw error;
    }
  }

  async deleteMetricReport(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(metricReports)
        .where(eq(metricReports.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting metric report:', error);
      throw error;
    }
  }

  // Goals (tenant-scoped)
  async getGoals(tenantId: number): Promise<Goal[]> {
    try {
      const result = await this.db.select()
        .from(goals)
        .where(eq(goals.tenantId, tenantId))
        .orderBy(desc(goals.createdAt));
      return result;
    } catch (error) {
      console.error('Error fetching goals:', error);
      throw error;
    }
  }

  async getGoalsByMetric(tenantId: number, metricKey: string): Promise<Goal[]> {
    try {
      const result = await this.db.select()
        .from(goals)
        .where(and(eq(goals.tenantId, tenantId), eq(goals.metricKey, metricKey)))
        .orderBy(desc(goals.createdAt));
      return result;
    } catch (error) {
      console.error('Error fetching goals by metric:', error);
      throw error;
    }
  }

  async createGoal(goal: InsertGoal): Promise<Goal> {
    try {
      const result = await this.db.insert(goals).values(goal).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  }

  async updateGoal(id: number, updates: Partial<InsertGoal>): Promise<Goal | undefined> {
    try {
      const result = await this.db.update(goals)
        .set(updates)
        .where(eq(goals.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error('Error updating goal:', error);
      throw error;
    }
  }

  async deleteGoal(id: number): Promise<boolean> {
    try {
      const result = await this.db.delete(goals)
        .where(eq(goals.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  }

  // Company-specific Metric Registry (using tenant-scoped queries)
  async getCompanyMetricRegistry(companyId: number): Promise<MetricRegistry[]> {
    try {
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      return await getTenantMetricRegistry(tenantBuilder);
    } catch (error) {
      console.error(`Error fetching metric registry for company ${companyId}:`, error);
      throw error;
    }
  }

  async getCompanyMetricRegistryEntry(companyId: number, metricKey: string): Promise<MetricRegistry | undefined> {
    try {
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      const tableName = getTenantTable(tenantBuilder, 'metric_registry');
      
      const result = await tenantBuilder.sql`
        SELECT 
          metric_key,
          label,
          source_table,
          expr_sql,
          date_column,
          unit,
          filters,
          tags,
          description,
          is_active,
          created_at,
          updated_at
        FROM ${tenantBuilder.sql.unsafe(tableName)}
        WHERE metric_key = ${metricKey}
        LIMIT 1
      `;
      return result[0];
    } catch (error) {
      console.error(`Error fetching metric registry entry for company ${companyId}:`, error);
      throw error;
    }
  }

  async createCompanyMetricRegistryEntry(companyId: number, entry: InsertMetricRegistry): Promise<MetricRegistry> {
    try {
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      const tableName = getTenantTable(tenantBuilder, 'metric_registry');
      
      const result = await tenantBuilder.sql`
        INSERT INTO ${tenantBuilder.sql.unsafe(tableName)}
        (metric_key, label, source_table, expr_sql, date_column, unit, filters, tags, description, is_active)
        VALUES (
          ${entry.metricKey}, 
          ${entry.label}, 
          ${entry.sourceTable || null}, 
          ${entry.exprSql}, 
          ${entry.dateColumn || null},
          ${entry.unit}, 
          ${entry.filters || null},
          ${entry.tags || null},
          ${entry.description || null},
          ${entry.isActive ?? true}
        )
        RETURNING metric_key, label, source_table, expr_sql, date_column, unit, filters, tags, description, is_active, created_at, updated_at
      `;
      return result[0];
    } catch (error) {
      console.error(`Error creating metric registry entry for company ${companyId}:`, error);
      throw error;
    }
  }

  async updateCompanyMetricRegistryEntry(companyId: number, metricKey: string, updates: Partial<InsertMetricRegistry>): Promise<MetricRegistry | undefined> {
    try {
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      const tableName = getTenantTable(tenantBuilder, 'metric_registry');
      
      // Build dynamic update query
      const updateParts: string[] = [];
      const values: any[] = [metricKey]; // metric_key for WHERE clause
      
      if (updates.label !== undefined) {
        updateParts.push(`label = ${tenantBuilder.sql.placeholder}`);
        values.push(updates.label);
      }
      if (updates.sourceTable !== undefined) {
        updateParts.push(`source_table = ${tenantBuilder.sql.placeholder}`);
        values.push(updates.sourceTable);
      }
      if (updates.exprSql !== undefined) {
        updateParts.push(`expr_sql = ${tenantBuilder.sql.placeholder}`);
        values.push(updates.exprSql);
      }
      if (updates.dateColumn !== undefined) {
        updateParts.push(`date_column = ${tenantBuilder.sql.placeholder}`);
        values.push(updates.dateColumn);
      }
      if (updates.filters !== undefined) {
        updateParts.push(`filters = ${tenantBuilder.sql.placeholder}`);
        values.push(updates.filters);
      }
      if (updates.unit !== undefined) {
        updateParts.push(`unit = ${tenantBuilder.sql.placeholder}`);
        values.push(updates.unit);
      }
      if (updates.isActive !== undefined) {
        updateParts.push(`is_active = ${tenantBuilder.sql.placeholder}`);
        values.push(updates.isActive);
      }
      
      if (updateParts.length === 0) {
        // No updates to make
        return await this.getCompanyMetricRegistryEntry(companyId, metricKey);
      }
      
      updateParts.push('updated_at = NOW()');
      
      const result = await tenantBuilder.sql.unsafe(`
        UPDATE ${tableName}
        SET ${updateParts.join(', ')}
        WHERE metric_key = $1
        RETURNING metric_key, label, source_table, expr_sql, date_column, unit, filters, tags, description, is_active, created_at, updated_at
      `, values);
      
      return result[0];
    } catch (error) {
      console.error(`Error updating metric registry entry for company ${companyId}:`, error);
      throw error;
    }
  }

  async deleteCompanyMetricRegistryEntry(companyId: number, metricKey: string): Promise<boolean> {
    try {
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      const tableName = getTenantTable(tenantBuilder, 'metric_registry');
      
      const result = await tenantBuilder.sql`
        DELETE FROM ${tenantBuilder.sql.unsafe(tableName)}
        WHERE metric_key = ${metricKey}
        RETURNING metric_key
      `;
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting metric registry entry for company ${companyId}:`, error);
      throw error;
    }
  }

  // Company-specific metric registry setup
  async setupCompanyMetricRegistry(companyId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const fs = await import('fs/promises');
      
      // Read the company metric registry template
      const templateSql = await fs.readFile('./migrations/create_company_metric_registry.sql', 'utf8');
      
      // Replace placeholders with actual company values  
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      const companySql = templateSql
        .replace(/{COMPANY_SCHEMA}/g, tenantBuilder.schema)
        .replace(/{COMPANY_ID}/g, companyId.toString());
      
      // Execute the SQL to create company-specific metric registry tables
      await this.db.execute(sql.raw(companySql));
      
      console.log(`✅ Metric registry setup completed for company ${companyId} in schema ${tenantBuilder.schema}`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to setup metric registry for company ${companyId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Dynamic Schema Introspection
  async getCompanyDataSources(companyId: number): Promise<{ sourceType: string; tables: string[]; displayName: string }[]> {
    try {
      console.log(`🔍 getCompanyDataSources called for company ${companyId}`);
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      
      // Get all tables in the company's analytics schema using tenant-scoped query
      const tables = await getTenantTables(tenantBuilder);
      console.log(`📋 Found ${tables.length} raw tables:`, tables);
      
      // Group tables by their data source based on naming patterns
      // Only include CORE business tables (exclude RAW, STG, INT layers and internal tables)
      const sourceGroups: { [key: string]: { tables: string[]; displayName: string } } = {};
      
      for (const rawTableName of tables) {
        
        // Only include CORE tables - skip all other layers and internal tables
        if (rawTableName.startsWith('raw_') || 
            rawTableName.startsWith('stg_') || 
            rawTableName.startsWith('int_') ||
            rawTableName === 'goals' ||
            rawTableName === 'metric_registry' ||
            rawTableName === 'goals_daily') {
          continue; // Skip RAW, STG, INT layers and internal tables
        }
        
        // Only CORE tables should reach here
        let tableName = rawTableName;
        
        let sourceType = 'unknown';
        let displayName = 'Other';
        
        // Detect source type from table naming patterns (only core business tables)
        if (tableName.startsWith('jira_') || tableName.includes('_jira_')) {
          sourceType = 'jira';
          displayName = 'Jira';
        } else if (tableName.startsWith('salesforce_') || tableName.includes('_salesforce_')) {
          sourceType = 'salesforce';
          displayName = 'Salesforce';
        } else if (tableName.startsWith('hubspot_') || tableName.includes('_hubspot_')) {
          sourceType = 'hubspot';
          displayName = 'HubSpot';
        } else if (tableName.startsWith('stripe_') || tableName.includes('_stripe_')) {
          sourceType = 'stripe';
          displayName = 'Stripe';
        } else if (tableName.startsWith('quickbooks_') || tableName.includes('_quickbooks_')) {
          sourceType = 'quickbooks';
          displayName = 'QuickBooks';
        } else if (tableName.startsWith('google_') || tableName.includes('_google_')) {
          sourceType = 'google';
          displayName = 'Google';
        } else if (tableName.startsWith('slack_') || tableName.includes('_slack_')) {
          sourceType = 'slack';
          displayName = 'Slack';
        } else {
          // Try to extract source from table name
          const parts = tableName.split('_');
          if (parts.length > 1) {
            sourceType = parts[0];
            displayName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
          }
        }
        
        // Only include if we have actual business tables
        if (sourceType !== 'unknown') {
          if (!sourceGroups[sourceType]) {
            sourceGroups[sourceType] = { tables: [], displayName };
          }
          sourceGroups[sourceType].tables.push(rawTableName);
        }
      }
      
      // Convert to array format
      const result = Object.entries(sourceGroups).map(([sourceType, data]) => ({
        sourceType,
        tables: data.tables,
        displayName: data.displayName
      }));
      
      console.log(`✅ getCompanyDataSources returning for company ${companyId}:`, result);
      return result;
      
    } catch (error) {
      console.error(`Error getting data sources for company ${companyId}:`, error);
      return [];
    }
  }

  async getCompanyTableColumns(companyId: number, tableName: string): Promise<{ columnName: string; dataType: string; description?: string }[]> {
    try {
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      const columns = await getTenantTableColumns(tenantBuilder, tableName);
      
      return columns.map(col => ({
        columnName: col.columnName,
        dataType: col.dataType,
        description: undefined  // getTenantTableColumns doesn't return description yet
      }));
      
    } catch (error) {
      console.error(`Error getting columns for table ${tableName} in company ${companyId}:`, error);
      return [];
    }
  }

  async discoverCompanySchema(companyId: number): Promise<{ [sourceType: string]: { displayName: string; tables: { [tableName: string]: { columnName: string; dataType: string; description?: string }[] } } }> {
    try {
      // Get all data sources for the company
      const dataSources = await this.getCompanyDataSources(companyId);
      const schema: { [sourceType: string]: { displayName: string; tables: { [tableName: string]: { columnName: string; dataType: string; description?: string }[] } } } = {};
      
      // For each data source, get the column details for all its tables
      for (const source of dataSources) {
        schema[source.sourceType] = {
          displayName: source.displayName,
          tables: {}
        };
        
        for (const tableName of source.tables) {
          const columns = await this.getCompanyTableColumns(companyId, tableName);
          schema[source.sourceType].tables[tableName] = columns;
        }
      }
      
      return schema;
      
    } catch (error) {
      console.error(`Error discovering schema for company ${companyId}:`, error);
      return {};
    }
  }

  // Metric Registry Methods
  async saveMetricToRegistry(companyId: number, metricData: {
    metric_key: string;
    label: string;
    source_table: string;
    expr_sql: string;
    filters?: any;
    unit?: string;
    date_column?: string;
    description?: string;
    tags?: string[];
  }): Promise<void> {
    try {
      const tenantBuilder = createTenantScopedSQL(this.sql, companyId);
      const tableName = getTenantTable(tenantBuilder, 'metric_registry');
      
      await tenantBuilder.sql`
        INSERT INTO ${tenantBuilder.sql.unsafe(tableName)}
        (metric_key, label, source_table, expr_sql, filters, unit, date_column, description, tags)
        VALUES (
          ${metricData.metric_key},
          ${metricData.label},
          ${metricData.source_table},
          ${metricData.expr_sql},
          ${metricData.filters ? JSON.stringify(metricData.filters) : null},
          ${metricData.unit || 'count'},
          ${metricData.date_column || 'created_at'},
          ${metricData.description || ''},
          ${metricData.tags || []}
        )
        ON CONFLICT (metric_key) DO UPDATE SET
          label = EXCLUDED.label,
          source_table = EXCLUDED.source_table,
          expr_sql = EXCLUDED.expr_sql,
          filters = EXCLUDED.filters,
          unit = EXCLUDED.unit,
          date_column = EXCLUDED.date_column,
          description = EXCLUDED.description,
          tags = EXCLUDED.tags,
          updated_at = NOW()
      `;
      
      console.log(`✅ Metric saved to registry: ${metricData.metric_key} for company ${companyId}`);
    } catch (error) {
      console.error(`❌ Failed to save metric to registry:`, error);
      throw error;
    }
  }

  // Company-Specific Goals Methods (analytics schema)
  async getCompanyGoals(companyId: number): Promise<any[]> {
    try {
      const schema = `analytics_company_${companyId}`;
      const result = await this.sql`
        SELECT id, metric_key, granularity, period_start, target, created_at
        FROM ${this.sql(schema)}.goals 
        ORDER BY period_start DESC, metric_key
      `;
      return result;
    } catch (error) {
      console.error('Failed to get company goals:', error);
      return [];
    }
  }

  async getCompanyGoalsByMetric(companyId: number, metricKey: string): Promise<any[]> {
    try {
      const schema = `analytics_company_${companyId}`;
      const result = await this.sql`
        SELECT id, metric_key, granularity, period_start, target, created_at
        FROM ${this.sql(schema)}.goals 
        WHERE metric_key = ${metricKey}
        ORDER BY period_start DESC
      `;
      return result;
    } catch (error) {
      console.error('Failed to get company goals by metric:', error);
      return [];
    }
  }

  async createCompanyGoal(companyId: number, goal: { 
    metricKey: string; 
    granularity: 'month' | 'quarter' | 'year'; 
    periodStart: string; 
    target: number 
  }): Promise<any> {
    try {
      const schema = `analytics_company_${companyId}`;
      const result = await this.sql`
        INSERT INTO ${this.sql(schema)}.goals (metric_key, granularity, period_start, target)
        VALUES (${goal.metricKey}, ${goal.granularity}, ${goal.periodStart}, ${goal.target})
        ON CONFLICT (metric_key, granularity, period_start) 
        DO UPDATE SET target = EXCLUDED.target
        RETURNING id, metric_key, granularity, period_start, target, created_at
      `;
      
      // Refresh the materialized view to include new goal
      await this.refreshCompanyGoalsDaily(companyId);
      
      return result[0];
    } catch (error) {
      console.error('Failed to create company goal:', error);
      throw error;
    }
  }

  async updateCompanyGoal(companyId: number, goalId: number, updates: { target?: number }): Promise<any> {
    try {
      const schema = `analytics_company_${companyId}`;
      const result = await this.sql`
        UPDATE ${this.sql(schema)}.goals 
        SET target = ${updates.target}
        WHERE id = ${goalId}
        RETURNING id, metric_key, granularity, period_start, target, created_at
      `;
      
      if (result.length > 0) {
        // Refresh the materialized view
        await this.refreshCompanyGoalsDaily(companyId);
      }
      
      return result[0];
    } catch (error) {
      console.error('Failed to update company goal:', error);
      throw error;
    }
  }

  async deleteCompanyGoal(companyId: number, goalId: number): Promise<boolean> {
    try {
      const schema = `analytics_company_${companyId}`;
      const result = await this.sql`
        DELETE FROM ${this.sql(schema)}.goals 
        WHERE id = ${goalId}
        RETURNING id
      `;
      
      if (result.length > 0) {
        // Refresh the materialized view
        await this.refreshCompanyGoalsDaily(companyId);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to delete company goal:', error);
      return false;
    }
  }

  async refreshCompanyGoalsDaily(companyId: number): Promise<void> {
    try {
      const schema = `analytics_company_${companyId}`;
      await this.sql`REFRESH MATERIALIZED VIEW ${this.sql(schema)}.goals_daily`;
      console.log(`✅ Refreshed goals_daily materialized view for company ${companyId}`);
    } catch (error) {
      console.error(`Failed to refresh goals_daily for company ${companyId}:`, error);
      // Don't throw - this is not critical for the operation
    }
  }

}

import fs from 'fs';
import path from 'path';

// File-based persistence for metrics
const METRICS_FILE = path.join(process.cwd(), 'metrics-data.json');

class PersistentMemStorage extends MemStorage {
  constructor() {
    super();
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      if (fs.existsSync(METRICS_FILE)) {
        const data = JSON.parse(fs.readFileSync(METRICS_FILE, 'utf8'));
        
        // Restore metrics
        if (data.kpiMetrics) {
          for (const [id, metric] of Object.entries(data.kpiMetrics as Record<string, any>)) {
            this.kpiMetrics.set(parseInt(id), {
              ...metric,
              lastCalculatedAt: metric.lastCalculatedAt ? new Date(metric.lastCalculatedAt) : null
            });
          }
          this.currentId = Math.max(this.currentId, ...Array.from(this.kpiMetrics.keys())) + 1;
        }

        // Restore metric reports
        if (data.metricReports) {
          for (const [id, report] of Object.entries(data.metricReports as Record<string, any>)) {
            this.metricReports.set(parseInt(id), {
              ...report,
              createdAt: new Date(report.createdAt),
              updatedAt: new Date(report.updatedAt)
            });
          }
          this.currentId = Math.max(this.currentId, ...Array.from(this.metricReports.keys())) + 1;
        }
        
        console.log(`✓ Loaded ${this.kpiMetrics.size} metrics and ${this.metricReports.size} reports from persistent storage`);
      } else {
        this.initializeDefaultMetrics();
      }
    } catch (error) {
      console.error("Error loading metrics from file:", error);
      this.initializeDefaultMetrics();
    }
  }

  private saveToFile() {
    try {
      const data = {
        kpiMetrics: Object.fromEntries(this.kpiMetrics.entries()),
        metricReports: Object.fromEntries(this.metricReports.entries())
      };
      fs.writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error saving metrics to file:", error);
    }
  }

  private initializeDefaultMetrics() {
    const metrics = [
      {
        name: "Annual Revenue",
        description: "Total Annual Revenue based on QuickBooks transactions",
        yearlyGoal: "3000000",
        goalType: "yearly" as const,
        quarterlyGoals: {Q1: "", Q2: "", Q3: "", Q4: ""},
        monthlyGoals: {Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "", Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""},
        category: "revenue",
        format: "currency",
        isIncreasing: true,
        isNorthStar: true,
        sqlQuery: "SELECT INVOICE_DATE as date, SUM(INVOICE_AMOUNT) as daily_revenue FROM MIAS_DATA_DB.CORE.CORE_QUICKBOOKS_REVENUE WHERE INVOICE_DATE >= '2024-01-01' AND INVOICE_AMOUNT > 0 GROUP BY INVOICE_DATE ORDER BY INVOICE_DATE;",
        companyId: 1
      },
      {
        name: "Monthly Deal Value",
        description: "Total value of deals closed each month from HubSpot",
        yearlyGoal: "1200000",
        goalType: "yearly" as const,
        quarterlyGoals: {Q1: "", Q2: "", Q3: "", Q4: ""},
        monthlyGoals: {Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "", Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""},
        category: "sales",
        format: "currency",
        isIncreasing: true,
        isNorthStar: false,
        sqlQuery: "SELECT CLOSE_DATE as date, SUM(AMOUNT) as daily_revenue FROM MIAS_DATA_DB.CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= '2024-01-01' AND AMOUNT > 0 AND STAGE = 'Closed Won' GROUP BY CLOSE_DATE ORDER BY CLOSE_DATE;",
        companyId: 1
      },
      {
        name: "Monthly Expenses",
        description: "Total business expenses from QuickBooks",
        yearlyGoal: "600000",
        goalType: "yearly" as const,
        quarterlyGoals: {Q1: "", Q2: "", Q3: "", Q4: ""},
        monthlyGoals: {Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "", Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""},
        category: "finance",
        format: "currency",
        isIncreasing: false,
        isNorthStar: false,
        sqlQuery: "SELECT EXPENSE_DATE as date, SUM(AMOUNT) as daily_revenue FROM MIAS_DATA_DB.CORE.CORE_QUICKBOOKS_EXPENSES WHERE EXPENSE_DATE >= '2024-01-01' AND AMOUNT > 0 GROUP BY EXPENSE_DATE ORDER BY EXPENSE_DATE;",
        companyId: 1
      }
    ];

    try {
      for (const metric of metrics) {
        const id = this.currentId++;
        const kpiMetric: KpiMetric = { 
          ...metric, 
          id, 
          value: null,
          changePercent: null,
          currentProgress: null,
          lastCalculatedAt: null 
        };
        this.kpiMetrics.set(id, kpiMetric);
      }
      this.saveToFile();
      console.log("✓ Initialized default MIAS_DATA metrics");
    } catch (error) {
      console.error("Error initializing default metrics:", error);
    }
  }

  async createKpiMetric(insertMetric: InsertKpiMetric): Promise<KpiMetric> {
    const result = await super.createKpiMetric(insertMetric);
    this.saveToFile();
    return result;
  }

  async updateKpiMetric(id: number, updates: Partial<InsertKpiMetric>): Promise<KpiMetric | undefined> {
    const result = await super.updateKpiMetric(id, updates);
    if (result) {
      this.saveToFile();
    }
    return result;
  }

  async deleteKpiMetric(id: number): Promise<boolean> {
    const result = await super.deleteKpiMetric(id);
    if (result) {
      this.saveToFile();
    }
    return result;
  }

  async createMetricReport(insertReport: InsertMetricReport): Promise<MetricReport> {
    const result = await super.createMetricReport(insertReport);
    this.saveToFile();
    return result;
  }

  async updateMetricReport(id: number, updates: Partial<InsertMetricReport>): Promise<MetricReport | undefined> {
    const result = await super.updateMetricReport(id, updates);
    if (result) {
      this.saveToFile();
    }
    return result;
  }

  async deleteMetricReport(id: number): Promise<boolean> {
    const result = await super.deleteMetricReport(id);
    if (result) {
      this.saveToFile();
    }
    return result;
  }
}

// Type aliases for backward compatibility
export type KpiMetric = Metric;
export type InsertKpiMetric = InsertMetric;

// Use real Neon PostgreSQL database storage
export const storage = new DatabaseStorage();
