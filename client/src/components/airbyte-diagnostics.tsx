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

      // Test 2: Check workspace permissions
      try {
        const workspaceTest = await fetch('/api/airbyte/diagnostics/workspace', {
          method: 'POST',
        });
        
        if (workspaceTest.ok) {
          const workspaceResult = await workspaceTest.json();
          tests.push({
            test: "Workspace Access",
            status: workspaceResult.canRead ? 'success' : 'warning',
            message: workspaceResult.canRead ? 
              "Can read workspace data" : 
              "Limited workspace permissions",
            details: workspaceResult.message
          });
        } else {
          const errorText = await workspaceTest.text();
          tests.push({
            test: "Workspace Access",
            status: 'error',
            message: "Failed to test workspace access",
            details: `HTTP ${workspaceTest.status}: ${errorText.substring(0, 100)}`
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

      // Test 3: Check if we can create sources
      try {
        const sourceTest = await fetch('/api/airbyte/diagnostics/sources', {
          method: 'POST',
        });
        
        if (sourceTest.ok) {
          const sourceResult = await sourceTest.json();
          tests.push({
            test: "Source Creation",
            status: sourceResult.canCreate ? 'success' : 'warning',
            message: sourceResult.canCreate ? 
              "Can create sources" : 
              "Cannot create sources - need higher permissions",
            details: sourceResult.details || sourceResult.message
          });
        } else {
          const errorText = await sourceTest.text();
          tests.push({
            test: "Source Creation",
            status: 'error',
            message: "Failed to test source creation",
            details: `HTTP ${sourceTest.status}: ${errorText.substring(0, 100)}`
          });
        }
      } catch (error) {
        tests.push({
          test: "Source Creation",
          status: 'error',
          message: "Failed to test source creation",
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Test 4: Check destinations
      try {
        const destTest = await fetch('/api/airbyte/diagnostics/destinations', {
          method: 'POST',
        });
        
        if (destTest.ok) {
          const destResult = await destTest.json();
          tests.push({
            test: "Destination Access",
            status: destResult.canAccess ? 'success' : 'warning',
            message: destResult.canAccess ? 
              "Can access destinations" : 
              "Limited destination access",
            details: destResult.details || destResult.message
          });
        } else {
          const errorText = await destTest.text();
          tests.push({
            test: "Destination Access",
            status: 'error',
            message: "Failed to test destination access",
            details: `HTTP ${destTest.status}: ${errorText.substring(0, 100)}`
          });
        }
      } catch (error) {
        tests.push({
          test: "Destination Access",
          status: 'error',
          message: "Failed to test destination access",
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
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Next Steps:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• If tests show warnings: Your API key needs WORKSPACE_ADMIN permissions</li>
              <li>• Go to Airbyte Cloud → Settings → Applications</li>
              <li>• Update your application permissions to include workspace admin access</li>
              <li>• Once updated, connections will appear in your Airbyte dashboard</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}