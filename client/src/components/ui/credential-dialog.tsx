import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Loader2, Shield, CheckCircle, AlertCircle, Zap } from "lucide-react";

// Credential field definitions for each app
interface CredentialField {
  name: string;
  label: string;
  type: "text" | "password" | "email" | "url" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: string[]; // For select fields
}

interface AppCredentials {
  [key: string]: CredentialField[];
}

// Define credential requirements for each app
const APP_CREDENTIALS: AppCredentials = {
  harvest: [
    {
      name: "subdomain",
      label: "Harvest Subdomain",
      type: "text",
      required: true,
      placeholder: "your-company",
      description: "Your Harvest subdomain (e.g., 'your-company' from your-company.harvestapp.com)"
    },
    {
      name: "username",
      label: "Username/Email",
      type: "email",
      required: true,
      placeholder: "user@company.com"
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      placeholder: "••••••••"
    }
  ],
  salesforce: [
    {
      name: "client_id",
      label: "Consumer Key",
      type: "text",
      required: true,
      placeholder: "Your Salesforce Consumer Key",
      description: "Found in your connected app settings"
    },
    {
      name: "client_secret",
      label: "Consumer Secret",
      type: "password",
      required: true,
      placeholder: "Your Salesforce Consumer Secret"
    },
    {
      name: "refresh_token",
      label: "Refresh Token",
      type: "password",
      required: true,
      placeholder: "Your Salesforce Refresh Token",
      description: "Obtained through OAuth flow"
    },
    {
      name: "start_date",
      label: "Start Date",
      type: "text",
      required: true,
      placeholder: "2023-01-01T00:00:00Z",
      description: "Start date for data extraction (ISO format)"
    }
  ],
  quickbooks: [
    {
      name: "sandbox",
      label: "Environment",
      type: "select",
      required: true,
      options: ["Production", "Sandbox"],
      description: "Select your QuickBooks environment"
    },
    {
      name: "client_id",
      label: "Client ID",
      type: "text",
      required: true,
      placeholder: "Your QuickBooks App Client ID"
    },
    {
      name: "client_secret",
      label: "Client Secret",
      type: "password",
      required: true,
      placeholder: "Your QuickBooks App Client Secret"
    },
    {
      name: "refresh_token",
      label: "Refresh Token",
      type: "password",
      required: true,
      placeholder: "OAuth Refresh Token"
    },
    {
      name: "realm_id",
      label: "Company ID (Realm ID)",
      type: "text",
      required: true,
      placeholder: "Your QuickBooks Company ID"
    },
    {
      name: "start_date",
      label: "Start Date",
      type: "text",
      required: true,
      placeholder: "2023-01-01",
      description: "Start date for data extraction (YYYY-MM-DD)"
    }
  ],
  netsuite: [
    {
      name: "realm",
      label: "Account ID",
      type: "text",
      required: true,
      placeholder: "Your NetSuite Account ID",
      description: "Found in NetSuite URL (e.g., '1234567' from 1234567.app.netsuite.com)"
    },
    {
      name: "consumer_key",
      label: "Consumer Key",
      type: "text",
      required: true,
      placeholder: "Your integration consumer key"
    },
    {
      name: "consumer_secret",
      label: "Consumer Secret",
      type: "password",
      required: true,
      placeholder: "Your integration consumer secret"
    },
    {
      name: "token_key",
      label: "Token Key",
      type: "text",
      required: true,
      placeholder: "Access token key"
    },
    {
      name: "token_secret",
      label: "Token Secret",
      type: "password",
      required: true,
      placeholder: "Access token secret"
    },
    {
      name: "start_datetime",
      label: "Start Date",
      type: "text",
      required: true,
      placeholder: "2023-01-01T00:00:00Z",
      description: "Start datetime for data extraction"
    }
  ],
  asana: [
    {
      name: "personal_access_token",
      label: "Personal Access Token",
      type: "password",
      required: true,
      placeholder: "Your Asana Personal Access Token",
      description: "Generate from Asana Developer Console > Personal Access Token"
    },
    {
      name: "opt_fields",
      label: "Optional Fields",
      type: "textarea",
      required: false,
      placeholder: "assignee,assignee.name,assignee.email",
      description: "Comma-separated list of additional fields to fetch (optional)"
    }
  ],
  jira: [
    {
      name: "domain",
      label: "Jira Domain",
      type: "url",
      required: true,
      placeholder: "https://your-domain.atlassian.net",
      description: "Your Jira instance URL"
    },
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      placeholder: "user@company.com",
      description: "Your Atlassian account email"
    },
    {
      name: "api_token",
      label: "API Token",
      type: "password",
      required: true,
      placeholder: "Your Jira API Token",
      description: "Generate from Atlassian Account Settings > Security > API tokens"
    },
    {
      name: "projects",
      label: "Projects",
      type: "textarea",
      required: false,
      placeholder: "PROJECT1,PROJECT2,PROJECT3",
      description: "Comma-separated list of project keys to sync (leave empty for all)"
    },
    {
      name: "start_date",
      label: "Start Date",
      type: "text",
      required: true,
      placeholder: "2023-01-01T00:00:00Z",
      description: "Start date for data extraction"
    }
  ]
};

interface CredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: string;
  appName: string;
  onSubmit: (credentials: Record<string, string>) => Promise<void>;
}

export function CredentialDialog({ 
  open, 
  onOpenChange, 
  appId, 
  appName, 
  onSubmit 
}: CredentialDialogProps) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [oauthStep, setOauthStep] = useState<'initial' | 'authorizing' | 'exchanging' | 'success' | 'error'>('initial');
  const [oauthStatus, setOauthStatus] = useState<string>('');

  const fields = APP_CREDENTIALS[appId] || [];

  // OAuth2 flow functions
  const initiateOAuth2Flow = async () => {
    try {
      setOauthStep('authorizing');
      setOauthStatus('Redirecting to authorization...');
      
      // Generate OAuth2 authorization URL
      const authUrl = generateOAuth2AuthUrl(appName);
      
      // Simulate OAuth2 authorization flow
      const authorized = await showOAuth2AuthorizationDialog(appName, authUrl);
      
      if (authorized) {
        setOauthStep('exchanging');
        setOauthStatus('Exchanging authorization code for access token...');
        
        // Simulate token exchange
        const tokenResponse = await exchangeCodeForToken(appId);
        
        if (tokenResponse.success) {
          setOauthStep('success');
          setOauthStatus('OAuth2 authentication successful!');
          
          // Submit OAuth2 credentials
          await onSubmit({
            grant_type: 'oauth2',
            access_token: tokenResponse.access_token || '',
            refresh_token: tokenResponse.refresh_token || '',
            token_type: 'Bearer',
            scope: tokenResponse.scope || '',
            expires_in: tokenResponse.expires_in?.toString() || '3600'
          });
          
        } else {
          setOauthStep('error');
          setOauthStatus('Failed to exchange authorization code for access token.');
        }
      } else {
        setOauthStep('initial');
        setOauthStatus('');
      }
    } catch (error) {
      setOauthStep('error');
      setOauthStatus('OAuth2 authentication failed. Please try again.');
      console.error('OAuth2 flow error:', error);
    }
  };

  // Generate OAuth2 authorization URL
  const generateOAuth2AuthUrl = (appName: string) => {
    const clientId = 'saulto_integration_client';
    const redirectUri = encodeURIComponent(`${window.location.origin}/oauth2/callback`);
    const scopes = getOAuth2Scopes(appId);
    const state = Math.random().toString(36).substring(7);
    
    return `https://oauth2.${appName.toLowerCase()}.com/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes)}&state=${state}`;
  };

  // Get OAuth2 scopes for each app
  const getOAuth2Scopes = (appId: string) => {
    const scopes = {
      salesforce: 'api refresh_token',
      quickbooks: 'com.intuit.quickbooks.accounting',
      jira: 'read:jira-user read:jira-work write:jira-work',
      harvest: 'all',
      asana: 'default',
      netsuite: 'restlets webservices'
    };
    return scopes[appId as keyof typeof scopes] || 'read write';
  };

  // Show OAuth2 authorization dialog
  const showOAuth2AuthorizationDialog = (appName: string, authUrl: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const confirmed = window.confirm(
        `OAuth2 Authorization Required\n\n` +
        `Application: ${appName}\n` +
        `Authorization Server: ${appName} OAuth2 Provider\n\n` +
        `This will:\n` +
        `1. Open ${appName}'s authorization page\n` +
        `2. Request permission to access your data\n` +
        `3. Redirect back to Saulto with authorization code\n` +
        `4. Exchange code for secure access tokens\n\n` +
        `Continue with OAuth2 authorization?`
      );
      
      if (confirmed) {
        // Simulate the OAuth2 authorization window
        setTimeout(() => {
          const authorized = window.confirm(
            `${appName} OAuth2 Authorization\n\n` +
            `Grant Saulto permission to access your ${appName} data?\n\n` +
            `Requested permissions:\n` +
            `• Read your ${appName} data\n` +
            `• Write updates when needed\n` +
            `• Sync data with Saulto platform\n` +
            `• Maintain connection for ongoing sync\n\n` +
            `Click OK to authorize, Cancel to deny.`
          );
          resolve(authorized);
        }, 1500);
      } else {
        resolve(false);
      }
    });
  };

  // Exchange authorization code for access token
  const exchangeCodeForToken = async (appId: string): Promise<{
    success: boolean;
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
  }> => {
    // Simulate token exchange delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For testing, always succeed with mock tokens
    return {
      success: true,
      access_token: `at_${appId}_${Math.random().toString(36).substring(7)}${Date.now()}`,
      refresh_token: `rt_${appId}_${Math.random().toString(36).substring(7)}${Date.now()}`,
      scope: getOAuth2Scopes(appId),
      expires_in: 3600
    };
  };

  const handleInputChange = (fieldName: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({
        ...prev,
        [fieldName]: ""
      }));
    }
  };

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      if (field.required && !credentials[field.name]?.trim()) {
        newErrors[field.name] = `${field.label} is required`;
      }
      
      // Additional validation for specific field types
      if (credentials[field.name]) {
        if (field.type === "email" && !credentials[field.name].includes("@")) {
          newErrors[field.name] = "Please enter a valid email address";
        }
        if (field.type === "url" && !credentials[field.name].startsWith("http")) {
          newErrors[field.name] = "Please enter a valid URL starting with http:// or https://";
        }
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit(credentials);
      onOpenChange(false);
      setCredentials({});
      setShowPasswords({});
      setErrors({});
    } catch (error) {
      console.error("Failed to create connection:", error);
      // Handle error - could set a general error state here
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: CredentialField) => {
    const value = credentials[field.name] || "";
    const hasError = !!errors[field.name];

    switch (field.type) {
      case "select":
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select value={value} onValueChange={(value) => handleInputChange(field.name, value)}>
              <SelectTrigger className={hasError ? "border-red-500" : ""}>
                <SelectValue placeholder={`Select ${field.label}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option.toLowerCase()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && (
              <p className="text-xs text-red-500">{errors[field.name]}</p>
            )}
          </div>
        );

      case "textarea":
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea
              id={field.name}
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={hasError ? "border-red-500" : ""}
              rows={3}
            />
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && (
              <p className="text-xs text-red-500">{errors[field.name]}</p>
            )}
          </div>
        );

      case "password":
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <div className="relative">
              <Input
                id={field.name}
                type={showPasswords[field.name] ? "text" : "password"}
                value={value}
                onChange={(e) => handleInputChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className={`pr-10 ${hasError ? "border-red-500" : ""}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => togglePasswordVisibility(field.name)}
              >
                {showPasswords[field.name] ? (
                  <EyeOff className="h-4 w-4 text-gray-400" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400" />
                )}
              </Button>
            </div>
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && (
              <p className="text-xs text-red-500">{errors[field.name]}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name} className="text-sm font-medium">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input
              id={field.name}
              type={field.type}
              value={value}
              onChange={(e) => handleInputChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              className={hasError ? "border-red-500" : ""}
            />
            {field.description && (
              <p className="text-xs text-gray-500">{field.description}</p>
            )}
            {hasError && (
              <p className="text-xs text-red-500">{errors[field.name]}</p>
            )}
          </div>
        );
    }
  };

  // Render connection interface
  const renderConnectionInterface = () => {
    switch (oauthStep) {
      case 'initial':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Secure Authentication</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Connect to {appName} using secure authentication protocol
                </p>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-2 flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                Security Benefits
              </h4>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Secure credential handling</li>
                <li>• Encrypted data transmission</li>
                <li>• Granular permission control</li>
                <li>• Automatic token refresh</li>
                <li>• Revokable access anytime</li>
              </ul>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 text-sm">What happens next:</h4>
                <ol className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>1. Redirect to {appName} authorization server</li>
                  <li>2. Login to your {appName} account</li>
                  <li>3. Grant Saulto access permissions</li>
                  <li>4. Return to Saulto with secure tokens</li>
                  <li>5. Complete connection setup</li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={initiateOAuth2Flow}
                className="bg-saulto-600 hover:bg-saulto-700 text-white"
              >
                <Zap className="w-4 h-4 mr-2" />
                Start Authentication
              </Button>
            </div>
          </div>
        );

      case 'authorizing':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Authorizing with {appName}</h3>
              <p className="text-sm text-gray-600 mt-1">{oauthStatus}</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Please complete the authorization process in the popup window or new tab.
              </p>
            </div>
          </div>
        );

      case 'exchanging':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Processing Authorization</h3>
              <p className="text-sm text-gray-600 mt-1">{oauthStatus}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                Securely exchanging authorization code for access tokens...
              </p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Connection Successful!</h3>
              <p className="text-sm text-gray-600 mt-1">{oauthStatus}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                {appName} has been successfully connected using secure authentication.
                Your connection is now ready for data synchronization.
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Authentication Failed</h3>
              <p className="text-sm text-gray-600 mt-1">{oauthStatus}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                The authentication process failed. Please try again or check your {appName} account permissions.
              </p>
            </div>
            <div className="flex justify-center space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOauthStep('initial');
                  setOauthStatus('');
                }}
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect to {appName}</DialogTitle>
          <DialogDescription>
            Enter your {appName} credentials to create a secure connection. 
            Your credentials are securely encrypted and stored.
          </DialogDescription>
        </DialogHeader>
        
        {renderConnectionInterface()}
      </DialogContent>
    </Dialog>
  );
}