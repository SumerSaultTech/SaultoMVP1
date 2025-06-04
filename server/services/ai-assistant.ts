import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

interface KPISuggestion {
  name: string;
  description: string;
  sql: string;
  businessType: string;
  rationale: string;
}

interface SchemaInfo {
  tables: Array<{
    name: string;
    columns: Array<{
      name: string;
      type: string;
      description?: string;
    }>;
  }>;
}

export class AIAssistantService {
  async suggestKPIs(businessType: string, schema?: SchemaInfo): Promise<KPISuggestion[]> {
    try {
      const systemPrompt = `You are a data analytics expert specializing in KPI generation for business intelligence dashboards. 
      Generate meaningful KPI suggestions based on the business type and available data schema.
      
      Respond with JSON in this format:
      {
        "suggestions": [
          {
            "name": "KPI Name",
            "description": "Clear description of what this KPI measures",
            "sql": "SELECT statement to calculate this KPI",
            "businessType": "The business type this KPI is relevant for",
            "rationale": "Why this KPI is important for this business"
          }
        ]
      }`;

      const userPrompt = schema 
        ? `Business Type: ${businessType}
           
           Available Schema:
           ${JSON.stringify(schema, null, 2)}
           
           Generate 3-5 specific KPIs that can be calculated from this schema.`
        : `Business Type: ${businessType}
           
           No specific schema provided. Generate 3-5 common KPIs for this business type with example SQL queries using typical table structures.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.suggestions || [];
    } catch (error) {
      console.error("Failed to generate KPI suggestions:", error);
      return this.getFallbackKPIs(businessType);
    }
  }

  async generateSQL(request: string, schema?: SchemaInfo): Promise<{ sql: string; explanation: string }> {
    try {
      const systemPrompt = `You are an expert SQL developer specializing in data warehouse analytics. 
      Generate SQL queries for business metrics and KPIs.
      
      Respond with JSON in this format:
      {
        "sql": "The SQL query to achieve the request",
        "explanation": "Clear explanation of what the query does and how it works"
      }`;

      const userPrompt = schema 
        ? `Request: ${request}
           
           Available Schema:
           ${JSON.stringify(schema, null, 2)}
           
           Generate SQL that works with this specific schema.`
        : `Request: ${request}
           
           Generate SQL using common table structures and naming conventions.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return {
        sql: result.sql || "SELECT 1 as placeholder;",
        explanation: result.explanation || "SQL query generated based on request."
      };
    } catch (error) {
      console.error("Failed to generate SQL:", error);
      return {
        sql: "-- Error generating SQL query",
        explanation: "Unable to generate SQL query. Please check the request and try again."
      };
    }
  }

  async chatWithAssistant(message: string, context?: any[]): Promise<string> {
    try {
      const systemPrompt = `You are a helpful AI assistant for a data warehouse orchestration platform. 
      You help users with KPIs, SQL queries, data analysis, and business intelligence questions.
      Be concise but helpful in your responses.`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...(context || []),
        { role: "user", content: message }
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 500,
      });

      return response.choices[0].message.content || "I'm sorry, I couldn't process your request.";
    } catch (error) {
      console.error("Failed to chat with assistant:", error);
      return "I'm experiencing technical difficulties. Please try again later.";
    }
  }

  async analyzeBusinessType(description: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Analyze the business description and classify it into one of these categories: SaaS, E-commerce, Manufacturing, Healthcare, Financial Services, Education, Real Estate, or Other. Respond with just the category name."
          },
          {
            role: "user",
            content: description
          }
        ],
        temperature: 0.3,
      });

      return response.choices[0].message.content?.trim() || "Other";
    } catch (error) {
      console.error("Failed to analyze business type:", error);
      return "Other";
    }
  }

  private getFallbackKPIs(businessType: string): KPISuggestion[] {
    const fallbackKPIs: Record<string, KPISuggestion[]> = {
      "SaaS": [
        {
          name: "Monthly Recurring Revenue (MRR)",
          description: "Total monthly recurring revenue from all active subscriptions",
          sql: "SELECT SUM(monthly_amount) as mrr FROM subscriptions WHERE status = 'active'",
          businessType: "SaaS",
          rationale: "MRR is the foundation metric for SaaS businesses to track predictable revenue"
        },
        {
          name: "Customer Acquisition Cost (CAC)",
          description: "Average cost to acquire a new customer",
          sql: "SELECT SUM(marketing_spend + sales_spend) / COUNT(DISTINCT new_customers) as cac FROM monthly_metrics",
          businessType: "SaaS",
          rationale: "Understanding CAC helps optimize marketing and sales investment"
        },
        {
          name: "Net Revenue Retention",
          description: "Revenue retention from existing customers including expansion",
          sql: "SELECT (current_mrr / previous_mrr) * 100 as nrr FROM cohort_analysis WHERE cohort_month = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 year')",
          businessType: "SaaS",
          rationale: "NRR shows the health of the customer base and growth potential"
        }
      ],
      "E-commerce": [
        {
          name: "Average Order Value (AOV)",
          description: "Average value of each customer order",
          sql: "SELECT AVG(order_total) as aov FROM orders WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)",
          businessType: "E-commerce",
          rationale: "AOV helps understand customer purchasing behavior and pricing strategy effectiveness"
        },
        {
          name: "Customer Lifetime Value (CLV)",
          description: "Total revenue expected from a customer over their lifetime",
          sql: "SELECT AVG(total_revenue) as clv FROM customer_lifetime_metrics",
          businessType: "E-commerce",
          rationale: "CLV guides customer acquisition spending and retention strategies"
        },
        {
          name: "Conversion Rate",
          description: "Percentage of website visitors who make a purchase",
          sql: "SELECT (COUNT(DISTINCT orders.customer_id) / COUNT(DISTINCT sessions.visitor_id)) * 100 as conversion_rate FROM sessions LEFT JOIN orders ON sessions.visitor_id = orders.customer_id",
          businessType: "E-commerce",
          rationale: "Conversion rate is critical for optimizing the sales funnel and user experience"
        }
      ],
      "default": [
        {
          name: "Revenue Growth Rate",
          description: "Month-over-month revenue growth percentage",
          sql: "SELECT ((current_month_revenue - previous_month_revenue) / previous_month_revenue) * 100 as growth_rate FROM monthly_revenue_summary",
          businessType: "General",
          rationale: "Revenue growth is a fundamental metric for any business"
        },
        {
          name: "Customer Retention Rate",
          description: "Percentage of customers retained over a specific period",
          sql: "SELECT (retained_customers / total_customers) * 100 as retention_rate FROM customer_cohorts",
          businessType: "General",
          rationale: "Customer retention is more cost-effective than acquisition"
        }
      ]
    };

    return fallbackKPIs[businessType] || fallbackKPIs["default"];
  }
}

export const aiAssistantService = new AIAssistantService();
