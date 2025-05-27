import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function SetupStatus() {
  const { data: setupStatus, isLoading } = useQuery({
    queryKey: ["/api/setup-status"],
  });

  const { data: dataSources } = useQuery({
    queryKey: ["/api/data-sources"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Setup Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const connectedSources = dataSources?.filter((ds: any) => ds.status === "connected").length || 0;
  const totalSources = dataSources?.length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Snowflake */}
          <div className={`flex items-center space-x-3 p-4 rounded-lg border ${
            setupStatus?.snowflakeConnected 
              ? "bg-green-50 border-green-200" 
              : "bg-gray-50 border-gray-200"
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              setupStatus?.snowflakeConnected 
                ? "bg-green-500" 
                : "bg-gray-400"
            }`}>
              {setupStatus?.snowflakeConnected ? (
                <CheckCircle className="h-5 w-5 text-white" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <p className={`font-medium ${
                setupStatus?.snowflakeConnected ? "text-green-800" : "text-gray-600"
              }`}>
                {setupStatus?.snowflakeConnected ? "Snowflake Connected" : "Snowflake Pending"}
              </p>
              <p className={`text-sm ${
                setupStatus?.snowflakeConnected ? "text-green-600" : "text-gray-500"
              }`}>
                {setupStatus?.snowflakeConnected ? "Warehouse: COMPUTE_WH" : "Configuration required"}
              </p>
            </div>
          </div>

          {/* Fivetran */}
          <div className={`flex items-center space-x-3 p-4 rounded-lg border ${
            setupStatus?.fivetranConfigured 
              ? "bg-blue-50 border-blue-200" 
              : "bg-gray-50 border-gray-200"
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              setupStatus?.fivetranConfigured 
                ? "bg-blue-500" 
                : "bg-gray-400"
            }`}>
              {setupStatus?.fivetranConfigured ? (
                <CheckCircle className="h-5 w-5 text-white" />
              ) : (
                <Clock className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <p className={`font-medium ${
                setupStatus?.fivetranConfigured ? "text-blue-800" : "text-gray-600"
              }`}>
                {setupStatus?.fivetranConfigured ? "Fivetran Syncing" : "Fivetran Pending"}
              </p>
              <p className={`text-sm ${
                setupStatus?.fivetranConfigured ? "text-blue-600" : "text-gray-500"
              }`}>
                {setupStatus?.fivetranConfigured 
                  ? `${connectedSources}/${totalSources} connectors active`
                  : "Connectors not configured"
                }
              </p>
            </div>
          </div>

          {/* Models */}
          <div className={`flex items-center space-x-3 p-4 rounded-lg border ${
            setupStatus?.modelsDeployed === setupStatus?.totalModels && setupStatus?.totalModels > 0
              ? "bg-green-50 border-green-200" 
              : "bg-amber-50 border-amber-200"
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              setupStatus?.modelsDeployed === setupStatus?.totalModels && setupStatus?.totalModels > 0
                ? "bg-green-500" 
                : "bg-amber-500"
            }`}>
              {setupStatus?.modelsDeployed === setupStatus?.totalModels && setupStatus?.totalModels > 0 ? (
                <CheckCircle className="h-5 w-5 text-white" />
              ) : (
                <Clock className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <p className={`font-medium ${
                setupStatus?.modelsDeployed === setupStatus?.totalModels && setupStatus?.totalModels > 0
                  ? "text-green-800" 
                  : "text-amber-800"
              }`}>
                {setupStatus?.modelsDeployed === setupStatus?.totalModels && setupStatus?.totalModels > 0
                  ? "Models Deployed" 
                  : "Models Deploying"
                }
              </p>
              <p className={`text-sm ${
                setupStatus?.modelsDeployed === setupStatus?.totalModels && setupStatus?.totalModels > 0
                  ? "text-green-600" 
                  : "text-amber-600"
              }`}>
                {setupStatus?.modelsDeployed || 0}/{setupStatus?.totalModels || 0} views deployed
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
