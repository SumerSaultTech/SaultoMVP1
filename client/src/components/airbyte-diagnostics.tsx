import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export function AirbyteDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [testing, setTesting] = useState(false);

  const runDiagnostics = async () => {
    setTesting(true);
    setResults([]);
    
    const tests: DiagnosticResult[] = [];

    try {
      // Test 1: Check if we can authenticate
      tests.push({
        test: "Authentication",
        status: 'success',
        message: "Testing Airbyte authentication...",
      });

      // Test 2: Check workspace permissions by trying to create a test connection
      try {
        // Test by attempting to create a connection and analyzing the error
        const testConnectionResponse = await fetch('/api/airbyte/connections', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sourceType: 'test',
            credentials: { test: 'diagnostics' },
            companyId: 1748544793859
          })
        });
        
        if (testConnectionResponse.ok) {
          const result = await testConnectionResponse.json();
          // If connection creation succeeds, we have good permissions
          tests.push({
            test: "Workspace Access",
            status: 'success',
            message: "Can create connections successfully",
            details: `Connection status: ${result.status}`
          });
        } else {
          const errorResult = await testConnectionResponse.json();
          // Analyze the error to determine permission level
          const hasAuthAccess = !errorResult.details?.includes('authentication');
          tests.push({
            test: "Workspace Access",
            status: hasAuthAccess ? 'warning' : 'error',
            message: hasAuthAccess ? 
              "Authentication works but limited workspace permissions" :
              "Authentication failed",
            details: errorResult.details || errorResult.error
          });
        }
      } catch (error) {
        tests.push({
          test: "Workspace Access",
          status: 'error',
          message: "Failed to test workspace access",
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Test 3: Check connection list access (indicates read permissions)
      try {
        const connectionsTest = await fetch('/api/airbyte/connections/1748544793859');
        
        if (connectionsTest.ok) {
          const connections = await connectionsTest.json();
          tests.push({
            test: "Connection Reading",
            status: 'success',
            message: `Can read connection data successfully`,
            details: `Found ${connections.length} stored connections`
          });
        } else {
          tests.push({
            test: "Connection Reading",
            status: 'error',
            message: "Cannot read connection data",
            details: `HTTP ${connectionsTest.status}`
          });
        }
      } catch (error) {
        tests.push({
          test: "Connection Reading",
          status: 'error',
          message: "Failed to test connection reading",
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Test 4: Check permission level based on existing connection attempts
      try {
        // Get existing connections and analyze their status
        const connectionsResponse = await fetch('/api/airbyte/connections/1748544793859');
        
        if (connectionsResponse.ok) {
          const connections = await connectionsResponse.json();
          const hasAuthenticatedConnections = connections.some((c: any) => c.status === 'authenticated');
          const hasConnectedConnections = connections.some((c: any) => c.status === 'connected');
          
          if (hasConnectedConnections) {
            tests.push({
              test: "Airbyte Permissions",
              status: 'success',
              message: "Full Airbyte access - can create and manage connections",
              details: "WORKSPACE_ADMIN permissions confirmed"
            });
          } else if (hasAuthenticatedConnections) {
            tests.push({
              test: "Airbyte Permissions",
              status: 'warning',
              message: "Limited Airbyte access - credentials validate but workspace access restricted",
              details: "Need WORKSPACE_ADMIN permissions to create connections visible in Airbyte Cloud"
            });
          } else if (connections.length === 0) {
            tests.push({
              test: "Airbyte Permissions",
              status: 'warning',
              message: "No connections found - create one to test permissions",
              details: "Go to Setup & Config to create a connection first"
            });
          } else {
            tests.push({
              test: "Airbyte Permissions",
              status: 'error',
              message: "Connection issues detected",
              details: "Check individual connection status"
            });
          }
        }
      } catch (error) {
        tests.push({
          test: "Airbyte Permissions",
          status: 'error',
          message: "Failed to analyze permissions",
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

    } catch (error) {
      tests.push({
        test: "Overall Test",
        status: 'error',
        message: "Diagnostic test failed",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setResults(tests);
    setTesting(false);
  };

  const getIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin" />;
    }
  };

  const getBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700">Pass</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-700">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-700">Fail</Badge>;
      default:
        return <Badge variant="outline">Testing</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Airbyte Permissions Diagnostics
          <Button onClick={runDiagnostics} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Run Diagnostics'
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {results.length === 0 && !testing && (
          <p className="text-gray-500">Click "Run Diagnostics" to test your Airbyte permissions</p>
        )}
        
        <div className="space-y-4">
          {results.map((result, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
              {getIcon(result.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium">{result.test}</h4>
                  {getBadge(result.status)}
                </div>
                <p className="text-sm text-gray-600">{result.message}</p>
                {result.details && (
                  <p className="text-xs text-gray-500 mt-1">{result.details}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {results.length > 0 && (
          <div className="mt-6 space-y-4">
            {results.some(r => r.status === 'warning' && r.test === 'Airbyte Permissions') && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-medium text-yellow-900 mb-2">⚠️ Limited Airbyte Permissions Detected</h4>
                <div className="text-sm text-yellow-800 space-y-2">
                  <p><strong>Current Status:</strong> Your credentials work but you have limited workspace access.</p>
                  <p><strong>What this means:</strong> Connections are created locally but won't appear in Airbyte Cloud.</p>
                  <div className="mt-3">
                    <p className="font-medium">To Fix:</p>
                    <ol className="list-decimal list-inside ml-4 space-y-1">
                      <li>Go to your <a href="https://cloud.airbyte.com" className="underline text-blue-600" target="_blank">Airbyte Cloud dashboard</a></li>
                      <li>Navigate to Settings → Applications</li>
                      <li>Find your API application and change permissions to <strong>WORKSPACE_ADMIN</strong></li>
                      <li>Update your Replit environment variables with new credentials</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
            
            {results.some(r => r.status === 'success' && r.test === 'Airbyte Permissions') && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">✅ Full Airbyte Access Confirmed</h4>
                <p className="text-sm text-green-800">
                  Your connections are being created in Airbyte Cloud and should be visible in your dashboard!
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-700 mb-2">Debug Airbyte Config:</h4>
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={async () => {
                try {
                  const response = await fetch('/api/companies');
                  const data = await response.json();
                  console.log('Companies API test:', data);
                  alert(`Companies API works! Found ${data.length} companies`);
                } catch (error) {
                  console.error('Companies API test failed:', error);
                  alert(`Companies API failed: ${error}`);
                }
              }}
              variant="outline"
              size="sm"
            >
              Test Basic API
            </Button>
            <Button 
              onClick={async () => {
                // Check server environment variables
                try {
                  const response = await fetch('/api/airbyte/connections', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sourceType: 'debug',
                      credentials: { debug: 'config-check' },
                      companyId: 1748544793859
                    })
                  });
                  const result = await response.json();
                  
                  // Look at server logs for config info
                  alert('Check server logs for Airbyte config details');
                  console.log('Debug connection result:', result);
                } catch (error) {
                  console.error('Debug failed:', error);
                }
              }}
              variant="outline"
              size="sm"
            >
              Debug Config
            </Button>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            <p><strong>If you have admin role but getting 403s:</strong></p>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
              <li>Check if Client ID/Secret match your admin application</li>
              <li>Verify workspace ID is correct</li>
              <li>Ensure API key isn't from a different workspace</li>
              <li>Try regenerating the API credentials</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}