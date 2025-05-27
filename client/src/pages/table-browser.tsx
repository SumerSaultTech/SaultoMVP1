import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Database, Table, Calendar, BarChart3, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface TableInfo {
  name: string;
  rowCount: number;
  lastUpdated: string;
  schema?: string;
  type?: string;
}

interface DataSource {
  id: number;
  name: string;
  type: string;
  status: string;
  lastSync: string | null;
  recordCount: number;
}

interface SqlModel {
  id: number;
  name: string;
  layer: string;
  description: string;
  status: string;
  lastDeployed: string | null;
  rowCount: number | null;
}

export default function TableBrowser() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSchema, setSelectedSchema] = useState<string>("all");
  const [selectedLayer, setSelectedLayer] = useState<string>("all");

  const { data: tables = [], isLoading: tablesLoading } = useQuery<TableInfo[]>({
    queryKey: ["/api/tables"],
  });

  const { data: dataSources = [] } = useQuery<DataSource[]>({
    queryKey: ["/api/data-sources"],
  });

  const { data: models = [] } = useQuery<SqlModel[]>({
    queryKey: ["/api/models"],
  });

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedSchema === "all" || table.schema === selectedSchema)
  );

  const filteredModels = models.filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedLayer === "all" || model.layer === selectedLayer)
  );

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
      case "deployed":
        return "default";
      case "syncing":
      case "running":
        return "secondary";
      case "error":
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header and Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search tables and models..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={selectedSchema} onValueChange={setSelectedSchema}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Schema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schemas</SelectItem>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Sources Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-primary" />
            <span>Connected Data Sources</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dataSources.map((source) => (
              <div key={source.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{source.name}</div>
                    <div className="text-sm text-slate-600">
                      {formatNumber(source.recordCount)} records
                    </div>
                  </div>
                </div>
                <Badge variant={getStatusBadgeVariant(source.status)}>
                  {source.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tables and Models Tabs */}
      <Tabs defaultValue="tables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tables" className="flex items-center space-x-2">
            <Table className="w-4 h-4" />
            <span>Raw Tables ({filteredTables.length})</span>
          </TabsTrigger>
          <TabsTrigger value="models" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Models ({filteredModels.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Raw Tables */}
        <TabsContent value="tables">
          <Card>
            <CardHeader>
              <CardTitle>Raw Data Tables</CardTitle>
            </CardHeader>
            <CardContent>
              {tablesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-16 bg-slate-200 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : filteredTables.length === 0 ? (
                <div className="text-center py-12">
                  <Table className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">No Tables Found</h3>
                  <p className="text-slate-500">
                    {searchTerm 
                      ? "No tables match your search criteria"
                      : "No tables available. Ensure your data sources are connected and syncing."
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTables.map((table, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Table className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{table.name}</div>
                          <div className="text-sm text-slate-600">
                            {table.schema && `${table.schema} • `}
                            {formatNumber(table.rowCount)} rows
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-slate-600">Last Updated</div>
                        <div className="text-sm font-medium text-slate-800">
                          {formatDate(table.lastUpdated)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SQL Models */}
        <TabsContent value="models">
          <div className="space-y-4">
            {/* Layer Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={selectedLayer} onValueChange={setSelectedLayer}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Layer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Layers</SelectItem>
                  <SelectItem value="stg">Staging (stg)</SelectItem>
                  <SelectItem value="int">Intermediate (int)</SelectItem>
                  <SelectItem value="core">Core</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>SQL Models</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredModels.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">No Models Found</h3>
                    <p className="text-slate-500">
                      {searchTerm 
                        ? "No models match your search criteria"
                        : "No SQL models available. Deploy models from the setup page."
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredModels.map((model) => (
                      <div key={model.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className={cn(
                            "w-12 h-12 rounded-lg flex items-center justify-center",
                            model.layer === "stg" && "bg-gray-100",
                            model.layer === "int" && "bg-yellow-100",
                            model.layer === "core" && "bg-blue-100"
                          )}>
                            <BarChart3 className={cn(
                              "w-6 h-6",
                              model.layer === "stg" && "text-gray-600",
                              model.layer === "int" && "text-yellow-600",
                              model.layer === "core" && "text-blue-600"
                            )} />
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-slate-800">{model.name}</span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  model.layer === "stg" && "border-gray-300 text-gray-700",
                                  model.layer === "int" && "border-yellow-300 text-yellow-700",
                                  model.layer === "core" && "border-blue-300 text-blue-700"
                                )}
                              >
                                {model.layer}
                              </Badge>
                            </div>
                            <div className="text-sm text-slate-600">
                              {model.description}
                            </div>
                            {model.rowCount && (
                              <div className="text-sm text-slate-500">
                                {formatNumber(model.rowCount)} rows
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <Badge variant={getStatusBadgeVariant(model.status)}>
                            {model.status}
                          </Badge>
                          <div className="text-sm text-slate-600">
                            {formatDate(model.lastDeployed)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
