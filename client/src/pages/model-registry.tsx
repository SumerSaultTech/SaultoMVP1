import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Clock, AlertCircle, Rocket, GitBranch, Code, Database } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ModelRegistry() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLayer, setSelectedLayer] = useState<string>("all");

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "deployed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "pending":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "deployed":
        return <Badge className="bg-green-100 text-green-800">Deployed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getLayerIcon = (layer: string) => {
    switch (layer) {
      case "stg":
        return "🔄";
      case "int":
        return "⚙️";
      case "core":
        return "💎";
      default:
        return "📊";
    }
  };

  const getLayerDescription = (layer: string) => {
    switch (layer) {
      case "stg":
        return "Staging models that clean and standardize raw data";
      case "int":
        return "Intermediate models that join and transform staging data";
      case "core":
        return "Core business logic models for analytics and reporting";
      default:
        return "SQL transformation models";
    }
  };

  const filteredModels = sqlModels?.filter((model: any) => 
    selectedLayer === "all" || model.layer === selectedLayer
  ) || [];

  const modelsByLayer = {
    stg: sqlModels?.filter((m: any) => m.layer === "stg") || [],
    int: sqlModels?.filter((m: any) => m.layer === "int") || [],
    core: sqlModels?.filter((m: any) => m.layer === "core") || [],
  };

  const getLayerStats = (layer: string) => {
    const models = modelsByLayer[layer as keyof typeof modelsByLayer] || [];
    const deployed = models.filter((m: any) => m.status === "deployed").length;
    const total = models.length;
    return { deployed, total };
  };

  const ModelCard = ({ model }: { model: any }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">{getLayerIcon(model.layer)}</div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-gray-900 truncate">{model.name}</h3>
              <p className="text-sm text-gray-500 capitalize">{model.layer} layer</p>
              {model.dependencies && model.dependencies.length > 0 && (
                <div className="flex items-center space-x-1 mt-2">
                  <GitBranch className="h-3 w-3 text-gray-400" />
                  <span className="text-xs text-gray-500">
                    Depends on {model.dependencies.length} model{model.dependencies.length > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {model.deployedAt && (
                <p className="text-xs text-gray-500 mt-1">
                  Deployed {new Date(model.deployedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon(model.status)}
            {getStatusBadge(model.status)}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <>
        <Header title="Model Registry" subtitle="Manage your SQL transformation models" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="animate-pulse space-y-3">
                      <div className="h-6 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header 
        title="Model Registry" 
        subtitle="Manage your SQL transformation models"
        actions={
          <Button 
            onClick={() => deployMutation.mutate()}
            disabled={deployMutation.isPending}
            className="bg-primary-500 hover:bg-primary-600"
          >
            <Rocket className="mr-2 h-4 w-4" />
            {deployMutation.isPending ? "Deploying..." : "Deploy Models"}
          </Button>
        }
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Layer Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(modelsByLayer).map(([layer, models]) => {
              const stats = getLayerStats(layer);
              return (
                <Card key={layer}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{getLayerIcon(layer)}</div>
                        <div>
                          <h3 className="font-medium capitalize">{layer === "stg" ? "Staging" : layer === "int" ? "Intermediate" : "Core"}</h3>
                          <p className="text-sm text-gray-500">{stats.deployed}/{stats.total} deployed</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                        <div className="text-xs text-gray-500">models</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">{getLayerDescription(layer)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Models by Layer */}
          <Tabs value={selectedLayer} onValueChange={setSelectedLayer} className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Models ({sqlModels?.length || 0})</TabsTrigger>
              <TabsTrigger value="stg">Staging ({modelsByLayer.stg.length})</TabsTrigger>
              <TabsTrigger value="int">Intermediate ({modelsByLayer.int.length})</TabsTrigger>
              <TabsTrigger value="core">Core ({modelsByLayer.core.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredModels.map((model: any) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="stg" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modelsByLayer.stg.map((model: any) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="int" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modelsByLayer.int.map((model: any) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="core" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {modelsByLayer.core.map((model: any) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {filteredModels.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="font-medium text-gray-900 mb-2">No models found</h3>
                <p className="text-sm text-gray-500 mb-4">
                  SQL models will appear here once they are created and deployed.
                </p>
                <Button onClick={() => deployMutation.mutate()} disabled={deployMutation.isPending}>
                  <Code className="mr-2 h-4 w-4" />
                  Initialize Models
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
