import { FilterTree, FilterGroup, FilterCondition } from "@/components/metrics/filter-builder";

// Validation errors
export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning";
}

// Field definitions for validation
export interface FieldDefinition {
  name: string;
  type: "string" | "number" | "date" | "boolean";
  label: string;
  required?: boolean;
  enum?: string[];
}

// Data source definition
export interface DataSourceDefinition {
  id: string;
  name: string;
  description: string;
  fields: FieldDefinition[];
}

// Available data sources (matching filter-builder.tsx)
export const DATA_SOURCES: DataSourceDefinition[] = [
  {
    id: "core.fact_financials",
    name: "Financial Data",
    description: "Revenue, expenses, and financial metrics",
    fields: [
      { name: "invoice_amount", type: "number", label: "Invoice Amount" },
      { name: "expense_amount", type: "number", label: "Expense Amount" },
      { name: "transaction_date", type: "date", label: "Transaction Date" },
      { name: "category", type: "string", label: "Category" },
      { name: "customer_id", type: "string", label: "Customer ID" }
    ]
  },
  {
    id: "core.fact_hubspot",
    name: "HubSpot CRM",
    description: "Deals, contacts, and sales data",
    fields: [
      { name: "stage", type: "string", label: "Deal Stage", enum: ["prospecting", "qualification", "needs_analysis", "proposal", "negotiation", "closedwon", "closedlost"] },
      { name: "deal_type", type: "string", label: "Deal Type", enum: ["new_business", "existing_business", "renewal", "expansion", "enterprise", "smb"] },
      { name: "priority", type: "string", label: "Priority", enum: ["low", "medium", "high", "critical"] },
      { name: "amount", type: "number", label: "Deal Amount" },
      { name: "close_date", type: "date", label: "Close Date" },
      { name: "owner", type: "string", label: "Deal Owner" }
    ]
  },
  {
    id: "core.fact_jira",
    name: "Jira Issues",
    description: "Project issues and tickets",
    fields: [
      { name: "status", type: "string", label: "Issue Status", enum: ["todo", "in_progress", "review", "done", "blocked"] },
      { name: "priority", type: "string", label: "Priority", enum: ["lowest", "low", "medium", "high", "highest"] },
      { name: "issue_type", type: "string", label: "Issue Type", enum: ["story", "task", "bug", "epic", "subtask"] },
      { name: "assignee", type: "string", label: "Assignee" },
      { name: "created_date", type: "date", label: "Created Date" },
      { name: "story_points", type: "number", label: "Story Points" }
    ]
  },
  {
    id: "core.fact_salesforce",
    name: "Salesforce",
    description: "Opportunities and accounts",
    fields: [
      { name: "stage_name", type: "string", label: "Stage Name", enum: ["prospecting", "qualification", "needs_analysis", "value_proposition", "id_decision_makers", "proposal", "negotiation", "closed_won", "closed_lost"] },
      { name: "type", type: "string", label: "Opportunity Type", enum: ["existing_customer_upgrade", "existing_customer_replacement", "existing_customer_downgrade", "new_customer"] },
      { name: "lead_source", type: "string", label: "Lead Source", enum: ["web", "phone_inquiry", "partner_referral", "purchased_list", "other"] },
      { name: "amount", type: "number", label: "Amount" },
      { name: "probability", type: "number", label: "Probability" },
      { name: "account_name", type: "string", label: "Account Name" }
    ]
  }
];

// Valid operators by field type
const VALID_OPERATORS_BY_TYPE: Record<string, string[]> = {
  string: ["=", "!=", "IN", "NOT IN", "IS NULL", "IS NOT NULL", "LIKE", "NOT LIKE"],
  number: ["=", "!=", ">", "<", ">=", "<=", "IN", "NOT IN", "IS NULL", "IS NOT NULL"],
  date: ["=", "!=", ">", "<", ">=", "<=", "IS NULL", "IS NOT NULL"],
  boolean: ["=", "!=", "IS NULL", "IS NOT NULL"]
};

// Operators that don't require values
const NULL_OPERATORS = ["IS NULL", "IS NOT NULL"];

// Operators that expect arrays
const ARRAY_OPERATORS = ["IN", "NOT IN"];

/**
 * Validate a complete filter tree
 */
export function validateFilter(filter: FilterTree, dataSourceId: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const dataSource = DATA_SOURCES.find(ds => ds.id === dataSourceId);
  
  if (!dataSource) {
    errors.push({
      path: "root",
      message: `Invalid data source: ${dataSourceId}`,
      severity: "error"
    });
    return errors;
  }

  if ('conditions' in filter) {
    // It's a FilterGroup
    validateGroup(filter, dataSource, "root", errors);
  } else {
    // It's a single FilterCondition
    validateCondition(filter, dataSource, "root", errors);
  }

  return errors;
}

/**
 * Validate a filter group
 */
function validateGroup(group: FilterGroup, dataSource: DataSourceDefinition, path: string, errors: ValidationError[]): void {
  // Validate group operator
  if (!["AND", "OR"].includes(group.op)) {
    errors.push({
      path: `${path}.op`,
      message: `Invalid group operator: ${group.op}. Must be AND or OR`,
      severity: "error"
    });
  }

  // Validate that group has conditions
  if (!group.conditions || group.conditions.length === 0) {
    errors.push({
      path: `${path}.conditions`,
      message: "Group must contain at least one condition",
      severity: "error"
    });
    return;
  }

  // Validate each condition in the group
  group.conditions.forEach((condition, index) => {
    const conditionPath = `${path}.conditions[${index}]`;
    
    if ('conditions' in condition) {
      // It's a nested group
      validateGroup(condition, dataSource, conditionPath, errors);
    } else {
      // It's a condition
      validateCondition(condition, dataSource, conditionPath, errors);
    }
  });
}

/**
 * Validate a single filter condition
 */
function validateCondition(condition: FilterCondition, dataSource: DataSourceDefinition, path: string, errors: ValidationError[]): void {
  // Validate field exists
  const field = dataSource.fields.find(f => f.name === condition.column);
  if (!field) {
    errors.push({
      path: `${path}.column`,
      message: `Field "${condition.column}" does not exist in data source "${dataSource.name}"`,
      severity: "error"
    });
    return; // Can't validate further without field definition
  }

  // Validate operator is valid for field type
  const validOperators = VALID_OPERATORS_BY_TYPE[field.type] || [];
  if (!validOperators.includes(condition.op)) {
    errors.push({
      path: `${path}.op`,
      message: `Operator "${condition.op}" is not valid for ${field.type} field "${field.name}". Valid operators: ${validOperators.join(", ")}`,
      severity: "error"
    });
  }

  // Validate value based on operator and field type
  validateConditionValue(condition, field, path, errors);
}

/**
 * Validate condition value based on field type and operator
 */
function validateConditionValue(condition: FilterCondition, field: FieldDefinition, path: string, errors: ValidationError[]): void {
  // Null operators don't need values
  if (NULL_OPERATORS.includes(condition.op)) {
    if (condition.value !== "" && condition.value !== null && condition.value !== undefined) {
      errors.push({
        path: `${path}.value`,
        message: `Operator "${condition.op}" should not have a value`,
        severity: "warning"
      });
    }
    return;
  }

  // Check if value is provided for non-null operators
  if (condition.value === "" || condition.value === null || condition.value === undefined) {
    errors.push({
      path: `${path}.value`,
      message: `Value is required for operator "${condition.op}"`,
      severity: "error"
    });
    return;
  }

  // Validate array operators
  if (ARRAY_OPERATORS.includes(condition.op)) {
    if (!Array.isArray(condition.value)) {
      // Try to parse as comma-separated string
      if (typeof condition.value === 'string') {
        const arrayValue = condition.value.split(',').map(v => v.trim()).filter(v => v);
        if (arrayValue.length === 0) {
          errors.push({
            path: `${path}.value`,
            message: `Operator "${condition.op}" requires at least one value`,
            severity: "error"
          });
          return;
        }
      } else {
        errors.push({
          path: `${path}.value`,
          message: `Operator "${condition.op}" requires an array of values`,
          severity: "error"
        });
        return;
      }
    }
    
    // Validate each value in the array
    const values = Array.isArray(condition.value) ? condition.value : condition.value.toString().split(',').map(v => v.trim());
    values.forEach((value, index) => {
      validateSingleValue(value, field, `${path}.value[${index}]`, errors);
    });
    
    return;
  }

  // Validate single value
  validateSingleValue(condition.value, field, `${path}.value`, errors);
}

/**
 * Validate a single value against field type
 */
function validateSingleValue(value: any, field: FieldDefinition, path: string, errors: ValidationError[]): void {
  const stringValue = String(value).trim();
  
  switch (field.type) {
    case "number":
      if (isNaN(Number(stringValue))) {
        errors.push({
          path,
          message: `Value "${stringValue}" is not a valid number for field "${field.name}"`,
          severity: "error"
        });
      }
      break;
      
    case "date":
      // Check if it's a valid date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(stringValue)) {
        errors.push({
          path,
          message: `Value "${stringValue}" is not a valid date format (YYYY-MM-DD) for field "${field.name}"`,
          severity: "error"
        });
      } else {
        // Check if the date is actually valid
        const date = new Date(stringValue);
        if (isNaN(date.getTime())) {
          errors.push({
            path,
            message: `Value "${stringValue}" is not a valid date for field "${field.name}"`,
            severity: "error"
          });
        }
      }
      break;
      
    case "boolean":
      const boolValue = stringValue.toLowerCase();
      if (!["true", "false", "1", "0", "yes", "no"].includes(boolValue)) {
        errors.push({
          path,
          message: `Value "${stringValue}" is not a valid boolean for field "${field.name}". Use: true, false, 1, 0, yes, or no`,
          severity: "error"
        });
      }
      break;
      
    case "string":
      // Check enum values if defined
      if (field.enum && field.enum.length > 0) {
        if (!field.enum.includes(stringValue)) {
          errors.push({
            path,
            message: `Value "${stringValue}" is not valid for field "${field.name}". Valid values: ${field.enum.join(", ")}`,
            severity: "error"
          });
        }
      }
      break;
  }
}

/**
 * Convert filter tree to human-readable description
 */
export function filterToDescription(filter: FilterTree, dataSourceId: string): string {
  const dataSource = DATA_SOURCES.find(ds => ds.id === dataSourceId);
  if (!dataSource) return "Invalid data source";

  if ('conditions' in filter) {
    return groupToDescription(filter, dataSource);
  } else {
    return conditionToDescription(filter, dataSource);
  }
}

function groupToDescription(group: FilterGroup, dataSource: DataSourceDefinition): string {
  if (!group.conditions || group.conditions.length === 0) {
    return "Empty filter group";
  }

  const conditionDescriptions = group.conditions.map(condition => {
    if ('conditions' in condition) {
      return `(${groupToDescription(condition, dataSource)})`;
    } else {
      return conditionToDescription(condition, dataSource);
    }
  });

  return conditionDescriptions.join(` ${group.op} `);
}

function conditionToDescription(condition: FilterCondition, dataSource: DataSourceDefinition): string {
  const field = dataSource.fields.find(f => f.name === condition.column);
  const fieldLabel = field?.label || condition.column;
  
  switch (condition.op) {
    case "=":
      return `${fieldLabel} equals "${condition.value}"`;
    case "!=":
      return `${fieldLabel} does not equal "${condition.value}"`;
    case ">":
      return `${fieldLabel} is greater than ${condition.value}`;
    case "<":
      return `${fieldLabel} is less than ${condition.value}`;
    case ">=":
      return `${fieldLabel} is greater than or equal to ${condition.value}`;
    case "<=":
      return `${fieldLabel} is less than or equal to ${condition.value}`;
    case "IN":
      const inValues = Array.isArray(condition.value) ? condition.value : [condition.value];
      return `${fieldLabel} is one of: ${inValues.join(", ")}`;
    case "NOT IN":
      const notInValues = Array.isArray(condition.value) ? condition.value : [condition.value];
      return `${fieldLabel} is not one of: ${notInValues.join(", ")}`;
    case "IS NULL":
      return `${fieldLabel} is empty`;
    case "IS NOT NULL":
      return `${fieldLabel} is not empty`;
    case "LIKE":
      return `${fieldLabel} contains "${condition.value}"`;
    case "NOT LIKE":
      return `${fieldLabel} does not contain "${condition.value}"`;
    default:
      return `${fieldLabel} ${condition.op} ${condition.value}`;
  }
}

/**
 * Check if filter tree is empty or has meaningful conditions
 */
export function isFilterEmpty(filter: FilterTree): boolean {
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
 * Get all field names used in a filter (for dependency checking)
 */
export function getFilterFields(filter: FilterTree): string[] {
  const fields: string[] = [];
  
  if ('conditions' in filter) {
    filter.conditions.forEach(condition => {
      if ('conditions' in condition) {
        fields.push(...getFilterFields(condition));
      } else {
        if (condition.column) {
          fields.push(condition.column);
        }
      }
    });
  } else {
    if (filter.column) {
      fields.push(filter.column);
    }
  }
  
  return [...new Set(fields)]; // Remove duplicates
}

/**
 * Suggest fixes for validation errors
 */
export function suggestFixes(errors: ValidationError[], filter: FilterTree, dataSourceId: string): string[] {
  const suggestions: string[] = [];
  const dataSource = DATA_SOURCES.find(ds => ds.id === dataSourceId);
  
  if (!dataSource) return suggestions;
  
  errors.forEach(error => {
    if (error.message.includes("does not exist")) {
      const availableFields = dataSource.fields.map(f => f.label).join(", ");
      suggestions.push(`Available fields: ${availableFields}`);
    } else if (error.message.includes("not valid for")) {
      if (error.path.includes(".op")) {
        suggestions.push("Check the operator compatibility with the selected field type");
      } else if (error.path.includes(".value")) {
        suggestions.push("Verify the value format matches the field type requirements");
      }
    } else if (error.message.includes("requires at least one")) {
      suggestions.push("Add at least one value for IN/NOT IN operators");
    }
  });
  
  return [...new Set(suggestions)]; // Remove duplicates
}