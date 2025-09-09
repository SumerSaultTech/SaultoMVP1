/**
 * Odoo XML-RPC API service extending base OAuth class infrastructure
 */
import xmlrpc from 'xmlrpc';
import { OAuthServiceBase } from './oauth-base.js';
import { SyncResult, TableDiscoveryResult } from './oauth-types.js';

export interface OdooAuthResult {
  success: boolean;
  sessionId?: string;
  userInfo?: {
    uid: number;
    name: string;
    login: string;
    company_id: number;
    company_name: string;
    database: string;
  };
  error?: string;
}

export interface OdooSyncResult {
  success: boolean;
  recordsSynced: number;
  tablesCreated: string[];
  error?: string;
}

export class OdooApiService extends OAuthServiceBase {
  
  constructor() {
    super();
    console.log('🔧 Odoo API service initialized with base OAuth infrastructure');
  }
  
  /**
   * Get service type identifier - required by base class
   */
  getServiceType(): string {
    return 'odoo';
  }
  
  /**
   * OAuth refresh token method (not used by Odoo, but required by base class)
   */
  async refreshToken(refreshToken: string): Promise<any> {
    throw new Error('Odoo uses API key authentication, not OAuth refresh tokens');
  }
  
  /**
   * Discover available tables - required by base class
   */
  async discoverTables(accessToken: string): Promise<TableDiscoveryResult[]> {
    // For Odoo, we return the standard tables we support
    return [
      { name: 'sales_orders', label: 'Sales Orders', fields: ['name', 'partner_id', 'amount_total', 'state'], accessible: true, isStandard: true },
      { name: 'invoices', label: 'Invoices', fields: ['name', 'partner_id', 'amount_total', 'state'], accessible: true, isStandard: true },
      { name: 'customers', label: 'Customers', fields: ['name', 'email', 'phone', 'is_company'], accessible: true, isStandard: true },
      { name: 'products', label: 'Products', fields: ['name', 'list_price', 'standard_price', 'categ_id'], accessible: true, isStandard: true }
    ];
  }
  
  /**
   * Test API access - override to use API key instead of OAuth token
   */
  async testApiAccess(instanceUrl: string, database: string, username: string, apiKey: string): Promise<boolean> {
    try {
      const authResult = await this.authenticate(instanceUrl, database, username, apiKey);
      return authResult.success;
    } catch (error) {
      console.error('Failed to test Odoo API access:', error);
      return false;
    }
  }
  
  /**
   * Helper method for authentication with a specific URL (used for fallback)
   */
  private async authenticateWithUrl(instanceUrl: string, database: string, username: string, apiKey: string): Promise<OdooAuthResult> {
    return new Promise((resolve, reject) => {
      try {
        // Normalize URL
        let normalizedUrl = instanceUrl.trim();
        normalizedUrl = normalizedUrl.replace(/\/$/, '');
        
        const url = new URL(normalizedUrl);
        const options = {
          host: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: '/xmlrpc/2/common',
          secure: url.protocol === 'https:'
        };
        
        console.log(`🔄 Fallback authentication with: ${normalizedUrl}`);
        
        const client = xmlrpc.createClient(options);
        
        client.methodCall('authenticate', [database, username, apiKey, {}], (error: any, uid: number) => {
          if (error) {
            reject(error);
            return;
          }
          
          if (!uid) {
            reject(new Error('Invalid credentials'));
            return;
          }
          
          resolve({
            success: true,
            sessionId: `${uid}:${apiKey}`,
            userInfo: {
              uid: uid,
              name: username,
              login: username,
              company_id: 1,
              company_name: 'Default Company',
              database: database
            }
          });
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Test connection and authenticate with Odoo using XML-RPC API key
   */
  async authenticate(instanceUrl: string, database: string, username: string, apiKey: string): Promise<OdooAuthResult> {
    return new Promise((resolve) => {
      try {
        console.log(`🔐 Testing Odoo XML-RPC authentication for ${username}@${database}`);
        
        // Normalize URL to ensure proper protocol
        let normalizedUrl = instanceUrl.trim();
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          // Default to https for production, but try http as fallback
          normalizedUrl = 'https://' + normalizedUrl;
          console.log(`⚠️  No protocol specified, using HTTPS: ${normalizedUrl}`);
        }
        
        // Remove trailing slash if present
        normalizedUrl = normalizedUrl.replace(/\/$/, '');
        
        // Parse URL to get host and port
        const url = new URL(normalizedUrl);
        const options = {
          host: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: '/xmlrpc/2/common',
          secure: url.protocol === 'https:'
        };
        
        console.log(`🔍 XML-RPC connection details:`, {
          originalUrl: instanceUrl,
          normalizedUrl: normalizedUrl,
          host: options.host,
          port: options.port,
          path: options.path,
          secure: options.secure
        });

        // Create XML-RPC client for common endpoint
        const client = xmlrpc.createClient(options);
        
        // Authenticate using XML-RPC
        client.methodCall('authenticate', [database, username, apiKey, {}], (error: any, uid: number) => {
          if (error) {
            console.error('❌ XML-RPC authentication error:', error);
            
            // Check if this is the "Unknown XML-RPC tag 'TITLE'" error (HTML response)
            if (error.message && error.message.includes("Unknown XML-RPC tag 'TITLE'")) {
              console.log('🔄 Detected HTML response instead of XML-RPC, trying HTTP fallback...');
              
              // Retry with HTTP if we tried HTTPS first
              if (url.protocol === 'https:') {
                const httpUrl = normalizedUrl.replace('https://', 'http://');
                console.log(`🔄 Retrying with HTTP: ${httpUrl}`);
                
                this.authenticateWithUrl(httpUrl, database, username, apiKey).then(resolve).catch((fallbackError) => {
                  console.error('❌ HTTP fallback also failed:', fallbackError);
                  resolve({
                    success: false,
                    error: `Authentication failed with both HTTPS and HTTP. Original error: ${error.message}. Fallback error: ${fallbackError.message || fallbackError}`
                  });
                });
                return;
              }
            }
            
            resolve({
              success: false,
              error: `Authentication failed: ${error.message || error}`
            });
            return;
          }
          
          if (!uid) {
            resolve({
              success: false,
              error: 'Authentication failed: Invalid credentials'
            });
            return;
          }

          console.log(`✅ XML-RPC authentication successful, UID: ${uid}`);

          // Get user info using object endpoint
          const objectOptions = {
            ...options,
            path: '/xmlrpc/2/object'
          };
          
          const objectClient = xmlrpc.createClient(objectOptions);
          
          // Call execute_kw to get user info
          objectClient.methodCall('execute_kw', [
            database, uid, apiKey,
            'res.users', 'read',
            [uid], { 'fields': ['name', 'login', 'company_id'] }
          ], (userError: any, userData: any[]) => {
            if (userError) {
              console.warn('⚠️ Could not fetch user info, using fallback:', userError);
              // Fallback - authentication successful but couldn't get user info
              resolve({
                success: true,
                sessionId: `${uid}:${apiKey}`,
                userInfo: {
                  uid: uid,
                  name: username,
                  login: username,
                  company_id: 1,
                  company_name: 'Default Company',
                  database: database
                }
              });
              return;
            }

            const user = userData?.[0];
            if (user) {
              resolve({
                success: true,
                sessionId: `${uid}:${apiKey}`,
                userInfo: {
                  uid: uid,
                  name: user.name,
                  login: user.login,
                  company_id: Array.isArray(user.company_id) ? user.company_id[0] : user.company_id || 1,
                  company_name: Array.isArray(user.company_id) ? user.company_id[1] : 'Default Company',
                  database: database
                }
              });
            } else {
              // Fallback if user data is empty
              resolve({
                success: true,
                sessionId: `${uid}:${apiKey}`,
                userInfo: {
                  uid: uid,
                  name: username,
                  login: username,
                  company_id: 1,
                  company_name: 'Default Company',
                  database: database
                }
              });
            }
          });
        });

      } catch (error) {
        console.error('❌ Odoo XML-RPC authentication failed:', error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown authentication error'
        });
      }
    });
  }

  /**
   * Sync Odoo data to company analytics schema using API key authentication
   */
  async syncDataToSchema(companyId: number): Promise<OdooSyncResult> {
    try {
      console.log(`🔄 Starting Odoo API key sync for company ${companyId}`);
      
      // Get stored API key credentials from database
      const storage = (await import('../storage.js')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const odooSource = dataSources.find(ds => ds.type === 'odoo');
      
      if (!odooSource || !odooSource.config) {
        throw new Error('No Odoo API key credentials found for this company');
      }

      const config = typeof odooSource.config === 'string' 
        ? JSON.parse(odooSource.config) 
        : odooSource.config;
      
      const { odooInstanceUrl, odooDatabase, odooUsername, odooApiKey, userInfo } = config;
      
      if (!odooApiKey || !odooInstanceUrl || !odooDatabase || !odooUsername) {
        throw new Error('Invalid Odoo API key configuration');
      }

      console.log(`🔗 Using Odoo instance: ${odooInstanceUrl}, Database: ${odooDatabase}`);

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Test authentication first
      const authResult = await this.authenticate(odooInstanceUrl, odooDatabase, odooUsername, odooApiKey);
      if (!authResult.success) {
        throw new Error(`Authentication failed: ${authResult.error}`);
      }

      const uid = authResult.userInfo?.uid;
      if (!uid) {
        throw new Error('Failed to get user ID from authentication');
      }

      // Fetch and sync sales orders
      console.log('💰 Fetching Odoo sales orders...');
      const salesOrders = await this.fetchSalesOrders(odooInstanceUrl, odooDatabase, uid, odooApiKey, 500);
      if (salesOrders.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'odoo_sales_orders', salesOrders, 'odoo_api');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_odoo_sales_orders');
        console.log(`✅ Synced ${recordsLoaded} sales orders`);
      }

      // Fetch and sync invoices
      console.log('🧾 Fetching Odoo invoices...');
      try {
        const invoices = await this.fetchInvoices(odooInstanceUrl, odooDatabase, uid, odooApiKey, 500);
        console.log(`📊 Retrieved ${invoices.length} invoices from Odoo`);
        if (invoices.length > 0) {
          const recordsLoaded = await this.insertDataToSchema(companyId, 'odoo_invoices', invoices, 'odoo_api');
          totalRecords += recordsLoaded;
          tablesCreated.push('raw_odoo_invoices');
          console.log(`✅ Synced ${recordsLoaded} invoices`);
        } else {
          console.log(`⚠️ No invoices found in Odoo instance`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch invoices:', error.message);
      }

      // Fetch and sync customers
      console.log('👥 Fetching Odoo customers...');
      try {
        const customers = await this.fetchCustomers(odooInstanceUrl, odooDatabase, uid, odooApiKey, 500);
        console.log(`📊 Retrieved ${customers.length} customers from Odoo`);
        if (customers.length > 0) {
          const recordsLoaded = await this.insertDataToSchema(companyId, 'odoo_customers', customers, 'odoo_api');
          totalRecords += recordsLoaded;
          tablesCreated.push('raw_odoo_customers');
          console.log(`✅ Synced ${recordsLoaded} customers`);
        } else {
          console.log(`⚠️ No customers found in Odoo instance`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch customers:', error.message);
      }

      // Fetch and sync products
      console.log('📦 Fetching Odoo products...');
      try {
        const products = await this.fetchProducts(odooInstanceUrl, odooDatabase, uid, odooApiKey, 500);
        console.log(`📊 Retrieved ${products.length} products from Odoo`);
        if (products.length > 0) {
          const recordsLoaded = await this.insertDataToSchema(companyId, 'odoo_products', products, 'odoo_api');
          totalRecords += recordsLoaded;
          tablesCreated.push('raw_odoo_products');
          console.log(`✅ Synced ${recordsLoaded} products`);
        } else {
          console.log(`⚠️ No products found in Odoo instance`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch products:', error.message);
      }

      // Run automatic dbt-style transformations (now available through inheritance)
      console.log('🔄 Running dbt-style transformations...');
      const postgres = (await import('postgres')).default;
      const sql = postgres(process.env.DATABASE_URL!);
      
      try {
        await this.runTransformations(companyId, sql);
        console.log('✅ Transformations completed successfully');
      } catch (transformError) {
        console.error('❌ Transformation failed:', transformError);
        // Continue with sync even if transformations fail
      } finally {
        await sql.end();
      }

      console.log(`🎉 Odoo API sync completed: ${totalRecords} total records across ${tablesCreated.length} tables`);

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ Odoo API sync failed:', error);
      return {
        success: false,
        recordsSynced: 0,
        tablesCreated: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Helper method to make XML-RPC calls with HTTP fallback
   */
  private async makeXmlRpcCallWithFallback(
    instanceUrl: string, 
    database: string, 
    uid: number, 
    apiKey: string, 
    model: string, 
    method: string, 
    domain: any[], 
    options: any
  ): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const tryRequest = (url: string) => {
        console.log(`🔍 Trying XML-RPC data fetch: ${url}`);
        
        const parsedUrl = new URL(url);
        const clientOptions = {
          host: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: '/xmlrpc/2/object',
          secure: parsedUrl.protocol === 'https:'
        };

        const client = xmlrpc.createClient(clientOptions);
        
        client.methodCall('execute_kw', [
          database, uid, apiKey, model, method, [domain], options
        ], (error: any, result: any[]) => {
          if (error) {
            // Check if this is the HTML response error
            if (error.message && error.message.includes("Unknown XML-RPC tag 'TITLE'")) {
              console.log('🔄 Detected HTML response for data fetch, trying HTTP fallback...');
              
              // Try HTTP if we tried HTTPS first
              if (parsedUrl.protocol === 'https:') {
                const httpUrl = url.replace('https://', 'http://');
                console.log(`🔄 Retrying data fetch with HTTP: ${httpUrl}`);
                tryRequest(httpUrl);
                return;
              }
            }
            
            console.error(`Failed to fetch ${model} data:`, error);
            reject(new Error(`Odoo API error: ${error.message || error}`));
            return;
          }
          
          resolve(result || []);
        });
      };

      tryRequest(instanceUrl);
    });
  }

  /**
   * Fetch sales orders from Odoo using XML-RPC with HTTP fallback
   */
  async fetchSalesOrders(instanceUrl: string, database: string, uid: number, apiKey: string, limit: number = 100): Promise<any[]> {
    try {
      console.log(`💰 Fetching Odoo sales orders with HTTP fallback...`);
      
      return await this.makeXmlRpcCallWithFallback(
        instanceUrl,
        database,
        uid,
        apiKey,
        'sale.order',
        'search_read',
        [['state', 'in', ['sale', 'done']]], // Only confirmed orders
        {
          'fields': ['name', 'partner_id', 'date_order', 'state', 'amount_total', 'amount_untaxed', 'currency_id', 'user_id', 'create_date', 'write_date'],
          'limit': limit
        }
      );
    } catch (error) {
      console.error('Failed to fetch Odoo sales orders:', error);
      throw error;
    }
  }

  /**
   * Fetch invoices from Odoo using XML-RPC with HTTP fallback
   */
  async fetchInvoices(instanceUrl: string, database: string, uid: number, apiKey: string, limit: number = 100): Promise<any[]> {
    try {
      console.log(`🧾 Fetching Odoo invoices with HTTP fallback...`);
      
      return await this.makeXmlRpcCallWithFallback(
        instanceUrl,
        database,
        uid,
        apiKey,
        'account.move',
        'search_read',
        [], // Fetch all invoices (remove restrictive filter)
        {
          'fields': ['id', 'name', 'partner_id', 'invoice_date', 'state', 'move_type', 'amount_total', 'amount_untaxed', 'amount_residual', 'currency_id', 'create_date', 'write_date'],
          'limit': limit
        }
      );
    } catch (error) {
      console.error('Failed to fetch Odoo invoices:', error);
      throw error;
    }
  }

  /**
   * Fetch customers from Odoo using XML-RPC with HTTP fallback
   */
  async fetchCustomers(instanceUrl: string, database: string, uid: number, apiKey: string, limit: number = 100): Promise<any[]> {
    try {
      console.log(`👥 Fetching Odoo customers with HTTP fallback...`);
      
      return await this.makeXmlRpcCallWithFallback(
        instanceUrl,
        database,
        uid,
        apiKey,
        'res.partner',
        'search_read',
        [], // Fetch all contacts/partners (remove restrictive filter)
        {
          'fields': ['name', 'email', 'phone', 'is_company', 'customer_rank', 'country_id', 'city', 'street', 'website', 'create_date', 'write_date'],
          'limit': limit
        }
      );
    } catch (error) {
      console.error('Failed to fetch Odoo customers:', error);
      throw error;
    }
  }

  /**
   * Fetch products from Odoo using XML-RPC with HTTP fallback
   */
  async fetchProducts(instanceUrl: string, database: string, uid: number, apiKey: string, limit: number = 100): Promise<any[]> {
    try {
      console.log(`📦 Fetching Odoo products with HTTP fallback...`);
      
      return await this.makeXmlRpcCallWithFallback(
        instanceUrl,
        database,
        uid,
        apiKey,
        'product.product',
        'search_read',
        [], // Fetch all products (remove restrictive filter)
        {
          'fields': ['id', 'name', 'default_code', 'list_price', 'standard_price', 'categ_id', 'active', 'create_date', 'write_date'],
          'limit': limit
        }
      );
    } catch (error) {
      console.error('Failed to fetch Odoo products:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for Odoo data (raw → stg → int → core)
   * Only transforms data for tables that actually exist in RAW layer
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
      const hasOrders = tableNames.includes('raw_odoo_sales_orders');
      const hasCustomers = tableNames.includes('raw_odoo_customers');
      const hasInvoices = tableNames.includes('raw_odoo_invoices');
      const hasProducts = tableNames.includes('raw_odoo_products');
      
      console.log('📊 Found RAW tables:', {
        sales_orders: hasOrders,
        customers: hasCustomers, 
        invoices: hasInvoices,
        products: hasProducts
      });
      
      if (!hasOrders && !hasCustomers && !hasInvoices && !hasProducts) {
        console.log('⚠️ No Odoo RAW tables found, skipping transformations');
        return;
      }
      
      console.log('🧹 Cleaning up existing Odoo transformation objects...');
      
      // Drop views first (they depend on tables)
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_odoo_sales_orders`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_odoo_customers`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_odoo_invoices`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_odoo_products`;
      
      // Drop tables in reverse dependency order
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_odoo_sales_orders`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_odoo_customers`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_odoo_invoices`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_odoo_products`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_odoo_sales_orders`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_odoo_customers`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_odoo_invoices`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_odoo_products`;
      
      console.log('📋 Creating Odoo staging tables (stg)...');
      
      // STG: odoo_sales_orders - only if RAW table exists
      if (hasOrders) {
        console.log('  ✅ Creating stg_odoo_sales_orders');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_odoo_sales_orders AS
          SELECT DISTINCT 
            data->>'id' as sales_order_id,
            data->>'name' as order_name,
            data#>>'{partner_id,1}' as customer_name,
            (data->>'partner_id')::text::integer as customer_id,
            (data->>'date_order')::timestamp as order_date,
            data->>'state' as order_state,
            COALESCE((data->>'amount_total')::numeric, 0) as amount_total,
            COALESCE((data->>'amount_untaxed')::numeric, 0) as amount_untaxed,
            data#>>'{currency_id,1}' as currency,
            data#>>'{user_id,1}' as salesperson,
            (data->>'create_date')::timestamp as created_at,
            (data->>'write_date')::timestamp as updated_at
          FROM ${sql(schema)}.raw_odoo_sales_orders
          WHERE data IS NOT NULL
        `;
      }
      
      // STG: odoo_customers - only if RAW table exists
      if (hasCustomers) {
        console.log('  ✅ Creating stg_odoo_customers');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_odoo_customers AS
          SELECT DISTINCT
            data->>'id' as customer_id,
            data->>'name' as customer_name,
            data->>'email' as email,
            data->>'phone' as phone,
            CASE WHEN data->>'is_company' = 'true' THEN true ELSE false END as is_company,
            COALESCE((data->>'customer_rank')::integer, 0) as customer_rank,
            data#>>'{country_id,1}' as country,
            data->>'city' as city,
            data->>'street' as street,
            data->>'website' as website,
            (data->>'create_date')::timestamp as created_at,
            (data->>'write_date')::timestamp as updated_at
          FROM ${sql(schema)}.raw_odoo_customers
          WHERE data IS NOT NULL
        `;
      }
      
      // STG: odoo_invoices - only if RAW table exists
      if (hasInvoices) {
        console.log('  ✅ Creating stg_odoo_invoices');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_odoo_invoices AS  
          SELECT DISTINCT
            data->>'id' as invoice_id,
            data->>'name' as invoice_name,
            data#>>'{partner_id,1}' as customer_name,
            (data->>'partner_id')::text::integer as customer_id,
            (data->>'invoice_date')::timestamp as invoice_date,
            data->>'state' as invoice_state,
            data->>'move_type' as move_type,
            COALESCE((data->>'amount_total')::numeric, 0) as amount_total,
            COALESCE((data->>'amount_untaxed')::numeric, 0) as amount_untaxed,
            COALESCE((data->>'amount_residual')::numeric, 0) as amount_residual,
            data#>>'{currency_id,1}' as currency,
            (data->>'create_date')::timestamp as created_at,
            (data->>'write_date')::timestamp as updated_at
          FROM ${sql(schema)}.raw_odoo_invoices
          WHERE data IS NOT NULL
        `;
      }
      
      // STG: odoo_products - only if RAW table exists
      if (hasProducts) {
        console.log('  ✅ Creating stg_odoo_products');
        await sql`
          CREATE TABLE ${sql(schema)}.stg_odoo_products AS  
          SELECT DISTINCT
            data->>'id' as product_id,
            data->>'name' as product_name,
            data->>'default_code' as product_code,
            COALESCE((data->>'list_price')::numeric, 0) as list_price,
            COALESCE((data->>'standard_price')::numeric, 0) as standard_price,
            data#>>'{categ_id,1}' as category_name,
            CASE WHEN data->>'active' = 'true' THEN true ELSE false END as is_active,
            (data->>'create_date')::timestamp as created_at,
            (data->>'write_date')::timestamp as updated_at
          FROM ${sql(schema)}.raw_odoo_products
          WHERE data IS NOT NULL
        `;
      }
      
      console.log('🔗 Creating Odoo integration tables (int)...');
      
      // INT: odoo_sales_orders - only if STG table was created
      if (hasOrders) {
        console.log('  ✅ Creating int_odoo_sales_orders');
        await sql`
          CREATE TABLE ${sql(schema)}.int_odoo_sales_orders AS
          SELECT 
            sales_order_id,
            order_name,
            customer_name,
            customer_id,
            order_date,
            order_state,
            amount_total,
            amount_untaxed,
            currency,
            salesperson,
            created_at,
            updated_at,
            -- Calculated fields
            CASE 
              WHEN order_state = 'done' THEN 'Completed'
              WHEN order_state = 'sale' THEN 'Confirmed'
              WHEN order_state = 'draft' THEN 'Draft'
              WHEN order_state = 'cancel' THEN 'Cancelled'
              ELSE 'Other'
            END as order_status_category,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - order_date))/86400 as days_since_order,
            CASE 
              WHEN amount_total > 10000 THEN 'Large'
              WHEN amount_total > 1000 THEN 'Medium'
              ELSE 'Small'
            END as order_size
          FROM ${sql(schema)}.stg_odoo_sales_orders
        `;
      }
      
      // INT: odoo_customers - only if STG table was created
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
              WHEN email IS NOT NULL THEN true 
              ELSE false 
            END as has_email,
            CASE 
              WHEN phone IS NOT NULL THEN true 
              ELSE false 
            END as has_phone,
            EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/86400 as days_since_created
          FROM ${sql(schema)}.stg_odoo_customers
        `;
      }
      
      // INT: odoo_invoices - only if STG table was created
      if (hasInvoices) {
        console.log('  ✅ Creating int_odoo_invoices');
        await sql`
          CREATE TABLE ${sql(schema)}.int_odoo_invoices AS
          SELECT 
            invoice_id,
            invoice_name,
            customer_name,
            customer_id,
            invoice_date,
            invoice_state,
            move_type,
            amount_total,
            amount_untaxed,
            amount_residual,
            currency,
            created_at,
            updated_at,
            -- Calculated fields
            CASE 
              WHEN invoice_state = 'posted' THEN 'Posted'
              WHEN invoice_state = 'draft' THEN 'Draft'
              WHEN invoice_state = 'cancel' THEN 'Cancelled'
              ELSE 'Other'
            END as invoice_status_category,
            CASE 
              WHEN amount_residual > 0 THEN 'Outstanding'
              ELSE 'Paid'
            END as payment_status,
            CASE 
              WHEN amount_total > 5000 THEN 'Large'
              WHEN amount_total > 500 THEN 'Medium'
              ELSE 'Small'
            END as invoice_size
          FROM ${sql(schema)}.stg_odoo_invoices
        `;
      }
      
      // INT: odoo_products - only if STG table was created
      if (hasProducts) {
        console.log('  ✅ Creating int_odoo_products');
        await sql`
          CREATE TABLE ${sql(schema)}.int_odoo_products AS
          SELECT 
            product_id,
            product_name,
            product_code,
            list_price,
            standard_price,
            category_name,
            is_active,
            created_at,
            updated_at,
            -- Calculated fields
            CASE 
              WHEN list_price > 1000 THEN 'Premium'
              WHEN list_price > 100 THEN 'Standard'
              ELSE 'Budget'
            END as price_category,
            (list_price - standard_price) as profit_margin,
            CASE 
              WHEN is_active THEN 'Active'
              ELSE 'Inactive'
            END as product_status
          FROM ${sql(schema)}.stg_odoo_products
        `;
      }
      
      console.log('👁️ Creating Odoo core views...');
      
      // CORE: Views that mirror int tables (only for existing tables)
      if (hasOrders) {
        console.log('  ✅ Creating core_odoo_sales_orders view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_odoo_sales_orders AS 
          SELECT * FROM ${sql(schema)}.int_odoo_sales_orders
        `;
      }
      
      if (hasCustomers) {
        console.log('  ✅ Creating core_odoo_customers view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_odoo_customers AS
          SELECT * FROM ${sql(schema)}.int_odoo_customers  
        `;
      }
      
      if (hasInvoices) {
        console.log('  ✅ Creating core_odoo_invoices view');
        await sql`
          CREATE VIEW ${sql(schema)}.core_odoo_invoices AS
          SELECT * FROM ${sql(schema)}.int_odoo_invoices
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
      if (hasOrders) createdLayers.push('sales_orders');
      if (hasCustomers) createdLayers.push('customers');
      if (hasInvoices) createdLayers.push('invoices');
      if (hasProducts) createdLayers.push('products');
      
      console.log(`✅ Odoo transformation pipeline completed (raw → stg → int → core) for: ${createdLayers.join(', ')}`);
      
    } catch (error) {
      console.error('❌ Odoo transformation pipeline failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const odooApiService = new OdooApiService();