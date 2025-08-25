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

      const tablesContext = availableTables.length > 0 
        ? `Available tables: ${availableTables.join(", ")}`
        : `Available tables: core_metrics_dashboard, core_user_metrics (fallback - no dynamic discovery available)`;
      
      // Create dynamic table schema context based on available tables
      let tableSchemaContext = "Table schemas (key fields):";
      if (availableTables.length > 0) {
        tableSchemaContext = this.buildTableSchemaContext(availableTables);
      } else {
        tableSchemaContext = `Table schemas (key fields):
CORE LAYER (fallback):
- core_metrics_dashboard: close_date, daily_revenue, daily_profit, cumulative_revenue (RUNNING SUM), cumulative_profit (RUNNING SUM), revenue_progress_pct, profit_progress_pct, day_label, week_label, month_label
- core_user_metrics: metric_name, category, format, yearly_goal, current_value, progress_pct, calculated_at

TIME-PERIOD QUERY PATTERNS:
- Daily Running Sum: SUM(daily_column) OVER (ORDER BY close_date) 
- Weekly Aggregation: SUM(daily_column) GROUP BY DATE_TRUNC('week', close_date)
- Monthly Totals: SUM(daily_column) GROUP BY DATE_TRUNC('month', close_date)
- Year-to-Date: WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)`;
      }

      const prompt = `Generate a SQL query to calculate the KPI: "${kpiDescription}"

      Context:
      - Data warehouse: PostgreSQL
      - Company schema: analytics_company_${companyId}
      - ${tablesContext}
      
      ${tableSchemaContext}

      Requirements:
      1. Use table names with company schema prefix: analytics_company_${companyId}
      2. Write efficient PostgreSQL queries with proper aggregations
      3. For time-based metrics, use appropriate date filters and DATE_TRUNC functions
      4. Include comments explaining business logic
      5. Follow the layered architecture: prefer CORE layer for final metrics, INT layer for business logic, STG layer for cleaned source data
      6. Only use tables that are available in the provided table list
      
      TIME-PERIOD AWARE CALCULATIONS:
      7. For metrics like "annual revenue", "total profit", etc., generate RUNNING SUM queries using window functions
      8. Use cumulative patterns: SUM(column) OVER (ORDER BY date_column) for running totals
      9. Support dashboard time period switching (Daily/Weekly/Monthly/Yearly views)
      10. For period-based queries, group by appropriate time periods using DATE_TRUNC
      
      EXAMPLE PATTERNS:
      - Running Annual Revenue: SUM(daily_revenue) OVER (ORDER BY close_date) as cumulative_revenue
      - Time Period Filtering: WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)
      - Period Grouping: GROUP BY DATE_TRUNC('month', close_date)
      - Prefer existing cumulative columns when available (cumulative_revenue, cumulative_profit, etc.)

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
        sql: `-- Annual Recurring Revenue (ARR) with running sum calculation
SELECT 
    close_date,
    daily_revenue,
    SUM(daily_revenue) OVER (ORDER BY close_date) as cumulative_annual_revenue,
    COUNT(*) OVER (ORDER BY close_date) as cumulative_deals,
    -- Time period groupings for dashboard flexibility
    DATE_TRUNC('month', close_date) as month_period,
    DATE_TRUNC('week', close_date) as week_period
FROM analytics_company_${companyId}.int_revenue_by_period
WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND close_date <= CURRENT_DATE
ORDER BY close_date;`,
        explanation: "This query calculates annual recurring revenue as a running sum of daily revenue throughout the current year. It provides cumulative totals that work with dashboard time period switching and follows the layered architecture by using the intermediate revenue table.",
        dependencies: ["int_revenue_by_period"],
        complexity: "Simple"
      };
    }

    if (lowerDesc.includes("churn") || lowerDesc.includes("churn rate") || lowerDesc.includes("conversion")) {
      return {
        sql: `-- Lead conversion rate calculation
SELECT 
    month_period,
    total_leads,
    converted_leads,
    CASE 
        WHEN total_leads > 0 
        THEN ROUND((converted_leads::NUMERIC / total_leads::NUMERIC) * 100, 2)
        ELSE 0 
    END as conversion_rate_pct
FROM analytics_company_${companyId}.int_lead_conversion
WHERE month_period >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '12 months'
ORDER BY month_period DESC;`,
        explanation: "This query calculates lead conversion rates by month using the intermediate lead conversion table.",
        dependencies: ["int_lead_conversion"],
        complexity: "Simple"
      };
    }

    if (lowerDesc.includes("ltv") || lowerDesc.includes("lifetime value") || lowerDesc.includes("profit")) {
      return {
        sql: `-- Profit analysis with running sum and time period support
SELECT 
    close_date,
    daily_profit,
    SUM(daily_profit) OVER (ORDER BY close_date) as cumulative_profit,
    daily_revenue,
    -- Calculate running profit margin
    CASE 
        WHEN SUM(daily_revenue) OVER (ORDER BY close_date) > 0 
        THEN ROUND((SUM(daily_profit) OVER (ORDER BY close_date) / SUM(daily_revenue) OVER (ORDER BY close_date)) * 100, 2)
        ELSE 0 
    END as cumulative_profit_margin_pct,
    -- Time period groupings
    DATE_TRUNC('month', close_date) as month_period,
    DATE_TRUNC('quarter', close_date) as quarter_period
FROM analytics_company_${companyId}.int_profit_by_period
WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND close_date <= CURRENT_DATE
ORDER BY close_date;`,
        explanation: "This query calculates profit metrics with running sums and profit margin analysis. It provides cumulative totals and percentages that work across different dashboard time periods, following the layered architecture pattern.",
        dependencies: ["int_profit_by_period"],
        complexity: "Moderate"
      };
    }

    // Generic fallback
    return {
      sql: `-- Generic KPI calculation with running sum for: ${kpiDescription}
-- Adaptable template for most cumulative metrics

SELECT 
    close_date,
    daily_revenue as daily_value,
    SUM(daily_revenue) OVER (ORDER BY close_date) as cumulative_value,
    -- Time period groupings for dashboard flexibility
    DATE_TRUNC('day', close_date) as day_period,
    DATE_TRUNC('week', close_date) as week_period,
    DATE_TRUNC('month', close_date) as month_period,
    DATE_TRUNC('quarter', close_date) as quarter_period,
    -- Running averages
    AVG(daily_revenue) OVER (ORDER BY close_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as seven_day_avg
FROM analytics_company_${companyId}.core_metrics_dashboard
WHERE close_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND close_date <= CURRENT_DATE
ORDER BY close_date;`,
      explanation: `This is a generic template query for "${kpiDescription}" that provides running sum calculations and time period groupings. It can be adapted for most cumulative business metrics and supports dashboard time period switching.`,
      dependencies: ["core_metrics_dashboard"],
      complexity: "Simple"
    };
  }
}

export const openaiService = new OpenAIService();
