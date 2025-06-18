interface DataConnectorConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

interface AirbyteAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
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

  private accessToken?: string;
  private tokenExpiry?: number;

  constructor() {
    this.config = {
      clientId: process.env.AIRBYTE_CLIENT_ID || '',
      clientSecret: process.env.AIRBYTE_CLIENT_SECRET || '',
      baseUrl: 'https://api.airbyte.com/v1',
    };
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch('https://api.airbyte.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const tokenData: AirbyteAuthResponse = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // Refresh 1 minute early
    
    return this.accessToken;
  }

  private async makeApiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async setupConnectors(): Promise<{ success: boolean; connectors?: any[]; error?: string }> {
    try {
      // Get available source definitions from Airbyte
      const sourceDefinitions = await this.makeApiCall('/source_definitions');
      
      // Filter for the connectors we support
      const supportedConnectors = ['Salesforce', 'HubSpot', 'QuickBooks', 'Jira'];
      const connectors = sourceDefinitions.data
        .filter((def: any) => supportedConnectors.some(name => def.name.includes(name)))
        .map((def: any) => ({
          id: def.sourceDefinitionId,
          name: def.name,
          service: def.name.toLowerCase().replace(/\s+/g, '_'),
          status: 'available',
          config: def.connectionSpecification
        }));

      return { success: true, connectors };
    } catch (error) {
      console.error('Failed to setup connectors:', error);
      return { success: false, error: `Failed to setup data connectors: ${error}` };
    }
  }

  async createConnector(config: ConnectorConfig): Promise<ConnectorResponse> {
    try {
      // Step 1: Create workspace if needed
      const workspaces = await this.makeApiCall('/workspaces');
      let workspaceId = workspaces.data?.[0]?.workspaceId;
      
      if (!workspaceId) {
        const newWorkspace = await this.makeApiCall('/workspaces', {
          method: 'POST',
          body: JSON.stringify({
            name: 'MVP Workspace'
          })
        });
        workspaceId = newWorkspace.workspaceId;
      }

      // Step 2: Create source
      const source = await this.makeApiCall('/sources', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          name: `${config.service}_source`,
          sourceDefinitionId: this.getSourceDefinitionId(config.service),
          connectionConfiguration: config.config
        })
      });

      // Step 3: Get or create Snowflake destination
      const destinations = await this.makeApiCall(`/destinations?workspaceId=${workspaceId}`);
      let destinationId = destinations.data?.find((dest: any) => dest.name.includes('Snowflake'))?.destinationId;
      
      if (!destinationId) {
        const destination = await this.makeApiCall('/destinations', {
          method: 'POST',
          body: JSON.stringify({
            workspaceId,
            name: 'Snowflake Destination',
            destinationDefinitionId: this.getSnowflakeDestinationId(),
            connectionConfiguration: {
              host: process.env.SNOWFLAKE_ACCOUNT + '.snowflakecomputing.com',
              role: 'ACCOUNTADMIN',
              warehouse: process.env.SNOWFLAKE_WAREHOUSE,
              database: process.env.SNOWFLAKE_DATABASE,
              schema: 'RAW',
              username: process.env.SNOWFLAKE_USER,
              password: process.env.SNOWFLAKE_PASSWORD
            }
          })
        });
        destinationId = destination.destinationId;
      }

      // Step 4: Create connection
      const connection = await this.makeApiCall('/connections', {
        method: 'POST',
        body: JSON.stringify({
          sourceId: source.sourceId,
          destinationId,
          configurations: {
            streams: [] // Auto-discover streams
          },
          scheduleType: 'manual' // Can be changed to 'basic' with schedule
        })
      });

      return { 
        success: true, 
        data: {
          connectionId: connection.connectionId,
          sourceId: source.sourceId,
          destinationId,
          name: `${config.service}_connection`,
          status: connection.status
        }
      };
    } catch (error) {
      console.error('Failed to create connector:', error);
      return { success: false, error: `Failed to create connector: ${error}` };
    }
  }

  private getSourceDefinitionId(service: string): string {
    const sourceDefinitionIds: Record<string, string> = {
      'jira': 'e7778cfc-e97c-4458-9ecb-b4f2bba8946c',
      'salesforce': 'b117307c-14b6-41aa-9422-947e34922962',
      'hubspot': 'f4d48525-a1b3-4c8d-a15b-6e14f8aa757e',
      'quickbooks': 'ddac9000-90ea-43aa-9b0f-a23ede0ca6d3'
    };
    return sourceDefinitionIds[service.toLowerCase()] || '';
  }

  private getSnowflakeDestinationId(): string {
    return 'b69f7f9c-b93e-4c11-84c0-5d2d6c2b2f7c'; // Snowflake destination definition ID
  }

  async triggerSync(connectionId: string): Promise<{ success: boolean; message?: string; error?: string; jobId?: string }> {
    try {
      const job = await this.makeApiCall('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          connectionId,
          jobType: 'sync'
        })
      });

      return { 
        success: true, 
        message: 'Data synchronization started successfully',
        jobId: job.jobId
      };
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      return { success: false, error: `Failed to trigger data sync: ${error}` };
    }
  }

  async getConnectorStatus(connectionId: string): Promise<ConnectorResponse> {
    try {
      const connection = await this.makeApiCall(`/connections/${connectionId}`);
      const jobs = await this.makeApiCall(`/jobs?connectionId=${connectionId}&limit=1`);
      
      const lastJob = jobs.data?.[0];
      const status = {
        connectionId,
        status: connection.status,
        lastSync: lastJob?.endedAt || lastJob?.startedAt,
        recordsSynced: lastJob?.rowsSynced || 0,
        jobStatus: lastJob?.status
      };

      return { success: true, data: status };
    } catch (error) {
      console.error('Failed to get connector status:', error);
      return { success: false, error: `Failed to get connector status: ${error}` };
    }
  }

  async listConnectors(workspaceId?: string): Promise<{ success: boolean; connectors?: any[]; error?: string }> {
    try {
      // Get workspace ID if not provided
      if (!workspaceId) {
        const workspaces = await this.makeApiCall('/workspaces');
        workspaceId = workspaces.data?.[0]?.workspaceId;
      }

      if (!workspaceId) {
        return { success: true, connectors: [] };
      }

      const connections = await this.makeApiCall(`/connections?workspaceId=${workspaceId}`);
      
      const connectors = await Promise.all(
        connections.data.map(async (conn: any) => {
          const jobs = await this.makeApiCall(`/jobs?connectionId=${conn.connectionId}&limit=1`);
          const lastJob = jobs.data?.[0];
          
          return {
            connectionId: conn.connectionId,
            name: conn.name,
            status: conn.status,
            lastSync: lastJob?.endedAt || lastJob?.startedAt,
            recordsSynced: lastJob?.rowsSynced || 0
          };
        })
      );

      return { success: true, connectors };
    } catch (error) {
      console.error('Failed to list connectors:', error);
      return { success: false, error: `Failed to list connectors: ${error}` };
    }
  }
}

export const dataConnectorService = new DataConnectorService();