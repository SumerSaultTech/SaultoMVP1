import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CredentialDialog } from "@/components/ui/credential-dialog";
import { CheckCircle, Clock, Settings, Database, Zap, Calendar, FileText, Users, DollarSign, Briefcase, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Step definitions
type SetupStep = "initial" | "appCount" | "toolSelection" | "confirmLogin" | "syncProgress" | "complete";

// Tool definitions with available data
const availableTools = [
  {
    id: "harvest",
    name: "Harvest",
    icon: Clock,
    description: "Available data: Time logs, Projects, Invoices",
    color: "bg-orange-100 text-orange-700",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    icon: Users,
    description: "Available data: Leads, Accounts, Opportunities, Contacts",
    color: "bg-blue-100 text-blue-700",
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    icon: DollarSign,
    description: "Available data: Invoices, Expenses, Customers, Vendors",
    color: "bg-green-100 text-green-700",
  },
  {
    id: "netsuite",
    name: "NetSuite (Oracle)",
    icon: Database,
    description: "Available data: Financial records, Inventory, CRM",
    color: "bg-purple-100 text-purple-700",
  },
  {
    id: "asana",
    name: "Asana",
    icon: Target,
    description: "Available data: Tasks, Projects, Teams, Workspaces",
    color: "bg-pink-100 text-pink-700",
  },
  {
    id: "jira",
    name: "Jira",
    icon: Briefcase,
    description: "Available data: Issues, Projects, Workflows, Reports",
    color: "bg-indigo-100 text-indigo-700",
  },
];

const industries = [
  "Technology",
  "Healthcare",
  "Finance",
  "Retail",
  "Manufacturing",
  "Education",
  "Real Estate",
  "Consulting",
  "Media & Entertainment",
  "Other",
];

export default function Setup() {
  // State management - pre-populate known company info
  const [currentStep, setCurrentStep] = useState<SetupStep>("appCount");
  const [companyName] = useState("MIAS_DATA");
  const [industry] = useState("Technology");
  const [appCount, setAppCount] = useState<number | null>(null);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [completedLogins, setCompletedLogins] = useState<string[]>([]);
  
  // Credential dialog state
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [currentToolForCredentials, setCurrentToolForCredentials] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Handle tool selection
  const handleToolToggle = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  // Handle credential submission for Airbyte connection
  const handleCredentialSubmit = async (credentials: Record<string, string>) => {
    if (!currentToolForCredentials) return;
    
    setIsLoggingIn(true);
    try {
      // Call API to create Airbyte connection
      const response = await fetch("/api/airbyte/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceType: currentToolForCredentials,
          credentials: credentials,
          companyId: 1748544793859, // Using the company ID from CLAUDE.md
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create connection");
      }

      const result = await response.json();
      
      setCompletedLogins(prev => [...prev, currentToolForCredentials]);
      toast({
        title: "Connection Created",
        description: `Successfully connected to ${availableTools.find(t => t.id === currentToolForCredentials)?.name}`,
      });
    } catch (error) {
      console.error("Failed to create connection:", error);
      toast({
        title: "Connection Failed",
        description: "Failed to create the connection. Please check your credentials and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
      setCurrentToolForCredentials(null);
    }
  };

  // Open credential dialog for a specific tool
  const openCredentialDialog = (toolId: string) => {
    setCurrentToolForCredentials(toolId);
    setCredentialDialogOpen(true);
  };

  // Simulate data sync process
  const simulateDataSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);
    
    const totalSteps = selectedTools.length * 20; // 20 progress points per tool
    let currentProgress = 0;
    
    for (const tool of selectedTools) {
      // Simulate sync for each tool
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        currentProgress++;
        setSyncProgress((currentProgress / totalSteps) * 100);
      }
    }
    
    setIsSyncing(false);
    setCurrentStep("complete");
  };

  // Start fresh setup
  const startFreshSetup = () => {
    setCurrentStep("appCount");
    setAppCount(null);
    setSelectedTools([]);
    setSyncProgress(0);
    setCompletedLogins([]);
  };

  // Render functions for each step
  const renderInitialStep = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Settings className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Company Setup & Configuration</h1>
        <p className="text-lg text-gray-600">
          Let's get your data integration platform set up and connected to your business tools.
        </p>
      </div>

      <Card>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="companyName" className="text-base font-medium">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Enter your company name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="industry" className="text-base font-medium">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind.toLowerCase()}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={() => setCurrentStep("appCount")}
            disabled={!companyName || !industry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
          >
            Initiate Setup
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderAppCountStep = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Settings className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Data Integration Setup</h1>
        <p className="text-lg text-gray-600">
          Configure data connections for {companyName} ({industry} company)
        </p>
      </div>

      <Card>
        <CardContent className="p-8 space-y-6">
          <div>
            <Label htmlFor="appCount" className="text-base font-medium">How many apps do you want to connect?</Label>
            <Select value={appCount?.toString() || ""} onValueChange={(value) => setAppCount(parseInt(value))}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select number of apps" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num} {num === 1 ? 'App' : 'Apps'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={() => setCurrentStep("toolSelection")}
            disabled={!appCount}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg"
          >
            Continue to Tool Selection
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderToolSelectionStep = () => (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Select Your Tools</h2>
        <p className="text-gray-600">
          Choose {appCount} tools to connect to your data platform
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableTools.map((tool) => {
          const Icon = tool.icon;
          const isSelected = selectedTools.includes(tool.id);
          
          return (
            <Card 
              key={tool.id}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-lg'
              } ${selectedTools.length >= appCount! && !isSelected ? 'opacity-50' : ''}`}
              onClick={() => {
                if (selectedTools.length < appCount! || isSelected) {
                  handleToolToggle(tool.id);
                }
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${tool.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{tool.name}</h3>
                      <Checkbox checked={isSelected} readOnly />
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {tool.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Selected: {selectedTools.length}/{appCount}</p>
              <p className="text-sm text-gray-600">
                {selectedTools.length === appCount 
                  ? "Perfect! You've selected all your tools." 
                  : `Select ${appCount! - selectedTools.length} more tool${appCount! - selectedTools.length !== 1 ? 's' : ''}.`
                }
              </p>
            </div>
            <div className="flex gap-4">
              <Button 
                variant="outline"
                onClick={() => setCurrentStep("appCount")}
              >
                Back
              </Button>
              <Button 
                onClick={() => setCurrentStep("confirmLogin")}
                disabled={selectedTools.length !== appCount}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                OK
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderConfirmLoginStep = () => (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Connect Your Apps</h2>
        <p className="text-gray-600">
          We'll now connect to your selected tools using secure authentication
        </p>
      </div>

      <div className="space-y-4">
        {selectedTools.map((toolId) => {
          const tool = availableTools.find(t => t.id === toolId)!;
          const Icon = tool.icon;
          const isCompleted = completedLogins.includes(toolId);
          
          return (
            <Card key={toolId}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${tool.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{tool.name}</h3>
                      <p className="text-sm text-gray-600">
                        {isCompleted ? 'Successfully connected' : 'Ready to connect'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {isCompleted ? (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Connected
                      </Badge>
                    ) : (
                      <Button
                        onClick={() => openCredentialDialog(toolId)}
                        disabled={isLoggingIn}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {isLoggingIn && currentToolForCredentials === toolId ? (
                          <>
                            <Clock className="w-4 h-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          'Connect'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                Connected: {completedLogins.length}/{selectedTools.length}
              </p>
              <p className="text-sm text-gray-600">
                {completedLogins.length === selectedTools.length 
                  ? "All apps connected! Ready to sync data." 
                  : "Connect all apps to proceed to data sync."
                }
              </p>
            </div>
            <div className="flex gap-4">
              <Button 
                variant="outline"
                onClick={() => setCurrentStep("toolSelection")}
                disabled={isLoggingIn}
              >
                Back
              </Button>
              <Button 
                onClick={() => {
                  setCurrentStep("syncProgress");
                  simulateDataSync();
                }}
                disabled={completedLogins.length !== selectedTools.length}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Start Data Sync
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSyncProgressStep = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
          <Database className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Data Sync in Progress</h2>
        <p className="text-gray-600">
          We're now syncing your data from all connected apps
        </p>
      </div>

      <Card>
        <CardContent className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Syncing with Airbyte...</span>
              <span className="text-sm text-gray-500">{Math.round(syncProgress)}%</span>
            </div>
            <Progress value={syncProgress} className="h-3" />
          </div>

          <div className="space-y-3">
            {selectedTools.map((toolId, index) => {
              const tool = availableTools.find(t => t.id === toolId)!;
              const Icon = tool.icon;
              const toolProgress = Math.max(0, Math.min(100, (syncProgress - (index * (100 / selectedTools.length))) * (selectedTools.length)));
              const isCompleted = toolProgress >= 100;
              
              return (
                <div key={toolId} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tool.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{tool.name}</span>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-blue-500 animate-spin" />
                      )}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {isCompleted ? 'Sync complete' : 'Syncing data...'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Setup Complete!</h2>
        <p className="text-gray-600">
          {companyName} is now connected and ready to analyze data from {selectedTools.length} apps
        </p>
      </div>

      <Card>
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold">What's Next?</h3>
            <div className="grid grid-cols-1 gap-4 text-left">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm">Your data is being processed and will be available shortly</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm">Analytics dashboards will auto-populate with your data</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm">You'll receive email updates on sync progress</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button 
              variant="outline"
              onClick={startFreshSetup}
              className="flex-1"
            >
              Start New Setup
            </Button>
            <Button 
              onClick={() => window.location.href = "/data-browser"}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              Browse Your Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">Setup & Configuration</h1>
          <div className="flex items-center space-x-2">
            <Badge variant="outline">
              Step {
                currentStep === "appCount" ? "1" :
                currentStep === "toolSelection" ? "2" :
                currentStep === "confirmLogin" ? "3" :
                currentStep === "syncProgress" ? "4" : "4"
              } of 4
            </Badge>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        {currentStep === "initial" && renderInitialStep()}
        {currentStep === "appCount" && renderAppCountStep()}
        {currentStep === "toolSelection" && renderToolSelectionStep()}
        {currentStep === "confirmLogin" && renderConfirmLoginStep()}
        {currentStep === "syncProgress" && renderSyncProgressStep()}
        {currentStep === "complete" && renderCompleteStep()}
      </main>
      
      {/* Credential Dialog */}
      <CredentialDialog
        open={credentialDialogOpen}
        onOpenChange={setCredentialDialogOpen}
        appId={currentToolForCredentials || ""}
        appName={currentToolForCredentials ? availableTools.find(t => t.id === currentToolForCredentials)?.name || "" : ""}
        onSubmit={handleCredentialSubmit}
      />
    </div>
  );
}
