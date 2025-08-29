import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Briefcase, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface JiraOAuthButtonProps {
  companyId: number;
  onConnectionSuccess?: () => void;
}

interface JiraConnectionStatus {
  connected: boolean;
  method?: string;
  userInfo?: {
    name: string;
    email: string;
    account_id: string;
  };
  resources?: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  expired?: boolean;
  expiresAt?: string;
}

export function JiraOAuthButton({ companyId, onConnectionSuccess }: JiraOAuthButtonProps) {
  const [status, setStatus] = useState<JiraConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const { toast } = useToast();

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
    
    // Check for OAuth callback params
    const urlParams = new URLSearchParams(window.location.search);
    const jiraResult = urlParams.get('jira');
    
    if (jiraResult === 'connected') {
      toast({
        title: "Jira Connected",
        description: "Successfully connected to Jira with OAuth2!",
      });
      // Remove params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      checkConnectionStatus();
      onConnectionSuccess?.();
    } else if (jiraResult === 'error') {
      const message = urlParams.get('message') || 'Unknown error occurred';
      toast({
        title: "Jira Connection Failed",
        description: decodeURIComponent(message),
        variant: "destructive",
      });
      // Remove params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setChecking(true);
      const response = await fetch(`/api/auth/jira/status/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to check Jira connection status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/auth/jira/authorize');
      if (response.ok) {
        const data = await response.json();
        // Redirect to Jira OAuth authorization page
        window.location.href = data.authUrl;
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Failed to start Jira OAuth:', error);
      toast({
        title: "Connection Error",
        description: "Failed to start Jira OAuth flow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    // You can implement disconnect functionality here
    // For now, just show a message
    toast({
      title: "Disconnect",
      description: "Disconnect functionality would be implemented here.",
    });
  };

  if (checking) {
    return (
      <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">Jira</h3>
          <p className="text-sm text-gray-600">Checking connection status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100">
        <img 
          src="https://cdn.worldvectorlogo.com/logos/jira-1.svg" 
          alt="Jira" 
          className="w-6 h-6 object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = '<div class="w-5 h-5 text-blue-600"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>';
            }
          }}
        />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="font-medium text-gray-900">Jira</h3>
          {status.connected ? (
            <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs border-gray-300">
              Not Connected
            </Badge>
          )}
          {status.expired && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              Token Expired
            </Badge>
          )}
        </div>
        
        {status.connected && status.userInfo ? (
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              Connected as: {status.userInfo.name} ({status.userInfo.email})
            </p>
            {status.resources && status.resources.length > 0 && (
              <p className="text-xs text-gray-500">
                {status.resources.length} Jira instance{status.resources.length !== 1 ? 's' : ''} available
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Connect your Jira account to sync project data
          </p>
        )}
      </div>
      
      <div className="flex flex-col space-y-2">
        {!status.connected || status.expired ? (
          <Button
            onClick={handleConnect}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            size="sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Briefcase className="w-4 h-4 mr-2" />
            )}
            {status.expired ? 'Reconnect' : 'Connect with OAuth2'}
          </Button>
        ) : (
          <Button
            onClick={handleDisconnect}
            variant="outline"
            size="sm"
            className="text-gray-600 border-gray-300"
          >
            Disconnect
          </Button>
        )}
      </div>
    </div>
  );
}