import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, Download, RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";

export default function PipelineLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  const { data: activities, isLoading, refetch } = useQuery({
    queryKey: ["/api/pipeline-activities"],
  });

  const filteredActivities = activities?.filter((activity: any) => {
    const matchesSearch = activity.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || activity.type === selectedType;
    return matchesSearch && matchesType;
  }) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-100 text-green-800">Success</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "warning":
        return <Badge className="bg-amber-100 text-amber-800">Warning</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sync": return "🔄";
      case "deploy": return "🚀";
      case "kpi_update": return "📊";
      case "error": return "❌";
      default: return "📋";
    }
  };

  const getActivitiesByType = (type: string) => {
    return filteredActivities.filter((activity: any) => activity.type === type);
  };

  const getActivityStats = () => {
    const total = filteredActivities.length;
    const success = filteredActivities.filter((a: any) => a.status === "success").length;
    const errors = filteredActivities.filter((a: any) => a.status === "error").length;
    const warnings = filteredActivities.filter((a: any) => a.status === "warning").length;
    
    return { total, success, errors, warnings };
  };

  const stats = getActivityStats();

  const ActivityItem = ({ activity }: { activity: any }) => (
    <div className="flex items-start space-x-4 p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-b-0">
      <div className="flex items-center space-x-2">
        <div className="text-lg">{getTypeIcon(activity.type)}</div>
        {getStatusIcon(activity.status)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{activity.description}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(activity.timestamp).toLocaleString()}
            </p>
            {activity.metadata && (
              <div className="mt-2">
                <details className="text-xs text-gray-600">
                  <summary className="cursor-pointer hover:text-gray-800">View Details</summary>
                  <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(activity.metadata, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge(activity.status)}
            <Badge variant="outline" className="text-xs capitalize">
              {activity.type}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Header 
        title="Pipeline Logs" 
        subtitle="Monitor data pipeline activities and troubleshoot issues"
        actions={
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Activities</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  </div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Successful</p>
                    <p className="text-2xl font-bold text-green-600">{stats.success}</p>
                  </div>
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Warnings</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.warnings}</p>
                  </div>
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Errors</p>
                    <p className="text-2xl font-bold text-red-600">{stats.errors}</p>
                  </div>
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="sync">Sync</option>
                    <option value="deploy">Deploy</option>
                    <option value="kpi_update">KPI Update</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activities */}
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All Activities ({filteredActivities.length})</TabsTrigger>
              <TabsTrigger value="sync">Sync ({getActivitiesByType("sync").length})</TabsTrigger>
              <TabsTrigger value="deploy">Deploy ({getActivitiesByType("deploy").length})</TabsTrigger>
              <TabsTrigger value="error">Errors ({getActivitiesByType("error").length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle>All Pipeline Activities</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoading ? (
                    <div className="p-6">
                      <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
                            <div className="w-8 h-8 bg-gray-200 rounded-full" />
                            <div className="flex-1">
                              <div className="h-4 bg-gray-200 rounded mb-2" />
                              <div className="h-3 bg-gray-200 rounded w-1/3" />
                            </div>
                            <div className="w-16 h-6 bg-gray-200 rounded" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : filteredActivities.length > 0 ? (
                    <div>
                      {filteredActivities.map((activity: any) => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="font-medium text-gray-900 mb-2">No activities found</h3>
                      <p className="text-sm text-gray-500">
                        {searchTerm || selectedType !== "all" 
                          ? "Try adjusting your search or filters"
                          : "Pipeline activities will appear here as they occur"
                        }
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sync">
              <Card>
                <CardHeader>
                  <CardTitle>Data Sync Activities</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {getActivitiesByType("sync").length > 0 ? (
                    <div>
                      {getActivitiesByType("sync").map((activity: any) => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="text-4xl mb-4">🔄</div>
                      <h3 className="font-medium text-gray-900 mb-2">No sync activities</h3>
                      <p className="text-sm text-gray-500">Data sync activities will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deploy">
              <Card>
                <CardHeader>
                  <CardTitle>Model Deployment Activities</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {getActivitiesByType("deploy").length > 0 ? (
                    <div>
                      {getActivitiesByType("deploy").map((activity: any) => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="text-4xl mb-4">🚀</div>
                      <h3 className="font-medium text-gray-900 mb-2">No deployment activities</h3>
                      <p className="text-sm text-gray-500">Model deployment activities will appear here</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="error">
              <Card>
                <CardHeader>
                  <CardTitle>Error Activities</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {getActivitiesByType("error").length > 0 ? (
                    <div>
                      {getActivitiesByType("error").map((activity: any) => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="text-4xl mb-4">✅</div>
                      <h3 className="font-medium text-gray-900 mb-2">No errors found</h3>
                      <p className="text-sm text-gray-500">Your pipeline is running smoothly!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </>
  );
}
