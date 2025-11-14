/**
 * QuickBooks OAuth2 integration service extending base OAuth class
 */

import { OAuthServiceBase } from './oauth-base.js';
import { 
  TokenResponse, 
  SyncResult, 
  TableDiscoveryResult,
  OAuthError 
} from './oauth-types.js';

interface QuickBooksUserInfo {
  companyId: string;
  companyName: string;
  email: string;
  givenName: string;
  familyName: string;
}

export class QuickBooksOAuthService extends OAuthServiceBase {
  
  constructor() {
    super();
  }

  /**
   * Get service type identifier
   */
  getServiceType(): string {
    return 'quickbooks';
  }

  /**
   * Generate authorization URL with company context
   */
  getAuthorizationUrl(companyId: number, userId?: number): string {
    const state = this.generateState(companyId, userId);
    
    // QuickBooks OAuth scopes for accounting and financial data
    const scopes = [
      'com.intuit.quickbooks.accounting', // Full accounting access
      'com.intuit.quickbooks.payment',    // Payment processing (optional)
      'openid',                          // OpenID for user info
      'profile',                         // User profile information
      'email',                           // Email address
      'phone',                           // Phone number
      'address'                          // Address information
    ];
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: scopes.join(' '),
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      state,
      access_type: 'offline' // Ensures we get a refresh token
    });

    // Use sandbox URL for development, production URL for live
    const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true' 
      ? 'https://sandbox.appcenter.intuit.com'
      : 'https://appcenter.intuit.com';

    return `${baseUrl}/connect/oauth2?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<TokenResponse> {
    try {
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.config.redirectUri
      });

      // QuickBooks uses Basic Auth for token exchange
      const authHeader = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true'
        ? 'https://sandbox-oauth.api.intuit.com'
        : 'https://oauth.platform.intuit.com';

      const response = await fetch(`${baseUrl}/oauth2/v1/tokens/bearer`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
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
        expires_in: tokenData.expires_in || 3600, // QuickBooks tokens typically expire in 1 hour
        token_type: tokenData.token_type || 'bearer',
        x_refresh_token_expires_in: tokenData.x_refresh_token_expires_in, // Refresh token expiry (100 days)
        realmId: tokenData.realmId // Company ID in QuickBooks
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get user and company info from QuickBooks
   */
  async getUserInfo(accessToken: string, realmId: string): Promise<QuickBooksUserInfo> {
    try {
      const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';

      const response = await fetch(`${baseUrl}/v3/company/${realmId}/companyinfo/${realmId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get company info: ${response.statusText}`);
      }

      const data = await response.json();
      const companyInfo = data.CompanyInfo;

      return {
        companyId: realmId,
        companyName: companyInfo.CompanyName,
        email: companyInfo.Email?.Address || '',
        givenName: companyInfo.CompanyAddr?.ContactName || '',
        familyName: ''
      };
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
      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });

      const authHeader = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');

      const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true'
        ? 'https://sandbox-oauth.api.intuit.com'
        : 'https://oauth.platform.intuit.com';

      const response = await fetch(`${baseUrl}/oauth2/v1/tokens/bearer`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
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
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 3600,
        token_type: tokenData.token_type || 'bearer',
        x_refresh_token_expires_in: tokenData.x_refresh_token_expires_in,
        realmId: tokenData.realmId
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string, realmId: string): Promise<boolean> {
    try {
      const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';

      const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=SELECT * FROM Customer MAXRESULTS 1`, {
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
  async discoverTables(accessToken: string, realmId?: string): Promise<TableDiscoveryResult[]> {
    if (!realmId) {
      throw new Error('Realm ID required for QuickBooks table discovery');
    }
    return this.discoverQuickBooksTables(accessToken, realmId);
  }

  /**
   * Discover available QuickBooks entities
   */
  async discoverQuickBooksTables(accessToken: string, realmId: string): Promise<TableDiscoveryResult[]> {
    try {
      const tables = [];

      // Core QuickBooks entities available in all plans
      const coreEntities = [
        { name: 'Customer', label: 'Customers', fields: ['DisplayName', 'PrimaryEmailAddr', 'PrimaryPhone', 'Balance'] },
        { name: 'Invoice', label: 'Invoices', fields: ['DocNumber', 'TxnDate', 'DueDate', 'TotalAmt', 'Balance'] },
        { name: 'Payment', label: 'Payments', fields: ['TxnDate', 'TotalAmt', 'CustomerRef', 'PaymentMethodRef'] },
        { name: 'Estimate', label: 'Estimates', fields: ['DocNumber', 'TxnDate', 'ExpirationDate', 'TotalAmt'] },
        { name: 'SalesReceipt', label: 'Sales Receipts', fields: ['DocNumber', 'TxnDate', 'TotalAmt', 'CustomerRef'] },
        { name: 'RefundReceipt', label: 'Refund Receipts', fields: ['DocNumber', 'TxnDate', 'TotalAmt', 'CustomerRef'] },
        { name: 'CreditMemo', label: 'Credit Memos', fields: ['DocNumber', 'TxnDate', 'TotalAmt', 'CustomerRef'] },
        { name: 'Bill', label: 'Bills', fields: ['DocNumber', 'TxnDate', 'DueDate', 'TotalAmt', 'Balance'] },
        { name: 'Vendor', label: 'Vendors', fields: ['DisplayName', 'PrimaryEmailAddr', 'PrimaryPhone', 'Balance'] },
        { name: 'Purchase', label: 'Purchases', fields: ['TxnDate', 'TotalAmt', 'AccountRef', 'PaymentType'] },
        { name: 'PurchaseOrder', label: 'Purchase Orders', fields: ['DocNumber', 'TxnDate', 'TotalAmt', 'VendorRef'] },
        { name: 'BillPayment', label: 'Bill Payments', fields: ['TxnDate', 'TotalAmt', 'VendorRef', 'PayType'] },
        { name: 'VendorCredit', label: 'Vendor Credits', fields: ['DocNumber', 'TxnDate', 'TotalAmt', 'VendorRef'] },
        { name: 'TimeActivity', label: 'Time Activities', fields: ['TxnDate', 'StartTime', 'EndTime', 'Hours', 'Minutes'] },
        { name: 'Employee', label: 'Employees', fields: ['DisplayName', 'PrimaryEmailAddr', 'PrimaryPhone', 'SSN'] },
        { name: 'Item', label: 'Products/Services', fields: ['Name', 'Type', 'UnitPrice', 'QtyOnHand'] },
        { name: 'Account', label: 'Chart of Accounts', fields: ['Name', 'AccountType', 'AccountSubType', 'CurrentBalance'] },
        { name: 'Department', label: 'Departments', fields: ['Name', 'SubDepartment', 'Active'] },
        { name: 'Class', label: 'Classes', fields: ['Name', 'SubClass', 'Active'] },
        { name: 'JournalEntry', label: 'Journal Entries', fields: ['DocNumber', 'TxnDate', 'TotalAmt', 'Adjustment'] },
        { name: 'Deposit', label: 'Deposits', fields: ['TxnDate', 'TotalAmt', 'DepositToAccountRef'] },
        { name: 'Transfer', label: 'Transfers', fields: ['TxnDate', 'Amount', 'FromAccountRef', 'ToAccountRef'] },
        { name: 'TaxRate', label: 'Tax Rates', fields: ['Name', 'RateValue', 'AgencyRef'] },
        { name: 'Term', label: 'Payment Terms', fields: ['Name', 'DueDays', 'DiscountPercent'] },
        { name: 'PaymentMethod', label: 'Payment Methods', fields: ['Name', 'Type', 'Active'] },
        { name: 'CompanyInfo', label: 'Company Information', fields: ['CompanyName', 'LegalName', 'Country', 'Email'] },
        { name: 'Budget', label: 'Budgets', fields: ['Name', 'StartDate', 'EndDate', 'Active'] }
      ];

      // Test access to each entity
      const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';

      for (const entity of coreEntities) {
        try {
          const query = `SELECT * FROM ${entity.name} MAXRESULTS 1`;
          const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          if (response.ok) {
            tables.push({
              name: entity.name.toLowerCase(),
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
      console.error('Failed to discover QuickBooks tables:', error);
      return [];
    }
  }

  /**
   * Fetch QuickBooks customers
   */
  async fetchCustomers(accessToken: string, realmId: string, limit: number = 100): Promise<any[]> {
    try {
      const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';

      const query = `SELECT * FROM Customer MAXRESULTS ${limit}`;
      const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch customers: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.QueryResponse?.Customer || [];
    } catch (error) {
      console.error('Failed to fetch QuickBooks customers:', error);
      throw error;
    }
  }

  /**
   * Fetch QuickBooks invoices
   */
  async fetchInvoices(accessToken: string, realmId: string, limit: number = 100): Promise<any[]> {
    try {
      const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';

      const query = `SELECT * FROM Invoice ORDERBY TxnDate DESC MAXRESULTS ${limit}`;
      const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch invoices: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.QueryResponse?.Invoice || [];
    } catch (error) {
      console.error('Failed to fetch QuickBooks invoices:', error);
      throw error;
    }
  }

  /**
   * Fetch QuickBooks accounts (Chart of Accounts)
   */
  async fetchAccounts(accessToken: string, realmId: string): Promise<any[]> {
    try {
      const baseUrl = process.env.QUICKBOOKS_SANDBOX === 'true'
        ? 'https://sandbox-quickbooks.api.intuit.com'
        : 'https://quickbooks.api.intuit.com';

      const query = `SELECT * FROM Account ORDERBY Name`;
      const response = await fetch(`${baseUrl}/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch accounts: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.QueryResponse?.Account || [];
    } catch (error) {
      console.error('Failed to fetch QuickBooks accounts:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for QuickBooks data (raw → stg → int → core)
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;
    
    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
      
      console.log('🧹 Cleaning up existing transformation objects...');
      // Drop views first (they depend on tables)
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_quickbooks_customers`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_quickbooks_invoices`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_quickbooks_accounts`;
      
      // Drop tables in reverse dependency order
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_quickbooks_accounts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_quickbooks_invoices`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_quickbooks_customers`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_quickbooks_accounts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_quickbooks_invoices`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_quickbooks_customers`;
      
      console.log('📋 Creating staging tables (stg)...');
      
      // STG: quickbooks_customers - normalized and cleaned
      await sql`
        CREATE TABLE ${sql(schema)}.stg_quickbooks_customers AS
        SELECT DISTINCT 
          (data #>> '{}')::jsonb->>'Id' as customer_id,
          (data #>> '{}')::jsonb->>'DisplayName' as display_name,
          (data #>> '{}')::jsonb->>'CompanyName' as company_name,
          (data #>> '{}')::jsonb#>>'{PrimaryEmailAddr,Address}' as email,
          (data #>> '{}')::jsonb#>>'{PrimaryPhone,FreeFormNumber}' as phone,
          COALESCE(((data #>> '{}')::jsonb->>'Balance')::numeric, 0) as balance,
          (data #>> '{}')::jsonb->>'Active' = 'true' as is_active,
          (data #>> '{}')::jsonb->>'Taxable' = 'true' as is_taxable,
          ((data #>> '{}')::jsonb#>>'{MetaData,CreateTime}')::timestamp as created_at,
          ((data #>> '{}')::jsonb#>>'{MetaData,LastUpdatedTime}')::timestamp as updated_at,
          (data #>> '{}')::jsonb#>>'{BillAddr,City}' as billing_city,
          (data #>> '{}')::jsonb#>>'{BillAddr,CountrySubDivisionCode}' as billing_state,
          (data #>> '{}')::jsonb#>>'{BillAddr,Country}' as billing_country
        FROM ${sql(schema)}.raw_quickbooks_customers
        WHERE data IS NOT NULL
      `;
      
      // STG: quickbooks_invoices - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_quickbooks_invoices AS
        SELECT DISTINCT
          (data #>> '{}')::jsonb->>'Id' as invoice_id,
          (data #>> '{}')::jsonb->>'DocNumber' as doc_number,
          ((data #>> '{}')::jsonb->>'TxnDate')::date as transaction_date,
          ((data #>> '{}')::jsonb->>'DueDate')::date as due_date,
          COALESCE(((data #>> '{}')::jsonb->>'TotalAmt')::numeric, 0) as total_amount,
          COALESCE(((data #>> '{}')::jsonb->>'Balance')::numeric, 0) as balance,
          (data #>> '{}')::jsonb#>>'{CustomerRef,value}' as customer_id,
          (data #>> '{}')::jsonb#>>'{CustomerRef,name}' as customer_name,
          (data #>> '{}')::jsonb->>'PrivateNote' as private_note,
          (data #>> '{}')::jsonb#>>'{EmailStatus}' as email_status,
          ((data #>> '{}')::jsonb#>>'{MetaData,CreateTime}')::timestamp as created_at,
          ((data #>> '{}')::jsonb#>>'{MetaData,LastUpdatedTime}')::timestamp as updated_at
        FROM ${sql(schema)}.raw_quickbooks_invoices
        WHERE data IS NOT NULL
      `;
      
      // STG: quickbooks_accounts - Chart of Accounts
      await sql`
        CREATE TABLE ${sql(schema)}.stg_quickbooks_accounts AS  
        SELECT DISTINCT
          (data #>> '{}')::jsonb->>'Id' as account_id,
          (data #>> '{}')::jsonb->>'Name' as account_name,
          (data #>> '{}')::jsonb->>'FullyQualifiedName' as fully_qualified_name,
          (data #>> '{}')::jsonb->>'AccountType' as account_type,
          (data #>> '{}')::jsonb->>'AccountSubType' as account_sub_type,
          COALESCE(((data #>> '{}')::jsonb->>'CurrentBalance')::numeric, 0) as current_balance,
          (data #>> '{}')::jsonb->>'Classification' as classification,
          (data #>> '{}')::jsonb->>'Active' = 'true' as is_active,
          (data #>> '{}')::jsonb->>'SubAccount' = 'true' as is_sub_account,
          (data #>> '{}')::jsonb#>>'{ParentRef,value}' as parent_account_id,
          ((data #>> '{}')::jsonb#>>'{MetaData,CreateTime}')::timestamp as created_at
        FROM ${sql(schema)}.raw_quickbooks_accounts
        WHERE data IS NOT NULL
      `;
      
      console.log('🔗 Creating integration tables (int)...');
      
      // INT: quickbooks_customers - enriched customer data with calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_quickbooks_customers AS
        SELECT 
          customer_id,
          display_name,
          company_name,
          email,
          phone,
          balance,
          is_active,
          is_taxable,
          billing_city,
          billing_state,
          billing_country,
          created_at,
          updated_at,
          -- Calculated fields
          CASE 
            WHEN balance > 10000 THEN 'High'
            WHEN balance > 1000 THEN 'Medium'
            WHEN balance > 0 THEN 'Low'
            ELSE 'None'
          END as balance_category,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/86400 as days_since_created,
          CONCAT(COALESCE(billing_city, ''), ', ', COALESCE(billing_state, ''), ', ', COALESCE(billing_country, '')) as full_address,
          CASE 
            WHEN email IS NOT NULL THEN true 
            ELSE false 
          END as has_email
        FROM ${sql(schema)}.stg_quickbooks_customers
      `;
      
      // INT: quickbooks_invoices - enriched invoice data
      await sql`
        CREATE TABLE ${sql(schema)}.int_quickbooks_invoices AS
        SELECT 
          invoice_id,
          doc_number,
          transaction_date,
          due_date,
          total_amount,
          balance,
          customer_id,
          customer_name,
          private_note,
          email_status,
          created_at,
          updated_at,
          -- Calculated fields
          CASE 
            WHEN balance = 0 THEN 'Paid'
            WHEN balance = total_amount THEN 'Unpaid'
            ELSE 'Partially Paid'
          END as payment_status,
          total_amount - balance as paid_amount,
          CASE 
            WHEN balance > 0 AND due_date < CURRENT_DATE THEN 'Overdue'
            WHEN balance > 0 AND due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'Due Soon'
            WHEN balance > 0 THEN 'Open'
            ELSE 'Paid'
          END as invoice_status,
          EXTRACT(EPOCH FROM (due_date - transaction_date))/86400 as payment_terms_days,
          CASE 
            WHEN due_date < CURRENT_DATE THEN EXTRACT(EPOCH FROM (CURRENT_DATE - due_date))/86400
            ELSE 0
          END as days_overdue
        FROM ${sql(schema)}.stg_quickbooks_invoices
      `;
      
      // INT: quickbooks_accounts - enriched with calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_quickbooks_accounts AS
        SELECT 
          account_id,
          account_name,
          fully_qualified_name,
          account_type,
          account_sub_type,
          current_balance,
          classification,
          is_active,
          is_sub_account,
          parent_account_id,
          created_at,
          -- Calculated fields
          CASE classification
            WHEN 'Asset' THEN 'Balance Sheet'
            WHEN 'Liability' THEN 'Balance Sheet'
            WHEN 'Equity' THEN 'Balance Sheet'
            WHEN 'Revenue' THEN 'Income Statement'
            WHEN 'Expense' THEN 'Income Statement'
            ELSE 'Other'
          END as financial_statement,
          CASE 
            WHEN account_type IN ('Bank', 'OtherCurrentAsset') THEN 'Current Asset'
            WHEN account_type IN ('AccountsReceivable') THEN 'Current Asset'
            WHEN account_type IN ('FixedAsset') THEN 'Non-Current Asset'
            WHEN account_type IN ('AccountsPayable', 'CreditCard') THEN 'Current Liability'
            WHEN account_type IN ('LongTermLiability') THEN 'Non-Current Liability'
            WHEN account_type = 'Equity' THEN 'Equity'
            WHEN account_type = 'Income' THEN 'Revenue'
            WHEN account_type IN ('CostOfGoodsSold', 'Expense') THEN 'Expense'
            ELSE 'Other'
          END as account_category
        FROM ${sql(schema)}.stg_quickbooks_accounts
      `;
      
      console.log('👁️ Creating core views...');
      
      // CORE: Views that mirror int tables (no aggregation)
      await sql`
        CREATE VIEW ${sql(schema)}.core_quickbooks_customers AS 
        SELECT * FROM ${sql(schema)}.int_quickbooks_customers
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_quickbooks_invoices AS
        SELECT * FROM ${sql(schema)}.int_quickbooks_invoices  
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_quickbooks_accounts AS
        SELECT * FROM ${sql(schema)}.int_quickbooks_accounts
      `;
      
      console.log('✅ Transformation pipeline completed (raw → stg → int → core)');
      
    } catch (error) {
      console.error('❌ Transformation pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Sync QuickBooks data to company analytics schema using stored OAuth tokens
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

      console.log(`🔄 Starting QuickBooks OAuth sync for company ${companyId}`);
      
      // Get stored OAuth tokens from database
      const storage = (await import('../storage')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const quickbooksSource = dataSources.find(ds => ds.type === 'quickbooks');
      
      if (!quickbooksSource || !quickbooksSource.config) {
        throw new Error('No QuickBooks OAuth tokens found for this company');
      }

      const config = typeof quickbooksSource.config === 'string' 
        ? JSON.parse(quickbooksSource.config) 
        : quickbooksSource.config;
      const { accessToken, realmId } = config;
      
      if (!accessToken || !realmId) {
        throw new Error('Invalid OAuth configuration - missing access token or realm ID');
      }
      
      console.log(`🔗 Using QuickBooks company: ${realmId}`);

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Fetch and sync customers with automatic token refresh
      console.log('👥 Fetching QuickBooks customers...');
      const customers = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchCustomers(token, realmId, 500)
      );
      if (customers.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'quickbooks_customers', customers, 'quickbooks_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_quickbooks_customers');
        console.log(`✅ Synced ${recordsLoaded} customers`);
      }

      // Fetch and sync invoices with automatic token refresh
      console.log('📄 Fetching QuickBooks invoices...');
      const invoices = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchInvoices(token, realmId, 500)
      );
      if (invoices.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'quickbooks_invoices', invoices, 'quickbooks_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_quickbooks_invoices');
        console.log(`✅ Synced ${recordsLoaded} invoices`);
      }

      // Fetch and sync accounts (Chart of Accounts) with automatic token refresh
      console.log('📊 Fetching QuickBooks Chart of Accounts...');
      const accounts = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchAccounts(token, realmId)
      );
      if (accounts.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'quickbooks_accounts', accounts, 'quickbooks_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_quickbooks_accounts');
        console.log(`✅ Synced ${recordsLoaded} accounts`);
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

      console.log(`🎉 QuickBooks OAuth sync completed: ${totalRecords} total records across ${tablesCreated.length} tables`);

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ QuickBooks OAuth sync failed:', error);
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
export const quickbooksOAuthService = new QuickBooksOAuthService();