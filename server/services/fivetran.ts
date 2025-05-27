interface FivetranConfig {
  apiKey: string;
  apiSecret: string;
  groupId: string;
}

interface ConnectorConfig {
  service: string;
  groupId: string;
  config: Record<string, any>;
}

export class FivetranService {
  private config: FivetranConfig | null = null;

  constructor() {
    this.config = {
      apiKey: process.env.FIVETRAN_API_KEY || "",
      apiSecret: process.env.FIVETRAN_API_SECRET || "",
      groupId: process.env.FIVETRAN_GROUP_ID || "",
    };
  }

  private async makeRequest(endpoint: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: any): Promise<any> {
    if (!this.config?.apiKey || !this.config?.apiSecret) {
      throw new Error("Fivetran API credentials not configured");
    }

    const url = `https://api.fivetran.com/v1${endpoint}`;
    const auth = Buffer.from(`${this.config.apiKey}:${this.config.apiSecret}`).toString('base64');

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Fivetran API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Fivetran API request failed:`, error);
      throw error;
    }
  }

  async createConnector(config: ConnectorConfig): Promise<{ id: string; status: string }> {
    try {
      const response = await this.makeRequest('/connectors', 'POST', {
        service: config.service,
        group_id: config.groupId,
        config: config.config,
      });

      console.log(`Created ${config.service} connector:`, response.data.id);
      return {
        id: response.data.id,
        status: response.data.status.setup_state,
      };
    } catch (error) {
      console.error(`Failed to create ${config.service} connector:`, error);
      throw error;
    }
  }

  async getConnector(connectorId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/connectors/${connectorId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get connector ${connectorId}:`, error);
      throw error;
    }
  }

  async getConnectors(): Promise<any[]> {
    try {
      const response = await this.makeRequest(`/groups/${this.config?.groupId}/connectors`);
      return response.data.items || [];
    } catch (error) {
      console.error("Failed to get connectors:", error);
      return [];
    }
  }

  async syncConnector(connectorId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/connectors/${connectorId}/force`, 'POST');
      console.log(`Triggered sync for connector: ${connectorId}`);
      return true;
    } catch (error) {
      console.error(`Failed to sync connector ${connectorId}:`, error);
      return false;
    }
  }

  async pauseConnector(connectorId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/connectors/${connectorId}`, 'PATCH', {
        paused: true,
      });
      console.log(`Paused connector: ${connectorId}`);
      return true;
    } catch (error) {
      console.error(`Failed to pause connector ${connectorId}:`, error);
      return false;
    }
  }

  async resumeConnector(connectorId: string): Promise<boolean> {
    try {
      await this.makeRequest(`/connectors/${connectorId}`, 'PATCH', {
        paused: false,
      });
      console.log(`Resumed connector: ${connectorId}`);
      return true;
    } catch (error) {
      console.error(`Failed to resume connector ${connectorId}:`, error);
      return false;
    }
  }

  async getConnectorStatus(connectorId: string): Promise<{ status: string; lastSync: string; nextSync: string }> {
    try {
      const connector = await this.getConnector(connectorId);
      return {
        status: connector.status.setup_state,
        lastSync: connector.status.update_state,
        nextSync: connector.schedule_type,
      };
    } catch (error) {
      console.error(`Failed to get connector status ${connectorId}:`, error);
      return {
        status: 'unknown',
        lastSync: 'unknown',
        nextSync: 'unknown',
      };
    }
  }

  async createSalesforceConnector(salesforceConfig: {
    username: string;
    password: string;
    securityToken: string;
    isSandbox?: boolean;
  }): Promise<{ id: string; status: string }> {
    return this.createConnector({
      service: 'salesforce',
      groupId: this.config?.groupId || '',
      config: {
        username: salesforceConfig.username,
        password: salesforceConfig.password,
        security_token: salesforceConfig.securityToken,
        is_sandbox: salesforceConfig.isSandbox || false,
      },
    });
  }

  async createHubSpotConnector(hubspotConfig: {
    accessToken: string;
  }): Promise<{ id: string; status: string }> {
    return this.createConnector({
      service: 'hubspot',
      groupId: this.config?.groupId || '',
      config: {
        access_token: hubspotConfig.accessToken,
      },
    });
  }

  async createQuickBooksConnector(quickbooksConfig: {
    companyId: string;
    accessToken: string;
    refreshToken: string;
    isSandbox?: boolean;
  }): Promise<{ id: string; status: string }> {
    return this.createConnector({
      service: 'quickbooks',
      groupId: this.config?.groupId || '',
      config: {
        company_id: quickbooksConfig.companyId,
        access_token: quickbooksConfig.accessToken,
        refresh_token: quickbooksConfig.refreshToken,
        is_sandbox: quickbooksConfig.isSandbox || false,
      },
    });
  }
}

export const fivetranService = new FivetranService();
