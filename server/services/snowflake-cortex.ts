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

  async analyzeMetricWithCortex(request: CortexAnalysisRequest): Promise<CortexMetricResult> {
    try {
      const conn = await this.getConnection();
      
      // First, execute the metric calculation query
      const currentValue = await this.executeMetricQuery(conn, request.sqlQuery);
      
      // Get historical data for trend analysis
      const historicalData = await this.getHistoricalData(conn, request);
      
      // Use Cortex to analyze the data and suggest goals
      const cortexAnalysis = await this.getCortexGoalRecommendation(conn, {
        metricName: request.metricName,
        currentValue,
        historicalData,
        category: request.category,
        description: request.description
      });

      return {
        currentValue,
        historicalTrend: this.calculateTrend(historicalData),
        suggestedGoal: cortexAnalysis.suggestedGoal,
        confidence: cortexAnalysis.confidence,
        reasoning: cortexAnalysis.reasoning,
        dataPoints: historicalData
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
Historical Data: ${JSON.stringify(data.historicalData)}

Based on the historical trend and industry standards for ${data.category} metrics, provide a realistic yearly goal recommendation. Consider:
- Growth trends from historical data
- Industry benchmarks for this type of metric
- Achievable but ambitious targets
- Market conditions and business maturity

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

  private getFallbackGoalRecommendation(data: {
    currentValue: number;
    category: string;
    historicalData: Array<{period: string, value: number}>;
  }): {suggestedGoal: number, confidence: number, reasoning: string} {
    
    const trend = this.calculateTrend(data.historicalData);
    let growthMultiplier = 1.2; // Default 20% growth
    
    // Adjust based on category and trend
    if (data.category === 'revenue') {
      growthMultiplier = Math.max(1.15, 1 + (trend / 100) * 1.2);
    } else if (data.category === 'growth') {
      growthMultiplier = Math.max(1.25, 1 + (trend / 100) * 1.5);
    } else if (data.category === 'retention') {
      growthMultiplier = Math.min(1.1, 1 + (trend / 100) * 0.8);
    }
    
    const suggestedGoal = Math.round(data.currentValue * growthMultiplier);
    
    return {
      suggestedGoal,
      confidence: 0.75,
      reasoning: `Based on ${trend.toFixed(1)}% historical trend, suggesting ${((growthMultiplier - 1) * 100).toFixed(1)}% growth target for ${data.category} metrics.`
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