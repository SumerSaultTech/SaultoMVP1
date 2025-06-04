import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, Target, Users, Phone, Award } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface MetricConfig {
  id: string;
  name: string;
  category: string;
  format: string;
  goal: number;
  currentValue: number;
  description: string;
  dataSource: string;
  isNorthStar?: boolean;
}

interface MetricValue {
  success: boolean;
  metricName: string;
  value: number;
  source: string;
  calculatedAt: string;
  error?: string;
  requiresSetup?: boolean;
}

export default function RealMetricsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("yearly");
  const [realValues, setRealValues] = useState<Record<string, number>>({});
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'setup-required'>('disconnected');

  // Load metric configurations
  const { data: metricsConfig, isLoading: configLoading } = useQuery({
    queryKey: ["/api/metrics/display-config"],
  });

  // Calculate real metric value
  const calculateRealMetric = useMutation({
    mutationFn: async (metricName: string): Promise<MetricValue> => {
      return apiRequest(`/api/metrics/calculate-real`, {
        method: "POST",
        body: { metricName }
      });
    },
    onSuccess: (data, metricName) => {
      if (data.success) {
        setRealValues(prev => ({ ...prev, [metricName]: data.value }));
        setConnectionStatus('connected');
      } else if (data.requiresSetup) {
        setConnectionStatus('setup-required');
      }
    },
    onError: () => {
      setConnectionStatus('setup-required');
    }
  });

  // Calculate all real values
  const calculateAllMetrics = () => {
    if (!metricsConfig?.metrics) return;
    
    metricsConfig.metrics.forEach((metric: MetricConfig) => {
      calculateRealMetric.mutate(metric.id);
    });
  };

  const formatValue = (value: number, format: string): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return new Intl.NumberFormat('en-US').format(value);
      default:
        return value.toString();
    }
  };

  const calculateProgress = (current: number, goal: number): number => {
    if (goal === 0) return 0;
    return Math.min(100, (current / goal) * 100);
  };

  const getProgressColor = (progress: number): string => {
    if (progress >= 90) return 'bg-green-500';
    if (progress >= 70) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMetricIcon = (category: string) => {
    switch (category) {
      case 'Financial': return <DollarSign className="h-4 w-4" />;
      case 'Sales': return <TrendingUp className="h-4 w-4" />;
      case 'Activity': return <Phone className="h-4 w-4" />;
      case 'Marketing': return <Target className="h-4 w-4" />;
      default: return <Award className="h-4 w-4" />;
    }
  };

  if (configLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">MIAS_DATA Business Metrics</h1>
          <p className="text-muted-foreground">Real-time metrics from your HubSpot and QuickBooks data</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
            {connectionStatus === 'connected' ? 'MIAS_DATA_DB Connected' : 
             connectionStatus === 'setup-required' ? 'Setup Required' : 'Disconnected'}
          </Badge>
          <Button 
            onClick={calculateAllMetrics}
            disabled={calculateRealMetric.isPending}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${calculateRealMetric.isPending ? 'animate-spin' : ''}`} />
            Calculate Real Values
          </Button>
        </div>
      </div>

      {connectionStatus === 'setup-required' && (
        <Alert>
          <AlertDescription>
            MIAS_DATA_DB connection requires network access configuration. Please verify your Snowflake network policies allow external connections and ensure all credentials are properly configured.
          </AlertDescription>
        </Alert>
      )}

      {/* North Star Metrics */}
      {metricsConfig?.northStarMetrics && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            North Star Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {metricsConfig.northStarMetrics.map((metric: MetricConfig) => {
              const realValue = realValues[metric.id] ?? metric.currentValue;
              const progress = calculateProgress(realValue, metric.goal);
              
              return (
                <Card key={metric.id} className="border-2 border-yellow-200 bg-yellow-50/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getMetricIcon(metric.category)}
                        {metric.name}
                      </CardTitle>
                      <Badge variant="secondary">{metric.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-2xl font-bold">{formatValue(realValue, metric.format)}</p>
                          <p className="text-sm text-muted-foreground">
                            Goal: {formatValue(metric.goal, metric.format)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{progress.toFixed(1)}%</p>
                        </div>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">{metric.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* All Metrics by Category */}
      <Tabs defaultValue="Financial" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          {metricsConfig?.categories?.map((category: string) => (
            <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
          ))}
        </TabsList>

        {metricsConfig?.categories?.map((category: string) => (
          <TabsContent key={category} value={category}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metricsConfig.metrics
                ?.filter((metric: MetricConfig) => metric.category === category)
                .map((metric: MetricConfig) => {
                  const realValue = realValues[metric.id] ?? metric.currentValue;
                  const progress = calculateProgress(realValue, metric.goal);
                  
                  return (
                    <Card key={metric.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm flex items-center gap-2">
                            {getMetricIcon(metric.category)}
                            {metric.name}
                          </CardTitle>
                          {metric.isNorthStar && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                              ⭐ North Star
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs">
                          Data Source: {metric.dataSource}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-xl font-bold">{formatValue(realValue, metric.format)}</p>
                              <p className="text-xs text-muted-foreground">
                                Goal: {formatValue(metric.goal, metric.format)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-medium">{progress.toFixed(1)}%</p>
                              <div className={`h-1 w-8 rounded ${getProgressColor(progress)}`}></div>
                            </div>
                          </div>
                          <Progress value={progress} className="h-1" />
                          <p className="text-xs text-muted-foreground">{metric.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Data Sources Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Data Sources Status</CardTitle>
          <CardDescription>Integration status with your business systems</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="font-medium">HubSpot Data</p>
                <p className="text-sm text-muted-foreground">Calls and Deals</p>
              </div>
              <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
                {connectionStatus === 'connected' ? 'Connected' : 'Setup Required'}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="font-medium">QuickBooks Data</p>
                <p className="text-sm text-muted-foreground">Revenue and Expenses</p>
              </div>
              <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
                {connectionStatus === 'connected' ? 'Connected' : 'Setup Required'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}