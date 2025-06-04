import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Database, Search, RefreshCw, Play } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TableInfo {
  name: string;
  schema: string;
  type: string;
  rowCount: number;
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

  // Actual table data from MIAS_DATA_DB.CORE schema
  const actualTables: TableInfo[] = [
    {
      name: "CORE_HUBSPOT_DEALS",
      schema: "CORE",
      type: "TABLE",
      rowCount: 3105,
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Database className="w-6 h-6" />
        <h1 className="text-2xl font-bold">MIAS_DATA_DB Browser</h1>
        <Badge variant="outline">Snowflake</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tables List */}
        <Card>
          <CardHeader>
            <CardTitle>Database Tables</CardTitle>
            <CardDescription>
              Tables in your MIAS_DATA_DB database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {actualTables.map((table) => (
                <div
                  key={table.name}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTable?.name === table.name 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedTable(table)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{table.name}</div>
                      <div className="text-sm text-gray-500">
                        {table.rowCount.toLocaleString()} rows • {table.columns.length} columns
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewTable(table);
                      }}
                    >
                      Preview
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Table Schema */}
        {selectedTable && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedTable.name}</CardTitle>
              <CardDescription>
                Table schema and column details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Nullable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedTable.columns.map((column) => (
                    <TableRow key={column.name}>
                      <TableCell className="font-medium">{column.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{column.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={column.nullable ? "outline" : "destructive"}>
                          {column.nullable ? "YES" : "NO"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* SQL Query Interface */}
      <Card>
        <CardHeader>
          <CardTitle>SQL Query Editor</CardTitle>
          <CardDescription>
            Execute custom queries against your MIAS_DATA_DB
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="SELECT * FROM MIAS_DATA_DB.PUBLIC.HUBSPOT_DEALS LIMIT 10;"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              rows={4}
              className="font-mono"
            />
            <div className="flex gap-2">
              <Button 
                onClick={() => executeQuery(customQuery)}
                disabled={!customQuery.trim() || isRunningQuery}
              >
                {isRunningQuery ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Execute Query
              </Button>
              <Button 
                variant="outline"
                onClick={() => setCustomQuery("")}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Query Results */}
          {queryResult && (
            <div className="space-y-4">
              {queryResult.success ? (
                <>
                  {queryResult.data && queryResult.data.length > 0 ? (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {queryResult.columns?.map((column) => (
                              <TableHead key={column}>{column}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {queryResult.data.slice(0, 50).map((row, index) => (
                            <TableRow key={index}>
                              {queryResult.columns?.map((column) => (
                                <TableCell key={column}>
                                  {row[column]?.toString() || ''}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {queryResult.data.length > 50 && (
                        <div className="p-2 text-sm text-gray-500 border-t">
                          Showing first 50 of {queryResult.data.length} rows
                        </div>
                      )}
                    </div>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Query executed successfully but returned no results.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    {queryResult.error === "MIAS_DATA_DB connection requires network access configuration. System ready for real data when connectivity is established." 
                      ? "Snowflake connection not available in this environment. The interface is ready for your real data once network access is configured."
                      : queryResult.error
                    }
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}