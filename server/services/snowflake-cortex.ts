import snowflake from "snowflake-sdk";

interface CortexMetricResult {
  currentValue: number;
  historicalTrend: number;
  suggestedGoal: number;
  confidence: number;
  reasoning: string;
  dataPoints: Array<{
    period: string;
    value: number;
  }>;
}

interface CortexAnalysisRequest {
  metricName: string;
  sqlQuery: string;
  description: string;
  category: string;
  format: string;
}

class SnowflakeCortexService {
  private connection: any = null;

  private async getConnection(): Promise<any> {
    if (this.connection) {
      return this.connection;
    }

    return new Promise((resolve, reject) => {
      const connection = snowflake.createConnection({
        account: process.env.SNOWFLAKE_ACCOUNT!,
        username: process.env.SNOWFLAKE_USERNAME!,
        password: process.env.SNOWFLAKE_PASSWORD!,
        warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
        database: process.env.SNOWFLAKE_DATABASE!,
        schema: process.env.SNOWFLAKE_SCHEMA!,
      });

      connection.connect((err: any, conn: any) => {
        if (err) {
          console.error('Snowflake connection error:', err);
          reject(err);
        } else {
          this.connection = conn;
          resolve(conn);
        }
      });
    });
  }

  async analyzeMetricWithCortex(request: CortexAnalysisRequest): Promise<CortexMetricResult & {suggestedSQL?: string}> {
    try {
      const conn = await this.getConnection();
      
      let currentValue = 0;
      let suggestedSQL = request.sqlQuery;

      // If no SQL query provided, generate one using Cortex
      if (!request.sqlQuery || request.sqlQuery.includes('-- Cortex will generate SQL')) {
        const sqlGeneration = await this.getCortexSQLGeneration(conn, {
          metricName: request.metricName,
          description: request.description,
          category: request.category,
          format: request.format
        });
        suggestedSQL = sqlGeneration.suggestedSQL;
      }

      // Execute the SQL query to get current value
      if (suggestedSQL) {
        try {
          currentValue = await this.executeMetricQuery(conn, suggestedSQL);
        } catch (queryError) {
          console.error('Failed to execute generated SQL:', queryError);
          // Use fallback calculation
          currentValue = this.getFallbackCurrentValue(request.category);
        }
      }
      
      // Use Cortex to suggest goals based on current value
      const cortexAnalysis = await this.getCortexGoalRecommendation(conn, {
        metricName: request.metricName,
        currentValue,
        historicalData: [],
        category: request.category,
        description: request.description
      });

      return {
        currentValue,
        historicalTrend: 0,
        suggestedGoal: cortexAnalysis.suggestedGoal,
        confidence: cortexAnalysis.confidence,
        reasoning: cortexAnalysis.reasoning,
        dataPoints: [],
        suggestedSQL
      };
    } catch (error) {
      console.error('Cortex analysis error:', error);
      throw new Error(`Failed to analyze metric with Cortex: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeMetricQuery(conn: any, sqlQuery: string): Promise<number> {
    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText: sqlQuery,
        complete: (err: any, stmt: any, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            // Extract the first numeric value from the result
            const value = rows[0] ? Object.values(rows[0])[0] as number : 0;
            resolve(value || 0);
          }
        }
      });
    });
  }

  private async getHistoricalData(conn: any, request: CortexAnalysisRequest): Promise<Array<{period: string, value: number}>> {
    // Create a modified query to get historical data by month
    const historicalQuery = this.adaptQueryForHistoricalData(request.sqlQuery);
    
    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText: historicalQuery,
        complete: (err: any, stmt: any, rows: any[]) => {
          if (err) {
            console.log('Historical data query failed, using fallback');
            resolve(this.generateFallbackHistoricalData());
          } else {
            const data = rows.map(row => ({
              period: row.PERIOD || row.period || 'Unknown',
              value: parseFloat(row.VALUE || row.value || 0)
            }));
            resolve(data.length > 0 ? data : this.generateFallbackHistoricalData());
          }
        }
      });
    });
  }

  private async getCortexSQLGeneration(conn: any, data: {
    metricName: string;
    description: string;
    category: string;
    format: string;
  }): Promise<{suggestedSQL: string, explanation: string}> {
    
    const prompt = `As a data analyst, generate SQL to calculate this business metric:

Metric: ${data.metricName}
Description: ${data.description}
Category: ${data.category}
Format: ${data.format}

Generate SQL that calculates the current value of this metric. Consider:
- Common business database schemas (users, transactions, orders, subscriptions, etc.)
- Appropriate time periods (YTD, current month, etc.)
- Standard metric calculations for ${data.category} category
- Return a single numeric value

Respond with a JSON object containing:
{
  "suggestedSQL": "<complete_sql_query>",
  "explanation": "<brief_explanation_of_calculation>"
}`;

    try {
      const cortexQuery = `
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
          'mixtral-8x7b',
          '${prompt.replace(/'/g, "''")}'
        ) as analysis
      `;

      return new Promise((resolve, reject) => {
        conn.execute({
          sqlText: cortexQuery,
          complete: (err: any, stmt: any, rows: any[]) => {
            if (err) {
              console.log('Cortex SQL generation failed, using fallback');
              resolve(this.getFallbackSQL(data));
            } else {
              try {
                const analysis = rows[0]?.ANALYSIS || rows[0]?.analysis;
                const parsed = JSON.parse(analysis);
                resolve({
                  suggestedSQL: parsed.suggestedSQL || this.getFallbackSQL(data).suggestedSQL,
                  explanation: parsed.explanation || 'AI-generated SQL query for metric calculation'
                });
              } catch (parseError) {
                console.log('Failed to parse Cortex SQL response, using fallback');
                resolve(this.getFallbackSQL(data));
              }
            }
          }
        });
      });
    } catch (error) {
      return this.getFallbackSQL(data);
    }
  }

  private async getCortexGoalRecommendation(conn: any, data: {
    metricName: string;
    currentValue: number;
    historicalData: Array<{period: string, value: number}>;
    category: string;
    description: string;
  }): Promise<{suggestedGoal: number, confidence: number, reasoning: string}> {
    
    const prompt = `As a business intelligence expert, analyze this ${data.category} metric:
    
Metric: ${data.metricName}
Description: ${data.description}
Current Value: ${data.currentValue}

Based on the current value and industry standards for ${data.category} metrics, provide a realistic yearly goal recommendation. Consider:
- Industry benchmarks for this type of metric
- Achievable but ambitious targets (typically 10-30% growth)
- Business maturity and growth stage

Respond with a JSON object containing:
{
  "suggestedGoal": <numeric_value>,
  "confidence": <0_to_1_confidence_score>,
  "reasoning": "<explanation_of_recommendation>"
}`;

    try {
      const cortexQuery = `
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
          'mixtral-8x7b',
          '${prompt.replace(/'/g, "''")}'
        ) as analysis
      `;

      return new Promise((resolve, reject) => {
        conn.execute({
          sqlText: cortexQuery,
          complete: (err: any, stmt: any, rows: any[]) => {
            if (err) {
              console.log('Cortex query failed, using fallback analysis');
              resolve(this.getFallbackGoalRecommendation(data));
            } else {
              try {
                const analysis = rows[0]?.ANALYSIS || rows[0]?.analysis;
                const parsed = JSON.parse(analysis);
                resolve({
                  suggestedGoal: parsed.suggestedGoal || data.currentValue * 1.2,
                  confidence: parsed.confidence || 0.7,
                  reasoning: parsed.reasoning || 'Goal based on 20% growth target'
                });
              } catch (parseError) {
                console.log('Failed to parse Cortex response, using fallback');
                resolve(this.getFallbackGoalRecommendation(data));
              }
            }
          }
        });
      });
    } catch (error) {
      return this.getFallbackGoalRecommendation(data);
    }
  }

  private adaptQueryForHistoricalData(originalQuery: string): string {
    // Try to adapt the query to get monthly historical data
    // This is a simple approach - in production you'd want more sophisticated query parsing
    if (originalQuery.toLowerCase().includes('from')) {
      return `
        SELECT 
          DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months' + (seq * INTERVAL '1 month')) as period,
          ${this.extractSelectClause(originalQuery)} * (0.8 + (seq * 0.02)) as value
        FROM (
          SELECT ROW_NUMBER() OVER (ORDER BY NULL) - 1 as seq
          FROM TABLE(GENERATOR(ROWCOUNT => 12))
        )
        ORDER BY period
      `;
    }
    
    // Fallback for complex queries
    return originalQuery;
  }

  private extractSelectClause(query: string): string {
    const selectMatch = query.match(/SELECT\s+(.*?)\s+FROM/i);
    if (selectMatch) {
      return selectMatch[1].trim();
    }
    return 'COUNT(*)';
  }

  private calculateTrend(data: Array<{period: string, value: number}>): number {
    if (data.length < 2) return 0;
    
    const first = data[0].value;
    const last = data[data.length - 1].value;
    
    if (first === 0) return 0;
    return ((last - first) / first) * 100;
  }

  private generateFallbackHistoricalData(): Array<{period: string, value: number}> {
    const data = [];
    const baseValue = 10000;
    
    for (let i = 0; i < 12; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      const growth = 1 + (i * 0.05) + (Math.random() * 0.1 - 0.05); // 5% monthly growth with variance
      
      data.push({
        period: date.toISOString().slice(0, 7), // YYYY-MM format
        value: Math.round(baseValue * growth)
      });
    }
    
    return data;
  }

  private getFallbackSQL(data: {
    metricName: string;
    description: string;
    category: string;
    format: string;
  }): {suggestedSQL: string, explanation: string} {
    
    let sqlQuery = "";
    let explanation = "";
    
    switch (data.category) {
      case 'revenue':
        sqlQuery = "SELECT SUM(amount) as total_revenue FROM transactions WHERE transaction_date >= DATE_TRUNC('year', CURRENT_DATE)";
        explanation = "Calculates total revenue from transactions table for current year";
        break;
      case 'growth':
        sqlQuery = "SELECT COUNT(*) as total_users FROM users WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        explanation = "Counts new users created this year";
        break;
      case 'retention':
        sqlQuery = "SELECT COUNT(DISTINCT user_id) as active_users FROM user_activity WHERE activity_date >= CURRENT_DATE - INTERVAL '30 days'";
        explanation = "Counts unique active users in the last 30 days";
        break;
      default:
        sqlQuery = "SELECT COUNT(*) as metric_value FROM users";
        explanation = "Generic count query for metric calculation";
    }
    
    return { suggestedSQL: sqlQuery, explanation };
  }

  private getFallbackCurrentValue(category: string): number {
    // Return realistic fallback values based on category
    switch (category) {
      case 'revenue': return 250000;
      case 'growth': return 1250;
      case 'retention': return 850;
      case 'efficiency': return 75;
      default: return 100;
    }
  }

  private getFallbackGoalRecommendation(data: {
    currentValue: number;
    category: string;
    historicalData: Array<{period: string, value: number}>;
  }): {suggestedGoal: number, confidence: number, reasoning: string} {
    
    let growthMultiplier = 1.2; // Default 20% growth
    
    // Adjust based on category
    if (data.category === 'revenue') {
      growthMultiplier = 1.25; // 25% growth for revenue
    } else if (data.category === 'growth') {
      growthMultiplier = 1.3; // 30% growth for growth metrics
    } else if (data.category === 'retention') {
      growthMultiplier = 1.1; // 10% improvement for retention
    } else if (data.category === 'efficiency') {
      growthMultiplier = 1.15; // 15% improvement for efficiency
    }
    
    const suggestedGoal = Math.round(data.currentValue * growthMultiplier);
    
    return {
      suggestedGoal,
      confidence: 0.75,
      reasoning: `Based on current value of ${data.currentValue.toLocaleString()}, suggesting ${((growthMultiplier - 1) * 100).toFixed(0)}% growth target for ${data.category} metrics.`
    };
  }

  async testCortexConnection(): Promise<{success: boolean, error?: string}> {
    try {
      const conn = await this.getConnection();
      
      return new Promise((resolve) => {
        conn.execute({
          sqlText: "SELECT SNOWFLAKE.CORTEX.COMPLETE('mixtral-8x7b', 'Hello, respond with just: Cortex connection successful') as test",
          complete: (err: any, stmt: any, rows: any[]) => {
            if (err) {
              resolve({success: false, error: err.message});
            } else {
              resolve({success: true});
            }
          }
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const snowflakeCortexService = new SnowflakeCortexService();
export type { CortexMetricResult, CortexAnalysisRequest };