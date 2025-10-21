/**
 * Asana OAuth2 integration service extending base OAuth class
 */

import { OAuthServiceBase } from './oauth-base.js';
import { 
  TokenResponse, 
  SyncResult, 
  TableDiscoveryResult,
  OAuthError 
} from './oauth-types.js';

interface AsanaUserInfo {
  gid: string;
  name: string;
  email: string;
  workspaces: Array<{
    gid: string;
    name: string;
    resource_type: string;
  }>;
}

export class AsanaOAuthService extends OAuthServiceBase {
  
  constructor() {
    super();
  }

  /**
   * Get service type identifier
   */
  getServiceType(): string {
    return 'asana';
  }

  /**
   * Generate authorization URL with company context
   */
  getAuthorizationUrl(companyId: number, userId?: number): string {
    const state = this.generateState(companyId, userId);
    
    // Asana OAuth scopes for business metrics dashboard
    // Only request scopes that are enabled in your Asana app configuration
    const scopes = [
      'tasks:read',        // Read task data (essential for project metrics)
      'projects:read',     // Read project data (essential for project metrics) 
      'users:read',        // Read user data (for team metrics)
      'teams:read',        // Read team data (for organizational metrics)
      'workspaces:read',   // Read workspace data (for scope context)
    ];
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      state,
      scope: scopes.join(' ')
    });

    return `https://app.asana.com/-/oauth_authorize?${params.toString()}`;
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
        code: code
      });

      const response = await fetch('https://app.asana.com/-/oauth_token', {
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
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in || 3600, // Asana tokens typically expire in 1 hour
        token_type: tokenData.token_type || 'bearer',
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Get user info and workspaces
   */
  async getUserInfo(accessToken: string): Promise<AsanaUserInfo> {
    try {
      const response = await fetch('https://app.asana.com/api/1.0/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user info: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;
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
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken
      });

      const response = await fetch('https://app.asana.com/-/oauth_token', {
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
      };
    } catch (error) {
      console.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Test API access with token
   */
  async testApiAccess(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch('https://app.asana.com/api/1.0/users/me', {
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
  async discoverTables(accessToken: string): Promise<TableDiscoveryResult[]> {
    return this.discoverAsanaTables(accessToken);
  }

  /**
   * Discover available Asana tables and their properties dynamically
   */
  async discoverAsanaTables(accessToken: string): Promise<TableDiscoveryResult[]> {
    try {
      const tables = [];

      // Core Asana objects based on read permissions
      const coreObjects = [
        { name: 'projects', label: 'Projects', endpoint: '/projects', hasProperties: true },
        { name: 'tasks', label: 'Tasks', endpoint: '/tasks', hasProperties: true },
        { name: 'users', label: 'Users', endpoint: '/users', hasProperties: true },
        { name: 'teams', label: 'Teams', endpoint: '/teams', hasProperties: true },
        { name: 'tags', label: 'Tags', endpoint: '/tags', hasProperties: true },
        { name: 'stories', label: 'Stories (Comments)', endpoint: '/stories', hasProperties: true },
        { name: 'custom_fields', label: 'Custom Fields', endpoint: '/custom_fields', hasProperties: true },
        { name: 'portfolios', label: 'Portfolios', endpoint: '/portfolios', hasProperties: true },
        { name: 'goals', label: 'Goals', endpoint: '/goals', hasProperties: true },
        { name: 'attachments', label: 'Attachments', endpoint: '/attachments', hasProperties: true },
        { name: 'workspaces', label: 'Workspaces', endpoint: '/workspaces', hasProperties: true },
        { name: 'team_memberships', label: 'Team Memberships', endpoint: '/team_memberships', hasProperties: true },
        { name: 'time_tracking_entries', label: 'Time Tracking', endpoint: '/time_entries', hasProperties: true },
      ];

      // Get user info to determine accessible workspaces
      const userInfo = await this.getUserInfo(accessToken);
      const workspaceId = userInfo.workspaces?.[0]?.gid;

      for (const object of coreObjects) {
        try {
          // Test if we can access this object
          let testUrl = `https://app.asana.com/api/1.0${object.endpoint}`;
          
          // Some endpoints require workspace context
          if (['projects', 'teams', 'tags'].includes(object.name) && workspaceId) {
            testUrl += `?workspace=${workspaceId}&limit=1`;
          } else {
            testUrl += '?limit=1';
          }

          const testResponse = await fetch(testUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          if (testResponse.ok) {
            let fields = [];
            
            // Get sample data to infer fields
            const sampleData = await testResponse.json();
            const firstItem = sampleData.data?.[0];
            
            if (firstItem && typeof firstItem === 'object') {
              // Get common Asana fields based on object type
              if (object.name === 'tasks') {
                fields = ['gid', 'name', 'notes', 'completed', 'created_at', 'due_on', 'assignee', 'projects', 'tags'];
              } else if (object.name === 'projects') {
                fields = ['gid', 'name', 'notes', 'color', 'created_at', 'current_status', 'due_date', 'owner', 'team'];
              } else if (object.name === 'users') {
                fields = ['gid', 'name', 'email', 'photo', 'workspaces'];
              } else if (object.name === 'teams') {
                fields = ['gid', 'name', 'description', 'organization'];
              } else {
                // Generic fields for other objects
                fields = Object.keys(firstItem).slice(0, 8);
              }
            }

            tables.push({
              name: object.name,
              label: object.label,
              fields: fields,
              accessible: true,
              isStandard: ['tasks', 'projects', 'users', 'teams'].includes(object.name)
            });
          }
        } catch (error) {
          console.log(`Could not access ${object.name}:`, error.message);
        }
      }

      return tables.sort((a, b) => a.label.localeCompare(b.label));
    } catch (error) {
      console.error('Failed to discover Asana tables:', error);
      return [];
    }
  }

  /**
   * Fetch Asana tasks with pagination - requires filtering by project or assignee
   */
  async fetchTasks(accessToken: string, workspaceId: string, limit: number = 100): Promise<any[]> {
    try {
      let allTasks: any[] = [];
      
      // First, get projects in the workspace to fetch tasks from
      console.log('🔍 Getting projects to fetch tasks from...');
      const projects = await this.fetchProjects(accessToken, workspaceId, 50);
      
      if (projects.length === 0) {
        console.log('ℹ️ No projects found, fetching tasks assigned to current user');
        // Fallback: fetch tasks assigned to the current user
        const userInfo = await this.getUserInfo(accessToken);
        const userId = userInfo.gid;
        
        let nextPageUrl: string | null = `https://app.asana.com/api/1.0/tasks?assignee=${userId}&workspace=${workspaceId}&limit=${Math.min(limit, 100)}&opt_fields=gid,name,completed,created_at`;

        while (nextPageUrl && allTasks.length < limit) {
          console.log(`🔍 Fetching user tasks from: ${nextPageUrl}`);
          const response = await fetch(nextPageUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.error(`❌ Asana user tasks API error (${response.status}):`, errorBody);
            break; // Don't throw error, just stop fetching
          }

          const data = await response.json();
          allTasks.push(...data.data);
          nextPageUrl = data.next_page?.uri || null;
        }
      } else {
        // Fetch tasks from each project (limit projects to avoid too many requests)
        const projectsToFetch = projects.slice(0, Math.min(10, projects.length));
        console.log(`🔍 Fetching tasks from ${projectsToFetch.length} projects`);
        
        for (const project of projectsToFetch) {
          if (allTasks.length >= limit) break;
          
          try {
            const remainingLimit = limit - allTasks.length;
            let nextPageUrl: string | null = `https://app.asana.com/api/1.0/tasks?project=${project.gid}&limit=${Math.min(remainingLimit, 100)}&opt_fields=gid,name,completed,created_at,projects`;

            while (nextPageUrl && allTasks.length < limit) {
              console.log(`🔍 Fetching tasks from project ${project.name}: ${nextPageUrl}`);
              const response = await fetch(nextPageUrl, {
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Accept': 'application/json',
                },
              });

              if (!response.ok) {
                console.log(`⚠️ Skipping project ${project.name} due to access error`);
                break; // Skip this project, continue with others
              }

              const data = await response.json();
              allTasks.push(...data.data);
              nextPageUrl = data.next_page?.uri || null;
            }
          } catch (projectError) {
            console.log(`⚠️ Error fetching tasks from project ${project.name}:`, projectError.message);
            // Continue with other projects
          }
        }
      }

      console.log(`✅ Fetched ${allTasks.length} total tasks`);
      return allTasks.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Asana tasks:', error);
      throw error;
    }
  }

  /**
   * Fetch Asana projects with pagination
   */
  async fetchProjects(accessToken: string, workspaceId: string, limit: number = 100): Promise<any[]> {
    try {
      let allProjects: any[] = [];
      // Start with basic fields to test the API call
      // Use minimal fields to avoid permission issues
      let nextPageUrl: string | null = `https://app.asana.com/api/1.0/projects?workspace=${workspaceId}&limit=${Math.min(limit, 100)}&opt_fields=gid,name,color,created_at,archived`;

      while (nextPageUrl && allProjects.length < limit) {
        console.log(`🔍 Fetching projects from: ${nextPageUrl}`);
        const response = await fetch(nextPageUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`❌ Asana projects API error (${response.status}):`, errorBody);
          throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();
        allProjects.push(...data.data);
        
        nextPageUrl = data.next_page?.uri || null;
        
        console.log(`Fetched ${allProjects.length} projects`);
      }

      return allProjects.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Asana projects:', error);
      throw error;
    }
  }

  /**
   * Fetch Asana users
   */
  async fetchUsers(accessToken: string, workspaceId: string, limit: number = 100): Promise<any[]> {
    try {
      let allUsers: any[] = [];
      // Use minimal fields to avoid permission issues  
      let nextPageUrl: string | null = `https://app.asana.com/api/1.0/users?workspace=${workspaceId}&limit=${Math.min(limit, 100)}&opt_fields=gid,name,email`;

      while (nextPageUrl && allUsers.length < limit) {
        console.log(`🔍 Fetching users from: ${nextPageUrl}`);
        const response = await fetch(nextPageUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`❌ Asana users API error (${response.status}):`, errorBody);
          throw new Error(`Failed to fetch users: ${response.status} ${response.statusText} - ${errorBody}`);
        }

        const data = await response.json();
        allUsers.push(...data.data);
        
        nextPageUrl = data.next_page?.uri || null;
        
        console.log(`Fetched ${allUsers.length} users`);
      }

      return allUsers.slice(0, limit);
    } catch (error) {
      console.error('Failed to fetch Asana users:', error);
      throw error;
    }
  }

  /**
   * Fetch Asana teams
   */
  async fetchTeams(accessToken: string, workspaceId: string, limit: number = 100): Promise<any[]> {
    try {
      console.log(`🔍 Fetching teams from workspace: ${workspaceId}`);
      const response = await fetch(`https://app.asana.com/api/1.0/teams?workspace=${workspaceId}&limit=${Math.min(limit, 100)}&opt_fields=gid,name,description`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`❌ Asana teams API error (${response.status}):`, errorBody);
        throw new Error(`Failed to fetch teams: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Failed to fetch Asana teams:', error);
      throw error;
    }
  }

  /**
   * Run dbt-style transformations for Asana data (raw → stg → int → core)
   */
  async runTransformations(companyId: number, sql: any): Promise<void> {
    const schema = `analytics_company_${companyId}`;
    
    try {
      // Ensure main schema exists
      await sql`CREATE SCHEMA IF NOT EXISTS ${sql(schema)}`;
      
      console.log('🧹 Cleaning up existing transformation objects...');
      // Drop views first (they depend on tables)
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_asana_tasks`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_asana_projects`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_asana_users`;
      await sql`DROP VIEW IF EXISTS ${sql(schema)}.core_asana_teams`;
      
      // Drop tables in reverse dependency order
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_asana_tasks`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_asana_projects`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_asana_users`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.int_asana_teams`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_asana_tasks`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_asana_projects`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_asana_users`;
      await sql`DROP TABLE IF EXISTS ${sql(schema)}.stg_asana_teams`;
      
      console.log('📋 Creating staging tables (stg)...');
      
      // STG: asana_tasks - normalized and cleaned
      await sql`
        CREATE TABLE ${sql(schema)}.stg_asana_tasks AS
        SELECT DISTINCT 
          (data #>> '{}')::jsonb->>'gid' as task_id,
          (data #>> '{}')::jsonb->>'name' as task_name,
          (data #>> '{}')::jsonb->>'notes' as notes,
          COALESCE(((data #>> '{}')::jsonb->>'completed')::boolean, false) as is_completed,
          ((data #>> '{}')::jsonb->>'created_at')::timestamp as created_at,
          ((data #>> '{}')::jsonb->>'due_on')::date as due_date,
          ((data #>> '{}')::jsonb->>'due_at')::timestamp as due_datetime,
          (data #>> '{}')::jsonb->'assignee'->>'gid' as assignee_id,
          (data #>> '{}')::jsonb->'assignee'->>'name' as assignee_name,
          (data #>> '{}')::jsonb->'parent'->>'gid' as parent_task_id,
          COALESCE(((data #>> '{}')::jsonb->>'num_likes')::integer, 0) as num_likes,
          (data #>> '{}')::jsonb->'projects' as projects_data,
          (data #>> '{}')::jsonb->'tags' as tags_data,
          (data #>> '{}')::jsonb as raw_data
        FROM ${sql(schema)}.raw_asana_tasks
        WHERE data IS NOT NULL
      `;
      
      // STG: asana_projects - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_asana_projects AS
        SELECT DISTINCT
          (data #>> '{}')::jsonb->>'gid' as project_id,
          (data #>> '{}')::jsonb->>'name' as project_name,
          (data #>> '{}')::jsonb->>'notes' as notes,
          (data #>> '{}')::jsonb->>'color' as color,
          ((data #>> '{}')::jsonb->>'created_at')::timestamp as created_at,
          (data #>> '{}')::jsonb->'current_status'->>'title' as status_title,
          (data #>> '{}')::jsonb->'current_status'->>'text' as status_text,
          (data #>> '{}')::jsonb->'current_status'->>'color' as status_color,
          ((data #>> '{}')::jsonb->>'due_date')::date as due_date,
          ((data #>> '{}')::jsonb->>'start_on')::date as start_date,
          (data #>> '{}')::jsonb->'owner'->>'gid' as owner_id,
          (data #>> '{}')::jsonb->'owner'->>'name' as owner_name,
          (data #>> '{}')::jsonb->'team'->>'gid' as team_id,
          (data #>> '{}')::jsonb->'team'->>'name' as team_name,
          COALESCE(((data #>> '{}')::jsonb->>'archived')::boolean, false) as is_archived,
          COALESCE(((data #>> '{}')::jsonb->>'public')::boolean, false) as is_public
        FROM ${sql(schema)}.raw_asana_projects
        WHERE data IS NOT NULL
      `;
      
      // STG: asana_users - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_asana_users AS  
        SELECT DISTINCT
          (data #>> '{}')::jsonb->>'gid' as user_id,
          (data #>> '{}')::jsonb->>'name' as user_name,
          (data #>> '{}')::jsonb->>'email' as email,
          (data #>> '{}')::jsonb->'photo'->>'image_128x128' as photo_url
        FROM ${sql(schema)}.raw_asana_users
        WHERE data IS NOT NULL
      `;

      // STG: asana_teams - normalized
      await sql`
        CREATE TABLE ${sql(schema)}.stg_asana_teams AS  
        SELECT DISTINCT
          (data #>> '{}')::jsonb->>'gid' as team_id,
          (data #>> '{}')::jsonb->>'name' as team_name,
          (data #>> '{}')::jsonb->>'description' as description,
          (data #>> '{}')::jsonb->'organization'->>'name' as organization_name
        FROM ${sql(schema)}.raw_asana_teams
        WHERE data IS NOT NULL
      `;
      
      console.log('🔗 Creating integration tables (int)...');
      
      // INT: asana_tasks - enriched task data with calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_asana_tasks AS
        SELECT 
          task_id,
          task_name,
          notes,
          is_completed,
          created_at,
          due_date,
          due_datetime,
          assignee_id,
          assignee_name,
          parent_task_id,
          num_likes,
          -- Calculated fields
          CASE 
            WHEN is_completed THEN 'Completed'
            WHEN due_date < CURRENT_DATE THEN 'Overdue'
            WHEN due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'Due Soon'
            ELSE 'On Track'
          END as status_category,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at::timestamp))/86400 as days_since_created,
          CASE 
            WHEN parent_task_id IS NOT NULL THEN 'Subtask'
            ELSE 'Task'
          END as task_type,
          CASE 
            WHEN assignee_id IS NOT NULL THEN true 
            ELSE false 
          END as is_assigned
        FROM ${sql(schema)}.stg_asana_tasks
      `;
      
      // INT: asana_projects - enriched project data
      await sql`
        CREATE TABLE ${sql(schema)}.int_asana_projects AS
        SELECT 
          project_id,
          project_name,
          notes,
          color,
          created_at,
          status_title,
          status_text,
          status_color,
          due_date,
          start_date,
          owner_id,
          owner_name,
          team_id,
          team_name,
          is_archived,
          is_public,
          -- Calculated fields
          CASE 
            WHEN is_archived THEN 'Archived'
            WHEN status_color = 'red' THEN 'At Risk'
            WHEN status_color = 'yellow' THEN 'Needs Attention'
            WHEN status_color = 'green' THEN 'On Track'
            ELSE 'No Status'
          END as health_status,
          CASE 
            WHEN start_date IS NOT NULL AND due_date IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (due_date::timestamp - start_date::timestamp))/86400 
            ELSE NULL 
          END as project_duration_days,
          CASE 
            WHEN due_date < CURRENT_DATE THEN 'Overdue'
            WHEN due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
            ELSE 'Future'
          END as timeline_status
        FROM ${sql(schema)}.stg_asana_projects
      `;
      
      // INT: asana_users - enriched with calculated fields
      await sql`
        CREATE TABLE ${sql(schema)}.int_asana_users AS
        SELECT 
          user_id,
          user_name,
          email,
          photo_url,
          -- Calculated fields
          CASE 
            WHEN email IS NOT NULL THEN true
            ELSE false
          END as has_email,
          LOWER(SPLIT_PART(email, '@', 2)) as email_domain
        FROM ${sql(schema)}.stg_asana_users
      `;

      // INT: asana_teams
      await sql`
        CREATE TABLE ${sql(schema)}.int_asana_teams AS
        SELECT 
          team_id,
          team_name,
          description,
          organization_name
        FROM ${sql(schema)}.stg_asana_teams
      `;
      
      console.log('👁️ Creating core views...');
      
      // CORE: Views that mirror int tables (no aggregation)
      await sql`
        CREATE VIEW ${sql(schema)}.core_asana_tasks AS 
        SELECT * FROM ${sql(schema)}.int_asana_tasks
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_asana_projects AS
        SELECT * FROM ${sql(schema)}.int_asana_projects  
      `;
      
      await sql`
        CREATE VIEW ${sql(schema)}.core_asana_users AS
        SELECT * FROM ${sql(schema)}.int_asana_users
      `;

      await sql`
        CREATE VIEW ${sql(schema)}.core_asana_teams AS
        SELECT * FROM ${sql(schema)}.int_asana_teams
      `;
      
      console.log('✅ Transformation pipeline completed (raw → stg → int → core)');
      
    } catch (error) {
      console.error('❌ Transformation pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Sync Asana data to company analytics schema using stored OAuth tokens
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

      console.log(`🔄 Starting Asana OAuth sync for company ${companyId}`);
      
      // Get stored OAuth tokens from database
      const storage = (await import('../storage')).storage;
      const dataSources = await storage.getDataSourcesByCompany(companyId);
      const asanaSource = dataSources.find(ds => ds.type === 'asana');
      
      if (!asanaSource || !asanaSource.config) {
        throw new Error('No Asana OAuth tokens found for this company');
      }

      const config = typeof asanaSource.config === 'string' 
        ? JSON.parse(asanaSource.config) 
        : asanaSource.config;
      const { accessToken, userInfo } = config;
      
      if (!accessToken) {
        throw new Error('Invalid OAuth configuration');
      }

      const workspaceId = userInfo?.workspaces?.[0]?.gid;
      if (!workspaceId) {
        throw new Error('No workspace found for Asana user');
      }
      
      console.log(`🔗 Using Asana workspace: ${userInfo.workspaces[0].name} (${workspaceId})`);

      let totalRecords = 0;
      const tablesCreated: string[] = [];

      // Fetch and sync tasks with automatic token refresh
      console.log('📝 Fetching Asana tasks...');
      const tasks = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchTasks(token, workspaceId, 500)
      );
      if (tasks.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'asana_tasks', tasks, 'asana_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_asana_tasks');
        console.log(`✅ Synced ${recordsLoaded} tasks`);
      }

      // Fetch and sync projects with automatic token refresh
      console.log('📁 Fetching Asana projects...');
      const projects = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchProjects(token, workspaceId, 200)
      );
      if (projects.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'asana_projects', projects, 'asana_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_asana_projects');
        console.log(`✅ Synced ${recordsLoaded} projects`);
      }

      // Fetch and sync users with automatic token refresh
      console.log('👥 Fetching Asana users...');
      const users = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchUsers(token, workspaceId, 200)
      );
      if (users.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'asana_users', users, 'asana_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_asana_users');
        console.log(`✅ Synced ${recordsLoaded} users`);
      }

      // Fetch and sync teams with automatic token refresh
      console.log('👥 Fetching Asana teams...');
      const teams = await this.executeWithTokenRefresh(companyId,
        (token) => this.fetchTeams(token, workspaceId, 50)
      );
      if (teams.length > 0) {
        const recordsLoaded = await this.insertDataToSchema(companyId, 'asana_teams', teams, 'asana_oauth');
        totalRecords += recordsLoaded;
        tablesCreated.push('raw_asana_teams');
        console.log(`✅ Synced ${recordsLoaded} teams`);
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

      console.log(`🎉 Asana OAuth sync completed: ${totalRecords} total records across ${tablesCreated.length} tables`);

      return {
        success: true,
        recordsSynced: totalRecords,
        tablesCreated,
      };

    } catch (error) {
      console.error('❌ Asana OAuth sync failed:', error);
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
export const asanaOAuthService = new AsanaOAuthService();