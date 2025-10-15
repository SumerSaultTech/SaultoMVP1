/**
 * Zoho CRM OAuth2 integration service extending base OAuth class
 */

import { OAuthServiceBase } from './oauth-base.js';
import { 
  TokenResponse, 
  SyncResult, 
  TableDiscoveryResult,
  OAuthError 
} from './oauth-types.js';

interface ZohoUserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  org_id?: string;
  org_name?: string;
}

export class ZohoOAuthService extends OAuthServiceBase {
  private datacenter: string;
  
  constructor() {
    super();
    // Default to .com datacenter, can be overridden via env var
    this.datacenter = process.env.ZOHO_DATACENTER || 'com';
    console.log('🔍 ZOHO_OAUTH_CLIENT_ID:', process.env.ZOHO_OAUTH_CLIENT_ID ? 'SET' : 'NOT SET');
    console.log('🔍 ZOHO_OAUTH_CLIENT_SECRET:', process.env.ZOHO_OAUTH_CLIENT_SECRET ? 'SET' : 'NOT SET');
    console.log('🔍 ZOHO_DATACENTER:', this.datacenter);
  }

  /**
   * Get service type identifier
   */
  getServiceType(): string {
    return 'zoho';
  }

  /**
   * Get Zoho URLs based on datacenter
   */
  private getZohoUrls() {
    const dc = this.datacenter === 'com' ? 'com' : this.datacenter;
    return {
      auth: `https://accounts.zoho.${dc}/oauth/v2/auth`,
      token: `https://accounts.zoho.${dc}/oauth/v2/token`,
      api: `https://www.zohoapis.${dc}/crm/v6`,
      revoke: `https://accounts.zoho.${dc}/oauth/v2/token/revoke`
    };
  }

  /**
   * Generate authorization URL with company context
   */
  getAuthorizationUrl(companyId: number, userId?: number): string {
    const state = this.generateState(companyId, userId);
    const urls = this.getZohoUrls();
    
    // Zoho CRM OAuth scopes
    const scopes = [
      'ZohoCRM.modules.ALL',      // Access to all CRM modules
      'ZohoCRM.settings.READ',    // Read CRM settings
      'ZohoCRM.users.READ',       // Read user information
      'offline_access'            // Refresh token support
    ];
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      scope: scopes.join(','),  // Zoho uses comma-separated scopes
      redirect_uri: this.config.redirectUri,
      access_type: 'offline',    // For refresh token
      state
    });

    return `${urls.auth}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<TokenResponse> {
    try {
      const urls = this.getZohoUrls();
      
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code: code
      });

      const response = await fetch(urls.token, {
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
        expires_in: tokenData.expires_in || 3600, // Zoho tokens expire in 1 hour
        token_type: tokenData.token_type || 'Bearer',
        api_domain: tokenData.api_domain
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get user info from Zoho
   */
  async getUserInfo(accessToken: string): Promise<ZohoUserInfo> {
    try {
      const urls = this.getZohoUrls();
      const response = await fetch(`${urls.api}/users?type=CurrentUser`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,  // Zoho uses this prefix
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const data = await response.json();
      const user = data.users?.[0];

      if (user) {
        return {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name: user.full_name,
          org_id: data.org_id,
          org_name: data.org_name
        };
      }

      // Fallback if user info is not available
      return {
        id: 'unknown',
        email: 'unknown',
        first_name: 'Zoho',
        last_name: 'User',
        full_name: 'Zoho User'
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      // Return fallback user info
      return {
        id: 'unknown',
        email: 'unknown',
        first_name: 'Zoho',
        last_name: 'User',
        full_name: 'Zoho User'
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const urls = this.getZohoUrls();
      
      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken
      });

      const response = await fetch(urls.token, {
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
        refresh_token: refreshToken, // Zoho doesn't return new refresh token
        expires_in: tokenData.expires_in || 3600,
        token_type: tokenData.token_type || 'Bearer',
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
      const urls = this.getZohoUrls();
      const response = await fetch(`${urls.api}/Leads?per_page=1`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
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
    return this.discoverZohoModules(accessToken);
  }

  /**
   * Discover available Zoho CRM modules dynamically
   */
  async discoverZohoModules(accessToken: string): Promise<TableDiscoveryResult[]> {
    try {
      const urls = this.getZohoUrls();
      const tables = [];

      // Core CRM modules that are commonly available
      const coreModules = [
        { api_name: 'Leads', label: 'Leads' },
        { api_name: 'Contacts', label: 'Contacts' },
        { api_name: 'Accounts', label: 'Accounts' },
        { api_name: 'Deals', label: 'Deals' },
        { api_name: 'Tasks', label: 'Tasks' },
        { api_name: 'Events', label: 'Events' },
        { api_name: 'Calls', label: 'Calls' },
        { api_name: 'Products', label: 'Products' },
        { api_name: 'Vendors', label: 'Vendors' },
        { api_name: 'Price_Books', label: 'Price Books' },
        { api_name: 'Quotes', label: 'Quotes' },
        { api_name: 'Sales_Orders', label: 'Sales Orders' },
        { api_name: 'Purchase_Orders', label: 'Purchase Orders' },
        { api_name: 'Invoices', label: 'Invoices' },
        { api_name: 'Campaigns', label: 'Campaigns' },
        { api_name: 'Cases', label: 'Cases' },
        { api_name: 'Solutions', label: 'Solutions' },
      ];

      // Get actual modules from API
      try {
        const modulesResponse = await fetch(`${urls.api}/settings/modules`, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (modulesResponse.ok) {
          const modulesData = await modulesResponse.json();
          const apiModules = modulesData.modules || [];
          
          // Use API response if available
          for (const module of apiModules) {
            if (module.api_supported && module.module_name) {
              const fields = await this.getModuleFields(accessToken, module.api_name);
              tables.push({
                name: module.api_name.toLowerCase().replace(/_/g, ''),
                label: module.module_name,
                fields: fields.slice(0, 10), // First 10 fields
                accessible: true,
                isStandard: ['Leads', 'Contacts', 'Accounts', 'Deals'].includes(module.api_name)
              });
            }
          }
        } else {
          // Fallback to core modules if API call fails
          for (const module of coreModules) {
            tables.push({
              name: module.api_name.toLowerCase().replace(/_/g, ''),
              label: module.label,
              fields: [],
              accessible: true,
              isStandard: ['Leads', 'Contacts', 'Accounts', 'Deals'].includes(module.api_name)
            });
          }
        }
      } catch (error) {
        console.log('Using fallback module list:', error.message);
        // Use core modules as fallback
        for (const module of coreModules.slice(0, 8)) {
          tables.push({
            name: module.api_name.toLowerCase().replace(/_/g, ''),
            label: module.label,
            fields: [],
            accessible: true,
            isStandard: ['Leads', 'Contacts', 'Accounts', 'Deals'].includes(module.api_name)
          });
        }
      }

      return tables.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Failed to discover Zoho modules:', error);
      return [];
    }
  }

  /**
   * Get fields for a specific module
   */
  async getModuleFields(accessToken: string, moduleName: string): Promise<string[]> {
    try {
      const urls = this.getZohoUrls();
      const response = await fetch(`${urls.api}/settings/fields?module=${moduleName}`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const fields = data.fields || [];
        return fields.map((field: any) => field.api_name).slice(0, 10);
      }

      return [];
    } catch (error) {
      console.error(`Failed to get fields for module ${moduleName}:`, error);
      return [];
    }
  }

  /**
   * Fetch Zoho Leads with pagination
   */
  async fetchLeads(accessToken: string, limit: number = 200): Promise<any[]> {
    try {
      const urls = this.getZohoUrls();
      let allLeads: any[] = [];
      let page = 1;
      const perPage = Math.min(limit, 200); // Zoho max is 200 per page

      while (allLeads.length < limit) {
        const url = new URL(`${urls.api}/Leads`);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('per_page', perPage.toString());
        url.searchParams.append('fields', 'id,First_Name,Last_Name,Email,Phone,Company,Lead_Status,Lead_Source,Annual_Revenue,Created_Time,Modified_Time');
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 204) break; // No more data
          throw new Error(`Failed to fetch leads: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const leads = data.data || [];
        
        if (leads.length === 0) break;
        
        allLeads.push(...leads);
        page++;
        
        console.log(`Fetched ${allLeads.length} leads`);
        
        if (!data.info?.more_records) break;
      }

      return allLeads.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Zoho leads:', error);
      throw error;
    }
  }

  /**
   * Fetch Zoho Contacts
   */
  async fetchContacts(accessToken: string, limit: number = 200): Promise<any[]> {
    try {
      const urls = this.getZohoUrls();
      let allContacts: any[] = [];
      let page = 1;
      const perPage = Math.min(limit, 200);

      while (allContacts.length < limit) {
        const url = new URL(`${urls.api}/Contacts`);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('per_page', perPage.toString());
        url.searchParams.append('fields', 'id,First_Name,Last_Name,Email,Phone,Account_Name,Title,Department,Created_Time,Modified_Time');
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 204) break;
          throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const contacts = data.data || [];
        
        if (contacts.length === 0) break;
        
        allContacts.push(...contacts);
        page++;
        
        console.log(`Fetched ${allContacts.length} contacts`);
        
        if (!data.info?.more_records) break;
      }

      return allContacts.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Zoho contacts:', error);
      throw error;
    }
  }

  /**
   * Fetch Zoho Accounts
   */
  async fetchAccounts(accessToken: string, limit: number = 200): Promise<any[]> {
    try {
      const urls = this.getZohoUrls();
      let allAccounts: any[] = [];
      let page = 1;
      const perPage = Math.min(limit, 200);

      while (allAccounts.length < limit) {
        const url = new URL(`${urls.api}/Accounts`);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('per_page', perPage.toString());
        url.searchParams.append('fields', 'id,Account_Name,Account_Number,Industry,Annual_Revenue,Employees,Website,Phone,Billing_City,Created_Time,Modified_Time');
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 204) break;
          throw new Error(`Failed to fetch accounts: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const accounts = data.data || [];
        
        if (accounts.length === 0) break;
        
        allAccounts.push(...accounts);
        page++;
        
        console.log(`Fetched ${allAccounts.length} accounts`);
        
        if (!data.info?.more_records) break;
      }

      return allAccounts.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Zoho accounts:', error);
      throw error;
    }
  }

  /**
   * Fetch Zoho Deals
   */
  async fetchDeals(accessToken: string, limit: number = 200): Promise<any[]> {
    try {
      const urls = this.getZohoUrls();
      let allDeals: any[] = [];
      let page = 1;
      const perPage = Math.min(limit, 200);

      while (allDeals.length < limit) {
        const url = new URL(`${urls.api}/Deals`);
        url.searchParams.append('page', page.toString());
        url.searchParams.append('per_page', perPage.toString());
        url.searchParams.append('fields', 'id,Deal_Name,Amount,Stage,Probability,Closing_Date,Account_Name,Contact_Name,Lead_Source,Created_Time,Modified_Time');
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 204) break;
          throw new Error(`Failed to fetch deals: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const deals = data.data || [];
        
        if (deals.length === 0) break;
        
        allDeals.push(...deals);
        page++;
        
        console.log(`Fetched ${allDeals.length} deals`);
        
        if (!data.info?.more_records) break;
      }

      return allDeals.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Zoho deals:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for Zoho data (raw → stg → int → core)
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;
    
    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
      
      console.log('🔍 Checking which Zoho RAW tables exist...');
      
      // Check which RAW tables exist
      const existingTables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ${schema} 
        AND table_name LIKE 'raw_zoho_%'
      `;
      
      const tableNames = existingTables.map((row: any) => row.table_name);
      const hasLeads = tableNames.includes('raw_zoho_leads');
      const hasContacts = tableNames.includes('raw_zoho_contacts');
      const hasAccounts = tableNames.includes('raw_zoho_accounts');
      const hasDeals = tableNames.includes('raw_zoho_deals');
      
      console.log('📊 Found RAW tables:', {
        leads: hasLeads,
        contacts: hasContacts,
        accounts: hasAccounts,
        deals: hasDeals
      });
      
      if (!hasLeads && !hasContacts && !hasAccounts && !hasDeals) {
        console.log('⚠️ No Zoho RAW tables found, skipping transformations');
        return;
      }
      
      console.log('🧹 Cleaning up existing Zoho transformation objects...');
      
      // Drop views first (they depend on tables)
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_zoho_leads`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_zoho_contacts`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_zoho_accounts`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_zoho_deals`;
      
      // Drop tables in reverse dependency order
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_zoho_leads`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_zoho_contacts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_zoho_accounts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_zoho_deals`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_zoho_leads`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_zoho_contacts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_zoho_accounts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_zoho_deals`;
      
      console.log('📋 Creating Zoho staging tables (stg)...');
      
      // STG: zoho_leads - normalized and cleaned
      if (hasLeads) {
        console.log('  ✅ Creating stg_zoho_leads');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_zoho_leads AS
          SELECT DISTINCT 
            (data #>> '{}')::jsonb->>'id' as lead_id,
            (data #>> '{}')::jsonb->>'First_Name' as first_name,
            (data #>> '{}')::jsonb->>'Last_Name' as last_name,
            (data #>> '{}')::jsonb->>'Email' as email,
            (data #>> '{}')::jsonb->>'Phone' as phone,
            (data #>> '{}')::jsonb->>'Company' as company,
            (data #>> '{}')::jsonb->>'Lead_Status' as lead_status,
            (data #>> '{}')::jsonb->>'Lead_Source' as lead_source,
            COALESCE(((data #>> '{}')::jsonb->>'Annual_Revenue')::numeric, 0) as annual_revenue,
            ((data #>> '{}')::jsonb->>'Created_Time')::timestamp as created_at,
            ((data #>> '{}')::jsonb->>'Modified_Time')::timestamp as updated_at,
            (data #>> '{}')::jsonb#>>'{Owner,name}' as owner_name,
            (data #>> '{}')::jsonb as raw_data
          FROM ${sql(schema)}.raw_zoho_leads
          WHERE data IS NOT NULL
        `;
      }
      
      // STG: zoho_contacts - normalized
      if (hasContacts) {
        console.log('  ✅ Creating stg_zoho_contacts');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_zoho_contacts AS
          SELECT DISTINCT
            (data #>> '{}')::jsonb->>'id' as contact_id,
            (data #>> '{}')::jsonb->>'First_Name' as first_name,
            (data #>> '{}')::jsonb->>'Last_Name' as last_name,
            (data #>> '{}')::jsonb->>'Email' as email,
            (data #>> '{}')::jsonb->>'Phone' as phone,
            (data #>> '{}')::jsonb#>>'{Account_Name,name}' as account_name,
            (data #>> '{}')::jsonb->>'Title' as title,
            (data #>> '{}')::jsonb->>'Department' as department,
            ((data #>> '{}')::jsonb->>'Created_Time')::timestamp as created_at,
            ((data #>> '{}')::jsonb->>'Modified_Time')::timestamp as updated_at,
            (data #>> '{}')::jsonb#>>'{Owner,name}' as owner_name
          FROM ${sql(schema)}.raw_zoho_contacts
          WHERE data IS NOT NULL
        `;
      }
      
      // STG: zoho_accounts - normalized
      if (hasAccounts) {
        console.log('  ✅ Creating stg_zoho_accounts');
        
        // Debug: Check what's in raw data first
        const rawSample = await sql`
          SELECT 
            jsonb_typeof(data) as data_type,
            data->>'id' as direct_id,
            data->>'Account_Name' as direct_name,
            left(data::text, 200) as sample_data
          FROM ${sql(schema)}.raw_zoho_accounts
          LIMIT 1
        `;
        console.log('  📊 Raw data sample:', rawSample);
        
        await sql`
          CREATE TABLE ${sql(schema)}.stg_zoho_accounts AS  
          SELECT DISTINCT
            (data #>> '{}')::jsonb->>'id' as account_id,
            (data #>> '{}')::jsonb->>'Account_Name' as account_name,
            (data #>> '{}')::jsonb->>'Account_Number' as account_number,
            (data #>> '{}')::jsonb->>'Industry' as industry,
            COALESCE(((data #>> '{}')::jsonb->>'Annual_Revenue')::numeric, 0) as annual_revenue,
            COALESCE(((data #>> '{}')::jsonb->>'Employees')::integer, 0) as employees,
            (data #>> '{}')::jsonb->>'Website' as website,
            (data #>> '{}')::jsonb->>'Phone' as phone,
            (data #>> '{}')::jsonb->>'Billing_City' as billing_city,
            ((data #>> '{}')::jsonb->>'Created_Time')::timestamp as created_at,
            ((data #>> '{}')::jsonb->>'Modified_Time')::timestamp as updated_at,
            (data #>> '{}')::jsonb#>>'{Owner,name}' as owner_name
          FROM ${sql(schema)}.raw_zoho_accounts
          WHERE data IS NOT NULL
        `;
        
        // Debug: Check what got inserted
        const stagingSample = await sql`
          SELECT COUNT(*) as row_count, 
                 COUNT(account_id) as non_null_ids,
                 MIN(account_id) as sample_id,
                 MIN(account_name) as sample_name
          FROM ${sql(schema)}.stg_zoho_accounts
        `;
        console.log('  📊 Staging data result:', stagingSample);
      }
      
      // STG: zoho_deals - normalized
      if (hasDeals) {
        console.log('  ✅ Creating stg_zoho_deals');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_zoho_deals AS  
          SELECT DISTINCT
            (data #>> '{}')::jsonb->>'id' as deal_id,
            (data #>> '{}')::jsonb->>'Deal_Name' as deal_name,
            COALESCE(((data #>> '{}')::jsonb->>'Amount')::numeric, 0) as amount,
            (data #>> '{}')::jsonb->>'Stage' as stage,
            COALESCE(((data #>> '{}')::jsonb->>'Probability')::numeric, 0) as probability,
            ((data #>> '{}')::jsonb->>'Closing_Date')::timestamp as closing_date,
            (data #>> '{}')::jsonb#>>'{Account_Name,name}' as account_name,
            (data #>> '{}')::jsonb#>>'{Contact_Name,name}' as contact_name,
            (data #>> '{}')::jsonb->>'Lead_Source' as lead_source,
            ((data #>> '{}')::jsonb->>'Created_Time')::timestamp as created_at,
            ((data #>> '{}')::jsonb->>'Modified_Time')::timestamp as updated_at,
            (data #>> '{}')::jsonb#>>'{Owner,name}' as owner_name
          FROM ${sql(schema)}.raw_zoho_deals
          WHERE data IS NOT NULL
        `;
      }
      
      console.log('🔗 Creating Zoho integration tables (int)...');
      
      // INT: zoho_leads - enriched with calculated fields
      if (hasLeads) {
        console.log('  ✅ Creating int_zoho_leads');
        await sql`
          CREATE TABLE ${sql(schema)}.int_zoho_leads AS
          SELECT 
            lead_id,
            first_name,
            last_name,
            CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as full_name,
            email,
            phone,
            company,
            lead_status,
            lead_source,
            annual_revenue,
            owner_name,
            created_at,
            updated_at,
            -- Calculated fields
            CASE 
              WHEN lead_status IN ('Contacted', 'Qualified') THEN 'Active'
              WHEN lead_status = 'Converted' THEN 'Won'
              WHEN lead_status IN ('Lost Lead', 'Not Interested') THEN 'Lost'
              ELSE 'New'
            END as lead_stage_category,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/86400 as days_since_created,
            CASE 
              WHEN annual_revenue > 1000000 THEN 'Enterprise'
              WHEN annual_revenue > 100000 THEN 'Mid-Market'
              WHEN annual_revenue > 10000 THEN 'Small Business'
              ELSE 'Startup'
            END as lead_size,
            CASE 
              WHEN email IS NOT NULL THEN true 
              ELSE false 
            END as has_email
          FROM ${sql(schema)}.stg_zoho_leads
        `;
      }
      
      // INT: zoho_contacts - enriched contact data
      if (hasContacts) {
        console.log('  ✅ Creating int_zoho_contacts');
        await sql`
          CREATE TABLE ${sql(schema)}.int_zoho_contacts AS
          SELECT 
            contact_id,
            first_name,
            last_name,
            CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as full_name,
            email,
            phone,
            account_name,
            title,
            department,
            owner_name,
            created_at,
            updated_at,
            -- Calculated fields
            CASE 
              WHEN title ILIKE '%CEO%' OR title ILIKE '%Chief%' OR title ILIKE '%President%' THEN 'C-Level'
              WHEN title ILIKE '%VP%' OR title ILIKE '%Vice%' OR title ILIKE '%Director%' THEN 'Executive'
              WHEN title ILIKE '%Manager%' OR title ILIKE '%Lead%' THEN 'Management'
              ELSE 'Individual Contributor'
            END as seniority_level,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/86400 as days_since_created,
            CASE 
              WHEN email IS NOT NULL AND phone IS NOT NULL THEN 'Complete'
              WHEN email IS NOT NULL OR phone IS NOT NULL THEN 'Partial'
              ELSE 'Missing'
            END as contact_completeness
          FROM ${sql(schema)}.stg_zoho_contacts
        `;
      }
      
      // INT: zoho_accounts - enriched with calculated fields
      if (hasAccounts) {
        console.log('  ✅ Creating int_zoho_accounts');
        await sql`
          CREATE TABLE ${sql(schema)}.int_zoho_accounts AS
          SELECT 
            account_id,
            account_name,
            account_number,
            industry,
            annual_revenue,
            employees,
            website,
            phone,
            billing_city,
            owner_name,
            created_at,
            updated_at,
            -- Calculated fields
            CASE 
              WHEN employees > 1000 THEN 'Enterprise'
              WHEN employees > 100 THEN 'Mid-Market'
              WHEN employees > 10 THEN 'Small Business'
              ELSE 'Startup'
            END as company_size_category,
            CASE 
              WHEN annual_revenue > 1000000000 THEN 'Billion+'
              WHEN annual_revenue > 100000000 THEN '100M-1B'
              WHEN annual_revenue > 10000000 THEN '10M-100M'
              WHEN annual_revenue > 1000000 THEN '1M-10M'
              ELSE '<1M'
            END as revenue_category,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/86400 as days_since_created,
            CASE 
              WHEN annual_revenue > 0 AND employees > 0 THEN annual_revenue / employees
              ELSE 0
            END as revenue_per_employee
          FROM ${sql(schema)}.stg_zoho_accounts
        `;
      }
      
      // INT: zoho_deals - enriched with calculated fields
      if (hasDeals) {
        console.log('  ✅ Creating int_zoho_deals');
        await sql`
          CREATE TABLE ${sql(schema)}.int_zoho_deals AS
          SELECT 
            deal_id,
            deal_name,
            amount,
            stage,
            probability,
            closing_date,
            account_name,
            contact_name,
            lead_source,
            owner_name,
            created_at,
            updated_at,
            -- Calculated fields
            CASE 
              WHEN closing_date < CURRENT_DATE THEN 'Past Due'
              WHEN closing_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Closing Soon'
              WHEN closing_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'This Quarter'
              ELSE 'Future'
            END as close_timeline,
            EXTRACT(EPOCH FROM (closing_date - created_at))/86400 as sales_cycle_days,
            amount * (probability / 100) as weighted_amount,
            CASE 
              WHEN amount > 100000 THEN 'Large'
              WHEN amount > 10000 THEN 'Medium'
              ELSE 'Small'
            END as deal_size,
            CASE 
              WHEN stage IN ('Closed Won', 'Won') THEN 'Won'
              WHEN stage IN ('Closed Lost', 'Lost') THEN 'Lost'
              ELSE 'Open'
            END as deal_status
          FROM ${sql(schema)}.stg_zoho_deals
        `;
      }
      
      console.log('👁️ Creating Zoho core views...');
      
      // CORE: Views that mirror int tables (only for existing tables)
      if (hasLeads) {
        console.log('  ✅ Creating core_zoho_leads view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_zoho_leads AS 
          SELECT * FROM ${sql(schema)}.int_zoho_leads
        `;
      }
      
      if (hasContacts) {
        console.log('  ✅ Creating core_zoho_contacts view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_zoho_contacts AS
          SELECT * FROM ${sql(schema)}.int_zoho_contacts  
        `;
      }
      
      if (hasAccounts) {
        console.log('  ✅ Creating core_zoho_accounts view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_zoho_accounts AS
          SELECT * FROM ${sql(schema)}.int_zoho_accounts
        `;
      }
      
      if (hasDeals) {
        console.log('  ✅ Creating core_zoho_deals view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_zoho_deals AS
          SELECT * FROM ${sql(schema)}.int_zoho_deals
        `;
      }
      
      const createdLayers = [];
      if (hasLeads) createdLayers.push('leads');
      if (hasContacts) createdLayers.push('contacts');
      if (hasAccounts) createdLayers.push('accounts');
      if (hasDeals) createdLayers.push('deals');
      
      console.log(`✅ Zoho transformation pipeline completed (raw → stg → int → core) for: ${createdLayers.join(', ')}`);
      
    } catch (error) {
      console.error('❌ Zoho transformation pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Sync Zoho data to company analytics schema using stored OAuth tokens
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

      console.log(`🔄 Starting Zoho OAuth sync for company ${companyId}`);
      
      // Get stored OAuth tokens from database
      const storage = (await import('../storage')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const zohoSource = dataSources.find(ds => ds.type === 'zoho');
      
      if (!zohoSource || !zohoSource.config) {
        throw new Error('No Zoho OAuth tokens found for this company');
      }

      const config = typeof zohoSource.config === 'string' 
        ? JSON.parse(zohoSource.config) 
        : zohoSource.config;
      const { accessToken, userInfo } = config;
      
      if (!accessToken) {
        throw new Error('Invalid OAuth configuration');
      }

      const orgId = userInfo?.org_id || 'unknown';
      
      console.log(`🔗 Using Zoho organization: ${orgId}`);

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Fetch and sync leads with automatic token refresh
      console.log('👥 Fetching Zoho leads...');
      try {
        const leads = await this.executeWithTokenRefresh(companyId,
          (token) => this.fetchLeads(token, 500)
        );
        if (leads.length > 0) {
          const recordsLoaded = await this.insertDataToSchema(companyId, 'zoho_leads', leads, 'zoho_oauth');
          totalRecords += recordsLoaded;
          tablesCreated.push('raw_zoho_leads');
          console.log(`✅ Synced ${recordsLoaded} leads`);
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch leads:', error.message);
      }

      // Fetch and sync contacts with automatic token refresh
      console.log('👤 Fetching Zoho contacts...');
      try {
        const contacts = await this.executeWithTokenRefresh(companyId,
          (token) => this.fetchContacts(token, 500)
        );
        if (contacts.length > 0) {
          const recordsLoaded = await this.insertDataToSchema(companyId, 'zoho_contacts', contacts, 'zoho_oauth');
          totalRecords += recordsLoaded;
          tablesCreated.push('raw_zoho_contacts');
          console.log(`✅ Synced ${recordsLoaded} contacts`);
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch contacts:', error.message);
      }

      // Fetch and sync accounts with automatic token refresh
      console.log('🏢 Fetching Zoho accounts...');
      try {
        const accounts = await this.executeWithTokenRefresh(companyId,
          (token) => this.fetchAccounts(token, 500)
        );
        if (accounts.length > 0) {
          const recordsLoaded = await this.insertDataToSchema(companyId, 'zoho_accounts', accounts, 'zoho_oauth');
          totalRecords += recordsLoaded;
          tablesCreated.push('raw_zoho_accounts');
          console.log(`✅ Synced ${recordsLoaded} accounts`);
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch accounts:', error.message);
      }

      // Fetch and sync deals with automatic token refresh
      console.log('💰 Fetching Zoho deals...');
      try {
        const deals = await this.executeWithTokenRefresh(companyId,
          (token) => this.fetchDeals(token, 500)
        );
        if (deals.length > 0) {
          const recordsLoaded = await this.insertDataToSchema(companyId, 'zoho_deals', deals, 'zoho_oauth');
          totalRecords += recordsLoaded;
          tablesCreated.push('raw_zoho_deals');
          console.log(`✅ Synced ${recordsLoaded} deals`);
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch deals:', error.message);
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

      console.log(`🎉 Zoho OAuth sync completed: ${totalRecords} total records across ${tablesCreated.length} tables`);

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ Zoho OAuth sync failed:', error);
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
export const zohoOAuthService = new ZohoOAuthService();