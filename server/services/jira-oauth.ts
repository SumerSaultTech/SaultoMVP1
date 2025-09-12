/**
 * Jira OAuth2 integration service
 */

interface JiraOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface JiraTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}

interface JiraUserInfo {
  account_id: string;
  name: string;
  email: string;
  picture?: string;
}

export class JiraOAuthService {
  private config: JiraOAuthConfig;

  constructor() {
    this.config = {
      clientId: process.env.JIRA_OAUTH_CLIENT_ID || '',
      clientSecret: process.env.JIRA_OAUTH_CLIENT_SECRET || '',
      redirectUri: `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/jira/callback`
    };
  }

  /**
   * Generate state with company and user info for multi-tenant support
   */
  generateState(companyId: number, userId?: number): string {
    const stateData = {
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
  parseState(state: string): { companyId: number; userId?: number; timestamp: number; nonce: string } {
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
      // Simple initialization - just validate config
      if (!this.config.clientId || !this.config.clientSecret) {
        throw new Error('Missing Jira OAuth credentials');
      }
      // Jira OAuth client initialized successfully
    } catch (error) {
      console.error('Failed to initialize Jira OAuth client:', error);
      throw error;
    }
  }

  /**
   * Generate authorization URL with company context
   */
  getAuthorizationUrl(companyId: number, userId?: number): string {
    const state = this.generateState(companyId, userId);
    
    const scopes = [
      'read:jira-work',
      'read:jira-user', 
      'read:account',   // For user profile access
      'offline_access'  // For refresh tokens
    ];

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state,
      audience: 'api.atlassian.com'
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<JiraTokenResponse> {
    try {
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        redirect_uri: this.config.redirectUri,
      });

      const response = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: tokenParams.toString(),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const tokenData = await response.json();

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 3600,
        scope: tokenData.scope || '',
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(accessToken: string): Promise<JiraUserInfo> {
    try {
      const response = await fetch('https://api.atlassian.com/me', {
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
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
      };
    } catch (error) {
      console.error('Failed to get user info:', error);
      throw error;
    }
  }

  /**
   * Get accessible resources (Jira instances)
   */
  async getAccessibleResources(accessToken: string): Promise<any[]> {
    try {
      const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get accessible resources: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get accessible resources:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<JiraTokenResponse> {
    try {
      const refreshParams = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await fetch('https://auth.atlassian.com/oauth/token', {
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
        scope: tokenData.scope || '',
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string, cloudId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/myself`, {
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
   * Discover available Jira tables and their fields dynamically
   */
  async discoverJiraTables(accessToken: string, cloudId: string): Promise<any[]> {
    try {
      const tables = [];

      // Comprehensive Jira entities based on Fivetran's schema
      const coreEntities = [
        // Core Issue Management
        { name: 'issue', label: 'Issues', endpoint: '/rest/api/3/search?maxResults=1', fieldsEndpoint: '/rest/api/3/field' },
        { name: 'issue_field_history', label: 'Issue Field History', endpoint: '/rest/api/3/issue', fieldsEndpoint: null },
        { name: 'issue_link', label: 'Issue Links', endpoint: '/rest/api/3/issuelinktype', fieldsEndpoint: null },
        { name: 'issue_remote_link', label: 'Issue Remote Links', endpoint: '/rest/api/3/issue', fieldsEndpoint: null },
        { name: 'issue_type', label: 'Issue Types', endpoint: '/rest/api/3/issuetype', fieldsEndpoint: null },
        { name: 'issue_user_vote', label: 'Issue User Votes', endpoint: '/rest/api/3/issue', fieldsEndpoint: null },
        
        // Projects & Organization
        { name: 'project', label: 'Projects', endpoint: '/rest/api/3/project/search', fieldsEndpoint: null },
        { name: 'project_category', label: 'Project Categories', endpoint: '/rest/api/3/projectCategory', fieldsEndpoint: null },
        { name: 'project_role', label: 'Project Roles', endpoint: '/rest/api/3/role', fieldsEndpoint: null },
        { name: 'project_version', label: 'Project Versions', endpoint: '/rest/api/3/version', fieldsEndpoint: null },
        { name: 'component', label: 'Components', endpoint: '/rest/api/3/component', fieldsEndpoint: null },
        
        // Users & Groups  
        { name: 'user', label: 'Users', endpoint: '/rest/api/3/users/search', fieldsEndpoint: null },
        { name: 'group', label: 'Groups', endpoint: '/rest/api/3/groups/picker', fieldsEndpoint: null },
        { name: 'application_role', label: 'Application Roles', endpoint: '/rest/api/3/applicationrole', fieldsEndpoint: null },
        
        // Agile & Sprints (if available)
        { name: 'sprint', label: 'Sprints', endpoint: '/rest/agile/1.0/sprint', fieldsEndpoint: null },
        { name: 'board', label: 'Boards', endpoint: '/rest/agile/1.0/board', fieldsEndpoint: null },
        { name: 'sprint_board', label: 'Sprint Board Relationships', endpoint: '/rest/agile/1.0/board', fieldsEndpoint: null },
        { name: 'epic', label: 'Epics', endpoint: '/rest/agile/1.0/epic', fieldsEndpoint: null },
        
        // Time Tracking & Work
        { name: 'worklog', label: 'Worklogs', endpoint: '/rest/api/3/worklog/updated', fieldsEndpoint: null },
        { name: 'time_tracking', label: 'Time Tracking', endpoint: '/rest/api/3/configuration/timetracking', fieldsEndpoint: null },
        
        // Content & Communication
        { name: 'comment', label: 'Comments', endpoint: '/rest/api/3/comment', fieldsEndpoint: null },
        { name: 'attachment', label: 'Attachments', endpoint: '/rest/api/3/attachment/meta', fieldsEndpoint: null },
        
        // Configuration & Metadata
        { name: 'field', label: 'Fields', endpoint: '/rest/api/3/field', fieldsEndpoint: null },
        { name: 'field_option', label: 'Field Options', endpoint: '/rest/api/3/field', fieldsEndpoint: null },
        { name: 'field_project', label: 'Field Project Configuration', endpoint: '/rest/api/3/field', fieldsEndpoint: null },
        { name: 'priority', label: 'Priorities', endpoint: '/rest/api/3/priority', fieldsEndpoint: null },
        { name: 'resolution', label: 'Resolutions', endpoint: '/rest/api/3/resolution', fieldsEndpoint: null },
        { name: 'status', label: 'Statuses', endpoint: '/rest/api/3/status', fieldsEndpoint: null },
        { name: 'status_category', label: 'Status Categories', endpoint: '/rest/api/3/statuscategory', fieldsEndpoint: null },
        
        // Workflows & Permissions
        { name: 'workflow', label: 'Workflows', endpoint: '/rest/api/3/workflow', fieldsEndpoint: null },
        { name: 'workflow_scheme', label: 'Workflow Schemes', endpoint: '/rest/api/3/workflowscheme', fieldsEndpoint: null },
        { name: 'permission_scheme', label: 'Permission Schemes', endpoint: '/rest/api/3/permissionscheme', fieldsEndpoint: null },
        { name: 'notification_scheme', label: 'Notification Schemes', endpoint: '/rest/api/3/notificationscheme', fieldsEndpoint: null },
        
        // Service Desk (if available)
        { name: 'sla', label: 'SLA', endpoint: '/rest/servicedeskapi/servicedesk', fieldsEndpoint: null },
        { name: 'request_type', label: 'Request Types', endpoint: '/rest/servicedeskapi/servicedesk', fieldsEndpoint: null },
        
        // Filters & Dashboards
        { name: 'filter', label: 'Filters', endpoint: '/rest/api/3/filter/search', fieldsEndpoint: null },
        { name: 'dashboard', label: 'Dashboards', endpoint: '/rest/api/3/dashboard/search', fieldsEndpoint: null },
      ];

      for (const entity of coreEntities) {
        try {
          // Test if we can access this entity
          const testResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}${entity.endpoint}?maxResults=1`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          if (testResponse.ok) {
            let fields = [];
            
            // Get fields for issues specifically
            if (entity.fieldsEndpoint && entity.name === 'issue') {
              const fieldsResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}${entity.fieldsEndpoint}`, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/json',
                },
              });
              
              if (fieldsResponse.ok) {
                const fieldsData = await fieldsResponse.json();
                fields = fieldsData.slice(0, 10).map((field: any) => field.name || field.key);
              }
            } else {
              // Get sample data to infer fields
              const sampleResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}${entity.endpoint}?maxResults=1`, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/json',
                },
              });
              
              if (sampleResponse.ok) {
                const sampleData = await sampleResponse.json();
                const firstItem = sampleData.values?.[0] || sampleData[0] || sampleData;
                if (firstItem && typeof firstItem === 'object') {
                  fields = Object.keys(firstItem).slice(0, 8);
                }
              }
            }

            tables.push({
              name: entity.name,
              label: entity.label,
              fields: fields,
              accessible: true,
              isStandard: ['issue', 'project', 'user', 'sprint', 'worklog'].includes(entity.name)
            });
          }
        } catch (error) {
          console.log(`Could not access ${entity.name}:`, error.message);
        }
      }

      return tables.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Failed to discover Jira tables:', error);
      return [];
    }
  }

  /**
   * Fetch Jira issues using OAuth token with automatic token refresh
   */
  async fetchIssues(accessToken: string, cloudId: string, maxResults: number = 100, retryCount: number = 0): Promise<any[]> {
    try {
      let allIssues: any[] = [];
      let startAt = 0;
      let total = 0;

      do {
        const url = `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search?maxResults=${Math.min(maxResults, 100)}&startAt=${startAt}&expand=changelog,renderedFields`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          // Handle 401 Unauthorized - try to refresh token
          if (response.status === 401 && retryCount === 0) {
              throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
          }
          throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allIssues.push(...data.issues);
        
        total = data.total;
        startAt += data.issues.length;
        
        // Fetched ${allIssues.length}/${total} issues
        
      } while (allIssues.length < total && allIssues.length < maxResults);

      return allIssues;
    } catch (error) {
      console.error('Failed to fetch Jira issues:', error);
      throw error;
    }
  }

  /**
   * Fetch Jira projects using OAuth token
   */
  async fetchProjects(accessToken: string, cloudId: string): Promise<any[]> {
    try {
      const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/project/search`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
        }
        throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.values || [];
    } catch (error) {
      console.error('Failed to fetch Jira projects:', error);
      throw error;
    }
  }

  /**
   * Fetch Jira users using OAuth token
   */
  async fetchUsers(accessToken: string, cloudId: string): Promise<any[]> {
    try {
      let allUsers: any[] = [];
      let startAt = 0;
      const maxResults = 50;

      do {
        const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/users/search?startAt=${startAt}&maxResults=${maxResults}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
          }
          break; // Some users may not be accessible
        }

        const users = await response.json();
        if (!Array.isArray(users) || users.length === 0) {
          break;
        }

        allUsers.push(...users);
        startAt += users.length;
        
      } while (allUsers.length < 1000); // Reasonable limit

      return allUsers;
    } catch (error) {
      console.error('Failed to fetch Jira users:', error);
      return []; // Don't fail sync if users can't be fetched
    }
  }

  /**
   * Run dbt-style transformations for a company's data (raw → stg → int → core)
   * This is a generic pipeline that will work for all 700+ connections
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;
    
    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
      
      // Cleaning up existing transformation objects
      // Drop views first (they depend on tables)
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_jira_issues`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_jira_users`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_jira_projects`;
      
      // Drop tables in reverse dependency order
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_jira_issues`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_jira_projects`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_jira_users`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_jira_users`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_jira_projects`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_jira_issues`;
      
      // Creating staging tables (stg)
      
      // STG: jira_issues - normalized and cleaned
      await sql`
        CREATE TABLE ${sql(schema)}.stg_jira_issues AS
        SELECT DISTINCT 
          (data->>'id')::integer as issue_id,
          data->>'key' as issue_key,
          data#>>'{fields,summary}' as title,
          data#>>'{fields,status,name}' as status,
          data#>>'{fields,status,statusCategory,key}' as status_category,
          (data#>>'{fields,created}')::timestamp as created_at,
          (data#>>'{fields,updated}')::timestamp as updated_at,
          CASE WHEN data#>>'{fields,resolutiondate}' IS NOT NULL 
               THEN (data#>>'{fields,resolutiondate}')::timestamp 
               ELSE NULL END as resolved_at,
          data#>>'{fields,assignee,displayName}' as assignee_name,
          data#>>'{fields,assignee,accountId}' as assignee_id,
          data#>>'{fields,reporter,displayName}' as reporter_name,
          data#>>'{fields,reporter,accountId}' as reporter_id,
          data#>>'{fields,priority,name}' as priority,
          data#>>'{fields,issuetype,name}' as issue_type,
          (data#>>'{fields,project,id}')::integer as project_id,
          data#>>'{fields,project,key}' as project_key,
          data#>>'{fields,project,name}' as project_name,
          COALESCE((data#>>'{fields,customfield_10016}')::numeric, 0) as story_points,
          data as raw_data
        FROM ${sql(schema)}.raw_jira_issues
        WHERE data IS NOT NULL
      `;
      
      // STG: jira_users - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_jira_users AS
        SELECT DISTINCT
          data#>>'{accountId}' as user_id,
          data#>>'{displayName}' as display_name,
          data#>>'{emailAddress}' as email,
          CASE WHEN data#>>'{active}' = 'true' THEN true ELSE false END as is_active,
          data#>>'{timeZone}' as timezone,
          'Unknown' as team -- Default team, can be enriched later
        FROM ${sql(schema)}.raw_jira_users
        WHERE data IS NOT NULL AND data#>>'{accountId}' IS NOT NULL
      `;
      
      // STG: jira_projects - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_jira_projects AS  
        SELECT DISTINCT
          (data#>>'{id}')::integer as project_id,
          data#>>'{key}' as project_key,
          data#>>'{name}' as project_name,
          data#>>'{projectTypeKey}' as project_type,
          data#>>'{lead,displayName}' as lead_name
        FROM ${sql(schema)}.raw_jira_projects
        WHERE data IS NOT NULL
      `;
      
      // Creating integration tables (int)
      
      // INT: jira_users - enriched user data with calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_jira_users AS
        SELECT 
          user_id,
          display_name,
          email,
          is_active,
          timezone,
          team,
          -- Calculated fields
          CASE WHEN is_active THEN 'Active' ELSE 'Inactive' END as user_status,
          CASE WHEN email IS NOT NULL THEN 'Has Email' ELSE 'No Email' END as email_status
        FROM ${sql(schema)}.stg_jira_users
      `;
      
      // INT: jira_projects - enriched project data
      await sql`
        CREATE TABLE ${sql(schema)}.int_jira_projects AS
        SELECT 
          project_id,
          project_key,
          project_name,
          project_type,
          lead_name,
          -- Calculated fields
          UPPER(project_key) as project_key_upper,
          LENGTH(project_name) as project_name_length,
          CASE WHEN project_type = 'software' THEN 'Development' ELSE 'Other' END as project_category
        FROM ${sql(schema)}.stg_jira_projects
      `;
      
      // INT: jira_issues - enriched with joins and calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_jira_issues AS
        SELECT 
          i.issue_id,
          i.issue_key,
          i.title,
          i.status,
          i.status_category,
          i.created_at,
          i.updated_at,
          i.resolved_at,
          i.assignee_name,
          i.assignee_id,
          i.reporter_name, 
          i.reporter_id,
          i.priority,
          i.issue_type,
          i.project_id,
          i.project_key,
          i.project_name,
          i.story_points,
          -- Calculated fields
          CASE WHEN i.resolved_at IS NOT NULL 
               THEN EXTRACT(EPOCH FROM (i.resolved_at - i.created_at))/86400 
               ELSE NULL END as cycle_time_days,
          CASE WHEN i.resolved_at IS NOT NULL THEN 'Completed' ELSE 'In Progress' END as completion_status,
          -- User enrichment from int layer
          u.display_name as assignee_full_name,
          u.email as assignee_email,
          u.team as assignee_team,
          u.user_status as assignee_status,
          -- Project enrichment from int layer
          p.project_type,
          p.lead_name as project_lead,
          p.project_category
        FROM ${sql(schema)}.stg_jira_issues i
        LEFT JOIN ${sql(schema)}.int_jira_users u ON i.assignee_id = u.user_id
        LEFT JOIN ${sql(schema)}.int_jira_projects p ON i.project_id = p.project_id
      `;
      
      // Creating core views
      
      // CORE: Views that mirror int tables (no aggregation)
      await sql`
        CREATE VIEW ${sql(schema)}.core_jira_issues AS 
        SELECT * FROM ${sql(schema)}.int_jira_issues
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_jira_users AS
        SELECT * FROM ${sql(schema)}.int_jira_users  
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_jira_projects AS
        SELECT * FROM ${sql(schema)}.int_jira_projects
      `;
      
      // Transformation pipeline completed (raw → stg → int → core)
      
    } catch (error) {
      console.error('❌ Transformation pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Execute API call with automatic token refresh on 401 errors
   */
  async executeWithTokenRefresh<T>(
    companyId: number, 
    apiCall: (accessToken: string) => Promise<T>
  ): Promise<T> {
    // executeWithTokenRefresh called
    const storage = await import('../storage');
    
    // Get current tokens from database
    const jiraSource = await storage.storage.getDataSourcesByCompany(companyId)
      .then(sources => sources.find(ds => ds.type === 'jira'));
    
    if (!jiraSource?.config) {
      throw new Error('No Jira OAuth tokens found for this company');
    }

    const config = jiraSource.config || {};
    let { accessToken, refreshToken } = config;

    try {
      // Calling API with current access token
      // Try the API call with current access token
      return await apiCall(accessToken);
    } catch (error: any) {
      // API call failed with error
      // Check if it's a token expiration error
      if (error.message?.includes('TOKEN_EXPIRED') || error.message?.includes('401')) {
        // Access token expired, refreshing automatically
        
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

          await storage.storage.updateDataSource(jiraSource.id, {
            config: updatedConfig,
          });

          // Access token refreshed successfully

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
   * Sync Jira data to company analytics schema using stored OAuth tokens
   */
  async syncDataToSchema(companyId: number): Promise<{ success: boolean; recordsSynced: number; tablesCreated: string[]; error?: string }> {
    try {
      // Instead of importing Python PostgresLoader, we'll use Node.js database direct access
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

      // Starting Jira OAuth sync
      
      // Get stored OAuth tokens from database
      const storage = (await import('../storage')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const jiraSource = dataSources.find(ds => ds.type === 'jira');
      
      if (!jiraSource || !jiraSource.config) {
        throw new Error('No Jira OAuth tokens found for this company');
      }

      const config = jiraSource.config || {};
      const { accessToken, resources } = config;
      
      if (!accessToken || !resources || resources.length === 0) {
        throw new Error('Invalid OAuth configuration');
      }

      const cloudId = resources[0].id;
      const baseUrl = resources[0].url;
      
      // Using Jira instance

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

      // Fetch and sync issues (most important table) with automatic token refresh
      // Fetching Jira issues
      const issues = await this.executeWithTokenRefresh(companyId, 
        (token) => this.fetchIssues(token, cloudId, 500)
      );
      // executeWithTokenRefresh completed
      if (issues.length > 0) {
        const recordsLoaded = await insertDataToSchema('jira_issues', issues, 'jira_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_jira_issues');
        // Synced issues
      }

      // Fetch and sync projects with automatic token refresh
      // Fetching Jira projects
      const projects = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchProjects(token, cloudId)
      );
      if (projects.length > 0) {
        const recordsLoaded = await insertDataToSchema('jira_projects', projects, 'jira_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_jira_projects');
        // Synced projects
      }

      // Fetch and sync users with automatic token refresh
      // Fetching Jira users
      const users = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchUsers(token, cloudId)
      );
      if (users.length > 0) {
        const recordsLoaded = await insertDataToSchema('jira_users', users, 'jira_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_jira_users');
        // Synced users
      }
      
      // Run automatic dbt-style transformations
      // Running dbt-style transformations
      try {
        await this.runTransformations(companyId, sql);
        // Transformations completed successfully
      } catch (transformError) {
        console.error('❌ Transformation failed:', transformError);
        // Continue with sync even if transformations fail
      }
      
      // Close database connection
      await sql.end();

      // Jira OAuth sync completed

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ Jira OAuth sync failed:', error);
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
export const jiraOAuthService = new JiraOAuthService();