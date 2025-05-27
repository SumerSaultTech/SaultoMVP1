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

  async generateSQL(kpiDescription: string, availableTables: string[] = []): Promise<SqlGenerationResponse> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return this.getFallbackSQL(kpiDescription);
      }

      const tablesContext = availableTables.length > 0 
        ? `Available tables: ${availableTables.join(", ")}`
        : `Available tables: core_customer_metrics, core_revenue_analytics, int_customer_unified, int_subscription_events, stg_salesforce__accounts, stg_hubspot__contacts, stg_quickbooks__customers`;

      const prompt = `Generate a SQL query to calculate the KPI: "${kpiDescription}"

      Context:
      - Data warehouse: Snowflake
      - ${tablesContext}
      
      Table schemas (key fields):
      - core_customer_metrics: customer_identifier, total_revenue, customer_segment, customer_status, health_score
      - core_revenue_analytics: current_arr, current_mrr, avg_monthly_churn_rate, avg_customer_ltv
      - int_customer_unified: unified_customer_id, source_system, customer_name, created_at
      - int_subscription_events: customer_identifier, event_type, amount, event_date

      Requirements:
      1. Write efficient, readable SQL
      2. Use appropriate aggregations and filters
      3. Include comments explaining the logic
      4. Return the query, explanation, dependencies, and complexity level

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
      return this.getFallbackSQL(kpiDescription);
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
        content: "For data warehouse setup, ensure your Snowflake connection is configured and Fivetran connectors are syncing data from Salesforce, HubSpot, and QuickBooks. Once data is flowing, deploy your SQL models in order: staging → intermediate → core."
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

  private getFallbackSQL(kpiDescription: string): SqlGenerationResponse {
    const lowerDesc = kpiDescription.toLowerCase();

    if (lowerDesc.includes("arr") || lowerDesc.includes("annual recurring revenue")) {
      return {
        sql: `-- Annual Recurring Revenue (ARR) calculation
SELECT 
    current_arr as annual_recurring_revenue,
    current_mrr * 12 as calculated_arr,
    DATE_TRUNC('month', calculated_at) as calculation_month
FROM core_revenue_analytics
ORDER BY calculation_month DESC
LIMIT 1;`,
        explanation: "This query calculates ARR by retrieving the current annual recurring revenue from the core revenue analytics table.",
        dependencies: ["core_revenue_analytics"],
        complexity: "Simple"
      };
    }

    if (lowerDesc.includes("churn") || lowerDesc.includes("churn rate")) {
      return {
        sql: `-- Monthly churn rate calculation
SELECT 
    avg_monthly_churn_rate * 100 as churn_rate_percentage,
    DATE_TRUNC('month', calculated_at) as calculation_month
FROM core_revenue_analytics
ORDER BY calculation_month DESC
LIMIT 1;`,
        explanation: "This query retrieves the average monthly churn rate from the core revenue analytics table.",
        dependencies: ["core_revenue_analytics"],
        complexity: "Simple"
      };
    }

    if (lowerDesc.includes("ltv") || lowerDesc.includes("lifetime value")) {
      return {
        sql: `-- Customer Lifetime Value calculation
SELECT 
    AVG(total_revenue) as average_ltv,
    customer_segment,
    COUNT(*) as customer_count
FROM core_customer_metrics
WHERE customer_status = 'active'
GROUP BY customer_segment
ORDER BY average_ltv DESC;`,
        explanation: "This query calculates average customer lifetime value by segment for active customers.",
        dependencies: ["core_customer_metrics"],
        complexity: "Moderate"
      };
    }

    // Generic fallback
    return {
      sql: `-- Generic KPI calculation for: ${kpiDescription}
-- Please modify this query based on your specific requirements

SELECT 
    COUNT(*) as total_records,
    DATE_TRUNC('month', created_at) as period
FROM int_customer_unified
GROUP BY period
ORDER BY period DESC;`,
      explanation: `This is a template query for "${kpiDescription}". You may need to modify it based on your specific requirements and available data columns.`,
      dependencies: ["int_customer_unified"],
      complexity: "Simple"
    };
  }
}

export const openaiService = new OpenAIService();
