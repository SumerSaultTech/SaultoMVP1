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
    label: 'Weekly (Last 7 Days)',
    granularity: 'day',
    getDateRange: () => {
      const end = new Date();
      const start = subDays(end, 6);
      return { start, end };
    },
    formatDate: (date: string) => format(new Date(date), 'MMM dd'),
  },
  monthly: {
    label: 'Monthly (Current Month)',
    granularity: 'day',
    getDateRange: () => {
      const now = new Date();
      return { 
        start: startOfMonth(now), 
        end: endOfMonth(now) 
      };
    },
    formatDate: (date: string) => format(new Date(date), 'MMM dd'),
  },
  quarterly: {
    label: 'Quarterly (Current Quarter)',
    granularity: 'week',
    getDateRange: () => {
      const now = new Date();
      return { 
        start: startOfQuarter(now), 
        end: endOfQuarter(now) 
      };
    },
    formatDate: (date: string) => format(new Date(date), 'MMM dd'),
  },
  yearly: {
    label: 'Yearly (Current Year)',
    granularity: 'month',
    getDateRange: () => {
      const now = new Date();
      return { 
        start: startOfYear(now), 
        end: endOfYear(now) 
      };
    },
    formatDate: (date: string) => format(new Date(date), 'MMM yyyy'),
  },
} as const;

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function MetricsSeriesChart({ className }: MetricsSeriesChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('monthly');

  const config = TIME_PERIOD_CONFIGS[selectedPeriod];
  const { start, end } = config.getDateRange();

  const { data: metricsData, isLoading, error, refetch } = useQuery({
    queryKey: ['metrics-series', selectedPeriod, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
        granularity: config.granularity,
      });

      const response = await fetch(`/api/company/metrics-series?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics series data');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const formatChartData = (data: any[]) => {
    if (!data || data.length === 0) return [];

    // Group data by timestamp
    const grouped = data.reduce((acc: any, item: any) => {
      const timestamp = item.ts || item.timestamp;
      if (!acc[timestamp]) {
        acc[timestamp] = { 
          timestamp, 
          date: config.formatDate(timestamp) 
        };
      }
      acc[timestamp][item.metric_key] = parseFloat(item.value) || 0;
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };

  const chartData = formatChartData(metricsData || []);
  
  // Get unique metric keys for the legend
  const metricKeys = Array.from(
    new Set(metricsData?.map((item: any) => item.metric_key) || [])
  );

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
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
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-3">
                          <p className="font-semibold mb-2">{label}</p>
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
                {metricKeys.map((metricKey: string, index: number) => (
                  <Line
                    key={metricKey}
                    type="monotone"
                    dataKey={metricKey}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name={metricKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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