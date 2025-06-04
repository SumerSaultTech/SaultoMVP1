import { Link, useLocation } from "wouter";
import { Database, BarChart3, Settings, Table, Shield, Target, Building2, LogOut, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

export default function Sidebar() {
  const [location] = useLocation();

  const { data: setupStatus } = useQuery({
    queryKey: ["/api/setup-status"],
  });

  const navItems = [
    { path: "/", icon: BarChart3, label: "Dashboard" },
    { path: "/metrics", icon: Target, label: "Metrics Management" },
    { path: "/setup", icon: Settings, label: "Setup & Config" },
    { path: "/users", icon: Users, label: "User Management" },
    { path: "/admin", icon: Shield, label: "Admin Panel" },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };

  const getSystemStatus = () => {
    if (!setupStatus) return { text: "Loading...", color: "bg-gray-500" };
    
    if (setupStatus.snowflakeConnected && setupStatus.fivetranConfigured && 
        setupStatus.modelsDeployed === setupStatus.totalModels && setupStatus.totalModels > 0) {
      return { text: "All Systems Operational", color: "bg-green-500" };
    }
    
    if (setupStatus.snowflakeConnected || setupStatus.fivetranConfigured) {
      return { text: "Partially Configured", color: "bg-amber-500" };
    }
    
    return { text: "Setup Required", color: "bg-red-500" };
  };

  const systemStatus = getSystemStatus();

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <Database className="text-white text-sm" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">DataSync Pro</h1>
            <p className="text-xs text-gray-500">Data Warehouse Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.path} href={item.path}>
              <a className={`sidebar-nav-item ${isActive(item.path) ? "active" : ""}`}>
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Company Switcher */}
      <div className="p-4 border-t border-gray-200">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                {(() => {
                  const selectedCompany = localStorage.getItem("selectedCompany");
                  if (selectedCompany) {
                    const company = JSON.parse(selectedCompany);
                    return company.name;
                  }
                  return "No Company";
                })()}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                localStorage.removeItem("selectedCompany");
                window.location.href = "/companies";
              }}
              className="text-blue-600 hover:text-blue-800"
            >
              <LogOut className="w-3 h-3" />
            </Button>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            Switch company to test isolation
          </p>
        </div>

        {/* Status Indicator */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 ${systemStatus.color} rounded-full animate-pulse`} />
            <span className="text-sm font-medium text-green-800">{systemStatus.text}</span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            System status
          </p>
        </div>

        {/* Logout Button */}
        <Button
          onClick={() => {
            localStorage.clear();
            window.location.href = "/login";
          }}
          variant="outline"
          className="w-full flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-800"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Button>
      </div>
    </div>
  );
}
