import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Database, Filter, Download, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";

interface TableData {
  tableName: string;
  rowCount: number;
  columns: string[];
  sampleData: Record<string, any>[];
}

interface ColumnPreviewProps {
  tableName: string;
}

function ColumnPreview({ tableName }: ColumnPreviewProps) {
  const { data: previewData, isLoading } = useQuery({
    queryKey: ["/api/postgres/table-data", tableName, "preview"],
    queryFn: async () => {
      const response = await fetch(`/api/postgres/table-data/${tableName}?limit=3`);
      if (!response.ok) throw new Error('Failed to fetch preview data');
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-gray-200 rounded animate-pulse w-1/4" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!previewData?.sampleData || previewData.sampleData.length === 0) {
    return (
      <div className="text-gray-500 text-sm">
        No preview data available for this table.
      </div>
    );
  }

  const columns = previewData.columns || [];
  const sampleData = previewData.sampleData.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Showing first 3 rows • {previewData.rowCount} total rows • {columns.length} columns
      </div>
      
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column: string) => (
                <TableHead key={column} className="font-semibold text-xs">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleData.map((row: any, index: number) => (
              <TableRow key={index}>
                {columns.map((column: string) => (
                  <TableCell key={column} className="max-w-xs text-xs">
                    <div className="truncate" title={String(row[column] || "")}>
                      {row[column] !== null && row[column] !== undefined
                        ? String(row[column])
                        : <span className="text-gray-400 italic">null</span>
                      }
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function DataBrowser() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [filterColumn, setFilterColumn] = useState<string>("");
  const [filterValue, setFilterValue] = useState("");

  // Fetch available tables from PostgreSQL
  const { data: tables, isLoading: tablesLoading, refetch: refetchTables } = useQuery({
    queryKey: ["/api/postgres/tables"],
  });

  // Fetch data for selected table
  const { data: tableData, isLoading: dataLoading, refetch: refetchData } = useQuery({
    queryKey: ["/api/postgres/table-data", selectedTable, filterColumn, filterValue],
    queryFn: async () => {
      if (!selectedTable) return null;
      
      const params = new URLSearchParams();
      if (filterColumn) params.append('filterColumn', filterColumn);
      if (filterValue) params.append('filterValue', filterValue);
      
      const url = `/api/postgres/table-data/${selectedTable}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch table data: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!selectedTable,
  });

  const filteredTables = tables?.filter((table: any) =>
    table.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setFilterColumn("");
    setFilterValue("");
  };

  const handleExportData = () => {
    if (!tableData?.sampleData || !tableData?.columns) return;
    
    const csv = [
      tableData.columns.join(","),
      ...tableData.sampleData.map((row: any) =>
        tableData.columns.map((col: string) => 
          JSON.stringify(row[col] || "")
        ).join(",")
      )
    ].join("\n");
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTable}_data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar - Table List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Database className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Data Browser</h1>
              <p className="text-sm text-gray-500">PostgreSQL Analytics</p>
            </div>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search tables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tablesLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTables.map((table: any) => (
                <Card
                  key={table.table_name}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTable === table.table_name ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => handleTableSelect(table.table_name)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{table.table_name}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {table.table_schema} schema
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {table.row_count || 0} rows
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200">
          <Button
            onClick={() => refetchTables()}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={tablesLoading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Tables
          </Button>
        </div>
      </div>

      {/* Main Content - Data View */}
      <div className="flex-1 flex flex-col">
        {selectedTable ? (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedTable}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {tableData?.rowCount || 0} total rows
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    onClick={() => refetchData()}
                    variant="outline"
                    size="sm"
                    disabled={dataLoading}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                  <Button
                    onClick={handleExportData}
                    variant="outline"
                    size="sm"
                    disabled={!tableData?.sampleData}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Filters */}
              {tableData?.columns && (
                <div className="flex items-center space-x-4 mt-4">
                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Filter:</span>
                  </div>
                  <Select value={filterColumn} onValueChange={setFilterColumn}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {tableData.columns.map((column: string) => (
                        <SelectItem key={column} value={column}>
                          {column}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Filter value..."
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-48"
                    disabled={!filterColumn}
                  />
                  {filterColumn && filterValue && (
                    <Button
                      onClick={() => {
                        setFilterColumn("");
                        setFilterValue("");
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Column Preview */}
            {selectedTable && (
              <div className="px-6 py-4 border-b bg-gray-50">
                <h3 className="text-lg font-semibold mb-3">Table Schema: {selectedTable}</h3>
                <ColumnPreview tableName={selectedTable} />
              </div>
            )}


          </>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Browse Your Data</h3>
              <p className="text-gray-500 max-w-md">
                Select a table from the sidebar to view its data, apply filters, and export results.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}