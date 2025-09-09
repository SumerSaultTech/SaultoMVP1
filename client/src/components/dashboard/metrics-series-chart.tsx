import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, TrendingUp } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";

export type TimePeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

interface MetricsSeriesChartProps {
  className?: string;
}

const TIME_PERIOD_CONFIGS = {
  weekly: {
    label: 'Last 7 Days',
    formatDate: (date: string) => format(new Date(date), 'EEE'), // Mon, Tue, Wed
    formatTooltip: (date: string) => format(new Date(date), 'MMM dd'),
    dotRadius: 2, // Small uniform dots
    strokeDashArray: undefined, // Solid line
  },
  monthly: {
    label: 'This Month',
    formatDate: (date: string) => format(new Date(date), 'd'), // 1, 2, 3, ..., 31
    formatTooltip: (date: string) => format(new Date(date), 'MMM dd'),
    dotRadius: 2, // Small uniform dots
    strokeDashArray: undefined, // Solid line
  },
  quarterly: {
    label: 'This Quarter',
    formatDate: (date: string) => format(new Date(date), 'd'), // 1, 2, 3, ..., 92
    formatTooltip: (date: string) => format(new Date(date), 'MMM dd'),
    dotRadius: 1, // Very small dots for many data points
    strokeDashArray: undefined, // Solid line
  },
  yearly: {
    label: 'This Year',
    formatDate: (date: string) => format(new Date(date), 'MMM'), // Jan, Feb, Mar
    formatTooltip: (date: string) => format(new Date(date), 'MMM yyyy'),
    dotRadius: 2, // Small uniform dots
    strokeDashArray: undefined, // Solid line
  },
} as const;

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function MetricsSeriesChart({ className }: MetricsSeriesChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('monthly');

  const config = TIME_PERIOD_CONFIGS[selectedPeriod];

  const { data: metricsData, isLoading, error, refetch } = useQuery({
    queryKey: ['metrics-series', selectedPeriod],
    queryFn: async () => {
      const params = new URLSearchParams({
        period_type: selectedPeriod,
      });

      const response = await fetch(`/api/company/metrics-series?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics series data');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const formatChartData = (apiResponse: any) => {
    const data = apiResponse?.data || [];
    if (!data || data.length === 0) return [];

    // Group data by timestamp and use running_sum for chart values
    const grouped = data.reduce((acc: any, item: any) => {
      const timestamp = item.ts;
      if (!acc[timestamp]) {
        acc[timestamp] = { 
          timestamp, 
          date: config.formatDate(timestamp),
          fullDate: config.formatTooltip ? config.formatTooltip(timestamp) : config.formatDate(timestamp)
        };
      }
      // Use running_sum instead of value for cumulative chart
      acc[timestamp][item.series] = parseFloat(item.running_sum) || 0;
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };

  const chartData = formatChartData(metricsData);
  const progressMetrics = metricsData?.progress;
  
  // Get unique series names for the legend
  const metricKeys = Array.from(
    new Set(metricsData?.data?.map((item: any) => item.series) || [])
  );

  return (
    <Card className={className}>
      <CardHeader className="space-y-4">
        <div className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Metrics Trends
          </CardTitle>
          <div className="flex items-center gap-2">
          <Select
            value={selectedPeriod}
            onValueChange={(value: TimePeriod) => setSelectedPeriod(value)}
          >
            <SelectTrigger className="w-[200px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TIME_PERIOD_CONFIGS).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          </div>
        </div>
        
        {/* Progress Indicators */}
        {progressMetrics && !isLoading && !error && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex flex-col space-y-1">
              <span className="text-muted-foreground">% On Pace</span>
              <div className="flex items-center gap-2">
                <div className={`text-lg font-semibold ${
                  progressMetrics.onPace >= 100 ? 'text-green-600' : 
                  progressMetrics.onPace >= 80 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {progressMetrics.onPace}%
                </div>
                <span className="text-xs text-muted-foreground">
                  vs today's target
                </span>
              </div>
            </div>
            
            <div className="flex flex-col space-y-1">
              <span className="text-muted-foreground">Progress</span>
              <div className="flex items-center gap-2">
                <div className={`text-lg font-semibold ${
                  progressMetrics.progress >= 100 ? 'text-green-600' : 
                  progressMetrics.progress >= 75 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {progressMetrics.progress}%
                </div>
                <span className="text-xs text-muted-foreground">
                  toward period goal
                </span>
              </div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading metrics data...</div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500">Error loading metrics data</div>
          </div>
        )}
        
        {!isLoading && !error && chartData.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">No metrics data available for this period</div>
          </div>
        )}
        
        {!isLoading && !error && chartData.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    return value.toString();
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      // Find the full date from chartData
                      const dataPoint = chartData.find((d: any) => d.date === label);
                      const fullDate = dataPoint?.fullDate || label;
                      
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3">
                          <p className="font-semibold mb-2">{fullDate}</p>
                          {payload.map((entry, index) => (
                            <p key={index} style={{ color: entry.color }} className="text-sm">
                              {entry.name}: {typeof entry.value === 'number' 
                                ? entry.value.toLocaleString() 
                                : entry.value}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                {(metricKeys as string[]).map((seriesName: string, index: number) => (
                  <Line
                    key={seriesName}
                    type="monotone"
                    dataKey={seriesName}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={config.dotRadius === 0 ? false : { r: config.dotRadius }}
                    activeDot={{ r: 4 }}
                    name={seriesName}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}