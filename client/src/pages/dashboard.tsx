import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";

import MetricsOverview from "@/components/dashboard/metrics-overview";
import DataSources from "@/components/dashboard/data-sources";
import ModelRegistryCard from "@/components/dashboard/model-registry-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, FolderSync } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/pipeline-activities"],
  });

  const handleManualSync = async () => {
    try {
      await apiRequest("POST", "/api/sync/trigger");
      toast({
        title: "FolderSync Triggered",
        description: "Manual sync has been initiated for all connectors.",
      });
    } catch (error) {
      toast({
        title: "FolderSync Failed",
        description: "Failed to trigger manual sync. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRefreshKPIs = async () => {
    try {
      await apiRequest("POST", "/api/kpi-metrics/calculate");
      toast({
        title: "KPIs Updated",
        description: "All KPI metrics have been recalculated.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh KPIs. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Header 
        title="Data Pipeline Dashboard"
        subtitle="Monitor your Snowflake warehouse and data pipelines"
        actions={
          <Button onClick={handleManualSync} className="bg-primary-500 hover:bg-primary-600">
            <FolderSync className="mr-2 h-4 w-4" />
            FolderSync Now
          </Button>
        }
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        {/* Business Metrics Dashboard */}
        <div className="mb-8">
          <MetricsOverview onRefresh={handleRefreshKPIs} />
        </div>

        {/* Data Sources & Model Registry */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <DataSources />
          <ModelRegistryCard />
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Recent Pipeline Activity</CardTitle>
            <Button variant="ghost" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded animate-pulse mb-2" />
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {(activities && Array.isArray(activities) ? activities.slice(0, 5) : []).map((activity: any) => (
                  <div key={activity.id} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.status === 'success' ? 'bg-green-100' :
                      activity.status === 'error' ? 'bg-red-100' : 'bg-amber-100'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        activity.status === 'success' ? 'bg-green-600' :
                        activity.status === 'error' ? 'bg-red-600' : 'bg-amber-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {(!activities || (Array.isArray(activities) && activities.length === 0)) && (
                  <p className="text-sm text-gray-500 py-8 text-center">No recent activity</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
