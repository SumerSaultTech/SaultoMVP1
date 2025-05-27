import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Database, Table, ExternalLink, Filter } from "lucide-react";

export default function TableBrowser() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");

  const { data: dataSources, isLoading: sourcesLoading } = useQuery({
    queryKey: ["/api/data-sources"],
  });

  // Mock table data - in a real app, this would come from Snowflake
  const mockTables = [
    { name: "salesforce_accounts", source: "Salesforce", type: "raw", rows: 15420, lastSync: "2 minutes ago" },
    { name: "salesforce_opportunities", source: "Salesforce", type: "raw", rows: 8930, lastSync: "2 minutes ago" },
    { name: "salesforce_contacts", source: "Salesforce", type: "raw", rows: 45230, lastSync: "2 minutes ago" },
    { name: "hubspot_companies", source: "HubSpot", type: "raw", rows: 3450, lastSync: "5 minutes ago" },
    { name: "hubspot_deals", source: "HubSpot", type: "raw", rows: 12340, lastSync: "5 minutes ago" },
    { name: "hubspot_contacts", source: "HubSpot", type: "raw", rows: 28900, lastSync: "5 minutes ago" },
    { name: "quickbooks_customers", source: "QuickBooks", type: "raw", rows: 2340, lastSync: "10 minutes ago" },
    { name: "quickbooks_invoices", source: "QuickBooks", type: "raw", rows: 9870, lastSync: "10 minutes ago" },
    { name: "stg_salesforce__accounts", source: "Staging", type: "transformed", rows: 15420, lastSync: "1 hour ago" },
    { name: "stg_hubspot__contacts", source: "Staging", type: "transformed", rows: 28900, lastSync: "1 hour ago" },
    { name: "int_customer_unified", source: "Intermediate", type: "transformed", rows: 47660, lastSync: "2 hours ago" },
    { name: "core_customer_metrics", source: "Core", type: "transformed", rows: 47660, lastSync: "3 hours ago" },
  ];

  const filteredTables = mockTables.filter(table => {
    const matchesSearch = table.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSource = selectedSource === "all" || table.source.toLowerCase() === selectedSource.toLowerCase();
    return matchesSearch && matchesSource;
  });

  const getTablesByType = (type: "raw" | "transformed") => {
    return filteredTables.filter(table => table.type === type);
  };

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case "salesforce": return "🌩️";
      case "hubspot": return "🟠";
      case "quickbooks": return "🟢";
      case "staging": return "🔄";
      case "intermediate": return "⚙️";
      case "core": return "💎";
      default: return "📊";
    }
  };

  const TableCard = ({ table }: { table: any }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">{getSourceIcon(table.source)}</div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-gray-900 truncate">{table.name}</h3>
              <p className="text-sm text-gray-500">Source: {table.source}</p>
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                <span>{table.rows.toLocaleString()} rows</span>
                <span>Last sync: {table.lastSync}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={table.type === "raw" ? "secondary" : "default"}>
              {table.type}
            </Badge>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Header 
        title="Table Browser" 
        subtitle="Explore your synced data and deployed models"
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tables..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Sources</option>
                    <option value="salesforce">Salesforce</option>
                    <option value="hubspot">HubSpot</option>
                    <option value="quickbooks">QuickBooks</option>
                    <option value="staging">Staging</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="core">Core</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Sources Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sourcesLoading ? (
              [...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="animate-pulse space-y-2">
                      <div className="h-6 bg-gray-200 rounded w-1/2" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              dataSources?.map((source: any) => (
                <Card key={source.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{getSourceIcon(source.name)}</div>
                        <div>
                          <h3 className="font-medium">{source.name}</h3>
                          <p className="text-sm text-gray-500">{source.tableCount} tables</p>
                        </div>
                      </div>
                      <Badge className={`status-badge ${source.status}`}>
                        {source.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Tables by Type */}
          <Tabs defaultValue="raw" className="space-y-4">
            <TabsList>
              <TabsTrigger value="raw" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Raw Data ({getTablesByType("raw").length})
              </TabsTrigger>
              <TabsTrigger value="transformed" className="flex items-center gap-2">
                <Table className="h-4 w-4" />
                Transformed ({getTablesByType("transformed").length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="raw" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getTablesByType("raw").map((table, index) => (
                  <TableCard key={index} table={table} />
                ))}
              </div>
              {getTablesByType("raw").length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="font-medium text-gray-900 mb-2">No raw tables found</h3>
                    <p className="text-sm text-gray-500">
                      Configure your data connectors to start syncing raw data.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="transformed" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getTablesByType("transformed").map((table, index) => (
                  <TableCard key={index} table={table} />
                ))}
              </div>
              {getTablesByType("transformed").length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Table className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="font-medium text-gray-900 mb-2">No transformed tables found</h3>
                    <p className="text-sm text-gray-500">
                      Deploy your SQL models to create transformed views.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
