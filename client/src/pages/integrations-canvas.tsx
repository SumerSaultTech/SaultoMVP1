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
    id: "odoo",
    name: "Odoo ERP",
    icon: Database,
    logo: "https://logo.clearbit.com/odoo.com",
    category: "ERP",
    color: "#714B67"
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

// Connected Apps Dialog Component
interface ConnectedAppsDialogProps {
  nodes: AppNode[];
  onAddNode: (app: AppNode) => void;
}

function ConnectedAppsDialog({ nodes, onAddNode }: ConnectedAppsDialogProps) {
  const [connectedApps, setConnectedApps] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchConnectedApps = async () => {
      try {
        const response = await fetch('/api/data-sources');
        if (response.ok) {
          const data = await response.json();
          const connected = data.filter((ds: any) => ds.status === 'connected');
          setConnectedApps(connected);
        }
      } catch (error) {
        console.error('Failed to fetch connected apps:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnectedApps();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-sm text-gray-600">Loading connected apps...</p>
      </div>
    );
  }

  if (connectedApps.length === 0) {
    return (
      <div className="text-center py-8">
        <Settings className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <h3 className="font-medium text-gray-900 mb-2">No Connected Apps</h3>
        <p className="text-sm text-gray-600 mb-4">
          Connect apps in Setup & Config first to add them to your canvas.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.location.href = '/setup'}
        >
          Go to Setup & Config
        </Button>
      </div>
    );
  }

  const availableApps = connectedApps
    .map(ds => {
      const template = APP_TEMPLATES.find(t => t.id === ds.type);
      if (!template) return null;

      return {
        ...template,
        id: `${template.id}_${ds.id}`, // Unique ID for canvas
        connectedId: ds.id,
        status: ds.status
      };
    })
    .filter(Boolean)
    .filter(app => app && !nodes.some(node => node.id === app.id)); // Don't show already added apps

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h3 className="font-medium text-gray-900 mb-2">Connected Applications</h3>
        <p className="text-sm text-gray-600">
          Add your connected apps to the integration canvas
        </p>
      </div>

      {availableApps.length === 0 ? (
        <div className="text-center py-4">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-primary" />
          <p className="text-sm text-gray-600">All connected apps are already on your canvas!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableApps.map((app: any) => (
            <div
              key={app.id}
              className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              onClick={() => onAddNode(app)}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border">
                  <img
                    src={app.logo}
                    alt={`${app.name} logo`}
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      const Icon = app.icon;
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{app.name}</p>
                  <p className="text-xs text-gray-500">{app.category}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                  Connected
                </Badge>
                <Plus className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IntegrationsCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Load connected apps from API
  const loadConnectedApps = async (): Promise<AppNode[]> => {
    try {
      const response = await fetch('/api/data-sources');
      if (response.ok) {
        const data = await response.json();
        const connected = data.filter((ds: any) => ds.status === 'connected');

        return connected
          .map((ds: any) => {
            const template = APP_TEMPLATES.find(t => t.id === ds.type);
            if (!template) return null;

            return {
              ...template,
              id: `${template.id}_${ds.id}`, // Unique ID for canvas
              position: { x: 300, y: 200 }, // Default position
              connectedId: ds.id,
              status: ds.status
            };
          })
          .filter(Boolean);
      }
    } catch (error) {
      console.error('Failed to load connected apps:', error);
    }
    return [];
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
    const initializeApps = async () => {
      const connectedApps = await loadConnectedApps();
      setNodes(connectedApps);
    };

    initializeApps();

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

  // Handle connection creation between apps
  const handleNodeConnect = (nodeId: string) => {
    if (isDrawingConnection && drawingStart && drawingStart !== nodeId) {
      // Complete connection - create custom integration connection
      const sourceNode = nodes.find(n => n.id === drawingStart);
      const targetNode = nodes.find(n => n.id === nodeId);

      // Create new custom integration connection
      createCustomConnection(drawingStart, nodeId, sourceNode, targetNode);

      setIsDrawingConnection(false);
      setDrawingStart(null);
    } else {
      // Start connection
      setIsDrawingConnection(true);
      setDrawingStart(nodeId);
    }
  };

  // Create custom integration connection
  const createCustomConnection = (sourceId: string, targetId: string, sourceNode: any, targetNode: any) => {
    const newConnection: Connection = {
      id: Date.now().toString(),
      sourceId: sourceId,
      targetId: targetId,
      description: `${sourceNode?.name} → ${targetNode?.name}`,
      notes: 'Custom integration connection - document your implementation details here',
      dataFlow: 'Bidirectional',
      frequency: 'Daily',
      status: 'active',
      lastSync: new Date().toISOString(),
      purpose: 'Custom integration between systems - add business logic and technical details',
    };

    setConnections(prev => [...prev, newConnection]);
  };


  // Add connected app to canvas
  const addNode = (app: AppNode) => {
    const existingNode = nodes.find(n => n.id === app.id);
    if (existingNode) return; // Already on canvas

    const newNode: AppNode = {
      ...app,
      position: { x: 300, y: 200 }, // Default position
    };

    setNodes(prev => [...prev, newNode]);
    setShowAddNode(false);
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
                  Add Connected App
                </Button>
                <Button
                  onClick={async () => {
                    const connectedApps = await loadConnectedApps();
                    setNodes(connectedApps);
                    setConnections([]);
                  }}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Refresh Apps
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
                <Zap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Integration Canvas</h3>
              <p className="text-gray-500 mb-6">
                Visual representation of your custom integrations. Add connected apps from Setup & Config to document your integration work.
              </p>
              <Button
                onClick={() => setShowAddNode(true)}
                className=""
              >
                <Zap className="w-4 h-4 mr-2" />
                Add Connected App
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
                      isHighlighted ? 'border-amber-400 bg-amber-50' : 'border-primary/20 hover:border-primary'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedConnection(connection);
                    }}
                    onMouseEnter={() => setHighlightedConnection(connection.id)}
                    onMouseLeave={() => setHighlightedConnection(null)}
                  >
                    <Info className="w-3 h-3 text-primary" />
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
                      <div className="absolute -inset-2 border-2 border-dashed border-primary rounded-lg animate-pulse pointer-events-none"></div>
                    )}
                    
                    {/* OAuth2 Connection button */}
                    <button
                      className={`absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full pointer-events-auto transition-all duration-200 ${
                        isDrawingConnection && drawingStart === node.id 
                          ? 'bg-primary text-white shadow-lg animate-bounce'
                          : 'bg-white border-2 border-primary/30 text-primary hover:bg-green-50 hover:border-primary shadow-md'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNodeConnect(node.id);
                      }}
                      title={isDrawingConnection ? "Click another app to create custom integration connection" : "Create custom integration connection"}
                    >
                      <Zap className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          );
        })}

        {/* Connection state indicator */}
        {isDrawingConnection && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
            <Badge className="bg-primary text-white animate-pulse">
              <Sparkles className="w-3 h-3 mr-1" />
              Click another app to create custom integration
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
                  <p className="text-sm">No custom integrations yet</p>
                  <p className="text-xs">Click the ⚡ button on apps to create custom integration connections</p>
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
                              <ArrowRight className="w-3 h-3 text-primary" />
                              <ArrowRight className="w-3 h-3 text-amber-500 rotate-180" />
                            </div>
                          ) : connection.dataFlow === 'Source to Target' ? (
                            <ArrowRight className="w-4 h-4 text-primary" />
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
                            {connection.status === 'active' ? 'Active' : connection.status === 'inactive' ? 'Pending' : 'Error'}
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
              <Zap className="w-5 h-5 text-primary" />
              <span>Add Connected Application</span>
            </DialogTitle>
          </DialogHeader>
          
          <ConnectedAppsDialog
            nodes={nodes}
            onAddNode={addNode}
          />
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
              <span>Custom Integration Details</span>
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
                    {React.createElement(nodes.find(n => n.id === selectedConnection.targetId)?.icon || Info, { className: "w-4 h-4 text-primary" })}
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
                <label className="text-sm font-medium text-gray-700">Technical Implementation Notes</label>
                <textarea
                  value={selectedConnection.notes}
                  onChange={(e) => setSelectedConnection({ ...selectedConnection, notes: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Document your custom integration: scripts, APIs used, data transformations, error handling, etc..."
                />
              </div>

              {/* Status Information */}
              <div className="flex items-center space-x-6 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className={`w-4 h-4 ${selectedConnection.status === 'active' ? 'text-primary' : 'text-gray-400'}`} />
                  <span className="text-sm text-gray-600">
                    Status: <span className={`font-medium ${selectedConnection.status === 'active' ? 'text-primary' : selectedConnection.status === 'error' ? 'text-red-600' : 'text-orange-600'}`}>
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
                        // Reset connection to active status
                        setConnections(prev => prev.map(c =>
                          c.id === selectedConnection.id
                            ? { ...c, status: 'active', lastSync: new Date().toISOString() }
                            : c
                        ));
                        setSelectedConnection(null);
                      }}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Mark as Active
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