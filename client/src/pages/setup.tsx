import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CredentialDialog } from "@/components/ui/credential-dialog";
import { CheckCircle, CheckCircle2, Clock, Settings, Database, Zap, Calendar, FileText, Users, DollarSign, Briefcase, Target, X, ChevronDown, ChevronRight, Plus } from "lucide-react";
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
    color: "#f97316",
    standardTables: ["time_entry", "project", "client", "invoice"],
    customCost: 25
  },
  {
    id: "salesforce", 
    name: "Salesforce",
    icon: Users,
    description: "Available data: Leads, Accounts, Opportunities, Contacts",
    color: "#3b82f6",
    standardTables: ["opportunity", "account", "contact", "lead"],
    customCost: 30
  },
  {
    id: "quickbooks",
    name: "QuickBooks", 
    icon: DollarSign,
    description: "Available data: Invoices, Expenses, Customers, Vendors",
    color: "#22c55e",
    standardTables: ["invoice", "customer", "item", "payment"],
    customCost: 25
  },
  {
    id: "netsuite",
    name: "NetSuite (Oracle)",
    icon: Database,
    description: "Available data: Financial records, Inventory, CRM", 
    color: "#a855f7",
    standardTables: ["transaction", "customer", "item", "vendor"],
    customCost: 35
  },
  {
    id: "asana",
    name: "Asana",
    icon: Target,
    description: "Available data: Tasks, Projects, Teams, Workspaces",
    color: "#ec4899",
    standardTables: ["task", "project", "user", "team"],
    customCost: 20
  },
  {
    id: "jira",
    name: "Jira", 
    icon: Briefcase,
    description: "Available data: Issues, Projects, Workflows, Reports",
    color: "#6366f1",
    standardTables: ["issue", "project", "user", "sprint"],
    customCost: 25
  },
];

// Standard setup table definitions
const standardTables = {
  salesforce: ["opportunity", "account", "contact", "lead"],
  hubspot: ["deal", "contact", "company", "ticket"],
  jira: ["issue", "project", "user", "sprint"],
  quickbooks: ["invoice", "customer", "item", "payment"],
  harvest: ["time_entry", "project", "client", "invoice"],
  asana: ["task", "project", "user", "team"],
  netsuite: ["transaction", "customer", "item", "vendor"]
};

// Available tables for custom setup with pricing
const availableTablesForCustom = {
  salesforce: [
    { name: "opportunity", label: "Opportunities", included: true, cost: 0 },
    { name: "account", label: "Accounts", included: true, cost: 0 },
    { name: "contact", label: "Contacts", included: true, cost: 0 },
    { name: "lead", label: "Leads", included: true, cost: 0 },
    { name: "campaign", label: "Campaigns", included: false, cost: 25 },
    { name: "case", label: "Cases", included: false, cost: 25 },
    { name: "task", label: "Tasks", included: false, cost: 20 },
    { name: "event", label: "Events", included: false, cost: 20 },
    { name: "product", label: "Products", included: false, cost: 30 },
  ],
  hubspot: [
    { name: "deal", label: "Deals", included: true, cost: 0 },
    { name: "contact", label: "Contacts", included: true, cost: 0 },
    { name: "company", label: "Companies", included: true, cost: 0 },
    { name: "ticket", label: "Tickets", included: true, cost: 0 },
    { name: "email", label: "Emails", included: false, cost: 25 },
    { name: "call", label: "Calls", included: false, cost: 25 },
    { name: "meeting", label: "Meetings", included: false, cost: 20 },
    { name: "note", label: "Notes", included: false, cost: 15 },
    { name: "product", label: "Products", included: false, cost: 30 },
  ],
  jira: [
    { name: "issue", label: "Issues", included: true, cost: 0 },
    { name: "project", label: "Projects", included: true, cost: 0 },
    { name: "user", label: "Users", included: true, cost: 0 },
    { name: "sprint", label: "Sprints", included: true, cost: 0 },
    { name: "worklog", label: "Work Logs", included: false, cost: 25 },
    { name: "comment", label: "Comments", included: false, cost: 20 },
    { name: "attachment", label: "Attachments", included: false, cost: 30 },
    { name: "component", label: "Components", included: false, cost: 15 },
  ],
  quickbooks: [
    { name: "invoice", label: "Invoices", included: true, cost: 0 },
    { name: "customer", label: "Customers", included: true, cost: 0 },
    { name: "item", label: "Items", included: true, cost: 0 },
    { name: "payment", label: "Payments", included: true, cost: 0 },
    { name: "expense", label: "Expenses", included: false, cost: 25 },
    { name: "bill", label: "Bills", included: false, cost: 25 },
    { name: "vendor", label: "Vendors", included: false, cost: 20 },
    { name: "employee", label: "Employees", included: false, cost: 30 },
  ],
  harvest: [
    { name: "time_entry", label: "Time Entries", included: true, cost: 0 },
    { name: "project", label: "Projects", included: true, cost: 0 },
    { name: "client", label: "Clients", included: true, cost: 0 },
    { name: "invoice", label: "Invoices", included: true, cost: 0 },
    { name: "expense", label: "Expenses", included: false, cost: 25 },
    { name: "task", label: "Tasks", included: false, cost: 20 },
    { name: "user", label: "Users", included: false, cost: 20 },
    { name: "estimate", label: "Estimates", included: false, cost: 30 },
  ],
  asana: [
    { name: "task", label: "Tasks", included: true, cost: 0 },
    { name: "project", label: "Projects", included: true, cost: 0 },
    { name: "user", label: "Users", included: true, cost: 0 },
    { name: "team", label: "Teams", included: true, cost: 0 },
    { name: "story", label: "Stories", included: false, cost: 20 },
    { name: "attachment", label: "Attachments", included: false, cost: 25 },
    { name: "tag", label: "Tags", included: false, cost: 15 },
    { name: "portfolio", label: "Portfolios", included: false, cost: 30 },
  ],
  netsuite: [
    { name: "transaction", label: "Transactions", included: true, cost: 0 },
    { name: "customer", label: "Customers", included: true, cost: 0 },
    { name: "item", label: "Items", included: true, cost: 0 },
    { name: "vendor", label: "Vendors", included: true, cost: 0 },
    { name: "employee", label: "Employees", included: false, cost: 30 },
    { name: "subsidiary", label: "Subsidiaries", included: false, cost: 35 },
    { name: "location", label: "Locations", included: false, cost: 20 },
    { name: "department", label: "Departments", included: false, cost: 25 },
  ],
};

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
  // Load saved state from localStorage or use defaults
  const loadSavedState = () => {
    const savedState = localStorage.getItem('setupState');
    if (savedState) {
      return JSON.parse(savedState);
    }
    return {
      currentStep: "appCount",
      appCount: null,
      selectedTools: [],
      syncProgress: 0,
      isLoggingIn: false,
      isSyncing: false,
      completedLogins: [],
      toolSetupTypes: {},
      customTables: {}
    };
  };

  const initialState = loadSavedState();

  // State management - pre-populate known company info
  const [currentStep, setCurrentStep] = useState<SetupStep>(initialState.currentStep);
  const [companyName] = useState("MIAS_DATA");
  const [industry] = useState("Technology");
  const [appCount, setAppCount] = useState<number | null>(initialState.appCount);
  const [selectedTools, setSelectedTools] = useState<string[]>(initialState.selectedTools);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [completedLogins, setCompletedLogins] = useState<string[]>(initialState.completedLogins);
  
  // Check for existing setup from localStorage or API
  const [hasExistingSetup, setHasExistingSetup] = useState(() => {
    const existingSetup = localStorage.getItem('setupCompleted');
    return existingSetup === 'true';
  });

  // Per-tool setup type state
  const [toolSetupTypes, setToolSetupTypes] = useState<{[toolId: string]: "standard" | "custom"}>(initialState.toolSetupTypes);
  const [customTables, setCustomTables] = useState<{[toolId: string]: string[]}>(initialState.customTables);

  // Dialog states
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [setupTypeDialogOpen, setSetupTypeDialogOpen] = useState(false);
  const [customTableDialogOpen, setCustomTableDialogOpen] = useState(false);
  const [currentToolForCredentials, setCurrentToolForCredentials] = useState<string | null>(null);
  const [currentToolForSetup, setCurrentToolForSetup] = useState<string | null>(null);
  const [currentToolForCustom, setCurrentToolForCustom] = useState<string | null>(null);
  
  // App expansion state for setup complete page
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  // Add table confirmation dialog
  const [addTableDialogOpen, setAddTableDialogOpen] = useState(false);
  const [pendingTableAdd, setPendingTableAdd] = useState<{toolId: string, table: any} | null>(null);

  const { toast } = useToast();

  // Save state to localStorage whenever relevant state changes
  const saveCurrentState = () => {
    const stateToSave = {
      currentStep,
      appCount,
      selectedTools,
      completedLogins,
      toolSetupTypes,
      customTables
    };
    localStorage.setItem('setupState', JSON.stringify(stateToSave));
  };

  // Save state whenever key values change
  useEffect(() => {
    saveCurrentState();
  }, [currentStep, appCount, selectedTools, completedLogins, toolSetupTypes, customTables]);

  // Handle tool selection
  const handleToolToggle = (toolId: string) => {
    setSelectedTools(prev => 
      prev.includes(toolId) 
        ? prev.filter(id => id !== toolId)
        : [...prev, toolId]
    );
  };

  // Handle credential submission for Python connector connection
  const handleCredentialSubmit = async (credentials: Record<string, string>) => {
    if (!currentToolForCredentials) return;

    setIsLoggingIn(true);
    try {
      // Call API to create Python connector connection
      const response = await fetch("/api/connectors/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connectorType: currentToolForCredentials,
          credentials: credentials,
          companyId: 1748544793859, // Using the company ID from CLAUDE.md
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create connection");
      }

      const result = await response.json();

      setCompletedLogins(prev => [...prev, currentToolForCredentials]);

      // Show appropriate message based on connection status
      const toolName = availableTools.find(t => t.id === currentToolForCredentials)?.name;
      const isAuthenticated = result.status === "authenticated";

      toast({
        title: isAuthenticated ? "Connection Ready" : "Connection Created",
        description: isAuthenticated 
          ? `${toolName} credentials validated and ready for sync`
          : `Successfully connected to ${toolName}`,
      });

      // Check if this tool has custom setup and open custom table selection
      const setupType = toolSetupTypes[currentToolForCredentials];
      if (setupType === "custom") {
        setCurrentToolForCustom(currentToolForCredentials);
        setCustomTableDialogOpen(true);
      }
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

  // Open setup type dialog for a specific tool
  const openSetupTypeDialog = (toolId: string) => {
    setCurrentToolForSetup(toolId);
    setSetupTypeDialogOpen(true);
  };

  // Handle setup type selection and proceed to credentials
  const handleSetupTypeSelection = (setupType: "standard" | "custom") => {
    if (!currentToolForSetup) return;
    
    setToolSetupTypes(prev => ({
      ...prev,
      [currentToolForSetup]: setupType
    }));
    
    setSetupTypeDialogOpen(false);
    setCurrentToolForCredentials(currentToolForSetup);
    setCredentialDialogOpen(true);
    setCurrentToolForSetup(null);
  };

  // Toggle app expansion
  const toggleAppExpansion = (toolId: string) => {
    setExpandedApps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolId)) {
        newSet.delete(toolId);
      } else {
        newSet.add(toolId);
      }
      return newSet;
    });
  };

  // Navigate to data browser with table filter
  const browseTableData = (toolId: string, tableName: string) => {
    // Navigate to data browser and filter by this table
    window.location.href = `/data-browser?table=${encodeURIComponent(tableName)}`;
  };

  // Add more tables to an existing connected app
  const addMoreTables = (toolId: string) => {
    setCurrentToolForCustom(toolId);
    setCustomTableDialogOpen(true);
  };

  // Show confirmation dialog for adding a single table
  const showAddTableConfirmation = (toolId: string, table: any) => {
    setPendingTableAdd({ toolId, table });
    setAddTableDialogOpen(true);
  };

  // Confirm and add the table
  const confirmAddTable = async () => {
    if (!pendingTableAdd) return;

    const { toolId, table } = pendingTableAdd;

    try {
      // Add table to custom tables
      setCustomTables(prev => {
        const currentTables = prev[toolId] || [];
        return {
          ...prev,
          [toolId]: [...currentTables, table.name]
        };
      });

      // Update setup type to custom if it wasn't already
      setToolSetupTypes(prev => ({
        ...prev,
        [toolId]: "custom"
      }));

      // Start sync for the new table (simulate API call)
      toast({
        title: "Table Added Successfully",
        description: `${table.label} has been added and sync has started. You'll be charged $${table.cost}/month.`,
      });

      // Close dialog and reset state
      setAddTableDialogOpen(false);
      setPendingTableAdd(null);

    } catch (error) {
      console.error("Failed to add table:", error);
      toast({
        title: "Failed to Add Table",
        description: "There was an error adding the table. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Real data sync process
  const realDataSync = async () => {
    setIsSyncing(true);
    setSyncProgress(0);

    const companyId = 1748544793859; // Using the company ID from CLAUDE.md
    let completedSyncs = 0;

    for (const tool of selectedTools) {
      try {
        setSyncProgress((completedSyncs / selectedTools.length) * 100);
        
        console.log(`Starting sync for ${tool}...`);
        
        // Call the Python connector sync API for each connected tool
        const syncResponse = await fetch(`/api/connectors/${companyId}/${tool}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (syncResponse.ok) {
          const syncResult = await syncResponse.json();
          console.log(`Sync completed for ${tool}:`, syncResult);
          
          toast({
            title: `${tool} Sync Complete`,
            description: `Successfully synced ${syncResult.records_synced || 0} records from ${tool}`,
          });
        } else {
          throw new Error(`Sync failed for ${tool}`);
        }
      } catch (error) {
        console.error(`Error syncing ${tool}:`, error);
        toast({
          title: `${tool} Sync Failed`,
          description: `Failed to sync data from ${tool}. Please try again.`,
          variant: "destructive",
        });
      }
      
      completedSyncs++;
      setSyncProgress((completedSyncs / selectedTools.length) * 100);
    }

    setIsSyncing(false);
    setCurrentStep("complete");
    
    // Save setup completion and details to localStorage
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('setupData', JSON.stringify({
      completedTools: selectedTools,
      toolSetupTypes,
      customTables,
      completedAt: new Date().toISOString()
    }));
    setHasExistingSetup(true);
  };

  // Check if setup has been completed previously
  const hasCompletedSetup = () => {
    // This could be enhanced to check API/localStorage for previous setup
    return completedLogins.length > 0 && currentStep === "initial";
  };

  // Start fresh setup
  const startFreshSetup = () => {
    setCurrentStep("appCount");
    setAppCount(null);
    setSelectedTools([]);
    setSyncProgress(0);
    setCompletedLogins([]);
    setToolSetupTypes({});
    setCustomTables({});
    localStorage.removeItem('setupCompleted');
    localStorage.removeItem('setupData');
    localStorage.removeItem('setupState');
    setHasExistingSetup(false);
  };

  // TEST FUNCTION: Create a completed setup for testing
  const createTestSetup = () => {
    const testTools = ["salesforce", "hubspot", "jira"];
    const testSetupTypes = {
      salesforce: "standard",
      hubspot: "custom", 
      jira: "standard"
    };
    const testCustomTables = {
      hubspot: ["email", "call", "meeting"]
    };

    // Set up the completed state
    setSelectedTools(testTools);
    setCompletedLogins(testTools);
    setToolSetupTypes(testSetupTypes);
    setCustomTables(testCustomTables);
    
    // Save to localStorage
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('setupData', JSON.stringify({
      completedTools: testTools,
      toolSetupTypes: testSetupTypes,
      customTables: testCustomTables,
      completedAt: new Date().toISOString()
    }));
    
    setHasExistingSetup(true);
    setCurrentStep("appCount"); // This will trigger the summary view
  };

  // Render setup summary for completed setups
  const renderSetupSummary = () => {
    const savedSetup = localStorage.getItem('setupData');
    if (!savedSetup) {
      return renderInitialStep(); // Fallback if no saved data
    }

    const setupData = JSON.parse(savedSetup);
    const { completedTools, toolSetupTypes, customTables } = setupData;

    // Calculate total cost
    const calculateTotalMonthlyCost = () => {
      let total = 0;
      completedTools.forEach((toolId: string) => {
        if (toolSetupTypes[toolId] === "custom") {
          const toolTables = availableTablesForCustom[toolId as keyof typeof availableTablesForCustom] || [];
          const selectedTables = customTables[toolId] || [];
          toolTables.forEach(table => {
            if (selectedTables.includes(table.name) && !table.included) {
              total += table.cost;
            }
          });
        }
      });
      return total;
    };

    const totalMonthlyCost = calculateTotalMonthlyCost();

    return (
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Compact Header */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Setup Complete</h2>
              <p className="text-sm text-gray-600">{completedTools.length} integrations active</p>
            </div>
          </div>
        </div>

        {/* Compact Stats & Integrations Combined */}
        <Card>
          <CardContent className="p-4">
            {/* Quick Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b">
              <div className="text-center">
                <div className="text-xl font-bold text-saulto-700">{completedTools.length}</div>
                <div className="text-xs text-gray-600">Apps</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-600">
                  {completedTools.filter((toolId: string) => toolSetupTypes[toolId] === "standard").length}
                </div>
                <div className="text-xs text-gray-600">Standard</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-600">${totalMonthlyCost}</div>
                <div className="text-xs text-gray-600">Monthly</div>
              </div>
            </div>

            {/* Compact Integration List */}
            <div className="space-y-2">
              {completedTools.map((toolId: string) => {
                const tool = availableTools.find(t => t.id === toolId)!;
                const Icon = tool.icon;
                const setupType = toolSetupTypes[toolId];
                const standardTablesList = standardTables[toolId as keyof typeof standardTables] || [];
                const customTablesList = customTables[toolId] || [];
                
                return (
                  <div key={toolId} className="flex items-center justify-between p-2 rounded-md bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center bg-gray-100">
                        <Icon className="w-4 h-4" style={{ color: tool.color }} />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm text-gray-900">{tool.name}</h4>
                        <div className="flex items-center space-x-2 text-xs text-gray-600">
                          <span>{standardTablesList.length + (customTablesList?.length || 0)} tables</span>
                          <span>•</span>
                          <Badge 
                            className={`text-xs px-1.5 py-0.5 ${setupType === "standard" 
                              ? "bg-green-100 text-green-700" 
                              : "bg-saulto-50 text-saulto-700"
                            }`}
                          >
                            {setupType === "standard" ? "Standard" : "Custom"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-green-600">Active</div>
                      <div className="text-xs text-gray-500">1hr ago</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Compact Action Buttons */}
        <div className="flex gap-3">
          <Button 
            variant="outline"
            onClick={startFreshSetup}
            size="sm"
            className="flex-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add More Apps
          </Button>
          <Button 
            onClick={() => window.location.href = "/data-browser"}
            size="sm"
            className="flex-1 bg-saulto-600 hover:bg-saulto-700 text-white"
          >
            Browse Your Data
          </Button>
        </div>
      </div>
    );
  };

  // Render functions for each step
  const renderInitialStep = () => (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-saulto-50 rounded-full flex items-center justify-center mx-auto">
          <Settings className="w-8 h-8 text-saulto-700" />
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
            className="w-full bg-saulto-600 hover:bg-saulto-700 text-white py-3 text-lg"
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
        <div className="w-16 h-16 bg-saulto-50 rounded-full flex items-center justify-center mx-auto">
          <Settings className="w-8 h-8 text-saulto-700" />
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

          <div className="space-y-3">
            <Button 
              onClick={() => setCurrentStep("toolSelection")}
              disabled={!appCount}
              className="w-full bg-saulto-600 hover:bg-saulto-700 text-white py-3 text-lg"
            >
              Continue to Tool Selection
            </Button>
            
            {/* TEST BUTTON - Remove in production */}
            <Button 
              onClick={createTestSetup}
              variant="outline"
              className="w-full text-sm"
            >
              🧪 Create Test Setup (for testing)
            </Button>
          </div>
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
                isSelected ? 'ring-2 ring-saulto-600 bg-saulto-50' : 'hover:shadow-lg'
              } ${selectedTools.length >= appCount! && !isSelected ? 'opacity-50' : ''}`}
              onClick={() => {
                if (selectedTools.length < appCount! || isSelected) {
                  handleToolToggle(tool.id);
                }
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-100">
                    <Icon className="w-6 h-6" style={{ color: tool.color }} />
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
                className="bg-saulto-600 hover:bg-saulto-700 text-white"
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
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-gray-100">
                      <Icon className="w-6 h-6" style={{ color: tool.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{tool.name}</h3>
                      <p className="text-sm text-gray-600">
                        {isCompleted ? (
                          <>
                            Successfully connected
                            {toolSetupTypes[toolId] && (
                              <span className="ml-2 text-xs">
                                ({toolSetupTypes[toolId] === "standard" ? "Standard" : "Custom"} Setup)
                              </span>
                            )}
                          </>
                        ) : (
                          'Ready to connect'
                        )}
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
                        onClick={() => openSetupTypeDialog(toolId)}
                        disabled={isLoggingIn}
                        className="bg-saulto-600 hover:bg-saulto-700 text-white"
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
                  realDataSync();
                }}
                disabled={completedLogins.length !== selectedTools.length}
                className="bg-saulto-600 hover:bg-saulto-700 text-white"
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
        <div className="w-16 h-16 bg-saulto-50 rounded-full flex items-center justify-center mx-auto">
          <Database className="w-8 h-8 text-saulto-700" />
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
              <span className="font-medium">Syncing with Python Connectors...</span>
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
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100">
                    <Icon className="w-4 h-4" style={{ color: tool.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{tool.name}</span>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-saulto-600 animate-spin" />
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

  const renderCompleteStep = () => {
    // Calculate total cost from all custom setups
    const calculateTotalMonthlyCost = () => {
      let total = 0;
      selectedTools.forEach(toolId => {
        if (toolSetupTypes[toolId] === "custom") {
          const toolTables = availableTablesForCustom[toolId as keyof typeof availableTablesForCustom] || [];
          const selectedTables = customTables[toolId] || [];
          toolTables.forEach(table => {
            if (selectedTables.includes(table.name) && !table.included) {
              total += table.cost;
            }
          });
        }
      });
      return total;
    };

    const totalMonthlyCost = calculateTotalMonthlyCost();

    return (
      <div className="space-y-4">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-3">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900">Setup Complete!</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Your data integration is configured and ready to use.
          </p>
        </div>

        <Card className="p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{selectedTools.length}</div>
                <div className="text-sm text-gray-600">Applications Connected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">
                  {selectedTools.reduce((total, toolId) => {
                    const setupType = toolSetupTypes[toolId] || "standard";
                    const standardTablesList = standardTables[toolId as keyof typeof standardTables] || [];
                    const customTablesList = customTables[toolId] || [];
                    return total + standardTablesList.length + (customTablesList?.length || 0);
                  }, 0)}
                </div>
                <div className="text-sm text-gray-600">Total Tables</div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Connected Integrations</h3>

              <div className="space-y-2">
                {selectedTools.map((toolId) => {
                  const tool = availableTools.find(t => t.id === toolId)!;
                  const setupType = toolSetupTypes[toolId] || "standard";
                  const standardTablesList = standardTables[toolId as keyof typeof standardTables] || [];
                  const customTablesList = customTables[toolId] || [];
                  const tablesList = setupType === "standard" ? standardTablesList : customTablesList;
                  const isExpanded = expandedApps.has(toolId);
                  const monthlyCost = setupType === "custom" && customTablesList.length > 0 ? (() => {
                    const toolTables = availableTablesForCustom[toolId as keyof typeof availableTablesForCustom] || [];
                    return toolTables.reduce((total, table) => {
                      if (customTablesList.includes(table.name) && !table.included) {
                        return total + table.cost;
                      }
                      return total;
                    }, 0);
                  })() : 0;

                  // Get all available tables for this tool with pricing
                  const allAvailableTables = availableTablesForCustom[toolId as keyof typeof availableTablesForCustom] || [];

                  return (
                    <div key={toolId} className="bg-gray-50 rounded-lg">
                      {/* Main app row - clickable */}
                      <div 
                        className="flex items-center space-x-3 p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleAppExpansion(toolId)}
                      >
                        <div className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-sm">
                          {React.createElement(tool.icon, { className: "w-4 h-4", style: { color: tool.color } })}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-gray-900">{tool.name}</h4>
                            <div className="flex items-center space-x-2">
                              <Badge variant={setupType === "standard" ? "secondary" : "default"} className="text-xs">
                                {setupType === "standard" ? "Free" : `$${monthlyCost}/mo`}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {tablesList.length} tables
                              </Badge>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-500" />
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">
                            {tablesList.slice(0, 3).join(", ")}
                            {tablesList.length > 3 && ` +${tablesList.length - 3} more`}
                          </p>
                        </div>
                      </div>

                      {/* Expanded table details */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 bg-white rounded-b-lg">
                          <div className="p-4">
                            <h5 className="font-medium text-gray-900 mb-3">Available Tables</h5>
                            
                            <div className="space-y-2">
                              {allAvailableTables.map((table) => {
                                const isConnected = tablesList.includes(table.name);
                                const tableCost = !table.included ? table.cost : 0;
                                
                                return (
                                  <div
                                    key={table.name}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-3">
                                        <span className="text-sm font-medium text-gray-900">
                                          {table.label}
                                        </span>
                                        <div className="flex items-center space-x-2">
                                          {tableCost > 0 ? (
                                            <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                              ${tableCost}/mo
                                            </Badge>
                                          ) : (
                                            <Badge className="bg-green-100 text-green-700 text-xs">
                                              FREE
                                            </Badge>
                                          )}
                                          {isConnected && (
                                            <Badge className="bg-saulto-50 text-saulto-700 text-xs">
                                              CONNECTED
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      {isConnected ? (
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            browseTableData(toolId, table.name);
                                          }}
                                          size="sm"
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          Browse Data
                                        </Button>
                                      ) : (
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            showAddTableConfirmation(toolId, table);
                                          }}
                                          size="sm"
                                          variant="default"
                                          className="text-xs bg-saulto-600 hover:bg-saulto-700 text-white"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add Table
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-center space-x-3">
          <Button
            onClick={startFreshSetup}
            variant="outline"
            size="sm"
            className="px-4"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add More Apps
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            size="sm"
            className="px-4"
          >
            Go to Dashboard
          </Button>
          <Button
            onClick={() => window.location.href = '/data-browser'}
            variant="outline"
            size="sm"
            className="px-4"
          >
            Browse Data
          </Button>
        </div>
      </div>
    );
  };

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
        {/* Show setup summary if setup is completed, otherwise show setup flow */}
        {hasExistingSetup && currentStep === "appCount" ? renderSetupSummary() : (
          <>
            {currentStep === "initial" && renderInitialStep()}
            {currentStep === "appCount" && renderAppCountStep()}
            {currentStep === "toolSelection" && renderToolSelectionStep()}
            {currentStep === "confirmLogin" && renderConfirmLoginStep()}
            {currentStep === "syncProgress" && renderSyncProgressStep()}
            {currentStep === "complete" && renderCompleteStep()}
          </>
        )}
      </main>

      {/* Setup Type Selection Dialog */}
      <Dialog open={setupTypeDialogOpen} onOpenChange={setSetupTypeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-center">
              Choose Setup Type for {currentToolForSetup ? availableTools.find(t => t.id === currentToolForSetup)?.name : ""}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Standard Setup Option */}
            <Card 
              className="cursor-pointer transition-all hover:shadow-lg hover:ring-2 hover:ring-saulto-600"
              onClick={() => handleSetupTypeSelection("standard")}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Standard Setup</h3>
                    <p className="text-gray-600 mt-2">Essential tables for most business needs</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="font-medium text-gray-900">Monthly Cost</span>
                      <span className="text-2xl font-bold text-green-600">FREE</span>
                    </div>
                    
                    {currentToolForSetup && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-900">Included Tables:</h4>
                        <div className="text-sm text-gray-700">
                          {(standardTables[currentToolForSetup as keyof typeof standardTables] || []).join(", ")}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <h4 className="font-medium text-gray-900 text-sm">Benefits:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• Core business data</li>
                        <li>• Fast setup & sync</li>
                        <li>• No extra costs</li>
                        <li>• Perfect for most needs</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Custom Setup Option */}
            <Card 
              className="cursor-pointer transition-all hover:shadow-lg hover:ring-2 hover:ring-saulto-600"
              onClick={() => handleSetupTypeSelection("custom")}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-saulto-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Settings className="w-8 h-8 text-saulto-700" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Custom Setup</h3>
                    <p className="text-gray-600 mt-2">Standard tables + additional premium data</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <span className="font-medium text-gray-900">Additional Tables</span>
                      <span className="text-lg font-semibold text-yellow-600">$15-35/month each</span>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="font-medium text-gray-900 text-sm">Includes:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• All standard tables (FREE)</li>
                        <li>• Additional data tables</li>
                        <li>• Advanced reporting</li>
                        <li>• Detailed insights</li>
                      </ul>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <DollarSign className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <h5 className="font-medium text-orange-800 text-sm">Cost Notice</h5>
                          <p className="text-xs text-orange-700 mt-1">
                            Each additional table beyond standard will add monthly charges.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Table Selection Dialog */}
      <Dialog open={customTableDialogOpen} onOpenChange={setCustomTableDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Customize Tables for {currentToolForCustom ? availableTools.find(t => t.id === currentToolForCustom)?.name : ""}
            </DialogTitle>
          </DialogHeader>
          
          {currentToolForCustom && (
            <div className="space-y-6 mt-6">
              {/* Cost Summary */}
              <Card className="bg-saulto-50 border-saulto-100">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-saulto-800">Monthly Cost</h3>
                      <p className="text-sm text-saulto-700">Additional tables beyond standard</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-saulto-800">
                        ${(() => {
                          const toolTables = availableTablesForCustom[currentToolForCustom as keyof typeof availableTablesForCustom] || [];
                          const selectedTables = customTables[currentToolForCustom] || [];
                          return toolTables.reduce((total, table) => {
                            if (selectedTables.includes(table.name) && !table.included) {
                              return total + table.cost;
                            }
                            return total;
                          }, 0);
                        })()}/month
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Table Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(availableTablesForCustom[currentToolForCustom as keyof typeof availableTablesForCustom] || []).map((table) => {
                  const isSelected = (customTables[currentToolForCustom] || []).includes(table.name);
                  const isIncluded = table.included;

                  return (
                    <div
                      key={table.name}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        isIncluded 
                          ? 'bg-green-50 border-green-200 cursor-default' 
                          : isSelected 
                            ? 'bg-saulto-50 border-saulto-100 ring-1 ring-saulto-600'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        if (!isIncluded) {
                          setCustomTables(prev => {
                            const currentTables = prev[currentToolForCustom] || [];
                            if (currentTables.includes(table.name)) {
                              return {
                                ...prev,
                                [currentToolForCustom]: currentTables.filter(t => t !== table.name)
                              };
                            } else {
                              return {
                                ...prev,
                                [currentToolForCustom]: [...currentTables, table.name]
                              };
                            }
                          });
                        }
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          checked={isIncluded || isSelected}
                          disabled={isIncluded}
                          readOnly 
                        />
                        <div className="flex-1">
                          <span className="font-medium text-gray-900">
                            {table.label}
                          </span>
                          <div className="mt-1">
                            {isIncluded ? (
                              <Badge className="bg-green-100 text-green-700 text-xs">
                                INCLUDED
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                ${table.cost}/month
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setCustomTableDialogOpen(false)}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Table Confirmation Dialog */}
      <Dialog open={addTableDialogOpen} onOpenChange={setAddTableDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Premium Table</DialogTitle>
          </DialogHeader>
          
          {pendingTableAdd && (
            <div className="space-y-4 mt-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <DollarSign className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Additional Cost</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Adding <strong>{pendingTableAdd.table.label}</strong> will increase your monthly cost by <strong>${pendingTableAdd.table.cost}/month</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-saulto-50 border border-saulto-100 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Database className="w-5 h-5 text-saulto-700 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-saulto-800">What happens next?</h4>
                    <ul className="text-sm text-saulto-700 mt-1 space-y-1">
                      <li>• Table sync will start immediately</li>
                      <li>• Data will be available in the browser</li>
                      <li>• Billing starts with next cycle</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setAddTableDialogOpen(false)}
                  size="sm"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={confirmAddTable}
                  size="sm"
                  className="bg-saulto-600 hover:bg-saulto-700 text-white"
                >
                  Add Table (${pendingTableAdd.table.cost}/mo)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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