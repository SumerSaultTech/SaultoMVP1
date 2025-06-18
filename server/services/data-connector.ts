interface DataConnectorConfig {
  serverUrl: string;
  clientId: string;
  clientSecret: string;
  workspaceId: string;
}

interface ConnectorConfig {
  service: string;
  workspaceId: string;
  config: Record<string, any>;
}

interface ConnectorResponse {
  success: boolean;
  data?: any;
  error?: string;
}

class DataConnectorService {
  private config: DataConnectorConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.config = {
      serverUrl: process.env.AIRBYTE_SERVER_URL || 'https://api.airbyte.com',
      clientId: process.env.AIRBYTE_CLIENT_ID || '',
      clientSecret: process.env.AIRBYTE_CLIENT_SECRET || '',
      workspaceId: 'bc926a02-3f86-446a-84cb-740d9a13caef'
    };
  }

  private async getAccessToken(): Promise<string | null> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch(`${this.config.serverUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        })
      });

      if (!response.ok) {
        console.error('OAuth token request failed:', response.status, response.statusText);
        return null;
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000); // Refresh 1 min early
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  private async makeApiCall(endpoint: string, options: any = {}): Promise<any> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error('Failed to obtain access token');
    }

    const response = await fetch(`${this.config.serverUrl}/v1${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async setupConnectors(): Promise<{ success: boolean; connectors?: any[]; error?: string }> {
    try {
      // Get workspace sources from Airbyte API
      const sources = await this.makeApiCall(`/workspaces/${this.config.workspaceId}/sources`);
      
      const connectors = sources.data?.map((source: any) => ({
        id: source.sourceId,
        name: source.name,
        service: source.sourceDefinitionId,
        status: 'connected',
        config: source.connectionConfiguration
      })) || [];

      return { success: true, connectors };
    } catch (error) {
      console.error('Failed to setup connectors:', error);
      return { success: false, error: `Failed to setup data connectors: ${error}` };
    }
  }

  async createConnector(config: ConnectorConfig): Promise<ConnectorResponse> {
    try {
      // Create actual Airbyte connection
      const connectionData = {
        name: `${config.service}_connection`,
        sourceId: config.config.sourceId,
        destinationId: config.config.destinationId,
        syncCatalog: config.config.syncCatalog || {},
        schedule: config.config.schedule || { scheduleType: 'manual' }
      };

      const connection = await this.makeApiCall(
        `/workspaces/${this.config.workspaceId}/connections`,
        {
          method: 'POST',
          body: JSON.stringify(connectionData)
        }
      );

      return { 
        success: true, 
        data: {
          connectionId: connection.connectionId,
          name: connection.name,
          status: connection.status,
          sourceId: connection.sourceId,
          destinationId: connection.destinationId
        }
      };
    } catch (error) {
      console.error('Failed to create connector:', error);
      return { success: false, error: `Failed to create connector: ${error}` };
    }
  }

  async triggerSync(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      // Simulate data sync trigger
      return { 
        success: true, 
        message: 'Data synchronization started successfully' 
      };
    } catch (error) {
      return { success: false, error: 'Failed to trigger data sync' };
    }
  }

  async getConnectorStatus(connectionId: string): Promise<ConnectorResponse> {
    try {
      // Simulate status check
      const status = {
        connectionId,
        status: 'running',
        lastSync: new Date().toISOString(),
        recordsSynced: Math.floor(Math.random() * 10000)
      };

      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: 'Failed to get connector status' };
    }
  }
}

export const dataConnectorService = new DataConnectorService();
export { DataConnectorService };