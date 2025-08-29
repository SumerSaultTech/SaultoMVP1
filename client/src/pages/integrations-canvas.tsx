import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  DollarSign, 
  Database, 
  Target, 
  Briefcase, 
  Clock,
  Mail,
  Plus,
  Edit3,
  Trash2,
  Info,
  Zap,
  FileText,
  Calendar,
  CheckCircle2,
  Settings,
  Activity,
  ArrowRight,
  Eye,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface AppNode {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  logo: string;
  color: string;
  position: Position;
  category: string;
}

interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  description: string;
  notes: string;
  dataFlow: string;
  frequency: string;
  status: 'active' | 'inactive' | 'error';
  lastSync?: string;
  purpose: string;
}

// Available application types - matches setup & config exactly
const APP_TEMPLATES = [
  {
    id: "activecampaign",
    name: "ActiveCampaign",
    icon: Users,
    logo: "https://logo.clearbit.com/activecampaign.com",
    category: "Marketing",
    color: "#356ae6"
  },
  {
    id: "asana",
    name: "Asana",
    icon: Target,
    logo: "https://cdn.worldvectorlogo.com/logos/asana-logo.svg",
    category: "Ops",
    color: "#f06a6a"
  },
  {
    id: "harvest",
    name: "Harvest",
    icon: Clock,
    logo: "https://logo.clearbit.com/getharvest.com",
    category: "Ops",
    color: "#ff8a00"
  },
  {
    id: "hubspot",
    name: "HubSpot",
    icon: Users,
    logo: "https://logo.clearbit.com/hubspot.com",
    category: "CRM",
    color: "#ff7a59"
  },
  {
    id: "jira",
    name: "Jira", 
    icon: Briefcase,
    logo: "https://cdn.worldvectorlogo.com/logos/jira-1.svg",
    category: "Ops",
    color: "#0052cc"
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    icon: Mail,
    logo: "https://logo.clearbit.com/mailchimp.com",
    category: "Marketing",
    color: "#ffe01b"
  },
  {
    id: "monday",
    name: "Monday.com",
    icon: Calendar,
    logo: "https://logo.clearbit.com/monday.com",
    category: "Ops",
    color: "#ff3d57"
  },
  {
    id: "netsuite",
    name: "NetSuite",
    icon: Database,
    logo: "https://cdn.worldvectorlogo.com/logos/netsuite-1.svg",
    category: "ERP",
    color: "#1f4788"
  },
  {
    id: "quickbooks",
    name: "QuickBooks", 
    icon: DollarSign,
    logo: "https://cdn.worldvectorlogo.com/logos/quickbooks-1.svg",
    category: "ERP",
    color: "#0077c5"
  },
  {
    id: "salesforce", 
    name: "Salesforce",
    icon: Users,
    logo: "https://cdn.worldvectorlogo.com/logos/salesforce-2.svg",
    category: "CRM",
    color: "#00a1e0"
  },
];

export default function IntegrationsCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Load connected apps from localStorage (demo version)
  const loadConnectedApps = (): AppNode[] => {
    try {
      const storedApps = localStorage.getItem('demo_oauth2_instances');
      if (!storedApps) return [];

      const oauth2Instances = JSON.parse(storedApps);
      if (!oauth2Instances || oauth2Instances.length === 0) return [];
      
      // Create nodes for OAuth2 instances in a circle layout
      const canvasWidth = 800;
      const canvasHeight = 600;
      const centerX = canvasWidth / 2 - 64;
      const centerY = canvasHeight / 2 - 40;
      const radius = Math.min(250, Math.max(150, oauth2Instances.length * 35));
      
      return oauth2Instances.map((instance: any, index: number) => {
        const template = APP_TEMPLATES.find(t => t.id === instance.appType);
        if (!template) return null;
        
        const angle = (index * 2 * Math.PI) / oauth2Instances.length;
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        return {
          id: instance.instanceId,
          name: instance.status === 'active' ? `${instance.instanceName} ✓` : instance.instanceName,
          icon: template.icon,
          logo: template.logo,
          color: template.color,
          category: template.category,
          position: { 
            x: Math.max(50, Math.min(x, canvasWidth - 150)), 
            y: Math.max(50, Math.min(y, canvasHeight - 100)) 
          }
        };
      }).filter(Boolean) as AppNode[];
    } catch (error) {
      console.error('Error loading OAuth2 instances:', error);
      return [];
    }
  };

  // Get available apps that can be added (support multiple instances of same app type)
  const getAvailableAppsToAdd = (): AppNode[] => {
    const setupData = localStorage.getItem('setupData');
    if (!setupData) return [];
    
    const { completedTools } = JSON.parse(setupData);
    if (!completedTools || completedTools.length === 0) return [];
    
    // Return all completed app types - allow multiple instances of each
    return APP_TEMPLATES
      .filter(template => completedTools.includes(template.id))
      .map(template => ({
        id: template.id,
        name: template.name,
        icon: template.icon,
        logo: template.logo,
        color: template.color,
        category: template.category,
        position: { x: 400, y: 300 } // Default center position
      }));
  };
  
  const [nodes, setNodes] = useState<AppNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [isDrawingConnection, setIsDrawingConnection] = useState(false);
  const [drawingStart, setDrawingStart] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [editingNode, setEditingNode] = useState<AppNode | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [highlightedConnection, setHighlightedConnection] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load connected apps on mount and handle dynamic centering
  useEffect(() => {
    const connectedApps = loadConnectedApps();
    setNodes(connectedApps);

    // Function to center nodes based on actual canvas size
      const centerNodes = () => {
        if (!canvasRef.current) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const canvasWidth = rect.width;
        const canvasHeight = rect.height;
        
        setNodes(current => {
          if (current.length === 0) return current;
          
          const centerX = canvasWidth / 2 - 64;
          const centerY = canvasHeight / 2 - 40;
          const radius = Math.min(250, Math.max(150, current.length * 35));
          
          return current.map((node, index) => ({
            ...node,
            position: {
              x: Math.max(50, Math.min(centerX + Math.cos((index * 2 * Math.PI) / current.length) * radius, canvasWidth - 150)),
              y: Math.max(50, Math.min(centerY + Math.sin((index * 2 * Math.PI) / current.length) * radius, canvasHeight - 100))
            }
          }));
        });
      };

      // Center nodes after a short delay to ensure canvas is rendered
      const timer = setTimeout(centerNodes, 100);
      
      const handleResize = () => {
        setTimeout(centerNodes, 100);
      };

      window.addEventListener('resize', handleResize);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
      };

  }, []);

  // Handle node dragging
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setDraggedNode(nodeId);
    setDragOffset({
      x: e.clientX - rect.left - node.position.x,
      y: e.clientY - rect.top - node.position.y,
    });
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggedNode || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const newPosition = {
      x: e.clientX - rect.left - dragOffset.x,
      y: e.clientY - rect.top - dragOffset.y,
    };
    
    setNodes(prev => prev.map(node => 
      node.id === draggedNode 
        ? { ...node, position: newPosition }
        : node
    ));
  }, [draggedNode, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setDraggedNode(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  // Handle OAuth2 connection creation
  const handleNodeConnect = (nodeId: string) => {
    if (isDrawingConnection && drawingStart && drawingStart !== nodeId) {
      // Complete connection - initiate OAuth2 flow
      const sourceNode = nodes.find(n => n.id === drawingStart);
      const targetNode = nodes.find(n => n.id === nodeId);
      
      // Start OAuth2 flow for connection
      initiateOAuth2Connection(drawingStart, nodeId, sourceNode, targetNode);
      
      setIsDrawingConnection(false);
      setDrawingStart(null);
    } else {
      // Start connection
      setIsDrawingConnection(true);
      setDrawingStart(nodeId);
    }
  };

  // OAuth2 setup for individual app instance (demo version)
  const initiateOAuth2Setup = async (appNode: AppNode, template: any) => {
    try {
      // Generate instance ID for demo
      const instanceId = `${template.id}_${Date.now()}`;
      
      // Show OAuth2 setup dialog
      const authorized = await showOAuth2SetupDialog('/demo/oauth2', appNode, template);
      
      if (authorized) {
        // Store in localStorage for demo
        const storedApps = localStorage.getItem('demo_oauth2_instances');
        const existingApps = storedApps ? JSON.parse(storedApps) : [];
        
        const newInstance = {
          instanceId,
          appType: template.id,
          instanceName: appNode.name,
          status: 'active',
          createdAt: new Date().toISOString(),
          credentials: {
            accessToken: `at_${Math.random().toString(36).substring(7)}${Date.now()}`,
            refreshToken: `rt_${Math.random().toString(36).substring(7)}${Date.now()}`,
            scope: 'read write data.sync'
          }
        };
        
        existingApps.push(newInstance);
        localStorage.setItem('demo_oauth2_instances', JSON.stringify(existingApps));
        
        // Update node with OAuth2 success indicator
        setNodes(prev => prev.map(n => 
          n.id === appNode.id 
            ? { ...n, name: `${template.name} ✓`, id: instanceId }
            : n
        ));
      } else {
        // User cancelled OAuth2 setup - remove the node
        setNodes(prev => prev.filter(n => n.id !== appNode.id));
      }
      
    } catch (error) {
      console.error('OAuth2 setup failed:', error);
      // Remove failed node
      setNodes(prev => prev.filter(n => n.id !== appNode.id));
    }
  };

  // OAuth2 connection flow between existing authenticated apps
  const initiateOAuth2Connection = async (sourceId: string, targetId: string, sourceNode: any, targetNode: any) => {
    try {
      // Create pending connection
      const pendingConnection: Connection = {
        id: Date.now().toString(),
        sourceId: sourceId,
        targetId: targetId,
        description: `${sourceNode?.name} → ${targetNode?.name}`,
        notes: 'OAuth2 connection in progress...',
        dataFlow: 'Bidirectional',
        frequency: 'Real-time',
        status: 'inactive', // Start as inactive until OAuth2 completes
        lastSync: new Date().toISOString(),
        purpose: 'OAuth2 authenticated data synchronization',
      };
      
      setConnections(prev => [...prev, pendingConnection]);
      
      // Start OAuth2 flow (for testing, we'll simulate the flow)
      await simulateOAuth2Flow(sourceNode, targetNode, pendingConnection);
      
    } catch (error) {
      console.error('OAuth2 connection failed:', error);
    }
  };

  // Simulate OAuth2 flow for testing
  const simulateOAuth2Flow = async (sourceNode: any, targetNode: any, connection: Connection) => {
    // Step 1: Show OAuth2 authorization dialog
    const authUrl = generateOAuth2AuthUrl(sourceNode.name, targetNode.name);
    
    // For testing, we'll simulate user authorization
    const authorized = await showOAuth2Dialog(authUrl, sourceNode, targetNode);
    
    if (authorized) {
      // Step 2: Exchange authorization code for access token (simulated)
      const tokenResponse = await exchangeCodeForToken(connection);
      
      if (tokenResponse.success) {
        // Step 3: Update connection to active
        setConnections(prev => prev.map(c => 
          c.id === connection.id 
            ? { 
                ...c, 
                status: 'active',
                notes: `OAuth2 connection established successfully.\nAccess Token: ${tokenResponse.accessToken}\nRefresh Token: ${tokenResponse.refreshToken}\nScopes: ${tokenResponse.scopes}`,
                lastSync: new Date().toISOString()
              }
            : c
        ));
      } else {
        // Failed to get token
        setConnections(prev => prev.map(c => 
          c.id === connection.id 
            ? { ...c, status: 'error', notes: 'OAuth2 token exchange failed' }
            : c
        ));
      }
    } else {
      // User cancelled authorization
      setConnections(prev => prev.filter(c => c.id !== connection.id));
    }
  };

  // Generate OAuth2 authorization URL
  const generateOAuth2AuthUrl = (sourceName: string, targetName: string) => {
    const clientId = 'saulto_integration_client';
    const redirectUri = encodeURIComponent(`${window.location.origin}/oauth2/callback`);
    const scopes = encodeURIComponent('read write data.sync');
    const state = Math.random().toString(36).substring(7);
    
    return `https://oauth2.${sourceName.toLowerCase()}.com/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes}&state=${state}`;
  };

  // Show OAuth2 setup dialog for individual app
  const showOAuth2SetupDialog = (authUrl: string, appNode: AppNode, template: any): Promise<boolean> => {
    return new Promise((resolve) => {
      const confirmed = window.confirm(
        `OAuth2 App Setup\n\n` +
        `App: ${template.name}\n` +
        `Instance: ${appNode.name}\n\n` +
        `This will open an OAuth2 authorization window where you'll:\n` +
        `1. Login to your ${template.name} account\n` +
        `2. Grant Saulto access permissions\n` +
        `3. Complete the OAuth2 authentication\n\n` +
        `Continue with OAuth2 setup?`
      );
      
      if (confirmed) {
        // For testing, simulate the OAuth2 window
        setTimeout(() => {
          const authorized = window.confirm(
            `OAuth2 Authorization for ${template.name}\n\n` +
            `You are being redirected to ${template.name} for authorization.\n\n` +
            `Grant Saulto permission to:\n` +
            `• Read your ${template.name} data\n` +
            `• Sync data to Saulto Dashboard\n` +
            `• Access API on your behalf\n\n` +
            `Click OK to authorize, Cancel to deny.`
          );
          resolve(authorized);
        }, 1000);
      } else {
        resolve(false);
      }
    });
  };

  // Show OAuth2 authorization dialog for connections between apps
  const showOAuth2Dialog = (authUrl: string, sourceNode: any, targetNode: any): Promise<boolean> => {
    return new Promise((resolve) => {
      const confirmed = window.confirm(
        `OAuth2 Connection Setup\n\n` +
        `Source: ${sourceNode.name}\n` +
        `Target: ${targetNode.name}\n\n` +
        `This will open an OAuth2 authorization window where you'll:\n` +
        `1. Login to ${sourceNode.name}\n` +
        `2. Grant Saulto access permissions\n` +
        `3. Complete the connection setup\n\n` +
        `Continue with OAuth2 authorization?`
      );
      
      if (confirmed) {
        // For testing, simulate the OAuth2 window
        setTimeout(() => {
          const authorized = window.confirm(
            `OAuth2 Authorization Simulation\n\n` +
            `You are being redirected to ${sourceNode.name} for authorization.\n\n` +
            `Grant Saulto permission to:\n` +
            `• Read your ${sourceNode.name} data\n` +
            `• Write updates to ${targetNode.name}\n` +
            `• Sync data between applications\n\n` +
            `Click OK to authorize, Cancel to deny.`
          );
          resolve(authorized);
        }, 1000);
      } else {
        resolve(false);
      }
    });
  };

  // Exchange authorization code for access token
  const exchangeCodeForToken = async (connection: Connection): Promise<{success: boolean, accessToken?: string, refreshToken?: string, scopes?: string}> => {
    // Simulate token exchange
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // For testing, always succeed with mock tokens
    return {
      success: true,
      accessToken: `at_${Math.random().toString(36).substring(7)}${Date.now()}`,
      refreshToken: `rt_${Math.random().toString(36).substring(7)}${Date.now()}`,
      scopes: 'read write data.sync profile'
    };
  };

  // Add new node with OAuth2 connection setup
  const addNode = async (templateId: string) => {
    const template = APP_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    // Create unique instance ID for this OAuth2 connection
    const instanceId = `${templateId}_${Date.now()}`;
    const instanceName = `${template.name} (${new Date().toLocaleTimeString()})`;
    
    const newNode: AppNode = {
      id: instanceId,
      name: instanceName,
      icon: template.icon,
      logo: template.logo,
      color: template.color,
      category: template.category,
      position: { x: 300, y: 200 },
    };
    
    setNodes(prev => [...prev, newNode]);
    setShowAddNode(false);
    
    // Immediately start OAuth2 setup for this new app instance
    await initiateOAuth2Setup(newNode, template);
  };

  // Delete node and its connections
  const deleteNode = (nodeId: string) => {
    setNodes(prev => prev.filter(n => n.id !== nodeId));
    setConnections(prev => prev.filter(c => c.sourceId !== nodeId && c.targetId !== nodeId));
  };

  // Delete connection
  const deleteConnection = (connectionId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connectionId));
    setSelectedConnection(null);
  };

  // Update connection
  const updateConnection = (connection: Connection) => {
    setConnections(prev => prev.map(c => c.id === connection.id ? connection : c));
    setSelectedConnection(null);
  };

  // Update node name
  const updateNodeName = (nodeId: string, newName: string) => {
    setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, name: newName } : n));
    setEditingNode(null);
  };

  // Get connection path
  const getConnectionPath = (sourceId: string, targetId: string) => {
    const source = nodes.find(n => n.id === sourceId);
    const target = nodes.find(n => n.id === targetId);
    
    if (!source || !target) return '';
    
    const sourceCenter = { x: source.position.x + 60, y: source.position.y + 40 };
    const targetCenter = { x: target.position.x + 60, y: target.position.y + 40 };
    
    // Curved connection
    const midX = (sourceCenter.x + targetCenter.x) / 2;
    const midY = Math.min(sourceCenter.y, targetCenter.y) - 50;
    
    return `M ${sourceCenter.x} ${sourceCenter.y} Q ${midX} ${midY} ${targetCenter.x} ${targetCenter.y}`;
  };

  return (
    <div className="h-full bg-gray-50 relative overflow-hidden flex">
      {/* Main Canvas Area - 75% */}
      <div className="w-3/4 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-display font-semibold text-gray-900 tracking-tight">Integration Canvas</h1>
              <p className="text-sm text-gray-500 font-sans">Visual integration flow designer</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setShowAddNode(true)}
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Connect New App
                </Button>
                <Button
                  onClick={() => {
                    localStorage.removeItem('demo_oauth2_instances');
                    setNodes([]);
                    setConnections([]);
                  }}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Reset Demo
                </Button>
              </div>
              <Badge variant="outline" className="text-xs">
                {nodes.length} apps • {connections.length} connections
              </Badge>
            </div>
          </div>
        </div>

        {/* Canvas */}
      <div 
        ref={canvasRef}
        className="relative w-full cursor-crosshair flex-1"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Empty State */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">OAuth2 Integration Demo</h3>
              <p className="text-gray-500 mb-6">
                Connect multiple instances of your applications with OAuth2 authentication. Each connection is independent and can sync different data.
              </p>
              <Button 
                onClick={() => setShowAddNode(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Zap className="w-4 h-4 mr-2" />
                Start OAuth2 Demo
              </Button>
            </div>
          </div>
        )}
        {/* SVG for connections */}
        <svg 
          ref={svgRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 1 }}
        >
          <defs>
            {/* Enhanced gradient with glow effect */}
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 0.8 }}>
                <animate attributeName="stop-color" values="#10b981;#059669;#047857;#10b981" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="50%" style={{ stopColor: '#34d399', stopOpacity: 1 }}>
                <animate attributeName="stop-color" values="#34d399;#10b981;#059669;#34d399" dur="2s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" style={{ stopColor: '#059669', stopOpacity: 0.8 }}>
                <animate attributeName="stop-color" values="#059669;#047857;#10b981;#059669" dur="2s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
            
            {/* Highlighted connection gradient */}
            <linearGradient id="highlightGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#f59e0b', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: '#fbbf24', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: '#f59e0b', stopOpacity: 1 }} />
            </linearGradient>
            
            {/* Glow filter */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Pulse animation for data flow */}
            <filter id="pulse">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2">
                <animate attributeName="stdDeviation" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
              </feGaussianBlur>
            </filter>
            
            {/* Arrow markers for directional flow */}
            <defs>
              <marker id="arrowhead-forward" markerWidth="10" markerHeight="7" 
               refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
              </marker>
              <marker id="arrowhead-reverse" markerWidth="10" markerHeight="7" 
               refX="1" refY="3.5" orient="auto">
                <polygon points="10 0, 0 3.5, 10 7" fill="#f59e0b" />
              </marker>
              <marker id="arrowhead-target" markerWidth="10" markerHeight="7" 
               refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#e11d48" />
              </marker>
            </defs>
          </defs>
          
          {connections.map((connection) => {
            const isHighlighted = highlightedConnection === connection.id;
            const connectionPath = getConnectionPath(connection.sourceId, connection.targetId);
            
            // Calculate midpoint for info button
            const source = nodes.find(n => n.id === connection.sourceId);
            const target = nodes.find(n => n.id === connection.targetId);
            const midX = source && target ? (source.position.x + target.position.x) / 2 + 60 : 0;
            const midY = source && target ? (source.position.y + target.position.y) / 2 + 40 - 25 : 0;
            
            // Determine arrow markers based on flow direction
            const getMarkerEnd = () => {
              if (connection.dataFlow === 'Source to Target') return 'url(#arrowhead-forward)';
              if (connection.dataFlow === 'Target to Source') return 'url(#arrowhead-target)';
              if (connection.dataFlow === 'Bidirectional') return 'url(#arrowhead-forward)';
              return '';
            };

            const getMarkerStart = () => {
              if (connection.dataFlow === 'Bidirectional') return 'url(#arrowhead-reverse)';
              return '';
            };

            return (
              <g key={connection.id}>
                {/* Connection line with enhanced effects and directional arrows */}
                <path
                  d={connectionPath}
                  fill="none"
                  stroke={isHighlighted ? "url(#highlightGradient)" : "url(#connectionGradient)"}
                  strokeWidth={isHighlighted ? "5" : "4"}
                  className="cursor-pointer transition-all duration-300"
                  style={{ 
                    filter: isHighlighted ? 'url(#glow)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                    pointerEvents: 'all'
                  }}
                  markerEnd={getMarkerEnd()}
                  markerStart={getMarkerStart()}
                  onClick={() => setSelectedConnection(connection)}
                  onMouseEnter={() => setHighlightedConnection(connection.id)}
                  onMouseLeave={() => setHighlightedConnection(null)}
                />
                
                {/* Dynamic animated data particles based on flow direction */}
                {connection.dataFlow === 'Bidirectional' ? (
                  // Bidirectional: particles flow both ways
                  <>
                    {/* Forward direction particles */}
                    <circle r="3" fill="#10b981" filter="url(#pulse)">
                      <animateMotion dur="1.8s" repeatCount="indefinite" begin="0s">
                        <mpath xlinkHref={`#path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                    <circle r="2" fill="#34d399" opacity="0.8">
                      <animateMotion dur="2.2s" repeatCount="indefinite" begin="0.5s">
                        <mpath xlinkHref={`#path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                    
                    {/* Reverse direction particles */}
                    <circle r="2.5" fill="#f59e0b" opacity="0.7">
                      <animateMotion dur="2.0s" repeatCount="indefinite" begin="0.2s">
                        <mpath xlinkHref={`#reverse-path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                    <circle r="2" fill="#fbbf24" opacity="0.6">
                      <animateMotion dur="1.6s" repeatCount="indefinite" begin="0.8s">
                        <mpath xlinkHref={`#reverse-path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                  </>
                ) : connection.dataFlow === 'Source to Target' ? (
                  // Source to Target: only forward particles
                  <>
                    <circle r="3" fill="#10b981" filter="url(#pulse)">
                      <animateMotion dur="1.8s" repeatCount="indefinite" begin="0s">
                        <mpath xlinkHref={`#path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                    <circle r="2" fill="#34d399" opacity="0.8">
                      <animateMotion dur="2.2s" repeatCount="indefinite" begin="0.5s">
                        <mpath xlinkHref={`#path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                    <circle r="2.5" fill="#059669" opacity="0.6">
                      <animateMotion dur="1.5s" repeatCount="indefinite" begin="1s">
                        <mpath xlinkHref={`#path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                  </>
                ) : (
                  // Target to Source: only reverse particles
                  <>
                    <circle r="3" fill="#e11d48" filter="url(#pulse)">
                      <animateMotion dur="1.8s" repeatCount="indefinite" begin="0s">
                        <mpath xlinkHref={`#reverse-path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                    <circle r="2" fill="#f43f5e" opacity="0.8">
                      <animateMotion dur="2.2s" repeatCount="indefinite" begin="0.5s">
                        <mpath xlinkHref={`#reverse-path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                    <circle r="2.5" fill="#be123c" opacity="0.6">
                      <animateMotion dur="1.5s" repeatCount="indefinite" begin="1s">
                        <mpath xlinkHref={`#reverse-path-${connection.id}`} />
                      </animateMotion>
                    </circle>
                  </>
                )}
                
                {/* Invisible paths for animation */}
                <path
                  id={`path-${connection.id}`}
                  d={connectionPath}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="0"
                />
                {/* Reverse path for bidirectional and target-to-source flows */}
                <path
                  id={`reverse-path-${connection.id}`}
                  d={getConnectionPath(connection.targetId, connection.sourceId)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="0"
                />
                
                {/* Info button on connection */}
                <foreignObject x={midX - 12} y={midY - 12} width="24" height="24" style={{ pointerEvents: 'all' }}>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`w-6 h-6 p-0 bg-white shadow-md border-2 transition-all duration-200 ${
                      isHighlighted ? 'border-amber-400 bg-amber-50' : 'border-green-200 hover:border-green-400'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedConnection(connection);
                    }}
                    onMouseEnter={() => setHighlightedConnection(connection.id)}
                    onMouseLeave={() => setHighlightedConnection(null)}
                  >
                    <Info className="w-3 h-3 text-green-600" />
                  </Button>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          return (
            <div
              key={node.id}
              className="absolute"
              style={{ 
                left: node.position.x, 
                top: node.position.y,
                zIndex: 2
              }}
            >
              <Card 
                className={`w-32 h-20 cursor-move hover:shadow-lg transition-all ${
                  draggedNode === node.id ? 'shadow-xl ring-2 ring-blue-500' : ''
                }`}
                onMouseDown={(e) => handleMouseDown(e, node.id)}
              >
                <div className="p-3 h-full flex flex-col items-center justify-center relative">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-white border"
                  >
                    <img 
                      src={node.logo}
                      alt={`${node.name} logo`}
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        // Fallback to icon if logo fails to load
                        const Icon = node.icon;
                        e.currentTarget.style.display = 'none';
                        const iconElement = document.createElement('div');
                        iconElement.innerHTML = `<div class="w-4 h-4" style="color: ${node.color}"></div>`;
                        e.currentTarget.parentNode?.appendChild(iconElement);
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">
                    {node.name}
                  </span>
                  
                  {/* Node actions */}
                  <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-6 h-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNode(node);
                        }}
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-6 h-6 p-0 text-red-600 hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNode(node.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Simplified connection - double-click to connect */}
                  <div className="absolute inset-0 pointer-events-none">
                    {isDrawingConnection && drawingStart === node.id && (
                      <div className="absolute -inset-2 border-2 border-dashed border-green-400 rounded-lg animate-pulse pointer-events-none"></div>
                    )}
                    
                    {/* OAuth2 Connection button */}
                    <button
                      className={`absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full pointer-events-auto transition-all duration-200 ${
                        isDrawingConnection && drawingStart === node.id 
                          ? 'bg-green-600 text-white shadow-lg animate-bounce' 
                          : 'bg-white border-2 border-green-300 text-green-600 hover:bg-green-50 hover:border-green-400 shadow-md'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNodeConnect(node.id);
                      }}
                      title={isDrawingConnection ? "Click another app to start OAuth2 connection" : "Start OAuth2 authentication flow"}
                    >
                      <Zap className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          );
        })}

        {/* OAuth2 connection state indicator */}
        {isDrawingConnection && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
            <Badge className="bg-green-600 text-white animate-pulse">
              <Sparkles className="w-3 h-3 mr-1" />
              Click another app to start OAuth2 authentication
            </Badge>
          </div>
        )}
      </div>
      </div>

      {/* Connection Information Sidebar - 25% */}
      <div className="w-1/4 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Connections & Information</h2>
          <p className="text-sm text-gray-500">Manage your integrations</p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4">
          
          {/* Quick Stats */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
              <Sparkles className="w-4 h-4 mr-2" />
              Integration Overview
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-gray-900">{nodes.length}</div>
                <div className="text-xs text-gray-600">Apps</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-700">{connections.filter(c => c.status === 'active').length}</div>
                <div className="text-xs text-green-600">Active</div>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-600">{connections.filter(c => c.status !== 'active').length}</div>
                <div className="text-xs text-gray-500">Inactive</div>
              </div>
            </div>
          </div>

          {/* Connections List */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center justify-between">
              <span className="flex items-center">
                <Zap className="w-4 h-4 mr-2" />
                Connections ({connections.length})
              </span>
            </h3>
            <div className="space-y-3">
              {connections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No OAuth2 connections yet</p>
                  <p className="text-xs">Click the ⚡ button on apps to start OAuth2 authentication</p>
                </div>
              ) : (
                connections.map((connection) => {
                  const sourceNode = nodes.find(n => n.id === connection.sourceId);
                  const targetNode = nodes.find(n => n.id === connection.targetId);
                  const isHighlighted = highlightedConnection === connection.id;
                  
                  return (
                    <Card 
                      key={connection.id}
                      className={`p-4 cursor-pointer transition-all duration-200 ${isHighlighted ? 'ring-2 ring-amber-400 bg-amber-50' : 'hover:bg-gray-50'}`}
                      onClick={() => {
                        setHighlightedConnection(connection.id);
                        setTimeout(() => setHighlightedConnection(null), 3000);
                      }}
                    >
                      {/* Connection Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-gray-900 truncate flex-1">
                          {connection.description}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 ml-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedConnection(connection);
                          }}
                        >
                          <Settings className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Apps Flow */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          {sourceNode && (
                            <div className="flex items-center space-x-2 min-w-0">
                              <div 
                                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: sourceNode.color + '20' }}
                              >
                                <sourceNode.icon 
                                  className="w-3 h-3" 
                                  style={{ color: sourceNode.color }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-700 truncate">{sourceNode.name}</span>
                            </div>
                          )}
                        </div>

                        {/* Flow Direction */}
                        <div className="mx-3 flex-shrink-0">
                          {connection.dataFlow === 'Bidirectional' ? (
                            <div className="flex items-center space-x-1">
                              <ArrowRight className="w-3 h-3 text-green-500" />
                              <ArrowRight className="w-3 h-3 text-amber-500 rotate-180" />
                            </div>
                          ) : connection.dataFlow === 'Source to Target' ? (
                            <ArrowRight className="w-4 h-4 text-green-500" />
                          ) : (
                            <ArrowRight className="w-4 h-4 text-red-500 rotate-180" />
                          )}
                        </div>

                        <div className="flex items-center space-x-2 min-w-0 flex-1 justify-end">
                          {targetNode && (
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className="text-xs font-medium text-gray-700 truncate">{targetNode.name}</span>
                              <div 
                                className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: targetNode.color + '20' }}
                              >
                                <targetNode.icon 
                                  className="w-3 h-3" 
                                  style={{ color: targetNode.color }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* OAuth2 Status and Details */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className={`text-xs ${connection.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : connection.status === 'inactive' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            <Activity className="w-3 h-3 mr-1" />
                            {connection.status === 'active' ? 'OAuth2 Active' : connection.status === 'inactive' ? 'OAuth2 Pending' : 'OAuth2 Failed'}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${
                            connection.dataFlow === 'Bidirectional' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            connection.dataFlow === 'Source to Target' ? 'bg-green-50 text-green-700 border-green-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            {connection.dataFlow === 'Bidirectional' ? '↔' :
                             connection.dataFlow === 'Source to Target' ? '→' : '←'}
                          </Badge>
                        </div>
                        <span className="text-xs text-gray-500">{connection.frequency}</span>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-sm font-medium text-green-800 mb-3 flex items-center">
              <Sparkles className="w-4 h-4 mr-2" />
              Integration Health
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="text-lg font-bold text-green-700">{connections.filter(c => c.status === 'active').length}</div>
                <div className="text-xs text-green-600">Active</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-gray-600">{connections.filter(c => c.status !== 'active').length}</div>
                <div className="text-xs text-gray-500">Inactive</div>
              </div>
            </div>
          </div>

          {nodes.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm mb-4">No apps connected yet</p>
              <Button 
                size="sm"
                onClick={() => window.location.href = '/setup'}
              >
                Connect Your First App
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Add Node Dialog - Only show apps from completed setup */}
      <Dialog open={showAddNode} onOpenChange={setShowAddNode}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-green-600" />
              <span>OAuth2 Demo - Connect Application</span>
            </DialogTitle>
          </DialogHeader>
          
          {(() => {
            const availableApps = getAvailableAppsToAdd();
            const setupData = localStorage.getItem('setupData');
            const hasCompletedSetup = setupData && JSON.parse(setupData).completedTools?.length > 0;
            
            // For demo purposes, always allow connecting apps
            if (!hasCompletedSetup) {
              console.log('No setup completed, but allowing demo connections');
            }
            
            // For demo, show all available app templates
            const demoAvailableApps = APP_TEMPLATES.map(template => ({
              id: template.id,
              name: template.name,
              icon: template.icon,
              logo: template.logo,
              color: template.color,
              category: template.category,
              position: { x: 400, y: 300 }
            }));
            
            if (demoAvailableApps.length === 0) {
              return (
                <div className="text-center py-8">
                  <Settings className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <h3 className="font-medium text-gray-900 mb-2">No Apps Available</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    No application templates found for demo.
                  </p>
                </div>
              );
            }
            
            return (
              <div className="space-y-4 mt-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <Sparkles className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">OAuth2 Demo Mode</span>
                  </div>
                  <p className="text-xs text-green-700">
                    Connect multiple OAuth2 instances of any app type. Each connection is independent with its own authentication.
                  </p>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {demoAvailableApps.map((app) => (
                    <Card 
                      key={app.id}
                      className="p-3 cursor-pointer hover:shadow-md hover:bg-green-50 transition-all border hover:border-green-300"
                      onClick={() => addNode(app.id)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white border-2 border-green-200 p-2">
                          <img 
                            src={app.logo} 
                            alt={app.name} 
                            className="w-6 h-6 object-contain" 
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const IconComponent = app.icon;
                                parent.innerHTML = `<div class="w-4 h-4 text-green-600"></div>`;
                              }
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">{app.name}</span>
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                              {app.category}
                            </Badge>
                            <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                              OAuth2
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Click to start OAuth2 authentication</p>
                        </div>
                        <Zap className="w-4 h-4 text-green-500" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit Node Dialog */}
      <Dialog open={!!editingNode} onOpenChange={() => setEditingNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Application</DialogTitle>
          </DialogHeader>
          {editingNode && (
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-gray-700">App Name</label>
                <Input
                  value={editingNode.name}
                  onChange={(e) => setEditingNode({ ...editingNode, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setEditingNode(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => updateNodeName(editingNode.id, editingNode.name)}
                  className="bg-saulto-600 hover:bg-saulto-700 text-white"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Connection Documentation Dialog */}
      <Dialog open={!!selectedConnection} onOpenChange={() => setSelectedConnection(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>OAuth2 Connection Details</span>
            </DialogTitle>
          </DialogHeader>
          {selectedConnection && (
            <div className="space-y-6 mt-4">
              {/* Connection Overview */}
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    {React.createElement(nodes.find(n => n.id === selectedConnection.sourceId)?.icon || Info, { className: "w-4 h-4 text-blue-600" })}
                  </div>
                  <span className="font-medium">{nodes.find(n => n.id === selectedConnection.sourceId)?.name}</span>
                  <div className="flex items-center space-x-1">
                    <div className="w-6 h-0.5 bg-gradient-to-r from-blue-500 to-green-500"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="font-medium">{nodes.find(n => n.id === selectedConnection.targetId)?.name}</span>
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    {React.createElement(nodes.find(n => n.id === selectedConnection.targetId)?.icon || Info, { className: "w-4 h-4 text-green-600" })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Basic Information */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Connection Name</label>
                  <Input
                    value={selectedConnection.description}
                    onChange={(e) => setSelectedConnection({ ...selectedConnection, description: e.target.value })}
                    className="mt-1"
                    placeholder="e.g., Customer Data Sync"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={selectedConnection.status}
                    onChange={(e) => setSelectedConnection({ ...selectedConnection, status: e.target.value as any })}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="error">Error</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Data Flow Direction</label>
                  <select
                    value={selectedConnection.dataFlow}
                    onChange={(e) => setSelectedConnection({ ...selectedConnection, dataFlow: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="Bidirectional">↔ Bidirectional (data flows both ways)</option>
                    <option value="Source to Target">→ Source to Target (one-way flow)</option>
                    <option value="Target to Source">← Target to Source (reverse flow)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Changes the animation direction on the connection line
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Sync Frequency</label>
                  <select
                    value={selectedConnection.frequency}
                    onChange={(e) => setSelectedConnection({ ...selectedConnection, frequency: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Real-time">Real-time</option>
                    <option value="Every 5 minutes">Every 5 minutes</option>
                    <option value="Hourly">Hourly</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="On-demand">On-demand</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Purpose & Business Logic</label>
                <textarea
                  value={selectedConnection.purpose}
                  onChange={(e) => setSelectedConnection({ ...selectedConnection, purpose: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Describe what this connection does and why it's needed..."
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">OAuth2 Authentication Details</label>
                <textarea
                  value={selectedConnection.notes}
                  onChange={(e) => setSelectedConnection({ ...selectedConnection, notes: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="OAuth2 tokens, scopes, authentication status, and technical implementation details..."
                  readOnly={selectedConnection.notes.includes('Access Token:')} // Make read-only if contains OAuth tokens
                />
                {selectedConnection.notes.includes('Access Token:') && (
                  <p className="text-xs text-blue-600 mt-1">
                    ⚠️ OAuth2 credentials are automatically managed - edit carefully
                  </p>
                )}
              </div>

              {/* Status Information */}
              <div className="flex items-center space-x-6 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className={`w-4 h-4 ${selectedConnection.status === 'active' ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="text-sm text-gray-600">
                    Status: <span className={`font-medium ${selectedConnection.status === 'active' ? 'text-green-600' : selectedConnection.status === 'error' ? 'text-red-600' : 'text-orange-600'}`}>
                      {selectedConnection.status.charAt(0).toUpperCase() + selectedConnection.status.slice(1)}
                    </span>
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Last updated: {selectedConnection.lastSync ? new Date(selectedConnection.lastSync).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-between pt-4 border-t">
                <div className="space-x-3">
                  <Button 
                    variant="outline"
                    onClick={() => deleteConnection(selectedConnection.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Connection
                  </Button>
                  {selectedConnection.status === 'error' && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        // Re-initiate OAuth2 flow
                        const sourceNode = nodes.find(n => n.id === selectedConnection.sourceId);
                        const targetNode = nodes.find(n => n.id === selectedConnection.targetId);
                        if (sourceNode && targetNode) {
                          simulateOAuth2Flow(sourceNode, targetNode, selectedConnection);
                          setSelectedConnection(null);
                        }
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Re-authenticate OAuth2
                    </Button>
                  )}
                </div>
                <div className="space-x-3">
                  <Button variant="outline" onClick={() => setSelectedConnection(null)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => updateConnection(selectedConnection)}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}