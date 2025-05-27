import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, AlertCircle, Play, Database, Zap, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Setup() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProvisioning, setIsProvisioning] = useState(false);

  const { data: setupStatus, isLoading } = useQuery({
    queryKey: ["/api/setup-status"],
  });

  const { data: dataSources } = useQuery({
    queryKey: ["/api/data-sources"],
  });

  const { data: sqlModels } = useQuery({
    queryKey: ["/api/sql-models"],
  });

  const provisionMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/setup/provision"),
    onSuccess: () => {
      toast({
        title: "Setup Complete",
        description: "Your data warehouse has been successfully provisioned!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/setup-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      setIsProvisioning(false);
    },
    onError: (error: any) => {
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to provision data warehouse.",
        variant: "destructive",
      });
      setIsProvisioning(false);
    },
  });

  const deployModelsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/sql-models/deploy"),
    onSuccess: () => {
      toast({
        title: "Models Deployed",
        description: "SQL models have been successfully deployed to Snowflake.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sql-models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/setup-status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Deployment Failed",
        description: error.message || "Failed to deploy SQL models.",
        variant: "destructive",
      });
    },
  });

  const handleOneClickSetup = () => {
    setIsProvisioning(true);
    provisionMutation.mutate();
  };

  const getProgressPercentage = () => {
    if (!setupStatus) return 0;
    let progress = 0;
    if (setupStatus.snowflakeConnected) progress += 33;
    if (setupStatus.fivetranConfigured) progress += 33;
    if (setupStatus.modelsDeployed === setupStatus.totalModels && setupStatus.totalModels > 0) progress += 34;
    return progress;
  };

  const getStepStatus = (completed: boolean, loading = false) => {
    if (loading) return { icon: Clock, color: "text-blue-500", bgColor: "bg-blue-100" };
    if (completed) return { icon: CheckCircle, color: "text-green-500", bgColor: "bg-green-100" };
    return { icon: AlertCircle, color: "text-gray-400", bgColor: "bg-gray-100" };
  };

  if (isLoading) {
    return (
      <>
        <Header title="Setup & Configuration" subtitle="Configure your data warehouse platform" />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardContent className="p-8">
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-gray-200 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-32 bg-gray-200 rounded" />
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header 
        title="Setup & Configuration" 
        subtitle="Configure your data warehouse platform"
        actions={
          <Button 
            onClick={handleOneClickSetup} 
            disabled={isProvisioning || provisionMutation.isPending || setupStatus?.snowflakeConnected}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Play className="mr-2 h-4 w-4" />
            {isProvisioning ? "Setting Up..." : setupStatus?.snowflakeConnected ? "Setup Complete" : "One-Click Setup"}
          </Button>
        }
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Progress Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Setup Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-gray-500">{getProgressPercentage()}%</span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
                <p className="text-sm text-gray-600">
                  Complete the setup steps below to start analyzing your data.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Setup Steps */}
          <div className="grid gap-6">
            {/* Step 1: Snowflake */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    getStepStatus(setupStatus?.snowflakeConnected, isProvisioning).bgColor
                  }`}>
                    {isProvisioning ? (
                      <Clock className="h-6 w-6 text-blue-500 animate-spin" />
                    ) : (
                      <Database className={`h-6 w-6 ${getStepStatus(setupStatus?.snowflakeConnected).color}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Snowflake Connection</h3>
                      <Badge variant={setupStatus?.snowflakeConnected ? "default" : "secondary"}>
                        {setupStatus?.snowflakeConnected ? "Connected" : "Not Connected"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Connect to your Snowflake data warehouse to store and query your data.
                    </p>
                    {setupStatus?.snowflakeConnected && (
                      <div className="mt-3 text-sm text-green-600">
                        ✓ Successfully connected to Snowflake warehouse
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Fivetran */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    getStepStatus(setupStatus?.fivetranConfigured, isProvisioning).bgColor
                  }`}>
                    {isProvisioning ? (
                      <Clock className="h-6 w-6 text-blue-500 animate-spin" />
                    ) : (
                      <Zap className={`h-6 w-6 ${getStepStatus(setupStatus?.fivetranConfigured).color}`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Fivetran Data Connectors</h3>
                      <Badge variant={setupStatus?.fivetranConfigured ? "default" : "secondary"}>
                        {setupStatus?.fivetranConfigured ? "Configured" : "Not Configured"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Set up data connectors for Salesforce, HubSpot, and QuickBooks.
                    </p>
                    {setupStatus?.fivetranConfigured && (
                      <div className="mt-3 space-y-1">
                        {dataSources?.map((source: any) => (
                          <div key={source.id} className="text-sm text-green-600">
                            ✓ {source.name} connector configured ({source.tableCount} tables)
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3: SQL Models */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    getStepStatus(
                      setupStatus?.modelsDeployed === setupStatus?.totalModels && setupStatus?.totalModels > 0,
                      deployModelsMutation.isPending
                    ).bgColor
                  }`}>
                    {deployModelsMutation.isPending ? (
                      <Clock className="h-6 w-6 text-blue-500 animate-spin" />
                    ) : (
                      <BarChart3 className={`h-6 w-6 ${
                        getStepStatus(setupStatus?.modelsDeployed === setupStatus?.totalModels && setupStatus?.totalModels > 0).color
                      }`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">SQL Model Deployment</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant={setupStatus?.modelsDeployed === setupStatus?.totalModels && setupStatus?.totalModels > 0 ? "default" : "secondary"}>
                          {setupStatus?.modelsDeployed || 0}/{setupStatus?.totalModels || 0} Deployed
                        </Badge>
                        <Button 
                          size="sm" 
                          onClick={() => deployModelsMutation.mutate()}
                          disabled={deployModelsMutation.isPending || !setupStatus?.snowflakeConnected}
                        >
                          Deploy Models
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Deploy layered SQL models (staging → intermediate → core) to transform your data.
                    </p>
                    {sqlModels && sqlModels.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Staging:</span> {sqlModels.filter((m: any) => m.layer === 'stg').length} models
                        </div>
                        <div>
                          <span className="font-medium">Intermediate:</span> {sqlModels.filter((m: any) => m.layer === 'int').length} models
                        </div>
                        <div>
                          <span className="font-medium">Core:</span> {sqlModels.filter((m: any) => m.layer === 'core').length} models
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Environment Variables Guide */}
          <Card>
            <CardHeader>
              <CardTitle>Required Environment Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Make sure these environment variables are configured in your Replit secrets:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-medium">Snowflake</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li>• SNOWFLAKE_ACCOUNT</li>
                      <li>• SNOWFLAKE_USERNAME</li>
                      <li>• SNOWFLAKE_PASSWORD</li>
                      <li>• SNOWFLAKE_WAREHOUSE</li>
                      <li>• SNOWFLAKE_DATABASE</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Fivetran</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li>• FIVETRAN_API_KEY</li>
                      <li>• FIVETRAN_API_SECRET</li>
                      <li>• FIVETRAN_GROUP_ID</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Data Sources</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li>• SALESFORCE_DOMAIN</li>
                      <li>• SALESFORCE_CLIENT_ID</li>
                      <li>• HUBSPOT_API_KEY</li>
                      <li>• QUICKBOOKS_CONSUMER_KEY</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">AI Assistant</h4>
                    <ul className="space-y-1 text-gray-600">
                      <li>• OPENAI_API_KEY</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
