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
        {/* Business Metrics Dashboard - Full Width */}
        <MetricsOverview onRefresh={handleRefreshKPIs} />
      </main>
    </>
  );
}
