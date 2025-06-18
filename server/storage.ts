import {
  companies,
  dataSources,
  sqlModels,
  kpiMetrics,
  chatMessages,
  pipelineActivities,
  setupStatus,
  users,
  type Company,
  type InsertCompany,
  type DataSource,
  type SqlModel,
  type KpiMetric,
  type ChatMessage,
  type PipelineActivity,
  type SetupStatus,
  type User,
  type InsertDataSource,
  type InsertSqlModel,
  type InsertKpiMetric,
  type InsertChatMessage,
  type InsertPipelineActivity,
  type InsertSetupStatus,
  type InsertUser,
} from "@shared/schema";

export interface IStorage {
  // Companies
  getCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private dataSources: Map<number, DataSource>;
  private sqlModels: Map<number, SqlModel>;
  private kpiMetrics: Map<number, KpiMetric>;
  private chatMessages: Map<number, ChatMessage>;
  private pipelineActivities: Map<number, PipelineActivity>;
  private setupStatus: SetupStatus | undefined;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.dataSources = new Map();
    this.sqlModels = new Map();
    this.kpiMetrics = new Map();
    this.chatMessages = new Map();
    this.pipelineActivities = new Map();
    this.currentId = 1;

    // Initialize with default setup status
    this.setupStatus = {
      id: 1,
      snowflakeConnected: false,
      fivetranConfigured: false,
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
      role: insertUser.role || "user"
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
  async getChatMessages(): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values()).sort((a, b) => 
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
  async getPipelineActivities(limit = 50): Promise<PipelineActivity[]> {
    return Array.from(this.pipelineActivities.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  async createPipelineActivity(insertActivity: InsertPipelineActivity): Promise<PipelineActivity> {
    const id = this.currentId++;
    const activity: PipelineActivity = { ...insertActivity, id, timestamp: new Date() };
    this.pipelineActivities.set(id, activity);
    return activity;
  }

  // Setup Status
  async getSetupStatus(): Promise<SetupStatus | undefined> {
    return this.setupStatus;
  }

  async updateSetupStatus(updates: Partial<InsertSetupStatus>): Promise<SetupStatus> {
    if (!this.setupStatus) {
      this.setupStatus = {
        id: 1,
        snowflakeConnected: false,
        fivetranConfigured: false,
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
}

// DatabaseStorage is disabled - using Snowflake instead of PostgreSQL
import { snowflakeConfig } from "./db";

export class DatabaseStorage implements IStorage {
  // DatabaseStorage is disabled since we removed PostgreSQL dependency
  // Using PersistentMemStorage with Snowflake integration instead
  
  private throwError(): never {
    throw new Error("DatabaseStorage is disabled. Using PersistentMemStorage with Snowflake integration.");
  }

  // Companies
  async getCompanies(): Promise<Company[]> { return this.throwError(); }
  async getCompany(id: number): Promise<Company | undefined> { return this.throwError(); }
  async createCompany(insertCompany: InsertCompany): Promise<Company> { return this.throwError(); }

  // Users
  async getUsers(): Promise<User[]> { return this.throwError(); }
  async getUser(id: number): Promise<User | undefined> { return this.throwError(); }
  async getUserByUsername(username: string): Promise<User | undefined> { return this.throwError(); }
  async createUser(insertUser: InsertUser): Promise<User> { return this.throwError(); }

  // Data Sources
  async getDataSources(companyId: number): Promise<DataSource[]> { return this.throwError(); }
  async getDataSource(id: number): Promise<DataSource | undefined> { return this.throwError(); }
  async createDataSource(insertDataSource: InsertDataSource): Promise<DataSource> { return this.throwError(); }
  async updateDataSource(id: number, updates: Partial<InsertDataSource>): Promise<DataSource | undefined> { return this.throwError(); }

  // SQL Models
  async getSqlModels(companyId: number): Promise<SqlModel[]> { return this.throwError(); }
  async getSqlModelsByLayer(companyId: number, layer: string): Promise<SqlModel[]> { return this.throwError(); }
  async getSqlModel(id: number): Promise<SqlModel | undefined> { return this.throwError(); }
  async getSqlModelByName(companyId: number, name: string): Promise<SqlModel | undefined> { return this.throwError(); }
  async createSqlModel(insertModel: InsertSqlModel): Promise<SqlModel> { return this.throwError(); }
  async updateSqlModel(id: number, updates: Partial<InsertSqlModel>): Promise<SqlModel | undefined> { return this.throwError(); }

  // KPI Metrics
  async getKpiMetrics(companyId: number): Promise<KpiMetric[]> { return this.throwError(); }
  async getKpiMetric(id: number): Promise<KpiMetric | undefined> { return this.throwError(); }
  async createKpiMetric(insertMetric: InsertKpiMetric): Promise<KpiMetric> { return this.throwError(); }
  async updateKpiMetric(id: number, updates: Partial<InsertKpiMetric>): Promise<KpiMetric | undefined> { return this.throwError(); }
  async deleteKpiMetric(id: number): Promise<boolean> { return this.throwError(); }

  // Chat Messages
  async getChatMessages(companyId: number): Promise<ChatMessage[]> { return this.throwError(); }
  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> { return this.throwError(); }

  // Pipeline Activities
  async getPipelineActivities(companyId: number, limit = 50): Promise<PipelineActivity[]> { return this.throwError(); }
  async createPipelineActivity(insertActivity: InsertPipelineActivity): Promise<PipelineActivity> { return this.throwError(); }

  // Setup Status
  async getSetupStatus(companyId: number): Promise<SetupStatus | undefined> { return this.throwError(); }
  async updateSetupStatus(companyId: number, updates: Partial<InsertSetupStatus>): Promise<SetupStatus> { return this.throwError(); }
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
        
        console.log(`✓ Loaded ${this.kpiMetrics.size} metrics from persistent storage`);
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
        kpiMetrics: Object.fromEntries(this.kpiMetrics.entries())
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
}

// Use in-memory storage by default since we removed PostgreSQL dependency
// In production, this would be replaced with Snowflake integration
export const storage = new PersistentMemStorage();
