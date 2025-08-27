import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Setup from "@/pages/setup";
import DataBrowser from "@/pages/data-browser";
import CompanySelection from "@/pages/company-selection";
import Login from "@/pages/login";

import AdminPage from "@/pages/admin";
import MetricsManagement from "@/pages/metrics-management";
import UserManagement from "@/pages/user-management";
import SaultoChat from "@/pages/saultochat";
import IntegrationsCanvas from "@/pages/integrations-canvas";
import Sidebar from "@/components/layout/sidebar";

function Router({ isAuthenticated, selectedCompany }: { isAuthenticated: boolean; selectedCompany: string | null }) {
  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  if (!selectedCompany) {
    return <CompanySelection />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/setup" component={Setup} />
      <Route path="/data-browser" component={DataBrowser} />
      <Route path="/integrations-canvas" component={IntegrationsCanvas} />
      <Route path="/saultochat" component={SaultoChat} />
      <Route path="/metrics" component={MetricsManagement} />
      <Route path="/users" component={UserManagement} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/companies" component={CompanySelection} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => localStorage.getItem("isAuthenticated") === "true"
  );
  const [selectedCompany, setSelectedCompany] = useState<string | null>(
    () => localStorage.getItem("selectedCompany")
  );

  useEffect(() => {
    // Listen for storage changes
    const handleStorageChange = () => {
      setIsAuthenticated(localStorage.getItem("isAuthenticated") === "true");
      setSelectedCompany(localStorage.getItem("selectedCompany"));
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Also check periodically for changes (in case they happen in the same tab)
    const interval = setInterval(handleStorageChange, 100);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {!isAuthenticated ? (
          <Router isAuthenticated={isAuthenticated} selectedCompany={selectedCompany} />
        ) : (
          <div className="h-screen flex bg-gray-50 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-0">
              <Router isAuthenticated={isAuthenticated} selectedCompany={selectedCompany} />
            </div>
          </div>
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
