import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, GitBranch, Calendar, User, FileCode, Trash2, Edit, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SqlModel {
  id: number;
  name: string;
  layer: string;
  description: string;
  sqlContent: string;
  status: string;
  lastDeployed: string | null;
  rowCount: number | null;
  createdAt: string;
}

interface PipelineRun {
  id: number;
  type: string;
  status: string;
  startTime: string;
  endTime: string | null;
  logs: string | null;
}

export default function ModelRegistry() {
  const [selectedLayer, setSelectedLayer] = useState<string>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<SqlModel | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [newModel, setNewModel] = useState({
    name: "",
    layer: "stg",
    description: "",
    sqlContent: "",
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: models = [], isLoading } = useQuery<SqlModel[]>({
    queryKey: ["/api/models"],
  });

  const { data: pipelineRuns = [] } = useQuery<PipelineRun[]>({
    queryKey: ["/api/pipeline/runs"],
  });

  const createModelMutation = useMutation({
    mutationFn: async (modelData: typeof newModel) => {
      const response = await apiRequest("POST", "/api/models", modelData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Model Created",
        description: "SQL model has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setIsCreateModalOpen(false);
      setNewModel({ name: "", layer: "stg", description: "", sqlContent: "" });
    },
    onError: (error) => {
      console.error("Failed to create model:", error);
      toast({
        title: "Creation Failed",
        description: "Failed to create SQL model",
        variant: "destructive",
      });
    },
  });

  const deployModelsMutation = useMutation({
    mutationFn: async (layers?: string[]) => {
      const response = await apiRequest("POST", "/api/models/deploy", { layers });
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
      console.error("Deployment failed:", error);
      toast({
        title: "Deployment Failed",
        description: "Failed to deploy models",
        variant: "destructive",
      });
    },
  });

  const filteredModels = models.filter(model =>
    selectedLayer === "all" || model.layer === selectedLayer
  );

  const modelsByLayer = {
    stg: models.filter(m => m.layer === "stg"),
    int: models.filter(m => m.layer === "int"),
    core: models.filter(m => m.layer === "core"),
  };

  const deployedModels = models.filter(m => m.status === "deployed").length;
  const totalModels = models.length;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "deployed":
        return "default";
      case "not_deployed":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getLayerColor = (layer: string) => {
    switch (layer) {
      case "stg":
        return "bg-gray-100 text-gray-700 border-gray-300";
      case "int":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "core":
        return "bg-blue-100 text-blue-700 border-blue-300";
      default:
        return "bg-slate-100 text-slate-700 border-slate-300";
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  const formatNumber = (num: number | null) => {
    if (!num) return "0";
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const handleCreateModel = () => {
    createModelMutation.mutate(newModel);
  };

  const handleDeployAllModels = () => {
    deployModelsMutation.mutate();
  };

  const handleDeployLayer = (layer: string) => {
    deployModelsMutation.mutate([layer]);
  };

  const latestDeployment = pipelineRuns.find(run => run.type === "model_deploy");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Model Registry</h1>
          <p className="text-slate-600">
            {deployedModels} of {totalModels} models deployed
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Create Model</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create SQL Model</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Model Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., stg_customers"
                      value={newModel.name}
                      onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="layer">Layer</Label>
                    <Select value={newModel.layer} onValueChange={(value) => setNewModel(prev => ({ ...prev, layer: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stg">Staging (stg)</SelectItem>
                        <SelectItem value="int">Intermediate (int)</SelectItem>
                        <SelectItem value="core">Core</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of the model"
                    value={newModel.description}
                    onChange={(e) => setNewModel(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sql">SQL Content</Label>
                  <Textarea
                    id="sql"
                    placeholder="SELECT * FROM source_table..."
                    value={newModel.sqlContent}
                    onChange={(e) => setNewModel(prev => ({ ...prev, sqlContent: e.target.value }))}
                    className="h-40 font-mono text-sm"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateModel}
                    disabled={createModelMutation.isPending || !newModel.name || !newModel.sqlContent}
                  >
                    Create Model
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            onClick={handleDeployAllModels}
            disabled={deployModelsMutation.isPending}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>Deploy All</span>
          </Button>
        </div>
      </div>

      {/* Model Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-gray-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{modelsByLayer.stg.length}</div>
                <div className="text-sm text-slate-600">Staging Models</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{modelsByLayer.int.length}</div>
                <div className="text-sm text-slate-600">Intermediate Models</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{modelsByLayer.core.length}</div>
                <div className="text-sm text-slate-600">Core Models</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Play className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-800">{deployedModels}</div>
                <div className="text-sm text-slate-600">Deployed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Models Table */}
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all" onClick={() => setSelectedLayer("all")}>
              All Models ({totalModels})
            </TabsTrigger>
            <TabsTrigger value="stg" onClick={() => setSelectedLayer("stg")}>
              Staging ({modelsByLayer.stg.length})
            </TabsTrigger>
            <TabsTrigger value="int" onClick={() => setSelectedLayer("int")}>
              Intermediate ({modelsByLayer.int.length})
            </TabsTrigger>
            <TabsTrigger value="core" onClick={() => setSelectedLayer("core")}>
              Core ({modelsByLayer.core.length})
            </TabsTrigger>
          </TabsList>
          {selectedLayer !== "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeployLayer(selectedLayer)}
              disabled={deployModelsMutation.isPending}
              className="flex items-center space-x-2"
            >
              <Play className="w-3 h-3" />
              <span>Deploy {selectedLayer.toUpperCase()}</span>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-16 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="text-center py-12">
                <GitBranch className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No Models Found</h3>
                <p className="text-slate-500">
                  Create your first SQL model to get started with data transformations.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-4 font-medium text-slate-600">Model</th>
                      <th className="text-left p-4 font-medium text-slate-600">Layer</th>
                      <th className="text-left p-4 font-medium text-slate-600">Status</th>
                      <th className="text-left p-4 font-medium text-slate-600">Rows</th>
                      <th className="text-left p-4 font-medium text-slate-600">Last Deployed</th>
                      <th className="text-left p-4 font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredModels.map((model) => (
                      <tr key={model.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <div>
                            <div className="font-medium text-slate-800">{model.name}</div>
                            <div className="text-sm text-slate-600">{model.description}</div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className={cn("text-xs", getLayerColor(model.layer))}>
                            {model.layer}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={getStatusBadgeVariant(model.status)}>
                            {model.status.replace("_", " ")}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-600">
                          {formatNumber(model.rowCount)}
                        </td>
                        <td className="p-4 text-slate-600">
                          {formatDate(model.lastDeployed)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedModel(model);
                                setIsViewModalOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deployModelsMutation.isPending}
                              onClick={() => handleDeployLayer(model.layer)}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </Tabs>

      {/* View Model Dialog */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileCode className="w-5 h-5" />
              <span>{selectedModel?.name}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedModel && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <Badge className={cn("text-xs", getLayerColor(selectedModel.layer))}>
                  {selectedModel.layer}
                </Badge>
                <Badge variant={getStatusBadgeVariant(selectedModel.status)}>
                  {selectedModel.status.replace("_", " ")}
                </Badge>
                {selectedModel.rowCount && (
                  <span className="text-sm text-slate-600">
                    {formatNumber(selectedModel.rowCount)} rows
                  </span>
                )}
              </div>
              <div>
                <h4 className="font-medium text-slate-800 mb-2">Description</h4>
                <p className="text-slate-600">{selectedModel.description}</p>
              </div>
              <div>
                <h4 className="font-medium text-slate-800 mb-2">SQL Content</h4>
                <div className="bg-slate-900 text-green-400 p-4 rounded text-sm font-mono overflow-x-auto">
                  <pre>{selectedModel.sqlContent}</pre>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Created: {formatDate(selectedModel.createdAt)}</span>
                <span>Last Deployed: {formatDate(selectedModel.lastDeployed)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recent Deployments */}
      {latestDeployment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span>Latest Deployment</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Play className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-800">
                    Model Deployment - {latestDeployment.status}
                  </div>
                  <div className="text-sm text-slate-600">
                    {formatDate(latestDeployment.startTime)}
                  </div>
                </div>
              </div>
              <Badge variant={getStatusBadgeVariant(latestDeployment.status)}>
                {latestDeployment.status}
              </Badge>
            </div>
            {latestDeployment.logs && (
              <div className="mt-4 p-3 bg-slate-50 rounded text-sm text-slate-600">
                {latestDeployment.logs}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
