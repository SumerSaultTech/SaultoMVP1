import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface NorthStarMetric {
  id: string;
  name: string;
  value: string;
  yearlyGoal: string;
  changePercent: string;
  description: string;
  format: string;
}

const northStarMetrics: NorthStarMetric[] = [
  {
    id: "annual-revenue",
    name: "Annual Revenue",
    value: "$2,400,000",
    yearlyGoal: "$3,000,000",
    changePercent: "+12.5",
    description: "Total revenue for the current fiscal year",
    format: "currency"
  },
  {
    id: "annual-profit",
    name: "Annual Profit",
    value: "$480,000",
    yearlyGoal: "$750,000",
    changePercent: "+8.2",
    description: "Net profit after all expenses for the current fiscal year",
    format: "currency"
  }
];

// Generate YTD progress data for North Star metrics
function generateNorthStarData(metric: NorthStarMetric) {
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  
  // Generate monthly data points for the year
  const months = [];
  const currentMonth = new Date(yearStart);
  
  while (currentMonth <= yearEnd) {
    months.push(new Date(currentMonth));
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }
  
  const currentValue = parseFloat(metric.value.replace(/[$,]/g, ''));
  const yearlyGoal = parseFloat(metric.yearlyGoal.replace(/[$,]/g, ''));
  const monthlyGoal = yearlyGoal / 12;
  
  // Performance patterns for different metrics
  const revenuePattern = [0.75, 0.82, 0.88, 0.95, 1.02, 1.08, 1.15, 1.22, 1.18, 1.25, 1.32, 1.40];
  const profitPattern = [0.65, 0.72, 0.79, 0.86, 0.93, 1.00, 1.07, 1.14, 1.10, 1.17, 1.24, 1.31];
  
  const pattern = metric.id === 'annual-revenue' ? revenuePattern : profitPattern;
  
  return months.map((month, index) => {
    const goalProgress = monthlyGoal * (index + 1);
    const performanceMultiplier = pattern[index] || 1.0;
    const actualValue = month <= today ? goalProgress * performanceMultiplier : null;
    
    const monthLabel = month.toLocaleDateString('en-US', { month: 'short' });
    
    return {
      period: monthLabel,
      goal: Math.round(goalProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: month.getMonth() === today.getMonth()
    };
  });
}

function formatValue(value: string, format: string): string {
  if (format === 'currency') {
    const numValue = parseFloat(value.replace(/[$,]/g, ''));
    if (numValue >= 1000000) {
      return `$${(numValue / 1000000).toFixed(1)}M`;
    } else if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(0)}K`;
    } else {
      return `$${numValue.toLocaleString()}`;
    }
  }
  return value;
}

function calculateProgress(currentValue: string, goalValue: string): number {
  const current = parseFloat(currentValue.replace(/[$,]/g, ''));
  const goal = parseFloat(goalValue.replace(/[$,]/g, ''));
  return goal > 0 ? Math.round((current / goal) * 100) : 0;
}

function getProgressStatus(progress: number) {
  if (progress >= 90) return { color: 'text-green-600', bgColor: 'bg-green-100', status: 'excellent' };
  if (progress >= 75) return { color: 'text-blue-600', bgColor: 'bg-blue-100', status: 'good' };
  if (progress >= 50) return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', status: 'fair' };
  return { color: 'text-red-600', bgColor: 'bg-red-100', status: 'needs attention' };
}

export default function NorthStarMetrics() {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Target className="h-5 w-5 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">North Star Metrics</h3>
        <div className="h-px bg-gradient-to-r from-purple-300 to-transparent flex-1 ml-4"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {northStarMetrics.map((metric) => {
          const progress = calculateProgress(metric.value, metric.yearlyGoal);
          const progressStatus = getProgressStatus(progress);
          const changeValue = parseFloat(metric.changePercent);
          const isPositive = changeValue >= 0;
          const chartData = generateNorthStarData(metric);

          return (
            <Card key={metric.id} className="relative overflow-hidden border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
              
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                    <span>{metric.name}</span>
                  </CardTitle>
                  <div className={`flex items-center space-x-1 text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>{Math.abs(changeValue)}%</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {metric.description}
                </p>
              </CardHeader>

              <CardContent className="pt-0 space-y-4">
                {/* Current Value */}
                <div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {formatValue(metric.value, metric.format)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    of {formatValue(metric.yearlyGoal, metric.format)} annual goal
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Progress
                    </span>
                    <span className={`text-sm font-bold ${progressStatus.color}`}>
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Year-to-Date Chart */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Year-to-Date Progress
                  </h4>
                  
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="period"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#6b7280' }}
                        tickFormatter={(value) => formatValue(value.toString(), metric.format)}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        labelFormatter={(period) => `${period}`}
                        formatter={(value: any, name: string) => [
                          formatValue(value?.toString() || '0', metric.format),
                          name === 'actual' ? 'Actual' : 'Goal'
                        ]}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="goal" 
                        stroke="#9ca3af" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="goal"
                        connectNulls={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="actual" 
                        stroke="#8b5cf6" 
                        strokeWidth={3}
                        connectNulls={false}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          if (!payload || payload.actual === null) return <g />;
                          return payload?.isCurrent ? (
                            <circle cx={cx} cy={cy} r={6} fill="#8b5cf6" stroke="#fff" strokeWidth={2} />
                          ) : (
                            <circle cx={cx} cy={cy} r={3} fill="#8b5cf6" />
                          );
                        }}
                        name="actual"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Status Badge */}
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${progressStatus.bgColor} ${progressStatus.color}`}>
                  {progressStatus.status.charAt(0).toUpperCase() + progressStatus.status.slice(1)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}