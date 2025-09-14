/**
 * Schema Layer Manager Service
 * Automatically creates raw → stg → int → core schema layers after connector sync
 * This service hooks into the connector sync pipeline to create layered data models
 */

import { storage } from '../storage';

interface SchemaLayerConfig {
  companyId: number;
  connectorType: string;
  tables: string[];
  analyticsSchema: string;
}

interface LayerDefinition {
  name: string;
  type: 'table' | 'view';
  sql: string;
  dependencies: string[];
}

interface ConnectorTableMetadata {
  tableName: string;
  primaryKey?: string;
  cleaningRules: string[];
  joinMappings: Record<string, string>;
}

class SchemaLayerManagerService {
  /**
   * Main entry point - called after connector sync completes
   * Automatically creates all 4 layers: raw → stg → int → core
   */
  async createSchemaLayers(config: SchemaLayerConfig): Promise<{
    success: boolean;
    layersCreated: string[];
    error?: string;
  }> {
    try {
      console.log(`🔨 Creating schema layers for ${config.connectorType} (Company ${config.companyId})`);
      
      const layersCreated: string[] = [];
      
      // Step 1: Create raw layer (already done by connector - just verify)
      const rawLayerResult = await this.verifyRawLayer(config);
      if (!rawLayerResult.success) {
        throw new Error(`Raw layer verification failed: ${rawLayerResult.error}`);
      }
      layersCreated.push('raw');
      
      // Step 2: Create staging layer (normalize and clean)
      const stagingResult = await this.createStagingLayer(config);
      if (!stagingResult.success) {
        throw new Error(`Staging layer creation failed: ${stagingResult.error}`);
      }
      layersCreated.push('stg');
      
      // Step 3: Create integration layer (joins and enrichment)
      const integrationResult = await this.createIntegrationLayer(config);
      if (!integrationResult.success) {
        throw new Error(`Integration layer creation failed: ${integrationResult.error}`);
      }
      layersCreated.push('int');
      
      // Step 4: Create core views (mirror int layer)
      const coreResult = await this.createCoreLayer(config);
      if (!coreResult.success) {
        throw new Error(`Core layer creation failed: ${coreResult.error}`);
      }
      layersCreated.push('core');
      
      // Step 5: Track schema layers in database
      await this.trackSchemaLayers(config, layersCreated);
      
      console.log(`✅ Successfully created schema layers: ${layersCreated.join(' → ')}`);
      
      return {
        success: true,
        layersCreated
      };
      
    } catch (error) {
      console.error('Schema layer creation failed:', error);
      return {
        success: false,
        layersCreated: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Step 1: Verify raw layer exists (created by connector)
   */
  private async verifyRawLayer(config: SchemaLayerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Check that raw tables exist in analytics schema (tables are named raw_{connector}_{table})
      for (const table of config.tables) {
        const rawTableName = `raw_${config.connectorType}_${table}`;
        const exists = await storage.checkTableExists(config.analyticsSchema, rawTableName);
        
        if (!exists) {
          return {
            success: false,
            error: `Raw table ${rawTableName} not found in schema ${config.analyticsSchema}`
          };
        }
      }
      
      console.log(`✅ Raw layer verified for ${config.connectorType}`);
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Raw layer verification failed'
      };
    }
  }

  /**
   * Step 2: Create staging layer (stg) - normalized and cleaned data
   */
  private async createStagingLayer(config: SchemaLayerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const stagingTables = this.generateStagingDefinitions(config);
      
      for (const tableDef of stagingTables) {
        console.log(`Creating staging table: stg.${tableDef.name}`);
        await storage.executeQuery(`DROP TABLE IF EXISTS ${config.analyticsSchema}.stg_${tableDef.name}`);
        await storage.executeQuery(`CREATE TABLE ${config.analyticsSchema}.stg_${tableDef.name} AS (${tableDef.sql})`);
      }
      
      console.log(`✅ Staging layer created with ${stagingTables.length} tables`);
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Staging layer creation failed'
      };
    }
  }

  /**
   * Step 3: Create integration layer (int) - joined and enriched data
   */
  private async createIntegrationLayer(config: SchemaLayerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const integrationTables = this.generateIntegrationDefinitions(config);
      
      for (const tableDef of integrationTables) {
        console.log(`Creating integration table: int.${tableDef.name}`);
        await storage.executeQuery(`DROP TABLE IF EXISTS ${config.analyticsSchema}.int_${tableDef.name}`);
        await storage.executeQuery(`CREATE TABLE ${config.analyticsSchema}.int_${tableDef.name} AS (${tableDef.sql})`);
      }
      
      console.log(`✅ Integration layer created with ${integrationTables.length} tables`);
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Integration layer creation failed'
      };
    }
  }

  /**
   * Step 4: Create core layer (core) - views that mirror integration layer
   */
  private async createCoreLayer(config: SchemaLayerConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const coreViews = this.generateCoreDefinitions(config);
      
      for (const viewDef of coreViews) {
        console.log(`Creating core view: core.${viewDef.name}`);
        await storage.executeQuery(`DROP VIEW IF EXISTS ${config.analyticsSchema}.core_${viewDef.name}`);
        await storage.executeQuery(`CREATE OR REPLACE VIEW ${config.analyticsSchema}.core_${viewDef.name} AS ${viewDef.sql}`);
      }
      
      console.log(`✅ Core layer created with ${coreViews.length} views`);
      return { success: true };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Core layer creation failed'
      };
    }
  }

  /**
   * Generate staging layer SQL definitions (connector-specific cleaning)
   */
  private generateStagingDefinitions(config: SchemaLayerConfig): LayerDefinition[] {
    const definitions: LayerDefinition[] = [];
    
    for (const table of config.tables) {
      const metadata = this.getTableMetadata(config.connectorType, table);
      
      // Build staging SQL with cleaning rules
      let stagingSql = `SELECT DISTINCT `;
      
      if (config.connectorType === 'jira' && table === 'issues') {
        stagingSql += `
          issue_id,
          created_at::timestamp as created_at,
          resolved_at::timestamp as resolved_at,
          status,
          COALESCE(story_points::integer, 0) as story_points,
          assignee,
          CASE 
            WHEN status IN ('Done', 'Closed', 'Resolved') THEN 'completed'
            WHEN status IN ('In Progress', 'In Review') THEN 'in_progress' 
            ELSE 'todo'
          END as normalized_status
        `;
      } else if (config.connectorType === 'salesforce' && table === 'opportunities') {
        stagingSql += `
          id as opportunity_id,
          created_date::timestamp as created_at,
          close_date::date as close_date,
          amount::decimal as amount,
          stage_name,
          CASE 
            WHEN stage_name ILIKE '%closed won%' THEN 'won'
            WHEN stage_name ILIKE '%closed lost%' THEN 'lost'
            ELSE 'open'
          END as normalized_stage
        `;
      } else if (config.connectorType === 'hubspot' && table === 'deals') {
        stagingSql += `
          id as deal_id,
          createdate::timestamp as created_at,
          closedate::timestamp as close_date,
          amount::decimal as amount,
          dealstage,
          COALESCE(amount::decimal, 0) as deal_value
        `;
      } else {
        // Generic staging for other tables
        stagingSql += `*`;
      }
      
      stagingSql += ` FROM ${config.analyticsSchema}.raw_${config.connectorType}_${table}`;
      
      // Add deduplication if primary key is known
      if (metadata.primaryKey) {
        stagingSql += ` ORDER BY ${metadata.primaryKey}`;
      }
      
      definitions.push({
        name: `${config.connectorType}_${table}`,
        type: 'table',
        sql: stagingSql,
        dependencies: [`${config.connectorType}_${table}`]
      });
    }
    
    return definitions;
  }

  /**
   * Generate integration layer SQL definitions (cross-table joins)
   */
  private generateIntegrationDefinitions(config: SchemaLayerConfig): LayerDefinition[] {
    const definitions: LayerDefinition[] = [];
    
    if (config.connectorType === 'jira' && config.tables.includes('issues')) {
      // Jira integration: issues + sprints + users
      let jiraIntegrationSql = `
        SELECT 
          i.issue_id,
          i.created_at,
          i.resolved_at,
          i.story_points,
          i.normalized_status,
          (EXTRACT(EPOCH FROM (i.resolved_at - i.created_at)) / 86400)::integer as cycle_time_days,
          COALESCE(u.team, 'Unassigned') as team,
          COALESCE(s.sprint_name, 'No Sprint') as sprint_name,
          s.sprint_id,
          CASE 
            WHEN i.resolved_at IS NOT NULL AND i.resolved_at <= s.end_date THEN 'completed_in_sprint'
            WHEN i.resolved_at IS NOT NULL AND i.resolved_at > s.end_date THEN 'completed_late'
            ELSE 'in_progress'
          END as sprint_completion_status
        FROM ${config.analyticsSchema}.stg_${config.connectorType}_issues i
      `;
      
      // Add joins if related tables exist
      if (config.tables.includes('users')) {
        jiraIntegrationSql += `
        LEFT JOIN ${config.analyticsSchema}.stg_${config.connectorType}_users u 
          ON i.assignee = u.user_id
        `;
      }
      
      if (config.tables.includes('sprints')) {
        jiraIntegrationSql += `
        LEFT JOIN ${config.analyticsSchema}.stg_${config.connectorType}_issue_sprint m 
          ON i.issue_id = m.issue_id
        LEFT JOIN ${config.analyticsSchema}.stg_${config.connectorType}_sprints s 
          ON m.sprint_id = s.sprint_id
        `;
      }
      
      jiraIntegrationSql += ` WHERE i.created_at IS NOT NULL`;
      
      definitions.push({
        name: `${config.connectorType}_issues`,
        type: 'table',
        sql: jiraIntegrationSql,
        dependencies: [`stg_${config.connectorType}_issues`]
      });
    }
    
    if (config.connectorType === 'salesforce' && config.tables.includes('opportunities')) {
      // Salesforce integration: opportunities + accounts + contacts
      let salesforceIntegrationSql = `
        SELECT 
          o.opportunity_id,
          o.created_at,
          o.close_date,
          o.amount,
          o.normalized_stage,
          (o.close_date - o.created_at) as sales_cycle_days,
          COALESCE(a.account_name, 'Unknown Account') as account_name,
          COALESCE(a.industry, 'Unknown') as industry,
          COALESCE(c.contact_name, 'No Contact') as primary_contact,
          CASE 
            WHEN o.normalized_stage = 'won' THEN o.amount 
            ELSE 0 
          END as won_amount
        FROM ${config.analyticsSchema}.stg_${config.connectorType}_opportunities o
      `;
      
      if (config.tables.includes('accounts')) {
        salesforceIntegrationSql += `
        LEFT JOIN ${config.analyticsSchema}.stg_${config.connectorType}_accounts a 
          ON o.account_id = a.account_id
        `;
      }
      
      if (config.tables.includes('contacts')) {
        salesforceIntegrationSql += `
        LEFT JOIN ${config.analyticsSchema}.stg_${config.connectorType}_contacts c 
          ON o.primary_contact_id = c.contact_id
        `;
      }
      
      definitions.push({
        name: `${config.connectorType}_opportunities`,
        type: 'table',
        sql: salesforceIntegrationSql,
        dependencies: [`stg_${config.connectorType}_opportunities`]
      });
    }
    
    // If no specific integration logic exists, create simple pass-through
    for (const table of config.tables) {
      const tableName = `${config.connectorType}_${table}`;
      const alreadyExists = definitions.some(def => def.name === tableName);
      
      if (!alreadyExists) {
        definitions.push({
          name: tableName,
          type: 'table',
          sql: `SELECT * FROM ${config.analyticsSchema}.stg_${tableName}`,
          dependencies: [`stg_${tableName}`]
        });
      }
    }
    
    return definitions;
  }

  /**
   * Generate core layer view definitions (SELECT * FROM int layer)
   */
  private generateCoreDefinitions(config: SchemaLayerConfig): LayerDefinition[] {
    const definitions: LayerDefinition[] = [];
    
    for (const table of config.tables) {
      const tableName = `${config.connectorType}_${table}`;
      
      definitions.push({
        name: tableName,
        type: 'view',
        sql: `SELECT * FROM ${config.analyticsSchema}.int_${tableName}`,
        dependencies: [`int_${tableName}`]
      });
    }
    
    return definitions;
  }

  /**
   * Get table metadata for connector-specific processing
   */
  private getTableMetadata(connectorType: string, table: string): ConnectorTableMetadata {
    const metadata: Record<string, Record<string, ConnectorTableMetadata>> = {
      jira: {
        issues: {
          tableName: 'issues',
          primaryKey: 'issue_id',
          cleaningRules: ['normalize_status', 'parse_dates'],
          joinMappings: {
            'assignee': 'users.user_id',
            'sprint': 'sprints.sprint_id'
          }
        },
        users: {
          tableName: 'users',
          primaryKey: 'user_id',
          cleaningRules: ['normalize_team'],
          joinMappings: {}
        },
        sprints: {
          tableName: 'sprints',
          primaryKey: 'sprint_id',
          cleaningRules: ['parse_dates'],
          joinMappings: {}
        }
      },
      salesforce: {
        opportunities: {
          tableName: 'opportunities',
          primaryKey: 'id',
          cleaningRules: ['normalize_stage', 'parse_amounts'],
          joinMappings: {
            'account_id': 'accounts.account_id',
            'primary_contact_id': 'contacts.contact_id'
          }
        },
        accounts: {
          tableName: 'accounts',
          primaryKey: 'account_id',
          cleaningRules: ['normalize_industry'],
          joinMappings: {}
        }
      },
      hubspot: {
        deals: {
          tableName: 'deals',
          primaryKey: 'id',
          cleaningRules: ['normalize_stage', 'parse_amounts'],
          joinMappings: {}
        }
      }
    };
    
    return metadata[connectorType]?.[table] || {
      tableName: table,
      cleaningRules: [],
      joinMappings: {}
    };
  }

  /**
   * Track schema layers in database for monitoring
   */
  private async trackSchemaLayers(config: SchemaLayerConfig, layersCreated: string[]): Promise<void> {
    try {
      await storage.insertPipelineActivity({
        companyId: config.companyId,
        activityType: 'schema_layer_creation',
        description: `Created schema layers (${layersCreated.join(' → ')}) for ${config.connectorType}`,
        details: {
          connectorType: config.connectorType,
          tablesProcessed: config.tables,
          layersCreated: layersCreated,
          analyticsSchema: config.analyticsSchema,
          timestamp: new Date().toISOString()
        },
        status: 'completed'
      });
    } catch (error) {
      console.error('Failed to track schema layer creation:', error);
    }
  }

  /**
   * Get schema layer status for a company and connector
   */
  async getSchemaLayerStatus(companyId: number, connectorType: string): Promise<{
    hasLayers: boolean;
    layers: string[];
    lastCreated?: Date;
  }> {
    try {
      const activities = await storage.getPipelineActivitiesByType(
        companyId,
        'schema_layer_creation'
      );
      
      const relevantActivity = activities.find(activity => 
        activity.details?.connectorType === connectorType
      );
      
      if (!relevantActivity) {
        return {
          hasLayers: false,
          layers: []
        };
      }
      
      return {
        hasLayers: true,
        layers: relevantActivity.details?.layersCreated || [],
        lastCreated: relevantActivity.createdAt
      };
      
    } catch (error) {
      console.error('Failed to get schema layer status:', error);
      return {
        hasLayers: false,
        layers: []
      };
    }
  }
}

export const schemaLayerManager = new SchemaLayerManagerService();