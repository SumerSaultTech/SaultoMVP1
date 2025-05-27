import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, TrendingUp, Users, TrendingDown, Play, Table, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import useRealtimeUpdates from "@/hooks/useRealtimeUpdates";

interface DashboardData {
  status: {
    snowflake: string;
    fivetran: string;
    lastSync: string | null;
  };
  dataSources: Array<{
    id: number;
    name: string;
    type: string;
    status: string;
    lastSync: string | null;
    recordCount: number;
  }>;
  kpis: Array<{
    id: number;
    name: string;
    value: string;
    changePercent: string;
  }>;
}

interface ModelStats {
  stg: number;
  int: number;
  core: number;
}

export default function Dashboard() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Use realtime updates
  useRealtimeUpdates();

  const { data: dashboardData, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: models = [] } = useQuery({
    queryKey: ["/api/models"],
  });

  const { data: pipelineRuns = [] } = useQuery({
    queryKey: ["/api/pipeline/runs"],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/pipeline/sync");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sync Started",
        description: "Full data sync has been initiated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setIsRefreshing(false);
    },
    onError: (error) => {
      console.error("Sync failed:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to start data sync",
        variant: "destructive",
      });
      setIsRefreshing(false);
    },
  });

  const deployModelsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/models/deploy");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Models Deployed",
        description: `${data.deployed.length} models deployed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
    },
    onError: (error) => {
      console.error("Model deployment failed:", error);
      toast({
        title: "Deployment Failed",
        description: "Failed to deploy models",
        variant: "destructive",
      });
    },
  });

  const refreshKPIs = async () => {
    setIsRefreshing(true);
    try {
      if (dashboardData?.kpis) {
        for (const kpi of dashboardData.kpis) {
          await apiRequest("POST", `/api/kpis/${kpi.id}/refresh`);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "KPIs Refreshed",
        description: "All KPIs have been updated",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh KPIs",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleFullSync = () => {
    setIsRefreshing(true);
    syncMutation.mutate();
  };

  const getModelStats = (): ModelStats => {
    return models.reduce(
      (acc: ModelStats, model: any) => {
        if (model.layer === "stg") acc.stg++;
        if (model.layer === "int") acc.int++;
        if (model.layer === "core") acc.core++;
        return acc;
      },
      { stg: 0, int: 0, core: 0 }
    );
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "connected":
      case "active":
      case "deployed":
        return "default";
      case "syncing":
      case "running":
        return "secondary";
      case "error":
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getKPIIcon = (name: string) => {
    if (name.toLowerCase().includes("revenue") || name.toLowerCase().includes("arr")) {
      return TrendingUp;
    }
    if (name.toLowerCase().includes("customer") || name.toLowerCase().includes("ltv")) {
      return Users;
    }
    if (name.toLowerCase().includes("churn")) {
      return TrendingDown;
    }
    return TrendingUp;
  };

  const modelStats = getModelStats();
  const latestRun = pipelineRuns[0];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-slate-200 rounded w-3/4 mb-4" />
                <div className="h-8 bg-slate-200 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Setup Status Banner */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">
                  {dashboardData?.status.snowflake === "connected" && dashboardData?.status.fivetran === "connected"
                    ? "Data Pipeline Active"
                    : "Setup Required"
                  }
                </h3>
                <p className="text-slate-600 text-sm">
                  {latestRun 
                    ? `Last update: ${new Date(latestRun.startTime).toLocaleString()}`
                    : "No pipeline runs yet"
                  }
                </p>
              </div>
            </div>
            <Button
              onClick={refreshKPIs}
              disabled={isRefreshing}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              <span>Refresh Data</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Core KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {dashboardData?.kpis.map((kpi) => {
          const Icon = getKPIIcon(kpi.name);
          const isPositive = kpi.changePercent.startsWith("+");
          
          return (
            <Card key={kpi.id} className="kpi-card">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-600">{kpi.name}</h3>
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-slate-800">{kpi.value}</div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isPositive ? "text-green-600" : "text-red-600"
                      )}
                    >
                      {kpi.changePercent}
                    </span>
                    <span className="text-sm text-slate-500">vs last month</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Data Sources and Model Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Sources Card */}
        <Card className="data-card">
          <CardHeader className="flex flex-row items-center justify-between pb-6">
            <CardTitle className="text-lg font-semibold text-slate-800">Data Sources</CardTitle>
            <Button variant="outline" size="sm">
              Manage
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData?.dataSources.map((source) => (
              <div key={source.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Table className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{source.name}</div>
                    <div className="text-sm text-slate-600">
                      {source.lastSync 
                        ? `Last sync: ${new Date(source.lastSync).toLocaleTimeString()}`
                        : "Never synced"
                      }
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={getStatusBadgeVariant(source.status)}>
                    {source.status}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Model Registry Card */}
        <Card className="data-card">
          <CardHeader className="flex flex-row items-center justify-between pb-6">
            <CardTitle className="text-lg font-semibold text-slate-800">Model Registry</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deployModelsMutation.mutate()}
              disabled={deployModelsMutation.isPending}
            >
              Run Models
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Staging Models (stg)</span>
                <Badge variant="outline" className="status-badge-neutral">
                  {modelStats.stg} Deployed
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Intermediate Models (int)</span>
                <Badge variant="outline" className="status-badge-neutral">
                  {modelStats.int} Deployed
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Core Models (core)</span>
                <Badge variant="outline" className="status-badge-neutral">
                  {modelStats.core} Deployed
                </Badge>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600 mb-2">Recent Deployments</div>
              <div className="space-y-2">
                {models.slice(0, 3).map((model: any) => (
                  <div key={model.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{model.name}</span>
                    <span className="text-slate-500">
                      {model.lastDeployed 
                        ? new Date(model.lastDeployed).toLocaleTimeString()
                        : "Not deployed"
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="quick-action-button">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Table className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-medium text-slate-800">Browse Tables</div>
              <div className="text-sm text-slate-600">Explore synced and modeled data</div>
            </div>
          </div>
        </button>

        <button 
          className="quick-action-button"
          onClick={handleFullSync}
          disabled={isRefreshing}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <RefreshCw className={cn("w-5 h-5 text-green-600", isRefreshing && "animate-spin")} />
            </div>
            <div>
              <div className="font-medium text-slate-800">Run Full Sync</div>
              <div className="text-sm text-slate-600">Sync all data sources</div>
            </div>
          </div>
        </button>

        <button className="quick-action-button">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="font-medium text-slate-800">View Logs</div>
              <div className="text-sm text-slate-600">Debug pipeline issues</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
