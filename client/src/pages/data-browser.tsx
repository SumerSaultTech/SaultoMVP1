import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, Search, Play, Eye, BarChart3, Zap, Users, DollarSign } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TableInfo {
  name: string;
  schema: string;
  type: string;
  rowCount: number;
  description: string;
  icon: any;
  category: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>;
}

interface QueryResult {
  success: boolean;
  data?: any[];
  columns?: string[];
  error?: string;
}

export default function DataBrowser() {
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Actual table data from MIAS_DATA_DB.CORE schema
  const actualTables: TableInfo[] = [
    {
      name: "CORE_HUBSPOT_DEALS",
      schema: "CORE",
      type: "TABLE",
      rowCount: 3105,
      description: "Sales opportunities and deal pipeline data from HubSpot CRM",
      icon: DollarSign,
      category: "Sales",
      columns: [
        { name: "DEAL_ID", type: "VARCHAR", nullable: false },
        { name: "DEAL_NAME", type: "VARCHAR", nullable: true },
        { name: "AMOUNT", type: "NUMBER", nullable: true },
        { name: "STAGE", type: "VARCHAR", nullable: true },
        { name: "CLOSE_DATE", type: "DATE", nullable: true },
        { name: "ASSOCIATED_CONTACT", type: "VARCHAR", nullable: true },
        { name: "COMPANY", type: "VARCHAR", nullable: true },
      ]
    },
    {
      name: "CORE_HUBSPOT_CALLS",
      schema: "CORE",
      type: "TABLE", 
      rowCount: 6036,
      description: "Call activity records and customer engagement data from HubSpot",
      icon: Users,
      category: "Engagement",
      columns: [
        { name: "CALL_ID", type: "VARCHAR", nullable: false },
        { name: "CONTACT_ID", type: "VARCHAR", nullable: true },
        { name: "DEAL_ID", type: "VARCHAR", nullable: true },
        { name: "DURATION", type: "NUMBER", nullable: true },
        { name: "OUTCOME", type: "VARCHAR", nullable: true },
        { name: "CREATED_DATE", type: "TIMESTAMP", nullable: false },
      ]
    },
    {
      name: "CORE_QUICKBOOKS_REVENUE",
      schema: "CORE",
      type: "TABLE",
      rowCount: 7796,
      description: "Revenue transactions and income records from QuickBooks accounting",
      icon: BarChart3,
      category: "Finance",
      columns: [
        { name: "TRANSACTION_ID", type: "VARCHAR", nullable: false },
        { name: "AMOUNT", type: "NUMBER", nullable: false },
        { name: "CUSTOMER_ID", type: "VARCHAR", nullable: true },
        { name: "TRANSACTION_DATE", type: "DATE", nullable: false },
        { name: "CATEGORY", type: "VARCHAR", nullable: true },
        { name: "DESCRIPTION", type: "VARCHAR", nullable: true },
      ]
    },
    {
      name: "CORE_QUICKBOOKS_EXPENSES",
      schema: "CORE",
      type: "TABLE",
      rowCount: 88,
      description: "Business expense records and cost tracking from QuickBooks",
      icon: Zap,
      category: "Finance",
      columns: [
        { name: "EXPENSE_ID", type: "VARCHAR", nullable: false },
        { name: "AMOUNT", type: "NUMBER", nullable: false },
        { name: "VENDOR", type: "VARCHAR", nullable: true },
        { name: "EXPENSE_DATE", type: "DATE", nullable: false },
        { name: "CATEGORY", type: "VARCHAR", nullable: true },
        { name: "DESCRIPTION", type: "VARCHAR", nullable: true },
      ]
    }
  ];

  const executeQuery = async (sql: string) => {
    setIsRunningQuery(true);
    try {
      const response = await fetch('/api/snowflake/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      
      const result = await response.json();
      setQueryResult(result);
      setActiveTab("results");
    } catch (error) {
      setQueryResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsRunningQuery(false);
    }
  };

  const previewTable = (table: TableInfo) => {
    const sql = `SELECT * FROM MIAS_DATA_DB.${table.schema}.${table.name} LIMIT 10`;
    setCustomQuery(sql);
    executeQuery(sql);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Sales': return 'bg-green-50 text-green-700 border-green-200';
      case 'Finance': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Engagement': return 'bg-purple-50 text-purple-700 border-purple-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number' && value > 1000) {
      return value.toLocaleString();
    }
    return String(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Database className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">MIAS Data Browser</h1>
              <p className="text-lg text-gray-600">Explore your HubSpot & QuickBooks data</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="bg-white px-4 py-2">
              <Database className="w-4 h-4 mr-2" />
              Snowflake Cloud
            </Badge>
            <Badge variant="outline" className="bg-white px-4 py-2">
              MIAS_DATA_DB.CORE
            </Badge>
          </div>
        </div>

        {/* Tables Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {actualTables.map((table) => {
            const Icon = table.icon;
            return (
              <Card 
                key={table.name}
                className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-2 ${
                  selectedTable?.name === table.name 
                    ? 'ring-2 ring-blue-500 border-blue-300 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedTable(table)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <Badge className={getCategoryColor(table.category)}>
                        {table.category}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-semibold truncate">
                    {table.name.replace('CORE_', '')}
                  </CardTitle>
                  <CardDescription className="text-sm text-gray-600 leading-relaxed">
                    {table.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Rows</span>
                      <span className="font-semibold text-lg">
                        {table.rowCount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Columns</span>
                      <span className="font-semibold">
                        {table.columns.length}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewTable(table);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* SQL Query Editor */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  SQL Query Editor
                </CardTitle>
                <CardDescription>
                  Execute custom queries against your MIAS_DATA_DB
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="SELECT * FROM MIAS_DATA_DB.CORE.CORE_HUBSPOT_DEALS LIMIT 10"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  className="min-h-[120px] font-mono text-sm"
                />
                <Button 
                  onClick={() => executeQuery(customQuery)}
                  disabled={!customQuery.trim() || isRunningQuery}
                  className="w-full"
                >
                  {isRunningQuery ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Executing Query...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Query
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Table Schema */}
          <div>
            {selectedTable ? (
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <selectedTable.icon className="w-5 h-5" />
                    Schema Details
                  </CardTitle>
                  <CardDescription>
                    {selectedTable.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="text-sm text-gray-500">Rows</div>
                        <div className="font-semibold text-lg">
                          {selectedTable.rowCount.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Schema</div>
                        <div className="font-semibold">{selectedTable.schema}</div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3">Columns</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {selectedTable.columns.map((column, index) => (
                          <div 
                            key={index}
                            className="flex justify-between items-center p-2 rounded border border-gray-100"
                          >
                            <div>
                              <div className="font-medium text-sm">{column.name}</div>
                              <div className="text-xs text-gray-500">{column.type}</div>
                            </div>
                            {!column.nullable && (
                              <Badge variant="secondary" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Select a table to view its schema</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Query Results */}
        {queryResult && (
          <Card>
            <CardHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="results">Query Results</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <TabsContent value="overview">
                <div className="text-center py-8">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Execute a query to see results here</p>
                </div>
              </TabsContent>
              <TabsContent value="results">
                {queryResult.success ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        Query executed successfully
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {queryResult.data?.length || 0} rows returned
                      </span>
                    </div>
                    
                    {queryResult.data && queryResult.data.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto max-h-96">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50">
                                {queryResult.columns?.map((column, index) => (
                                  <TableHead key={index} className="font-semibold text-gray-700">
                                    {column}
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {queryResult.data.map((row, rowIndex) => (
                                <TableRow 
                                  key={rowIndex}
                                  className="hover:bg-gray-50 transition-colors"
                                >
                                  {queryResult.columns?.map((column, colIndex) => (
                                    <TableCell 
                                      key={colIndex}
                                      className="py-3 px-4 text-sm"
                                    >
                                      <div className="max-w-xs truncate">
                                        {formatValue(row[column])}
                                      </div>
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700">
                      <strong>Query Error:</strong> {queryResult.error}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}