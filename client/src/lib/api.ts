import { apiRequest } from "./queryClient";

// Dashboard API
export const dashboardApi = {
  getDashboard: () => apiRequest("GET", "/api/dashboard"),
  refreshData: () => apiRequest("POST", "/api/pipeline/sync"),
};

// Connections API
export const connectionsApi = {
  getConnections: () => apiRequest("GET", "/api/connections"),
  createConnection: (data: any) => apiRequest("POST", "/api/connections", data),
  updateConnection: (id: number, data: any) => apiRequest("PATCH", `/api/connections/${id}`, data),
  deleteConnection: (id: number) => apiRequest("DELETE", `/api/connections/${id}`),
};

// Data Sources API
export const dataSourcesApi = {
  getDataSources: () => apiRequest("GET", "/api/data-sources"),
  createDataSource: (data: any) => apiRequest("POST", "/api/data-sources", data),
  updateDataSource: (id: number, data: any) => apiRequest("PATCH", `/api/data-sources/${id}`, data),
  deleteDataSource: (id: number) => apiRequest("DELETE", `/api/data-sources/${id}`),
};

// Setup API
export const setupApi = {
  setupSnowflake: (config: {
    account: string;
    username: string;
    password: string;
    warehouse: string;
    database: string;
    schema: string;
  }) => apiRequest("POST", "/api/setup/snowflake", config),
  
  setupFivetranConnectors: (config: {
    salesforce?: {
      username: string;
      password: string;
      securityToken: string;
      isSandbox?: boolean;
    };
    hubspot?: {
      accessToken: string;
    };
    quickbooks?: {
      companyId: string;
      accessToken: string;
      refreshToken: string;
      isSandbox?: boolean;
    };
  }) => apiRequest("POST", "/api/setup/fivetran-connectors", config),
};

// Models API
export const modelsApi = {
  getModels: () => apiRequest("GET", "/api/models"),
  getModelsByLayer: (layer: string) => apiRequest("GET", `/api/models/layer/${layer}`),
  createModel: (data: {
    name: string;
    layer: string;
    sql: string;
    description?: string;
  }) => apiRequest("POST", "/api/models", data),
  deployModels: (layers?: string[]) => apiRequest("POST", "/api/models/deploy", { layers }),
  updateModel: (id: number, data: any) => apiRequest("PATCH", `/api/models/${id}`, data),
  deleteModel: (id: number) => apiRequest("DELETE", `/api/models/${id}`),
};

// KPIs API
export const kpisApi = {
  getKpis: () => apiRequest("GET", "/api/kpis"),
  getActiveKpis: () => apiRequest("GET", "/api/kpis?active=true"),
  createKpi: (data: {
    name: string;
    description?: string;
    sqlQuery: string;
    isActive?: boolean;
  }) => apiRequest("POST", "/api/kpis", data),
  updateKpi: (id: number, data: any) => apiRequest("PATCH", `/api/kpis/${id}`, data),
  refreshKpi: (id: number) => apiRequest("POST", `/api/kpis/${id}/refresh`),
  deleteKpi: (id: number) => apiRequest("DELETE", `/api/kpis/${id}`),
};

// AI Assistant API
export const aiApi = {
  suggestKPIs: (businessType: string, schema?: any) => 
    apiRequest("POST", "/api/ai/suggest-kpis", { businessType, schema }),
  
  generateSQL: (request: string, schema?: any) => 
    apiRequest("POST", "/api/ai/generate-sql", { request, schema }),
  
  chat: (message: string, context?: any[]) => 
    apiRequest("POST", "/api/ai/chat", { message, context }),
  
  getChatMessages: () => apiRequest("GET", "/api/chat/messages"),
  clearChatHistory: () => apiRequest("DELETE", "/api/chat/messages"),
};

// Tables API
export const tablesApi = {
  getTables: (schema?: string) => {
    const params = schema ? `?schema=${schema}` : "";
    return apiRequest("GET", `/api/tables${params}`);
  },
  getTableDetails: (tableName: string) => apiRequest("GET", `/api/tables/${tableName}`),
};

// Pipeline API
export const pipelineApi = {
  getPipelineRuns: () => apiRequest("GET", "/api/pipeline/runs"),
  getPipelineRun: (id: number) => apiRequest("GET", `/api/pipeline/runs/${id}`),
  triggerSync: () => apiRequest("POST", "/api/pipeline/sync"),
  triggerModelDeploy: (layers?: string[]) => apiRequest("POST", "/api/models/deploy", { layers }),
};

// SQL Execution API
export const sqlApi = {
  executeSQL: (sql: string) => apiRequest("POST", "/api/sql/execute", { sql }),
  validateSQL: (sql: string) => apiRequest("POST", "/api/sql/validate", { sql }),
};

// Health Check API
export const healthApi = {
  getHealth: () => apiRequest("GET", "/api/health"),
  getStatus: () => apiRequest("GET", "/api/status"),
};

// Default export with all APIs
export default {
  dashboard: dashboardApi,
  connections: connectionsApi,
  dataSources: dataSourcesApi,
  setup: setupApi,
  models: modelsApi,
  kpis: kpisApi,
  ai: aiApi,
  tables: tablesApi,
  pipeline: pipelineApi,
  sql: sqlApi,
  health: healthApi,
};
