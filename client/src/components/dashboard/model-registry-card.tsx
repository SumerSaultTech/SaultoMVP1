import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, Rocket } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ModelRegistryCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sqlModels, isLoading } = useQuery({
    queryKey: ["/api/sql-models"],
  });

  const deployMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/sql-models/deploy"),
    onSuccess: () => {
      toast({
        title: "Deployment Started",
        description: "SQL models are being deployed to Snowflake.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sql-models"] });
    },
    onError: (error: any) => {
      toast({
        title: "Deployment Failed",
        description: error.message || "Failed to deploy models.",
        variant: "destructive",
      });
    },
  });

  const getLayerStats = (layer: string) => {
    if (!sqlModels) return { deployed: 0, total: 0 };
    const layerModels = sqlModels.filter((m: any) => m.layer === layer);
    const deployed = layerModels.filter((m: any) => m.status === "deployed").length;
    return { deployed, total: layerModels.length };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Model Registry</CardTitle>
          <Button size="sm" disabled>
            <Rocket className="mr-1 h-4 w-4" />
            Deploy
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                    <div className="h-5 bg-gray-200 rounded-full w-16" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const stagingStats = getLayerStats("stg");
  const intStats = getLayerStats("int");
  const coreStats = getLayerStats("core");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>Model Registry</CardTitle>
        <Button 
          size="sm" 
          onClick={() => deployMutation.mutate()}
          disabled={deployMutation.isPending}
        >
          <Rocket className="mr-1 h-4 w-4" />
          {deployMutation.isPending ? "Deploying..." : "Deploy"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Staging Models */}
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-700">Staging Models</span>
              <Badge className={stagingStats.deployed === stagingStats.total && stagingStats.total > 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                {stagingStats.deployed}/{stagingStats.total} deployed
              </Badge>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              {stagingStats.total > 0 ? (
                sqlModels
                  ?.filter((m: any) => m.layer === "stg")
                  .slice(0, 3)
                  .map((model: any) => (
                    <div key={model.id} className="flex items-center space-x-2">
                      {model.status === "deployed" ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <Clock className="h-3 w-3 text-amber-500" />
                      )}
                      <span>{model.name}</span>
                    </div>
                  ))
              ) : (
                <div className="text-gray-400 text-xs">No staging models found</div>
              )}
            </div>
          </div>

          {/* Intermediate Models */}
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-700">Intermediate Models</span>
              <Badge className={intStats.deployed === intStats.total && intStats.total > 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                {intStats.deployed}/{intStats.total} deployed
              </Badge>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              {intStats.total > 0 ? (
                sqlModels
                  ?.filter((m: any) => m.layer === "int")
                  .slice(0, 3)
                  .map((model: any) => (
                    <div key={model.id} className="flex items-center space-x-2">
                      {model.status === "deployed" ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <Clock className="h-3 w-3 text-amber-500" />
                      )}
                      <span>{model.name}</span>
                    </div>
                  ))
              ) : (
                <div className="text-gray-400 text-xs">No intermediate models found</div>
              )}
            </div>
          </div>

          {/* Core Models */}
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-700">Core Models</span>
              <Badge className={coreStats.deployed === coreStats.total && coreStats.total > 0 ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                {coreStats.deployed}/{coreStats.total} deployed
              </Badge>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              {coreStats.total > 0 ? (
                sqlModels
                  ?.filter((m: any) => m.layer === "core")
                  .slice(0, 3)
                  .map((model: any) => (
                    <div key={model.id} className="flex items-center space-x-2">
                      {model.status === "deployed" ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <Clock className="h-3 w-3 text-amber-500" />
                      )}
                      <span>{model.name}</span>
                    </div>
                  ))
              ) : (
                <div className="text-gray-400 text-xs">No core models found</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
