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
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { data: columns, isLoading } = useQuery({
    queryKey: ["/api/snowflake/columns", tableName],
    queryFn: async () => {
      const response = await fetch(`/api/snowflake/columns/${tableName}`);
      if (!response.ok) throw new Error('Failed to fetch columns');
      return response.json();
    },
    enabled: isExpanded,
  });

  if (!isExpanded) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(true);
        }}
        className="flex items-center text-xs text-gray-500 hover:text-gray-700 mt-2"
      >
        <ChevronRight className="w-3 h-3 mr-1" />
        Show columns
      </button>
    );
  }

  return (
    <div className="mt-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(false);
        }}
        className="flex items-center text-xs text-gray-500 hover:text-gray-700 mb-2"
      >
        <ChevronDown className="w-3 h-3 mr-1" />
        Hide columns
      </button>
      
      {isLoading ? (
        <div className="space-y-1">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {columns?.slice(0, 8).map((column: any, index: number) => (
            <div key={index} className="text-xs text-gray-600 truncate">
              <span className="font-mono">{column.COLUMN_NAME}</span>
              <span className="text-gray-400 ml-1">({column.DATA_TYPE})</span>
            </div>
          ))}
          {columns?.length > 8 && (
            <div className="text-xs text-gray-400">
              +{columns.length - 8} more columns
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DataBrowser() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [filterColumn, setFilterColumn] = useState<string>("");
  const [filterValue, setFilterValue] = useState("");

  // Fetch available tables from Snowflake
  const { data: tables, isLoading: tablesLoading, refetch: refetchTables } = useQuery({
    queryKey: ["/api/snowflake/tables"],
  });

  // Fetch data for selected table
  const { data: tableData, isLoading: dataLoading, refetch: refetchData } = useQuery({
    queryKey: ["/api/snowflake/table-data", selectedTable, filterColumn, filterValue],
    queryFn: async () => {
      if (!selectedTable) return null;
      
      const params = new URLSearchParams();
      if (filterColumn) params.append('filterColumn', filterColumn);
      if (filterValue) params.append('filterValue', filterValue);
      
      const url = `/api/snowflake/table-data/${selectedTable}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch table data: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: !!selectedTable,
  });

  const filteredTables = tables?.filter((table: any) =>
    table.TABLE_NAME.toLowerCase().includes(searchTerm.toLowerCase())
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
              <p className="text-sm text-gray-500">MIAS_DATA_DB</p>
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
                  key={table.TABLE_NAME}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTable === table.TABLE_NAME ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => handleTableSelect(table.TABLE_NAME)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{table.TABLE_NAME}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {table.TABLE_SCHEMA} schema
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {table.ROW_COUNT || 0} rows
                      </Badge>
                    </div>
                    <ColumnPreview tableName={table.TABLE_NAME} />
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

            {/* Data Table */}
            <div className="flex-1 overflow-auto p-6">
              {dataLoading ? (
                <Card>
                  <CardContent className="p-8">
                    <div className="animate-pulse space-y-4">
                      <div className="h-8 bg-gray-200 rounded w-full" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                      <div className="h-32 bg-gray-200 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ) : tableData?.sampleData ? (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {tableData.columns.map((column: string) => (
                              <TableHead key={column} className="font-semibold">
                                {column}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableData.sampleData.map((row: any, index: number) => (
                            <TableRow key={index}>
                              {tableData.columns.map((column: string) => (
                                <TableCell key={column} className="max-w-xs">
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
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
                    <p className="text-gray-500">
                      Unable to load data for this table. Try refreshing or check your connection.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
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