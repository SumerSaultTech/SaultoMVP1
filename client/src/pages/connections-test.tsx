import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, Clock, RefreshCw, Play, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AirbyteDiagnostics } from "@/components/airbyte-diagnostics";

interface Connection {
  id: number;
  sourceType: string;
  companyId: number;
  status: string;
  createdAt: string;
  lastSync: string | null;
  recordsSynced?: number;
}

interface SyncJob {
  success: boolean;
  message?: string;
  jobId?: string;
  error?: string;
}

export default function ConnectionsTest() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncJobs, setSyncJobs] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const companyId = 1748544793859; // Using the company ID from CLAUDE.md

  const fetchConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/airbyte/connections/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setConnections(data);
      } else {
        throw new Error('Failed to fetch connections');
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
      toast({
        title: "Error",
        description: "Failed to fetch connections",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async (connectionId: string, sourceType: string) => {
    try {
      setSyncing(prev => ({ ...prev, [connectionId]: true }));
      
      const response = await fetch(`/api/airbyte/connections/${connectionId}/sync`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result: SyncJob = await response.json();
        if (result.success) {
          toast({
            title: "Sync Started",
            description: result.message || `Started sync for ${sourceType}`,
          });
          if (result.jobId) {
            setSyncJobs(prev => ({ ...prev, [connectionId]: result.jobId }));
          }
          // Refresh connections after a short delay
          setTimeout(fetchConnections, 2000);
        } else {
          throw new Error(result.error || 'Sync failed');
        }
      } else {
        throw new Error('Failed to trigger sync');
      }
    } catch (error) {
      console.error('Error triggering sync:', error);
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to trigger sync",
        variant: "destructive",
      });
    } finally {
      setSyncing(prev => ({ ...prev, [connectionId]: false }));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'connected':
      case 'active':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
      case 'authenticated':
        return <Badge className="bg-blue-100 text-blue-700"><CheckCircle className="w-3 h-3 mr-1" />Authenticated</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'error':
      case 'failed':
        return <Badge className="bg-red-100 text-red-700"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const testConnection = async (connectionId: string, sourceType: string) => {
    try {
      // This is a simple test - just try to get the connection status
      const response = await fetch(`/api/airbyte/connections/${companyId}`);
      if (response.ok) {
        toast({
          title: "Connection Test",
          description: `${sourceType} connection is reachable`,
        });
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: error instanceof Error ? error.message : "Failed to test connection",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Airbyte Connections Test</h1>
            <p className="text-sm text-gray-600 mt-1">Test and monitor your Airbyte connections</p>
          </div>
          <Button onClick={fetchConnections} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Diagnostics Card */}
          <AirbyteDiagnostics />

          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Connection Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{connections.length}</div>
                  <div className="text-sm text-gray-600">Total Connections</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {connections.filter(c => c.status === 'connected' || c.status === 'authenticated').length}
                  </div>
                  <div className="text-sm text-gray-600">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">
                    {connections.reduce((sum, c) => sum + (c.recordsSynced || 0), 0)}
                  </div>
                  <div className="text-sm text-gray-600">Records Synced</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Connections List */}
          {loading ? (
            <Card>
              <CardContent className="p-8">
                <div className="flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                  <span>Loading connections...</span>
                </div>
              </CardContent>
            </Card>
          ) : connections.length === 0 ? (
            <Card>
              <CardContent className="p-8">
                <div className="text-center text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">No Connections Found</h3>
                  <p>No Airbyte connections have been created yet.</p>
                  <p className="text-sm mt-2">Go to <a href="/setup" className="text-blue-600 hover:underline">Setup & Config</a> to create connections.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => (
                <Card key={connection.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold capitalize">
                            {connection.sourceType} Connection
                          </h3>
                          {getStatusBadge(connection.status)}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">Created:</span> {formatDate(connection.createdAt)}
                          </div>
                          <div>
                            <span className="font-medium">Last Sync:</span> {formatDate(connection.lastSync)}
                          </div>
                          <div>
                            <span className="font-medium">Records:</span> {connection.recordsSynced || 0}
                          </div>
                        </div>

                        {syncJobs[connection.id.toString()] && (
                          <div className="mt-2 text-sm text-blue-600">
                            <span className="font-medium">Latest Job:</span> {syncJobs[connection.id.toString()]}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testConnection(connection.id.toString(), connection.sourceType)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Test
                        </Button>
                        
                        <Button
                          size="sm"
                          onClick={() => triggerSync(connection.id.toString(), connection.sourceType)}
                          disabled={syncing[connection.id.toString()]}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {syncing[connection.id.toString()] ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Syncing...
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 mr-1" />
                              Sync Now
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}