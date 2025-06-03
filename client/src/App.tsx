import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Setup from "@/pages/setup";
import TableBrowser from "@/pages/table-browser";
import CompanySelection from "@/pages/company-selection";

import AdminPage from "@/pages/admin";
import MetricsManagement from "@/pages/metrics-management";
import UserManagement from "@/pages/user-management";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  // Check if user has selected a company
  const selectedCompany = localStorage.getItem("selectedCompany");
  
  if (!selectedCompany) {
    return <CompanySelection />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/setup" component={Setup} />
      <Route path="/tables" component={TableBrowser} />
      <Route path="/metrics" component={MetricsManagement} />
      <Route path="/users" component={UserManagement} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/companies" component={CompanySelection} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen flex bg-gray-50">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Router />
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
