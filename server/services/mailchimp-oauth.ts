/**
 * Mailchimp OAuth2 integration service extending base OAuth class
 */

import { OAuthServiceBase } from './oauth-base.js';
import {
  TokenResponse,
  SyncResult,
  TableDiscoveryResult,
  OAuthError
} from './oauth-types.js';

interface MailchimpUserInfo {
  account_id: string;
  login_name: string;
  account_name: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  dc?: string;
  api_endpoint?: string;
}

interface MailchimpMetadata {
  dc: string;
  api_endpoint: string;
  login_url: string;
}

export class MailchimpOAuthService extends OAuthServiceBase {

  constructor() {
    super();
  }

  /**
   * Get service type identifier
   */
  getServiceType(): string {
    return 'mailchimp';
  }

  /**
   * Generate authorization URL with company context
   */
  getAuthorizationUrl(companyId: number, userId?: number): string {
    const state = this.generateState(companyId, userId);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
    });

    return `https://login.mailchimp.com/oauth2/authorize?${params.toString()}`;
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
        code: code,
      });

      const response = await fetch('https://login.mailchimp.com/oauth2/token', {
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
        refresh_token: tokenData.refresh_token || '', // Mailchimp may not provide refresh tokens
        expires_in: tokenData.expires_in || 0, // Mailchimp tokens may not expire
        token_type: tokenData.token_type || 'bearer',
        scope: tokenData.scope || '',
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get metadata to determine data center and API endpoint
   */
  async getMetadata(accessToken: string): Promise<MailchimpMetadata> {
    try {
      const response = await fetch('https://login.mailchimp.com/oauth2/metadata', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get metadata: ${response.statusText}`);
      }

      const metadata = await response.json();

      return {
        dc: metadata.dc,
        api_endpoint: metadata.api_endpoint,
        login_url: metadata.login_url,
      };
    } catch (error) {
      console.error('Failed to get Mailchimp metadata:', error);
      throw error;
    }
  }

  /**
   * Get user account information
   */
  async getUserInfo(accessToken: string, baseUrl: string): Promise<MailchimpUserInfo> {
    try {
      const response = await fetch(`${baseUrl}/`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const userInfo = await response.json();

      return {
        account_id: userInfo.account_id,
        login_name: userInfo.login_name,
        account_name: userInfo.account_name,
        email: userInfo.email,
        first_name: userInfo.first_name,
        last_name: userInfo.last_name,
        avatar_url: userInfo.avatar_url,
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Refresh access token - Mailchimp tokens typically don't expire
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    // Mailchimp access tokens typically don't expire and don't have refresh tokens
    // If refresh is needed in the future, implement similar to other services
    throw new OAuthError(
      'Mailchimp access tokens do not require refresh. Please re-authenticate if needed.',
      'REFRESH_FAILED'
    );
  }

  /**
   * Handle rate limiting with exponential backoff
   */
  private async handleRateLimit(
    apiCall: () => Promise<Response>,
    maxRetries: number = 3
  ): Promise<Response> {
    let attempt = 0;
    let delay = 1000; // Start with 1 second

    while (attempt <= maxRetries) {
      try {
        const response = await apiCall();

        if (response.status === 429) {
          // Rate limited - check for Retry-After header
          const retryAfter = response.headers.get('Retry-After');
          const backoffTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;

          if (attempt === maxRetries) {
            throw new Error(`Rate limit exceeded after ${maxRetries} retries`);
          }

          console.log(`🔄 Rate limited, backing off for ${backoffTime}ms (attempt ${attempt + 1}/${maxRetries})`);
          await this.delay(backoffTime);

          attempt++;
          delay *= 2; // Exponential backoff
          continue;
        }

        return response;
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }

        console.log(`🔄 Request failed, backing off for ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await this.delay(delay);
        attempt++;
        delay *= 2;
      }
    }

    throw new Error(`Maximum retries (${maxRetries}) exceeded`);
  }

  /**
   * Create webhook for a list to receive real-time updates
   */
  async createWebhook(accessToken: string, baseUrl: string, listId: string, callbackUrl: string): Promise<any> {
    try {
      const webhookData = {
        url: callbackUrl,
        events: {
          subscribe: true,
          unsubscribe: true,
          profile: true,
          cleaned: true,
          upemail: true,
          campaign: false
        },
        sources: {
          user: true,
          admin: true,
          api: true
        }
      };

      const response = await this.handleRateLimit(async () => {
        return await fetch(`${baseUrl}/lists/${listId}/webhooks`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(webhookData),
        });
      });

      if (!response.ok) {
        throw new Error(`Failed to create webhook: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create Mailchimp webhook:', error);
      throw error;
    }
  }

  /**
   * List existing webhooks for a list
   */
  async listWebhooks(accessToken: string, baseUrl: string, listId: string): Promise<any[]> {
    try {
      const response = await this.handleRateLimit(async () => {
        return await fetch(`${baseUrl}/lists/${listId}/webhooks`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });
      });

      if (!response.ok) {
        throw new Error(`Failed to list webhooks: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.webhooks || [];
    } catch (error) {
      console.error('Failed to list Mailchimp webhooks:', error);
      throw error;
    }
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(accessToken: string, baseUrl: string, listId: string, webhookId: string): Promise<void> {
    try {
      const response = await this.handleRateLimit(async () => {
        return await fetch(`${baseUrl}/lists/${listId}/webhooks/${webhookId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Failed to delete webhook: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to delete Mailchimp webhook:', error);
      throw error;
    }
  }

  /**
   * Process webhook payload and normalize data
   */
  async processWebhookPayload(payload: any): Promise<{ type: string; data: any; listId?: string }> {
    try {
      const eventType = payload.type;
      const eventData = payload.data;

      let normalizedData: any = {};

      switch (eventType) {
        case 'subscribe':
        case 'unsubscribe':
        case 'profile':
        case 'upemail':
        case 'cleaned':
          // Normalize member data
          normalizedData = {
            id: eventData.id,
            email: eventData.email,
            status: eventData.status || eventType,
            merge_fields: eventData.merges || {},
            list_id: eventData.list_id,
            timestamp: new Date().toISOString(),
            event_type: eventType
          };
          break;

        default:
          console.log(`Unknown webhook event type: ${eventType}`);
          normalizedData = eventData;
      }

      return {
        type: eventType,
        data: normalizedData,
        listId: eventData.list_id
      };
    } catch (error) {
      console.error('Failed to process webhook payload:', error);
      throw error;
    }
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string, baseUrl?: string): Promise<boolean> {
    try {
      if (!baseUrl) {
        // Get metadata to determine base URL
        const metadata = await this.getMetadata(accessToken);
        baseUrl = metadata.api_endpoint;
      }

      const response = await fetch(`${baseUrl}/`, {
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
  async discoverTables(accessToken: string, baseUrl?: string): Promise<TableDiscoveryResult[]> {
    if (!baseUrl) {
      // Get metadata to determine base URL
      const metadata = await this.getMetadata(accessToken);
      baseUrl = metadata.api_endpoint;
    }
    return this.discoverMailchimpTables(accessToken, baseUrl);
  }

  /**
   * Discover available Mailchimp tables and their fields
   */
  async discoverMailchimpTables(accessToken: string, baseUrl: string): Promise<TableDiscoveryResult[]> {
    try {
      const tables = [];

      // Core Mailchimp entities
      const coreEntities = [
        // Audiences & Members
        { name: 'lists', label: 'Lists (Audiences)', endpoint: '/lists', fieldsEndpoint: null },
        { name: 'list_members', label: 'List Members', endpoint: '/lists', fieldsEndpoint: '/members' },
        { name: 'segments', label: 'Segments', endpoint: '/lists', fieldsEndpoint: '/segments' },
        { name: 'interest_categories', label: 'Interest Categories', endpoint: '/lists', fieldsEndpoint: '/interest-categories' },

        // Campaigns
        { name: 'campaigns', label: 'Campaigns', endpoint: '/campaigns', fieldsEndpoint: null },
        { name: 'campaign_reports', label: 'Campaign Reports', endpoint: '/reports', fieldsEndpoint: null },

        // Templates & Content
        { name: 'templates', label: 'Templates', endpoint: '/templates', fieldsEndpoint: null },
        { name: 'file_manager_files', label: 'File Manager Files', endpoint: '/file-manager/files', fieldsEndpoint: null },
        { name: 'file_manager_folders', label: 'File Manager Folders', endpoint: '/file-manager/folders', fieldsEndpoint: null },

        // Automation
        { name: 'automations', label: 'Automations', endpoint: '/automations', fieldsEndpoint: null },
        { name: 'automation_emails', label: 'Automation Emails', endpoint: '/automations', fieldsEndpoint: '/emails' },

        // Landing Pages
        { name: 'landing_pages', label: 'Landing Pages', endpoint: '/landing-pages', fieldsEndpoint: null },

        // Account & Users
        { name: 'account', label: 'Account Info', endpoint: '/', fieldsEndpoint: null },

        // E-commerce (if enabled)
        { name: 'stores', label: 'Stores', endpoint: '/ecommerce/stores', fieldsEndpoint: null },
        { name: 'orders', label: 'Orders', endpoint: '/ecommerce/stores', fieldsEndpoint: '/orders' },
        { name: 'products', label: 'Products', endpoint: '/ecommerce/stores', fieldsEndpoint: '/products' },
        { name: 'customers', label: 'Customers', endpoint: '/ecommerce/stores', fieldsEndpoint: '/customers' },
        { name: 'carts', label: 'Carts', endpoint: '/ecommerce/stores', fieldsEndpoint: '/carts' },
      ];

      for (const entity of coreEntities) {
        try {
          // Test if we can access this entity
          const testUrl = entity.name === 'account'
            ? `${baseUrl}/`
            : `${baseUrl}${entity.endpoint}?count=1`;

          const testResponse = await fetch(testUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          if (testResponse.ok) {
            let fields: string[] = [];

            // Get sample data to infer fields
            const sampleData = await testResponse.json();
            let firstItem: any = null;

            if (entity.name === 'account') {
              firstItem = sampleData;
            } else if (sampleData.lists && Array.isArray(sampleData.lists)) {
              firstItem = sampleData.lists[0];
            } else if (sampleData.campaigns && Array.isArray(sampleData.campaigns)) {
              firstItem = sampleData.campaigns[0];
            } else if (sampleData.templates && Array.isArray(sampleData.templates)) {
              firstItem = sampleData.templates[0];
            } else if (sampleData.automations && Array.isArray(sampleData.automations)) {
              firstItem = sampleData.automations[0];
            } else if (sampleData.landing_pages && Array.isArray(sampleData.landing_pages)) {
              firstItem = sampleData.landing_pages[0];
            } else if (sampleData.stores && Array.isArray(sampleData.stores)) {
              firstItem = sampleData.stores[0];
            } else if (sampleData.files && Array.isArray(sampleData.files)) {
              firstItem = sampleData.files[0];
            } else if (sampleData.folders && Array.isArray(sampleData.folders)) {
              firstItem = sampleData.folders[0];
            } else if (sampleData.reports && Array.isArray(sampleData.reports)) {
              firstItem = sampleData.reports[0];
            }

            if (firstItem && typeof firstItem === 'object') {
              fields = Object.keys(firstItem).slice(0, 8);
            }

            tables.push({
              name: entity.name,
              label: entity.label,
              fields: fields,
              accessible: true,
              isStandard: ['lists', 'list_members', 'campaigns', 'automations'].includes(entity.name)
            });
          }
        } catch (error: any) {
          console.log(`Could not access ${entity.name}:`, error.message);
        }
      }

      return tables.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Failed to discover Mailchimp tables:', error);
      return [];
    }
  }

  /**
   * Fetch Mailchimp lists (audiences) with pagination
   */
  async fetchLists(accessToken: string, baseUrl: string, count: number = 100): Promise<any[]> {
    try {
      let allLists: any[] = [];
      let offset = 0;
      let totalItems = 0;

      do {
        const url = `${baseUrl}/lists?count=${Math.min(count, 1000)}&offset=${offset}`;

        const response = await this.handleRateLimit(async () => {
          return await fetch(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
          }
          throw new Error(`Failed to fetch lists: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allLists.push(...(data.lists || []));

        totalItems = data.total_items || 0;
        offset += data.lists?.length || 0;

      } while (allLists.length < totalItems && allLists.length < count);

      return allLists;
    } catch (error) {
      console.error('Failed to fetch Mailchimp lists:', error);
      throw error;
    }
  }

  /**
   * Fetch Mailchimp list members with pagination and incremental sync
   */
  async fetchListMembers(
    accessToken: string,
    baseUrl: string,
    listId: string,
    count: number = 100,
    sinceLastChanged?: string
  ): Promise<any[]> {
    try {
      let allMembers: any[] = [];
      let offset = 0;
      let totalItems = 0;

      do {
        const params = new URLSearchParams({
          count: Math.min(count, 1000).toString(),
          offset: offset.toString(),
        });

        if (sinceLastChanged) {
          params.append('since_last_changed', sinceLastChanged);
        }

        const url = `${baseUrl}/lists/${listId}/members?${params.toString()}`;

        const response = await this.handleRateLimit(async () => {
          return await fetch(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
          }
          throw new Error(`Failed to fetch list members: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allMembers.push(...(data.members || []));

        totalItems = data.total_items || 0;
        offset += data.members?.length || 0;

      } while (allMembers.length < totalItems && allMembers.length < count);

      return allMembers;
    } catch (error) {
      console.error('Failed to fetch Mailchimp list members:', error);
      throw error;
    }
  }

  /**
   * Fetch Mailchimp campaigns with pagination
   */
  async fetchCampaigns(accessToken: string, baseUrl: string, count: number = 100): Promise<any[]> {
    try {
      let allCampaigns: any[] = [];
      let offset = 0;
      let totalItems = 0;

      do {
        const url = `${baseUrl}/campaigns?count=${Math.min(count, 1000)}&offset=${offset}`;

        const response = await this.handleRateLimit(async () => {
          return await fetch(url, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
          }
          throw new Error(`Failed to fetch campaigns: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allCampaigns.push(...(data.campaigns || []));

        totalItems = data.total_items || 0;
        offset += data.campaigns?.length || 0;

      } while (allCampaigns.length < totalItems && allCampaigns.length < count);

      return allCampaigns;
    } catch (error) {
      console.error('Failed to fetch Mailchimp campaigns:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for Mailchimp data (raw → stg → int → core)
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;

    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;

      // Clean up existing transformation objects
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_mailchimp_contacts`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_mailchimp_activities`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_mailchimp_lists`;

      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_mailchimp_contacts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_mailchimp_activities`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_mailchimp_lists`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_mailchimp_campaigns`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_mailchimp_list_members`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_mailchimp_lists`;

      // STG: mailchimp_lists - normalized audiences
      await sql`
        CREATE TABLE ${sql(schema)}.stg_mailchimp_lists AS
        SELECT DISTINCT
          data->>'id' as list_id,
          data->>'web_id' as web_id,
          data->>'name' as list_name,
          (data#>>'{stats,member_count}')::integer as member_count,
          (data#>>'{stats,unsubscribe_count}')::integer as unsubscribe_count,
          (data#>>'{stats,cleaned_count}')::integer as cleaned_count,
          (data#>>'{stats,member_count_since_send}')::integer as member_count_since_send,
          (data#>>'{stats,unsubscribe_count_since_send}')::integer as unsubscribe_count_since_send,
          (data#>>'{stats,cleaned_count_since_send}')::integer as cleaned_count_since_send,
          (data#>>'{stats,campaign_count}')::integer as campaign_count,
          (data#>>'{stats,campaign_last_sent}')::timestamp as campaign_last_sent,
          (data#>>'{stats,merge_field_count}')::integer as merge_field_count,
          (data#>>'{stats,avg_sub_rate}')::numeric as avg_sub_rate,
          (data#>>'{stats,avg_unsub_rate}')::numeric as avg_unsub_rate,
          (data->>'date_created')::timestamp as created_at,
          data->>'permission_reminder' as permission_reminder,
          data->>'use_archive_bar' as use_archive_bar,
          data#>>'{campaign_defaults,from_name}' as default_from_name,
          data#>>'{campaign_defaults,from_email}' as default_from_email,
          data#>>'{campaign_defaults,subject}' as default_subject,
          data#>>'{campaign_defaults,language}' as default_language,
          data->>'list_rating' as list_rating,
          data->>'email_type_option' as email_type_option,
          data->>'subscribe_url_short' as subscribe_url_short,
          data->>'subscribe_url_long' as subscribe_url_long,
          data as raw_data
        FROM ${sql(schema)}.raw_mailchimp_lists
        WHERE data IS NOT NULL
      `;

      // STG: mailchimp_list_members - normalized contacts
      await sql`
        CREATE TABLE ${sql(schema)}.stg_mailchimp_list_members AS
        SELECT DISTINCT
          data->>'id' as member_id,
          data->>'email_address' as email_address,
          data->>'unique_email_id' as unique_email_id,
          data->>'web_id' as web_id,
          data->>'email_type' as email_type,
          data->>'status' as status,
          (data#>>'{stats,avg_open_rate}')::numeric as avg_open_rate,
          (data#>>'{stats,avg_click_rate}')::numeric as avg_click_rate,
          data->>'ip_signup' as ip_signup,
          (data->>'timestamp_signup')::timestamp as timestamp_signup,
          data->>'ip_opt' as ip_opt,
          (data->>'timestamp_opt')::timestamp as timestamp_opt,
          (data->>'member_rating')::integer as member_rating,
          (data->>'last_changed')::timestamp as last_changed,
          data->>'language' as language,
          data->>'vip' as vip,
          data->>'email_client' as email_client,
          data#>>'{location,latitude}' as latitude,
          data#>>'{location,longitude}' as longitude,
          data#>>'{location,gmtoff}' as gmtoff,
          data#>>'{location,dstoff}' as dstoff,
          data#>>'{location,country_code}' as country_code,
          data#>>'{location,timezone}' as timezone,
          data#>>'{location,region}' as region,
          COALESCE(data#>>'{merge_fields,FNAME}', '') as first_name,
          COALESCE(data#>>'{merge_fields,LNAME}', '') as last_name,
          data as raw_data
        FROM ${sql(schema)}.raw_mailchimp_list_members
        WHERE data IS NOT NULL
      `;

      // STG: mailchimp_campaigns - normalized activities
      await sql`
        CREATE TABLE ${sql(schema)}.stg_mailchimp_campaigns AS
        SELECT DISTINCT
          data->>'id' as campaign_id,
          data->>'web_id' as web_id,
          data->>'type' as campaign_type,
          (data->>'create_time')::timestamp as create_time,
          data->>'archive_url' as archive_url,
          data->>'long_archive_url' as long_archive_url,
          data->>'status' as status,
          (data#>>'{emails_sent}')::integer as emails_sent,
          (data->>'send_time')::timestamp as send_time,
          data->>'content_type' as content_type,
          data->>'needs_block_refresh' as needs_block_refresh,
          data->>'resendable' as resendable,
          data#>>'{recipients,list_id}' as list_id,
          data#>>'{recipients,list_name}' as list_name,
          (data#>>'{recipients,recipient_count}')::integer as recipient_count,
          data#>>'{settings,subject_line}' as subject_line,
          data#>>'{settings,preview_text}' as preview_text,
          data#>>'{settings,title}' as title,
          data#>>'{settings,from_name}' as from_name,
          data#>>'{settings,reply_to}' as reply_to,
          data#>>'{settings,use_conversation}' as use_conversation,
          data#>>'{settings,to_name}' as to_name,
          data#>>'{settings,folder_id}' as folder_id,
          data#>>'{settings,authenticate}' as authenticate,
          data#>>'{settings,auto_footer}' as auto_footer,
          data#>>'{settings,inline_css}' as inline_css,
          data#>>'{settings,auto_tweet}' as auto_tweet,
          data#>>'{settings,fb_comments}' as fb_comments,
          data#>>'{settings,timewarp}' as timewarp,
          data#>>'{settings,template_id}' as template_id,
          data#>>'{settings,drag_and_drop}' as drag_and_drop,
          data as raw_data
        FROM ${sql(schema)}.raw_mailchimp_campaigns
        WHERE data IS NOT NULL
      `;

      // INT: mailchimp_lists - enriched list data
      await sql`
        CREATE TABLE ${sql(schema)}.int_mailchimp_lists AS
        SELECT
          list_id,
          web_id,
          list_name,
          member_count,
          unsubscribe_count,
          cleaned_count,
          member_count_since_send,
          unsubscribe_count_since_send,
          cleaned_count_since_send,
          campaign_count,
          campaign_last_sent,
          merge_field_count,
          avg_sub_rate,
          avg_unsub_rate,
          created_at,
          permission_reminder,
          use_archive_bar,
          default_from_name,
          default_from_email,
          default_subject,
          default_language,
          list_rating,
          email_type_option,
          subscribe_url_short,
          subscribe_url_long,
          -- Calculated fields
          CASE
            WHEN member_count > 0 THEN (unsubscribe_count::numeric / member_count::numeric) * 100
            ELSE 0
          END as unsubscribe_rate_percent,
          CASE
            WHEN member_count > 0 THEN (cleaned_count::numeric / member_count::numeric) * 100
            ELSE 0
          END as cleaned_rate_percent,
          CASE
            WHEN member_count > 10000 THEN 'Large'
            WHEN member_count > 1000 THEN 'Medium'
            ELSE 'Small'
          END as list_size_category
        FROM ${sql(schema)}.stg_mailchimp_lists
      `;

      // INT: mailchimp_contacts - enriched contact data (normalized from list members)
      await sql`
        CREATE TABLE ${sql(schema)}.int_mailchimp_contacts AS
        SELECT
          member_id,
          email_address,
          unique_email_id,
          web_id,
          email_type,
          status,
          avg_open_rate,
          avg_click_rate,
          ip_signup,
          timestamp_signup,
          ip_opt,
          timestamp_opt,
          member_rating,
          last_changed,
          language,
          vip,
          email_client,
          latitude,
          longitude,
          gmtoff,
          dstoff,
          country_code,
          timezone,
          region,
          first_name,
          last_name,
          -- Calculated fields
          CASE
            WHEN first_name != '' AND last_name != '' THEN first_name || ' ' || last_name
            WHEN first_name != '' THEN first_name
            WHEN last_name != '' THEN last_name
            ELSE email_address
          END as full_name,
          CASE
            WHEN status = 'subscribed' THEN 'Active'
            WHEN status = 'unsubscribed' THEN 'Unsubscribed'
            WHEN status = 'cleaned' THEN 'Cleaned'
            WHEN status = 'pending' THEN 'Pending'
            ELSE 'Unknown'
          END as contact_status,
          CASE
            WHEN member_rating >= 4 THEN 'High Engagement'
            WHEN member_rating >= 2 THEN 'Medium Engagement'
            ELSE 'Low Engagement'
          END as engagement_level
        FROM ${sql(schema)}.stg_mailchimp_list_members
      `;

      // INT: mailchimp_activities - enriched campaign data (normalized as activities)
      await sql`
        CREATE TABLE ${sql(schema)}.int_mailchimp_activities AS
        SELECT
          campaign_id,
          web_id,
          campaign_type,
          create_time,
          archive_url,
          long_archive_url,
          status,
          emails_sent,
          send_time,
          content_type,
          needs_block_refresh,
          resendable,
          list_id,
          list_name,
          recipient_count,
          subject_line,
          preview_text,
          title,
          from_name,
          reply_to,
          use_conversation,
          to_name,
          folder_id,
          authenticate,
          auto_footer,
          inline_css,
          auto_tweet,
          fb_comments,
          timewarp,
          template_id,
          drag_and_drop,
          -- Calculated fields
          CASE
            WHEN status = 'sent' THEN 'Completed'
            WHEN status = 'sending' THEN 'In Progress'
            WHEN status = 'schedule' THEN 'Scheduled'
            WHEN status = 'paused' THEN 'Paused'
            ELSE 'Draft'
          END as activity_status,
          CASE
            WHEN emails_sent > 10000 THEN 'Large Campaign'
            WHEN emails_sent > 1000 THEN 'Medium Campaign'
            ELSE 'Small Campaign'
          END as campaign_size_category
        FROM ${sql(schema)}.stg_mailchimp_campaigns
      `;

      // CORE: Views that mirror int tables
      await sql`
        CREATE VIEW ${sql(schema)}.core_mailchimp_lists AS
        SELECT * FROM ${sql(schema)}.int_mailchimp_lists
      `;

      await sql`
        CREATE VIEW ${sql(schema)}.core_mailchimp_contacts AS
        SELECT * FROM ${sql(schema)}.int_mailchimp_contacts
      `;

      await sql`
        CREATE VIEW ${sql(schema)}.core_mailchimp_activities AS
        SELECT * FROM ${sql(schema)}.int_mailchimp_activities
      `;

    } catch (error) {
      console.error('❌ Mailchimp transformation pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Sync Mailchimp data to company analytics schema using stored OAuth tokens
   */
  async syncDataToSchema(companyId: number): Promise<SyncResult> {
    try {
      const { eq, sql: sqlOp } = await import('drizzle-orm');
      const postgres = (await import('postgres')).default;
      const { drizzle } = await import('drizzle-orm/postgres-js');

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new Error('DATABASE_URL not configured');
      }

      const sql = postgres(databaseUrl);
      const db = drizzle(sql);

      const storage = (await import('../storage')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const mailchimpSource = dataSources.find(ds => ds.type === 'mailchimp');

      if (!mailchimpSource || !mailchimpSource.config) {
        throw new Error('No Mailchimp OAuth tokens found for this company');
      }

      const config = mailchimpSource.config as any || {};
      const { accessToken, account_id, dc, api_endpoint } = config;

      if (!accessToken) {
        throw new Error('Invalid OAuth configuration - missing access token');
      }

      let baseUrl = api_endpoint;
      if (!baseUrl && dc) {
        baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
      }

      if (!baseUrl) {
        // Get metadata to determine base URL
        const metadata = await this.getMetadata(accessToken);
        baseUrl = metadata.api_endpoint;
      }

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Fetch and sync lists (audiences)
      const lists = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchLists(token, baseUrl, 500)
      );

      if (lists.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'mailchimp_lists', lists, 'mailchimp_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_mailchimp_lists');
      }

      // Fetch and sync list members for each list
      let allMembers: any[] = [];
      for (const list of lists.slice(0, 10)) { // Limit to first 10 lists to avoid overwhelming
        try {
          const members = await this.executeWithTokenRefresh(companyId,
            (token) => this.fetchListMembers(token, baseUrl, list.id, 1000)
          );

          // Add list information to each member
          const membersWithList = members.map(member => ({
            ...member,
            source_list_id: list.id,
            source_list_name: list.name
          }));

          allMembers.push(...membersWithList);
        } catch (error: any) {
          console.warn(`Could not fetch members for list ${list.id}:`, error.message);
        }
      }

      if (allMembers.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'mailchimp_list_members', allMembers, 'mailchimp_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_mailchimp_list_members');
      }

      // Fetch and sync campaigns
      const campaigns = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchCampaigns(token, baseUrl, 500)
      );

      if (campaigns.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'mailchimp_campaigns', campaigns, 'mailchimp_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_mailchimp_campaigns');
      }

      // Run dbt-style transformations
      try {
        await this.runTransformations(companyId, sql);
      } catch (transformError) {
        console.error('❌ Mailchimp transformation failed:', transformError);
      }

      await sql.end();

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ Mailchimp OAuth sync failed:', error);
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
export const mailchimpOAuthService = new MailchimpOAuthService();