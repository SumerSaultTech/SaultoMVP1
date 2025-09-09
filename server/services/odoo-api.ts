/**
 * Odoo XML-RPC API service following official documentation
 */
import xmlrpc from 'xmlrpc';

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

export class OdooApiService {
  
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
   * Insert data into analytics schema using same pattern as HubSpot and Jira
   */
  async insertDataToSchema(companyId: number, tableName: string, data: any[], sourceSystem: string): Promise<number> {
    if (data.length === 0) return 0;

    const postgres = (await import('postgres')).default;
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }
    
    const sql = postgres(databaseUrl);
    
    try {
      const schemaName = `analytics_company_${companyId}`;
      const fullTableName = `${schemaName}.raw_${tableName}`;
      
      console.log(`📊 Inserting ${data.length} ${tableName} records into ${fullTableName}`);
      
      // Create schema if not exists
      await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
      
      // Create table if not exists
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
      const batchSize = 100;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const values = batch.map((item, index) => 
          `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`
        ).join(',');
        
        const params: any[] = [];
        batch.forEach(item => {
          params.push(JSON.stringify(item), sourceSystem, companyId);
        });
        
        await sql.unsafe(
          `INSERT INTO ${fullTableName} (data, source_system, company_id) VALUES ${values}`,
          params
        );
        
        inserted += batch.length;
      }
      
      console.log(`✅ Successfully inserted ${inserted} ${tableName} records`);
      return inserted;
    } catch (error) {
      console.error(`Failed to insert ${tableName} data:`, error);
      throw error;
    } finally {
      await sql.end();
    }
  }
}

// Export singleton instance
export const odooApiService = new OdooApiService();