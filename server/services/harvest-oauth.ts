/**
 * Harvest OAuth2 integration service extending base OAuth class
 */

import { OAuthServiceBase } from './oauth-base.js';
import { 
  TokenResponse, 
  SyncResult, 
  TableDiscoveryResult,
  OAuthError 
} from './oauth-types.js';

interface HarvestUserInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  access_roles: string[];
  default_account: {
    id: string;
    name: string;
  };
}

export class HarvestOAuthService extends OAuthServiceBase {
  
  constructor() {
    super();
  }

  /**
   * Get service type identifier
   */
  getServiceType(): string {
    return 'harvest';
  }

  /**
   * Generate authorization URL with company context
   */
  getAuthorizationUrl(companyId: number, userId?: number): string {
    const state = this.generateState(companyId, userId);
    
    // Harvest OAuth scopes for time tracking and project management
    const scopes = [
      'time_entries:read',  // Read time entries
      'projects:read',      // Read projects
      'clients:read',       // Read clients
      'invoices:read',      // Read invoices
      'users:read',         // Read users
      'tasks:read',         // Read tasks
      'reports:read'        // Read reports
    ];
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      state,
      scope: scopes.join(' ')
    });

    return `https://id.getharvest.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<TokenResponse> {
    try {
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code: code
      });

      const response = await fetch('https://id.getharvest.com/api/v2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: tokenParams.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Token exchange failed: ${response.statusText} - ${errorData}`);
      }

      const tokenData = await response.json();

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 3600, // Harvest tokens typically expire in 1 hour
        token_type: tokenData.token_type || 'bearer',
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get user info and workspaces
   */
  async getUserInfo(accessToken: string): Promise<HarvestUserInfo> {
    try {
      // Direct approach without account ID requirement
      const response = await fetch('https://api.harvestapp.com/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Get Harvest Account ID from the user's account
   */
  async getAccountId(accessToken: string): Promise<string> {
    try {
      const response = await fetch('https://api.harvestapp.com/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get account info: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔍 Harvest user data structure:', JSON.stringify(data, null, 2));
      
      // Try different possible locations for account ID
      let accountId = null;
      
      if (data.default_account?.id) {
        accountId = data.default_account.id;
      } else if (data.account?.id) {
        accountId = data.account.id;
      } else if (data.id) {
        // Sometimes the user ID can be used as account ID for single-account users
        accountId = data.id;
      } else if (data.accounts && data.accounts.length > 0) {
        accountId = data.accounts[0].id;
      }
      
      if (!accountId) {
        console.error('❌ No account ID found in any expected location');
        throw new Error('No account ID found in user info');
      }
      
      console.log(`🔗 Found Harvest account ID: ${accountId}`);
      return accountId.toString();
    } catch (error) {
      console.error('Failed to get account ID:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken
      });

      const response = await fetch('https://id.getharvest.com/api/v2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: refreshParams.toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken,
        expires_in: tokenData.expires_in || 3600,
        token_type: tokenData.token_type || 'bearer',
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.harvestapp.com/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
          'Accept': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to test API access:', error);
      return false;
    }
  }

  /**
   * Discover available tables - required by base class
   */
  async discoverTables(accessToken: string): Promise<TableDiscoveryResult[]> {
    return this.discoverHarvestTables(accessToken);
  }

  /**
   * Discover available Harvest tables and their properties dynamically
   */
  async discoverHarvestTables(accessToken: string): Promise<TableDiscoveryResult[]> {
    try {
      const tables = [];

      // Core Harvest objects
      const coreObjects = [
        { name: 'clients', label: 'Clients', endpoint: '/clients', fields: ['id', 'name', 'is_active', 'address', 'currency'] },
        { name: 'projects', label: 'Projects', endpoint: '/projects', fields: ['id', 'name', 'code', 'is_active', 'budget'] },
        { name: 'time_entries', label: 'Time Entries', endpoint: '/time_entries', fields: ['id', 'spent_date', 'hours', 'notes', 'billable'] },
        { name: 'invoices', label: 'Invoices', endpoint: '/invoices', fields: ['id', 'number', 'state', 'amount', 'due_date'] },
        { name: 'users', label: 'Users', endpoint: '/users', fields: ['id', 'first_name', 'last_name', 'email', 'is_active'] },
        { name: 'tasks', label: 'Tasks', endpoint: '/tasks', fields: ['id', 'name', 'billable_by_default', 'is_default'] },
      ];

      for (const object of coreObjects) {
        try {
          // Test if we can access this object
          const testUrl = `https://api.harvestapp.com/v2${object.endpoint}?per_page=1`;

          const testResponse = await fetch(testUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
              'Accept': 'application/json',
            },
          });

          if (testResponse.ok) {
            tables.push({
              name: object.name,
              label: object.label,
              fields: object.fields,
              accessible: true,
              isStandard: true
            });
          }
        } catch (error) {
          console.log(`Could not access ${object.name}:`, error.message);
        }
      }

      return tables.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Failed to discover Harvest tables:', error);
      return [];
    }
  }

  /**
   * Fetch Harvest clients
   */
  async fetchClients(accessToken: string, accountId: string, limit: number = 100): Promise<any[]> {
    try {
      let allClients: any[] = [];
      let page = 1;
      
      while (allClients.length < limit) {
        console.log(`🔍 Fetching clients page ${page}...`);
        const url = `https://api.harvestapp.com/v2/clients?page=${page}&per_page=${Math.min(100, limit - allClients.length)}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`❌ Harvest clients API error (${response.status}):`, errorBody);
          break;
        }

        const data = await response.json();
        if (!data.clients || data.clients.length === 0) {
          break;
        }

        allClients.push(...data.clients);
        
        if (!data.next_page) {
          break;
        }
        
        page++;
      }

      console.log(`✅ Fetched ${allClients.length} total clients`);
      return allClients.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Harvest clients:', error);
      throw error;
    }
  }

  /**
   * Fetch Harvest projects
   */
  async fetchProjects(accessToken: string, accountId: string, limit: number = 100): Promise<any[]> {
    try {
      let allProjects: any[] = [];
      let page = 1;
      
      while (allProjects.length < limit) {
        console.log(`🔍 Fetching projects page ${page}...`);
        const url = `https://api.harvestapp.com/v2/projects?page=${page}&per_page=${Math.min(100, limit - allProjects.length)}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`❌ Harvest projects API error (${response.status}):`, errorBody);
          break;
        }

        const data = await response.json();
        if (!data.projects || data.projects.length === 0) {
          break;
        }

        allProjects.push(...data.projects);
        
        if (!data.next_page) {
          break;
        }
        
        page++;
      }

      console.log(`✅ Fetched ${allProjects.length} total projects`);
      return allProjects.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Harvest projects:', error);
      throw error;
    }
  }

  /**
   * Fetch Harvest time entries
   */
  async fetchTimeEntries(accessToken: string, accountId: string, limit: number = 500): Promise<any[]> {
    try {
      let allTimeEntries: any[] = [];
      let page = 1;
      
      while (allTimeEntries.length < limit) {
        // First, try to get ALL time entries (no date filter)
        console.log(`📅 Fetching ALL time entries page ${page} (no date filter)`);
        const url = `https://api.harvestapp.com/v2/time_entries?page=${page}&per_page=100`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`❌ Harvest time entries API error (${response.status}):`, errorBody);
          break;
        }

        const data = await response.json();
        console.log(`📊 Page ${page}: Found ${data.time_entries?.length || 0} time entries, total pages: ${data.total_pages || 'unknown'}`);
        
        if (!data.time_entries || data.time_entries.length === 0) {
          console.log(`📊 No time entries found on page ${page}, stopping`);
          break;
        }

        allTimeEntries.push(...data.time_entries);
        
        if (!data.next_page || allTimeEntries.length >= limit) {
          break;
        }
        
        page++;
      }

      console.log(`✅ Fetched ${allTimeEntries.length} total time entries`);
      return allTimeEntries.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Harvest time entries:', error);
      throw error;
    }
  }

  /**
   * Fetch Harvest invoices
   */
  async fetchInvoices(accessToken: string, accountId: string, limit: number = 100): Promise<any[]> {
    try {
      let allInvoices: any[] = [];
      let page = 1;
      
      while (allInvoices.length < limit) {
        console.log(`🔍 Fetching invoices page ${page}...`);
        const url = `https://api.harvestapp.com/v2/invoices?page=${page}&per_page=${Math.min(100, limit - allInvoices.length)}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`❌ Harvest invoices API error (${response.status}):`, errorBody);
          break;
        }

        const data = await response.json();
        if (!data.invoices || data.invoices.length === 0) {
          break;
        }

        allInvoices.push(...data.invoices);
        
        if (!data.next_page) {
          break;
        }
        
        page++;
      }

      console.log(`✅ Fetched ${allInvoices.length} total invoices`);
      return allInvoices.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Harvest invoices:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for Harvest data (raw → stg → int → core)
   * SIMPLIFIED VERSION - matches Asana pattern without conditional logic
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;
    
    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
      
      console.log('🧹 Cleaning up existing transformation objects...');
      // Drop views first (they depend on tables)
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_harvest_clients`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_harvest_projects`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_harvest_time_entries`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_harvest_invoices`;
      
      // Drop tables in reverse dependency order
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_harvest_invoices`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_harvest_time_entries`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_harvest_projects`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_harvest_clients`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_harvest_invoices`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_harvest_time_entries`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_harvest_projects`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_harvest_clients`;
      
      console.log('📋 Creating staging tables (stg)...');
      
      // STG: harvest_clients - normalized and cleaned
      await sql`
        CREATE TABLE ${sql(schema)}.stg_harvest_clients AS
        SELECT DISTINCT 
          (data #>> '{}')::jsonb->>'id' as client_id,
          (data #>> '{}')::jsonb->>'name' as client_name,
          (data #>> '{}')::jsonb->>'is_active' = 'true' as is_active,
          (data #>> '{}')::jsonb->>'address' as address,
          (data #>> '{}')::jsonb->>'currency' as currency,
          ((data #>> '{}')::jsonb->>'created_at')::timestamp as created_at,
          ((data #>> '{}')::jsonb->>'updated_at')::timestamp as updated_at
        FROM ${sql(schema)}.raw_harvest_clients
        WHERE data IS NOT NULL
      `;
      
      // STG: harvest_projects - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_harvest_projects AS
        SELECT DISTINCT
          (data #>> '{}')::jsonb->>'id' as project_id,
          (data #>> '{}')::jsonb->>'name' as project_name,
          (data #>> '{}')::jsonb->>'code' as project_code,
          (data #>> '{}')::jsonb#>>'{client,id}' as client_id,
          (data #>> '{}')::jsonb#>>'{client,name}' as client_name,
          (data #>> '{}')::jsonb->>'is_active' = 'true' as is_active,
          (data #>> '{}')::jsonb->>'is_billable' = 'true' as is_billable,
          (data #>> '{}')::jsonb->>'is_fixed_fee' = 'true' as is_fixed_fee,
          COALESCE(((data #>> '{}')::jsonb->>'budget')::numeric, 0) as budget,
          COALESCE(((data #>> '{}')::jsonb->>'budget_spent')::numeric, 0) as budget_spent,
          COALESCE(((data #>> '{}')::jsonb->>'cost_budget')::numeric, 0) as cost_budget,
          ((data #>> '{}')::jsonb->>'starts_on')::date as start_date,
          ((data #>> '{}')::jsonb->>'ends_on')::date as end_date,
          ((data #>> '{}')::jsonb->>'created_at')::timestamp as created_at,
          ((data #>> '{}')::jsonb->>'updated_at')::timestamp as updated_at
        FROM ${sql(schema)}.raw_harvest_projects
        WHERE data IS NOT NULL
      `;
      
      // STG: harvest_time_entries - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_harvest_time_entries AS  
        SELECT DISTINCT
          (data #>> '{}')::jsonb->>'id' as time_entry_id,
          (data #>> '{}')::jsonb#>>'{project,id}' as project_id,
          (data #>> '{}')::jsonb#>>'{project,name}' as project_name,
          (data #>> '{}')::jsonb#>>'{client,id}' as client_id,
          (data #>> '{}')::jsonb#>>'{client,name}' as client_name,
          (data #>> '{}')::jsonb#>>'{user,id}' as user_id,
          (data #>> '{}')::jsonb#>>'{user,name}' as user_name,
          (data #>> '{}')::jsonb#>>'{task,id}' as task_id,
          (data #>> '{}')::jsonb#>>'{task,name}' as task_name,
          ((data #>> '{}')::jsonb->>'spent_date')::date as spent_date,
          COALESCE(((data #>> '{}')::jsonb->>'hours')::numeric, 0) as hours,
          (data #>> '{}')::jsonb->>'notes' as notes,
          (data #>> '{}')::jsonb->>'is_locked' = 'true' as is_locked,
          (data #>> '{}')::jsonb->>'is_closed' = 'true' as is_closed,
          (data #>> '{}')::jsonb->>'is_billed' = 'true' as is_billed,
          (data #>> '{}')::jsonb->>'is_running' = 'true' as is_running,
          (data #>> '{}')::jsonb->>'billable' = 'true' as billable,
          COALESCE(((data #>> '{}')::jsonb->>'billable_rate')::numeric, 0) as billable_rate,
          COALESCE(((data #>> '{}')::jsonb->>'cost_rate')::numeric, 0) as cost_rate,
          ((data #>> '{}')::jsonb->>'created_at')::timestamp as created_at,
          ((data #>> '{}')::jsonb->>'updated_at')::timestamp as updated_at
        FROM ${sql(schema)}.raw_harvest_time_entries
        WHERE data IS NOT NULL
      `;
      
      // STG: harvest_invoices - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_harvest_invoices AS
        SELECT DISTINCT
          (data #>> '{}')::jsonb->>'id' as invoice_id,
          (data #>> '{}')::jsonb#>>'{client,id}' as client_id,
          (data #>> '{}')::jsonb#>>'{client,name}' as client_name,
          (data #>> '{}')::jsonb->>'number' as invoice_number,
          (data #>> '{}')::jsonb->>'state' as state,
          COALESCE(((data #>> '{}')::jsonb->>'amount')::numeric, 0) as amount,
          COALESCE(((data #>> '{}')::jsonb->>'due_amount')::numeric, 0) as due_amount,
          COALESCE(((data #>> '{}')::jsonb->>'discount')::numeric, 0) as discount,
          COALESCE(((data #>> '{}')::jsonb->>'tax')::numeric, 0) as tax,
          COALESCE(((data #>> '{}')::jsonb->>'tax2')::numeric, 0) as tax2,
          ((data #>> '{}')::jsonb->>'issue_date')::date as issue_date,
          ((data #>> '{}')::jsonb->>'due_date')::date as due_date,
          ((data #>> '{}')::jsonb->>'payment_term')::text as payment_term,
          (data #>> '{}')::jsonb->>'currency' as currency,
          ((data #>> '{}')::jsonb->>'sent_at')::timestamp as sent_at,
          ((data #>> '{}')::jsonb->>'paid_at')::timestamp as paid_at,
          ((data #>> '{}')::jsonb->>'closed_at')::timestamp as closed_at,
          ((data #>> '{}')::jsonb->>'created_at')::timestamp as created_at,
          ((data #>> '{}')::jsonb->>'updated_at')::timestamp as updated_at
        FROM ${sql(schema)}.raw_harvest_invoices
        WHERE data IS NOT NULL
      `;
      
      console.log('🔗 Creating integration tables (int)...');
      
      // INT: harvest_clients - enriched client data with calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_harvest_clients AS
        SELECT 
          client_id,
          client_name,
          is_active,
          address,
          currency,
          created_at,
          updated_at,
          -- Calculated fields
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/86400 as days_since_created,
          CASE 
            WHEN is_active THEN 'Active'
            ELSE 'Inactive'
          END as status
        FROM ${sql(schema)}.stg_harvest_clients
      `;
      
      // INT: harvest_projects - enriched project data
      await sql`
        CREATE TABLE ${sql(schema)}.int_harvest_projects AS
        SELECT 
          project_id,
          project_name,
          project_code,
          client_id,
          client_name,
          is_active,
          is_billable,
          is_fixed_fee,
          budget,
          budget_spent,
          cost_budget,
          start_date,
          end_date,
          created_at,
          updated_at,
          -- Calculated fields
          CASE 
            WHEN budget > 0 THEN ROUND((budget_spent / budget) * 100, 2)
            ELSE 0
          END as budget_utilization_percent,
          budget - budget_spent as budget_remaining,
          CASE 
            WHEN end_date < CURRENT_DATE THEN 'Completed'
            WHEN start_date > CURRENT_DATE THEN 'Not Started'
            WHEN is_active THEN 'In Progress'
            ELSE 'Inactive'
          END as project_status,
          CASE 
            WHEN is_billable THEN 'Billable'
            ELSE 'Non-Billable'
          END as billing_type
        FROM ${sql(schema)}.stg_harvest_projects
      `;
      
      // INT: harvest_time_entries - enriched with calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_harvest_time_entries AS
        SELECT 
          time_entry_id,
          project_id,
          project_name,
          client_id,
          client_name,
          user_id,
          user_name,
          task_id,
          task_name,
          spent_date,
          hours,
          notes,
          is_locked,
          is_closed,
          is_billed,
          is_running,
          billable,
          billable_rate,
          cost_rate,
          created_at,
          updated_at,
          -- Calculated fields
          hours * billable_rate as billable_amount,
          hours * cost_rate as cost_amount,
          (hours * billable_rate) - (hours * cost_rate) as profit_amount,
          CASE 
            WHEN is_billed THEN 'Billed'
            WHEN billable THEN 'Billable'
            ELSE 'Non-Billable'
          END as billing_status
        FROM ${sql(schema)}.stg_harvest_time_entries
      `;
      
      // INT: harvest_invoices - enriched invoice data
      await sql`
        CREATE TABLE ${sql(schema)}.int_harvest_invoices AS
        SELECT 
          invoice_id,
          client_id,
          client_name,
          invoice_number,
          state,
          amount,
          due_amount,
          discount,
          tax,
          tax2,
          issue_date,
          due_date,
          payment_term,
          currency,
          sent_at,
          paid_at,
          closed_at,
          created_at,
          updated_at,
          -- Calculated fields
          amount - due_amount as paid_amount,
          CASE 
            WHEN amount > 0 THEN ROUND(((amount - due_amount) / amount) * 100, 2)
            ELSE 0
          END as payment_progress_percent,
          CASE 
            WHEN state = 'paid' THEN 'Paid'
            WHEN state = 'open' AND due_date < CURRENT_DATE THEN 'Overdue'
            WHEN state = 'open' THEN 'Open'
            WHEN state = 'draft' THEN 'Draft'
            ELSE state
          END as invoice_status
        FROM ${sql(schema)}.stg_harvest_invoices
      `;
      
      console.log('👁️ Creating core views...');
      
      // CORE: Views that mirror int tables (no aggregation)
      await sql`
        CREATE VIEW ${sql(schema)}.core_harvest_clients AS 
        SELECT * FROM ${sql(schema)}.int_harvest_clients
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_harvest_projects AS
        SELECT * FROM ${sql(schema)}.int_harvest_projects  
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_harvest_time_entries AS
        SELECT * FROM ${sql(schema)}.int_harvest_time_entries
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_harvest_invoices AS
        SELECT * FROM ${sql(schema)}.int_harvest_invoices
      `;
      
      console.log('✅ Transformation pipeline completed (raw → stg → int → core)');
      
    } catch (error) {
      console.error('❌ Transformation pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Sync Harvest data to company analytics schema using stored OAuth tokens
   */
  async syncDataToSchema(companyId: number): Promise<SyncResult> {
    try {
      // Use Node.js database direct access
      const { eq, sql: sqlOp } = await import('drizzle-orm');
      const postgres = (await import('postgres')).default;
      const { drizzle } = await import('drizzle-orm/postgres-js');
      
      // Get database connection
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not configured');
      }
      
      const sql = postgres(databaseUrl);
      const db = drizzle(sql);

      console.log(`🔄 Starting Harvest OAuth sync for company ${companyId}`);
      
      // Get stored OAuth tokens from database
      const storage = (await import('../storage')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const harvestSource = dataSources.find(ds => ds.type === 'harvest');
      
      if (!harvestSource || !harvestSource.config) {
        throw new Error('No Harvest OAuth tokens found for this company');
      }

      const config = typeof harvestSource.config === 'string' 
        ? JSON.parse(harvestSource.config) 
        : harvestSource.config;
      const { accessToken } = config;
      
      if (!accessToken) {
        throw new Error('Invalid OAuth configuration');
      }

      // Try to get Harvest account ID, but don't fail if unavailable
      let accountId = null;
      try {
        accountId = await this.getAccountId(accessToken);
        console.log(`🔗 Using Harvest account: ${accountId}`);
      } catch (error) {
        console.log('⚠️ Could not get account ID, proceeding without it:', (error as Error).message);
        accountId = 'default'; // Use placeholder
      }

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Fetch and sync clients with automatic token refresh
      console.log('👥 Fetching Harvest clients...');
      const clients = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchClients(token, accountId, 500)
      );
      if (clients.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'harvest_clients', clients, 'harvest_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_harvest_clients');
        console.log(`✅ Synced ${recordsLoaded} clients`);
      }

      // Fetch and sync projects with automatic token refresh
      console.log('📁 Fetching Harvest projects...');
      const projects = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchProjects(token, accountId, 200)
      );
      if (projects.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'harvest_projects', projects, 'harvest_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_harvest_projects');
        console.log(`✅ Synced ${recordsLoaded} projects`);
      }

      // Fetch and sync time entries with automatic token refresh
      console.log('⏰ Fetching Harvest time entries...');
      const timeEntries = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchTimeEntries(token, accountId, 1000)
      );
      if (timeEntries.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'harvest_time_entries', timeEntries, 'harvest_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_harvest_time_entries');
        console.log(`✅ Synced ${recordsLoaded} time entries`);
      }

      // Fetch and sync invoices with automatic token refresh
      console.log('📄 Fetching Harvest invoices...');
      const invoices = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchInvoices(token, accountId, 200)
      );
      if (invoices.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'harvest_invoices', invoices, 'harvest_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_harvest_invoices');
        console.log(`✅ Synced ${recordsLoaded} invoices`);
      }
      
      // Run automatic dbt-style transformations
      console.log('🔄 Running dbt-style transformations...');
      try {
        await this.runTransformations(companyId, sql);
        console.log('✅ Transformations completed successfully');
      } catch (transformError) {
        console.error('❌ Transformation failed:', transformError);
        // Continue with sync even if transformations fail
      }
      
      // Close database connection
      await sql.end();

      console.log(`🎉 Harvest OAuth sync completed: ${totalRecords} total records across ${tablesCreated.length} tables`);

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ Harvest OAuth sync failed:', error);
      return {
        success: false,
        recordsSynced: 0,
        tablesCreated: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const harvestOAuthService = new HarvestOAuthService();