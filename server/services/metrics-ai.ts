import OpenAI from "openai";
import { snowflakeService } from "./snowflake.ts";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.warn("OpenAI API key not found in environment variables");
}
const openai = apiKey ? new OpenAI({ apiKey }) : null;

interface MetricDefinition {
  name: string;
  description: string;
  sqlQuery: string;
  category: string;
  format: string;
  yearlyGoal?: string;
  rationale: string;
}

interface SchemaInfo {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
    }>;
  }>;
}

export class MetricsAIService {
  async getSchemaInfo(): Promise<SchemaInfo> {
    try {
      // 15 second timeout for CORE schema query
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Schema query timeout')), 15000)
      );
      
      const queryPromise = snowflakeService.executeQuery(`
        SELECT table_name, column_name, data_type
        FROM MIAS_DATA_DB.information_schema.columns
        WHERE table_schema = 'CORE'
        ORDER BY table_name, ordinal_position
      `);

      const result = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (!result.success || !result.data) {
        return { tables: [] };
      }

      const schemaMap = new Map<string, Array<{ name: string; type: string }>>();
      
      result.data.forEach((row: any) => {
        const tableName = row.TABLE_NAME || row[0];
        const columnName = row.COLUMN_NAME || row[1];
        const dataType = row.DATA_TYPE || row[2];
        
        if (!schemaMap.has(tableName)) {
          schemaMap.set(tableName, []);
        }
        schemaMap.get(tableName)!.push({
          name: columnName,
          type: dataType
        });
      });

      return {
        tables: Array.from(schemaMap.entries()).map(([name, columns]) => ({
          name,
          columns
        }))
      };
    } catch (error) {
      console.error('Error getting schema info:', error);
      console.log('Falling back to static schema information...');
      return this.getStaticSchemaInfo();
    }
  }

  private getStaticSchemaInfo(): SchemaInfo {
    // Fallback schema based on your dbt models
    return {
      tables: [
        {
          name: 'core_revenue_analytics',
          columns: [
            { name: 'current_mrr', type: 'NUMBER' },
            { name: 'current_arr', type: 'NUMBER' },
            { name: 'current_active_customers', type: 'NUMBER' },
            { name: 'mrr_growth_rate', type: 'NUMBER' },
            { name: 'arpu', type: 'NUMBER' },
            { name: 'avg_monthly_churn_rate', type: 'NUMBER' },
            { name: 'avg_customer_ltv', type: 'NUMBER' },
            { name: 'calculated_at', type: 'TIMESTAMP' }
          ]
        },
        {
          name: 'core_customer_metrics',
          columns: [
            { name: 'customer_identifier', type: 'STRING' },
            { name: 'first_purchase_date', type: 'DATE' },
            { name: 'total_revenue', type: 'NUMBER' },
            { name: 'customer_status', type: 'STRING' },
            { name: 'customer_lifetime_value', type: 'NUMBER' }
          ]
        },
        {
          name: 'stg_quickbooks_transactions',
          columns: [
            { name: 'transaction_id', type: 'STRING' },
            { name: 'transaction_date', type: 'DATE' },
            { name: 'total_amount', type: 'NUMBER' },
            { name: 'transaction_type', type: 'STRING' },
            { name: 'customer_id', type: 'STRING' },
            { name: 'customer_name', type: 'STRING' },
            { name: 'recognized_revenue', type: 'NUMBER' },
            { name: 'recognized_expense', type: 'NUMBER' },
            { name: 'transaction_category', type: 'STRING' },
            { name: 'fiscal_year', type: 'NUMBER' },
            { name: 'fiscal_month', type: 'NUMBER' }
          ]
        },
        {
          name: 'stg_salesforce_accounts',
          columns: [
            { name: 'account_id', type: 'STRING' },
            { name: 'account_name', type: 'STRING' },
            { name: 'annual_revenue', type: 'NUMBER' },
            { name: 'industry', type: 'STRING' },
            { name: 'created_date', type: 'DATE' }
          ]
        },
        {
          name: 'int_subscription_events',
          columns: [
            { name: 'customer_identifier', type: 'STRING' },
            { name: 'event_date', type: 'DATE' },
            { name: 'event_type', type: 'STRING' },
            { name: 'amount', type: 'NUMBER' },
            { name: 'subscription_id', type: 'STRING' }
          ]
        }
      ]
    };
  }

  async defineMetric(metricName: string, businessContext?: string): Promise<MetricDefinition> {
    const schema = await this.getSchemaInfo();
    const formattedSchema = this.formatSchemaForPrompt(schema);

    const systemPrompt = `You are a senior data analyst and business intelligence expert. Based on the provided database schema, define business metrics and write SQL queries to calculate them.

Your response must be a valid JSON object with this exact structure:
{
  "name": "metric name",
  "description": "clear business definition",
  "sqlQuery": "SELECT statement to calculate the metric",
  "category": "one of: revenue, growth, retention, efficiency",
  "format": "one of: currency, percentage, number",
  "yearlyGoal": "suggested realistic yearly target",
  "rationale": "explanation of why this metric matters and how it's calculated"
}

Rules:
- SQL must be valid and executable using ONLY the tables provided in the schema
- Use appropriate aggregation functions (SUM, COUNT, AVG, etc.)
- Include proper date filtering for current period calculations
- For revenue metrics, prefer core_revenue_analytics or stg_quickbooks_transactions
- For customer metrics, use core_customer_metrics or int_subscription_events
- Always include DATE filtering (e.g., WHERE event_date >= DATEADD('month', -1, CURRENT_DATE))
- Focus on actionable business metrics that executives care about
- Ensure queries are optimized and meaningful
- Do NOT use tables that aren't listed in the provided schema`;

    const userPrompt = `Database Schema:
${formattedSchema}

Metric to define: ${metricName}
${businessContext ? `Business context: ${businessContext}` : ''}

Please define this metric and provide the SQL query to calculate it.`;

    try {
      if (!openai) {
        throw new Error("OpenAI API key not configured");
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      return JSON.parse(content) as MetricDefinition;
    } catch (error) {
      console.error('Error defining metric:', error);
      throw new Error(`Failed to define metric: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async suggestMetrics(businessType: string = "saas"): Promise<MetricDefinition[]> {
    // Skip database schema lookup for suggestions to avoid timeout
    const formattedSchema = "No specific database schema available - provide general metric suggestions.";

    const systemPrompt = `You are a business intelligence expert. Suggest 5-8 key business metrics that would be most valuable for a ${businessType} business.

Your response must be a valid JSON object with this exact structure:
{
  "metrics": [
    {
      "name": "metric name",
      "description": "clear business definition",
      "sqlQuery": "SELECT COUNT(*) as example_metric FROM example_table",
      "category": "one of: revenue, growth, retention, efficiency",
      "format": "one of: currency, percentage, number",
      "yearlyGoal": "suggested realistic yearly target",
      "rationale": "explanation of why this metric matters"
    }
  ]
}

Focus on metrics that:
- Provide actionable business insights
- Are industry-standard KPIs
- Cover different aspects of business performance
- Include example SQL queries for reference`;

    const userPrompt = `Database Schema:
${formattedSchema}

Business Type: ${businessType}

Please suggest the most important metrics this business should track.`;

    try {
      if (!openai) {
        throw new Error("OpenAI API key not configured");
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : parsed.metrics || [];
    } catch (error) {
      console.error('Error suggesting metrics:', error);
      throw new Error(`Failed to suggest metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async calculateMetric(sqlQuery: string): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      const result = await snowflakeService.executeQuery(sqlQuery);
      return {
        success: result.success,
        result: result.data,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async chatWithAssistant(message: string, context?: any): Promise<string> {
    const systemPrompt = `You are a helpful business metrics and analytics assistant. Help users understand, create, and optimize their business KPIs. 

You can:
- Explain business metrics and their importance
- Help define new metrics based on business goals
- Suggest improvements to existing metrics
- Provide insights about metric interpretation
- Help with general guidance on metric calculations

Keep responses concise, actionable, and business-focused. Focus on metric concepts rather than specific database implementations.`;

    try {
      if (!openai) {
        throw new Error("OpenAI API key not configured");
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return response.choices[0].message.content || "I'm sorry, I couldn't process your request.";
    } catch (error) {
      console.error('Error in chat:', error);
      return "I'm experiencing some technical difficulties. Please try again.";
    }
  }

  private formatSchemaForPrompt(schema: SchemaInfo): string {
    if (schema.tables.length === 0) {
      return "No database schema available.";
    }

    return schema.tables
      .map(table => {
        const columns = table.columns
          .map(col => `  - ${col.name} (${col.type})`)
          .join('\n');
        return `Table: ${table.name}\n${columns}`;
      })
      .join('\n\n');
  }
}

export const metricsAIService = new MetricsAIService();