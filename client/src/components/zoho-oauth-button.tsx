import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ZohoOAuthButtonProps {
  companyId: number;
  onConnectionSuccess?: () => void;
}

interface ZohoConnectionStatus {
  connected: boolean;
  method?: string;
  userInfo?: {
    display_name: string;
    email: string;
    id: string;
  };
  orgInfo?: {
    name: string;
    domain_name: string;
    id: string;
  };
  expired?: boolean;
  expiresAt?: string;
  datacenter?: string;
}

export function ZohoOAuthButton({ companyId, onConnectionSuccess }: ZohoOAuthButtonProps) {
  const [status, setStatus] = useState<ZohoConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const { toast } = useToast();

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
    
    // Check for OAuth callback params
    const urlParams = new URLSearchParams(window.location.search);
    const zohoResult = urlParams.get('zoho');
    const service = urlParams.get('service');
    
    if (zohoResult === 'connected' || service === 'zoho') {
      toast({
        title: "Zoho CRM Connected",
        description: "Successfully connected to Zoho CRM with OAuth2!",
      });
      // Remove params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      checkConnectionStatus();
      onConnectionSuccess?.();
    } else if (zohoResult === 'error') {
      const message = urlParams.get('message') || 'Unknown error occurred';
      toast({
        title: "Zoho CRM Connection Failed",
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
      const response = await fetch(`/api/auth/zoho/status/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to check Zoho connection status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      
      // Redirect directly to Zoho OAuth authorization page
      window.location.href = `/api/auth/zoho/authorize?companyId=${companyId}`;
    } catch (error) {
      console.error('Failed to start Zoho OAuth:', error);
      toast({
        title: "Connection Error",
        description: "Failed to start Zoho OAuth flow. Please try again.",
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
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-50">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">Zoho CRM</h3>
          <p className="text-sm text-gray-600">Checking connection status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-green-300 transition-colors">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-50">
        <img 
          src="https://logo.clearbit.com/zoho.com" 
          alt="Zoho CRM" 
          className="w-6 h-6 object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = '<div class="w-5 h-5 text-primary"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m22 21-3-3m0 0L16 15m3 3h-3m3 0v-3"/></svg></div>';
            }
          }}
        />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="font-medium text-gray-900">Zoho CRM</h3>
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
              Connected as: {status.userInfo.display_name} ({status.userInfo.email})
            </p>
            {status.orgInfo && (
              <p className="text-xs text-gray-500">
                Organization: {status.orgInfo.name}
                {status.datacenter && ` (${status.datacenter.toUpperCase()})`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Connect your Zoho CRM account to sync business data
          </p>
        )}
      </div>
      
      <div className="flex flex-col space-y-2">
        {!status.connected || status.expired ? (
          <Button
            onClick={handleConnect}
            disabled={loading}
            size="sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Users className="w-4 h-4 mr-2" />
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