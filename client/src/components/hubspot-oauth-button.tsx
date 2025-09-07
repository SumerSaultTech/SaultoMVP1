import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HubSpotOAuthButtonProps {
  companyId: number;
  onConnectionSuccess?: () => void;
}

interface HubSpotConnectionStatus {
  connected: boolean;
  method?: string;
  portalInfo?: {
    portalId: number;
    user: string;
    hub_domain: string;
    user_id: number;
  };
  expired?: boolean;
  expiresAt?: string;
}

export function HubSpotOAuthButton({ companyId, onConnectionSuccess }: HubSpotOAuthButtonProps) {
  const [status, setStatus] = useState<HubSpotConnectionStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const { toast } = useToast();

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
    
    // Check for OAuth callback params
    const urlParams = new URLSearchParams(window.location.search);
    const hubspotResult = urlParams.get('hubspot');
    
    if (hubspotResult === 'connected') {
      toast({
        title: "HubSpot Connected",
        description: "Successfully connected to HubSpot with OAuth2!",
      });
      // Remove params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      checkConnectionStatus();
      onConnectionSuccess?.();
    } else if (hubspotResult === 'error') {
      const message = urlParams.get('message') || 'Unknown error occurred';
      toast({
        title: "HubSpot Connection Failed",
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
      const response = await fetch(`/api/auth/hubspot/status/${companyId}`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Failed to check HubSpot connection status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleConnect = async () => {
    try {
      setLoading(true);
      
      // Redirect directly to the authorization endpoint (like Jira)
      window.location.href = `/api/auth/hubspot/authorize?companyId=${companyId}`;
    } catch (error) {
      console.error('Failed to start HubSpot OAuth:', error);
      toast({
        title: "Connection Error",
        description: "Failed to start HubSpot OAuth flow. Please try again.",
        variant: "destructive",
      });
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
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-100">
          <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">HubSpot</h3>
          <p className="text-sm text-gray-600">Checking connection status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-100">
        <img 
          src="https://cdn.worldvectorlogo.com/logos/hubspot-1.svg" 
          alt="HubSpot" 
          className="w-6 h-6 object-contain"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = '<div class="w-5 h-5 text-orange-600"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></div>';
            }
          }}
        />
      </div>
      
      <div className="flex-1">
        <div className="flex items-center space-x-2 mb-1">
          <h3 className="font-medium text-gray-900">HubSpot CRM</h3>
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
        
        {status.connected && status.portalInfo ? (
          <div className="space-y-1">
            <p className="text-sm text-gray-600">
              Connected as: {status.portalInfo.user}
            </p>
            <p className="text-xs text-gray-500">
              Portal: {status.portalInfo.hub_domain} (ID: {status.portalInfo.portalId})
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            Connect your HubSpot CRM to sync contacts, companies, and deals
          </p>
        )}
      </div>
      
      <div className="flex flex-col space-y-2">
        {!status.connected || status.expired ? (
          <Button
            onClick={handleConnect}
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700 text-white"
            size="sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Building2 className="w-4 h-4 mr-2" />
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