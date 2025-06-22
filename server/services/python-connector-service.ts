/**
 * Python Connector Service
 * Interfaces with the Python connector API service to manage data connectors
 */

import axios from 'axios';

interface ConnectorConfig {
  service: string;
  config: Record<string, any>;
}

interface ConnectorResponse {
  id: string;
  name: string;
  status: string;
  tableCount: number;
  lastSyncAt: Date | null;
  config: Record<string, any>;
}

interface SyncResult {
  success: boolean;
  records_synced: number;
  tables_synced: string[];
  error_message?: string;
  start_time?: string;
  end_time?: string;
  duration_seconds?: number;
}

interface AvailableConnector {
  name: string;
  required_credentials: string[];
  description: string;
}

class PythonConnectorService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.PYTHON_CONNECTOR_URL || 'http://localhost:5002';
  }

  /**
   * Check if the Python connector service is running
   */
  async isServiceHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      console.error('Python connector service health check failed:', error);
      return false;
    }
  }

  /**
   * Get list of available connector types
   */
  async getAvailableConnectors(): Promise<{ success: boolean; connectors?: AvailableConnector[]; error?: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/connectors/available`);
      return response.data;
    } catch (error) {
      console.error('Failed to get available connectors:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new connector
   */
  async createConnector(companyId: number, connectorType: string, credentials: Record<string, any>, config?: Record<string, any>): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/connectors/create`, {
        company_id: companyId,
        connector_type: connectorType,
        credentials,
        config: config || {}
      });
      
      return response.data;
    } catch (error) {
      console.error(`Failed to create ${connectorType} connector:`, error);
      
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: error.response.data?.error || error.message
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test a connector connection
   */
  async testConnector(companyId: number, connectorType: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/connectors/${companyId}/${connectorType}/test`);
      return response.data;
    } catch (error) {
      console.error(`Failed to test ${connectorType} connector:`, error);
      
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: error.response.data?.error || error.message
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get available tables for a connector
   */
  async getConnectorTables(companyId: number, connectorType: string): Promise<{ success: boolean; tables?: string[]; error?: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/connectors/${companyId}/${connectorType}/tables`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get tables for ${connectorType}:`, error);
      
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: error.response.data?.error || error.message
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sync data for a connector
   */
  async syncConnector(companyId: number, connectorType: string, tables?: string[]): Promise<SyncResult> {
    try {
      const response = await axios.post(`${this.baseUrl}/connectors/${companyId}/${connectorType}/sync`, {
        tables
      });
      
      return response.data;
    } catch (error) {
      console.error(`Failed to sync ${connectorType}:`, error);
      
      let errorMessage = 'Unknown error';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.error || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        records_synced: 0,
        tables_synced: [],
        error_message: errorMessage
      };
    }
  }

  /**
   * Get connector status
   */
  async getConnectorStatus(companyId: number, connectorType: string): Promise<{
    exists: boolean;
    status: string;
    message?: string;
    table_count?: number;
    available_tables?: string[];
  }> {
    try {
      const response = await axios.get(`${this.baseUrl}/connectors/${companyId}/${connectorType}/status`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get status for ${connectorType}:`, error);
      
      return {
        exists: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove a connector
   */
  async removeConnector(companyId: number, connectorType: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await axios.delete(`${this.baseUrl}/connectors/${companyId}/${connectorType}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to remove ${connectorType} connector:`, error);
      
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: error.response.data?.error || error.message
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sync all connectors for a company
   */
  async syncAllConnectors(companyId: number): Promise<{ success: boolean; results?: Record<string, SyncResult>; error?: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/connectors/${companyId}/sync-all`);
      return response.data;
    } catch (error) {
      console.error(`Failed to sync all connectors for company ${companyId}:`, error);
      
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: error.response.data?.error || error.message
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Setup connectors - replaces the Airbyte mock functionality
   */
  async setupConnectors(): Promise<{ success: boolean; connectors?: any[]; error?: string }> {
    try {
      // Check if service is healthy
      const isHealthy = await this.isServiceHealthy();
      if (!isHealthy) {
        console.warn('Python connector service is not available, falling back to mock data');
        
        // Return mock connectors if Python service isn't available
        return {
          success: true,
          connectors: [
            {
              id: 'mock_salesforce',
              name: 'Salesforce Connector (Mock)',
              service: 'salesforce',
              status: 'available',
              tableCount: 0,
              lastSyncAt: null,
              config: {
                type: 'mock_connector',
                required_credentials: ['client_id', 'client_secret', 'username', 'password', 'security_token', 'instance_url'],
                description: 'Salesforce connector (Python service offline)',
                note: 'Start Python connector service with: python start_connector_service.py'
              }
            },
            {
              id: 'mock_hubspot',
              name: 'HubSpot Connector (Mock)',
              service: 'hubspot',
              status: 'available',
              tableCount: 0,
              lastSyncAt: null,
              config: {
                type: 'mock_connector',
                required_credentials: ['access_token'],
                description: 'HubSpot connector (Python service offline)',
                note: 'Start Python connector service with: python start_connector_service.py'
              }
            },
            {
              id: 'mock_jira',
              name: 'Jira Connector (Mock)',
              service: 'jira',
              status: 'available',
              tableCount: 0,
              lastSyncAt: null,
              config: {
                type: 'mock_connector',
                required_credentials: ['server_url', 'username', 'api_token'],
                description: 'Jira connector (Python service offline)',
                note: 'Start Python connector service with: python start_connector_service.py'
              }
            }
          ]
        };
      }

      // Get available connectors
      const availableResult = await this.getAvailableConnectors();
      if (!availableResult.success) {
        return availableResult;
      }

      // Convert to format expected by the frontend
      const connectors = availableResult.connectors?.map(connector => ({
        id: `python_${connector.name}`,
        name: `${connector.name.charAt(0).toUpperCase() + connector.name.slice(1)} Connector`,
        service: connector.name,
        status: 'available',
        tableCount: 0,
        lastSyncAt: null,
        config: {
          type: 'python_connector',
          required_credentials: connector.required_credentials,
          description: connector.description,
          note: 'Python-based API connector ready for configuration'
        }
      })) || [];

      return {
        success: true,
        connectors
      };

    } catch (error) {
      console.error('Failed to setup connectors:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create connector with config - matches Airbyte interface
   */
  async createConnectorWithConfig(config: ConnectorConfig): Promise<ConnectorResponse> {
    const connectorType = config.service.toLowerCase();
    const companyId = config.config.companyId || 1; // Default company for now
    
    // Check if service is healthy first
    const isHealthy = await this.isServiceHealthy();
    if (!isHealthy) {
      // Return mock connector if Python service isn't available
      console.warn(`Python connector service unavailable, returning mock ${connectorType} connector`);
      
      return {
        id: `mock_${connectorType}_${companyId}`,
        name: `${connectorType.charAt(0).toUpperCase() + connectorType.slice(1)} Connection (Mock)`,
        status: 'mock',
        tableCount: 0,
        lastSyncAt: null,
        config: {
          service: connectorType,
          type: 'mock_connector',
          companyId,
          authenticated: false,
          note: 'Python connector service is offline. Start with: python start_connector_service.py'
        }
      };
    }
    
    // Extract credentials from config
    const credentials = { ...config.config };
    delete credentials.companyId;
    
    // Map credential field names for different connectors
    if (connectorType === 'jira') {
      // Map common Jira field variations
      if (credentials.domain && !credentials.server_url) {
        credentials.server_url = credentials.domain;
        delete credentials.domain;
      }
      if (credentials.email && !credentials.username) {
        credentials.username = credentials.email;
        delete credentials.email;
      }
      // Remove extra fields that aren't needed
      delete credentials.start_date;
      delete credentials.start_datestart_date;
    }
    
    const result = await this.createConnector(companyId, connectorType, credentials);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create connector');
    }
    
    // Get status to return connector info
    const status = await this.getConnectorStatus(companyId, connectorType);
    
    return {
      id: `python_${connectorType}_${companyId}`,
      name: `${connectorType.charAt(0).toUpperCase() + connectorType.slice(1)} Connection`,
      status: status.status,
      tableCount: status.table_count || 0,
      lastSyncAt: null,
      config: {
        service: connectorType,
        type: 'python_connector',
        companyId,
        authenticated: status.status === 'connected'
      }
    };
  }

  /**
   * Get connector status with connection ID - matches Airbyte interface
   */
  async getConnectorStatusById(connectionId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Parse connection ID to extract company and connector type
      const parts = connectionId.split('_');
      if (parts.length < 3 || parts[0] !== 'python') {
        return {
          success: false,
          error: 'Invalid connection ID format'
        };
      }
      
      const connectorType = parts[1];
      const companyId = parseInt(parts[2]);
      
      const status = await this.getConnectorStatus(companyId, connectorType);
      
      return {
        success: true,
        data: {
          status: status.status,
          lastSync: new Date(),
          recordsSynced: 0,
          tableCount: status.table_count || 0,
          python: true
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Trigger sync by connection ID - matches Airbyte interface
   */
  async triggerSyncById(connectionId: string): Promise<{ success: boolean; message?: string; jobId?: string; error?: string }> {
    try {
      // Parse connection ID to extract company and connector type
      const parts = connectionId.split('_');
      if (parts.length < 3 || parts[0] !== 'python') {
        return {
          success: false,
          error: 'Invalid connection ID format'
        };
      }
      
      const connectorType = parts[1];
      const companyId = parseInt(parts[2]);
      
      const result = await this.syncConnector(companyId, connectorType);
      
      if (result.success) {
        return {
          success: true,
          message: `Synced ${result.records_synced} records from ${result.tables_synced.length} tables`,
          jobId: `python_job_${Date.now()}`
        };
      } else {
        return {
          success: false,
          error: result.error_message || 'Sync failed'
        };
      }
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const pythonConnectorService = new PythonConnectorService();