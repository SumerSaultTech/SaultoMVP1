/**
 * Safe JSON Filter to SQL Converter
 * Converts validated JSON filter trees to parameterized SQL WHERE clauses
 */

export interface FilterCondition {
  column: string;
  op: string;
  value: string | number | string[] | boolean;
}

export interface FilterGroup {
  op: "AND" | "OR";
  conditions: (FilterCondition | FilterGroup)[];
}

export type FilterTree = FilterGroup | FilterCondition;

export interface SQLResult {
  whereClause: string;
  parameters: Record<string, any>;
  errors: string[];
}

// Valid operators to prevent SQL injection
const VALID_OPERATORS = new Set([
  "=", "!=", ">", "<", ">=", "<=",
  "IN", "NOT IN", "LIKE", "NOT LIKE",
  "IS NULL", "IS NOT NULL"
]);

// Operators that don't require parameters
const NULL_OPERATORS = new Set(["IS NULL", "IS NOT NULL"]);

// Operators that expect arrays
const ARRAY_OPERATORS = new Set(["IN", "NOT IN"]);

// Valid column names (whitelist approach for security)
const VALID_COLUMNS: Record<string, string[]> = {
  "core.fact_financials": [
    "invoice_amount", "expense_amount", "transaction_date", 
    "category", "customer_id", "created_at", "updated_at"
  ],
  "core.fact_hubspot": [
    "stage", "deal_type", "priority", "amount", "close_date", 
    "owner", "deal_id", "contact_id", "company_id", "created_at"
  ],
  "core.fact_jira": [
    "status", "priority", "issue_type", "assignee", "created_date", 
    "story_points", "issue_key", "project_key", "reporter"
  ],
  "core.fact_salesforce": [
    "stage_name", "type", "lead_source", "amount", "probability", 
    "account_name", "opportunity_id", "account_id", "owner_id"
  ]
};

/**
 * Convert a filter tree to SQL WHERE clause with parameters
 */
export function filterToSQL(filter: FilterTree, dataSource: string): SQLResult {
  const result: SQLResult = {
    whereClause: "",
    parameters: {},
    errors: []
  };

  // Validate data source
  if (!VALID_COLUMNS[dataSource]) {
    result.errors.push(`Invalid data source: ${dataSource}`);
    return result;
  }

  const validColumns = VALID_COLUMNS[dataSource];
  let paramCounter = 0;

  try {
    if ('conditions' in filter) {
      // It's a FilterGroup
      const { clause, params, counter } = convertGroup(filter, validColumns, paramCounter);
      result.whereClause = clause;
      result.parameters = params;
    } else {
      // It's a single FilterCondition
      const { clause, params, counter } = convertCondition(filter, validColumns, paramCounter);
      result.whereClause = clause;
      result.parameters = params;
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

interface ConvertResult {
  clause: string;
  params: Record<string, any>;
  counter: number;
}

/**
 * Convert a filter group to SQL
 */
function convertGroup(group: FilterGroup, validColumns: string[], paramCounter: number): ConvertResult {
  const result: ConvertResult = {
    clause: "",
    params: {},
    counter: paramCounter
  };

  // Validate group operator
  if (!["AND", "OR"].includes(group.op)) {
    throw new Error(`Invalid group operator: ${group.op}`);
  }

  if (!group.conditions || group.conditions.length === 0) {
    throw new Error("Group must contain at least one condition");
  }

  const clauses: string[] = [];

  // Process each condition
  for (const condition of group.conditions) {
    let conditionResult: ConvertResult;

    if ('conditions' in condition) {
      // It's a nested group
      conditionResult = convertGroup(condition, validColumns, result.counter);
      clauses.push(`(${conditionResult.clause})`);
    } else {
      // It's a single condition
      conditionResult = convertCondition(condition, validColumns, result.counter);
      clauses.push(conditionResult.clause);
    }

    // Merge parameters
    Object.assign(result.params, conditionResult.params);
    result.counter = conditionResult.counter;
  }

  result.clause = clauses.join(` ${group.op} `);
  return result;
}

/**
 * Convert a single filter condition to SQL
 */
function convertCondition(condition: FilterCondition, validColumns: string[], paramCounter: number): ConvertResult {
  const result: ConvertResult = {
    clause: "",
    params: {},
    counter: paramCounter
  };

  // Validate column name (whitelist approach)
  if (!validColumns.includes(condition.column)) {
    throw new Error(`Invalid column name: ${condition.column}`);
  }

  // Validate operator
  if (!VALID_OPERATORS.has(condition.op)) {
    throw new Error(`Invalid operator: ${condition.op}`);
  }

  // Escape column name (additional safety)
  const safeColumn = `"${condition.column}"`;

  // Handle NULL operators
  if (NULL_OPERATORS.has(condition.op)) {
    result.clause = `${safeColumn} ${condition.op}`;
    return result;
  }

  // Validate that value exists for non-null operators
  if (condition.value === null || condition.value === undefined || condition.value === "") {
    throw new Error(`Value is required for operator ${condition.op}`);
  }

  // Handle array operators (IN, NOT IN)
  if (ARRAY_OPERATORS.has(condition.op)) {
    let values: any[];
    
    if (Array.isArray(condition.value)) {
      values = condition.value;
    } else if (typeof condition.value === 'string') {
      // Split comma-separated values
      values = condition.value.split(',').map(v => v.trim()).filter(v => v);
    } else {
      values = [condition.value];
    }

    if (values.length === 0) {
      throw new Error(`Operator ${condition.op} requires at least one value`);
    }

    // Create parameter placeholders
    const paramNames: string[] = [];
    values.forEach((value, index) => {
      const paramName = `param_${result.counter}`;
      paramNames.push(`$${paramName}`);
      result.params[paramName] = sanitizeValue(value);
      result.counter++;
    });

    result.clause = `${safeColumn} ${condition.op} (${paramNames.join(', ')})`;
    return result;
  }

  // Handle single value operators
  const paramName = `param_${result.counter}`;
  result.counter++;

  // Special handling for LIKE operators
  if (condition.op === "LIKE" || condition.op === "NOT LIKE") {
    // Add wildcards for LIKE operations
    result.params[paramName] = `%${String(condition.value)}%`;
  } else {
    result.params[paramName] = sanitizeValue(condition.value);
  }

  result.clause = `${safeColumn} ${condition.op} $${paramName}`;
  return result;
}

/**
 * Sanitize and convert values to appropriate types
 */
function sanitizeValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    
    // Try to convert to number if it looks like a number
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }
    
    // Try to convert to boolean
    const lower = trimmed.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false;
    }
    
    // Keep as string
    return trimmed;
  }

  // Numbers and booleans pass through
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  // Convert everything else to string
  return String(value);
}

/**
 * Build complete SQL query with filter
 */
export function buildMetricSQL(
  baseQuery: string,
  filter: FilterTree | null,
  dataSource: string,
  aggregateFunction: string = "SUM",
  valueColumn: string = "amount"
): SQLResult {
  const result: SQLResult = {
    whereClause: "",
    parameters: {},
    errors: []
  };

  // Validate inputs
  if (!baseQuery.trim()) {
    result.errors.push("Base query is required");
    return result;
  }

  if (!VALID_COLUMNS[dataSource]) {
    result.errors.push(`Invalid data source: ${dataSource}`);
    return result;
  }

  // Validate aggregate function (whitelist)
  const validAggregates = ["SUM", "COUNT", "AVG", "MIN", "MAX", "COUNT_DISTINCT"];
  if (!validAggregates.includes(aggregateFunction.toUpperCase())) {
    result.errors.push(`Invalid aggregate function: ${aggregateFunction}`);
    return result;
  }

  // Validate value column
  const validColumns = VALID_COLUMNS[dataSource];
  if (!validColumns.includes(valueColumn)) {
    result.errors.push(`Invalid value column: ${valueColumn}`);
    return result;
  }

  try {
    let sql = baseQuery;

    // Add filter WHERE clause if provided
    if (filter && !isFilterEmpty(filter)) {
      const filterResult = filterToSQL(filter, dataSource);
      
      if (filterResult.errors.length > 0) {
        result.errors.push(...filterResult.errors);
        return result;
      }

      if (filterResult.whereClause) {
        // Check if base query already has WHERE clause
        if (sql.toUpperCase().includes('WHERE')) {
          sql += ` AND (${filterResult.whereClause})`;
        } else {
          sql += ` WHERE ${filterResult.whereClause}`;
        }
        
        Object.assign(result.parameters, filterResult.parameters);
      }
    }

    // Build the complete query with aggregate
    const safeValueColumn = `"${valueColumn}"`;
    const safeAggregateFunction = aggregateFunction.toUpperCase();
    
    // Wrap the filtered query with aggregation
    result.whereClause = `
      SELECT ${safeAggregateFunction}(${safeValueColumn}) as amount
      FROM (${sql}) as filtered_data
    `.trim();

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

/**
 * Check if filter tree is empty
 */
function isFilterEmpty(filter: FilterTree): boolean {
  if ('conditions' in filter) {
    return filter.conditions.length === 0 || filter.conditions.every(condition => {
      if ('conditions' in condition) {
        return isFilterEmpty(condition);
      } else {
        return !condition.column || !condition.op;
      }
    });
  } else {
    return !filter.column || !filter.op;
  }
}

/**
 * Generate template SQL for common metric patterns
 */
export function generateMetricTemplate(
  dataSource: string,
  metricType: "revenue" | "count" | "average" | "conversion_rate",
  timePeriod: "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
): string {
  const table = dataSource;
  
  // Time period WHERE clause
  const timePeriodClause = getTimePeriodClause(timePeriod);
  
  switch (metricType) {
    case "revenue":
      return `
        SELECT 
          ${timePeriodClause} as period,
          SUM(amount) as amount
        FROM ${table}
        WHERE amount > 0
      `.trim();
      
    case "count":
      return `
        SELECT 
          ${timePeriodClause} as period,
          COUNT(*) as amount
        FROM ${table}
      `.trim();
      
    case "average":
      return `
        SELECT 
          ${timePeriodClause} as period,
          AVG(amount) as amount
        FROM ${table}
        WHERE amount IS NOT NULL
      `.trim();
      
    case "conversion_rate":
      return `
        SELECT 
          ${timePeriodClause} as period,
          (COUNT(CASE WHEN status = 'converted' THEN 1 END) * 100.0 / COUNT(*)) as amount
        FROM ${table}
      `.trim();
      
    default:
      return `SELECT SUM(amount) as amount FROM ${table}`;
  }
}

/**
 * Get time period clause for GROUP BY
 */
function getTimePeriodClause(timePeriod: string): string {
  switch (timePeriod) {
    case "daily":
      return "DATE(created_at)";
    case "weekly":
      return "DATE_TRUNC('week', created_at)";
    case "monthly":
      return "DATE_TRUNC('month', created_at)";
    case "quarterly":
      return "DATE_TRUNC('quarter', created_at)";
    case "yearly":
      return "DATE_TRUNC('year', created_at)";
    default:
      return "DATE(created_at)";
  }
}