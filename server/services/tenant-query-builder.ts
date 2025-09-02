// Tenant-scoped query builder for safe multi-tenant operations
import postgres from 'postgres';

export interface TenantQueryBuilder {
  sql: ReturnType<typeof postgres>;
  companyId: number;
  schema: string;
}

/**
 * Creates a tenant-scoped SQL query builder that automatically prefixes table names
 * with the correct analytics schema for the given company
 */
export function createTenantScopedSQL(sql: ReturnType<typeof postgres>, companyId: number): TenantQueryBuilder {
  if (!companyId || !Number.isInteger(companyId)) {
    throw new Error('Invalid company ID provided to tenant query builder');
  }

  const schema = `analytics_company_${companyId}`;
  
  return {
    sql,
    companyId,
    schema
  };
}

/**
 * Safe table name resolver that ensures proper tenant isolation
 */
export function getTenantTable(builder: TenantQueryBuilder, tableName: string): string {
  // Validate table name to prevent SQL injection
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }

  return `${builder.schema}.${tableName}`;
}

/**
 * Execute a query with automatic tenant scoping
 */
export async function executeTenantQuery<T = any>(
  builder: TenantQueryBuilder,
  tableName: string,
  query: string,
  params: any[] = []
): Promise<T[]> {
  const fullTableName = getTenantTable(builder, tableName);
  const scopedQuery = query.replace(/\${tableName}/g, fullTableName);
  
  console.log(`🔍 Executing tenant query for company ${builder.companyId}: ${scopedQuery}`);
  
  try {
    const result = await builder.sql.unsafe(scopedQuery, ...params);
    return result as T[];
  } catch (error) {
    console.error(`❌ Tenant query failed for company ${builder.companyId}:`, error);
    throw new Error(`Database query failed for tenant ${builder.companyId}`);
  }
}

/**
 * Get metric registry for a specific tenant
 */
export async function getTenantMetricRegistry(builder: TenantQueryBuilder): Promise<any[]> {
  const tableName = getTenantTable(builder, 'metric_registry');
  
  return await builder.sql`
    SELECT 
      metric_key,
      label,
      source_table,
      expr_sql,
      date_column,
      unit,
      filters,
      tags,
      description,
      is_active,
      created_at,
      updated_at
    FROM ${builder.sql.unsafe(tableName)}
    WHERE is_active = TRUE
    ORDER BY metric_key
  `;
}

/**
 * Get goals for a specific tenant
 */
export async function getTenantGoals(builder: TenantQueryBuilder): Promise<any[]> {
  const tableName = getTenantTable(builder, 'goals');
  
  return await builder.sql`
    SELECT 
      metric_key,
      granularity,
      period_start,
      target,
      created_at
    FROM ${builder.sql.unsafe(tableName)}
    ORDER BY metric_key, period_start
  `;
}

/**
 * Get available tables for a specific tenant
 */
export async function getTenantTables(builder: TenantQueryBuilder): Promise<string[]> {
  const result = await builder.sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = ${builder.schema}
    ORDER BY table_name
  `;
  
  return result.map((row: any) => row.table_name);
}

/**
 * Get columns for a specific tenant table
 */
export async function getTenantTableColumns(builder: TenantQueryBuilder, tableName: string): Promise<any[]> {
  // Validate table exists in tenant schema
  const tables = await getTenantTables(builder);
  if (!tables.includes(tableName)) {
    throw new Error(`Table ${tableName} not found in tenant ${builder.companyId} schema`);
  }

  return await builder.sql`
    SELECT 
      column_name as "columnName",
      data_type as "dataType",
      is_nullable as "isNullable"
    FROM information_schema.columns 
    WHERE table_schema = ${builder.schema} 
      AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
}

/**
 * Execute raw tenant-scoped query with validation
 */
export async function executeTenantRawQuery(
  builder: TenantQueryBuilder, 
  query: string, 
  params: Record<string, any> = {}
): Promise<any[]> {
  // Basic validation to prevent cross-tenant access
  if (query.toLowerCase().includes('analytics_company_') && !query.includes(builder.schema)) {
    throw new Error('Query contains references to other tenant schemas');
  }

  // Replace schema placeholder
  const scopedQuery = query.replace(/\${schema}/g, builder.schema);
  
  console.log(`🔍 Executing raw tenant query for company ${builder.companyId}`);
  
  try {
    return await builder.sql.unsafe(scopedQuery, params);
  } catch (error) {
    console.error(`❌ Raw tenant query failed for company ${builder.companyId}:`, error);
    throw new Error(`Raw query failed for tenant ${builder.companyId}: ${error.message}`);
  }
}

/**
 * Validate that a company ID has a corresponding analytics schema
 */
export async function validateTenantSchema(sql: ReturnType<typeof postgres>, companyId: number): Promise<boolean> {
  const schemaName = `analytics_company_${companyId}`;
  
  const result = await sql`
    SELECT schema_name 
    FROM information_schema.schemata 
    WHERE schema_name = ${schemaName}
  `;
  
  return result.length > 0;
}

/**
 * Create tenant analytics schema if it doesn't exist
 */
export async function ensureTenantSchema(sql: ReturnType<typeof postgres>, companyId: number): Promise<void> {
  const schemaName = `analytics_company_${companyId}`;
  
  console.log(`🔧 Ensuring schema exists: ${schemaName}`);
  
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql.unsafe(schemaName)}`;
  
  // Note: Table creation should be handled by migrations
  console.log(`✅ Schema ensured: ${schemaName}`);
}