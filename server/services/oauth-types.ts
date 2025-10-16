/**
 * Shared TypeScript interfaces for OAuth integrations
 */

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

export interface StateData {
  companyId: number;
  userId?: number;
  timestamp: number;
  nonce: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthServiceConfig {
  serviceType: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  resources?: any[]; // For Jira
  portalInfo?: any; // For HubSpot
  accountInfo?: any; // For other services
  [key: string]: any; // Allow service-specific fields
}

export interface DataSourceConfig {
  id: number;
  companyId: number;
  type: string;
  config: OAuthServiceConfig | string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  tablesCreated: string[];
  error?: string;
}

export interface TableDiscoveryResult {
  name: string;
  label: string;
  fields: string[];
  accessible: boolean;
  isStandard?: boolean;
}

export class OAuthError extends Error {
  constructor(
    message: string,
    public code: 'TOKEN_EXPIRED' | 'REFRESH_FAILED' | 'INVALID_CONFIG' | 'API_ERROR',
    public statusCode?: number
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  retryAfter?: number;
  maxRetries?: number;
}

// Service-specific configurations
export const SERVICE_CONFIGS = {
  jira: {
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    apiBaseUrl: 'https://api.atlassian.com',
    rateLimit: { requestsPerSecond: 10, maxRetries: 3 }
  },
  hubspot: {
    authorizationUrl: 'https://app.hubspot.com/oauth/authorize',
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
    apiBaseUrl: 'https://api.hubapi.com',
    rateLimit: { requestsPerSecond: 10, maxRetries: 3 }
  },
  odoo: {
    authorizationUrl: '', // Dynamic - uses instance URL
    tokenUrl: '', // Dynamic - uses instance URL  
    apiBaseUrl: '', // Dynamic - uses instance URL
    rateLimit: { requestsPerSecond: 5, maxRetries: 3 }
  },
  zoho: {
    authorizationUrl: 'https://accounts.zoho.com/oauth/v2/auth',
    tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
    apiBaseUrl: 'https://www.zohoapis.com/crm/v6',
    rateLimit: { requestsPerSecond: 10, maxRetries: 3 }
  },
  activecampaign: {
    authorizationUrl: '', // Not used - API key authentication
    tokenUrl: '', // Not used - API key authentication
    apiBaseUrl: '', // Dynamic - user provides their API URL
    rateLimit: { requestsPerSecond: 5, maxRetries: 3 }
  },
  mailchimp: {
    authorizationUrl: 'https://login.mailchimp.com/oauth2/authorize',
    tokenUrl: 'https://login.mailchimp.com/oauth2/token',
    apiBaseUrl: '', // Dynamic - determined from metadata endpoint after OAuth
    rateLimit: { requestsPerSecond: 10, maxRetries: 3 }
  },
  monday: {
    authorizationUrl: 'https://auth.monday.com/oauth2/authorize',
    tokenUrl: 'https://auth.monday.com/oauth2/token',
    apiBaseUrl: 'https://api.monday.com/v2', // GraphQL endpoint
    rateLimit: { requestsPerSecond: 5, maxRetries: 3 } // Lower due to complexity points
  },
  asana: {
    authorizationUrl: 'https://app.asana.com/-/oauth_authorize',
    tokenUrl: 'https://app.asana.com/-/oauth_token',
    apiBaseUrl: 'https://app.asana.com/api/1.0',
    rateLimit: { requestsPerSecond: 15, maxRetries: 3 } // Asana allows 1500 requests/minute
  }
} as const;