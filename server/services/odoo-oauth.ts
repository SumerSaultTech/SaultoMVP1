/**
 * Odoo OAuth2 integration service extending base OAuth class
 */

import { OAuthServiceBase } from './oauth-base.js';
import { 
  TokenResponse, 
  SyncResult, 
  TableDiscoveryResult,
  OAuthError 
} from './oauth-types.js';

interface OdooUserInfo {
  uid: number;
  name: string;
  login: string;
  company_id: number;
  company_name: string;
  database: string;
}

export class OdooOAuthService extends OAuthServiceBase {
  
  constructor() {
    super();
    // Note: Odoo OAuth uses customer-provided credentials, not environment variables
    console.log('🔧 Odoo OAuth service initialized - uses customer-provided credentials');
  }

  /**
   * Get service type identifier
   */
  getServiceType(): string {
    return 'odoo';
  }

  /**
   * Generate authorization URL with company context
   * Uses customer-provided OAuth credentials stored in database
   */
  async getAuthorizationUrl(companyId: number, userId?: number): Promise<string> {
    // Get stored Odoo configuration from database
    const storage = (await import('../storage.js')).storage;
    const dataSources = await storage.getDataSourcesByCompany(companyId);
    const odooSource = dataSources.find(ds => ds.type === 'odoo');
    
    if (!odooSource?.config) {
      throw new OAuthError('Odoo configuration not found. Please complete setup first.', 'INVALID_CONFIG');
    }

    const config = typeof odooSource.config === 'string' 
      ? JSON.parse(odooSource.config) 
      : odooSource.config;

    const { odooInstanceUrl, consumerKey } = config;

    if (!odooInstanceUrl || !consumerKey) {
      throw new OAuthError('Odoo instance URL and consumer key are required', 'INVALID_CONFIG');
    }

    const state = this.generateState(companyId, userId);
    
    // Odoo OAuth scopes for ERP data access
    const scopes = [
      'userinfo',  // Basic user information
      'read',      // Read access to data
    ];

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: consumerKey,  // Use customer's consumer key
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state
    });

    // Use the customer's Odoo instance REST API URL for authorization (Fivetran approach)
    return `${odooInstanceUrl}/restapi/1.0/common/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   * Uses customer-provided OAuth credentials
   */
  async exchangeCodeForTokens(code: string, state: string, companyId: number): Promise<TokenResponse> {
    try {
      // Get stored Odoo configuration from database
      const storage = (await import('../storage.js')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const odooSource = dataSources.find(ds => ds.type === 'odoo');
      
      if (!odooSource?.config) {
        throw new OAuthError('Odoo configuration not found', 'INVALID_CONFIG');
      }

      const config = typeof odooSource.config === 'string' 
        ? JSON.parse(odooSource.config) 
        : odooSource.config;

      const { odooInstanceUrl, consumerKey, consumerSecret } = config;

      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: consumerKey,
        client_secret: consumerSecret,
        redirect_uri: this.config.redirectUri,
        code: code
      });

      const response = await fetch(`${odooInstanceUrl}/restapi/1.0/common/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: tokenParams.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new OAuthError(`Token exchange failed: ${response.statusText} - ${errorData}`, 'API_ERROR');
      }

      const tokenData = await response.json();

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 3600, // Default 1 hour
        token_type: tokenData.token_type || 'bearer',
        scope: tokenData.scope,
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get user info using access token
   */
  async getUserInfo(accessToken: string, odooInstanceUrl: string): Promise<OdooUserInfo> {
    try {
      const response = await fetch(`${odooInstanceUrl}/restapi/1.0/common/userinfo`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new OAuthError(`Failed to get user info: ${response.statusText}`, 'API_ERROR');
      }

      const userInfo = await response.json();

      return {
        uid: userInfo.uid || userInfo.user_id,
        name: userInfo.name,
        login: userInfo.login || userInfo.email,
        company_id: userInfo.company_id,
        company_name: userInfo.company_name,
        database: userInfo.database || userInfo.db
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Refresh access token with stored company context
   */
  async refreshTokenWithContext(refreshToken: string, companyId: number): Promise<TokenResponse> {
    try {
      // Get stored Odoo configuration from database
      const storage = (await import('../storage.js')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const odooSource = dataSources.find(ds => ds.type === 'odoo');
      
      if (!odooSource?.config) {
        throw new OAuthError('Odoo configuration not found', 'INVALID_CONFIG');
      }

      const config = typeof odooSource.config === 'string' 
        ? JSON.parse(odooSource.config) 
        : odooSource.config;

      const { odooInstanceUrl, consumerKey, consumerSecret } = config;

      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: consumerKey,
        client_secret: consumerSecret,
        refresh_token: refreshToken
      });

      const response = await fetch(`${odooInstanceUrl}/restapi/1.0/common/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: refreshParams.toString(),
      });

      if (!response.ok) {
        throw new OAuthError(`Token refresh failed: ${response.statusText}`, 'REFRESH_FAILED');
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
   * Refresh access token - required by base class
   * For Odoo, we need company context, so this delegates to refreshTokenWithContext
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    // This is called by the base class without company context
    // For Odoo, we need to handle this differently
    throw new OAuthError('Odoo token refresh requires re-authentication. Please reconnect.', 'REFRESH_FAILED');
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string, odooInstanceUrl: string): Promise<boolean> {
    try {
      // Test access by getting user info
      await this.getUserInfo(accessToken, odooInstanceUrl);
      return true;
    } catch (error) {
      console.error('Failed to test API access:', error);
      return false;
    }
  }

  /**
   * Discover available tables - required by base class
   */
  async discoverTables(accessToken: string, odooInstanceUrl: string): Promise<TableDiscoveryResult[]> {
    try {
      const tables = [];

      // Core ERP models that are available in most Odoo instances
      const coreModels = [
        { name: 'sale_order', label: 'Sales Orders', fields: ['name', 'partner_id', 'date_order', 'amount_total', 'state'] },
        { name: 'account_move', label: 'Invoices', fields: ['name', 'partner_id', 'invoice_date', 'amount_total', 'state'] },
        { name: 'res_partner', label: 'Customers/Vendors', fields: ['name', 'email', 'phone', 'is_company', 'customer_rank'] },
        { name: 'product_product', label: 'Products', fields: ['name', 'default_code', 'list_price', 'qty_available'] },
        { name: 'stock_move', label: 'Inventory Movements', fields: ['name', 'product_id', 'product_uom_qty', 'date', 'state'] },
        { name: 'purchase_order', label: 'Purchase Orders', fields: ['name', 'partner_id', 'date_order', 'amount_total', 'state'] },
        { name: 'hr_employee', label: 'Employees', fields: ['name', 'job_id', 'department_id', 'work_email'] },
        { name: 'project_project', label: 'Projects', fields: ['name', 'user_id', 'date_start', 'date', 'stage_id'] },
        { name: 'crm_lead', label: 'CRM Leads', fields: ['name', 'partner_id', 'expected_revenue', 'probability', 'stage_id'] },
      ];

      for (const model of coreModels) {
        try {
          // Test if we can access this model by making a simple request
          const testResponse = await this.makeOdooApiCall(accessToken, odooInstanceUrl, model.name, 'search_read', [], { limit: 1 });
          
          if (testResponse && Array.isArray(testResponse)) {
            tables.push({
              name: model.name,
              label: model.label,
              fields: model.fields,
              accessible: true,
              isStandard: ['sale_order', 'account_move', 'res_partner', 'product_product'].includes(model.name)
            });
          }
        } catch (error) {
          console.log(`Could not access ${model.name}:`, error.message);
        }
      }

      return tables.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Failed to discover Odoo tables:', error);
      return [];
    }
  }

  /**
   * Make Odoo JSON-RPC API call
   */
  async makeOdooApiCall(
    accessToken: string, 
    odooInstanceUrl: string, 
    model: string, 
    method: string, 
    args: any[] = [], 
    kwargs: any = {}
  ): Promise<any> {
    try {
      const data = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          model: model,
          method: method,
          args: args,
          kwargs: kwargs
        },
        id: Math.floor(Math.random() * 1000000)
      };

      const response = await fetch(`${odooInstanceUrl}/jsonrpc`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new OAuthError(`API call failed: ${response.statusText}`, 'API_ERROR', response.status);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new OAuthError(`Odoo API error: ${result.error.message || result.error.data?.message}`, 'API_ERROR');
      }

      return result.result;
    } catch (error) {
      console.error('Odoo API call failed:', error);
      throw error;
    }
  }

  /**
   * Sync Odoo data to company analytics schema using stored OAuth tokens
   */
  async syncDataToSchema(companyId: number): Promise<SyncResult> {
    try {
      console.log(`🔄 Starting Odoo OAuth sync for company ${companyId}`);
      
      // Get stored OAuth tokens from database
      const storage = (await import('../storage.js')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const odooSource = dataSources.find(ds => ds.type === 'odoo');
      
      if (!odooSource || !odooSource.config) {
        throw new OAuthError('No Odoo OAuth tokens found for this company', 'INVALID_CONFIG');
      }

      const config = typeof odooSource.config === 'string' 
        ? JSON.parse(odooSource.config) 
        : odooSource.config;
      
      const { accessToken, odooInstanceUrl, userInfo } = config;
      
      if (!accessToken || !odooInstanceUrl) {
        throw new OAuthError('Invalid Odoo OAuth configuration', 'INVALID_CONFIG');
      }

      console.log(`🔗 Using Odoo instance: ${odooInstanceUrl}`);

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Fetch and sync sales orders
      console.log('💰 Fetching Odoo sales orders...');
      const salesOrders = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchSalesOrders(token, odooInstanceUrl, 500)
      );
      if (salesOrders.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'odoo_sales_orders', salesOrders, 'odoo_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_odoo_sales_orders');
        console.log(`✅ Synced ${recordsLoaded} sales orders`);
      }

      // Fetch and sync invoices
      console.log('🧾 Fetching Odoo invoices...');
      const invoices = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchInvoices(token, odooInstanceUrl, 500)
      );
      if (invoices.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'odoo_invoices', invoices, 'odoo_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_odoo_invoices');
        console.log(`✅ Synced ${recordsLoaded} invoices`);
      }

      // Fetch and sync customers
      console.log('👥 Fetching Odoo customers...');
      const customers = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchCustomers(token, odooInstanceUrl, 500)
      );
      if (customers.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'odoo_customers', customers, 'odoo_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_odoo_customers');
        console.log(`✅ Synced ${recordsLoaded} customers`);
      }

      // Fetch and sync products
      console.log('📦 Fetching Odoo products...');
      const products = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchProducts(token, odooInstanceUrl, 500)
      );
      if (products.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'odoo_products', products, 'odoo_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_odoo_products');
        console.log(`✅ Synced ${recordsLoaded} products`);
      }
      
      // Run automatic dbt-style transformations
      console.log('🔄 Running dbt-style transformations...');
      try {
        const postgres = (await import('postgres')).default;
        const databaseUrl = process.env.DATABASE_URL;
        
        if (!databaseUrl) {
          throw new Error('DATABASE_URL not configured');
        }
        
        const sql = postgres(databaseUrl);
        await this.runTransformations(companyId, sql);
        await sql.end();
        console.log('✅ Transformations completed successfully');
      } catch (transformError) {
        console.error('❌ Transformation failed:', transformError);
        // Continue with sync even if transformations fail
      }
      
      console.log(`🎉 Odoo OAuth sync completed: ${totalRecords} total records across ${tablesCreated.length} tables`);

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ Odoo OAuth sync failed:', error);
      return {
        success: false,
        recordsSynced: 0,
        tablesCreated: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch Odoo sales orders using OAuth token
   */
  async fetchSalesOrders(accessToken: string, odooInstanceUrl: string, limit: number = 100): Promise<any[]> {
    try {
      const fields = [
        'id', 'name', 'partner_id', 'date_order', 'state',
        'amount_total', 'amount_untaxed', 'currency_id',
        'user_id', 'team_id', 'create_date', 'write_date'
      ];

      const domain = [['state', 'in', ['sale', 'done']]]; // Only confirmed orders
      
      const salesOrders = await this.makeOdooApiCall(
        accessToken,
        odooInstanceUrl,
        'sale.order',
        'search_read',
        [domain],
        { fields: fields, limit: limit }
      );

      return salesOrders || [];
    } catch (error) {
      console.error('Failed to fetch Odoo sales orders:', error);
      throw error;
    }
  }

  /**
   * Fetch Odoo invoices using OAuth token
   */
  async fetchInvoices(accessToken: string, odooInstanceUrl: string, limit: number = 100): Promise<any[]> {
    try {
      const fields = [
        'id', 'name', 'partner_id', 'invoice_date', 'state',
        'move_type', 'amount_total', 'amount_untaxed',
        'amount_residual', 'currency_id', 'invoice_payment_state',
        'create_date', 'write_date'
      ];

      const domain = [['move_type', '=', 'out_invoice']]; // Only customer invoices
      
      const invoices = await this.makeOdooApiCall(
        accessToken,
        odooInstanceUrl,
        'account.move',
        'search_read',
        [domain],
        { fields: fields, limit: limit }
      );

      return invoices || [];
    } catch (error) {
      console.error('Failed to fetch Odoo invoices:', error);
      throw error;
    }
  }

  /**
   * Fetch Odoo customers using OAuth token
   */
  async fetchCustomers(accessToken: string, odooInstanceUrl: string, limit: number = 100): Promise<any[]> {
    try {
      const fields = [
        'id', 'name', 'email', 'phone', 'is_company',
        'customer_rank', 'supplier_rank', 'country_id',
        'city', 'street', 'website', 'create_date', 'write_date'
      ];

      const domain = [['customer_rank', '>', 0]]; // Only customers
      
      const customers = await this.makeOdooApiCall(
        accessToken,
        odooInstanceUrl,
        'res.partner',
        'search_read',
        [domain],
        { fields: fields, limit: limit }
      );

      return customers || [];
    } catch (error) {
      console.error('Failed to fetch Odoo customers:', error);
      throw error;
    }
  }

  /**
   * Fetch Odoo products using OAuth token
   */
  async fetchProducts(accessToken: string, odooInstanceUrl: string, limit: number = 100): Promise<any[]> {
    try {
      const fields = [
        'id', 'name', 'default_code', 'list_price', 'standard_price',
        'qty_available', 'virtual_available', 'categ_id',
        'active', 'create_date', 'write_date'
      ];

      const domain = [['active', '=', true]]; // Only active products
      
      const products = await this.makeOdooApiCall(
        accessToken,
        odooInstanceUrl,
        'product.product',
        'search_read',
        [domain],
        { fields: fields, limit: limit }
      );

      return products || [];
    } catch (error) {
      console.error('Failed to fetch Odoo products:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for Odoo data (raw → stg → int → core)
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;
    
    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
      
      console.log('🔍 Checking which Odoo RAW tables exist...');
      
      // Check which RAW tables exist
      const existingTables = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = ${schema} 
        AND table_name LIKE 'raw_odoo_%'
      `;
      
      const tableNames = existingTables.map((row: any) => row.table_name);
      const hasSalesOrders = tableNames.includes('raw_odoo_sales_orders');
      const hasInvoices = tableNames.includes('raw_odoo_invoices');
      const hasCustomers = tableNames.includes('raw_odoo_customers');
      const hasProducts = tableNames.includes('raw_odoo_products');
      
      console.log('📊 Found RAW tables:', {
        salesOrders: hasSalesOrders,
        invoices: hasInvoices,
        customers: hasCustomers,
        products: hasProducts
      });
      
      if (!hasSalesOrders && !hasInvoices && !hasCustomers && !hasProducts) {
        console.log('⚠️ No Odoo RAW tables found, skipping transformations');
        return;
      }
      
      console.log('🧹 Cleaning up existing Odoo transformation objects...');
      
      // Drop views first (they depend on tables)
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_odoo_sales_orders`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_odoo_invoices`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_odoo_customers`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_odoo_products`;
      
      // Drop tables in reverse dependency order
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_odoo_sales_orders`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_odoo_invoices`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_odoo_customers`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_odoo_products`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_odoo_sales_orders`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_odoo_invoices`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_odoo_customers`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_odoo_products`;
      
      console.log('📋 Creating Odoo staging tables (stg)...');
      
      // STG: odoo_sales_orders - normalized and cleaned
      if (hasSalesOrders) {
        console.log('  ✅ Creating stg_odoo_sales_orders');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_odoo_sales_orders AS
          SELECT DISTINCT 
            (data->>'id')::bigint as order_id,
            data->>'name' as order_name,
            (data#>>'{partner_id,1}') as customer_name,
            (data->>'date_order')::timestamp as order_date,
            data->>'state' as status,
            COALESCE((data->>'amount_total')::numeric, 0) as amount_total,
            COALESCE((data->>'amount_untaxed')::numeric, 0) as amount_untaxed,
            (data#>>'{currency_id,1}') as currency,
            (data#>>'{user_id,1}') as salesperson,
            (data#>>'{team_id,1}') as sales_team,
            (data->>'create_date')::timestamp as created_at,
            (data->>'write_date')::timestamp as updated_at,
            data as raw_data
          FROM ${sql(schema)}.raw_odoo_sales_orders
          WHERE data IS NOT NULL
        `;
      }
      
      // STG: odoo_invoices - normalized
      if (hasInvoices) {
        console.log('  ✅ Creating stg_odoo_invoices');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_odoo_invoices AS
          SELECT DISTINCT
            (data->>'id')::bigint as invoice_id,
            data->>'name' as invoice_number,
            (data#>>'{partner_id,1}') as customer_name,
            (data->>'invoice_date')::timestamp as invoice_date,
            data->>'state' as status,
            data->>'move_type' as invoice_type,
            COALESCE((data->>'amount_total')::numeric, 0) as amount_total,
            COALESCE((data->>'amount_untaxed')::numeric, 0) as amount_untaxed,
            COALESCE((data->>'amount_residual')::numeric, 0) as amount_due,
            (data#>>'{currency_id,1}') as currency,
            data->>'invoice_payment_state' as payment_status,
            (data->>'create_date')::timestamp as created_at,
            (data->>'write_date')::timestamp as updated_at
          FROM ${sql(schema)}.raw_odoo_invoices
          WHERE data IS NOT NULL
        `;
      }
      
      // STG: odoo_customers - normalized
      if (hasCustomers) {
        console.log('  ✅ Creating stg_odoo_customers');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_odoo_customers AS  
          SELECT DISTINCT
            (data->>'id')::bigint as customer_id,
            data->>'name' as customer_name,
            data->>'email' as email,
            data->>'phone' as phone,
            CASE WHEN data->>'is_company' = 'true' THEN true ELSE false END as is_company,
            COALESCE((data->>'customer_rank')::integer, 0) as customer_rank,
            COALESCE((data->>'supplier_rank')::integer, 0) as supplier_rank,
            (data#>>'{country_id,1}') as country,
            data->>'city' as city,
            data->>'street' as street,
            data->>'website' as website,
            (data->>'create_date')::timestamp as created_at,
            (data->>'write_date')::timestamp as updated_at
          FROM ${sql(schema)}.raw_odoo_customers
          WHERE data IS NOT NULL
        `;
      }
      
      // STG: odoo_products - normalized
      if (hasProducts) {
        console.log('  ✅ Creating stg_odoo_products');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_odoo_products AS  
          SELECT DISTINCT
            (data->>'id')::bigint as product_id,
            data->>'name' as product_name,
            data->>'default_code' as product_code,
            COALESCE((data->>'list_price')::numeric, 0) as list_price,
            COALESCE((data->>'standard_price')::numeric, 0) as cost_price,
            COALESCE((data->>'qty_available')::numeric, 0) as qty_available,
            COALESCE((data->>'virtual_available')::numeric, 0) as virtual_available,
            (data#>>'{categ_id,1}') as category,
            CASE WHEN data->>'active' = 'true' THEN true ELSE false END as is_active,
            (data->>'create_date')::timestamp as created_at,
            (data->>'write_date')::timestamp as updated_at
          FROM ${sql(schema)}.raw_odoo_products
          WHERE data IS NOT NULL
        `;
      }
      
      console.log('🔗 Creating Odoo integration tables (int)...');
      
      // INT: odoo_sales_orders - enriched with calculated fields
      if (hasSalesOrders) {
        console.log('  ✅ Creating int_odoo_sales_orders');
        await sql`
          CREATE TABLE ${sql(schema)}.int_odoo_sales_orders AS
          SELECT 
            order_id,
            order_name,
            customer_name,
            order_date,
            status,
            amount_total,
            amount_untaxed,
            currency,
            salesperson,
            sales_team,
            created_at,
            updated_at,
            -- Calculated fields
            amount_total - amount_untaxed as tax_amount,
            CASE 
              WHEN status = 'sale' THEN 'Confirmed'
              WHEN status = 'done' THEN 'Delivered'
              WHEN status = 'draft' THEN 'Draft'
              WHEN status = 'cancel' THEN 'Cancelled'
              ELSE 'Other'
            END as order_status_category,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - order_date))/86400 as days_since_order,
            CASE 
              WHEN amount_total > 10000 THEN 'Large'
              WHEN amount_total > 1000 THEN 'Medium'
              ELSE 'Small'
            END as order_size,
            EXTRACT(EPOCH FROM (updated_at - created_at))/86400 as processing_days
          FROM ${sql(schema)}.stg_odoo_sales_orders
        `;
      }
      
      // INT: odoo_invoices - enriched with calculated fields
      if (hasInvoices) {
        console.log('  ✅ Creating int_odoo_invoices');
        await sql`
          CREATE TABLE ${sql(schema)}.int_odoo_invoices AS
          SELECT 
            invoice_id,
            invoice_number,
            customer_name,
            invoice_date,
            status,
            invoice_type,
            amount_total,
            amount_untaxed,
            amount_due,
            currency,
            payment_status,
            created_at,
            updated_at,
            -- Calculated fields
            amount_total - amount_untaxed as tax_amount,
            amount_total - amount_due as amount_paid,
            CASE 
              WHEN amount_due = 0 THEN 'Paid'
              WHEN amount_due > 0 AND payment_status = 'partial' THEN 'Partially Paid'
              WHEN amount_due > 0 THEN 'Outstanding'
              ELSE 'Unknown'
            END as payment_status_category,
            CASE 
              WHEN invoice_date < CURRENT_DATE - INTERVAL '30 days' AND amount_due > 0 THEN 'Overdue'
              WHEN invoice_date < CURRENT_DATE - INTERVAL '14 days' AND amount_due > 0 THEN 'Due Soon'
              ELSE 'Current'
            END as aging_category,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - invoice_date))/86400 as days_since_invoice
          FROM ${sql(schema)}.stg_odoo_invoices
        `;
      }
      
      // INT: odoo_customers - enriched customer data
      if (hasCustomers) {
        console.log('  ✅ Creating int_odoo_customers');
        await sql`
          CREATE TABLE ${sql(schema)}.int_odoo_customers AS
          SELECT 
            customer_id,
            customer_name,
            email,
            phone,
            is_company,
            customer_rank,
            supplier_rank,
            country,
            city,
            street,
            website,
            created_at,
            updated_at,
            -- Calculated fields
            CASE 
              WHEN is_company THEN 'Company'
              ELSE 'Individual'
            END as customer_type,
            CASE 
              WHEN customer_rank > 0 AND supplier_rank > 0 THEN 'Customer & Supplier'
              WHEN customer_rank > 0 THEN 'Customer Only'
              WHEN supplier_rank > 0 THEN 'Supplier Only'
              ELSE 'Prospect'
            END as relationship_type,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/86400 as days_since_created,
            CASE 
              WHEN email IS NOT NULL AND phone IS NOT NULL THEN 'Complete'
              WHEN email IS NOT NULL OR phone IS NOT NULL THEN 'Partial'
              ELSE 'Missing'
            END as contact_completeness,
            CONCAT(COALESCE(street, ''), ', ', COALESCE(city, ''), ', ', COALESCE(country, '')) as full_address
          FROM ${sql(schema)}.stg_odoo_customers
        `;
      }
      
      // INT: odoo_products - enriched with calculated fields
      if (hasProducts) {
        console.log('  ✅ Creating int_odoo_products');
        await sql`
          CREATE TABLE ${sql(schema)}.int_odoo_products AS
          SELECT 
            product_id,
            product_name,
            product_code,
            list_price,
            cost_price,
            qty_available,
            virtual_available,
            category,
            is_active,
            created_at,
            updated_at,
            -- Calculated fields
            list_price - cost_price as profit_margin,
            CASE 
              WHEN cost_price > 0 THEN ROUND(((list_price - cost_price) / cost_price) * 100, 2)
              ELSE 0
            END as profit_margin_percent,
            CASE 
              WHEN qty_available <= 0 THEN 'Out of Stock'
              WHEN qty_available < 10 THEN 'Low Stock'
              ELSE 'In Stock'
            END as stock_status,
            virtual_available - qty_available as reserved_qty,
            CASE 
              WHEN list_price > 1000 THEN 'Premium'
              WHEN list_price > 100 THEN 'Standard'
              ELSE 'Economy'
            END as price_category
          FROM ${sql(schema)}.stg_odoo_products
        `;
      }
      
      console.log('👁️ Creating Odoo core views...');
      
      // CORE: Views that mirror int tables (only for existing tables)
      if (hasSalesOrders) {
        console.log('  ✅ Creating core_odoo_sales_orders view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_odoo_sales_orders AS 
          SELECT * FROM ${sql(schema)}.int_odoo_sales_orders
        `;
      }
      
      if (hasInvoices) {
        console.log('  ✅ Creating core_odoo_invoices view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_odoo_invoices AS
          SELECT * FROM ${sql(schema)}.int_odoo_invoices  
        `;
      }
      
      if (hasCustomers) {
        console.log('  ✅ Creating core_odoo_customers view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_odoo_customers AS
          SELECT * FROM ${sql(schema)}.int_odoo_customers
        `;
      }
      
      if (hasProducts) {
        console.log('  ✅ Creating core_odoo_products view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_odoo_products AS
          SELECT * FROM ${sql(schema)}.int_odoo_products
        `;
      }
      
      const createdLayers = [];
      if (hasSalesOrders) createdLayers.push('sales_orders');
      if (hasInvoices) createdLayers.push('invoices');
      if (hasCustomers) createdLayers.push('customers');
      if (hasProducts) createdLayers.push('products');
      
      console.log(`✅ Odoo transformation pipeline completed (raw → stg → int → core) for: ${createdLayers.join(', ')}`);
      
    } catch (error) {
      console.error('❌ Odoo transformation pipeline failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const odooOAuthService = new OdooOAuthService();