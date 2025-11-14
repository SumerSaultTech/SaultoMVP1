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
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  accounts: Array<{
    id: number;
    name: string;
    product: string;
  }>;
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
    
    // Harvest doesn't use traditional scopes - access is all or nothing
    // The app gets access to all data the authorizing user has access to
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
      response_type: 'code'
    });

    return `https://id.getharvest.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<TokenResponse> {
    try {
      const tokenParams = {
        code: code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri
      };

      const response = await fetch('https://id.getharvest.com/api/v2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(tokenParams),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Token exchange failed: ${response.statusText} - ${errorData}`);
      }

      const tokenData = await response.json();

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 3600, // Harvest tokens don't expire but set a default
        token_type: tokenData.token_type || 'bearer',
        scope: tokenData.scope || 'all', // Harvest provides all data access
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get current user and account info
   */
  async getUserInfo(accessToken: string): Promise<HarvestUserInfo> {
    try {
      console.log('🔍 Fetching Harvest user info directly...');
      
      // Try to get user info first - this should work without account ID for some endpoints
      const response = await fetch('https://api.harvestapp.com/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
          'Accept': 'application/json',
        },
      });

      console.log(`🔍 User info response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.log('❌ Direct user info failed, trying with accounts endpoint...');
        
        // If direct approach fails, try the accounts approach
        const accountsResponse = await fetch('https://id.getharvest.com/api/v2/accounts', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
            'Accept': 'application/json',
          },
        });

        console.log(`🔍 Accounts response status: ${accountsResponse.status} ${accountsResponse.statusText}`);

        if (!accountsResponse.ok) {
          const errorText = await accountsResponse.text();
          console.error('❌ Accounts API error:', errorText);
          throw new Error(`Failed to get accounts: ${accountsResponse.status} ${accountsResponse.statusText} - ${errorText}`);
        }

        const accountsData = await accountsResponse.json();
        console.log('🔍 Accounts data:', JSON.stringify(accountsData, null, 2));
        
        const accounts = accountsData.accounts || [];
        
        if (accounts.length === 0) {
          throw new Error('No Harvest accounts found');
        }

        // Use the first account (primary account)
        const primaryAccount = accounts[0];
        const accountId = primaryAccount.id.toString();
        console.log(`🔍 Using Harvest account ID: ${accountId} (${primaryAccount.name})`);

        // Retry user info with account ID
        const retryResponse = await fetch('https://api.harvestapp.com/v2/users/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Harvest-Account-Id': accountId,
            'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
            'Accept': 'application/json',
          },
        });

        if (!retryResponse.ok) {
          const errorText = await retryResponse.text();
          console.error('❌ User info API error with account ID:', errorText);
          throw new Error(`Failed to get user info: ${retryResponse.status} ${retryResponse.statusText} - ${errorText}`);
        }

        const userData = await retryResponse.json();
        console.log('✅ User data retrieved successfully with account ID');
        
        return {
          id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          accounts: accounts
        };
      }

      const userData = await response.json();
      console.log('✅ User data retrieved successfully (direct approach)');
      
      // For direct approach, we need to get accounts separately for completeness
      try {
        const accountsResponse = await fetch('https://id.getharvest.com/api/v2/accounts', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'User-Agent': 'Saulto Business Dashboard (https://saulto.com)',
            'Accept': 'application/json',
          },
        });
        
        const accountsData = await accountsResponse.json();
        const accounts = accountsData.accounts || [];
        
        return {
          id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          accounts: accounts
        };
      } catch (accountsError) {
        console.log('⚠️ Could not fetch accounts, proceeding without them');
        return {
          id: userData.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          accounts: []
        };
      }
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const refreshParams = {
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token'
      };

      const response = await fetch('https://id.getharvest.com/api/v2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(refreshParams),
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
        scope: tokenData.scope || 'all',
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string, accountId?: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.harvestapp.com/v2/company', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Harvest-Account-Id': accountId || 'all',
          'User-Agent': 'Saulto Business Dashboard',
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
   * Get the primary Harvest account ID
   */
  async getAccountId(accessToken: string): Promise<string> {
    try {
      const response = await fetch('https://id.getharvest.com/api/v2/accounts', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Saulto Business Dashboard',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get account ID');
      }

      const data = await response.json();
      const accounts = data.accounts || [];
      
      if (accounts.length === 0) {
        throw new Error('No Harvest accounts found');
      }

      // Return the first account ID (primary account)
      return accounts[0].id.toString();
    } catch (error) {
      console.error('Failed to get account ID:', error);
      throw error;
    }
  }

  /**
   * Discover available tables - required by base class
   */
  async discoverTables(accessToken: string): Promise<TableDiscoveryResult[]> {
    const accountId = await this.getAccountId(accessToken);
    return this.discoverHarvestTables(accessToken, accountId);
  }

  /**
   * Discover available Harvest tables and their properties
   */
  async discoverHarvestTables(accessToken: string, accountId: string): Promise<TableDiscoveryResult[]> {
    try {
      const tables = [];

      // Core Harvest entities
      const coreEntities = [
        { name: 'clients', label: 'Clients', endpoint: '/v2/clients', fields: ['id', 'name', 'is_active', 'address', 'currency'] },
        { name: 'projects', label: 'Projects', endpoint: '/v2/projects', fields: ['id', 'name', 'code', 'is_active', 'is_billable', 'budget'] },
        { name: 'tasks', label: 'Tasks', endpoint: '/v2/tasks', fields: ['id', 'name', 'billable_by_default', 'default_hourly_rate', 'is_active'] },
        { name: 'users', label: 'Users', endpoint: '/v2/users', fields: ['id', 'first_name', 'last_name', 'email', 'is_active'] },
        { name: 'time_entries', label: 'Time Entries', endpoint: '/v2/time_entries', fields: ['id', 'spent_date', 'hours', 'notes', 'is_running'] },
        { name: 'expenses', label: 'Expenses', endpoint: '/v2/expenses', fields: ['id', 'spent_date', 'total_cost', 'notes', 'is_closed'] },
        { name: 'invoices', label: 'Invoices', endpoint: '/v2/invoices', fields: ['id', 'number', 'state', 'amount', 'due_date'] },
        { name: 'invoice_line_items', label: 'Invoice Line Items', endpoint: '/v2/invoices', fields: ['id', 'kind', 'description', 'quantity', 'unit_price'] },
        { name: 'estimates', label: 'Estimates', endpoint: '/v2/estimates', fields: ['id', 'number', 'state', 'amount', 'issue_date'] },
        { name: 'expense_categories', label: 'Expense Categories', endpoint: '/v2/expense_categories', fields: ['id', 'name', 'unit_name', 'unit_price'] },
        { name: 'roles', label: 'Roles', endpoint: '/v2/roles', fields: ['id', 'name', 'user_ids'] },
        { name: 'user_assignments', label: 'User Assignments', endpoint: '/v2/user_assignments', fields: ['id', 'is_active', 'is_project_manager', 'hourly_rate'] },
        { name: 'task_assignments', label: 'Task Assignments', endpoint: '/v2/task_assignments', fields: ['id', 'is_active', 'billable', 'hourly_rate'] },
        { name: 'contacts', label: 'Contacts', endpoint: '/v2/contacts', fields: ['id', 'first_name', 'last_name', 'email', 'title'] },
        { name: 'company', label: 'Company', endpoint: '/v2/company', fields: ['name', 'base_uri', 'full_domain', 'week_start_day'] }
      ];

      for (const entity of coreEntities) {
        try {
          // Test if we can access this entity
          const testUrl = `https://api.harvestapp.com${entity.endpoint}?per_page=1`;
          const testResponse = await fetch(testUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Harvest-Account-Id': accountId,
              'User-Agent': 'Saulto Business Dashboard',
              'Accept': 'application/json',
            },
          });

          if (testResponse.ok) {
            tables.push({
              name: entity.name,
              label: entity.label,
              fields: entity.fields,
              accessible: true,
              isStandard: true
            });
          }
        } catch (error) {
          console.log(`Could not access ${entity.name}:`, error.message);
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
      let hasMore = true;

      while (hasMore && allClients.length < limit) {
        const response = await fetch(`https://api.harvestapp.com/v2/clients?page=${page}&per_page=100`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Harvest-Account-Id': accountId,
            'User-Agent': 'Saulto Business Dashboard',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch clients: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allClients.push(...data.clients);
        
        hasMore = data.next_page !== null;
        page = data.next_page || page + 1;
        
        console.log(`Fetched ${allClients.length} clients`);
      }

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
      let hasMore = true;

      while (hasMore && allProjects.length < limit) {
        const response = await fetch(`https://api.harvestapp.com/v2/projects?page=${page}&per_page=100&is_active=true`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Harvest-Account-Id': accountId,
            'User-Agent': 'Saulto Business Dashboard',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allProjects.push(...data.projects);
        
        hasMore = data.next_page !== null;
        page = data.next_page || page + 1;
        
        console.log(`Fetched ${allProjects.length} projects`);
      }

      return allProjects.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Harvest projects:', error);
      throw error;
    }
  }

  /**
   * Fetch Harvest time entries
   */
  async fetchTimeEntries(accessToken: string, accountId: string, limit: number = 1000): Promise<any[]> {
    try {
      let allTimeEntries: any[] = [];
      let page = 1;
      let hasMore = true;

      // First, try to get ALL time entries (no date filter) to see if there are any
      console.log(`📅 Fetching ALL time entries (no date filter)`);

      while (hasMore && allTimeEntries.length < limit) {
        const url = `https://api.harvestapp.com/v2/time_entries?page=${page}&per_page=100`;
        console.log(`🔍 API call: ${url}`);
        console.log(`🔑 Using account ID: ${accountId}`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Harvest-Account-Id': accountId,
            'User-Agent': 'Saulto Business Dashboard',
            'Accept': 'application/json',
          },
        });

        console.log(`📡 Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Time entries API error: ${response.status} ${response.statusText} - ${errorText}`);
          
          // If we get a 403/401, it might be a permissions issue
          if (response.status === 403 || response.status === 401) {
            console.error(`🚫 Permission denied - check if the OAuth token has access to time entries`);
          }
          
          throw new Error(`Failed to fetch time entries: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📊 Raw API response:`, JSON.stringify(data, null, 2));
        console.log(`📊 API response page ${page}: ${data.time_entries?.length || 0} entries, next_page: ${data.next_page}`);
        
        if (data.time_entries && Array.isArray(data.time_entries)) {
          allTimeEntries.push(...data.time_entries);
          console.log(`📝 Sample time entry:`, data.time_entries[0] ? JSON.stringify(data.time_entries[0], null, 2) : 'No entries');
        } else {
          console.log(`⚠️ No time_entries array in response or not an array`);
        }
        
        hasMore = data.next_page !== null;
        page = data.next_page || page + 1;
        
        console.log(`📈 Total accumulated: ${allTimeEntries.length} time entries`);
        
        // If we get no results on first page, break early
        if (page === 1 && (!data.time_entries || data.time_entries.length === 0)) {
          console.log(`💡 No time entries found on first page - breaking early`);
          break;
        }
      }

      console.log(`✅ Time entries fetch complete: ${allTimeEntries.length} total entries`);
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
      let hasMore = true;
      
      console.log(`💰 Fetching all invoices`);

      while (hasMore && allInvoices.length < limit) {
        const url = `https://api.harvestapp.com/v2/invoices?page=${page}&per_page=100`;
        console.log(`🔍 API call: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Harvest-Account-Id': accountId,
            'User-Agent': 'Saulto Business Dashboard',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Invoices API error: ${response.status} ${response.statusText} - ${errorText}`);
          throw new Error(`Failed to fetch invoices: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📊 API response page ${page}: ${data.invoices?.length || 0} invoices, next_page: ${data.next_page}`);
        
        if (data.invoices) {
          allInvoices.push(...data.invoices);
        }
        
        hasMore = data.next_page !== null;
        page = data.next_page || page + 1;
        
        console.log(`📈 Total accumulated: ${allInvoices.length} invoices`);
      }

      console.log(`✅ Invoices fetch complete: ${allInvoices.length} total invoices`);
      return allInvoices.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Harvest invoices:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for Harvest data (raw → stg → int → core)
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
      
      // Function to check if a table exists
      const tableExists = async (tableName: string): Promise<boolean> => {
        try {
          const result = await sql`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = ${schema} 
              AND table_name = ${tableName}
            )
          `;
          return result[0].exists;
        } catch (error) {
          return false;
        }
      };
      
      // STG: harvest_clients - normalized and cleaned (only if raw table exists)
      if (await tableExists('raw_harvest_clients')) {
        console.log('📋 Creating staging table for clients...');
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
      } else {
        console.log('⚠️ Skipping clients staging table - no raw data');
      }
      
      // STG: harvest_projects - normalized (only if raw table exists)
      if (await tableExists('raw_harvest_projects')) {
        console.log('📋 Creating staging table for projects...');
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
      } else {
        console.log('⚠️ Skipping projects staging table - no raw data');
      }
      
      // STG: harvest_time_entries - normalized (only if raw table exists)
      if (await tableExists('raw_harvest_time_entries')) {
        console.log('📋 Creating staging table for time entries...');
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
      } else {
        console.log('⚠️ Skipping time entries staging table - no raw data');
      }
      
      // STG: harvest_invoices - normalized (only if raw table exists)
      if (await tableExists('raw_harvest_invoices')) {
        console.log('📋 Creating staging table for invoices...');
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
      } else {
        console.log('⚠️ Skipping invoices staging table - no raw data');
      }
      
      console.log('🔗 Creating integration tables (int)...');
      
      // INT: harvest_clients - enriched client data with calculated fields (only if staging table exists)
      if (await tableExists('stg_harvest_clients')) {
        console.log('🔗 Creating integration table for clients...');
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
            CASE 
              WHEN created_at IS NOT NULL THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at::timestamp))/86400 
              ELSE NULL 
            END as days_since_created,
            CASE 
              WHEN is_active THEN 'Active'
              ELSE 'Inactive'
            END as status
          FROM ${sql(schema)}.stg_harvest_clients
        `;
      } else {
        console.log('⚠️ Skipping clients integration table - no staging data');
      }
      
      // INT: harvest_projects - enriched project data (only if staging table exists)
      if (await tableExists('stg_harvest_projects')) {
        console.log('🔗 Creating integration table for projects...');
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
              WHEN start_date IS NOT NULL THEN EXTRACT(EPOCH FROM (COALESCE(end_date::date, CURRENT_DATE) - start_date::date))/86400 
              ELSE NULL 
            END as project_duration_days,
            CASE 
              WHEN is_billable THEN 'Billable'
              ELSE 'Non-Billable'
            END as billing_type
          FROM ${sql(schema)}.stg_harvest_projects
        `;
      } else {
        console.log('⚠️ Skipping projects integration table - no staging data');
      }
      
      // INT: harvest_time_entries - enriched with calculated fields (only if staging table exists)
      if (await tableExists('stg_harvest_time_entries')) {
        console.log('🔗 Creating integration table for time entries...');
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
            END as billing_status,
            CASE 
              WHEN spent_date IS NOT NULL THEN EXTRACT(DOW FROM spent_date::date) 
              ELSE NULL 
            END as day_of_week,
            CASE 
              WHEN spent_date IS NOT NULL THEN TO_CHAR(spent_date::date, 'YYYY-MM') 
              ELSE NULL 
            END as month_year,
            CASE 
              WHEN spent_date IS NOT NULL THEN EXTRACT(QUARTER FROM spent_date::date) 
              ELSE NULL 
            END as quarter
          FROM ${sql(schema)}.stg_harvest_time_entries
        `;
      } else {
        console.log('⚠️ Skipping time entries integration table - no staging data');
      }
      
      // INT: harvest_invoices - enriched invoice data (only if staging table exists)
      if (await tableExists('stg_harvest_invoices')) {
        console.log('🔗 Creating integration table for invoices...');
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
            END as invoice_status,
            CASE 
              WHEN due_date < CURRENT_DATE AND due_amount > 0 THEN EXTRACT(EPOCH FROM (CURRENT_DATE - due_date))/86400
              ELSE 0
            END as days_overdue,
            CASE 
              WHEN issue_date IS NOT NULL THEN EXTRACT(EPOCH FROM (COALESCE(paid_at::timestamp, CURRENT_TIMESTAMP) - issue_date::date))/86400 
              ELSE NULL 
            END as payment_cycle_days
          FROM ${sql(schema)}.stg_harvest_invoices
        `;
      } else {
        console.log('⚠️ Skipping invoices integration table - no staging data');
      }
      
      console.log('👁️ Creating core views...');
      
      // CORE: Views that mirror int tables (no aggregation)
      if (await tableExists('int_harvest_clients')) {
        console.log('👁️ Creating core view for clients...');
        await sql`
          CREATE VIEW ${sql(schema)}.core_harvest_clients AS 
          SELECT * FROM ${sql(schema)}.int_harvest_clients
        `;
      } else {
        console.log('⚠️ Skipping clients core view - no integration data');
      }
      
      if (await tableExists('int_harvest_projects')) {
        console.log('👁️ Creating core view for projects...');
        await sql`
          CREATE VIEW ${sql(schema)}.core_harvest_projects AS
          SELECT * FROM ${sql(schema)}.int_harvest_projects  
        `;
      } else {
        console.log('⚠️ Skipping projects core view - no integration data');
      }
      
      if (await tableExists('int_harvest_time_entries')) {
        console.log('👁️ Creating core view for time entries...');
        await sql`
          CREATE VIEW ${sql(schema)}.core_harvest_time_entries AS
          SELECT * FROM ${sql(schema)}.int_harvest_time_entries
        `;
      } else {
        console.log('⚠️ Skipping time entries core view - no integration data');
      }
      
      if (await tableExists('int_harvest_invoices')) {
        console.log('👁️ Creating core view for invoices...');
        await sql`
          CREATE VIEW ${sql(schema)}.core_harvest_invoices AS
          SELECT * FROM ${sql(schema)}.int_harvest_invoices
        `;
      } else {
        console.log('⚠️ Skipping invoices core view - no integration data');
      }
      
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

      // Get the Harvest account ID
      const accountId = await this.getAccountId(accessToken);
      
      console.log(`🔗 Using Harvest account: ${accountId}`);

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
        (token) => this.fetchProjects(token, accountId, 500)
      );
      if (projects.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'harvest_projects', projects, 'harvest_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_harvest_projects');
        console.log(`✅ Synced ${recordsLoaded} projects`);
      }

      // Fetch and sync time entries with automatic token refresh
      console.log('⏱️ Fetching Harvest time entries...');
      const timeEntries = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchTimeEntries(token, accountId, 2000)
      );
      console.log(`📊 Time entries fetch result: ${timeEntries.length} records`);
      if (timeEntries.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'harvest_time_entries', timeEntries, 'harvest_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_harvest_time_entries');
        console.log(`✅ Synced ${recordsLoaded} time entries`);
      } else {
        console.log(`⚠️ No time entries found - this could be due to no time tracked in the last 90 days`);
      }

      // Fetch and sync invoices with automatic token refresh
      console.log('💰 Fetching Harvest invoices...');
      const invoices = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchInvoices(token, accountId, 500)
      );
      console.log(`📊 Invoices fetch result: ${invoices.length} records`);
      if (invoices.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'harvest_invoices', invoices, 'harvest_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_harvest_invoices');
        console.log(`✅ Synced ${recordsLoaded} invoices`);
      } else {
        console.log(`⚠️ No invoices found - this could be normal for new accounts or accounts without invoicing`);
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