/**
 * HubSpot OAuth2 integration service extending base OAuth class
 */

import { OAuthServiceBase } from './oauth-base.js';
import { 
  TokenResponse, 
  SyncResult, 
  TableDiscoveryResult,
  OAuthError 
} from './oauth-types.js';

interface HubSpotUserInfo {
  portalId: number;
  user: string;
  hub_domain: string;
  user_id: number;
}

export class HubSpotOAuthService extends OAuthServiceBase {
  
  constructor() {
    super();
  }

  /**
   * Get service type identifier
   */
  getServiceType(): string {
    return 'hubspot';
  }

  /**
   * Generate authorization URL with company context
   */
  getAuthorizationUrl(companyId: number, userId?: number): string {
    const state = this.generateState(companyId, userId);
    
    // HubSpot OAuth scopes - Matching your exact app configuration
    const scopes = [
      'crm.objects.contacts.read',
      'crm.objects.companies.read',
      'crm.objects.deals.read',
      'tickets',                          // Matches your config (not crm.objects.tickets.read)
      'crm.schemas.contacts.read',
      'crm.schemas.companies.read',
      'crm.schemas.deals.read',
      'crm.objects.line_items.read'
    ];
    
    // OPTIONAL SCOPES (add these to your HubSpot app for extended functionality):
    // 'crm.objects.tickets.read',       // ✅ Any account (Service Hub data)
    // 'crm.schemas.line_items.read',    // ✅ Any account
    // 'crm.objects.owners.read',        // ✅ Any account (user assignments)
    // 'crm.lists.read',                 // ✅ Any account (contact lists)
    // 'forms',                          // ✅ Any account (forms data)
    // 'files',                          // ✅ Any account (file manager)
    // 'timeline',                       // ✅ Any account (custom activities)
    
    // ADVANCED SCOPES (require higher tiers or specific hubs):
    // 'sales-email-read',               // ⚠️ Any account (one-to-one emails)
    // 'marketing-email',                // ⚠️ Marketing Hub Enterprise
    // 'automation',                     // ⚠️ Marketing Hub Pro/Enterprise (workflows)
    // Note: 'oauth' scope is automatically included

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state
    });

    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
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

      const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
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
        expires_in: tokenData.expires_in || 21600, // HubSpot tokens expire in 6 hours
        token_type: tokenData.token_type || 'bearer',
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get access token info (includes portal ID and user info)
   */
  async getAccessTokenInfo(accessToken: string): Promise<HubSpotUserInfo> {
    try {
      const response = await fetch(`https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get token info: ${response.statusText}`);
      }

      const tokenInfo = await response.json();

      return {
        portalId: tokenInfo.hub_id,
        user: tokenInfo.user,
        hub_domain: tokenInfo.hub_domain,
        user_id: tokenInfo.user_id
      };
    } catch (error) {
      console.error('Failed to get access token info:', error);
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

      const response = await fetch('https://api.hubapi.com/oauth/v1/token', {
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
        expires_in: tokenData.expires_in || 21600,
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
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
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
    return this.discoverHubSpotTables(accessToken);
  }

  /**
   * Discover available HubSpot tables and their properties dynamically
   */
  async discoverHubSpotTables(accessToken: string): Promise<TableDiscoveryResult[]> {
    try {
      const tables = [];

      // Core CRM objects that are available in all HubSpot accounts
      const coreObjects = [
        // Core CRM
        { name: 'contacts', label: 'Contacts', endpoint: '/crm/v3/objects/contacts', hasProperties: true },
        { name: 'companies', label: 'Companies', endpoint: '/crm/v3/objects/companies', hasProperties: true },
        { name: 'deals', label: 'Deals', endpoint: '/crm/v3/objects/deals', hasProperties: true },
        { name: 'tickets', label: 'Tickets', endpoint: '/crm/v3/objects/tickets', hasProperties: true },
        { name: 'line_items', label: 'Line Items', endpoint: '/crm/v3/objects/line_items', hasProperties: true },
        { name: 'products', label: 'Products', endpoint: '/crm/v3/objects/products', hasProperties: true },
        
        // Engagements
        { name: 'calls', label: 'Calls', endpoint: '/crm/v3/objects/calls', hasProperties: true },
        { name: 'emails', label: 'Emails', endpoint: '/crm/v3/objects/emails', hasProperties: true },
        { name: 'meetings', label: 'Meetings', endpoint: '/crm/v3/objects/meetings', hasProperties: true },
        { name: 'notes', label: 'Notes', endpoint: '/crm/v3/objects/notes', hasProperties: true },
        { name: 'tasks', label: 'Tasks', endpoint: '/crm/v3/objects/tasks', hasProperties: true },
        
        // Associations & Metadata
        { name: 'owners', label: 'Owners', endpoint: '/crm/v3/owners', hasProperties: false },
        { name: 'pipelines', label: 'Pipelines', endpoint: '/crm/v3/pipelines/deals', hasProperties: false },
        { name: 'deal_stages', label: 'Deal Stages', endpoint: '/crm/v3/pipelines/deals', hasProperties: false },
        
        // Marketing (if available)
        { name: 'marketing_emails', label: 'Marketing Emails', endpoint: '/marketing/v3/emails', hasProperties: false },
        { name: 'forms', label: 'Forms', endpoint: '/marketing/v3/forms', hasProperties: false },
        { name: 'lists', label: 'Lists', endpoint: '/crm/v3/lists', hasProperties: false },
      ];

      for (const object of coreObjects) {
        try {
          // Test if we can access this object
          const testUrl = `https://api.hubapi.com${object.endpoint}?limit=1`;
          const testResponse = await fetch(testUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          if (testResponse.ok) {
            let fields = [];
            
            // Get properties for objects that support them
            if (object.hasProperties && ['contacts', 'companies', 'deals', 'tickets'].includes(object.name)) {
              const propsUrl = `https://api.hubapi.com/crm/v3/properties/${object.name}`;
              const propsResponse = await fetch(propsUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/json',
                },
              });
              
              if (propsResponse.ok) {
                const propsData = await propsResponse.json();
                // Get first 10 most important properties
                fields = propsData.results
                  .slice(0, 10)
                  .map((prop: any) => prop.name);
              }
            } else {
              // Get sample data to infer fields
              const sampleData = await testResponse.json();
              const firstItem = sampleData.results?.[0] || sampleData[0];
              if (firstItem && typeof firstItem === 'object') {
                const props = firstItem.properties || firstItem;
                fields = Object.keys(props).slice(0, 8);
              }
            }

            tables.push({
              name: object.name,
              label: object.label,
              fields: fields,
              accessible: true,
              isStandard: ['contacts', 'companies', 'deals', 'tickets'].includes(object.name)
            });
          }
        } catch (error) {
          console.log(`Could not access ${object.name}:`, error.message);
        }
      }

      return tables.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Failed to discover HubSpot tables:', error);
      return [];
    }
  }

  /**
   * Fetch HubSpot contacts using OAuth token
   */
  async fetchContacts(accessToken: string, limit: number = 100): Promise<any[]> {
    try {
      let allContacts: any[] = [];
      let after: string | undefined = undefined;

      do {
        const url = new URL('https://api.hubapi.com/crm/v3/objects/contacts');
        url.searchParams.append('limit', Math.min(limit, 100).toString());
        url.searchParams.append('properties', 'firstname,lastname,email,phone,company,jobtitle,lifecyclestage,createdate,lastmodifieddate');
        if (after) {
          url.searchParams.append('after', after);
        }
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch contacts: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allContacts.push(...data.results);
        
        after = data.paging?.next?.after;
        
        console.log(`Fetched ${allContacts.length} contacts`);
        
      } while (after && allContacts.length < limit);

      return allContacts;
    } catch (error) {
      console.error('Failed to fetch HubSpot contacts:', error);
      throw error;
    }
  }

  /**
   * Fetch HubSpot companies using OAuth token
   */
  async fetchCompanies(accessToken: string, limit: number = 100): Promise<any[]> {
    try {
      let allCompanies: any[] = [];
      let after: string | undefined = undefined;

      do {
        const url = new URL('https://api.hubapi.com/crm/v3/objects/companies');
        url.searchParams.append('limit', Math.min(limit, 100).toString());
        url.searchParams.append('properties', 'name,domain,industry,numberofemployees,annualrevenue,city,state,country,createdate,lastmodifieddate');
        if (after) {
          url.searchParams.append('after', after);
        }
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch companies: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allCompanies.push(...data.results);
        
        after = data.paging?.next?.after;
        
        console.log(`Fetched ${allCompanies.length} companies`);
        
      } while (after && allCompanies.length < limit);

      return allCompanies;
    } catch (error) {
      console.error('Failed to fetch HubSpot companies:', error);
      throw error;
    }
  }

  /**
   * Fetch HubSpot deals using OAuth token
   */
  async fetchDeals(accessToken: string, limit: number = 100): Promise<any[]> {
    try {
      let allDeals: any[] = [];
      let after: string | undefined = undefined;

      do {
        const url = new URL('https://api.hubapi.com/crm/v3/objects/deals');
        url.searchParams.append('limit', Math.min(limit, 100).toString());
        url.searchParams.append('properties', 'dealname,amount,dealstage,pipeline,closedate,createdate,hs_forecast_probability,hs_is_closed_won');
        url.searchParams.append('associations', 'contacts,companies');
        if (after) {
          url.searchParams.append('after', after);
        }
        
        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch deals: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allDeals.push(...data.results);
        
        after = data.paging?.next?.after;
        
        console.log(`Fetched ${allDeals.length} deals`);
        
      } while (after && allDeals.length < limit);

      return allDeals;
    } catch (error) {
      console.error('Failed to fetch HubSpot deals:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for HubSpot data (raw → stg → int → core)
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;
    
    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
      
      console.log('🧹 Cleaning up existing transformation objects...');
      // Drop views first (they depend on tables)
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_hubspot_contacts`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_hubspot_companies`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_hubspot_deals`;
      
      // Drop tables in reverse dependency order
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_hubspot_deals`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_hubspot_companies`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_hubspot_contacts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_hubspot_deals`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_hubspot_companies`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_hubspot_contacts`;
      
      console.log('📋 Creating staging tables (stg)...');
      
      // STG: hubspot_contacts - normalized and cleaned
      await sql`
        CREATE TABLE ${sql(schema)}.stg_hubspot_contacts AS
        SELECT DISTINCT 
          data->>'id' as contact_id,
          data#>>'{properties,firstname}' as first_name,
          data#>>'{properties,lastname}' as last_name,
          data#>>'{properties,email}' as email,
          data#>>'{properties,phone}' as phone,
          data#>>'{properties,company}' as company_name,
          data#>>'{properties,jobtitle}' as job_title,
          data#>>'{properties,lifecyclestage}' as lifecycle_stage,
          (data#>>'{properties,createdate}')::timestamp as created_at,
          (data#>>'{properties,lastmodifieddate}')::timestamp as updated_at,
          data#>>'{properties,hs_lead_status}' as lead_status,
          data#>>'{properties,industry}' as industry,
          data as raw_data
        FROM ${sql(schema)}.raw_hubspot_contacts
        WHERE data IS NOT NULL
      `;
      
      // STG: hubspot_companies - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_hubspot_companies AS
        SELECT DISTINCT
          data->>'id' as company_id,
          data#>>'{properties,name}' as company_name,
          data#>>'{properties,domain}' as domain,
          data#>>'{properties,industry}' as industry,
          COALESCE((data#>>'{properties,numberofemployees}')::integer, 0) as number_of_employees,
          COALESCE((data#>>'{properties,annualrevenue}')::numeric, 0) as annual_revenue,
          data#>>'{properties,city}' as city,
          data#>>'{properties,state}' as state,
          data#>>'{properties,country}' as country,
          (data#>>'{properties,createdate}')::timestamp as created_at,
          (data#>>'{properties,lastmodifieddate}')::timestamp as updated_at
        FROM ${sql(schema)}.raw_hubspot_companies
        WHERE data IS NOT NULL
      `;
      
      // STG: hubspot_deals - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_hubspot_deals AS  
        SELECT DISTINCT
          data->>'id' as deal_id,
          data#>>'{properties,dealname}' as deal_name,
          COALESCE((data#>>'{properties,amount}')::numeric, 0) as amount,
          data#>>'{properties,dealstage}' as deal_stage,
          data#>>'{properties,pipeline}' as pipeline,
          (data#>>'{properties,closedate}')::timestamp as close_date,
          (data#>>'{properties,createdate}')::timestamp as created_at,
          COALESCE((data#>>'{properties,hs_forecast_probability}')::numeric, 0) as forecast_probability,
          CASE WHEN data#>>'{properties,hs_is_closed_won}' = 'true' THEN true ELSE false END as is_closed_won
        FROM ${sql(schema)}.raw_hubspot_deals
        WHERE data IS NOT NULL
      `;
      
      console.log('🔗 Creating integration tables (int)...');
      
      // INT: hubspot_contacts - enriched contact data with calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_hubspot_contacts AS
        SELECT 
          contact_id,
          first_name,
          last_name,
          CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as full_name,
          email,
          phone,
          company_name,
          job_title,
          lifecycle_stage,
          lead_status,
          industry,
          created_at,
          updated_at,
          -- Calculated fields
          CASE 
            WHEN lifecycle_stage IN ('customer', 'evangelist') THEN 'Customer'
            WHEN lifecycle_stage IN ('marketingqualifiedlead', 'salesqualifiedlead') THEN 'Qualified Lead'
            WHEN lifecycle_stage = 'lead' THEN 'Lead'
            WHEN lifecycle_stage = 'subscriber' THEN 'Subscriber'
            ELSE 'Other'
          END as lifecycle_category,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/86400 as days_since_created,
          CASE 
            WHEN email IS NOT NULL THEN true 
            ELSE false 
          END as has_email
        FROM ${sql(schema)}.stg_hubspot_contacts
      `;
      
      // INT: hubspot_companies - enriched company data
      await sql`
        CREATE TABLE ${sql(schema)}.int_hubspot_companies AS
        SELECT 
          company_id,
          company_name,
          domain,
          industry,
          number_of_employees,
          annual_revenue,
          city,
          state,
          country,
          created_at,
          updated_at,
          -- Calculated fields
          CASE 
            WHEN number_of_employees > 1000 THEN 'Enterprise'
            WHEN number_of_employees > 100 THEN 'Mid-Market'
            WHEN number_of_employees > 10 THEN 'Small Business'
            ELSE 'Startup'
          END as company_size_category,
          CASE 
            WHEN annual_revenue > 1000000000 THEN 'Billion+'
            WHEN annual_revenue > 100000000 THEN '100M-1B'
            WHEN annual_revenue > 10000000 THEN '10M-100M'
            WHEN annual_revenue > 1000000 THEN '1M-10M'
            ELSE '<1M'
          END as revenue_category,
          CONCAT(COALESCE(city, ''), ', ', COALESCE(state, ''), ', ', COALESCE(country, '')) as full_location
        FROM ${sql(schema)}.stg_hubspot_companies
      `;
      
      // INT: hubspot_deals - enriched with calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_hubspot_deals AS
        SELECT 
          deal_id,
          deal_name,
          amount,
          deal_stage,
          pipeline,
          close_date,
          created_at,
          forecast_probability,
          is_closed_won,
          -- Calculated fields
          CASE 
            WHEN close_date < CURRENT_DATE THEN 'Past Due'
            WHEN close_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Closing Soon'
            WHEN close_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'This Quarter'
            ELSE 'Future'
          END as close_timeline,
          EXTRACT(EPOCH FROM (close_date - created_at))/86400 as sales_cycle_days,
          amount * (forecast_probability / 100) as weighted_amount,
          CASE 
            WHEN amount > 100000 THEN 'Large'
            WHEN amount > 10000 THEN 'Medium'
            ELSE 'Small'
          END as deal_size
        FROM ${sql(schema)}.stg_hubspot_deals
      `;
      
      console.log('👁️ Creating core views...');
      
      // CORE: Views that mirror int tables (no aggregation)
      await sql`
        CREATE VIEW ${sql(schema)}.core_hubspot_contacts AS 
        SELECT * FROM ${sql(schema)}.int_hubspot_contacts
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_hubspot_companies AS
        SELECT * FROM ${sql(schema)}.int_hubspot_companies  
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_hubspot_deals AS
        SELECT * FROM ${sql(schema)}.int_hubspot_deals
      `;
      
      console.log('✅ Transformation pipeline completed (raw → stg → int → core)');
      
    } catch (error) {
      console.error('❌ Transformation pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Sync HubSpot data to company analytics schema using stored OAuth tokens
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

      console.log(`🔄 Starting HubSpot OAuth sync for company ${companyId}`);
      
      // Get stored OAuth tokens from database
      const storage = (await import('../storage')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const hubspotSource = dataSources.find(ds => ds.type === 'hubspot');
      
      if (!hubspotSource || !hubspotSource.config) {
        throw new Error('No HubSpot OAuth tokens found for this company');
      }

      const config = typeof hubspotSource.config === 'string' 
        ? JSON.parse(hubspotSource.config) 
        : hubspotSource.config;
      const { accessToken, portalInfo } = config;
      
      if (!accessToken) {
        throw new Error('Invalid OAuth configuration');
      }

      const portalId = portalInfo?.portalId || 'unknown';
      
      console.log(`🔗 Using HubSpot portal: ${portalId}`);

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Fetch and sync contacts with automatic token refresh
      console.log('👥 Fetching HubSpot contacts...');
      const contacts = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchContacts(token, 500)
      );
      if (contacts.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'hubspot_contacts', contacts, 'hubspot_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_hubspot_contacts');
        console.log(`✅ Synced ${recordsLoaded} contacts`);
      }

      // Fetch and sync companies with automatic token refresh
      console.log('🏢 Fetching HubSpot companies...');
      const companies = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchCompanies(token, 500)
      );
      if (companies.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'hubspot_companies', companies, 'hubspot_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_hubspot_companies');
        console.log(`✅ Synced ${recordsLoaded} companies`);
      }

      // Fetch and sync deals with automatic token refresh
      console.log('💰 Fetching HubSpot deals...');
      const deals = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchDeals(token, 500)
      );
      if (deals.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'hubspot_deals', deals, 'hubspot_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_hubspot_deals');
        console.log(`✅ Synced ${recordsLoaded} deals`);
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

      console.log(`🎉 HubSpot OAuth sync completed: ${totalRecords} total records across ${tablesCreated.length} tables`);

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ HubSpot OAuth sync failed:', error);
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
export const hubspotOAuthService = new HubSpotOAuthService();