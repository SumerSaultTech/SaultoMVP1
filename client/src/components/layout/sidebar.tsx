import { Link, useLocation } from "wouter";
import { Database, BarChart3, Settings, Shield, Target, LogOut, Users, MessageCircle, GitBranch, FileText, Menu, ChevronLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Sidebar() {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get company ID from localStorage
  const getCompanyId = () => {
    const selectedCompany = localStorage.getItem("selectedCompany");
    if (selectedCompany) {
      try {
        const company = JSON.parse(selectedCompany);
        return company.id;
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const companyId = getCompanyId();

  // Get user data from localStorage to check if sysadmin
  const getUserData = () => {
    const isAuthenticated = localStorage.getItem("isAuthenticated");
    if (isAuthenticated === "true") {
      // Check if user data is stored (from login response)
      const userData = localStorage.getItem("userData");
      if (userData) {
        try {
          return JSON.parse(userData);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  };

  const userData = getUserData();
  const isSysAdmin = userData?.isAdmin === true;

  // Build company-specific navigation paths using unique company ID
  const getNavPath = (path: string) => {
    if (!companyId) return path; // Fallback to legacy paths
    
    if (path === "/") {
      return `/company/${companyId}`;
    }
    return `/company/${companyId}${path}`;
  };

  const navItems = [
    { path: "/", icon: BarChart3, label: "Dashboard" },
    { path: "/metric-reports", icon: FileText, label: "Metric Reports" },
    { path: "/saultochat", icon: MessageCircle, label: "SaultoChat" },
    { path: "/integrations-canvas", icon: GitBranch, label: "Integration Canvas" },
    { path: "/metrics", icon: Target, label: "Metrics Management" },
    { path: "/data-browser", icon: Database, label: "Data Browser" },
    { path: "/setup", icon: Settings, label: "Setup & Config" },
    { path: "/users", icon: Users, label: "User Management" },
  ];

  const isActive = (path: string) => {
    const navPath = getNavPath(path);
    if (navPath.endsWith("/company/" + companyId) && location === navPath) return true;
    if (path !== "/" && location.startsWith(navPath)) return true;
    return false;
  };


  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white shadow-sm border-r border-gray-200 flex flex-col h-screen transition-all duration-300 ease-in-out`}>
      {/* Header */}
      <div className={`bg-white border-b border-gray-200 ${isCollapsed ? 'px-2' : 'px-6'} py-4 transition-all duration-300`}>
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <Link href={getNavPath("/")}>
              <img
                src="/assets/logo.png"
                alt="Logo"
                className="w-48 h-20 object-contain max-w-full cursor-pointer hover:opacity-80 transition-opacity"
              />
            </Link>
          ) : (
            <div className="flex-1 flex justify-center">
              <Link href={getNavPath("/")}>
                <BarChart3 className="w-6 h-6 text-saulto-600 cursor-pointer hover:opacity-80 transition-opacity" />
              </Link>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="ml-2 text-gray-500 hover:text-gray-700"
          >
            {isCollapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'p-4'} py-4 space-y-2 overflow-y-auto transition-all duration-300`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const navPath = getNavPath(item.path);
          return (
            <Link key={item.path} href={navPath}>
              <div
                className={`sidebar-nav-item ${isActive(item.path) ? "active" : ""} ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5" />
                {!isCollapsed && <span>{item.label}</span>}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Sysadmin Company Switch & Logout Buttons */}
      <div className={`${isCollapsed ? 'px-2' : 'p-4'} py-4 border-t border-gray-200 transition-all duration-300 space-y-2`}>
        {/* Switch Company Button - Only for Sysadmins */}
        {isSysAdmin && (
          <Button
            onClick={() => {
              // Clear company selection and redirect to company selection page
              localStorage.removeItem("selectedCompany");
              window.location.href = "/companies";
            }}
            variant="outline"
            className={`w-full flex items-center justify-center space-x-2 text-green-600 hover:text-green-800 border-green-200 hover:border-green-300 ${isCollapsed ? 'p-2' : ''}`}
            title={isCollapsed ? "Switch Company" : undefined}
          >
            <Building2 className="w-4 h-4" />
            {!isCollapsed && <span>Switch Company</span>}
          </Button>
        )}
        
        {/* Sign Out Button */}
        <Button
          onClick={() => {
            localStorage.clear();
            window.location.href = "/login";
          }}
          variant="outline"
          className={`w-full flex items-center justify-center space-x-2 text-gray-600 hover:text-gray-800 ${isCollapsed ? 'p-2' : ''}`}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </div>
  );
}
