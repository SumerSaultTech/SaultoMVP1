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
  Plus,
  Edit3,
  Trash2,
  Info,
  Zap,
  FileText,
  Calendar,
  CheckCircle2
} from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface AppNode {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  position: Position;
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

// Available application types
const APP_TEMPLATES = [
  { id: 'salesforce', name: 'Salesforce', icon: Users, color: '#3b82f6' },
  { id: 'quickbooks', name: 'QuickBooks', icon: DollarSign, color: '#22c55e' },
  { id: 'jira', name: 'Jira', icon: Briefcase, color: '#6366f1' },
  { id: 'hubspot', name: 'HubSpot', icon: Target, color: '#ec4899' },
  { id: 'netsuite', name: 'NetSuite', icon: Database, color: '#a855f7' },
  { id: 'harvest', name: 'Harvest', icon: Clock, color: '#f97316' },
];

export default function IntegrationsCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // Load connected apps from setup data
  const loadConnectedApps = (): AppNode[] => {
    const setupData = localStorage.getItem('setupData');
    if (!setupData) return [];
    
    const { completedTools } = JSON.parse(setupData);
    if (!completedTools || completedTools.length === 0) return [];
    
    // Create nodes for connected apps in a circle layout
    // Use a standard canvas size for initial positioning
    const canvasWidth = 800; // Standard width for positioning
    const canvasHeight = 600; // Standard height for positioning
    const centerX = canvasWidth / 2 - 64; // Account for node width (128px / 2)
    const centerY = canvasHeight / 2 - 40; // Account for node height (80px / 2)
    const radius = Math.min(250, Math.max(150, completedTools.length * 35));
    
    return completedTools.map((toolId: string, index: number) => {
      const template = APP_TEMPLATES.find(t => t.id === toolId);
      if (!template) return null;
      
      const angle = (index * 2 * Math.PI) / completedTools.length;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      return {
        id: toolId,
        name: template.name,
        icon: template.icon,
        color: template.color,
        position: { 
          x: Math.max(50, Math.min(x, canvasWidth - 150)), 
          y: Math.max(50, Math.min(y, canvasHeight - 100)) 
        }
      };
    }).filter(Boolean) as AppNode[];
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

  // Handle connection drawing
  const startDrawConnection = (nodeId: string) => {
    setIsDrawingConnection(true);
    setDrawingStart(nodeId);
  };

  const finishDrawConnection = (targetNodeId: string) => {
    if (!drawingStart || drawingStart === targetNodeId) return;
    
    const newConnection: Connection = {
      id: Date.now().toString(),
      sourceId: drawingStart,
      targetId: targetNodeId,
      description: 'New connection',
      notes: '',
      dataFlow: 'Bidirectional',
      frequency: 'Real-time',
      status: 'active',
      lastSync: new Date().toISOString(),
      purpose: 'Data synchronization',
    };
    
    setConnections(prev => [...prev, newConnection]);
    setIsDrawingConnection(false);
    setDrawingStart(null);
  };

  // Add new node
  const addNode = (templateId: string) => {
    const template = APP_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    const newNode: AppNode = {
      id: Date.now().toString(),
      name: template.name,
      icon: template.icon,
      color: template.color,
      position: { x: 300, y: 200 },
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
    <div className="h-full bg-gray-50 relative overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-semibold text-gray-900 tracking-tight">Integration Canvas</h1>
            <p className="text-sm text-gray-500 font-sans">Visual integration flow designer</p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setShowAddNode(true)}
              size="sm"
              className="bg-saulto-600 hover:bg-saulto-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add App
            </Button>
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
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Connected Apps</h3>
              <p className="text-gray-500 mb-6">
                Connect your first application from the setup page to start building integration flows.
              </p>
              <Button 
                onClick={() => window.location.href = '/setup'}
                className="bg-saulto-600 hover:bg-saulto-700 text-white"
              >
                Go to Setup
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
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{ stopColor: '#0F5132', stopOpacity: 1 }}>
                <animate attributeName="stop-color" values="#0F5132;#0A4429;#063320;#0F5132" dur="3s" repeatCount="indefinite" />
              </stop>
              <stop offset="100%" style={{ stopColor: '#0A4429', stopOpacity: 1 }}>
                <animate attributeName="stop-color" values="#0A4429;#063320;#0F5132;#0A4429" dur="3s" repeatCount="indefinite" />
              </stop>
            </linearGradient>
          </defs>
          
          {connections.map((connection) => (
            <g key={connection.id}>
              <path
                d={getConnectionPath(connection.sourceId, connection.targetId)}
                fill="none"
                stroke="url(#connectionGradient)"
                strokeWidth="3"
                className="cursor-pointer"
                style={{ 
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                  pointerEvents: 'all'
                }}
                onClick={() => setSelectedConnection(connection)}
              />
              {/* Animated pulse */}
              <circle r="4" fill="#0F5132">
                <animateMotion dur="2s" repeatCount="indefinite">
                  <mpath xlinkHref={`#path-${connection.id}`} />
                </animateMotion>
              </circle>
              <path
                id={`path-${connection.id}`}
                d={getConnectionPath(connection.sourceId, connection.targetId)}
                fill="none"
                stroke="transparent"
                strokeWidth="0"
              />
            </g>
          ))}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const Icon = node.icon;
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
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                    style={{ backgroundColor: node.color + '20' }}
                  >
                    <Icon 
                      className="w-4 h-4" 
                      style={{ color: node.color }}
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

                  {/* Connection handles */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Right handle */}
                    <button
                      className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-saulto-600 rounded-full pointer-events-auto hover:bg-saulto-700 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDrawingConnection && drawingStart !== node.id) {
                          finishDrawConnection(node.id);
                        } else {
                          startDrawConnection(node.id);
                        }
                      }}
                    >
                      <Zap className="w-2 h-2 text-white" />
                    </button>
                    
                    {/* Left handle */}
                    <button
                      className="absolute left-0 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-saulto-500 rounded-full pointer-events-auto hover:bg-saulto-600 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDrawingConnection && drawingStart !== node.id) {
                          finishDrawConnection(node.id);
                        } else {
                          startDrawConnection(node.id);
                        }
                      }}
                    >
                      <Zap className="w-2 h-2 text-white" />
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          );
        })}

        {/* Drawing state indicator */}
        {isDrawingConnection && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
            <Badge className="bg-blue-600 text-white">
              Click another app to create connection
            </Badge>
          </div>
        )}
      </div>

      {/* Add Node Dialog */}
      <Dialog open={showAddNode} onOpenChange={setShowAddNode}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Application</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {APP_TEMPLATES.map((template) => {
              const Icon = template.icon;
              return (
                <Card 
                  key={template.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-all"
                  onClick={() => addNode(template.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: template.color + '20' }}
                    >
                      <Icon 
                        className="w-5 h-5" 
                        style={{ color: template.color }}
                      />
                    </div>
                    <span className="font-medium">{template.name}</span>
                  </div>
                </Card>
              );
            })}
          </div>
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
              <span>Connection Documentation</span>
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
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Bidirectional">Bidirectional</option>
                    <option value="Source to Target">Source → Target</option>
                    <option value="Target to Source">Target → Source</option>
                  </select>
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
                <label className="text-sm font-medium text-gray-700">Technical Notes & Implementation Details</label>
                <textarea
                  value={selectedConnection.notes}
                  onChange={(e) => setSelectedConnection({ ...selectedConnection, notes: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Add technical details, field mappings, transformation logic, error handling, etc..."
                />
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
                <Button 
                  variant="outline"
                  onClick={() => deleteConnection(selectedConnection.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Connection
                </Button>
                <div className="space-x-3">
                  <Button variant="outline" onClick={() => setSelectedConnection(null)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => updateConnection(selectedConnection)}
                    className="bg-saulto-600 hover:bg-saulto-700 text-white"
                  >
                    Save Documentation
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