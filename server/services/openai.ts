import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

interface KpiSuggestion {
  name: string;
  description: string;
  sql_template?: string;
  difficulty: "Easy" | "Medium" | "Hard";
  business_impact: "High" | "Medium" | "Low";
}

interface ChatResponse {
  content: string;
  metadata?: {
    suggestions?: KpiSuggestion[];
    sql_query?: string;
    kpi_type?: string;
  };
}

interface SqlGenerationResponse {
  sql: string;
  explanation: string;
  dependencies: string[];
  complexity: "Simple" | "Moderate" | "Complex";
}

class OpenAIService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "";
    
    if (!apiKey) {
      console.warn("OpenAI API key not found in environment variables");
    }

    this.openai = new OpenAI({ 
      apiKey: apiKey || "default_key"
    });
  }

  async getChatResponse(userMessage: string): Promise<ChatResponse> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return this.getFallbackResponse(userMessage);
      }

      const systemPrompt = `You are a data warehouse and business intelligence expert assistant. You help users with:
      1. Suggesting relevant KPIs for their business
      2. Generating SQL queries for data analysis
      3. Explaining data warehouse concepts
      4. Troubleshooting data pipeline issues
      
      You have access to a Snowflake data warehouse with these main data sources:
      - Salesforce (CRM data: accounts, opportunities, contacts)
      - HubSpot (Marketing data: contacts, companies, deals)
      - QuickBooks (Financial data: customers, invoices, payments)
      
      The data is organized in layers:
      - Staging (stg_*): Clean, standardized raw data
      - Intermediate (int_*): Joined and business logic applied
      - Core (*_metrics, *_analytics): Final business metrics and KPIs
      
      Key tables available:
      - core_customer_metrics: Customer health scores, segments, revenue
      - core_revenue_analytics: ARR, MRR, churn, growth metrics
      - int_customer_unified: Unified customer view across sources
      - int_subscription_events: Customer lifecycle events
      
      Provide helpful, actionable responses. If suggesting KPIs, format them as structured suggestions.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0].message.content || "";
      
      // Check if the response contains KPI suggestions and try to extract them
      const metadata = await this.extractMetadataFromResponse(content, userMessage);

      return {
        content,
        metadata
      };
    } catch (error) {
      console.error("OpenAI API error:", error);
      return this.getFallbackResponse(userMessage);
    }
  }

  async suggestKPIs(businessType: string = "saas"): Promise<ChatResponse> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return this.getFallbackKPISuggestions(businessType);
      }

      const prompt = `Based on the business type "${businessType}" and the available data sources (Salesforce, HubSpot, QuickBooks), suggest 4-6 relevant KPIs.

      Available data includes:
      - Customer data (accounts, contacts, deals)
      - Revenue data (invoices, payments, subscriptions)
      - Sales pipeline data (opportunities, deal stages)
      - Marketing data (lead sources, campaign performance)

      For each KPI, provide:
      1. Name
      2. Description (business value)
      3. Difficulty to implement (Easy/Medium/Hard)
      4. Business impact (High/Medium/Low)

      Respond in JSON format with an array of KPI objects.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        content: `I've analyzed your ${businessType} business type and available data sources. Here are the most relevant KPIs I recommend implementing:`,
        metadata: {
          suggestions: result.kpis || result.suggestions || []
        }
      };
    } catch (error) {
      console.error("OpenAI KPI suggestion error:", error);
      return this.getFallbackKPISuggestions(businessType);
    }
  }

  async generateSQL(kpiDescription: string, availableTables: string[] = [], companyId?: number): Promise<SqlGenerationResponse> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return this.getFallbackSQL(kpiDescription, companyId);
      }

      // Get detailed schema context for this specific company
      const { postgresAnalyticsService } = await import('./postgres-analytics.js');
      let schemaContext = '';
      
      if (companyId) {
        try {
          schemaContext = await postgresAnalyticsService.getSchemaContextForCompany(companyId);
          console.log(`✅ Got detailed schema context for company ${companyId}`);
        } catch (error) {
          console.warn(`⚠️ Could not get schema context for company ${companyId}, using fallback:`, error);
          schemaContext = this.getFallbackSchemaContext(availableTables, companyId);
        }
      } else {
        schemaContext = this.getFallbackSchemaContext(availableTables, companyId);
      }

      const prompt = `Generate a SQL query to calculate the KPI: "${kpiDescription}"

      ${schemaContext}

      Requirements:
      1. ONLY use tables and columns that exist in the schema provided above
      2. Use EXACT table names and column names as shown in the schema
      3. Write efficient PostgreSQL queries with proper aggregations
      4. For time-based metrics, use appropriate date filters and DATE_TRUNC functions
      5. Include comments explaining business logic
      6. Handle NULL values properly with COALESCE
      7. For averages, use: COALESCE(SUM(amount), 0) / NULLIF(COUNT(*), 0)
      8. Use {companyId} placeholder in table references (it will be replaced automatically)
      
      CRITICAL SQL STRUCTURE REQUIREMENTS:
      - Your SQL must return ONLY these two columns: current_value, calculated_at
      - Do NOT include metric_name, category, format, yearly_goal - these will be added automatically
      - Return format: SELECT [your_calculation] as current_value, NOW() as calculated_at
      - Do NOT assume table or column names - use EXACT names from schema above
      - If metric requires data from multiple tables, use UNION ALL to combine them
      - Pay attention to stage/status values (some systems use 'Closed Won', others use 'closedwon')
      
      EXAMPLE PATTERNS for different metrics:
      - Deal Size: SELECT COALESCE(AVG(amount), 0) as current_value, NOW() as calculated_at FROM ...
      - Revenue: SELECT COALESCE(SUM(amount), 0) as current_value, NOW() as calculated_at FROM ...
      - Customer Count: SELECT COUNT(DISTINCT customer_field) as current_value, NOW() as calculated_at FROM ...
      - Time Periods: Use closedate, created_date, or similar date fields for filtering

      The query result will be wrapped automatically with metadata columns. Focus ONLY on calculating the metric value.

      Respond in JSON format with: sql, explanation, dependencies (array), complexity (Simple/Moderate/Complex)`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      
      return {
        sql: result.sql || "-- SQL generation failed",
        explanation: result.explanation || "Failed to generate explanation",
        dependencies: result.dependencies || [],
        complexity: result.complexity || "Complex"
      };
    } catch (error) {
      console.error("OpenAI SQL generation error:", error);
      return this.getFallbackSQL(kpiDescription, companyId);
    }
  }

  private async extractMetadataFromResponse(content: string, userMessage: string): Promise<any> {
    // Simple keyword-based detection for KPI-related responses
    const kpiKeywords = ["kpi", "metric", "measure", "calculate", "track", "monitor"];
    const isKpiRelated = kpiKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword) || content.toLowerCase().includes(keyword)
    );

    if (isKpiRelated) {
      // Try to extract structured KPI suggestions if mentioned
      if (content.toLowerCase().includes("suggest") || content.toLowerCase().includes("recommend")) {
        return {
          suggestions: [
            {
              name: "Customer Acquisition Cost (CAC)",
              description: "Total marketing spend divided by new customers acquired",
              difficulty: "Medium",
              business_impact: "High"
            },
            {
              name: "Net Revenue Retention",
              description: "Revenue retention from existing customers over time",
              difficulty: "Hard",
              business_impact: "High"
            }
          ]
        };
      }
    }

    return undefined;
  }

  private getFallbackSchemaContext(availableTables: string[] = [], companyId?: number): string {
    const tablesContext = availableTables.length > 0 
      ? `Available tables: ${availableTables.join(", ")}`
      : `Available tables: core_metrics_dashboard, core_user_metrics (fallback - no dynamic discovery available)`;
    
    return `Context:
- Data warehouse: PostgreSQL
- Company schema: analytics_company_${companyId || '{companyId}'}
- ${tablesContext}

Table schemas (key fields):
CORE LAYER (fallback):
- core_metrics_dashboard: close_date, daily_revenue, daily_profit, cumulative_revenue (RUNNING SUM), cumulative_profit (RUNNING SUM), revenue_progress_pct, profit_progress_pct, day_label, week_label, month_label
- core_user_metrics: metric_name, category, format, yearly_goal, current_value, progress_pct, calculated_at

TIME-PERIOD QUERY PATTERNS:
- Daily Running Sum: SUM(daily_column) OVER (ORDER BY close_date) 
- Weekly Aggregation: SUM(daily_column) GROUP BY DATE_TRUNC('week', close_date)
- Monthly Totals: SUM(daily_column) GROUP BY DATE_TRUNC('month', close_date)
- Year-to-Date: WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)

Important Notes for SQL Generation:
- Use {companyId} placeholder for company ID in table references
- Handle NULL values with COALESCE
- For averages: COALESCE(SUM(amount), 0) / NULLIF(COUNT(*), 0)
- Join with UNION ALL for combining similar data from multiple sources`;
  }

  private buildTableSchemaContext(availableTables: string[]): string {
    const tableSchemas = {
      // STAGING LAYER
      'stg_salesforce_opportunity': 'id, opportunity_name, amount, stage_name, close_date, probability, account_id, owner_id, opportunity_type, lead_source, created_date, source_system, company_id, is_valid_record',
      'stg_hubspot_deal': 'id, opportunity_name, amount, stage_name, close_date, probability, pipeline, opportunity_type, lead_source, created_date, source_system, company_id, is_valid_record',
      'stg_salesforce_lead': 'id, firstname, lastname, email, company, status, lead_source, created_date, converted_date, source_system, company_id, is_valid_record',
      'stg_hubspot_contact': 'id, email, firstname, lastname, company, lead_source, created_date, source_system, company_id, is_valid_record',
      
      // INTERMEDIATE LAYER
      'int_won_opportunities': 'id, opportunity_name, amount, stage_name, close_date, probability, opportunity_type, lead_source, created_date, source_system, company_id',
      'int_revenue_by_period': 'close_date, day_period, week_period, month_period, quarter_period, year_period, daily_revenue, daily_deal_count, cumulative_revenue (RUNNING SUM), cumulative_deals (RUNNING SUM)',
      'int_profit_by_period': 'close_date, daily_revenue, daily_profit, cumulative_revenue (RUNNING SUM), cumulative_profit (RUNNING SUM), daily_revenue_goal, daily_profit_goal',
      'int_lead_conversion': 'month_period, total_leads, converted_leads, qualified_leads, conversion_rate_pct, qualification_rate_pct',
      
      // CORE LAYER
      'core_metrics_dashboard': 'close_date, daily_revenue, daily_profit, cumulative_revenue (RUNNING SUM), cumulative_profit (RUNNING SUM), revenue_progress_pct, profit_progress_pct, day_label, week_label, month_label',
      'core_current_metrics': 'period_type (daily/weekly/monthly/yearly), current_revenue, revenue_goal, current_profit, profit_goal, revenue_progress_pct, profit_progress_pct, total_deals, avg_deal_size',
      'core_user_metrics': 'metric_name, category, format, yearly_goal, current_value, progress_pct, calculated_at',
      'core_timeseries_data': 'time_period (daily/weekly/monthly), period_date, period_label, revenue_actual, revenue_goal, profit_actual, profit_goal, revenue_progress_pct, profit_progress_pct'
    };

    const layers = {
      staging: [] as string[],
      intermediate: [] as string[],
      core: [] as string[]
    };

    // Categorize tables by layer
    availableTables.forEach(table => {
      if (table.startsWith('stg_')) {
        layers.staging.push(table);
      } else if (table.startsWith('int_')) {
        layers.intermediate.push(table);
      } else if (table.startsWith('core_')) {
        layers.core.push(table);
      }
    });

    let context = "Table schemas (key fields):";
    
    if (layers.staging.length > 0) {
      context += "\nSTAGING LAYER:";
      layers.staging.forEach(table => {
        const schema = tableSchemas[table as keyof typeof tableSchemas];
        if (schema) {
          context += `\n- ${table}: ${schema}`;
        }
      });
    }
    
    if (layers.intermediate.length > 0) {
      context += "\nINTERMEDIATE LAYER:";
      layers.intermediate.forEach(table => {
        const schema = tableSchemas[table as keyof typeof tableSchemas];
        if (schema) {
          context += `\n- ${table}: ${schema}`;
        }
      });
    }
    
    if (layers.core.length > 0) {
      context += "\nCORE LAYER:";
      layers.core.forEach(table => {
        const schema = tableSchemas[table as keyof typeof tableSchemas];
        if (schema) {
          context += `\n- ${table}: ${schema}`;
        }
      });
    }

    // Add time-period query patterns to dynamic context
    context += "\n\nTIME-PERIOD QUERY PATTERNS:";
    context += "\n- Daily Running Sum: SUM(daily_column) OVER (ORDER BY close_date)";
    context += "\n- Weekly Aggregation: SUM(daily_column) GROUP BY DATE_TRUNC('week', close_date)";
    context += "\n- Monthly Totals: SUM(daily_column) GROUP BY DATE_TRUNC('month', close_date)";
    context += "\n- Year-to-Date: WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)";
    context += "\n- Cumulative calculations are preferred for dashboard metrics";

    return context;
  }

  private getFallbackResponse(userMessage: string): ChatResponse {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes("kpi") || lowerMessage.includes("metric")) {
      return {
        content: "I can help you with KPI suggestions and implementation. For SaaS businesses, I typically recommend starting with core metrics like Monthly Recurring Revenue (MRR), Customer Acquisition Cost (CAC), and Churn Rate. Would you like me to suggest specific KPIs based on your business type?",
        metadata: {
          suggestions: [
            {
              name: "Monthly Recurring Revenue (MRR)",
              description: "Predictable monthly revenue from subscriptions",
              difficulty: "Easy",
              business_impact: "High"
            },
            {
              name: "Customer Churn Rate",
              description: "Percentage of customers who cancel their subscription",
              difficulty: "Medium",
              business_impact: "High"
            }
          ]
        }
      };
    }

    if (lowerMessage.includes("sql") || lowerMessage.includes("query")) {
      return {
        content: "I can help generate SQL queries for your KPIs. Please specify which metric you'd like to calculate, and I'll create a query using your available data tables (core_customer_metrics, core_revenue_analytics, etc.)."
      };
    }

    if (lowerMessage.includes("setup") || lowerMessage.includes("configure")) {
      return {
        content: "For data warehouse setup, ensure your Snowflake connection is configured and Python connectors are syncing data from Salesforce, HubSpot, and QuickBooks. Once data is flowing, deploy your SQL models in order: staging → intermediate → core."
      };
    }

    if (lowerMessage.includes("error") || lowerMessage.includes("issue") || lowerMessage.includes("problem")) {
      return {
        content: "I can help troubleshoot data pipeline issues. Common problems include: 1) API rate limits from source systems, 2) Schema changes breaking SQL models, 3) Data quality issues in staging tables. Check your pipeline logs for specific error details."
      };
    }

    return {
      content: "I'm your data warehouse assistant! I can help with KPI suggestions, SQL query generation, troubleshooting pipeline issues, and explaining data warehouse concepts. What would you like to know about your data platform?"
    };
  }

  private getFallbackKPISuggestions(businessType: string): ChatResponse {
    const suggestions = {
      saas: [
        {
          name: "Monthly Recurring Revenue (MRR)",
          description: "Predictable monthly revenue from subscriptions",
          difficulty: "Easy" as const,
          business_impact: "High" as const
        },
        {
          name: "Customer Acquisition Cost (CAC)",
          description: "Total cost to acquire each new customer",
          difficulty: "Medium" as const,
          business_impact: "High" as const
        },
        {
          name: "Net Revenue Retention (NRR)",
          description: "Revenue retention from existing customers over time",
          difficulty: "Hard" as const,
          business_impact: "High" as const
        },
        {
          name: "Customer Lifetime Value (CLV)",
          description: "Total revenue expected from a customer relationship",
          difficulty: "Medium" as const,
          business_impact: "High" as const
        }
      ],
      ecommerce: [
        {
          name: "Average Order Value (AOV)",
          description: "Average amount spent per transaction",
          difficulty: "Easy" as const,
          business_impact: "High" as const
        },
        {
          name: "Customer Lifetime Value (CLV)",
          description: "Total revenue expected from a customer",
          difficulty: "Medium" as const,
          business_impact: "High" as const
        },
        {
          name: "Conversion Rate",
          description: "Percentage of visitors who make a purchase",
          difficulty: "Easy" as const,
          business_impact: "High" as const
        },
        {
          name: "Return on Ad Spend (ROAS)",
          description: "Revenue generated per dollar of advertising spend",
          difficulty: "Medium" as const,
          business_impact: "High" as const
        }
      ]
    };

    const businessKpis = suggestions[businessType as keyof typeof suggestions] || suggestions.saas;

    return {
      content: `Based on your ${businessType} business model and available data sources, here are the most relevant KPIs to implement:`,
      metadata: {
        suggestions: businessKpis
      }
    };
  }

  private getFallbackSQL(kpiDescription: string, companyId?: number): SqlGenerationResponse {
    const lowerDesc = kpiDescription.toLowerCase();

    if (lowerDesc.includes("arr") || lowerDesc.includes("annual recurring revenue") || lowerDesc.includes("revenue")) {
      return {
        sql: `-- Annual Recurring Revenue calculation
SELECT 
    COALESCE(SUM(daily_revenue), 0) as current_value,
    NOW() as calculated_at
FROM analytics_company_${companyId}.int_revenue_by_period
WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND close_date <= CURRENT_DATE;`,
        explanation: "This query calculates annual recurring revenue by summing daily revenue throughout the current year. Metadata columns (metric_name, category, etc.) will be added automatically by the pipeline.",
        dependencies: ["int_revenue_by_period"],
        complexity: "Simple"
      };
    }

    if (lowerDesc.includes("churn") || lowerDesc.includes("churn rate") || lowerDesc.includes("conversion")) {
      return {
        sql: `-- Lead conversion rate calculation
SELECT 
    CASE 
        WHEN total_leads > 0 
        THEN ROUND((converted_leads::NUMERIC / total_leads::NUMERIC) * 100, 2)
        ELSE 0 
    END as current_value,
    NOW() as calculated_at
FROM analytics_company_${companyId}.int_lead_conversion
WHERE month_period = DATE_TRUNC('month', CURRENT_DATE)
ORDER BY month_period DESC
LIMIT 1;`,
        explanation: "This query calculates the current month's lead conversion rate using the intermediate lead conversion table. Metadata columns will be added automatically.",
        dependencies: ["int_lead_conversion"],
        complexity: "Simple"
      };
    }

    if (lowerDesc.includes("ltv") || lowerDesc.includes("lifetime value") || lowerDesc.includes("profit")) {
      return {
        sql: `-- Profit calculation
SELECT 
    COALESCE(SUM(daily_profit), 0) as current_value,
    NOW() as calculated_at
FROM analytics_company_${companyId}.int_profit_by_period
WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND close_date <= CURRENT_DATE;`,
        explanation: "This query calculates cumulative profit for the current year. Metadata columns will be added automatically by the pipeline.",
        dependencies: ["int_profit_by_period"],
        complexity: "Simple"
      };
    }

    // Generic fallback
    return {
      sql: `-- Generic KPI calculation for: ${kpiDescription}
SELECT 
    COALESCE(SUM(daily_revenue), 0) as current_value,
    NOW() as calculated_at
FROM analytics_company_${companyId}.core_metrics_dashboard
WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND close_date <= CURRENT_DATE;`,
      explanation: `This is a generic template query for "${kpiDescription}" that calculates a cumulative value. Metadata columns will be added automatically by the pipeline.`,
      dependencies: ["core_metrics_dashboard"],
      complexity: "Simple"
    };
  }
}

export const openaiService = new OpenAIService();
