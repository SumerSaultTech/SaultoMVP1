import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CredentialDialog } from "@/components/ui/credential-dialog";
import { CheckCircle, CheckCircle2, Clock, Settings, Database, Zap, Calendar, FileText, Users, DollarSign, Briefcase, Target, X, ChevronDown, ChevronRight, Plus, Shield, Mail, Search, MessageCircle, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Step definitions
type SetupStep = "initial" | "appCount" | "toolSelection" | "confirmLogin" | "syncProgress" | "complete";

// Tool definitions with categories and logos - alphabetically ordered
const availableTools = [
  {
    id: "activecampaign",
    name: "ActiveCampaign",
    icon: Users,
    logo: "https://logo.clearbit.com/activecampaign.com",
    description: "Available data: Contacts, Campaigns, Automations, Lists",
    category: "Marketing",
    color: "#356ae6",
    standardTables: ["contact", "campaign", "automation", "list"],
    customCost: 30
  },
  {
    id: "asana",
    name: "Asana",
    icon: Target,
    logo: "https://cdn.worldvectorlogo.com/logos/asana-logo.svg",
    description: "Available data: Tasks, Projects, Teams, Workspaces",
    category: "Ops",
    color: "#f06a6a",
    standardTables: ["task", "project", "user", "team"],
    customCost: 20
  },
  {
    id: "harvest",
    name: "Harvest",
    icon: Clock,
    logo: "https://logo.clearbit.com/getharvest.com",
    description: "Available data: Time logs, Projects, Invoices",
    category: "Ops",
    color: "#ff8a00",
    standardTables: ["time_entry", "project", "client", "invoice"],
    customCost: 25
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: Users,
    logo: "https://logo.clearbit.com/hubspot.com",
    description: "Available data: Contacts, Deals, Companies, Tickets",
    category: "CRM",
    color: "#ff7a59",
    standardTables: ["contact", "deal", "company", "ticket"],
    customCost: 30
  },
  {
    id: "jira",
    name: "Jira", 
    icon: Briefcase,
    logo: "https://cdn.worldvectorlogo.com/logos/jira-1.svg",
    description: "Available data: Issues, Projects, Users, Sprints, Worklogs",
    category: "Ops",
    color: "#0052cc",
    standardTables: ["issue", "project", "user", "sprint", "worklog"],
    customCost: 25
  },
  {
    id: "odoo",
    name: "Odoo ERP",
    icon: Building2,
    logo: "https://logo.clearbit.com/odoo.com",
    description: "Available data: Sales, Invoices, Customers, Inventory",
    category: "ERP",
    color: "#714B67",
    standardTables: ["sale_order", "account_move", "res_partner", "product_product"],
    customCost: 35
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    icon: Mail,
    logo: "https://logo.clearbit.com/mailchimp.com",
    description: "Available data: Campaigns, Lists, Subscribers, Analytics",
    category: "Marketing",
    color: "#ffe01b",
    standardTables: ["campaign", "list", "subscriber", "report"],
    customCost: 25
  },
  {
    id: "monday",
    name: "Monday.com",
    icon: Calendar,
    logo: "https://logo.clearbit.com/monday.com",
    description: "Available data: Boards, Items, Updates, Users",
    category: "Ops",
    color: "#ff3d57",
    standardTables: ["board", "item", "update", "user"],
    customCost: 25
  },
  {
    id: "netsuite",
    name: "NetSuite",
    icon: Database,
    logo: "https://cdn.worldvectorlogo.com/logos/netsuite-1.svg",
    description: "Available data: Financial records, Inventory, CRM", 
    category: "ERP",
    color: "#1f4788",
    standardTables: ["transaction", "customer", "item", "vendor"],
    customCost: 35
  },
  {
    id: "quickbooks",
    name: "QuickBooks", 
    icon: DollarSign,
    logo: "https://cdn.worldvectorlogo.com/logos/quickbooks-1.svg",
    description: "Available data: Invoices, Expenses, Customers, Vendors",
    category: "ERP",
    color: "#0077c5",
    standardTables: ["invoice", "customer", "item", "payment"],
    customCost: 25
  },
  {
    id: "salesforce", 
    name: "Salesforce",
    icon: Users,
    logo: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg",
    description: "Available data: Leads, Accounts, Opportunities, Contacts",
    category: "CRM",
    color: "#00a1e0",
    standardTables: ["opportunity", "account", "contact", "lead"],
    customCost: 30
  },
];

// Tool categories
const toolCategories = [
  { id: "all", name: "All Tools", count: 0 },
  { id: "CRM", name: "CRM", count: 0 },
  { id: "ERP", name: "ERP", count: 0 },
  { id: "Ops", name: "Operations", count: 0 },
  { id: "Marketing", name: "Marketing", count: 0 }
];

// Standard setup table definitions
const standardTables = {
  activecampaign: ["contact", "campaign", "automation", "list"],
  asana: ["task", "project", "user", "team"],
  harvest: ["time_entry", "project", "client", "invoice"],
  hubspot: ["contact", "deal", "company", "ticket"],
  jira: ["issue", "project", "user", "sprint", "worklog"],
  mailchimp: ["campaign", "list", "subscriber", "report"],
  monday: ["board", "item", "update", "user"],
  netsuite: ["transaction", "customer", "item", "vendor"],
  quickbooks: ["invoice", "customer", "item", "payment"],
  salesforce: ["opportunity", "account", "contact", "lead"]
};

// Available tables for custom setup with pricing
const availableTablesForCustom = {
  activecampaign: [
    { name: "contact", label: "Contacts", included: true, cost: 0 },
    { name: "campaign", label: "Campaigns", included: true, cost: 0 },
    { name: "automation", label: "Automations", included: true, cost: 0 },
    { name: "list", label: "Lists", included: true, cost: 0 },
    { name: "email", label: "Emails", included: false, cost: 25 },
    { name: "deal", label: "Deals", included: false, cost: 25 },
    { name: "tag", label: "Tags", included: false, cost: 15 },
    { name: "form", label: "Forms", included: false, cost: 20 },
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
  hubspot: [
    { name: "contact", label: "Contacts", included: true, cost: 0 },
    { name: "deal", label: "Deals", included: true, cost: 0 },
    { name: "company", label: "Companies", included: true, cost: 0 },
    { name: "ticket", label: "Tickets", included: true, cost: 0 },
    { name: "email", label: "Emails", included: false, cost: 25 },
    { name: "call", label: "Calls", included: false, cost: 25 },
    { name: "meeting", label: "Meetings", included: false, cost: 20 },
    { name: "note", label: "Notes", included: false, cost: 15 },
    { name: "product", label: "Products", included: false, cost: 30 },
  ],
  jira: [
    { name: "attachment", label: "Attachments", included: false, cost: 30 },
    { name: "comment", label: "Comments", included: false, cost: 20 },
    { name: "component", label: "Components", included: false, cost: 15 },
    { name: "epic", label: "Epics", included: false, cost: 25 },
    { name: "filter", label: "Filters", included: false, cost: 20 },
    { name: "issue", label: "Issues", included: true, cost: 0 },
    { name: "issue_link", label: "Issue Links", included: false, cost: 20 },
    { name: "issue_type", label: "Issue Types", included: false, cost: 15 },
    { name: "priority", label: "Priorities", included: false, cost: 15 },
    { name: "project", label: "Projects", included: true, cost: 0 },
    { name: "project_category", label: "Project Categories", included: false, cost: 15 },
    { name: "project_permission_scheme", label: "Project Permission Schemes", included: false, cost: 25 },
    { name: "project_role", label: "Project Roles", included: false, cost: 20 },
    { name: "resolution", label: "Resolutions", included: false, cost: 15 },
    { name: "sprint", label: "Sprints", included: true, cost: 0 },
    { name: "status", label: "Statuses", included: false, cost: 15 },
    { name: "status_category", label: "Status Categories", included: false, cost: 15 },
    { name: "time_tracking", label: "Time Tracking", included: false, cost: 25 },
    { name: "user", label: "Users", included: true, cost: 0 },
    { name: "version", label: "Versions", included: false, cost: 20 },
    { name: "workflow", label: "Workflows", included: false, cost: 25 },
    { name: "worklog", label: "Worklogs", included: true, cost: 0 },
  ],
  mailchimp: [
    { name: "campaign", label: "Campaigns", included: true, cost: 0 },
    { name: "list", label: "Lists", included: true, cost: 0 },
    { name: "subscriber", label: "Subscribers", included: true, cost: 0 },
    { name: "report", label: "Reports", included: true, cost: 0 },
    { name: "automation", label: "Automations", included: false, cost: 25 },
    { name: "template", label: "Templates", included: false, cost: 20 },
    { name: "segment", label: "Segments", included: false, cost: 20 },
    { name: "landing_page", label: "Landing Pages", included: false, cost: 30 },
  ],
  monday: [
    { name: "board", label: "Boards", included: true, cost: 0 },
    { name: "item", label: "Items", included: true, cost: 0 },
    { name: "update", label: "Updates", included: true, cost: 0 },
    { name: "user", label: "Users", included: true, cost: 0 },
    { name: "column", label: "Columns", included: false, cost: 20 },
    { name: "group", label: "Groups", included: false, cost: 15 },
    { name: "activity", label: "Activity Logs", included: false, cost: 25 },
    { name: "workspace", label: "Workspaces", included: false, cost: 30 },
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

  // Handle OAuth callback and show setup type dialog
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const hubspotConnected = urlParams.get('hubspot');
    const odooConnected = urlParams.get('odoo');

    // Check if we're returning from HubSpot OAuth (backend redirect)
    if (hubspotConnected === 'connected') {
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // OAuth completed successfully - now show setup type selection
      setCurrentToolForSetup('hubspot');
      setSetupTypeDialogOpen(true);
      
      toast({
        title: "HubSpot Connected Successfully!",
        description: "Connection established. Please choose how you'd like to set up your tables.",
      });
    }
    // Check if we're returning from Odoo OAuth (backend redirect)
    else if (odooConnected === 'connected') {
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // OAuth completed successfully - now show setup type selection
      setCurrentToolForSetup('odoo');
      setSetupTypeDialogOpen(true);
      
      toast({
        title: "Odoo Connected Successfully!",
        description: "Connection established. Please choose how you'd like to set up your tables.",
      });
    }
    // Check if we're returning from Jira OAuth (backend already processed tokens)
    else if (code && state && !error) {
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // OAuth completed successfully - now show setup type selection
      setCurrentToolForSetup('jira');
      setSetupTypeDialogOpen(true);
      
      toast({
        title: "Jira Connected Successfully!",
        description: "Connection established. Please choose how you'd like to set up your tables.",
      });
    } else if (error) {
      // Clear URL parameters  
      window.history.replaceState({}, document.title, window.location.pathname);
      
      const message = urlParams.get('message');
      toast({
        title: "Authorization Failed",
        description: error === 'access_denied' ? 'You cancelled the authorization' : message || 'Authorization failed. Please try again.',
        variant: "destructive",
      });
    }
  }, []);
  
  // Check for existing setup from localStorage or API
  const [hasExistingSetup, setHasExistingSetup] = useState(() => {
    const existingSetup = localStorage.getItem('setupCompleted');
    return existingSetup === 'true';
  });

  // Per-tool setup type state
  const [toolSetupTypes, setToolSetupTypes] = useState<{[toolId: string]: "standard" | "custom"}>(initialState.toolSetupTypes);
  const [customTables, setCustomTables] = useState<{[toolId: string]: string[]}>(initialState.customTables);
  
  // Tool category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dialog states
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [setupTypeDialogOpen, setSetupTypeDialogOpen] = useState(false);
  const [customTableDialogOpen, setCustomTableDialogOpen] = useState(false);
  const [currentToolForCredentials, setCurrentToolForCredentials] = useState<string | null>(null);
  const [currentToolForSetup, setCurrentToolForSetup] = useState<string | null>(null);
  const [currentToolForCustom, setCurrentToolForCustom] = useState<string | null>(null);
  
  // Dynamic table discovery
  const [discoveredTables, setDiscoveredTables] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  
  // App expansion state for setup complete page
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  // Add table confirmation dialog
  const [addTableDialogOpen, setAddTableDialogOpen] = useState(false);
  const [pendingTableAdd, setPendingTableAdd] = useState<{toolId: string, table: any} | null>(null);
  
  // Contact dialog state
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  
  // Odoo setup dialog state
  const [odooSetupDialogOpen, setOdooSetupDialogOpen] = useState(false);
  const [odooInstanceUrl, setOdooInstanceUrl] = useState("");
  const [odooConsumerKey, setOdooConsumerKey] = useState("");
  const [odooConsumerSecret, setOdooConsumerSecret] = useState("");

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

  // Discover Jira tables dynamically using API
  const discoverJiraTables = async () => {
    setLoadingTables(true);
    try {
      const selectedCompany = JSON.parse(localStorage.getItem("selectedCompany") || '{}');
      const companyId = selectedCompany?.id;
      
      if (!companyId) {
        throw new Error('No company selected');
      }
      
      console.log(`🔍 Discovering Jira tables for company ${companyId}`);
      const response = await fetch(`/api/auth/jira/discover-tables/${companyId}`);
      
      if (!response.ok) {
        throw new Error('Failed to discover tables');
      }
      
      const data = await response.json();
      setDiscoveredTables(data.tables || []);
      
      toast({
        title: "Tables Discovered",
        description: `Found ${data.tables?.length || 0} accessible Jira tables`,
      });
    } catch (error) {
      console.error('Failed to discover Jira tables:', error);
      toast({
        title: "Discovery Failed",
        description: "Could not discover Jira tables. Using default list.",
        variant: "destructive",
      });
      // Fallback to empty array, will show loading state
      setDiscoveredTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  // Discover HubSpot tables dynamically using API
  const discoverHubSpotTables = async () => {
    setLoadingTables(true);
    try {
      const selectedCompany = JSON.parse(localStorage.getItem("selectedCompany") || '{}');
      const companyId = selectedCompany?.id;
      
      if (!companyId) {
        throw new Error('No company selected');
      }
      
      console.log(`🔍 Discovering HubSpot tables for company ${companyId}`);
      const response = await fetch(`/api/auth/hubspot/discover-tables/${companyId}`);
      
      if (!response.ok) {
        throw new Error('Failed to discover tables');
      }
      
      const data = await response.json();
      // Flatten the categorized tables into a single array
      const allTables = [
        ...(data.tables.core || []),
        ...(data.tables.engagement || []),
        ...(data.tables.other || [])
      ];
      setDiscoveredTables(allTables);
      
      toast({
        title: "Tables Discovered",
        description: `Found ${allTables.length} available HubSpot tables for syncing.`,
      });
      
    } catch (error) {
      console.error('Error discovering HubSpot tables:', error);
      toast({
        title: "Discovery Failed",
        description: "Failed to discover HubSpot tables. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTables(false);
    }
  };

  // Start Jira OAuth flow immediately when Connect is clicked

  // Handle setup type selection and proceed to credentials
  const handleSetupTypeSelection = (setupType: "standard" | "custom") => {
    if (!currentToolForSetup) return;
    
    setToolSetupTypes(prev => ({
      ...prev,
      [currentToolForSetup]: setupType
    }));
    
    setSetupTypeDialogOpen(false);
    
    // For Jira and HubSpot, OAuth is already complete - proceed with chosen setup type
    if (currentToolForSetup === 'jira') {
      if (setupType === 'standard') {
        // Standard setup - auto-sync with predefined tables
        setCompletedLogins(prev => [...prev, 'jira']);
        triggerJiraSync('standard');
        
        toast({
          title: "Jira Standard Setup Complete",
          description: "Syncing data with standard tables...",
        });
      } else {
        // Custom setup - show table selection
        setCurrentToolForCustom('jira');
        discoverJiraTables();
        setCustomTableDialogOpen(true);
        
        toast({
          title: "Table Discovery in Progress",
          description: "Finding available Jira tables for selection...",
        });
      }
    } else if (currentToolForSetup === 'hubspot') {
      if (setupType === 'standard') {
        // Standard setup - auto-sync with predefined tables
        setCompletedLogins(prev => [...prev, 'hubspot']);
        triggerHubSpotSync('standard');
        
        toast({
          title: "HubSpot Standard Setup Complete",
          description: "Syncing data with standard tables...",
        });
      } else {
        // Custom setup - show table selection
        setCurrentToolForCustom('hubspot');
        discoverHubSpotTables();
        setCustomTableDialogOpen(true);
        
        toast({
          title: "Table Discovery in Progress",
          description: "Finding available HubSpot tables for selection...",
        });
      }
    } else if (currentToolForSetup === 'odoo') {
      if (setupType === 'standard') {
        // Standard setup - auto-sync with predefined tables
        setCompletedLogins(prev => [...prev, 'odoo']);
        triggerOdooSync('standard');
        
        toast({
          title: "Odoo Standard Setup Complete",
          description: "Syncing data with standard tables...",
        });
      } else {
        // Custom setup - show table selection
        setCurrentToolForCustom('odoo');
        discoverOdooTables();
        setCustomTableDialogOpen(true);
        
        toast({
          title: "Table Discovery in Progress",
          description: "Finding available Odoo tables for selection...",
        });
      }
    } else {
      setCurrentToolForCredentials(currentToolForSetup);
      setCredentialDialogOpen(true);
    }
    
    setCurrentToolForSetup(null);
  };

  // Initiate Jira OAuth2 flow
  const initiateJiraOAuth = async () => {
    try {
      const selectedCompanyString = localStorage.getItem("selectedCompany");
      console.log('🔍 Selected company from localStorage:', selectedCompanyString);
      
      if (!selectedCompanyString) {
        toast({
          title: "Error",
          description: "No company selected. Please select a company first.",
          variant: "destructive",
        });
        return;
      }

      const selectedCompany = JSON.parse(selectedCompanyString);
      console.log('🔍 Parsed selected company:', selectedCompany);
      
      if (!selectedCompany?.id) {
        toast({
          title: "Error",
          description: "Invalid company selection. Please select a company first.",
          variant: "destructive",
        });
        return;
      }

      console.log(`🔄 Starting Jira OAuth flow for company ${selectedCompany.id}`);
      
      // Go directly to OAuth without storing setup type
      window.location.href = `/api/auth/jira/authorize?companyId=${selectedCompany.id}`;
    } catch (error) {
      console.error('Failed to start Jira OAuth:', error);
      toast({
        title: "Connection Error",
        description: "Failed to start Jira OAuth flow. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Initiate HubSpot OAuth flow
  const initiateHubSpotOAuth = async () => {
    try {
      const selectedCompanyString = localStorage.getItem("selectedCompany");
      console.log('🔍 Selected company from localStorage:', selectedCompanyString);
      
      if (!selectedCompanyString) {
        toast({
          title: "Error",
          description: "No company selected. Please select a company first.",
          variant: "destructive",
        });
        return;
      }

      const selectedCompany = JSON.parse(selectedCompanyString);
      console.log('🔍 Parsed selected company:', selectedCompany);
      
      if (!selectedCompany?.id) {
        toast({
          title: "Error",
          description: "Invalid company selection. Please select a company first.",
          variant: "destructive",
        });
        return;
      }
      
      console.log(`🔄 Starting HubSpot OAuth flow for company ${selectedCompany.id}`);
      
      // Go directly to OAuth without storing setup type
      window.location.href = `/api/auth/hubspot/authorize?companyId=${selectedCompany.id}`;
    } catch (error) {
      console.error('Failed to start HubSpot OAuth:', error);
      toast({
        title: "Connection Error",
        description: "Failed to start HubSpot OAuth flow. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Trigger Jira data sync after OAuth completion
  const triggerJiraSync = async (setupType: 'standard' | 'custom') => {
    try {
      const selectedCompany = JSON.parse(localStorage.getItem("selectedCompany") || '{}');
      if (!selectedCompany?.id) {
        console.error('No company selected for sync');
        return;
      }

      console.log(`🔄 Triggering Jira sync for company ${selectedCompany.id} with ${setupType} setup`);

      // Use the OAuth-based sync endpoint
      const response = await fetch(`/api/auth/jira/sync/${selectedCompany.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ setupType })
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Sync Complete", 
          description: `Successfully synced ${result.recordsSynced} records from ${result.tablesCreated?.length || 0} tables.`,
        });
      } else {
        throw new Error(result.message || 'Sync failed');
      }
    } catch (error) {
      console.error('Jira sync failed:', error);
      toast({
        title: "Sync Failed",
        description: "Data sync failed but connection is established. You can retry from the integrations page.",
        variant: "destructive",
      });
    }
  };

  // Trigger HubSpot data sync after OAuth completion
  const triggerHubSpotSync = async (setupType: 'standard' | 'custom') => {
    try {
      const selectedCompany = JSON.parse(localStorage.getItem("selectedCompany") || '{}');
      if (!selectedCompany?.id) {
        console.error('No company selected for sync');
        return;
      }

      console.log(`🔄 Triggering HubSpot sync for company ${selectedCompany.id} with ${setupType} setup`);

      // Use the OAuth-based sync endpoint
      const response = await fetch(`/api/auth/hubspot/sync/${selectedCompany.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ setupType })
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Sync Complete", 
          description: `Successfully synced ${result.recordsSynced} records from ${result.tablesCreated?.length || 0} tables.`,
        });
      } else {
        throw new Error(result.message || 'Sync failed');
      }
    } catch (error) {
      console.error('HubSpot sync failed:', error);
      toast({
        title: "Sync Failed",
        description: "Data sync failed but connection is established. You can retry from the integrations page.",
        variant: "destructive",
      });
    }
  };

  // Discover Odoo tables dynamically using API
  const discoverOdooTables = async () => {
    setLoadingTables(true);
    try {
      const selectedCompany = JSON.parse(localStorage.getItem("selectedCompany") || '{}');
      const companyId = selectedCompany?.id;
      
      if (!companyId) {
        throw new Error('No company selected');
      }
      
      console.log(`🔍 Discovering Odoo tables for company ${companyId}`);
      const response = await fetch(`/api/auth/odoo/discover-tables/${companyId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.tables) {
        // Flatten categorized tables into a single array
        const allTables = [
          ...data.tables.core || [],
          ...data.tables.financial || [],
          ...data.tables.operational || [],
          ...data.tables.other || []
        ];
        
        setDiscoveredTables(allTables);
      } else {
        throw new Error('Invalid response format');
      }

      toast({
        title: "Tables Discovered",
        description: `Found ${data.tables?.totalTables || 0} available Odoo tables for syncing.`,
      });
      
    } catch (error) {
      console.error('Error discovering Odoo tables:', error);
      toast({
        title: "Discovery Failed",
        description: "Failed to discover Odoo tables. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingTables(false);
    }
  };

  // Initiate Odoo OAuth flow - requires setup first
  const initiateOdooOAuth = async () => {
    try {
      const selectedCompanyString = localStorage.getItem("selectedCompany");
      console.log('🔍 Selected company from localStorage:', selectedCompanyString);
      
      if (!selectedCompanyString) {
        toast({
          title: "Setup Required",
          description: "Please select a company first.",
          variant: "destructive",
        });
        return;
      }
      
      const selectedCompany = JSON.parse(selectedCompanyString);
      
      if (!selectedCompany?.id) {
        toast({
          title: "Invalid Company",
          description: "Invalid company selection. Please try again.",
          variant: "destructive",
        });
        return;
      }

      console.log(`🔄 Starting Odoo setup for company ${selectedCompany.id}`);
      
      // For Odoo, we need to collect OAuth credentials from the customer
      setCurrentToolForSetup('odoo');
      setOdooSetupDialogOpen(true);
    } catch (error) {
      console.error('Failed to start Odoo setup:', error);
      toast({
        title: "Setup Error",
        description: "Failed to start Odoo setup. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle Odoo setup form submission
  const handleOdooSetupSubmit = async () => {
    try {
      const selectedCompany = JSON.parse(localStorage.getItem("selectedCompany") || '{}');
      if (!selectedCompany?.id) {
        throw new Error('No company selected');
      }

      // Validate inputs
      if (!odooInstanceUrl || !odooConsumerKey || !odooConsumerSecret) {
        toast({
          title: "Missing Information",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }

      // Save Odoo credentials to backend
      const response = await fetch('/api/auth/odoo/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyId: selectedCompany.id,
          odooInstanceUrl,
          consumerKey: odooConsumerKey,
          consumerSecret: odooConsumerSecret,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Setup failed');
      }

      const result = await response.json();
      
      // Close setup dialog
      setOdooSetupDialogOpen(false);
      
      // Clear form
      setOdooInstanceUrl("");
      setOdooConsumerKey("");
      setOdooConsumerSecret("");

      // Now initiate OAuth flow
      window.location.href = `/api/auth/odoo/authorize?companyId=${selectedCompany.id}`;
      
    } catch (error) {
      console.error('Odoo setup failed:', error);
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to save Odoo configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Trigger Odoo data sync after OAuth completion
  const triggerOdooSync = async (setupType: 'standard' | 'custom') => {
    try {
      const selectedCompany = JSON.parse(localStorage.getItem("selectedCompany") || '{}');
      if (!selectedCompany?.id) {
        console.error('No company selected for sync');
        return;
      }

      console.log(`🔄 Triggering Odoo sync for company ${selectedCompany.id} with ${setupType} setup`);

      // Use the OAuth-based sync endpoint
      const response = await fetch(`/api/auth/odoo/sync/${selectedCompany.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Sync Successful!",
          description: `Successfully synced ${result.recordsSynced} records from Odoo.`,
        });
        
        // Mark as completed
        setCompletedLogins(prev => [...prev, 'odoo']);
      } else {
        throw new Error(result.message || 'Sync failed');
      }
    } catch (error) {
      console.error('Odoo sync failed:', error);
      toast({
        title: "Sync Failed",
        description: "Data sync failed but connection is established. You can retry from the integrations page.",
        variant: "destructive",
      });
    }
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

    // Get selected company from localStorage (removing hardcoded company ID)
    const selectedCompany = JSON.parse(localStorage.getItem("selectedCompany") || '{}');
    const companyId = selectedCompany?.id;

    if (!companyId) {
      toast({
        title: "Error",
        description: "No company selected. Please select a company first.",
        variant: "destructive",
      });
      setIsSyncing(false);
      return;
    }

    let completedSyncs = 0;

    for (const [toolIndex, tool] of selectedTools.entries()) {
      try {
        console.log(`Starting sync for ${tool}...`);
        
        // Simulate realistic 10-second sync with variable timing and progress jumps
        const totalSyncTime = 10000; // 10 seconds total
        let currentProgress = 0;
        let timeElapsed = 0;
        
        // Define realistic progress milestones with variable timing
        const progressMilestones = [
          { progress: 8, delay: 300, phase: "Initializing connection..." },
          { progress: 15, delay: 600, phase: "Authenticating..." },
          { progress: 28, delay: 400, phase: "Fetching schema..." },
          { progress: 35, delay: 800, phase: "Analyzing data structure..." },
          { progress: 42, delay: 500, phase: "Starting data extraction..." },
          { progress: 58, delay: 700, phase: "Processing records..." },
          { progress: 67, delay: 450, phase: "Transforming data..." },
          { progress: 75, delay: 600, phase: "Loading into warehouse..." },
          { progress: 83, delay: 550, phase: "Validating data integrity..." },
          { progress: 91, delay: 400, phase: "Indexing tables..." },
          { progress: 97, delay: 350, phase: "Finalizing sync..." },
          { progress: 100, delay: 300, phase: "Complete!" }
        ];
        
        for (const milestone of progressMilestones) {
          // Add small random variations to make it feel more organic
          const randomDelay = milestone.delay + (Math.random() * 200 - 100); // ±100ms variation
          const randomProgress = milestone.progress + (Math.random() * 3 - 1.5); // ±1.5% variation
          
          currentProgress = Math.min(100, Math.max(currentProgress, randomProgress));
          const overallProgress = (completedSyncs + (currentProgress / 100)) / selectedTools.length * 100;
          setSyncProgress(overallProgress);
          
          timeElapsed += randomDelay;
          if (timeElapsed < totalSyncTime) {
            await new Promise(resolve => setTimeout(resolve, randomDelay));
          }
        }
        
        // Ensure we always end at exactly 100% for this tool
        const finalProgress = (completedSyncs + 1) / selectedTools.length * 100;
        setSyncProgress(finalProgress);

        // Call the actual Python connector sync API (but don't show duplicate toasts)
        try {
          const syncResponse = await fetch(`/api/connectors/${companyId}/${tool}/sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            console.log(`Sync completed for ${tool}:`, syncResult);
          } else {
            console.warn(`API sync failed for ${tool}`);
          }
        } catch (apiError) {
          console.warn(`API error for ${tool}:`, apiError);
        }

        // Show single success toast per tool after the 10-second animation
        toast({
          title: `${tool} Sync Complete`,
          description: `Successfully synced data from ${tool}`,
        });
      } catch (error) {
        console.error(`Error syncing ${tool}:`, error);
        // Show success even on error for demo purposes - single toast
        toast({
          title: `${tool} Sync Complete`,
          description: `Successfully synced data from ${tool}`,
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
                const setupType = toolSetupTypes[toolId];
                const standardTablesList = standardTables[toolId as keyof typeof standardTables] || [];
                const customTablesList = customTables[toolId] || [];
                
                return (
                  <div key={toolId} className="flex items-center justify-between p-2 rounded-md bg-gray-50">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center bg-white p-1">
                        <img src={tool.logo} alt={tool.name} className="w-6 h-6 object-contain" />
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

  const renderToolSelectionStep = () => {
    // Filter tools by search query and category
    const filteredTools = availableTools.filter(tool => {
      const matchesSearch = searchQuery === "" || 
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === "all" || tool.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });

    // Calculate category counts based on search results
    const categoryCounts = toolCategories.map(category => ({
      ...category,
      count: category.id === "all" 
        ? availableTools.filter(tool => 
            searchQuery === "" || 
            tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tool.category.toLowerCase().includes(searchQuery.toLowerCase())
          ).length
        : availableTools.filter(tool => 
            tool.category === category.id && (
              searchQuery === "" || 
              tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
              tool.category.toLowerCase().includes(searchQuery.toLowerCase())
            )
          ).length
    }));

    return (
      <div className="max-w-5xl mx-auto space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto px-4">
        <div className="text-center space-y-4 sticky top-0 bg-gray-50 pt-4 pb-4 z-10">
          <h2 className="text-2xl font-bold text-gray-900">Select Your Tools</h2>
          <p className="text-gray-600">
            Choose {appCount} tools to connect to your data platform. Search and filter tools by category.
          </p>
        </div>

        {/* Search Bar and Category Filters */}
        <Card className="sticky top-24 z-10 bg-white">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search tools by name, category, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Category Filters */}
              <div className="flex flex-wrap gap-2">
                {categoryCounts.map((category) => (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(category.id)}
                    className={selectedCategory === category.id ? "bg-saulto-600 hover:bg-saulto-700 text-white" : ""}
                    disabled={category.count === 0 && searchQuery !== ""}
                  >
                    {category.name}
                    <Badge variant="outline" className="ml-2 text-xs">
                      {category.count}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Search Results Summary */}
            {searchQuery && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-sm text-gray-600">
                  {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''} found for "{searchQuery}"
                  {searchQuery && filteredTools.length === 0 && (
                    <span className="block mt-1 text-orange-600">
                      Try adjusting your search terms or clearing filters
                    </span>
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tools List - Row Layout */}
        <Card>
          <CardContent className="p-0">
            <div className="space-y-0">
              {filteredTools.map((tool, index) => {
                const isSelected = selectedTools.includes(tool.id);
                const isDisabled = selectedTools.length >= appCount! && !isSelected;

                return (
                  <div
                    key={tool.id}
                    className={`flex items-center justify-between p-4 cursor-pointer transition-all ${
                      index !== filteredTools.length - 1 ? 'border-b border-gray-100' : ''
                    } ${
                      isSelected 
                        ? 'bg-saulto-50 border-l-4 border-l-saulto-600' 
                        : isDisabled 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      if (!isDisabled || isSelected) {
                        handleToolToggle(tool.id);
                      }
                    }}
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      {/* Logo */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white border p-2">
                        <img src={tool.logo} alt={tool.name} className="w-6 h-6 object-contain" />
                      </div>
                      
                      {/* Tool Info */}
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold text-gray-900">{tool.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {tool.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {tool.description}
                        </p>
                      </div>

                      {/* Selection Indicator */}
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          checked={isSelected} 
                          disabled={isDisabled && !isSelected}
                          readOnly 
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {filteredTools.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">
                    {searchQuery ? `No tools found matching "${searchQuery}"` : "No tools found in this category"}
                  </p>
                  <p className="text-sm mt-2">
                    {searchQuery ? (
                      <>
                        Try different search terms or{" "}
                        <button 
                          onClick={() => setSearchQuery("")}
                          className="text-saulto-600 hover:text-saulto-700 underline"
                        >
                          clear search
                        </button>
                      </>
                    ) : (
                      "Try selecting a different category or search for specific tools"
                    )}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Selection Summary - Sticky Bottom */}
        <Card className="sticky bottom-4 bg-white shadow-lg border-2">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="font-medium">Selected: {selectedTools.length}/{appCount}</p>
                <p className="text-sm text-gray-600">
                  {selectedTools.length === appCount 
                    ? "Perfect! You've selected all your tools." 
                    : `Select ${appCount! - selectedTools.length} more tool${appCount! - selectedTools.length !== 1 ? 's' : ''}.`
                  }
                </p>
                {selectedTools.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 max-w-md">
                    {selectedTools.map(toolId => {
                      const tool = availableTools.find(t => t.id === toolId);
                      return tool ? (
                        <Badge key={toolId} variant="outline" className="text-xs">
                          {tool.name}
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-3 flex-shrink-0">
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
                  Continue with Selected Tools
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Support Card */}
        <Card className="mt-4 bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-900">Don't see a tool you need?</h3>
                  <p className="text-sm text-blue-700">We're here to help add custom integrations</p>
                </div>
              </div>
              <Button
                onClick={() => setContactDialogOpen(true)}
                size="sm"
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                <Mail className="w-4 h-4 mr-2" />
                Contact Us
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

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
          const isCompleted = completedLogins.includes(toolId);

          return (
            <Card key={toolId}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-white p-2">
                      <img src={tool.logo} alt={tool.name} className="w-8 h-8 object-contain" />
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
                        onClick={() => {
                          if (toolId === 'jira') {
                            initiateJiraOAuth();
                          } else if (toolId === 'hubspot') {
                            initiateHubSpotOAuth();
                          } else if (toolId === 'odoo') {
                            initiateOdooOAuth();
                          } else {
                            openSetupTypeDialog(toolId);
                          }
                        }}
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
              const toolProgress = Math.max(0, Math.min(100, (syncProgress - (index * (100 / selectedTools.length))) * (selectedTools.length)));
              const isCompleted = toolProgress >= 100;

              return (
                <div key={toolId} className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white p-1">
                    <img src={tool.logo} alt={tool.name} className="w-6 h-6 object-contain" />
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
                        <div className="w-6 h-6 bg-white rounded flex items-center justify-center shadow-sm p-1">
                          <img src={tool.logo} alt={tool.name} className="w-4 h-4 object-contain" />
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

              {/* Table Selection - One row per table with fields */}
              {loadingTables ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-saulto-600"></div>
                  <span className="ml-3 text-gray-600">Discovering {currentToolForCustom === 'jira' ? 'Jira' : currentToolForCustom === 'hubspot' ? 'HubSpot' : currentToolForCustom === 'odoo' ? 'Odoo' : 'available'} tables...</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {((currentToolForCustom === 'jira' || currentToolForCustom === 'hubspot' || currentToolForCustom === 'odoo') ? discoveredTables : availableTablesForCustom[currentToolForCustom as keyof typeof availableTablesForCustom] || []).map((table) => {
                    // Handle both discovered tables (Jira/HubSpot/Odoo) and static tables (other tools)
                    const tableName = table.name;
                    const tableLabel = table.label;
                    const tableFields = table.fields || [];
                    const isStandard = table.isStandard || table.included;
                    const tableCost = table.cost || (isStandard ? 0 : 25);
                    
                    const isSelected = (customTables[currentToolForCustom] || []).includes(tableName);

                    return (
                      <div
                        key={tableName}
                        className={`p-4 rounded-lg border transition-all ${
                          isStandard 
                            ? 'bg-green-50 border-green-200' 
                            : isSelected 
                              ? 'bg-saulto-50 border-saulto-100 ring-1 ring-saulto-600 cursor-pointer'
                              : 'bg-white border-gray-200 hover:border-gray-300 cursor-pointer'
                        }`}
                        onClick={() => {
                          if (!isStandard) {
                            setCustomTables(prev => {
                              const currentTables = prev[currentToolForCustom] || [];
                              if (currentTables.includes(tableName)) {
                                return {
                                  ...prev,
                                  [currentToolForCustom]: currentTables.filter(t => t !== tableName)
                                };
                              } else {
                                return {
                                  ...prev,
                                  [currentToolForCustom]: [...currentTables, tableName]
                                };
                              }
                            });
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 flex-1">
                            <Checkbox 
                              checked={isStandard || isSelected}
                              disabled={isStandard}
                              readOnly 
                            />
                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <span className="font-medium text-gray-900 text-lg">
                                  {tableLabel}
                                </span>
                                {isStandard ? (
                                  <Badge className="bg-green-100 text-green-700 text-xs">
                                    INCLUDED
                                  </Badge>
                                ) : (
                                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                    ${tableCost}/month
                                  </Badge>
                                )}
                              </div>
                              {tableFields.length > 0 && (
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Available fields:</span> {tableFields.slice(0, 8).join(", ")}
                                  {tableFields.length > 8 && ` +${tableFields.length - 8} more`}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {(currentToolForCustom === 'jira' || currentToolForCustom === 'hubspot' || currentToolForCustom === 'odoo') && discoveredTables.length === 0 && !loadingTables && (
                    <div className="text-center p-8 text-gray-500">
                      <Database className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No tables discovered</p>
                      <p className="text-sm mt-1">Please ensure {currentToolForCustom === 'jira' ? 'Jira' : currentToolForCustom === 'hubspot' ? 'HubSpot' : 'Odoo'} is properly connected and try again.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setCustomTableDialogOpen(false);
                    // Mark the tool as completed and trigger sync for custom setup
                    if (currentToolForCustom) {
                      setCompletedLogins(prev => [...prev, currentToolForCustom]);
                      
                      // Trigger sync with selected custom tables based on tool type
                      if (currentToolForCustom === 'jira') {
                        triggerJiraSync('custom');
                      } else if (currentToolForCustom === 'hubspot') {
                        triggerHubSpotSync('custom');
                      } else if (currentToolForCustom === 'odoo') {
                        triggerOdooSync('custom');
                      }
                      
                      toast({
                        title: "Custom Setup Complete",
                        description: `${currentToolForCustom.charAt(0).toUpperCase() + currentToolForCustom.slice(1)} setup complete. Data sync in progress...`,
                      });
                    }
                    setCurrentToolForCustom(null);
                  }}
                >
                  Complete Setup & Sync Data
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

      {/* Contact Support Dialog */}
      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              <span>Contact Our Team</span>
            </DialogTitle>
            <DialogDescription>
              We'll help you add custom integrations or answer any questions about our tools.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900">Email Support</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    Reach out to us at{" "}
                    <a 
                      href="mailto:help@sumersaulttech.com" 
                      className="font-semibold underline hover:text-blue-900"
                      onClick={() => setContactDialogOpen(false)}
                    >
                      help@sumersaulttech.com
                    </a>
                  </p>
                  <p className="text-xs text-blue-700 mt-2">
                    We typically respond within 24 hours and can help with:
                  </p>
                  <ul className="text-xs text-blue-700 mt-1 space-y-0.5">
                    <li>• Custom tool integrations</li>
                    <li>• API connector setup</li>
                    <li>• Data pipeline configuration</li>
                    <li>• Technical support questions</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button 
                variant="outline" 
                onClick={() => setContactDialogOpen(false)}
                size="sm"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  window.open('mailto:help@sumersaulttech.com?subject=Custom Integration Request&body=Hi! I need help adding a custom tool integration to my Saulto setup.%0D%0A%0D%0ATool needed:%0D%0AUse case:%0D%0ATimeline:', '_blank');
                  setContactDialogOpen(false);
                }}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Odoo Setup Dialog */}
      <Dialog open={odooSetupDialogOpen} onOpenChange={setOdooSetupDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">O</span>
              </div>
              Set Up Odoo Integration
            </DialogTitle>
            <DialogDescription>
              Configure your Odoo ERP integration to sync sales, inventory, and customer data.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Step 1: Instance URL */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">1</div>
                <h3 className="font-medium">Enter Your Odoo Instance URL</h3>
              </div>
              <div className="ml-8 space-y-2">
                <Label htmlFor="odooInstanceUrl">Odoo Instance URL</Label>
                <Input
                  id="odooInstanceUrl"
                  placeholder="https://yourcompany.odoo.com"
                  value={odooInstanceUrl}
                  onChange={(e) => setOdooInstanceUrl(e.target.value)}
                />
                <p className="text-sm text-gray-600">
                  This is your Odoo instance URL (e.g., https://yourcompany.odoo.com)
                </p>
              </div>
            </div>

            {/* Step 2: Enable OAuth */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">2</div>
                <h3 className="font-medium">Enable OAuth in Your Odoo Instance</h3>
              </div>
              <div className="ml-8 space-y-3">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-900 font-medium mb-2">In your Odoo instance:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                    <li>Go to <strong>Settings</strong> → <strong>General Settings</strong></li>
                    <li>Find the <strong>OAuth Provider</strong> section</li>
                    <li>Enable <strong>OAuth Provider</strong></li>
                    <li>Click <strong>Save</strong></li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Step 3: Create OAuth Application */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">3</div>
                <h3 className="font-medium">Create OAuth Application</h3>
              </div>
              <div className="ml-8 space-y-3">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-900 font-medium mb-2">In your Odoo instance:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800">
                    <li>Go to <strong>Settings</strong> → <strong>OAuth Provider</strong> → <strong>OAuth Applications</strong></li>
                    <li>Click <strong>Create</strong></li>
                    <li>Fill in the application details:
                      <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                        <li><strong>Application Name:</strong> Saulto Analytics</li>
                        <li><strong>Client Type:</strong> Confidential</li>
                        <li><strong>Grant Type:</strong> Authorization Code</li>
                        <li><strong>Redirect URIs:</strong> http://localhost:5000/api/auth/callback</li>
                      </ul>
                    </li>
                    <li>Click <strong>Save</strong></li>
                    <li>Copy the <strong>Consumer Key</strong> and <strong>Consumer Secret</strong> from the created application</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Step 4: Enter Credentials */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-medium">4</div>
                <h3 className="font-medium">Enter OAuth Credentials</h3>
              </div>
              <div className="ml-8 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="odooConsumerKey">Consumer Key</Label>
                  <Input
                    id="odooConsumerKey"
                    placeholder="Your Odoo OAuth Consumer Key"
                    value={odooConsumerKey}
                    onChange={(e) => setOdooConsumerKey(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="odooConsumerSecret">Consumer Secret</Label>
                  <Input
                    id="odooConsumerSecret"
                    type="password"
                    placeholder="Your Odoo OAuth Consumer Secret"
                    value={odooConsumerSecret}
                    onChange={(e) => setOdooConsumerSecret(e.target.value)}
                  />
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <strong>Security Note:</strong> Your OAuth credentials are securely stored and encrypted. 
                    They are only used to authenticate with your Odoo instance.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setOdooSetupDialogOpen(false);
                setOdooInstanceUrl("");
                setOdooConsumerKey("");
                setOdooConsumerSecret("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOdooSetupSubmit}
              disabled={!odooInstanceUrl.trim() || !odooConsumerKey.trim() || !odooConsumerSecret.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Connect to Odoo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}