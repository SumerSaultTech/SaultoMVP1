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
import { Eye, EyeOff, Loader2 } from "lucide-react";

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

  const fields = APP_CREDENTIALS[appId] || [];

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect to {appName}</DialogTitle>
          <DialogDescription>
            Enter your {appName} credentials to create an Airbyte connection. 
            Your credentials are securely encrypted and stored.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(renderField)}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Connection...
                </>
              ) : (
                "Create Connection"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}