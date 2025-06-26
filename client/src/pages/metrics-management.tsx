import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Target, TrendingUp, Users, DollarSign, BarChart3, Save, Play, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MetricsAssistant } from "@/components/assistant/metrics-assistant";
import type { KpiMetric } from "@/../../shared/schema";

interface MetricFormData {
  name: string;
  description: string;
  yearlyGoal: string;
  goalType: string;
  quarterlyGoals: { [key: string]: string };
  monthlyGoals: { [key: string]: string };
  category: string;
  format: string;
  isIncreasing: boolean;
  isNorthStar: boolean;
  sqlQuery?: string;
}


const METRIC_CATEGORIES = [
  { value: "revenue", label: "Revenue", icon: DollarSign, color: "bg-green-100 text-green-800" },
  { value: "growth", label: "Growth", icon: TrendingUp, color: "bg-blue-100 text-blue-800" },
  { value: "retention", label: "Retention", icon: Users, color: "bg-purple-100 text-purple-800" },
  { value: "efficiency", label: "Efficiency", icon: Target, color: "bg-orange-100 text-orange-800" },
];

const METRIC_FORMATS = [
  { value: "currency", label: "Currency ($)" },
  { value: "percentage", label: "Percentage (%)" },
  { value: "number", label: "Number" },
];

export default function MetricsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<KpiMetric | null>(null);
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [isRunningSQL, setIsRunningSQL] = useState(false);
  const [isGeneratingSQL, setIsGeneratingSQL] = useState(false);
  const [formData, setFormData] = useState<MetricFormData>({
    name: "",
    description: "",
    yearlyGoal: "",
    goalType: "yearly",
    quarterlyGoals: { Q1: "", Q2: "", Q3: "", Q4: "" },
    monthlyGoals: { 
      Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "",
      Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""
    },
    category: "revenue",
    format: "currency",
    isIncreasing: true,
    isNorthStar: false,
  });

  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ["/api/kpi-metrics"],
  });

  const metricsArray = Array.isArray(metrics) ? metrics : [];

  const createMetricMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/kpi-metrics", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-metrics"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Metric Created",
        description: "New metric has been added successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create metric. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMetricMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/kpi-metrics/${editingMetric?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-metrics"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Metric Updated",
        description: "Metric has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update metric. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMetricMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/kpi-metrics/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kpi-metrics"] });
      toast({
        title: "Metric Deleted",
        description: "Metric has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete metric. Please try again.",
        variant: "destructive",
      });
    },
  });

  const runSQLQuery = async () => {
    if (!formData.sqlQuery?.trim()) {
      toast({
        title: "Empty Query",
        description: "Please enter a SQL query to execute.",
        variant: "destructive",
      });
      return;
    }

    setIsRunningSQL(true);
    try {
      const response = await fetch("/api/snowflake/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: formData.sqlQuery }),
      });
      
      if (!response.ok) throw new Error("Failed to execute query");
      
      const result = await response.json();
      setSqlResult(result);
      
      toast({
        title: "Query Executed",
        description: `Query completed successfully. ${result.data?.length || 0} rows returned.`,
      });
    } catch (error) {
      toast({
        title: "Query Error",
        description: "Failed to execute SQL query. Check your syntax and try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunningSQL(false);
    }
  };

  const generateSQLWithAI = async () => {
    if (!formData.name || !formData.description) {
      toast({
        title: "Missing Information",
        description: "Please provide metric name and description for AI SQL generation.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingSQL(true);
    try {
      const response = await fetch("/api/metrics/ai/define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricName: formData.name,
          businessContext: formData.description,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate SQL");

      const aiDefinition = await response.json();
      
      // Update the form state with generated SQL
      setFormData(prev => ({ ...prev, sqlQuery: aiDefinition.sqlQuery }));
      
      toast({
        title: "SQL Generated",
        description: "AI has generated a SQL query for your metric. Review and edit as needed.",
      });
    } catch (error) {
      toast({
        title: "SQL Generation Error",
        description: "Failed to generate SQL. Please try again or write it manually.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSQL(false);
    }
  };


  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      yearlyGoal: "",
      goalType: "yearly",
      quarterlyGoals: { Q1: "", Q2: "", Q3: "", Q4: "" },
      monthlyGoals: { 
        Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "",
        Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""
      },
      category: "revenue",
      format: "currency",
      isIncreasing: true,
      isNorthStar: false,
      sqlQuery: "",
    });
    setEditingMetric(null);
    setSqlResult(null);
  };

  const handleEdit = (metric: KpiMetric) => {
    setEditingMetric(metric);
    setFormData({
      name: metric.name || "",
      description: metric.description || "",
      yearlyGoal: metric.yearlyGoal || "",
      goalType: "yearly", // Default to yearly for existing metrics
      quarterlyGoals: { Q1: "", Q2: "", Q3: "", Q4: "" },
      monthlyGoals: { 
        Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "",
        Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""
      },
      category: metric.category || "revenue",
      format: metric.format || "currency",
      isIncreasing: metric.isIncreasing ?? true,
      isNorthStar: false, // Default to false for existing metrics
      sqlQuery: metric.sqlQuery || "",
    });
    setIsDialogOpen(true);
  };

  const validateForm = (): { isValid: boolean; errorMessage: string } => {
    if (!formData.name) {
      return { isValid: false, errorMessage: "Please fill in all required fields." };
    }
    
    if (formData.goalType === "yearly" && !formData.yearlyGoal) {
      return { isValid: false, errorMessage: "Please enter a yearly goal." };
    }
    
    if (formData.goalType === "quarterly") {
      const hasAllQuarterlyGoals = Object.values(formData.quarterlyGoals).every(goal => goal.trim() !== "");
      if (!hasAllQuarterlyGoals) {
        return { isValid: false, errorMessage: "Please enter goals for all quarters." };
      }
    }
    
    if (formData.goalType === "monthly") {
      const hasAllMonthlyGoals = Object.values(formData.monthlyGoals).every(goal => goal.trim() !== "");
      if (!hasAllMonthlyGoals) {
        return { isValid: false, errorMessage: "Please enter goals for all months." };
      }
    }
    
    return { isValid: true, errorMessage: "" };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateForm();
    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.errorMessage,
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...formData,
    };

    if (editingMetric) {
      updateMetricMutation.mutate(submitData);
    } else {
      createMetricMutation.mutate(submitData);
    }
  };

  const getCategoryInfo = (category: string) => {
    return METRIC_CATEGORIES.find(cat => cat.value === category) || METRIC_CATEGORIES[0];
  };

  const getFormatLabel = (format: string) => {
    return METRIC_FORMATS.find(fmt => fmt.value === format)?.label || "Currency ($)";
  };

  if (isLoading) {
    return (
      <div className="flex-1 space-y-6 p-8 pt-6">
        <Header 
          title="Metrics Management"
          subtitle="Configure your business metrics and yearly goals"
        />
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <Header 
        title="Metrics Management"
        subtitle="Configure your business metrics and yearly goals"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Metric
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>
                  {editingMetric ? "Edit Metric" : "Add New Metric"}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Metric Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Annual Recurring Revenue"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description *</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what this metric measures and how it should be calculated"
                      rows={3}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {METRIC_CATEGORIES.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Format</label>
                      <Select 
                        value={formData.format} 
                        onValueChange={(value) => setFormData({ ...formData, format: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {METRIC_FORMATS.map((format) => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Goal Type Selection */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Goal Type *</label>
                      <Select 
                        value={formData.goalType} 
                        onValueChange={(value) => setFormData({ ...formData, goalType: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yearly">Yearly Goal</SelectItem>
                          <SelectItem value="quarterly">Quarterly Goals</SelectItem>
                          <SelectItem value="monthly">Monthly Goals</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Yearly Goal Input */}
                    {formData.goalType === "yearly" && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Yearly Goal *</label>
                        <Input
                          value={formData.yearlyGoal}
                          onChange={(e) => setFormData({ ...formData, yearlyGoal: e.target.value })}
                          placeholder="e.g., $1,000,000"
                          required
                        />
                      </div>
                    )}

                    {/* Quarterly Goals Input */}
                    {formData.goalType === "quarterly" && (
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Quarterly Goals *</label>
                        <div className="grid grid-cols-2 gap-3">
                          {Object.keys(formData.quarterlyGoals).map((quarter) => (
                            <div key={quarter} className="space-y-1">
                              <label className="text-xs text-gray-600">{quarter}</label>
                              <Input
                                value={formData.quarterlyGoals[quarter]}
                                onChange={(e) => setFormData({ 
                                  ...formData, 
                                  quarterlyGoals: { 
                                    ...formData.quarterlyGoals, 
                                    [quarter]: e.target.value 
                                  }
                                })}
                                placeholder="Goal amount"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Monthly Goals Input */}
                    {formData.goalType === "monthly" && (
                      <div className="space-y-3">
                        <label className="text-sm font-medium">Monthly Goals *</label>
                        <div className="grid grid-cols-3 gap-3">
                          {Object.keys(formData.monthlyGoals).map((month) => (
                            <div key={month} className="space-y-1">
                              <label className="text-xs text-gray-600">{month}</label>
                              <Input
                                value={formData.monthlyGoals[month]}
                                onChange={(e) => setFormData({ 
                                  ...formData, 
                                  monthlyGoals: { 
                                    ...formData.monthlyGoals, 
                                    [month]: e.target.value 
                                  }
                                })}
                                placeholder="Goal"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Goal Direction</label>
                    <Select 
                      value={formData.isIncreasing ? "increasing" : "decreasing"} 
                      onValueChange={(value) => setFormData({ ...formData, isIncreasing: value === "increasing" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increasing">Higher is Better</SelectItem>
                        <SelectItem value="decreasing">Lower is Better</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* North Star Metric Checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="isNorthStar"
                      checked={formData.isNorthStar}
                      onCheckedChange={(checked) => setFormData({ ...formData, isNorthStar: !!checked })}
                    />
                    <Label 
                      htmlFor="isNorthStar" 
                      className="text-sm font-medium cursor-pointer"
                    >
                      North Star Metric
                    </Label>
                    <div className="text-xs text-gray-500 ml-2">
                      (Primary metrics always visible on dashboard)
                    </div>
                  </div>

                  {/* SQL Query Section */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">SQL Query (Optional)</label>
                        <Button
                          type="button"
                          onClick={generateSQLWithAI}
                          disabled={isGeneratingSQL || !formData.name || !formData.description}
                          variant="outline"
                          size="sm"
                          className="border-purple-600 text-purple-600 hover:bg-purple-50"
                        >
                          <Sparkles className="w-4 h-4 mr-1" />
                          {isGeneratingSQL ? "Generating..." : "Generate with AI"}
                        </Button>
                      </div>
                      <Textarea
                        value={formData.sqlQuery || ""}
                        onChange={(e) => setFormData({ ...formData, sqlQuery: e.target.value })}
                        placeholder="Enter custom SQL query to calculate current value, or click 'Generate with AI' button"
                        rows={4}
                        className="font-mono text-sm"
                      />
                    </div>
                    
                    {/* Test SQL Button */}
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        onClick={runSQLQuery}
                        disabled={isRunningSQL || !formData.sqlQuery}
                        variant="outline"
                        className="border-green-600 text-green-600 hover:bg-green-50"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        {isRunningSQL ? "Running..." : "Test SQL Query"}
                      </Button>
                    </div>
                  </div>

                  {/* Calculation Results */}
                  {sqlResult && (
                    <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                      <h4 className="font-medium mb-3 text-blue-900 dark:text-blue-100">
                        {sqlResult.data ? "Query Results" : "Calculation Result"}
                      </h4>
                      <div className="space-y-2 text-sm">
                        {/* Raw SQL Query Results */}
                        {sqlResult.data && sqlResult.data.length > 0 && (
                          <div>
                            <div className="font-medium mb-2">Results ({sqlResult.data.length} rows):</div>
                            <div className="max-h-48 overflow-y-auto bg-white dark:bg-gray-800 p-3 rounded border">
                              <pre className="text-xs">
                                {JSON.stringify(sqlResult.data, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                        
                        {/* AI Analysis Results */}
                        {sqlResult.currentValue !== undefined && (
                          <div>
                            <span className="font-medium">Current Value: </span>
                            <span className="text-blue-600 font-bold">
                              {sqlResult.currentValue.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {sqlResult.suggestedGoal && (
                          <div>
                            <span className="font-medium">Suggested Yearly Goal: </span>
                            <span className="text-green-600 font-bold">
                              {sqlResult.suggestedGoal.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {sqlResult.reasoning && (
                          <div>
                            <span className="font-medium">Analysis: </span>
                            <span className="text-gray-600 dark:text-gray-300">
                              {sqlResult.reasoning}
                            </span>
                          </div>
                        )}
                        
                        {/* Error Messages */}
                        {sqlResult.error && (
                          <div>
                            <span className="font-medium text-red-600">Error: </span>
                            <span className="text-red-500">
                              {sqlResult.error}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between space-x-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                
                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={createMetricMutation.isPending || updateMetricMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingMetric ? 
                    (updateMetricMutation.isPending ? "Updating..." : "Update Metric") :
                    (createMetricMutation.isPending ? "Creating..." : "Save Metric")
                  }
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Metrics Table */}
        <div className="col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Business Metrics Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsArray.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No metrics configured</h3>
                  <p className="text-gray-500 mb-4">
                    Start by adding your first business metric to track against yearly goals.
                  </p>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Metric
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Metric Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Yearly Goal</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Direction</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metricsArray
                        .map((metric: KpiMetric) => {
                          const categoryInfo = getCategoryInfo(metric.category);
                          return (
                            <TableRow key={metric.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{metric.name}</div>
                                  {metric.description && (
                                    <div className="text-sm text-gray-500 mt-1">
                                      {metric.description}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={categoryInfo.color}>
                                  {categoryInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">
                                {metric.yearlyGoal}
                              </TableCell>
                              <TableCell>
                                {getFormatLabel(metric.format || "currency")}
                              </TableCell>
                              <TableCell>
                                <span className={`text-sm ${
                                  metric.isIncreasing 
                                    ? "text-green-600" 
                                    : "text-orange-600"
                                }`}>
                                  {metric.isIncreasing ? "Higher is Better" : "Lower is Better"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(metric)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteMetricMutation.mutate(metric.id)}
                                    disabled={deleteMetricMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Assistant */}
        <div className="col-span-5">
          <div className="sticky top-6">
            <MetricsAssistant 
              onMetricCreate={(metric) => {
                setFormData({
                  name: metric.name,
                  description: metric.description,
                  yearlyGoal: metric.yearlyGoal || "",
                  goalType: "yearly",
                  quarterlyGoals: { Q1: "", Q2: "", Q3: "", Q4: "" },
                  monthlyGoals: { 
                    Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "",
                    Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""
                  },
                  category: metric.category,
                  format: metric.format,
                  isIncreasing: true,
                  isNorthStar: false
                });
                setIsDialogOpen(true);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}