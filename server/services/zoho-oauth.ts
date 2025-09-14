/**
 * Zoho OAuth2 integration service
 * Supports Zoho CRM, Books, and Desk APIs with OAuth 2.0 authentication
 */

interface ZohoOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  datacenter: string;
}

interface ZohoTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  api_domain?: string;
  token_type: string;
}

interface ZohoUserInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  display_name: string;
  profile_picture?: string;
  role?: string;
  organization_id: string;
}

interface ZohoOrgInfo {
  id: string;
  name: string;
  domain_name: string;
  timezone: string;
  country_code: string;
  currency: string;
  created_time: string;
}

export class ZohoOAuthService {
  private config: ZohoOAuthConfig;

  constructor() {
    this.config = {
      clientId: process.env.ZOHO_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.ZOHO_OAUTH_CLIENT_SECRET || '',
      redirectUri: `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/zoho/callback`,
      datacenter: process.env.ZOHO_DATACENTER || 'com'
    };
  }

  /**
   * Generate state with company and user info for multi-tenant support
   */
  generateState(companyId: number, userId?: number): string {
    const stateData = {
      companyId,
      userId,
      service: 'zoho',
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2, 15)
    };
    return Buffer.from(JSON.stringify(stateData)).toString('base64');
  }

  /**
   * Parse state to get company and user info
   */
  parseState(state: string): { companyId: number; userId?: number; service: string; timestamp: number; nonce: string } {
    try {
      const decoded = Buffer.from(state, 'base64').toString();
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error('Invalid state parameter');
    }
  }

  /**
   * Initialize the OAuth client
   */
  async initialize(): Promise<void> {
    try {
      if (!this.config.clientId || !this.config.clientSecret) {
        throw new Error('Missing Zoho OAuth credentials');
      }
      console.log('✅ Zoho OAuth client initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Zoho OAuth client:', error);
      throw error;
    }
  }

  /**
   * Generate authorization URL with company context
   * Supports multiple Zoho products with comprehensive scopes
   */
  getAuthorizationUrl(companyId: number, userId?: number): string {
    const state = this.generateState(companyId, userId);
    
    // Comprehensive scopes for CRM, Books, Desk, and User Profile
    const scopes = [
      // Profile scope (required for getUserInfo API)
      'aaaserver.profile.READ',
      
      // CRM scopes
      'ZohoCRM.modules.ALL',
      'ZohoCRM.users.READ',
      'ZohoCRM.org.READ',
      'ZohoCRM.settings.READ',
      
      // Books scopes
      'ZohoBooks.fullaccess.all',
      
      // Desk scopes
      'Desk.tickets.READ',
      'Desk.tickets.UPDATE',
      'Desk.contacts.READ',
      'Desk.basic.READ',
      'Desk.search.READ'
    ];

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(','),
      state,
      access_type: 'offline', // For refresh tokens
      prompt: 'consent'
    });

    return `https://accounts.zoho.${this.config.datacenter}/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<ZohoTokenResponse> {
    try {
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        redirect_uri: this.config.redirectUri,
      });

      const response = await fetch(`https://accounts.zoho.${this.config.datacenter}/oauth/v2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: tokenParams.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`❌ [ZOHO] Token exchange failed: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const tokenData = await response.json();

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 3600,
        scope: tokenData.scope || '',
        api_domain: tokenData.api_domain,
        token_type: tokenData.token_type || 'Bearer'
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(accessToken: string): Promise<ZohoUserInfo> {
    try {
      const response = await fetch(`https://accounts.zoho.${this.config.datacenter}/oauth/user/info`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Zoho getUserInfo API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to get user info: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const userInfo = await response.json();
      console.log('Zoho user info response:', userInfo);

      return {
        id: userInfo.ZUID,
        first_name: userInfo.First_Name,
        last_name: userInfo.Last_Name,
        email: userInfo.Email,
        display_name: userInfo.Display_Name,
        profile_picture: userInfo.Profile_Picture,
        role: userInfo.Role,
        organization_id: userInfo.Organization_Id
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Get organization information
   */
  async getOrganizationInfo(accessToken: string): Promise<ZohoOrgInfo> {
    try {
      // Try CRM org info first
      const response = await fetch(`https://www.zohoapis.${this.config.datacenter}/crm/v6/org`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get organization info: ${response.statusText}`);
      }

      const orgData = await response.json();
      const org = orgData.org?.[0];

      return {
        id: org.id,
        name: org.company_name,
        domain_name: org.domain_name,
        timezone: org.time_zone,
        country_code: org.country_code,
        currency: org.primary_currency,
        created_time: org.created_time
      };
    } catch (error) {
      console.error('Failed to get organization info:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<ZohoTokenResponse> {
    try {
      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await fetch(`https://accounts.zoho.${this.config.datacenter}/oauth/v2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: refreshParams.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`❌ [ZOHO] Token refresh failed: ${response.status} ${response.statusText}`, errorBody);
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken, // Zoho may not return new refresh token
        expires_in: tokenData.expires_in || 3600,
        scope: tokenData.scope || '',
        api_domain: tokenData.api_domain,
        token_type: tokenData.token_type || 'Bearer'
      };
    } catch (error) {
      console.error('❌ [ZOHO] Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string): Promise<boolean> {
    try {
      // Test CRM API access
      const response = await fetch(`https://www.zohoapis.${this.config.datacenter}/crm/v6/org`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`🔍 CRM API test failed: ${response.status} ${response.statusText}`);
        return false;
      }

      return true;
    } catch (error: any) {
      console.error('Failed to test API access:', error);
      return false;
    }
  }

  /**
   * Discover available Zoho modules and their fields dynamically
   */
  async discoverZohoTables(accessToken: string): Promise<any[]> {
    try {
      const tables = [];

      // CRM Modules Discovery
      const crmModules = await this.discoverCRMModules(accessToken);
      tables.push(...crmModules);

      // Books Modules Discovery
      const booksModules = await this.discoverBooksModules(accessToken);
      tables.push(...booksModules);

      // Desk Modules Discovery
      const deskModules = await this.discoverDeskModules(accessToken);
      tables.push(...deskModules);

      return tables.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Failed to discover Zoho tables:', error);
      return [];
    }
  }

  /**
   * Discover CRM modules
   */
  private async discoverCRMModules(accessToken: string): Promise<any[]> {
    try {
      const response = await fetch(`https://www.zohoapis.${this.config.datacenter}/crm/v6/settings/modules`, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) return [];

      const data = await response.json();
      const modules = data.modules || [];

      return modules
        .filter((module: any) => module.api_supported && !module.system_module)
        .map((module: any) => ({
          name: `crm_${module.api_name.toLowerCase()}`,
          label: `CRM ${module.singular_label}`,
          fields: this.getStandardCRMFields(module.api_name),
          accessible: true,
          isStandard: ['Deals', 'Contacts', 'Accounts', 'Leads'].includes(module.api_name),
          product: 'CRM'
        }));
    } catch (error) {
      console.log('Could not discover CRM modules:', error);
      return [];
    }
  }

  /**
   * Discover Books modules
   */
  private async discoverBooksModules(accessToken: string): Promise<any[]> {
    try {
      // Books doesn't have a modules endpoint, so we define standard entities
      const standardBooksModules = [
        { name: 'customers', label: 'Customers' },
        { name: 'invoices', label: 'Invoices' },
        { name: 'items', label: 'Items' },
        { name: 'expenses', label: 'Expenses' },
        { name: 'bills', label: 'Bills' },
        { name: 'payments', label: 'Payments' },
        { name: 'creditnotes', label: 'Credit Notes' },
        { name: 'salesorders', label: 'Sales Orders' },
        { name: 'purchaseorders', label: 'Purchase Orders' }
      ];

      return standardBooksModules.map(module => ({
        name: `books_${module.name}`,
        label: `Books ${module.label}`,
        fields: this.getStandardBooksFields(module.name),
        accessible: true,
        isStandard: ['customers', 'invoices', 'items'].includes(module.name),
        product: 'Books'
      }));
    } catch (error) {
      console.log('Could not discover Books modules:', error);
      return [];
    }
  }

  /**
   * Discover Desk modules
   */
  private async discoverDeskModules(accessToken: string): Promise<any[]> {
    try {
      // Get organization's Desk domain first
      const orgInfo = await this.getOrganizationInfo(accessToken);
      const deskDomain = orgInfo.domain_name;

      if (!deskDomain) return [];

      const standardDeskModules = [
        { name: 'tickets', label: 'Tickets' },
        { name: 'contacts', label: 'Contacts' },
        { name: 'accounts', label: 'Accounts' },
        { name: 'agents', label: 'Agents' },
        { name: 'timeEntry', label: 'Time Entries' }
      ];

      return standardDeskModules.map(module => ({
        name: `desk_${module.name}`,
        label: `Desk ${module.label}`,
        fields: this.getStandardDeskFields(module.name),
        accessible: true,
        isStandard: ['tickets', 'contacts'].includes(module.name),
        product: 'Desk'
      }));
    } catch (error) {
      console.log('Could not discover Desk modules:', error);
      return [];
    }
  }

  /**
   * Get standard CRM fields for a module
   */
  private getStandardCRMFields(moduleName: string): string[] {
    const fieldMap: { [key: string]: string[] } = {
      'Deals': ['id', 'Deal_Name', 'Amount', 'Stage', 'Probability', 'Closing_Date', 'Account_Name', 'Owner', 'Created_Time', 'Modified_Time'],
      'Contacts': ['id', 'First_Name', 'Last_Name', 'Email', 'Phone', 'Account_Name', 'Owner', 'Created_Time', 'Modified_Time'],
      'Accounts': ['id', 'Account_Name', 'Phone', 'Website', 'Industry', 'Annual_Revenue', 'Owner', 'Created_Time', 'Modified_Time'],
      'Leads': ['id', 'First_Name', 'Last_Name', 'Email', 'Phone', 'Company', 'Lead_Status', 'Owner', 'Created_Time', 'Modified_Time'],
      'Tasks': ['id', 'Subject', 'Status', 'Priority', 'Due_Date', 'Owner', 'What_Id', 'Who_Id', 'Created_Time', 'Modified_Time']
    };
    
    return fieldMap[moduleName] || ['id', 'Name', 'Owner', 'Created_Time', 'Modified_Time'];
  }

  /**
   * Get standard Books fields for a module
   */
  private getStandardBooksFields(moduleName: string): string[] {
    const fieldMap: { [key: string]: string[] } = {
      'customers': ['contact_id', 'contact_name', 'email', 'phone', 'company_name', 'balance', 'created_time'],
      'invoices': ['invoice_id', 'invoice_number', 'customer_name', 'total', 'balance', 'status', 'date', 'due_date'],
      'items': ['item_id', 'name', 'sku', 'rate', 'tax_id', 'item_type', 'status'],
      'expenses': ['expense_id', 'amount', 'description', 'expense_receipt_name', 'date', 'customer_name', 'project_name']
    };
    
    return fieldMap[moduleName] || ['id', 'name', 'created_time', 'modified_time'];
  }

  /**
   * Get standard Desk fields for a module
   */
  private getStandardDeskFields(moduleName: string): string[] {
    const fieldMap: { [key: string]: string[] } = {
      'tickets': ['id', 'ticketNumber', 'subject', 'status', 'priority', 'assigneeId', 'contactId', 'createdTime', 'modifiedTime'],
      'contacts': ['id', 'firstName', 'lastName', 'email', 'phone', 'accountId', 'createdTime', 'modifiedTime'],
      'accounts': ['id', 'accountName', 'phone', 'website', 'industry', 'createdTime', 'modifiedTime']
    };
    
    return fieldMap[moduleName] || ['id', 'name', 'createdTime', 'modifiedTime'];
  }

  /**
   * Execute API call with automatic token refresh on 401 errors
   */
  async executeWithTokenRefresh<T>(
    companyId: number, 
    apiCall: (accessToken: string) => Promise<T>
  ): Promise<T> {
    const storage = await import('../storage');
    
    // Get current tokens from database
    const zohoSource = await storage.storage.getDataSourcesByCompany(companyId)
      .then(sources => sources.find(ds => ds.type === 'zoho'));
    
    if (!zohoSource?.config) {
      throw new Error('No Zoho OAuth tokens found for this company');
    }

    const config = zohoSource.config as any || {};
    let { accessToken, refreshToken } = config;

    try {
      // Try the API call with current access token
      return await apiCall(accessToken);
    } catch (error: any) {
      // Check if it's a token expiration error
      if (error.message?.includes('TOKEN_EXPIRED') || error.message?.includes('401')) {
        
        if (!refreshToken) {
          throw new Error('No refresh token available for automatic refresh');
        }

        try {
          // Refresh the access token
          const newTokens = await this.refreshToken(refreshToken);
          
          // Update tokens in database
          const updatedConfig = {
            ...config,
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token,
            expiresAt: new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString(),
          };

          await storage.storage.updateDataSource(zohoSource.id, {
            config: updatedConfig,
          });

          // Retry the API call with the new access token
          return await apiCall(newTokens.access_token);
        } catch (refreshError) {
          console.error('❌ Failed to refresh access token:', refreshError);
          throw new Error('Failed to refresh OAuth tokens. Please re-authenticate.');
        }
      }
      
      // If it's not a token error, re-throw the original error
      throw error;
    }
  }

  /**
   * Sync Zoho data to company analytics schema using stored OAuth tokens
   */
  async syncDataToSchema(companyId: number): Promise<{ success: boolean; recordsSynced: number; tablesCreated: string[]; error?: string }> {
    try {
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

      const config = zohoSource.config as any || {};
      const { accessToken } = config;
      
      if (!accessToken) {
        throw new Error('Invalid OAuth configuration');
      }

      console.log(`🔗 Using Zoho OAuth token for company ${companyId}`);

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Helper function to create table and insert data
      const insertDataToSchema = async (tableName: string, data: any[], sourceSystem: string) => {
        const schemaName = `analytics_company_${companyId}`;
        const fullTableName = `${schemaName}.raw_${tableName}`;
        
        if (data.length === 0) return 0;
        
        // Create schema
        await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
        
        // Create table 
        await sql.unsafe(`
          CREATE TABLE IF NOT EXISTS ${fullTableName} (
            id SERIAL PRIMARY KEY,
            data JSONB NOT NULL,
            source_system TEXT NOT NULL,
            company_id BIGINT NOT NULL,
            loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Clear existing data for fresh sync
        await sql.unsafe(`DELETE FROM ${fullTableName} WHERE source_system = $1`, [sourceSystem]);
        
        // Insert data in batches
        let inserted = 0;
        
        for (const item of data) {
          await sql.unsafe(`
            INSERT INTO ${fullTableName} (data, source_system, company_id)
            VALUES ($1, $2, $3)
          `, [JSON.stringify(item), sourceSystem, companyId]);
          inserted++;
        }
        
        return inserted;
      };

      // Fetch and sync CRM Deals (most important for business metrics)
      console.log('💼 Fetching Zoho CRM Deals...');
      const deals = await this.executeWithTokenRefresh(companyId, 
        (token) => this.fetchCRMRecords(token, 'Deals', 200)
      );
      if (deals.length > 0) {
        const recordsLoaded = await insertDataToSchema('zoho_deals', deals, 'zoho_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_zoho_deals');
        console.log(`✅ Synced ${recordsLoaded} deals`);
      }

      // Fetch and sync CRM Contacts (with error handling)
      try {
        console.log('👥 Fetching Zoho CRM Contacts...');
        const contacts = await this.executeWithTokenRefresh(companyId,
          (token) => this.fetchCRMRecords(token, 'Contacts', 200)
        );
        if (contacts.length > 0) {
          const recordsLoaded = await insertDataToSchema('zoho_contacts', contacts, 'zoho_oauth');
          totalRecords += recordsLoaded;
          tablesCreated.push('raw_zoho_contacts');
          console.log(`✅ Synced ${recordsLoaded} contacts`);
        } else {
          console.log('ℹ️ No contacts found or accessible in Zoho CRM');
        }
      } catch (contactsError) {
        console.error('⚠️ Failed to sync contacts (continuing with other modules):', contactsError.message);
      }

      // Fetch and sync Books Invoices (with error handling)
      try {
        console.log('🧾 Fetching Zoho Books Invoices...');
        const invoices = await this.executeWithTokenRefresh(companyId,
          (token) => this.fetchBooksRecords(token, 'invoices', 200)
        );
        if (invoices.length > 0) {
          const recordsLoaded = await insertDataToSchema('zoho_invoices', invoices, 'zoho_oauth');
          totalRecords += recordsLoaded;
          tablesCreated.push('raw_zoho_invoices');
          console.log(`✅ Synced ${recordsLoaded} invoices`);
        } else {
          console.log('ℹ️ No invoices found or accessible in Zoho Books');
        }
      } catch (invoicesError) {
        console.error('⚠️ Failed to sync invoices (continuing with other modules):', invoicesError.message);
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

  /**
   * Get appropriate fields for each CRM module
   */
  private getCRMFields(module: string): string {
    const fieldMapping: { [key: string]: string[] } = {
      'Deals': [
        'Deal_Name', 'Amount', 'Stage', 'Account_Name', 'Contact_Name',
        'Created_Time', 'Modified_Time', 'Owner', 'Closing_Date',
        'Probability', 'Deal_Category_Status', 'Next_Step'
      ],
      'Contacts': [
        'First_Name', 'Last_Name', 'Full_Name', 'Email', 'Phone',
        'Account_Name', 'Created_Time', 'Modified_Time', 'Owner',
        'Title', 'Department', 'Lead_Source'
      ],
      'Accounts': [
        'Account_Name', 'Phone', 'Website', 'Industry', 'Annual_Revenue',
        'Created_Time', 'Modified_Time', 'Owner', 'Billing_City',
        'Billing_State', 'Billing_Country', 'Number_Of_Employees'
      ]
    };

    return fieldMapping[module]?.join(',') || 'Created_Time,Modified_Time,Owner';
  }

  /**
   * Fetch CRM records from Zoho
   */
  async fetchCRMRecords(accessToken: string, module: string, maxResults: number = 200): Promise<any[]> {
    try {
      let allRecords: any[] = [];
      let page = 1;
      const perPage = 200;

      do {
        const fields = this.getCRMFields(module);
        const url = `https://www.zohoapis.${this.config.datacenter}/crm/v6/${module}?fields=${fields}&page=${page}&per_page=${perPage}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Zoho-oauthtoken ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Zoho fetchCRMRecords API error: ${response.status} ${response.statusText}`, errorText);
          if (response.status === 401) {
            throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
          }
          throw new Error(`Failed to fetch ${module}: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const responseText = await response.text();
        
        // Handle empty response
        if (!responseText.trim()) {
          console.log(`Zoho CRM ${module} returned empty response`);
          break;
        }
        
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`Failed to parse JSON for ${module}:`, responseText);
          throw new Error(`Invalid JSON response from ${module} API`);
        }
        
        console.log(`Zoho CRM ${module} API response:`, JSON.stringify(data, null, 2));
        const records = data.data || [];
        
        // Handle no data scenario
        if (!records || records.length === 0) {
          console.log(`No ${module} records found in Zoho`);
          break;
        }
        
        allRecords.push(...records);
        
        console.log(`Fetched ${allRecords.length}/${data.info?.count || allRecords.length} ${module}`);
        
        // Check if there are more pages
        if (!data.info?.more_records || allRecords.length >= maxResults) {
          break;
        }
        
        page++;
        
      } while (allRecords.length < maxResults);

      return allRecords;
    } catch (error) {
      console.error(`Failed to fetch Zoho CRM ${module}:`, error);
      throw error;
    }
  }

  /**
   * Fetch Books records from Zoho
   */
  async fetchBooksRecords(accessToken: string, entity: string, maxResults: number = 200): Promise<any[]> {
    try {
      const url = `https://books.zohoapis.${this.config.datacenter}/api/v3/${entity}?per_page=${maxResults}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
        }
        throw new Error(`Failed to fetch Books ${entity}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data[entity] || [];
    } catch (error) {
      console.error(`Failed to fetch Zoho Books ${entity}:`, error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for a company's Zoho data (raw → stg → int → core)
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;
    
    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
      
      // Check which raw tables actually exist
      const existingTables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ${schema} 
        AND table_name LIKE 'raw_zoho_%'
      `;
      const tableNames = existingTables.map((row: any) => row.table_name);
      
      console.log(`🔍 Found existing raw tables: ${tableNames.join(', ')}`);
      
      console.log('🧹 Cleaning up existing Zoho transformation objects...');
      // Drop views first (they depend on tables)
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_zoho_deals`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_zoho_contacts`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_zoho_invoices`;
      
      // Drop tables in reverse dependency order
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_zoho_deals`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_zoho_contacts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_zoho_invoices`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_zoho_deals`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_zoho_contacts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_zoho_invoices`;
      
      console.log('📋 Creating Zoho staging tables (stg)...');
      
      // STG: zoho_deals - normalized and cleaned (only if raw data exists)
      if (tableNames.includes('raw_zoho_deals')) {
        console.log('📋 Creating stg_zoho_deals...');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_zoho_deals AS
          SELECT DISTINCT 
            (data->>'id')::bigint as deal_id,
            data->>'Deal_Name' as deal_name,
            COALESCE((data->>'Amount')::numeric, 0) as amount,
            data->>'Stage' as stage,
            COALESCE((data->>'Probability')::numeric, 0) as probability,
            (data->>'Closing_Date')::date as closing_date,
            data#>>'{Account_Name,name}' as account_name,
            data#>>'{Owner,name}' as owner_name,
            data#>>'{Owner,id}' as owner_id,
            (data->>'Created_Time')::timestamp as created_at,
            (data->>'Modified_Time')::timestamp as updated_at,
            data as raw_data
          FROM ${sql(schema)}.raw_zoho_deals
          WHERE data IS NOT NULL
        `;
        console.log('✅ Created stg_zoho_deals');
      }
      
      // STG: zoho_contacts - normalized (only if raw data exists)
      if (tableNames.includes('raw_zoho_contacts')) {
        console.log('📋 Creating stg_zoho_contacts...');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_zoho_contacts AS
          SELECT DISTINCT
            (data->>'id')::bigint as contact_id,
            data->>'First_Name' as first_name,
            data->>'Last_Name' as last_name,
            CONCAT(data->>'First_Name', ' ', data->>'Last_Name') as full_name,
            data->>'Email' as email,
            data->>'Phone' as phone,
            data#>>'{Account_Name,name}' as account_name,
            data#>>'{Owner,name}' as owner_name,
            data#>>'{Owner,id}' as owner_id,
            (data->>'Created_Time')::timestamp as created_at,
            (data->>'Modified_Time')::timestamp as updated_at
          FROM ${sql(schema)}.raw_zoho_contacts
          WHERE data IS NOT NULL AND (data->>'id') IS NOT NULL
        `;
        console.log('✅ Created stg_zoho_contacts');
      }
      
      // STG: zoho_invoices - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_zoho_invoices AS  
        SELECT DISTINCT
          data->>'invoice_id' as invoice_id,
          data->>'invoice_number' as invoice_number,
          data->>'customer_name' as customer_name,
          COALESCE((data->>'total')::numeric, 0) as total,
          COALESCE((data->>'balance')::numeric, 0) as balance,
          data->>'status' as status,
          (data->>'date')::date as invoice_date,
          (data->>'due_date')::date as due_date,
          (data->>'created_time')::timestamp as created_at
        FROM ${sql(schema)}.raw_zoho_invoices
        WHERE data IS NOT NULL
      `;
      
      console.log('🔗 Creating Zoho integration tables (int)...');
      
      // INT: zoho_deals - enriched deal data with calculated fields
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
          owner_name,
          owner_id,
          created_at,
          updated_at,
          -- Calculated fields
          CASE 
            WHEN stage IN ('Closed Won', 'Won') THEN 'Won'
            WHEN stage IN ('Closed Lost', 'Lost') THEN 'Lost'
            ELSE 'Open'
          END as deal_status,
          CASE WHEN closing_date >= CURRENT_DATE THEN 'Future' ELSE 'Past' END as close_timing,
          (amount * probability / 100) as weighted_amount
        FROM ${sql(schema)}.stg_zoho_deals
      `;
      
      // INT: zoho_contacts - enriched contact data
      await sql`
        CREATE TABLE ${sql(schema)}.int_zoho_contacts AS
        SELECT 
          contact_id,
          first_name,
          last_name,
          full_name,
          email,
          phone,
          account_name,
          owner_name,
          owner_id,
          created_at,
          updated_at,
          -- Calculated fields
          CASE WHEN email IS NOT NULL THEN 'Has Email' ELSE 'No Email' END as email_status,
          CASE WHEN phone IS NOT NULL THEN 'Has Phone' ELSE 'No Phone' END as phone_status,
          CASE WHEN account_name IS NOT NULL THEN 'Has Account' ELSE 'Individual' END as account_status
        FROM ${sql(schema)}.stg_zoho_contacts
      `;
      
      // INT: zoho_invoices - enriched invoice data
      await sql`
        CREATE TABLE ${sql(schema)}.int_zoho_invoices AS
        SELECT 
          invoice_id,
          invoice_number,
          customer_name,
          total,
          balance,
          status,
          invoice_date,
          due_date,
          created_at,
          -- Calculated fields
          (total - balance) as paid_amount,
          CASE 
            WHEN balance = 0 THEN 'Paid'
            WHEN due_date < CURRENT_DATE AND balance > 0 THEN 'Overdue'
            WHEN balance > 0 THEN 'Outstanding'
            ELSE 'Unknown'
          END as payment_status,
          CASE WHEN due_date < CURRENT_DATE THEN CURRENT_DATE - due_date ELSE 0 END as days_overdue
        FROM ${sql(schema)}.stg_zoho_invoices
      `;
      
      console.log('👁️ Creating Zoho core views...');
      
      // CORE: Views that mirror int tables (no aggregation)
      await sql`
        CREATE VIEW ${sql(schema)}.core_zoho_deals AS 
        SELECT * FROM ${sql(schema)}.int_zoho_deals
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_zoho_contacts AS
        SELECT * FROM ${sql(schema)}.int_zoho_contacts  
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_zoho_invoices AS
        SELECT * FROM ${sql(schema)}.int_zoho_invoices
      `;
      
      console.log('✅ Zoho transformation pipeline completed (raw → stg → int → core)');
      
    } catch (error) {
      console.error('❌ Zoho transformation pipeline failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const zohoOAuthService = new ZohoOAuthService();