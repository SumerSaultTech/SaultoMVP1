import { Link, useLocation } from "wouter";
import { Database, BarChart3, Settings, Shield, Target, LogOut, Users, MessageCircle, GitBranch, FileText, Menu, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Sidebar() {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    { path: "/", icon: BarChart3, label: "Dashboard" },
    { path: "/metric-reports", icon: FileText, label: "Metric Reports" },
    { path: "/saultochat", icon: MessageCircle, label: "SaultoChat" },
    { path: "/integrations-canvas", icon: GitBranch, label: "Integration Canvas" },
    { path: "/metrics", icon: Target, label: "Metrics Management" },
    { path: "/data-browser", icon: Database, label: "Data Browser" },
    { path: "/setup", icon: Settings, label: "Setup & Config" },
    { path: "/admin", icon: Shield, label: "Admin Panel" },
    { path: "/users", icon: Users, label: "User Management" },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location === "/") return true;
    if (path !== "/" && location.startsWith(path)) return true;
    return false;
  };


  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-white shadow-sm border-r border-gray-200 flex flex-col h-screen transition-all duration-300 ease-in-out`}>
      {/* Header */}
      <div className={`bg-white border-b border-gray-200 ${isCollapsed ? 'px-2' : 'px-6'} py-4 transition-all duration-300`}>
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <Link href="/">
              <a className="cursor-pointer hover:opacity-80 transition-opacity">
                <img 
                  src="/assets/logo.png" 
                  alt="Logo" 
                  className="w-48 h-20 object-contain max-w-full"
                />
              </a>
            </Link>
          ) : (
            <div className="flex-1 flex justify-center">
              <Link href="/">
                <a className="cursor-pointer hover:opacity-80 transition-opacity">
                  <BarChart3 className="w-6 h-6 text-saulto-600" />
                </a>
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
          return (
            <Link key={item.path} href={item.path}>
              <a 
                className={`sidebar-nav-item ${isActive(item.path) ? "active" : ""} ${isCollapsed ? 'justify-center px-2' : ''}`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5" />
                {!isCollapsed && <span>{item.label}</span>}
              </a>
            </Link>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className={`${isCollapsed ? 'px-2' : 'p-4'} py-4 border-t border-gray-200 transition-all duration-300`}>
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
