
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, Copy, ExternalLink } from "lucide-react";

interface ConfigTest {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'testing';
  message: string;
  details?: string;
  action?: string;
}

export function AirbyteConfigDebugger() {
  const [tests, setTests] = useState<ConfigTest[]>([]);
  const [testing, setTesting] = useState(false);

  const runConfigTests = async () => {
    setTesting(true);
    setTests([]);
    
    const configTests: ConfigTest[] = [];

    try {
      // Test 1: Basic API connectivity
      configTests.push({
        name: "API Authentication",
        status: 'testing',
        message: "Testing basic authentication..."
      });

      const authTest = await fetch('/api/airbyte/diagnostics/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const authResult = await authTest.json();
      
      if (authResult.canRead) {
        configTests[0] = {
          name: "API Authentication",
          status: 'pass',
          message: "Authentication successful",
          details: authResult.message
        };
      } else {
        configTests[0] = {
          name: "API Authentication", 
          status: 'fail',
          message: "Authentication failed",
          details: authResult.message,
          action: "Check your AIRBYTE_CLIENT_ID and AIRBYTE_CLIENT_SECRET"
        };
      }

      // Test 2: Sources access
      configTests.push({
        name: "Sources Access",
        status: 'testing',
        message: "Testing sources endpoint access..."
      });

      const sourcesTest = await fetch('/api/airbyte/diagnostics/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const sourcesResult = await sourcesTest.json();
      
      if (sourcesResult.canCreate) {
        configTests[1] = {
          name: "Sources Access",
          status: 'pass',
          message: "Can access sources endpoint",
          details: sourcesResult.details
        };
      } else {
        configTests[1] = {
          name: "Sources Access",
          status: 'fail', 
          message: sourcesResult.message,
          details: sourcesResult.details,
          action: "Upgrade application permissions to WORKSPACE_ADMIN in Airbyte Cloud"
        };
      }

      // Test 3: Destinations access
      configTests.push({
        name: "Destinations Access",
        status: 'testing',
        message: "Testing destinations endpoint access..."
      });

      const destTest = await fetch('/api/airbyte/diagnostics/destinations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const destResult = await destTest.json();
      
      if (destResult.canAccess) {
        configTests[2] = {
          name: "Destinations Access",
          status: 'pass',
          message: "Can access destinations endpoint",
          details: destResult.details
        };
      } else {
        configTests[2] = {
          name: "Destinations Access",
          status: 'fail',
          message: destResult.message,
          details: destResult.details,
          action: "Upgrade application permissions to WORKSPACE_ADMIN in Airbyte Cloud"
        };
      }

      // Test 4: Workspace permissions analysis
      configTests.push({
        name: "Workspace Analysis",
        status: 'testing',
        message: "Analyzing workspace configuration..."
      });

      const workspaceTest = await fetch('/api/airbyte/test-workspace');
      const workspaceResult = await workspaceTest.json();
      
      if (workspaceResult.success && workspaceResult.data) {
        const summary = workspaceResult.data.summary;
        
        if (summary.hasWorkspaceAccess && summary.hasSourceAccess && summary.hasDestinationAccess && summary.hasConnectionAccess) {
          configTests[3] = {
            name: "Workspace Analysis",
            status: 'pass',
            message: "Full workspace access confirmed",
            details: "WORKSPACE_ADMIN permissions detected"
          };
        } else if (summary.hasWorkspaceAccess) {
          configTests[3] = {
            name: "Workspace Analysis", 
            status: 'warning',
            message: "Limited workspace access detected",
            details: "You have basic access but limited creation permissions",
            action: "Upgrade to WORKSPACE_ADMIN in Airbyte Cloud → Settings → Applications"
          };
        } else {
          configTests[3] = {
            name: "Workspace Analysis",
            status: 'fail',
            message: "No workspace access",
            details: "Cannot access workspace resources",
            action: "Check workspace ID and application permissions"
          };
        }
      } else {
        configTests[3] = {
          name: "Workspace Analysis",
          status: 'fail',
          message: "Workspace test failed",
          details: workspaceResult.error || "Unknown error"
        };
      }

    } catch (error) {
      configTests.push({
        name: "Configuration Test",
        status: 'fail',
        message: "Failed to run configuration tests",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setTests(configTests);
    setTesting(false);
  };

  const getIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <div className="w-5 h-5 animate-spin border-2 border-blue-500 border-t-transparent rounded-full" />;
    }
  };

  const getBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-100 text-green-700">Pass</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-700">Warning</Badge>;
      case 'fail':
        return <Badge className="bg-red-100 text-red-700">Fail</Badge>;
      default:
        return <Badge variant="outline">Testing</Badge>;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Airbyte Configuration Debugger
          <Button onClick={runConfigTests} disabled={testing}>
            {testing ? 'Running Tests...' : 'Run Diagnostics'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tests.length === 0 && !testing && (
          <p className="text-gray-500">Click "Run Diagnostics" to test your Airbyte configuration</p>
        )}
        
        <div className="space-y-4">
          {tests.map((test, index) => (
            <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
              {getIcon(test.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{test.name}</h4>
                  {getBadge(test.status)}
                </div>
                <p className="text-sm text-gray-600 mb-1">{test.message}</p>
                {test.details && (
                  <p className="text-xs text-gray-500 mb-2">{test.details}</p>
                )}
                {test.action && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <strong>Action Required:</strong> {test.action}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {tests.some(t => t.status === 'fail' && t.action?.includes('WORKSPACE_ADMIN')) && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h4 className="font-medium text-red-900 mb-3">🔧 How to Fix WORKSPACE_ADMIN Permissions</h4>
            <div className="space-y-2 text-sm text-red-800">
              <div className="flex items-center gap-2">
                <span className="font-medium">1.</span>
                <span>Go to</span>
                <a 
                  href="https://cloud.airbyte.com" 
                  target="_blank" 
                  className="inline-flex items-center gap-1 text-blue-600 underline"
                >
                  Airbyte Cloud <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">2.</span>
                <span>Navigate to Settings → Applications</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">3.</span>
                <span>Find your API application and click "Edit"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">4.</span>
                <span>Change permissions from "WORKSPACE_READER" to</span>
                <Badge className="bg-green-100 text-green-700 text-xs">WORKSPACE_ADMIN</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">5.</span>
                <span>Save changes and update your Replit Secrets if needed</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-700 mb-2">Current Configuration:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Workspace ID:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-1 rounded text-xs">bc926a02-3f86-446a-84cb-740d9a13caef</code>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => copyToClipboard("bc926a02-3f86-446a-84cb-740d9a13caef")}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <div>
                <span className="text-gray-500">API Endpoint:</span>
                <code className="bg-white px-2 py-1 rounded text-xs block mt-1">https://api.airbyte.com/v1</code>
              </div>
            </div>
          </div>
          
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">⚠️ Common Issues:</h4>
            <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
              <li>Application permissions set to WORKSPACE_READER instead of WORKSPACE_ADMIN</li>
              <li>Client ID/Secret from a different application or workspace</li>
              <li>Workspace ID doesn't match your actual workspace</li>
              <li>API credentials expired or regenerated in Airbyte Cloud</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
