import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, AlertCircle, Loader2, Database, Zap, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SnowflakeConfig {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
}

interface FivetranConnectorConfig {
  salesforce?: {
    username: string;
    password: string;
    securityToken: string;
    isSandbox: boolean;
  };
  hubspot?: {
    accessToken: string;
  };
  quickbooks?: {
    companyId: string;
    accessToken: string;
    refreshToken: string;
    isSandbox: boolean;
  };
}

export default function Setup() {
  const [activeTab, setActiveTab] = useState("snowflake");
  const [snowflakeConfig, setSnowflakeConfig] = useState<SnowflakeConfig>({
    account: "",
    username: "",
    password: "",
    warehouse: "COMPUTE_WH",
    database: "ANALYTICS_DB",
    schema: "PUBLIC",
  });
  const [fivetranConfig, setFivetranConfig] = useState<FivetranConnectorConfig>({});
  const [setupProgress, setSetupProgress] = useState(0);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: connections = [] } = useQuery({
    queryKey: ["/api/connections"],
  });

  const { data: dataSources = [] } = useQuery({
    queryKey: ["/api/data-sources"],
  });

  const snowflakeSetupMutation = useMutation({
    mutationFn: async (config: SnowflakeConfig) => {
      const response = await apiRequest("POST", "/api/setup/snowflake", config);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Snowflake Connected",
        description: "Successfully connected to Snowflake warehouse",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
      setSetupProgress(50);
      setActiveTab("fivetran");
    },
    onError: (error) => {
      console.error("Snowflake setup failed:", error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect to Snowflake. Check your credentials.",
        variant: "destructive",
      });
    },
  });

  const fivetranSetupMutation = useMutation({
    mutationFn: async (config: FivetranConnectorConfig) => {
      const response = await apiRequest("POST", "/api/setup/fivetran-connectors", config);
      return response.json();
    },
    onSuccess: (data) => {
      const successCount = data.results.filter((r: any) => r.success).length;
      toast({
        title: "Connectors Created",
        description: `${successCount} data connectors configured successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      setSetupProgress(100);
      setIsSetupComplete(true);
    },
    onError: (error) => {
      console.error("Fivetran setup failed:", error);
      toast({
        title: "Connector Setup Failed",
        description: "Failed to create Fivetran connectors",
        variant: "destructive",
      });
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
        description: `${data.deployed.length} SQL models deployed successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
    },
    onError: (error) => {
      console.error("Model deployment failed:", error);
      toast({
        title: "Deployment Failed",
        description: "Failed to deploy SQL models",
        variant: "destructive",
      });
    },
  });

  const handleSnowflakeSetup = () => {
    snowflakeSetupMutation.mutate(snowflakeConfig);
  };

  const handleFivetranSetup = () => {
    fivetranSetupMutation.mutate(fivetranConfig);
  };

  const handleDeployModels = () => {
    deployModelsMutation.mutate();
  };

  const isSnowflakeConnected = connections.some(c => c.type === "snowflake" && c.status === "connected");
  const connectedDataSources = dataSources.filter(ds => ds.status === "active").length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Progress Header */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">Setup Progress</h2>
              <Badge 
                variant={isSetupComplete ? "default" : "secondary"}
                className={cn(
                  isSetupComplete ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"
                )}
              >
                {isSetupComplete ? "Complete" : "In Progress"}
              </Badge>
            </div>
            <Progress value={setupProgress} className="w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                {isSnowflakeConnected ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                )}
                <span className={cn(
                  isSnowflakeConnected ? "text-green-600" : "text-slate-600"
                )}>
                  Snowflake Connection
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {connectedDataSources > 0 ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                )}
                <span className={cn(
                  connectedDataSources > 0 ? "text-green-600" : "text-slate-600"
                )}>
                  Data Sources ({connectedDataSources}/3)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {isSetupComplete ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                )}
                <span className={cn(
                  isSetupComplete ? "text-green-600" : "text-slate-600"
                )}>
                  Ready for Analytics
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Setup Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="snowflake" className="flex items-center space-x-2">
            <Database className="w-4 h-4" />
            <span>Snowflake</span>
          </TabsTrigger>
          <TabsTrigger value="fivetran" className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span>Data Sources</span>
          </TabsTrigger>
          <TabsTrigger value="deploy" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Deploy Models</span>
          </TabsTrigger>
        </TabsList>

        {/* Snowflake Setup */}
        <TabsContent value="snowflake">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="w-5 h-5 text-primary" />
                <span>Snowflake Data Warehouse Setup</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isSnowflakeConnected ? (
                <div className="flex items-center justify-center p-8 text-center">
                  <div className="space-y-4">
                    <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Snowflake Connected</h3>
                      <p className="text-slate-600">Your Snowflake warehouse is ready for data ingestion</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="account">Account</Label>
                    <Input
                      id="account"
                      placeholder="your-account.snowflakecomputing.com"
                      value={snowflakeConfig.account}
                      onChange={(e) => setSnowflakeConfig(prev => ({ ...prev, account: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="your-username"
                      value={snowflakeConfig.username}
                      onChange={(e) => setSnowflakeConfig(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="your-password"
                      value={snowflakeConfig.password}
                      onChange={(e) => setSnowflakeConfig(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warehouse">Warehouse</Label>
                    <Input
                      id="warehouse"
                      placeholder="COMPUTE_WH"
                      value={snowflakeConfig.warehouse}
                      onChange={(e) => setSnowflakeConfig(prev => ({ ...prev, warehouse: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="database">Database</Label>
                    <Input
                      id="database"
                      placeholder="ANALYTICS_DB"
                      value={snowflakeConfig.database}
                      onChange={(e) => setSnowflakeConfig(prev => ({ ...prev, database: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schema">Schema</Label>
                    <Input
                      id="schema"
                      placeholder="PUBLIC"
                      value={snowflakeConfig.schema}
                      onChange={(e) => setSnowflakeConfig(prev => ({ ...prev, schema: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              
              {!isSnowflakeConnected && (
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSnowflakeSetup}
                    disabled={snowflakeSetupMutation.isPending || !snowflakeConfig.account || !snowflakeConfig.username || !snowflakeConfig.password}
                    className="flex items-center space-x-2"
                  >
                    {snowflakeSetupMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Connect to Snowflake</span>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fivetran Setup */}
        <TabsContent value="fivetran">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <span>Data Source Connectors</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Salesforce */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Salesforce</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sf-username">Username</Label>
                      <Input
                        id="sf-username"
                        placeholder="your-salesforce-username"
                        value={fivetranConfig.salesforce?.username || ""}
                        onChange={(e) => setFivetranConfig(prev => ({
                          ...prev,
                          salesforce: { ...prev.salesforce, username: e.target.value } as any
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sf-password">Password</Label>
                      <Input
                        id="sf-password"
                        type="password"
                        placeholder="your-salesforce-password"
                        value={fivetranConfig.salesforce?.password || ""}
                        onChange={(e) => setFivetranConfig(prev => ({
                          ...prev,
                          salesforce: { ...prev.salesforce, password: e.target.value } as any
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sf-token">Security Token</Label>
                      <Input
                        id="sf-token"
                        placeholder="your-security-token"
                        value={fivetranConfig.salesforce?.securityToken || ""}
                        onChange={(e) => setFivetranConfig(prev => ({
                          ...prev,
                          salesforce: { ...prev.salesforce, securityToken: e.target.value } as any
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* HubSpot */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">HubSpot</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hs-token">Access Token</Label>
                      <Input
                        id="hs-token"
                        placeholder="your-hubspot-access-token"
                        value={fivetranConfig.hubspot?.accessToken || ""}
                        onChange={(e) => setFivetranConfig(prev => ({
                          ...prev,
                          hubspot: { accessToken: e.target.value }
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* QuickBooks */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">QuickBooks</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="qb-company">Company ID</Label>
                      <Input
                        id="qb-company"
                        placeholder="your-company-id"
                        value={fivetranConfig.quickbooks?.companyId || ""}
                        onChange={(e) => setFivetranConfig(prev => ({
                          ...prev,
                          quickbooks: { ...prev.quickbooks, companyId: e.target.value } as any
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qb-access">Access Token</Label>
                      <Input
                        id="qb-access"
                        placeholder="your-access-token"
                        value={fivetranConfig.quickbooks?.accessToken || ""}
                        onChange={(e) => setFivetranConfig(prev => ({
                          ...prev,
                          quickbooks: { ...prev.quickbooks, accessToken: e.target.value } as any
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qb-refresh">Refresh Token</Label>
                      <Input
                        id="qb-refresh"
                        placeholder="your-refresh-token"
                        value={fivetranConfig.quickbooks?.refreshToken || ""}
                        onChange={(e) => setFivetranConfig(prev => ({
                          ...prev,
                          quickbooks: { ...prev.quickbooks, refreshToken: e.target.value } as any
                        }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleFivetranSetup}
                    disabled={fivetranSetupMutation.isPending || !isSnowflakeConnected}
                    className="flex items-center space-x-2"
                  >
                    {fivetranSetupMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Create Connectors</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Deploy Models */}
        <TabsContent value="deploy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-primary" />
                <span>Deploy SQL Models</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center p-8">
                <div className="space-y-4">
                  <Settings className="w-16 h-16 text-slate-400 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">Deploy Analytics Models</h3>
                    <p className="text-slate-600 mb-6">
                      Deploy staging, intermediate, and core models to start generating KPIs
                    </p>
                    <Button
                      onClick={handleDeployModels}
                      disabled={deployModelsMutation.isPending || !isSnowflakeConnected}
                      size="lg"
                      className="flex items-center space-x-2"
                    >
                      {deployModelsMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>Deploy All Models</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
