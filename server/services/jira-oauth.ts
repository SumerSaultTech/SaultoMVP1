/**
 * Jira OAuth2 integration service extending base OAuth class
 */

import { OAuthServiceBase } from './oauth-base.js';
import { 
  TokenResponse, 
  SyncResult, 
  TableDiscoveryResult,
  OAuthError 
} from './oauth-types.js';

interface JiraUserInfo {
  account_id: string;
  name: string;
  email: string;
  picture?: string;
}

export class JiraOAuthService extends OAuthServiceBase {
  
  constructor() {
    super();
    console.log('🔍 JIRA_OAUTH_CLIENT_ID:', process.env.JIRA_OAUTH_CLIENT_ID ? 'SET' : 'NOT SET');
    console.log('🔍 JIRA_OAUTH_CLIENT_SECRET:', process.env.JIRA_OAUTH_CLIENT_SECRET ? 'SET' : 'NOT SET');
  }

  /**
   * Get service type identifier
   */
  getServiceType(): string {
    return 'jira';
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
      audience: 'api.atlassian.com',
      prompt: 'consent'
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
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
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      console.log(`🔄 [JIRA] Starting token refresh process`);
      console.log(`🔄 - Refresh Token: ${refreshToken ? `${refreshToken.substring(0, 20)}...` : 'MISSING'}`);
      console.log(`🔄 - Client ID: ${this.config.clientId ? 'SET' : 'MISSING'}`);
      console.log(`🔄 - Client Secret: ${this.config.clientSecret ? 'SET' : 'MISSING'}`);

      // Atlassian requires JSON format for refresh token requests
      const refreshParams = {
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      };

      console.log(`🔄 [JIRA] Making refresh request to Atlassian...`);

      const response = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',  // Atlassian requires JSON, not URL-encoded
          'Accept': 'application/json',
        },
        body: JSON.stringify(refreshParams),  // Send as JSON
      });

      console.log(`🔄 [JIRA] Refresh response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`❌ [JIRA] Token refresh failed: ${response.status} ${response.statusText}`, errorBody);
        
        // Parse error for better debugging
        try {
          const errorJson = JSON.parse(errorBody);
          console.error(`❌ [JIRA] Error details:`, errorJson);
          
          if (errorJson.error === 'invalid_grant' || errorJson.error === 'unauthorized_client') {
            console.error(`❌ [JIRA] Refresh token is invalid or expired - re-authentication required`);
          }
        } catch (e) {
          console.error(`❌ [JIRA] Could not parse error response`);
        }
        
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const tokenData = await response.json();
      
      console.log(`✅ [JIRA] Token refresh successful!`);
      console.log(`✅ - New Access Token: ${tokenData.access_token ? `${tokenData.access_token.substring(0, 20)}...` : 'MISSING'}`);
      console.log(`✅ - New Refresh Token: ${tokenData.refresh_token ? `${tokenData.refresh_token.substring(0, 20)}...` : 'NOT PROVIDED (ROTATING)'}`);
      console.log(`✅ - Expires In: ${tokenData.expires_in || 3600} seconds`);

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken, // Use new token if provided, fallback to current
        expires_in: tokenData.expires_in || 3600,
        scope: tokenData.scope || '',
      };
    } catch (error) {
      console.error('❌ [JIRA] Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string, cloudId?: string): Promise<boolean> {
    try {
      // Use the User Identity API which works with your current scopes
      const response = await fetch('https://api.atlassian.com/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log(`🔍 User Identity API test failed: ${response.status} ${response.statusText}`);
        return false;
      }

      // If we have cloudId, also test basic Jira API access with a simple endpoint
      if (cloudId) {
        try {
          const jiraResponse = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/serverInfo`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });
          
          if (!jiraResponse.ok) {
            console.log(`🔍 Jira API test failed: ${jiraResponse.status} ${jiraResponse.statusText}`);
            // Don't fail the entire test if Jira API fails, User Identity API worked
          }
        } catch (error) {
          console.log('🔍 Jira API test error (continuing anyway):', error.message);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to test API access:', error);
      return false;
    }
  }

  /**
   * Discover available tables - required by base class
   */
  async discoverTables(accessToken: string, cloudId?: string): Promise<TableDiscoveryResult[]> {
    if (!cloudId) {
      // Try to get from accessible resources
      const resources = await this.getAccessibleResources(accessToken);
      if (resources && resources.length > 0) {
        cloudId = resources[0].id;
      } else {
        return [];
      }
    }
    return this.discoverJiraTables(accessToken, cloudId);
  }

  /**
   * Discover available Jira tables and their fields dynamically
   */
  async discoverJiraTables(accessToken: string, cloudId: string): Promise<TableDiscoveryResult[]> {
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
            console.log('🔄 Access token expired, attempting to refresh...');
            throw new Error(`TOKEN_EXPIRED:${response.status}:${response.statusText}`);
          }
          throw new Error(`Failed to fetch issues: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allIssues.push(...data.issues);
        
        total = data.total;
        startAt += data.issues.length;
        
        console.log(`Fetched ${allIssues.length}/${total} issues`);
        
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
      
      console.log('🧹 Cleaning up existing transformation objects...');
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
      
      console.log('📋 Creating staging tables (stg)...');
      
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
      
      console.log('🔗 Creating integration tables (int)...');
      
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
      
      console.log('👁️ Creating core views...');
      
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
      
      console.log('✅ Transformation pipeline completed (raw → stg → int → core)');
      
    } catch (error) {
      console.error('❌ Transformation pipeline failed:', error);
      throw error;
    }
  }


  /**
   * Sync Jira data to company analytics schema using stored OAuth tokens
   */
  async syncDataToSchema(companyId: number): Promise<SyncResult> {
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

      console.log(`🔄 Starting Jira OAuth sync for company ${companyId}`);
      
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
      
      console.log(`🔗 Using Jira instance: ${baseUrl} (${cloudId})`);

      let totalRecords = 0;
      const tablesCreated: string[] = [];


      // Fetch and sync issues (most important table) with automatic token refresh
      console.log('📋 Fetching Jira issues...');
      console.log('🔧 ABOUT TO CALL executeWithTokenRefresh for company:', companyId);
      const issues = await this.executeWithTokenRefresh(companyId, 
        (token) => this.fetchIssues(token, cloudId, 500)
      );
      console.log('🔧 executeWithTokenRefresh COMPLETED, got', issues?.length || 0, 'issues');
      if (issues.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'jira_issues', issues, 'jira_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_jira_issues');
        console.log(`✅ Synced ${recordsLoaded} issues`);
      }

      // Fetch and sync projects with automatic token refresh
      console.log('📂 Fetching Jira projects...');
      const projects = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchProjects(token, cloudId)
      );
      if (projects.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'jira_projects', projects, 'jira_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_jira_projects');
        console.log(`✅ Synced ${recordsLoaded} projects`);
      }

      // Fetch and sync users with automatic token refresh
      console.log('👥 Fetching Jira users...');
      const users = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchUsers(token, cloudId)
      );
      if (users.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'jira_users', users, 'jira_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_jira_users');
        console.log(`✅ Synced ${recordsLoaded} users`);
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

      console.log(`🎉 Jira OAuth sync completed: ${totalRecords} total records across ${tablesCreated.length} tables`);

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