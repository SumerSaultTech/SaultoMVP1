import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Database, Settings, Table, GitBranch, MessageSquare, BarChart3, User, Wifi, WifiOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import KPIAssistant from "@/components/KPIAssistant";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

interface DashboardData {
  status: {
    snowflake: string;
    fivetran: string;
    lastSync: string | null;
  };
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const { data: dashboardData } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const navigation = [
    { name: "Dashboard", href: "/", icon: BarChart3 },
    { name: "Setup & Config", href: "/setup", icon: Settings },
    { name: "Table Browser", href: "/tables", icon: Table },
    { name: "Model Registry", href: "/models", icon: GitBranch },
  ];

  const getPageTitle = () => {
    switch (location) {
      case "/":
        return "Analytics Dashboard";
      case "/setup":
        return "Setup & Configuration";
      case "/tables":
        return "Table Browser";
      case "/models":
        return "Model Registry";
      default:
        return "DataFlow";
    }
  };

  const getPageDescription = () => {
    switch (location) {
      case "/":
        return "Monitor your key business metrics and data pipeline status";
      case "/setup":
        return "Configure Snowflake connections and Fivetran data sources";
      case "/tables":
        return "Explore synced and modeled data tables";
      case "/models":
        return "Manage and deploy SQL models across layers";
      default:
        return "";
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
        {/* Logo and Brand */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-slate-800">DataFlow</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <a
                  className={cn(
                    "nav-item",
                    isActive && "nav-item-active"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Connection Status */}
        <div className="p-4 border-t border-slate-200">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Snowflake</span>
              <div className="flex items-center space-x-1">
                <div
                  className={cn(
                    "status-indicator",
                    dashboardData?.status.snowflake === "connected"
                      ? "status-connected"
                      : "status-disconnected"
                  )}
                />
                <span
                  className={cn(
                    "text-xs",
                    dashboardData?.status.snowflake === "connected"
                      ? "text-green-600"
                      : "text-red-600"
                  )}
                >
                  {dashboardData?.status.snowflake === "connected" ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Fivetran</span>
              <div className="flex items-center space-x-1">
                <div
                  className={cn(
                    "status-indicator",
                    dashboardData?.status.fivetran === "connected"
                      ? "status-connected"
                      : "status-disconnected"
                  )}
                />
                <span
                  className={cn(
                    "text-xs",
                    dashboardData?.status.fivetran === "connected"
                      ? "text-green-600"
                      : "text-red-600"
                  )}
                >
                  {dashboardData?.status.fivetran === "connected" ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">{getPageTitle()}</h1>
              <p className="text-slate-600 text-sm">{getPageDescription()}</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setIsAssistantOpen(!isAssistantOpen)}
                className="flex items-center space-x-2"
              >
                <MessageSquare className="w-4 h-4" />
                <span>KPI Assistant</span>
              </Button>
              <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-slate-600" />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* KPI Assistant Sidebar */}
      <KPIAssistant isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
    </div>
  );
}
