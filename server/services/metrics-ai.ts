import OpenAI from "openai";
import { postgresAnalytics } from "./postgres-analytics.ts";
import { storage } from "../storage.ts";

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

interface DataSourceInfo {
  type: string;
  name: string;
  tables: string[];
  status: string;
}

interface CompanyContext {
  companyId: number;
  dataSources: DataSourceInfo[];
  schemaInfo: SchemaInfo;
}

export class MetricsAIService {
  async getCompanyContext(companyId: number): Promise<CompanyContext> {
    try {
      console.log(`🔄 Building context for company ${companyId}...`);
      
      // Get company's connected data sources
      const dataSources = await storage.getDataSources(companyId);
      const dataSourceInfo: DataSourceInfo[] = dataSources.map(ds => ({
        type: ds.type,
        name: ds.name,
        tables: ds.syncTables || [],
        status: ds.status
      }));
      
      // Get schema info for company's analytics schema
      const schemaInfo = await this.getSchemaInfoForCompany(companyId);
      
      console.log(`✅ Found ${dataSourceInfo.length} data sources for company ${companyId}`);
      console.log(`✅ Found ${schemaInfo.tables.length} tables in analytics schema`);
      
      return {
        companyId,
        dataSources: dataSourceInfo,
        schemaInfo
      };
    } catch (error) {
      console.error(`❌ Error building context for company ${companyId}:`, error);
      // Return minimal context to allow graceful degradation
      return {
        companyId,
        dataSources: [],
        schemaInfo: { tables: [] }
      };
    }
  }

  async getSchemaInfoForCompany(companyId: number): Promise<SchemaInfo> {
    try {
      console.log(`🔄 Starting PostgreSQL schema discovery for company ${companyId}...`);
      const tables = await postgresAnalytics.getAvailableTables(companyId);
      
      if (tables.length > 0) {
        console.log(`✅ Successfully discovered ${tables.length} tables for company ${companyId}`);
        
        // Get detailed schema info for each table
        const tableSchemas = await Promise.all(
          tables.map(async (tableName) => {
            const columns = await postgresAnalytics.getTableSchema(tableName, companyId);
            return {
              name: tableName,
              columns: columns.map(col => ({
                name: col.column_name,
                type: col.data_type.toUpperCase()
              }))
            };
          })
        );
        
        return { tables: tableSchemas };
      }
      
      throw new Error('No tables discovered');
    } catch (error) {
      console.error(`❌ PostgreSQL schema discovery failed for company ${companyId}:`, error);
      console.log('🔄 Falling back to static schema information...');
      return this.getStaticSchemaInfo();
    }
  }

  async getSchemaInfo(): Promise<SchemaInfo> {
    // Legacy method - falls back to static schema
    return this.getStaticSchemaInfo();
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
          name: 'stg_salesforce__accounts',
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

  async defineMetric(metricName: string, businessContext?: string, companyId?: number): Promise<MetricDefinition> {
    let companyContext: CompanyContext;
    
    if (companyId) {
      companyContext = await this.getCompanyContext(companyId);
    } else {
      // Fallback to legacy behavior
      const schema = await this.getSchemaInfo();
      companyContext = {
        companyId: 0,
        dataSources: [],
        schemaInfo: schema
      };
    }

    const formattedSchema = this.formatSchemaForPrompt(companyContext.schemaInfo);
    const dataSourceContext = this.formatDataSourceContext(companyContext.dataSources);

    const systemPrompt = `You are a senior data analyst and business intelligence expert. Based on the provided database schema and connected data sources, define business metrics and write SQL queries to calculate them.

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

CRITICAL MULTI-SOURCE INTELLIGENCE RULES:
- When multiple data sources contain similar data (e.g., Salesforce + HubSpot for revenue), AGGREGATE across sources
- For revenue metrics: combine Salesforce opportunities + HubSpot deals + QuickBooks invoices where available
- For customer metrics: deduplicate customers across CRM systems using email or company name
- Use UNION or JOIN operations to combine data from multiple sources
- Include proper schema prefix: analytics_company_{companyId}.table_name
- Always prefer actual data aggregation over single-source queries when multiple sources exist

SQL CONSTRUCTION RULES:
- SQL must be valid PostgreSQL and executable using ONLY the tables provided
- Use appropriate aggregation functions (SUM, COUNT, AVG, etc.)
- Include proper date filtering for current period calculations
- Always include WHERE clauses with date ranges (e.g., WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE))
- For multi-source queries, use COALESCE to handle NULL values
- Focus on actionable business metrics that executives care about
- Ensure queries are optimized and meaningful
- Do NOT use tables that aren't listed in the provided schema`;

    const userPrompt = `Company Data Sources:
${dataSourceContext}

Database Schema:
${formattedSchema}

Metric to define: ${metricName}
${businessContext ? `Business context: ${businessContext}` : ''}

IMPORTANT: If this company has multiple data sources that contain relevant data for this metric, write SQL that aggregates across ALL relevant sources. For example:
- Revenue metrics should combine Salesforce + HubSpot + QuickBooks data where available
- Customer counts should deduplicate across CRM systems
- Lead/contact metrics should aggregate marketing and sales data

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
      const result = await postgresAnalytics.executeQuery(sqlQuery);
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

  async chatWithAssistant(message: string, context?: any, companyId?: number): Promise<string> {
    // Fetch company context if available
    let companyContext = '';
    console.log(`🤖 Chat request - Company ID: ${companyId}, Message: "${message.substring(0, 50)}..."`);
    
    if (companyId) {
      try {
        const ctx = await this.getCompanyContext(companyId);
        console.log(`📊 Found ${ctx.schemaInfo.tables.length} tables for company ${companyId}`);
        
        if (ctx.schemaInfo.tables.length > 0) {
          companyContext = `\n\n## Company Data Context:\n`;
          companyContext += `### Available Tables (${ctx.schemaInfo.tables.length} total):\n`;
          // Group tables by type
          const coreTables = ctx.schemaInfo.tables.filter(t => t.name.startsWith('core_'));
          const stgTables = ctx.schemaInfo.tables.filter(t => t.name.startsWith('stg_'));
          const intTables = ctx.schemaInfo.tables.filter(t => t.name.startsWith('int_'));
          
          if (coreTables.length > 0) {
            companyContext += `\n**Core Tables:** ${coreTables.map(t => `\`${t.name}\``).join(', ')}\n`;
          }
          if (stgTables.length > 0) {
            companyContext += `**Staging Tables:** ${stgTables.map(t => `\`${t.name}\``).join(', ')}\n`;
          }
          if (intTables.length > 0) {
            companyContext += `**Intermediate Tables:** ${intTables.map(t => `\`${t.name}\``).join(', ')}\n`;
          }
          
          if (ctx.dataSources.length > 0) {
            companyContext += `\n### Connected Systems:\n`;
            companyContext += ctx.dataSources.map(ds => `- **${ds.name}** (${ds.type}) - Status: ${ds.status}`).join('\n');
            companyContext += '\n';
          }
        }
      } catch (error) {
        console.log('⚠️ Could not fetch company context:', error);
      }
    } else {
      console.log('⚠️ No company ID provided for chat');
    }

    const systemPrompt = `You are a helpful business metrics and analytics assistant. Help users understand, create, and optimize their business KPIs.

**IMPORTANT FORMATTING RULES:**
- Always format your responses using proper Markdown
- Use headers (##, ###) to organize sections
- Use bullet points (- or *) for lists
- Use **bold** for emphasis on key terms
- Use \`inline code\` for metric names, SQL keywords, or formulas
- Use code blocks (\`\`\`sql) for SQL queries
- Use numbered lists (1., 2., 3.) for step-by-step instructions
- Include line breaks between sections for readability

You can:
- Explain business metrics and their importance
- Help define new metrics based on business goals
- Suggest improvements to existing metrics
- Provide insights about metric interpretation
- Help with SQL queries and calculations
- List and describe available database tables when asked
- Reference actual company data and connected systems

When users ask about available tables or data:
- ALWAYS list the specific tables available in their company's database
- Explain what each table type contains (core = processed data, stg = staging, int = intermediate)
- Mention connected systems like HubSpot, Salesforce, etc.

Keep responses well-structured, actionable, and business-focused.${companyContext}`;

    try {
      if (!openai) {
        throw new Error("OpenAI API key not configured");
      }
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please provide a well-formatted response with markdown:\n\n${message}` }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      return response.choices[0].message.content || "I'm sorry, I couldn't process your request.";
    } catch (error) {
      console.error('Error in chat:', error);
      // Return a formatted fallback response
      return `## Unable to Connect to AI Service

I'm currently unable to connect to the AI service, but I can still help you with metrics guidance:

### Common Business Metrics:
- **Monthly Recurring Revenue (MRR)** - Total predictable revenue per month
- **Customer Acquisition Cost (CAC)** - Cost to acquire a new customer
- **Customer Lifetime Value (CLV)** - Total revenue from a customer relationship
- **Churn Rate** - Percentage of customers who stop using your service
- **Net Promoter Score (NPS)** - Customer satisfaction and loyalty metric

### To Calculate Metrics:

1. **Identify your data source** (e.g., \`core_customer_metrics\` table)
2. **Define the calculation formula**
3. **Set appropriate time periods** (daily, monthly, yearly)
4. **Establish realistic goals** based on industry benchmarks

Would you like help with a specific metric calculation?`;
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

  private formatDataSourceContext(dataSources: DataSourceInfo[]): string {
    if (dataSources.length === 0) {
      return "No connected data sources available.";
    }

    return dataSources
      .map(ds => {
        const tables = ds.tables.length > 0 ? ds.tables.join(', ') : 'No specific tables configured';
        return `- ${ds.name} (${ds.type}): Status: ${ds.status}, Tables: ${tables}`;
      })
      .join('\n');
  }
}

export const metricsAIService = new MetricsAIService();