import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export default function DataSources() {
  const { data: dataSources, isLoading } = useQuery({
    queryKey: ["/api/data-sources"],
  });

  const getSourceIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case "salesforce": return "🌩️";
      case "hubspot": return "🟠";
      case "quickbooks": return "🟢";
      default: return "📊";
    }
  };

  const getSourceColor = (name: string) => {
    switch (name.toLowerCase()) {
      case "salesforce": return "bg-blue-500";
      case "hubspot": return "bg-orange-500";
      case "quickbooks": return "bg-green-600";
      default: return "bg-gray-500";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                    <div>
                      <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                      <div className="h-3 bg-gray-200 rounded w-20" />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="h-5 bg-gray-200 rounded-full w-16" />
                    <div className="w-4 h-4 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Sources</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {dataSources && dataSources.length > 0 ? (
            dataSources.map((source: any) => (
              <div key={source.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 ${getSourceColor(source.name)} rounded-lg flex items-center justify-center text-white font-semibold`}>
                    {source.name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{source.name}</p>
                    <p className="text-sm text-gray-500">{source.tableCount || 0} tables synced</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={`status-badge ${source.status}`}>
                    {source.status}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500 mb-4">No data sources configured</p>
              <p className="text-xs text-gray-400">Run the setup flow to configure your connectors</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
