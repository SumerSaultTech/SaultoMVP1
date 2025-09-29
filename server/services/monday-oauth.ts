/**
 * Monday.com OAuth2 integration service extending base OAuth class
 * Uses GraphQL API at https://api.monday.com/v2
 */

import { OAuthServiceBase } from './oauth-base.js';
import {
  TokenResponse,
  SyncResult,
  TableDiscoveryResult,
  OAuthError
} from './oauth-types.js';

interface MondayUserInfo {
  id: string;
  name: string;
  email: string;
  account_id?: string;
  is_admin?: boolean;
  photo_thumb?: string;
  title?: string;
  timezone?: string;
}

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
  extensions?: {
    complexity?: {
      before: number;
      after: number;
      query: number;
    };
  };
}

export class MondayOAuthService extends OAuthServiceBase {

  constructor() {
    super();
  }

  /**
   * Get service type identifier
   */
  getServiceType(): string {
    return 'monday';
  }

  /**
   * Generate authorization URL with company context
   */
  getAuthorizationUrl(companyId: number, userId?: number): string {
    const state = this.generateState(companyId, userId);

    const scopes = [
      'boards:read',
      'users:read',
      'teams:read',
      'updates:read',
      'assets:read',
      'me:read'
    ];

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state,
      scope: scopes.join(' ')
    });

    return `https://auth.monday.com/oauth2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<TokenResponse> {
    try {
      const tokenParams = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code: code,
        grant_type: 'authorization_code',
      });

      const response = await fetch('https://auth.monday.com/oauth2/token', {
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
        refresh_token: tokenData.refresh_token || '',
        expires_in: tokenData.expires_in || 3600,
        token_type: tokenData.token_type || 'bearer',
        scope: tokenData.scope || '',
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const refreshParams = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch('https://auth.monday.com/oauth2/token', {
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
        expires_in: tokenData.expires_in || 3600,
        token_type: tokenData.token_type || 'bearer',
        scope: tokenData.scope || '',
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Execute GraphQL query with rate limiting and complexity tracking
   */
  private async executeGraphQLQuery<T = any>(
    accessToken: string,
    query: string,
    variables?: Record<string, any>,
    maxRetries: number = 3
  ): Promise<GraphQLResponse<T>> {
    let attempt = 0;
    let delay = 1000; // Start with 1 second

    while (attempt <= maxRetries) {
      try {
        const response = await fetch('https://api.monday.com/v2', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: variables || {},
          }),
        });

        if (response.status === 429) {
          // Rate limited - check for Retry-After header
          const retryAfter = response.headers.get('Retry-After');
          const backoffTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;

          if (attempt === maxRetries) {
            throw new Error(`Rate limit exceeded after ${maxRetries} retries`);
          }

          console.log(`🔄 Monday.com rate limited, backing off for ${backoffTime}ms (attempt ${attempt + 1}/${maxRetries})`);
          await this.delay(backoffTime);

          attempt++;
          delay *= 2; // Exponential backoff
          continue;
        }

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
          }
          throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
        }

        const result: GraphQLResponse<T> = await response.json();

        // Log complexity usage if available
        if (result.extensions?.complexity) {
          const complexity = result.extensions.complexity;
          console.log(`📊 Monday.com complexity: ${complexity.query} points (${complexity.before} → ${complexity.after})`);
        }

        // Check for GraphQL errors
        if (result.errors && result.errors.length > 0) {
          const errorMessage = result.errors.map(e => e.message).join(', ');
          throw new Error(`GraphQL errors: ${errorMessage}`);
        }

        return result;
      } catch (error: any) {
        if (error.message?.includes('TOKEN_EXPIRED') || attempt === maxRetries) {
          throw error;
        }

        console.log(`🔄 Monday.com request failed, backing off for ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await this.delay(delay);
        attempt++;
        delay *= 2;
      }
    }

    throw new Error(`Maximum retries (${maxRetries}) exceeded`);
  }

  /**
   * Get user information using GraphQL
   */
  async getUserInfo(accessToken: string): Promise<MondayUserInfo> {
    try {
      const query = `
        query {
          me {
            id
            name
            email
            is_admin
            photo_thumb
            title
            timezone
            account {
              id
              name
            }
          }
        }
      `;

      const result = await this.executeGraphQLQuery<{
        me: MondayUserInfo & { account: { id: string; name: string } };
      }>(accessToken, query);

      if (!result.data?.me) {
        throw new Error('Failed to get user info from Monday.com');
      }

      const userInfo = result.data.me;
      return {
        id: userInfo.id,
        name: userInfo.name,
        email: userInfo.email,
        account_id: userInfo.account?.id,
        is_admin: userInfo.is_admin,
        photo_thumb: userInfo.photo_thumb,
        title: userInfo.title,
        timezone: userInfo.timezone,
      };
    } catch (error) {
      console.error('Failed to get Monday.com user info:', error);
      throw error;
    }
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string): Promise<boolean> {
    try {
      const query = `
        query {
          me {
            id
            name
          }
        }
      `;

      const result = await this.executeGraphQLQuery(accessToken, query);
      return !!(result.data?.me);
    } catch (error) {
      console.error('Failed to test Monday.com API access:', error);
      return false;
    }
  }

  /**
   * Discover available tables - required by base class
   */
  async discoverTables(accessToken: string): Promise<TableDiscoveryResult[]> {
    return this.discoverMondayTables(accessToken);
  }

  /**
   * Discover available Monday.com entities and their fields
   */
  async discoverMondayTables(accessToken: string): Promise<TableDiscoveryResult[]> {
    try {
      const tables = [];

      // Core Monday.com entities
      const coreEntities = [
        // Boards (Companies analogue)
        { name: 'boards', label: 'Boards', isStandard: true },
        // Users (Contacts analogue)
        { name: 'users', label: 'Users', isStandard: true },
        // Items (Deals/Tasks analogue)
        { name: 'items', label: 'Items', isStandard: true },
        // Updates (Activities analogue)
        { name: 'updates', label: 'Updates', isStandard: true },
        // Teams
        { name: 'teams', label: 'Teams', isStandard: false },
        // Workspaces
        { name: 'workspaces', label: 'Workspaces', isStandard: false },
        // Tags
        { name: 'tags', label: 'Tags', isStandard: false },
      ];

      for (const entity of coreEntities) {
        try {
          let query = '';
          let fields: string[] = [];

          switch (entity.name) {
            case 'boards':
              query = `
                query {
                  boards(limit: 1) {
                    id
                    name
                    description
                    state
                    board_kind
                    created_at
                    updated_at
                  }
                }
              `;
              fields = ['id', 'name', 'description', 'state', 'board_kind', 'created_at', 'updated_at'];
              break;

            case 'users':
              query = `
                query {
                  users(limit: 1) {
                    id
                    name
                    email
                    title
                    phone
                    is_admin
                    created_at
                    last_activity
                  }
                }
              `;
              fields = ['id', 'name', 'email', 'title', 'phone', 'is_admin', 'created_at', 'last_activity'];
              break;

            case 'items':
              query = `
                query {
                  boards(limit: 1) {
                    items(limit: 1) {
                      id
                      name
                      state
                      created_at
                      updated_at
                      creator_id
                    }
                  }
                }
              `;
              fields = ['id', 'name', 'state', 'created_at', 'updated_at', 'creator_id'];
              break;

            case 'updates':
              query = `
                query {
                  boards(limit: 1) {
                    updates(limit: 1) {
                      id
                      body
                      created_at
                      updated_at
                      creator_id
                    }
                  }
                }
              `;
              fields = ['id', 'body', 'created_at', 'updated_at', 'creator_id'];
              break;

            case 'teams':
              query = `
                query {
                  teams(limit: 1) {
                    id
                    name
                    picture_url
                  }
                }
              `;
              fields = ['id', 'name', 'picture_url'];
              break;

            case 'workspaces':
              query = `
                query {
                  workspaces(limit: 1) {
                    id
                    name
                    kind
                    description
                    created_at
                  }
                }
              `;
              fields = ['id', 'name', 'kind', 'description', 'created_at'];
              break;

            case 'tags':
              query = `
                query {
                  tags(limit: 1) {
                    id
                    name
                    color
                  }
                }
              `;
              fields = ['id', 'name', 'color'];
              break;
          }

          if (query) {
            const result = await this.executeGraphQLQuery(accessToken, query);

            if (result.data) {
              tables.push({
                name: entity.name,
                label: entity.label,
                fields: fields,
                accessible: true,
                isStandard: entity.isStandard
              });
            }
          }
        } catch (error: any) {
          console.log(`Could not access ${entity.name}:`, error.message);
        }
      }

      return tables.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Failed to discover Monday.com tables:', error);
      return [];
    }
  }

  /**
   * Fetch Monday.com boards with pagination
   */
  async fetchBoards(accessToken: string, limit: number = 100, page: number = 1): Promise<any[]> {
    try {
      const query = `
        query($limit: Int!, $page: Int!) {
          boards(limit: $limit, page: $page) {
            id
            name
            description
            state
            board_kind
            created_at
            updated_at
            workspace {
              id
              name
            }
            owners {
              id
              name
              email
            }
            permissions
          }
        }
      `;

      const result = await this.executeGraphQLQuery<{
        boards: any[];
      }>(accessToken, query, { limit, page });

      return result.data?.boards || [];
    } catch (error) {
      console.error('Failed to fetch Monday.com boards:', error);
      throw error;
    }
  }

  /**
   * Fetch Monday.com users with pagination
   */
  async fetchUsers(accessToken: string, limit: number = 100, page: number = 1): Promise<any[]> {
    try {
      const query = `
        query($limit: Int!, $page: Int!) {
          users(limit: $limit, page: $page) {
            id
            name
            email
            title
            phone
            mobile_phone
            is_admin
            is_guest
            is_pending
            enabled
            created_at
            last_activity
            photo_thumb
            photo_original
            timezone
            location
            account {
              id
              name
            }
            teams {
              id
              name
            }
          }
        }
      `;

      const result = await this.executeGraphQLQuery<{
        users: any[];
      }>(accessToken, query, { limit, page });

      return result.data?.users || [];
    } catch (error) {
      console.error('Failed to fetch Monday.com users:', error);
      throw error;
    }
  }

  /**
   * Fetch Monday.com items from boards with pagination and incremental sync
   */
  async fetchItems(
    accessToken: string,
    boardIds?: string[],
    limit: number = 100,
    page: number = 1,
    newerThan?: string
  ): Promise<any[]> {
    try {
      let query = '';
      let variables: any = { limit, page };

      if (boardIds && boardIds.length > 0) {
        query = `
          query($boardIds: [ID!]!, $limit: Int!, $page: Int!) {
            boards(ids: $boardIds) {
              id
              name
              items(limit: $limit, page: $page) {
                id
                name
                state
                created_at
                updated_at
                creator_id
                creator {
                  id
                  name
                  email
                }
                board {
                  id
                  name
                }
                column_values {
                  id
                  text
                  value
                  column {
                    id
                    title
                    type
                  }
                }
                updates {
                  id
                  body
                  created_at
                  creator_id
                }
              }
            }
          }
        `;
        variables.boardIds = boardIds;
      } else {
        query = `
          query($limit: Int!, $page: Int!) {
            boards(limit: 50) {
              id
              name
              items(limit: $limit, page: $page) {
                id
                name
                state
                created_at
                updated_at
                creator_id
                creator {
                  id
                  name
                  email
                }
                board {
                  id
                  name
                }
                column_values {
                  id
                  text
                  value
                  column {
                    id
                    title
                    type
                  }
                }
              }
            }
          }
        `;
      }

      const result = await this.executeGraphQLQuery<{
        boards: Array<{
          id: string;
          name: string;
          items: any[];
        }>;
      }>(accessToken, query, variables);

      // Flatten items from all boards
      let allItems: any[] = [];
      if (result.data?.boards) {
        for (const board of result.data.boards) {
          allItems.push(...board.items);
        }
      }

      // Filter by newerThan if provided
      if (newerThan) {
        const cutoffDate = new Date(newerThan);
        allItems = allItems.filter(item => {
          const updatedAt = new Date(item.updated_at);
          return updatedAt > cutoffDate;
        });
      }

      return allItems;
    } catch (error) {
      console.error('Failed to fetch Monday.com items:', error);
      throw error;
    }
  }

  /**
   * Fetch Monday.com updates (activities) with pagination
   */
  async fetchUpdates(
    accessToken: string,
    boardIds?: string[],
    limit: number = 100,
    page: number = 1,
    newerThan?: string
  ): Promise<any[]> {
    try {
      let query = '';
      let variables: any = { limit, page };

      if (boardIds && boardIds.length > 0) {
        query = `
          query($boardIds: [ID!]!, $limit: Int!, $page: Int!) {
            boards(ids: $boardIds) {
              id
              name
              updates(limit: $limit, page: $page) {
                id
                body
                text_body
                created_at
                updated_at
                creator_id
                creator {
                  id
                  name
                  email
                }
                replies {
                  id
                  body
                  created_at
                  creator_id
                }
                assets {
                  id
                  name
                  url
                  file_extension
                  file_size
                }
              }
            }
          }
        `;
        variables.boardIds = boardIds;
      } else {
        query = `
          query($limit: Int!, $page: Int!) {
            boards(limit: 50) {
              id
              name
              updates(limit: $limit, page: $page) {
                id
                body
                text_body
                created_at
                updated_at
                creator_id
                creator {
                  id
                  name
                  email
                }
              }
            }
          }
        `;
      }

      const result = await this.executeGraphQLQuery<{
        boards: Array<{
          id: string;
          name: string;
          updates: any[];
        }>;
      }>(accessToken, query, variables);

      // Flatten updates from all boards
      let allUpdates: any[] = [];
      if (result.data?.boards) {
        for (const board of result.data.boards) {
          allUpdates.push(...board.updates);
        }
      }

      // Filter by newerThan if provided
      if (newerThan) {
        const cutoffDate = new Date(newerThan);
        allUpdates = allUpdates.filter(update => {
          const updatedAt = new Date(update.updated_at || update.created_at);
          return updatedAt > cutoffDate;
        });
      }

      return allUpdates;
    } catch (error) {
      console.error('Failed to fetch Monday.com updates:', error);
      throw error;
    }
  }

  /**
   * Create webhook for real-time updates
   */
  async createWebhook(accessToken: string, boardId: string, callbackUrl: string): Promise<any> {
    try {
      const query = `
        mutation($boardId: ID!, $url: String!, $event: WebhookEventType!) {
          create_webhook(board_id: $boardId, url: $url, event: $event) {
            id
            board_id
            config
          }
        }
      `;

      const result = await this.executeGraphQLQuery(accessToken, query, {
        boardId,
        url: callbackUrl,
        event: 'change_column_value' // or 'create_item', 'change_status', etc.
      });

      return result.data?.create_webhook;
    } catch (error) {
      console.error('Failed to create Monday.com webhook:', error);
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(accessToken: string, webhookId: string): Promise<void> {
    try {
      const query = `
        mutation($webhookId: ID!) {
          delete_webhook(id: $webhookId) {
            id
          }
        }
      `;

      await this.executeGraphQLQuery(accessToken, query, { webhookId });
    } catch (error) {
      console.error('Failed to delete Monday.com webhook:', error);
      throw error;
    }
  }

  /**
   * Process webhook payload and normalize data
   */
  async processWebhookPayload(payload: any): Promise<{ type: string; data: any; boardId?: string }> {
    try {
      const eventType = payload.type || payload.event?.type;
      const eventData = payload.data || payload;

      let normalizedData: any = {};

      switch (eventType) {
        case 'create_item':
        case 'change_column_value':
        case 'change_status':
        case 'update_item':
          normalizedData = {
            id: eventData.item_id || eventData.pulseId,
            name: eventData.item_name || eventData.pulseName,
            board_id: eventData.board_id || eventData.boardId,
            column_id: eventData.column_id,
            value: eventData.value,
            previous_value: eventData.previous_value,
            user_id: eventData.user_id || eventData.userId,
            timestamp: new Date().toISOString(),
            event_type: eventType
          };
          break;

        default:
          console.log(`Unknown Monday.com webhook event type: ${eventType}`);
          normalizedData = eventData;
      }

      return {
        type: eventType,
        data: normalizedData,
        boardId: eventData.board_id || eventData.boardId
      };
    } catch (error) {
      console.error('Failed to process Monday.com webhook payload:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for Monday.com data (raw → stg → int → core)
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;

    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;

      // Clean up existing transformation objects
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_monday_companies`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_monday_contacts`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_monday_deals`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_monday_activities`;

      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_monday_companies`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_monday_contacts`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_monday_deals`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_monday_activities`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_monday_updates`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_monday_items`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_monday_users`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_monday_boards`;

      // STG: monday_boards - normalized companies (boards)
      await sql`
        CREATE TABLE ${sql(schema)}.stg_monday_boards AS
        SELECT DISTINCT
          data->>'id' as board_id,
          data->>'name' as board_name,
          data->>'description' as description,
          data->>'state' as state,
          data->>'board_kind' as board_kind,
          (data->>'created_at')::timestamp as created_at,
          (data->>'updated_at')::timestamp as updated_at,
          data#>>'{workspace,id}' as workspace_id,
          data#>>'{workspace,name}' as workspace_name,
          data->>'permissions' as permissions,
          data as raw_data
        FROM ${sql(schema)}.raw_monday_boards
        WHERE data IS NOT NULL
      `;

      // STG: monday_users - normalized contacts
      await sql`
        CREATE TABLE ${sql(schema)}.stg_monday_users AS
        SELECT DISTINCT
          data->>'id' as user_id,
          data->>'name' as name,
          data->>'email' as email,
          data->>'title' as title,
          data->>'phone' as phone,
          data->>'mobile_phone' as mobile_phone,
          CASE WHEN data->>'is_admin' = 'true' THEN true ELSE false END as is_admin,
          CASE WHEN data->>'is_guest' = 'true' THEN true ELSE false END as is_guest,
          CASE WHEN data->>'enabled' = 'true' THEN true ELSE false END as enabled,
          (data->>'created_at')::timestamp as created_at,
          (data->>'last_activity')::timestamp as last_activity,
          data->>'photo_thumb' as photo_thumb,
          data->>'timezone' as timezone,
          data->>'location' as location,
          data#>>'{account,id}' as account_id,
          data#>>'{account,name}' as account_name,
          data as raw_data
        FROM ${sql(schema)}.raw_monday_users
        WHERE data IS NOT NULL
      `;

      // STG: monday_items - normalized deals/tasks
      await sql`
        CREATE TABLE ${sql(schema)}.stg_monday_items AS
        SELECT DISTINCT
          data->>'id' as item_id,
          data->>'name' as item_name,
          data->>'state' as state,
          (data->>'created_at')::timestamp as created_at,
          (data->>'updated_at')::timestamp as updated_at,
          data->>'creator_id' as creator_id,
          data#>>'{creator,name}' as creator_name,
          data#>>'{creator,email}' as creator_email,
          data#>>'{board,id}' as board_id,
          data#>>'{board,name}' as board_name,
          data->'column_values' as column_values,
          data as raw_data
        FROM ${sql(schema)}.raw_monday_items
        WHERE data IS NOT NULL
      `;

      // STG: monday_updates - normalized activities
      await sql`
        CREATE TABLE ${sql(schema)}.stg_monday_updates AS
        SELECT DISTINCT
          data->>'id' as update_id,
          data->>'body' as body,
          data->>'text_body' as text_body,
          (data->>'created_at')::timestamp as created_at,
          (data->>'updated_at')::timestamp as updated_at,
          data->>'creator_id' as creator_id,
          data#>>'{creator,name}' as creator_name,
          data#>>'{creator,email}' as creator_email,
          data->>'source_board_id' as board_id,
          data->>'source_board_name' as board_name,
          data as raw_data
        FROM ${sql(schema)}.raw_monday_updates
        WHERE data IS NOT NULL
      `;

      // INT: monday_companies - enriched company data (from boards)
      await sql`
        CREATE TABLE ${sql(schema)}.int_monday_companies AS
        SELECT
          board_id,
          board_name,
          description,
          state,
          board_kind,
          created_at,
          updated_at,
          workspace_id,
          workspace_name,
          permissions,
          -- Calculated fields
          CASE
            WHEN state = 'active' THEN 'Active'
            WHEN state = 'archived' THEN 'Inactive'
            ELSE 'Unknown'
          END as company_status,
          CASE
            WHEN board_kind = 'public' THEN 'Public Board'
            WHEN board_kind = 'private' THEN 'Private Board'
            WHEN board_kind = 'share' THEN 'Shared Board'
            ELSE 'Standard Board'
          END as board_type_label
        FROM ${sql(schema)}.stg_monday_boards
      `;

      // INT: monday_contacts - enriched contact data
      await sql`
        CREATE TABLE ${sql(schema)}.int_monday_contacts AS
        SELECT
          user_id,
          name,
          email,
          title,
          phone,
          mobile_phone,
          is_admin,
          is_guest,
          enabled,
          created_at,
          last_activity,
          photo_thumb,
          timezone,
          location,
          account_id,
          account_name,
          -- Calculated fields
          CASE
            WHEN enabled = true THEN 'Active'
            ELSE 'Inactive'
          END as contact_status,
          CASE
            WHEN is_admin = true THEN 'Administrator'
            WHEN is_guest = true THEN 'Guest'
            ELSE 'Regular User'
          END as user_type,
          CASE
            WHEN last_activity > (CURRENT_TIMESTAMP - INTERVAL '30 days') THEN 'Recently Active'
            WHEN last_activity > (CURRENT_TIMESTAMP - INTERVAL '90 days') THEN 'Moderately Active'
            ELSE 'Inactive'
          END as activity_level
        FROM ${sql(schema)}.stg_monday_users
      `;

      // INT: monday_deals - enriched deal/item data
      await sql`
        CREATE TABLE ${sql(schema)}.int_monday_deals AS
        SELECT
          item_id,
          item_name,
          state,
          created_at,
          updated_at,
          creator_id,
          creator_name,
          creator_email,
          board_id,
          board_name,
          column_values,
          -- Calculated fields
          CASE
            WHEN state = 'active' THEN 'Open'
            WHEN state = 'done' THEN 'Closed Won'
            WHEN state = 'stuck' THEN 'Stalled'
            ELSE 'Unknown'
          END as deal_status,
          EXTRACT(EPOCH FROM (updated_at - created_at))/86400 as days_in_pipeline
        FROM ${sql(schema)}.stg_monday_items
      `;

      // INT: monday_activities - enriched activity data
      await sql`
        CREATE TABLE ${sql(schema)}.int_monday_activities AS
        SELECT
          update_id,
          body,
          text_body,
          created_at,
          updated_at,
          creator_id,
          creator_name,
          creator_email,
          board_id,
          board_name,
          -- Calculated fields
          CASE
            WHEN LENGTH(text_body) > 500 THEN 'Long Update'
            WHEN LENGTH(text_body) > 100 THEN 'Medium Update'
            ELSE 'Short Update'
          END as update_length_category,
          'Monday.com Update' as activity_type
        FROM ${sql(schema)}.stg_monday_updates
      `;

      // CORE: Views that mirror int tables
      await sql`
        CREATE VIEW ${sql(schema)}.core_monday_companies AS
        SELECT * FROM ${sql(schema)}.int_monday_companies
      `;

      await sql`
        CREATE VIEW ${sql(schema)}.core_monday_contacts AS
        SELECT * FROM ${sql(schema)}.int_monday_contacts
      `;

      await sql`
        CREATE VIEW ${sql(schema)}.core_monday_deals AS
        SELECT * FROM ${sql(schema)}.int_monday_deals
      `;

      await sql`
        CREATE VIEW ${sql(schema)}.core_monday_activities AS
        SELECT * FROM ${sql(schema)}.int_monday_activities
      `;

    } catch (error) {
      console.error('❌ Monday.com transformation pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Sync Monday.com data to company analytics schema using stored OAuth tokens
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
      const mondaySource = dataSources.find(ds => ds.type === 'monday');

      if (!mondaySource || !mondaySource.config) {
        throw new Error('No Monday.com OAuth tokens found for this company');
      }

      const config = mondaySource.config as any || {};
      const { accessToken } = config;

      if (!accessToken) {
        throw new Error('Invalid OAuth configuration - missing access token');
      }

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Fetch and sync boards (companies)
      const boards = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchBoards(token, 100, 1)
      );

      if (boards.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'monday_boards', boards, 'monday_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_monday_boards');
      }

      // Fetch and sync users (contacts)
      const users = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchUsers(token, 100, 1)
      );

      if (users.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'monday_users', users, 'monday_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_monday_users');
      }

      // Fetch and sync items (deals) from all boards
      const boardIds = boards.map(board => board.id);
      const items = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchItems(token, boardIds, 100, 1)
      );

      if (items.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'monday_items', items, 'monday_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_monday_items');
      }

      // Fetch and sync updates (activities)
      const updates = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchUpdates(token, boardIds, 100, 1)
      );

      // Add board context to updates
      const updatesWithContext = updates.map(update => ({
        ...update,
        source_board_id: update.board?.id,
        source_board_name: update.board?.name
      }));

      if (updatesWithContext.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'monday_updates', updatesWithContext, 'monday_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_monday_updates');
      }

      // Run dbt-style transformations
      try {
        await this.runTransformations(companyId, sql);
      } catch (transformError) {
        console.error('❌ Monday.com transformation failed:', transformError);
      }

      await sql.end();

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ Monday.com OAuth sync failed:', error);
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
export const mondayOAuthService = new MondayOAuthService();