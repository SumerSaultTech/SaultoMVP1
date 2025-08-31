import {
  companies,
  dataSources,
  sqlModels,
  kpiMetrics,
  chatMessages,
  pipelineActivities,
  setupStatus,
  users,
  metricReports,
  goals,
  metricRegistry,
  type Company,
  type InsertCompany,
  type DataSource,
  type SqlModel,
  type KpiMetric,
  type ChatMessage,
  type PipelineActivity,
  type SetupStatus,
  type User,
  type MetricReport,
  type Goal,
  type MetricRegistry,
  type InsertDataSource,
  type InsertSqlModel,
  type InsertKpiMetric,
  type InsertChatMessage,
  type InsertPipelineActivity,
  type InsertSetupStatus,
  type InsertUser,
  type InsertMetricReport,
  type InsertGoal,
  type InsertMetricRegistry,
} from "@shared/schema";

// Import postgres and drizzle for DatabaseStorage
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql, eq, and, desc } from 'drizzle-orm';

export interface IStorage {
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  deleteCompany(companyId: number): Promise<{ success: boolean; error?: string }>;

  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Data Sources (company-scoped)
  getDataSources(companyId: number): Promise<DataSource[]>;
  getDataSource(id: number): Promise<DataSource | undefined>;
  createDataSource(dataSource: InsertDataSource): Promise<DataSource>;
  updateDataSource(id: number, updates: Partial<InsertDataSource>): Promise<DataSource | undefined>;
  getDataSourcesByCompany(companyId: number): Promise<DataSource[]>;
  getDataSourceByInstanceId(instanceId: string): Promise<DataSource | undefined>;

  // SQL Models (company-scoped)
  getSqlModels(companyId: number): Promise<SqlModel[]>;
  getSqlModelsByLayer(companyId: number, layer: string): Promise<SqlModel[]>;
  getSqlModel(id: number): Promise<SqlModel | undefined>;
  getSqlModelByName(companyId: number, name: string): Promise<SqlModel | undefined>;
  createSqlModel(model: InsertSqlModel): Promise<SqlModel>;
  updateSqlModel(id: number, updates: Partial<InsertSqlModel>): Promise<SqlModel | undefined>;

  // KPI Metrics (company-scoped)
  getKpiMetrics(companyId: number): Promise<KpiMetric[]>;
  getKpiMetric(id: number): Promise<KpiMetric | undefined>;
  createKpiMetric(metric: InsertKpiMetric): Promise<KpiMetric>;
  updateKpiMetric(id: number, updates: Partial<InsertKpiMetric>): Promise<KpiMetric | undefined>;
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
  
  // Schema Layer Operations
  executeQuery(query: string): Promise<{ success: boolean; data?: any[]; error?: string }>;
  checkTableExists(schema: string, tableName: string): Promise<boolean>;
  getPipelineActivitiesByType(companyId: number, activityType: string): Promise<PipelineActivity[]>;
  insertPipelineActivity(activity: InsertPipelineActivity): Promise<PipelineActivity>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private dataSources: Map<number, DataSource>;
  private sqlModels: Map<number, SqlModel>;
  private kpiMetrics: Map<number, KpiMetric>;
  private chatMessages: Map<number, ChatMessage>;
  private pipelineActivities: Map<number, PipelineActivity>;
  protected metricReports: Map<number, MetricReport>;
  private setupStatus: SetupStatus | undefined;
  private currentId: number;

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
}

// DatabaseStorage is disabled - using Snowflake instead of PostgreSQL
import { snowflakeConfig } from "./db";

export class DatabaseStorage implements IStorage {
  private db: any;
  
  constructor() {
    // Initialize database connection using the same pattern as postgres-analytics
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      try {
        const client = postgres(databaseUrl);
        this.db = drizzle(client);
        console.log('✅ DatabaseStorage: Neon connection initialized successfully');
      } catch (error) {
        console.error('❌ DatabaseStorage: Failed to connect to Neon database:', error);
        throw new Error('Failed to initialize database storage');
      }
    } else {
      throw new Error('DATABASE_URL is required for DatabaseStorage');
    }
  }


  private throwError(): never {
    throw new Error("DatabaseStorage method not yet implemented for Neon");
  }

  // Companies
  async getCompanies(): Promise<Company[]> {
    try {
      const result = await this.db.select().from(companies);
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
      return result[0];
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

  // Users
  async getUsers(): Promise<User[]> { return this.throwError(); }
  async getUser(id: number): Promise<User | undefined> { return this.throwError(); }
  async getUserByUsername(username: string): Promise<User | undefined> { return this.throwError(); }
  async createUser(insertUser: InsertUser): Promise<User> { return this.throwError(); }

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

  // SQL Models
  async getSqlModels(companyId: number): Promise<SqlModel[]> { return this.throwError(); }
  async getSqlModelsByLayer(companyId: number, layer: string): Promise<SqlModel[]> { return this.throwError(); }
  async getSqlModel(id: number): Promise<SqlModel | undefined> { return this.throwError(); }
  async getSqlModelByName(companyId: number, name: string): Promise<SqlModel | undefined> { return this.throwError(); }
  async createSqlModel(insertModel: InsertSqlModel): Promise<SqlModel> { return this.throwError(); }
  async updateSqlModel(id: number, updates: Partial<InsertSqlModel>): Promise<SqlModel | undefined> { return this.throwError(); }

  // KPI Metrics
  async getKpiMetrics(companyId: number): Promise<KpiMetric[]> {
    try {
      const result = await this.db.select()
        .from(kpiMetrics)
        .where(eq(kpiMetrics.companyId, companyId))
        .orderBy(kpiMetrics.priority, kpiMetrics.id);
      return result;
    } catch (error) {
      console.error('Error fetching KPI metrics:', error);
      throw error;
    }
  }
  async getKpiMetric(id: number): Promise<KpiMetric | undefined> { return this.throwError(); }
  async createKpiMetric(insertMetric: InsertKpiMetric): Promise<KpiMetric> {
    try {
      const result = await this.db.insert(kpiMetrics).values(insertMetric).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating KPI metric:', error);
      throw error;
    }
  }
  async updateKpiMetric(id: number, updates: Partial<InsertKpiMetric>): Promise<KpiMetric | undefined> { return this.throwError(); }
  async deleteKpiMetric(id: number): Promise<boolean> { return this.throwError(); }

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
      const schemaName = `analytics_company_${companyId}`;
      
      console.log(`🏗️ Creating analytics schema: ${schemaName}`);
      
      // Create analytics schema if it doesn't exist using direct SQL execution
      const createSchemaQuery = `CREATE SCHEMA IF NOT EXISTS ${schemaName}`;
      
      // Use the database connection directly (same approach as postgres analytics service)
      const result = await this.db.execute(sql.raw(createSchemaQuery));
      
      console.log(`✅ Analytics schema created/verified: ${schemaName}`);
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
      const schemaName = `analytics_company_${companyId}`;
      
      console.log(`🗑️ Deleting analytics schema: ${schemaName}`);
      
      // Drop the analytics schema and all its contents (CASCADE removes all tables/views/functions)
      const dropSchemaQuery = `DROP SCHEMA IF EXISTS ${schemaName} CASCADE`;
      
      // Use the database connection directly
      const result = await this.db.execute(sql.raw(dropSchemaQuery));
      
      console.log(`✅ Analytics schema deleted: ${schemaName}`);
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
      
      // Get all analytics schemas
      const schemasQuery = `
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'analytics_company_%' 
        ORDER BY schema_name
      `;
      
      const schemasResult = await this.db.execute(sql.raw(schemasQuery));
      const allSchemas = schemasResult as any[];
      
      console.log(`🔍 Found ${allSchemas.length} analytics schemas:`, allSchemas.map(s => s.schema_name));
      
      const cleaned: string[] = [];
      const errors: string[] = [];
      
      // Check each schema and remove orphaned ones
      for (const schemaRow of allSchemas) {
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
            const dropQuery = `DROP SCHEMA IF EXISTS ${schemaName} CASCADE`;
            await this.db.execute(sql.raw(dropQuery));
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
      
      // Get existing schemas
      const schemasQuery = `
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'analytics_company_%' 
        ORDER BY schema_name
      `;
      
      const schemasResult = await this.db.execute(sql.raw(schemasQuery));
      const existingSchemas = new Set((schemasResult as any[]).map(row => row.schema_name));
      
      console.log(`🔍 Found ${existingSchemas.size} existing schemas:`, Array.from(existingSchemas));
      
      const created: string[] = [];
      const errors: string[] = [];
      
      // Check each company and create missing schemas
      for (const company of companies) {
        const expectedSchema = `analytics_company_${company.id}`;
        
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

  // Company-specific Metric Registry (using raw SQL for company schemas)
  async getCompanyMetricRegistry(companyId: number): Promise<MetricRegistry[]> {
    try {
      const companySchema = `analytics_company_${companyId}`;
      const query = `
        SELECT metric_key, label, source_fact, expr_sql, filters, unit, is_active, created_at, updated_at
        FROM ${companySchema}.metric_registry 
        WHERE is_active = true 
        ORDER BY updated_at DESC
      `;
      const result = await this.db.execute(sql.raw(query));
      return result as MetricRegistry[];
    } catch (error) {
      console.error(`Error fetching metric registry for company ${companyId}:`, error);
      throw error;
    }
  }

  async getCompanyMetricRegistryEntry(companyId: number, metricKey: string): Promise<MetricRegistry | undefined> {
    try {
      const companySchema = `analytics_company_${companyId}`;
      const query = `
        SELECT metric_key, label, source_fact, expr_sql, filters, unit, is_active, created_at, updated_at
        FROM ${companySchema}.metric_registry 
        WHERE metric_key = $1 
        LIMIT 1
      `;
      const result = await this.db.execute(sql.raw(query, [metricKey]));
      return (result as MetricRegistry[])[0];
    } catch (error) {
      console.error(`Error fetching metric registry entry for company ${companyId}:`, error);
      throw error;
    }
  }

  async createCompanyMetricRegistryEntry(companyId: number, entry: InsertMetricRegistry): Promise<MetricRegistry> {
    try {
      const companySchema = `analytics_company_${companyId}`;
      const query = `
        INSERT INTO ${companySchema}.metric_registry 
        (metric_key, label, source_fact, expr_sql, filters, unit, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING metric_key, label, source_fact, expr_sql, filters, unit, is_active, created_at, updated_at
      `;
      const result = await this.db.execute(sql.raw(query, [
        entry.metricKey, entry.label, entry.sourceFact, entry.exprSql, 
        entry.filters, entry.unit, entry.isActive ?? true
      ]));
      return (result as MetricRegistry[])[0];
    } catch (error) {
      console.error(`Error creating metric registry entry for company ${companyId}:`, error);
      throw error;
    }
  }

  async updateCompanyMetricRegistryEntry(companyId: number, metricKey: string, updates: Partial<InsertMetricRegistry>): Promise<MetricRegistry | undefined> {
    try {
      const companySchema = `analytics_company_${companyId}`;
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.label !== undefined) {
        setParts.push(`label = $${paramIndex++}`);
        values.push(updates.label);
      }
      if (updates.sourceFact !== undefined) {
        setParts.push(`source_fact = $${paramIndex++}`);
        values.push(updates.sourceFact);
      }
      if (updates.exprSql !== undefined) {
        setParts.push(`expr_sql = $${paramIndex++}`);
        values.push(updates.exprSql);
      }
      if (updates.filters !== undefined) {
        setParts.push(`filters = $${paramIndex++}`);
        values.push(updates.filters);
      }
      if (updates.unit !== undefined) {
        setParts.push(`unit = $${paramIndex++}`);
        values.push(updates.unit);
      }
      if (updates.isActive !== undefined) {
        setParts.push(`is_active = $${paramIndex++}`);
        values.push(updates.isActive);
      }
      
      setParts.push(`updated_at = NOW()`);
      values.push(metricKey);

      const query = `
        UPDATE ${companySchema}.metric_registry 
        SET ${setParts.join(', ')}
        WHERE metric_key = $${paramIndex}
        RETURNING metric_key, label, source_fact, expr_sql, filters, unit, is_active, created_at, updated_at
      `;
      
      const result = await this.db.execute(sql.raw(query, values));
      return (result as MetricRegistry[])[0];
    } catch (error) {
      console.error(`Error updating metric registry entry for company ${companyId}:`, error);
      throw error;
    }
  }

  async deleteCompanyMetricRegistryEntry(companyId: number, metricKey: string): Promise<boolean> {
    try {
      const companySchema = `analytics_company_${companyId}`;
      const query = `
        DELETE FROM ${companySchema}.metric_registry 
        WHERE metric_key = $1
        RETURNING metric_key
      `;
      const result = await this.db.execute(sql.raw(query, [metricKey]));
      return (result as any[]).length > 0;
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
      const companySchema = `analytics_company_${companyId}`;
      const companySql = templateSql
        .replace(/{COMPANY_SCHEMA}/g, companySchema)
        .replace(/{COMPANY_ID}/g, companyId.toString());
      
      // Execute the SQL to create company-specific metric registry tables
      await this.db.execute(sql.raw(companySql));
      
      console.log(`✅ Metric registry setup completed for company ${companyId} in schema ${companySchema}`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to setup metric registry for company ${companyId}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
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
          timePeriod: "monthly",
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

// Use real Neon PostgreSQL database storage
export const storage = new DatabaseStorage();
