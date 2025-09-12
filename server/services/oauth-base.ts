/**
 * Base class for OAuth service integrations with automatic token refresh
 */

import {
  OAuthTokens,
  TokenResponse,
  StateData,
  OAuthConfig,
  OAuthServiceConfig,
  DataSourceConfig,
  SyncResult,
  TableDiscoveryResult,
  OAuthError,
  RateLimitConfig,
  SERVICE_CONFIGS
} from './oauth-types.js';

export abstract class OAuthServiceBase {
  protected config: OAuthConfig;
  protected rateLimitConfig: RateLimitConfig;
  private requestQueue: Promise<any> = Promise.resolve();
  private lastRequestTime: number = 0;

  constructor() {
    const serviceType = this.getServiceType();
    const serviceConfig = SERVICE_CONFIGS[serviceType as keyof typeof SERVICE_CONFIGS];
    
    this.config = {
      clientId: process.env[`${serviceType.toUpperCase()}_OAUTH_CLIENT_ID`] || '',
      clientSecret: process.env[`${serviceType.toUpperCase()}_OAUTH_CLIENT_SECRET`] || '',
      redirectUri: `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/${serviceType}/callback`
    };

    this.rateLimitConfig = serviceConfig?.rateLimit || {
      requestsPerSecond: 5,
      maxRetries: 3
    };

  }

  /**
   * Abstract methods that each service must implement
   */
  abstract getServiceType(): string;
  abstract refreshToken(refreshToken: string): Promise<TokenResponse>;
  abstract testApiAccess(accessToken: string, ...args: any[]): Promise<boolean>;
  abstract syncDataToSchema(companyId: number): Promise<SyncResult>;
  abstract discoverTables(accessToken: string, ...args: any[]): Promise<TableDiscoveryResult[]>;
  abstract runTransformations(companyId: number, sql: any): Promise<void>;

  /**
   * Generate state with company and user info for multi-tenant support
   */
  generateState(companyId: number, userId?: number): string {
    const stateData: StateData = {
      companyId,
      userId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2, 15)
    };
    return Buffer.from(JSON.stringify(stateData)).toString('base64');
  }

  /**
   * Parse state to get company and user info
   */
  parseState(state: string): StateData {
    try {
      const decoded = Buffer.from(state, 'base64').toString();
      return JSON.parse(decoded);
    } catch (error) {
      throw new OAuthError('Invalid state parameter', 'INVALID_CONFIG');
    }
  }

  /**
   * Execute API call with automatic token refresh on 401 errors
   */
  async executeWithTokenRefresh<T>(
    companyId: number,
    apiCall: (accessToken: string) => Promise<T>
  ): Promise<T> {
    const serviceType = this.getServiceType();
    console.log(`🔧 executeWithTokenRefresh called for ${serviceType}, company:`, companyId);
    
    // Get current tokens from database
    const tokens = await this.getStoredTokens(companyId);
    
    if (!tokens.accessToken) {
      throw new OAuthError(`No ${serviceType} OAuth tokens found for this company`, 'INVALID_CONFIG');
    }

    try {
      console.log(`🔧 Calling ${serviceType} API with current access token...`);
      // Try the API call with current access token
      return await this.withRateLimit(() => apiCall(tokens.accessToken));
    } catch (error: any) {
      console.log(`🔧 ${serviceType} API call failed with error:`, error.message);
      
      // Check if it's a token expiration error
      if (this.isTokenExpiredError(error)) {
        console.log(`🔄 ${serviceType} access token expired, refreshing automatically...`);
        
        if (!tokens.refreshToken) {
          throw new OAuthError(
            `No refresh token available for automatic ${serviceType} token refresh`,
            'REFRESH_FAILED'
          );
        }

        try {
          // Refresh the access token
          const newTokens = await this.refreshToken(tokens.refreshToken);
          
          // For rotating refresh tokens (like Atlassian), always use the new refresh token if provided
          const updatedRefreshToken = newTokens.refresh_token || tokens.refreshToken;
          const expiresAt = new Date(Date.now() + (newTokens.expires_in * 1000)).toISOString();
          
          // Update tokens in database
          await this.updateStoredTokens(companyId, {
            accessToken: newTokens.access_token,
            refreshToken: updatedRefreshToken,
            expiresAt: expiresAt,
          });

          console.log(`✅ ${serviceType} access token refreshed successfully`);

          // Retry the API call with the new access token
          return await this.withRateLimit(() => apiCall(newTokens.access_token));
        } catch (refreshError) {
          console.error(`❌ Failed to refresh ${serviceType} access token:`, refreshError);
          
          // Check if it's an invalid refresh token error
          const errorMessage = refreshError.message?.toLowerCase() || '';
          if (errorMessage.includes('invalid_grant') || 
              errorMessage.includes('unauthorized_client') ||
              errorMessage.includes('refresh_token is invalid') ||
              errorMessage.includes('forbidden')) {
            
            console.error(`❌ ${serviceType} refresh token is invalid or expired - user needs to re-authenticate`);
            throw new OAuthError(
              `${serviceType} OAuth session has expired. Please reconnect your ${serviceType} account.`,
              'REFRESH_TOKEN_EXPIRED'
            );
          }
          
          // Generic refresh failure
          throw new OAuthError(
            `Failed to refresh ${serviceType} OAuth tokens. Please re-authenticate.`,
            'REFRESH_FAILED'
          );
        }
      }
      
      // If it's not a token error, re-throw the original error
      throw error;
    }
  }

  /**
   * Check if error is due to expired token
   */
  protected isTokenExpiredError(error: any): boolean {
    return error.message?.includes('TOKEN_EXPIRED') || 
           error.message?.includes('401') ||
           error.statusCode === 401 ||
           error.response?.status === 401;
  }

  /**
   * Get stored OAuth tokens from database
   */
  async getStoredTokens(companyId: number): Promise<OAuthTokens> {
    const storage = (await import('../storage.js')).storage;
    const serviceType = this.getServiceType();
    
    const dataSources = await storage.getDataSourcesByCompany(companyId);
    const serviceSource = dataSources.find(ds => ds.type === serviceType);
    
    if (!serviceSource?.config) {
      throw new OAuthError(
        `No ${serviceType} OAuth configuration found for company ${companyId}`,
        'INVALID_CONFIG'
      );
    }

    const config = typeof serviceSource.config === 'string' 
      ? JSON.parse(serviceSource.config) 
      : serviceSource.config;

    const tokens = {
      accessToken: config.accessToken || config.access_token,
      refreshToken: config.refreshToken || config.refresh_token,
      expiresAt: config.expiresAt || config.expires_at,
      scope: config.scope
    };

    return tokens;
  }

  /**
   * Update stored OAuth tokens in database
   */
  async updateStoredTokens(companyId: number, tokens: Partial<OAuthTokens>): Promise<void> {
    const storage = (await import('../storage.js')).storage;
    const serviceType = this.getServiceType();
    
    const dataSources = await storage.getDataSourcesByCompany(companyId);
    const serviceSource = dataSources.find(ds => ds.type === serviceType);
    
    if (!serviceSource) {
      throw new OAuthError(
        `No ${serviceType} data source found for company ${companyId}`,
        'INVALID_CONFIG'
      );
    }

    const existingConfig = typeof serviceSource.config === 'string' 
      ? JSON.parse(serviceSource.config) 
      : serviceSource.config || {};

    const updatedConfig = {
      ...existingConfig,
      accessToken: tokens.accessToken || existingConfig.accessToken,
      refreshToken: tokens.refreshToken || existingConfig.refreshToken,
      expiresAt: tokens.expiresAt || existingConfig.expiresAt,
      scope: tokens.scope || existingConfig.scope
    };

    await storage.updateDataSource(serviceSource.id, {
      config: updatedConfig,
    });
  }

  /**
   * Rate limiting wrapper for API calls
   */
  protected async withRateLimit<T>(apiCall: () => Promise<T>): Promise<T> {
    const minInterval = 1000 / this.rateLimitConfig.requestsPerSecond;
    
    return new Promise((resolve, reject) => {
      this.requestQueue = this.requestQueue.then(async () => {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < minInterval) {
          await this.delay(minInterval - timeSinceLastRequest);
        }
        
        this.lastRequestTime = Date.now();
        
        try {
          const result = await apiCall();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Helper method to delay execution
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initialize the OAuth client (validate configuration)
   */
  async initialize(): Promise<void> {
    const serviceType = this.getServiceType();
    
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new OAuthError(
        `Missing ${serviceType} OAuth credentials. Please set ${serviceType.toUpperCase()}_OAUTH_CLIENT_ID and ${serviceType.toUpperCase()}_OAUTH_CLIENT_SECRET environment variables.`,
        'INVALID_CONFIG'
      );
    }
    
    console.log(`${serviceType} OAuth client initialized successfully`);
  }

  /**
   * Common method to handle database operations for syncing data
   */
  protected async insertDataToSchema(
    companyId: number,
    tableName: string,
    data: any[],
    sourceSystem: string
  ): Promise<number> {
    if (data.length === 0) return 0;

    const postgres = (await import('postgres')).default;
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new OAuthError('DATABASE_URL not configured', 'INVALID_CONFIG');
    }
    
    const sql = postgres(databaseUrl);
    
    try {
      const schemaName = `analytics_company_${companyId}`;
      const fullTableName = `${schemaName}.raw_${tableName}`;
      
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
      
      return inserted;
    } finally {
      await sql.end();
    }
  }

  /**
   * Check if access token is expired based on expiresAt timestamp
   */
  protected isTokenExpired(expiresAt?: string): boolean {
    if (!expiresAt) return false;
    
    const expirationDate = new Date(expiresAt);
    const now = new Date();
    
    // Consider token expired if it expires in the next 5 minutes
    const bufferTime = 5 * 60 * 1000; // 5 minutes
    return expirationDate.getTime() - bufferTime < now.getTime();
  }

  /**
   * Format error message for consistent error handling
   */
  protected formatError(error: any, context: string): string {
    const serviceType = this.getServiceType();
    
    if (error instanceof OAuthError) {
      return error.message;
    }
    
    if (error.response?.data?.message) {
      return `${serviceType} ${context}: ${error.response.data.message}`;
    }
    
    if (error.message) {
      return `${serviceType} ${context}: ${error.message}`;
    }
    
    return `${serviceType} ${context}: Unknown error occurred`;
  }
}