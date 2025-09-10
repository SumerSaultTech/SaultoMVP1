/**
 * ActiveCampaign API service extending base OAuth class infrastructure
 */
import { OAuthServiceBase } from './oauth-base.js';
import { SyncResult, TableDiscoveryResult } from './oauth-types.js';

export interface ActiveCampaignAuthResult {
  success: boolean;
  userInfo?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  error?: string;
}

export interface ActiveCampaignSyncResult {
  success: boolean;
  recordsSynced: number;
  tablesCreated: string[];
  error?: string;
}

export class ActiveCampaignApiService extends OAuthServiceBase {
  
  constructor() {
    super();
    console.log('🔧 ActiveCampaign API service initialized with base OAuth infrastructure');
  }
  
  /**
   * Get service type identifier - required by base class
   */
  getServiceType(): string {
    return 'activecampaign';
  }
  
  /**
   * OAuth refresh token method (not used by ActiveCampaign, but required by base class)
   */
  async refreshToken(refreshToken: string): Promise<any> {
    throw new Error('ActiveCampaign uses API key authentication, not OAuth refresh tokens');
  }
  
  /**
   * Authenticate with ActiveCampaign using API URL and API Key
   */
  async authenticate(apiUrl: string, apiKey: string): Promise<ActiveCampaignAuthResult> {
    try {
      console.log('🔐 Authenticating with ActiveCampaign API...');
      
      // Remove trailing slash from API URL
      const baseUrl = apiUrl.replace(/\/$/, '');
      
      // Test authentication by getting user info
      const response = await fetch(`${baseUrl}/api/3/users/me`, {
        method: 'GET',
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ActiveCampaign authentication failed:', response.status, errorText);
        return {
          success: false,
          error: `Authentication failed: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      console.log('✅ ActiveCampaign authentication successful');
      
      return {
        success: true,
        userInfo: {
          id: data.user?.id || 0,
          username: data.user?.username || '',
          firstName: data.user?.firstName || '',
          lastName: data.user?.lastName || '',
          email: data.user?.email || ''
        }
      };
      
    } catch (error) {
      console.error('❌ ActiveCampaign authentication error:', error);
      return {
        success: false,
        error: `Authentication error: ${error.message}`
      };
    }
  }

  /**
   * Fetch contacts from ActiveCampaign
   */
  async fetchContacts(apiUrl: string, apiKey: string, limit: number = 100): Promise<any[]> {
    try {
      const baseUrl = apiUrl.replace(/\/$/, '');
      const allContacts = [];
      let offset = 0;

      while (true) {
        const response = await fetch(`${baseUrl}/api/3/contacts?limit=${limit}&offset=${offset}`, {
          method: 'GET',
          headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const contacts = data.contacts || [];
        
        if (contacts.length === 0) break;
        
        allContacts.push(...contacts);
        
        // Check if we have more data
        if (contacts.length < limit) break;
        offset += limit;
      }

      console.log(`📊 Fetched ${allContacts.length} contacts from ActiveCampaign`);
      return allContacts;
      
    } catch (error) {
      console.error('❌ Error fetching ActiveCampaign contacts:', error);
      throw error;
    }
  }

  /**
   * Fetch lists from ActiveCampaign
   */
  async fetchLists(apiUrl: string, apiKey: string): Promise<any[]> {
    try {
      const baseUrl = apiUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/3/lists`, {
        method: 'GET',
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch lists: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const lists = data.lists || [];
      
      console.log(`📊 Fetched ${lists.length} lists from ActiveCampaign`);
      return lists;
      
    } catch (error) {
      console.error('❌ Error fetching ActiveCampaign lists:', error);
      throw error;
    }
  }

  /**
   * Fetch campaigns from ActiveCampaign
   */
  async fetchCampaigns(apiUrl: string, apiKey: string): Promise<any[]> {
    try {
      const baseUrl = apiUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/3/campaigns`, {
        method: 'GET',
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch campaigns: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const campaigns = data.campaigns || [];
      
      console.log(`📊 Fetched ${campaigns.length} campaigns from ActiveCampaign`);
      return campaigns;
      
    } catch (error) {
      console.error('❌ Error fetching ActiveCampaign campaigns:', error);
      throw error;
    }
  }

  /**
   * Fetch automations from ActiveCampaign
   */
  async fetchAutomations(apiUrl: string, apiKey: string): Promise<any[]> {
    try {
      const baseUrl = apiUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/3/automations`, {
        method: 'GET',
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch automations: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const automations = data.automations || [];
      
      console.log(`📊 Fetched ${automations.length} automations from ActiveCampaign`);
      return automations;
      
    } catch (error) {
      console.error('❌ Error fetching ActiveCampaign automations:', error);
      throw error;
    }
  }

  /**
   * Fetch tags from ActiveCampaign
   */
  async fetchTags(apiUrl: string, apiKey: string): Promise<any[]> {
    try {
      const baseUrl = apiUrl.replace(/\/$/, '');
      const response = await fetch(`${baseUrl}/api/3/tags`, {
        method: 'GET',
        headers: {
          'Api-Token': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const tags = data.tags || [];
      
      console.log(`📊 Fetched ${tags.length} tags from ActiveCampaign`);
      return tags;
      
    } catch (error) {
      console.error('❌ Error fetching ActiveCampaign tags:', error);
      throw error;
    }
  }

  /**
   * Discover available tables for ActiveCampaign
   */
  async discoverTables(apiUrl: string, apiKey: string): Promise<{ 
    success: boolean; 
    tables?: any; 
    error?: string; 
  }> {
    try {
      console.log('🔍 Discovering ActiveCampaign tables...');

      // Test API connectivity first
      const authResult = await this.authenticate(apiUrl, apiKey);
      if (!authResult.success) {
        return { success: false, error: authResult.error };
      }

      // Discover available data by testing each endpoint
      const availableDataTypes = [];

      try {
        await this.fetchContacts(apiUrl, apiKey, 1);
        availableDataTypes.push({ name: 'contact', label: 'Contacts', count: 'Available' });
      } catch (e) {
        console.warn('Contacts not accessible:', e.message);
      }

      try {
        await this.fetchLists(apiUrl, apiKey);
        availableDataTypes.push({ name: 'list', label: 'Lists', count: 'Available' });
      } catch (e) {
        console.warn('Lists not accessible:', e.message);
      }

      try {
        await this.fetchCampaigns(apiUrl, apiKey);
        availableDataTypes.push({ name: 'campaign', label: 'Campaigns', count: 'Available' });
      } catch (e) {
        console.warn('Campaigns not accessible:', e.message);
      }

      try {
        await this.fetchAutomations(apiUrl, apiKey);
        availableDataTypes.push({ name: 'automation', label: 'Automations', count: 'Available' });
      } catch (e) {
        console.warn('Automations not accessible:', e.message);
      }

      try {
        await this.fetchTags(apiUrl, apiKey);
        availableDataTypes.push({ name: 'tag', label: 'Tags', count: 'Available' });
      } catch (e) {
        console.warn('Tags not accessible:', e.message);
      }

      return {
        success: true,
        tables: {
          core: availableDataTypes.filter(t => ['contact', 'list', 'campaign', 'automation'].includes(t.name)),
          optional: availableDataTypes.filter(t => !['contact', 'list', 'campaign', 'automation'].includes(t.name)),
          totalTables: availableDataTypes.length
        }
      };

    } catch (error) {
      console.error('❌ Error discovering ActiveCampaign tables:', error);
      return {
        success: false,
        error: `Discovery failed: ${error.message}`
      };
    }
  }

  /**
   * Sync data from ActiveCampaign to PostgreSQL
   */
  async syncData(
    companyId: number, 
    apiUrl: string, 
    apiKey: string, 
    setupType: 'standard' | 'custom' = 'standard'
  ): Promise<ActiveCampaignSyncResult> {
    try {
      console.log(`🔄 Starting ActiveCampaign data sync for company ${companyId}`);

      // Authenticate first
      const authResult = await this.authenticate(apiUrl, apiKey);
      if (!authResult.success) {
        return {
          success: false,
          recordsSynced: 0,
          tablesCreated: [],
          error: authResult.error
        };
      }

      const schema = `analytics_company_${companyId}`;
      await this.createAnalyticsSchema(schema);

      let recordsSynced = 0;
      const tablesCreated = [];

      // Sync contacts (always included)
      try {
        const contacts = await this.fetchContacts(apiUrl, apiKey);
        if (contacts.length > 0) {
          await this.loadDataToWarehouse(contacts, `${schema}.raw_activecampaign_contacts`);
          recordsSynced += contacts.length;
          tablesCreated.push('contacts');
        }
      } catch (error) {
        console.warn('⚠️ Failed to sync contacts:', error.message);
      }

      // Sync lists (always included)
      try {
        const lists = await this.fetchLists(apiUrl, apiKey);
        if (lists.length > 0) {
          await this.loadDataToWarehouse(lists, `${schema}.raw_activecampaign_lists`);
          recordsSynced += lists.length;
          tablesCreated.push('lists');
        }
      } catch (error) {
        console.warn('⚠️ Failed to sync lists:', error.message);
      }

      // Sync campaigns (always included)
      try {
        const campaigns = await this.fetchCampaigns(apiUrl, apiKey);
        if (campaigns.length > 0) {
          await this.loadDataToWarehouse(campaigns, `${schema}.raw_activecampaign_campaigns`);
          recordsSynced += campaigns.length;
          tablesCreated.push('campaigns');
        }
      } catch (error) {
        console.warn('⚠️ Failed to sync campaigns:', error.message);
      }

      // Sync automations (always included)
      try {
        const automations = await this.fetchAutomations(apiUrl, apiKey);
        if (automations.length > 0) {
          await this.loadDataToWarehouse(automations, `${schema}.raw_activecampaign_automations`);
          recordsSynced += automations.length;
          tablesCreated.push('automations');
        }
      } catch (error) {
        console.warn('⚠️ Failed to sync automations:', error.message);
      }

      // Sync tags (optional)
      if (setupType === 'standard' || setupType === 'custom') {
        try {
          const tags = await this.fetchTags(apiUrl, apiKey);
          if (tags.length > 0) {
            await this.loadDataToWarehouse(tags, `${schema}.raw_activecampaign_tags`);
            recordsSynced += tags.length;
            tablesCreated.push('tags');
          }
        } catch (error) {
          console.warn('⚠️ Failed to sync tags:', error.message);
        }
      }

      // Create transformations for existing tables
      await this.createTransformations(schema, tablesCreated);

      console.log(`✅ ActiveCampaign sync completed: ${recordsSynced} records, ${tablesCreated.length} tables`);
      
      return {
        success: true,
        recordsSynced,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ ActiveCampaign sync failed:', error);
      return {
        success: false,
        recordsSynced: 0,
        tablesCreated: [],
        error: `Sync failed: ${error.message}`
      };
    }
  }

  /**
   * Create dbt-style transformations for ActiveCampaign data
   */
  private async createTransformations(schema: string, tablesCreated: string[]): Promise<void> {
    const sql = this.getSqlConnection();
    
    try {
      console.log('🔄 Creating ActiveCampaign transformations...');

      // Only create transformations for tables that exist
      for (const table of tablesCreated) {
        switch (table) {
          case 'contacts':
            // STG layer - standardize raw contact data
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.stg_activecampaign_contacts AS
              SELECT 
                (data->>'id')::bigint as contact_id,
                data->>'email' as email,
                data->>'firstName' as first_name,
                data->>'lastName' as last_name,
                data->>'phone' as phone,
                (data->>'cdate')::timestamp as created_at,
                (data->>'udate')::timestamp as updated_at,
                data->'fieldValues' as custom_fields,
                data->'listids' as list_memberships,
                data->'tags' as tags,
                _loaded_at
              FROM ${sql(schema)}.raw_activecampaign_contacts;
            `;

            // INT layer - business logic
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.int_activecampaign_contacts AS
              SELECT *,
                CASE 
                  WHEN email LIKE '%@%' THEN 'valid'
                  ELSE 'invalid'
                END as email_status,
                CASE
                  WHEN updated_at > created_at + INTERVAL '30 days' THEN 'active'
                  ELSE 'inactive' 
                END as engagement_status
              FROM ${sql(schema)}.stg_activecampaign_contacts;
            `;

            // CORE layer - final business entities
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.core_contacts AS
              SELECT 
                contact_id,
                email,
                first_name,
                last_name,
                phone,
                email_status,
                engagement_status,
                created_at,
                updated_at,
                'activecampaign' as source_system,
                _loaded_at
              FROM ${sql(schema)}.int_activecampaign_contacts
              WHERE email_status = 'valid';
            `;
            break;

          case 'campaigns':
            // STG layer
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.stg_activecampaign_campaigns AS
              SELECT 
                (data->>'id')::bigint as campaign_id,
                data->>'name' as campaign_name,
                data->>'subject' as subject_line,
                data->>'type' as campaign_type,
                data->>'status' as status,
                (data->>'sdate')::timestamp as sent_at,
                (data->>'cdate')::timestamp as created_at,
                (data->>'opens')::int as total_opens,
                (data->>'uniqueopens')::int as unique_opens,
                (data->>'clicks')::int as total_clicks,
                (data->>'uniqueclicks')::int as unique_clicks,
                (data->>'sent')::int as total_sent,
                _loaded_at
              FROM ${sql(schema)}.raw_activecampaign_campaigns;
            `;

            // INT layer with calculated metrics
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.int_activecampaign_campaigns AS
              SELECT *,
                CASE WHEN total_sent > 0 THEN 
                  ROUND((unique_opens::decimal / total_sent) * 100, 2)
                  ELSE 0 
                END as open_rate_percent,
                CASE WHEN unique_opens > 0 THEN
                  ROUND((unique_clicks::decimal / unique_opens) * 100, 2) 
                  ELSE 0
                END as click_through_rate_percent
              FROM ${sql(schema)}.stg_activecampaign_campaigns;
            `;

            // CORE layer
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.core_email_campaigns AS
              SELECT 
                campaign_id,
                campaign_name,
                subject_line,
                campaign_type,
                status,
                sent_at,
                total_sent,
                unique_opens,
                unique_clicks,
                open_rate_percent,
                click_through_rate_percent,
                'activecampaign' as source_system,
                _loaded_at
              FROM ${sql(schema)}.int_activecampaign_campaigns
              WHERE status = 'sent';
            `;
            break;

          case 'lists':
            // STG layer
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.stg_activecampaign_lists AS
              SELECT 
                (data->>'id')::bigint as list_id,
                data->>'name' as list_name,
                data->>'description' as description,
                (data->>'subscriber_count')::int as subscriber_count,
                (data->>'cdate')::timestamp as created_at,
                _loaded_at
              FROM ${sql(schema)}.raw_activecampaign_lists;
            `;

            // CORE layer (simple for lists)
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.core_email_lists AS
              SELECT 
                list_id,
                list_name,
                description,
                subscriber_count,
                created_at,
                'activecampaign' as source_system,
                _loaded_at
              FROM ${sql(schema)}.stg_activecampaign_lists;
            `;
            break;

          case 'automations':
            // STG layer
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.stg_activecampaign_automations AS
              SELECT 
                (data->>'id')::bigint as automation_id,
                data->>'name' as automation_name,
                data->>'status' as status,
                (data->>'cdate')::timestamp as created_at,
                (data->>'mdate')::timestamp as modified_at,
                _loaded_at
              FROM ${sql(schema)}.raw_activecampaign_automations;
            `;

            // CORE layer
            await sql`
              CREATE OR REPLACE VIEW ${sql(schema)}.core_automations AS
              SELECT 
                automation_id,
                automation_name,
                status,
                created_at,
                modified_at,
                'activecampaign' as source_system,
                _loaded_at
              FROM ${sql(schema)}.stg_activecampaign_automations;
            `;
            break;
        }
      }

      console.log('✅ ActiveCampaign transformations created successfully');
      
    } catch (error) {
      console.error('❌ Error creating ActiveCampaign transformations:', error);
      // Don't throw - transformations are not critical for basic functionality
    }
  }
}

// Export singleton instance
export const activeCampaignApiService = new ActiveCampaignApiService();