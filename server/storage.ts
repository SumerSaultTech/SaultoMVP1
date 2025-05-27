import { 
  connections, 
  dataSources, 
  sqlModels, 
  kpis, 
  chatMessages, 
  pipelineRuns,
  users,
  type Connection, 
  type DataSource, 
  type SqlModel, 
  type Kpi, 
  type ChatMessage, 
  type PipelineRun,
  type User,
  type InsertConnection, 
  type InsertDataSource, 
  type InsertSqlModel, 
  type InsertKpi, 
  type InsertChatMessage, 
  type InsertPipelineRun,
  type InsertUser 
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Connections
  getConnections(): Promise<Connection[]>;
  getConnection(id: number): Promise<Connection | undefined>;
  createConnection(connection: InsertConnection): Promise<Connection>;
  updateConnection(id: number, updates: Partial<Connection>): Promise<Connection | undefined>;
  deleteConnection(id: number): Promise<boolean>;

  // Data Sources
  getDataSources(): Promise<DataSource[]>;
  getDataSource(id: number): Promise<DataSource | undefined>;
  createDataSource(dataSource: InsertDataSource): Promise<DataSource>;
  updateDataSource(id: number, updates: Partial<DataSource>): Promise<DataSource | undefined>;
  deleteDataSource(id: number): Promise<boolean>;

  // SQL Models
  getSqlModels(): Promise<SqlModel[]>;
  getSqlModel(id: number): Promise<SqlModel | undefined>;
  getSqlModelsByLayer(layer: string): Promise<SqlModel[]>;
  createSqlModel(model: InsertSqlModel): Promise<SqlModel>;
  updateSqlModel(id: number, updates: Partial<SqlModel>): Promise<SqlModel | undefined>;
  deleteSqlModel(id: number): Promise<boolean>;

  // KPIs
  getKpis(): Promise<Kpi[]>;
  getKpi(id: number): Promise<Kpi | undefined>;
  getActiveKpis(): Promise<Kpi[]>;
  createKpi(kpi: InsertKpi): Promise<Kpi>;
  updateKpi(id: number, updates: Partial<Kpi>): Promise<Kpi | undefined>;
  deleteKpi(id: number): Promise<boolean>;

  // Chat Messages
  getChatMessages(): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  deleteAllChatMessages(): Promise<boolean>;

  // Pipeline Runs
  getPipelineRuns(): Promise<PipelineRun[]>;
  getPipelineRun(id: number): Promise<PipelineRun | undefined>;
  getLatestPipelineRun(type?: string): Promise<PipelineRun | undefined>;
  createPipelineRun(run: InsertPipelineRun): Promise<PipelineRun>;
  updatePipelineRun(id: number, updates: Partial<PipelineRun>): Promise<PipelineRun | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private connections: Map<number, Connection> = new Map();
  private dataSources: Map<number, DataSource> = new Map();
  private sqlModels: Map<number, SqlModel> = new Map();
  private kpis: Map<number, Kpi> = new Map();
  private chatMessages: Map<number, ChatMessage> = new Map();
  private pipelineRuns: Map<number, PipelineRun> = new Map();
  private currentId = 1;

  constructor() {
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Initialize with some default KPIs
    const defaultKpis: Array<Omit<Kpi, 'id'>> = [
      {
        name: "Annual Recurring Revenue",
        description: "Total annual recurring revenue from all customers",
        sqlQuery: "SELECT SUM(annual_revenue) as value FROM core.customer_metrics WHERE is_active = true",
        value: "$2.4M",
        changePercent: "+12.5%",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Customer Lifetime Value",
        description: "Average lifetime value per customer",
        sqlQuery: "SELECT AVG(lifetime_value) as value FROM core.customer_metrics",
        value: "$8,450",
        changePercent: "+3.2%",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        name: "Monthly Churn Rate",
        description: "Percentage of customers churning per month",
        sqlQuery: "SELECT (churned_customers / total_customers) * 100 as value FROM core.churn_metrics WHERE month = DATE_TRUNC('month', CURRENT_DATE)",
        value: "2.1%",
        changePercent: "-0.3%",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    ];

    defaultKpis.forEach(kpi => {
      const id = this.currentId++;
      this.kpis.set(id, { ...kpi, id });
    });
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Connections
  async getConnections(): Promise<Connection[]> {
    return Array.from(this.connections.values());
  }

  async getConnection(id: number): Promise<Connection | undefined> {
    return this.connections.get(id);
  }

  async createConnection(connection: InsertConnection): Promise<Connection> {
    const id = this.currentId++;
    const newConnection: Connection = { 
      ...connection, 
      id, 
      createdAt: new Date(),
      lastSync: null 
    };
    this.connections.set(id, newConnection);
    return newConnection;
  }

  async updateConnection(id: number, updates: Partial<Connection>): Promise<Connection | undefined> {
    const connection = this.connections.get(id);
    if (!connection) return undefined;
    
    const updated = { ...connection, ...updates };
    this.connections.set(id, updated);
    return updated;
  }

  async deleteConnection(id: number): Promise<boolean> {
    return this.connections.delete(id);
  }

  // Data Sources
  async getDataSources(): Promise<DataSource[]> {
    return Array.from(this.dataSources.values());
  }

  async getDataSource(id: number): Promise<DataSource | undefined> {
    return this.dataSources.get(id);
  }

  async createDataSource(dataSource: InsertDataSource): Promise<DataSource> {
    const id = this.currentId++;
    const newDataSource: DataSource = { 
      ...dataSource, 
      id, 
      createdAt: new Date(),
      lastSync: null,
      recordCount: 0 
    };
    this.dataSources.set(id, newDataSource);
    return newDataSource;
  }

  async updateDataSource(id: number, updates: Partial<DataSource>): Promise<DataSource | undefined> {
    const dataSource = this.dataSources.get(id);
    if (!dataSource) return undefined;
    
    const updated = { ...dataSource, ...updates };
    this.dataSources.set(id, updated);
    return updated;
  }

  async deleteDataSource(id: number): Promise<boolean> {
    return this.dataSources.delete(id);
  }

  // SQL Models
  async getSqlModels(): Promise<SqlModel[]> {
    return Array.from(this.sqlModels.values());
  }

  async getSqlModel(id: number): Promise<SqlModel | undefined> {
    return this.sqlModels.get(id);
  }

  async getSqlModelsByLayer(layer: string): Promise<SqlModel[]> {
    return Array.from(this.sqlModels.values()).filter(model => model.layer === layer);
  }

  async createSqlModel(model: InsertSqlModel): Promise<SqlModel> {
    const id = this.currentId++;
    const newModel: SqlModel = { 
      ...model, 
      id, 
      createdAt: new Date(),
      lastDeployed: null,
      rowCount: null 
    };
    this.sqlModels.set(id, newModel);
    return newModel;
  }

  async updateSqlModel(id: number, updates: Partial<SqlModel>): Promise<SqlModel | undefined> {
    const model = this.sqlModels.get(id);
    if (!model) return undefined;
    
    const updated = { ...model, ...updates };
    this.sqlModels.set(id, updated);
    return updated;
  }

  async deleteSqlModel(id: number): Promise<boolean> {
    return this.sqlModels.delete(id);
  }

  // KPIs
  async getKpis(): Promise<Kpi[]> {
    return Array.from(this.kpis.values());
  }

  async getKpi(id: number): Promise<Kpi | undefined> {
    return this.kpis.get(id);
  }

  async getActiveKpis(): Promise<Kpi[]> {
    return Array.from(this.kpis.values()).filter(kpi => kpi.isActive);
  }

  async createKpi(kpi: InsertKpi): Promise<Kpi> {
    const id = this.currentId++;
    const newKpi: Kpi = { 
      ...kpi, 
      id, 
      createdAt: new Date(),
      updatedAt: new Date() 
    };
    this.kpis.set(id, newKpi);
    return newKpi;
  }

  async updateKpi(id: number, updates: Partial<Kpi>): Promise<Kpi | undefined> {
    const kpi = this.kpis.get(id);
    if (!kpi) return undefined;
    
    const updated = { ...kpi, ...updates, updatedAt: new Date() };
    this.kpis.set(id, updated);
    return updated;
  }

  async deleteKpi(id: number): Promise<boolean> {
    return this.kpis.delete(id);
  }

  // Chat Messages
  async getChatMessages(): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values()).sort((a, b) => 
      a.createdAt.getTime() - b.createdAt.getTime()
    );
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentId++;
    const newMessage: ChatMessage = { 
      ...message, 
      id, 
      createdAt: new Date() 
    };
    this.chatMessages.set(id, newMessage);
    return newMessage;
  }

  async deleteAllChatMessages(): Promise<boolean> {
    this.chatMessages.clear();
    return true;
  }

  // Pipeline Runs
  async getPipelineRuns(): Promise<PipelineRun[]> {
    return Array.from(this.pipelineRuns.values()).sort((a, b) => 
      b.startTime.getTime() - a.startTime.getTime()
    );
  }

  async getPipelineRun(id: number): Promise<PipelineRun | undefined> {
    return this.pipelineRuns.get(id);
  }

  async getLatestPipelineRun(type?: string): Promise<PipelineRun | undefined> {
    const runs = Array.from(this.pipelineRuns.values())
      .filter(run => !type || run.type === type)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return runs[0];
  }

  async createPipelineRun(run: InsertPipelineRun): Promise<PipelineRun> {
    const id = this.currentId++;
    const newRun: PipelineRun = { 
      ...run, 
      id, 
      startTime: new Date(),
      endTime: null 
    };
    this.pipelineRuns.set(id, newRun);
    return newRun;
  }

  async updatePipelineRun(id: number, updates: Partial<PipelineRun>): Promise<PipelineRun | undefined> {
    const run = this.pipelineRuns.get(id);
    if (!run) return undefined;
    
    const updated = { ...run, ...updates };
    this.pipelineRuns.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
