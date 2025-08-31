import React, { useState } from "react";
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
import { Plus, Edit, Trash2, Target, TrendingUp, Users, DollarSign, BarChart3, Save, Sparkles } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MetricsAssistant } from "@/components/assistant/metrics-assistant";
import FilterBuilder, { type FilterTree } from "@/components/metrics/filter-builder";
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
  filterConfig?: FilterTree | null;
  mainDataSource?: string;
  table?: string;
  valueColumn?: string;
  unit?: string;
  tags?: string[];
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
  const [currentStep, setCurrentStep] = useState(1);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [availableDataSources, setAvailableDataSources] = useState<{ sourceType: string; tables: string[]; displayName: string }[]>([]);
  const [selectKey, setSelectKey] = useState(0); // Force re-render of Select components
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
    filterConfig: null,
    dataSource: "",
    metricType: "revenue",
    valueColumn: "",
  });

  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ["/api/kpi-metrics"],
  });

  // Fetch dynamic data sources for the current company
  const { data: companyDataSources = [], isLoading: isLoadingDataSources } = useQuery({
    queryKey: ["/api/company/data-sources"],
    select: (response) => response.dataSources || [],
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
        duration: 2000,
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
      filterConfig: null,
      mainDataSource: "",
      table: "",
      valueColumn: "",
      unit: "",
      tags: [],
    });
    setEditingMetric(null);
    setCurrentStep(1);
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
      filterConfig: null, // TODO: Parse from existing metric if available
      mainDataSource: "",
      table: "",
      valueColumn: "",
      unit: "",
      tags: [],
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

    // Generate metric_key from name
    const metricKey = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    
    // Generate SQL expressions based on format and value column
    const generateExprSQL = (format: string, valueColumn: string) => {
      switch (format) {
        case 'currency':
          return `sum(${valueColumn})`;
        case 'percentage':
          return `(count(case when ${valueColumn} > 0 then 1 end) * 100.0) / count(*)`;
        case 'number':
          return `count(*)`;
        default:
          return `sum(${valueColumn})`;
      }
    };

    // Generate WHERE SQL from filter config if available
    const generateWhereSQL = (filterConfig: FilterTree | null) => {
      if (!filterConfig || !filterConfig.conditions?.length) {
        return 'true';
      }
      // For now, return a basic where clause - this could be enhanced based on filter structure
      return 'date >= CURRENT_DATE - INTERVAL \'30 days\'';
    };

    const submitData = {
      ...formData,
      // Add the required JSON structure fields
      metricConfig: {
        metric_key: metricKey,
        label: formData.name,
        unit: formData.unit || 'count',
        source_fact: formData.table || 'unknown_table',
        expr_sql: generateExprSQL(formData.format, formData.valueColumn || 'amount'),
        where_sql: generateWhereSQL(formData.filterConfig),
        is_active: true,
        tags: formData.tags || [],
        description: formData.description
      }
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

  // Get available tables based on main data source (using dynamic data)
  const getAvailableTables = (mainDataSource: string): string[] => {
    const sourceData = companyDataSources.find(source => source.sourceType === mainDataSource);
    return sourceData ? sourceData.tables : [];
  };

  // Get available columns based on selected table (using dynamic API)
  const fetchAvailableColumns = async (table: string): Promise<string[]> => {
    if (!table) return [];
    
    try {
      const response = await apiRequest(`/api/company/table-columns/${table}`);
      return response.columns?.map((col: { columnName: string }) => col.columnName) || [];
    } catch (error) {
      console.error('Error fetching table columns:', error);
      return [];
    }
  };

  // Auto-generate unit based on format
  const getUnitFromFormat = (format: string): string => {
    const formatToUnit: { [key: string]: string } = {
      currency: "USD",
      percentage: "%",
      number: "count"
    };
    return formatToUnit[format] || "count";
  };

  // Auto-generate tags based on metric configuration
  const generateTags = (formData: MetricFormData): string[] => {
    const tags: string[] = [];
    
    // Add category tag
    tags.push(formData.category);
    
    // Add data source tag
    if (formData.mainDataSource) {
      tags.push(formData.mainDataSource);
    }
    
    // Add format-based tags
    if (formData.format === "currency") {
      tags.push("financial");
    } else if (formData.format === "percentage") {
      tags.push("ratio");
    }
    
    // Add north star tag if applicable
    if (formData.isNorthStar) {
      tags.push("north-star");
    }
    
    // Add core tag for revenue metrics
    if (formData.category === "revenue") {
      tags.push("core");
    }
    
    return tags;
  };

  // Update available tables when main data source changes
  React.useEffect(() => {
    if (formData.mainDataSource) {
      const tables = getAvailableTables(formData.mainDataSource);
      setAvailableTables(tables);
      // Clear table and value column when data source changes
      setFormData(prev => ({ ...prev, table: "", valueColumn: "" }));
      setAvailableColumns([]);
    } else {
      setAvailableTables([]);
      setAvailableColumns([]);
    }
  }, [formData.mainDataSource]);

  // Update available columns when table changes
  React.useEffect(() => {
    if (formData.mainDataSource && formData.table) {
      const columns = getAvailableColumns(formData.mainDataSource, formData.table);
      setAvailableColumns(columns);
      // Clear value column if it's not in the new columns list
      if (formData.valueColumn && !columns.includes(formData.valueColumn)) {
        setFormData(prev => ({ ...prev, valueColumn: "" }));
      }
    } else {
      setAvailableColumns([]);
    }
  }, [formData.mainDataSource, formData.table]);

  // Auto-update unit when format changes
  React.useEffect(() => {
    const autoUnit = getUnitFromFormat(formData.format);
    setFormData(prev => ({ ...prev, unit: autoUnit }));
  }, [formData.format]);

  // Update available tables when main data source changes
  React.useEffect(() => {
    if (formData.mainDataSource) {
      const tables = getAvailableTables(formData.mainDataSource);
      setAvailableTables(tables);
      // Clear table and value column when data source changes
      setFormData(prev => ({ ...prev, table: "", valueColumn: "" }));
      setAvailableColumns([]);
    } else {
      setAvailableTables([]);
      setAvailableColumns([]);
    }
  }, [formData.mainDataSource, companyDataSources]);

  // Update available columns when table changes
  React.useEffect(() => {
    if (formData.table) {
      fetchAvailableColumns(formData.table).then(columns => {
        setAvailableColumns(columns);
        // Clear value column if it's not in the new columns list
        if (formData.valueColumn && !columns.includes(formData.valueColumn)) {
          setFormData(prev => ({ ...prev, valueColumn: "" }));
        }
      });
    } else {
      setAvailableColumns([]);
    }
  }, [formData.table]);

  // Auto-update unit when format changes
  React.useEffect(() => {
    const autoUnit = getUnitFromFormat(formData.format);
    setFormData(prev => ({ ...prev, unit: autoUnit }));
  }, [formData.format]);

  // Auto-select first available data source when data sources are loaded
  React.useEffect(() => {
    if (companyDataSources.length > 0 && !formData.mainDataSource) {
      const firstSource = companyDataSources[0];
      setFormData(prev => ({ ...prev, mainDataSource: firstSource.sourceType }));
    }
  }, [companyDataSources, formData.mainDataSource]);

  // Auto-generate tags when relevant fields change
  React.useEffect(() => {
    const autoTags = generateTags(formData);
    setFormData(prev => ({ ...prev, tags: autoTags }));
  }, [formData.category, formData.mainDataSource, formData.format, formData.isNorthStar]);

  const getFormatLabel = (format: string) => {
    return METRIC_FORMATS.find(fmt => fmt.value === format)?.label || "Currency ($)";
  };

  if (isLoading) {
    return (
      <>
        <Header 
          title="Metrics Management"
          subtitle="Configure your business metrics and yearly goals"
        />
        <main className="flex-1 overflow-y-auto p-6">
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
        </main>
      </>
    );
  }

  return (
    <>
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
            <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg">
                    {editingMetric ? "Edit Metric" : "Add New Metric"} 
                  </DialogTitle>
                  <div className="text-sm text-gray-500">
                    Step {currentStep} of 2
                  </div>
                </div>
              </DialogHeader>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                if (currentStep < 2) {
                  return;
                }
                handleSubmit(e);
              }} className="flex flex-col h-full">
                <div className="flex-1 overflow-hidden">
                  
                  {currentStep === 1 && (
                    <div className="h-full overflow-y-auto px-1">
                      <div className="space-y-4">
                        {/* Basic Information */}
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <h3 className="text-sm font-semibold text-slate-800 mb-3">Basic Information</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-1 block">Metric Name *</label>
                              <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Annual Recurring Revenue"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-1 block">Description *</label>
                              <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe what this metric measures"
                                rows={2}
                                required
                                className="resize-none"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Configuration */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <h3 className="text-sm font-semibold text-slate-800 mb-3">Configuration</h3>
                          <div className="grid grid-cols-4 gap-3">
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-1 block">Category</label>
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
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-1 block">Format</label>
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
                            <div>
                              <label className="text-sm font-medium text-slate-700 mb-1 block">Direction</label>
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
                            <div className="flex items-end">
                              <div className="flex items-center space-x-2">
                                <Checkbox 
                                  id="isNorthStar"
                                  checked={formData.isNorthStar}
                                  onCheckedChange={(checked) => setFormData({ ...formData, isNorthStar: !!checked })}
                                />
                                <Label htmlFor="isNorthStar" className="text-sm font-medium cursor-pointer">
                                  North Star
                                </Label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Goals & Targets */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <h3 className="text-sm font-semibold text-slate-800 mb-3">Goals & Targets</h3>
                          <div className="space-y-3">
                            <div className="w-48">
                              <label className="text-sm font-medium text-slate-700 mb-1 block">Goal Type *</label>
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

                            {formData.goalType === "yearly" && (
                              <div className="w-64">
                                <label className="text-sm font-medium text-slate-700 mb-1 block">Yearly Goal *</label>
                                <Input
                                  value={formData.yearlyGoal}
                                  onChange={(e) => setFormData({ ...formData, yearlyGoal: e.target.value })}
                                  placeholder="e.g., $1,000,000"
                                  required
                                />
                              </div>
                            )}

                            {formData.goalType === "quarterly" && (
                              <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Quarterly Goals *</label>
                                <div className="grid grid-cols-4 gap-3 max-w-lg">
                                  {Object.keys(formData.quarterlyGoals).map((quarter) => (
                                    <div key={quarter}>
                                      <label className="text-xs text-slate-500 mb-1 block">{quarter}</label>
                                      <Input
                                        value={formData.quarterlyGoals[quarter]}
                                        onChange={(e) => setFormData({ 
                                          ...formData, 
                                          quarterlyGoals: { 
                                            ...formData.quarterlyGoals, 
                                            [quarter]: e.target.value 
                                          }
                                        })}
                                        placeholder="Amount"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {formData.goalType === "monthly" && (
                              <div>
                                <label className="text-sm font-medium text-slate-700 mb-1 block">Monthly Goals *</label>
                                <div className="space-y-1">
                                  <div className="grid grid-cols-6 gap-1">
                                    {Object.keys(formData.monthlyGoals).slice(0, 6).map((month) => (
                                      <div key={month}>
                                        <label className="text-xs text-slate-500 mb-0.5 block text-center">{month}</label>
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
                                          className="text-xs text-center h-8 px-1"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="grid grid-cols-6 gap-1">
                                    {Object.keys(formData.monthlyGoals).slice(6, 12).map((month) => (
                                      <div key={month}>
                                        <label className="text-xs text-slate-500 mb-0.5 block text-center">{month}</label>
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
                                          className="text-xs text-center h-8 px-1"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-6">
                      {/* Metric Summary */}
                      <div className="bg-gray-100 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Metric Summary</h3>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
                            <Input
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="Enter metric name"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                            <Textarea
                              value={formData.description}
                              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                              placeholder="Enter metric description"
                              className="resize-none"
                              rows={3}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-700">Category:</label>
                            <Badge className="bg-green-100 text-green-800">
                              {METRIC_CATEGORIES.find(c => c.value === formData.category)?.label}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Data Source & Fields */}
                      <div className="bg-purple-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-gray-900">Data Source & Fields</h3>
                          <Button
                            type="button"
                            onClick={async () => {
                              console.log('🔥 Configure with AI button clicked!');
                              console.log('Form data check:', { name: formData.name, description: formData.description });
                              
                              // AI-powered complete configuration
                              if (formData.name && formData.description) {
                                console.log('✅ Name and description check passed');
                                // Intelligent configuration based on metric name and description
                                const generateSmartConfig = () => {
                                  const name = formData.name.toLowerCase();
                                  const description = formData.description.toLowerCase();
                                  const category = formData.category;
                                  const format = formData.format;
                                  
                                  // Smart data source detection
                                  let mainDataSource = 'custom';
                                  if (name.includes('deal') || name.includes('opportunity') || name.includes('pipeline') || 
                                      description.includes('salesforce') || description.includes('crm') || description.includes('sales')) {
                                    mainDataSource = 'salesforce';
                                  } else if (name.includes('ticket') || name.includes('issue') || name.includes('bug') || 
                                            description.includes('jira') || description.includes('project') || description.includes('sprint')) {
                                    mainDataSource = 'jira';
                                  } else if (name.includes('contact') || name.includes('lead') || name.includes('marketing') || 
                                            description.includes('hubspot') || description.includes('campaign')) {
                                    mainDataSource = 'hubspot';
                                  } else if (category === 'revenue' || format === 'currency') {
                                    mainDataSource = 'salesforce'; // Default revenue to salesforce
                                  } else if (category === 'growth') {
                                    mainDataSource = 'hubspot'; // Default growth to hubspot
                                  }
                                  
                                  // Smart table detection based on data source and metric type
                                  let table = 'transactions';
                                  if (mainDataSource === 'salesforce') {
                                    if (name.includes('account') || description.includes('account')) {
                                      table = 'accounts';
                                    } else if (name.includes('contact') || description.includes('contact')) {
                                      table = 'contacts';
                                    } else if (name.includes('lead') || description.includes('lead')) {
                                      table = 'leads';
                                    } else if (name.includes('case') || description.includes('case') || description.includes('support')) {
                                      table = 'cases';
                                    } else {
                                      table = 'opportunities'; // Default for salesforce
                                    }
                                  } else if (mainDataSource === 'hubspot') {
                                    if (name.includes('company') || description.includes('company')) {
                                      table = 'companies';
                                    } else if (name.includes('contact') || description.includes('contact')) {
                                      table = 'contacts';
                                    } else if (name.includes('ticket') || description.includes('ticket') || description.includes('support')) {
                                      table = 'tickets';
                                    } else if (name.includes('product') || description.includes('product')) {
                                      table = 'products';
                                    } else {
                                      table = 'deals'; // Default for hubspot
                                    }
                                  } else if (mainDataSource === 'jira') {
                                    if (name.includes('project') || description.includes('project')) {
                                      table = 'projects';
                                    } else if (name.includes('sprint') || description.includes('sprint')) {
                                      table = 'sprints';
                                    } else if (name.includes('user') || description.includes('user') || description.includes('assignee')) {
                                      table = 'users';
                                    } else if (name.includes('time') || description.includes('time') || description.includes('log')) {
                                      table = 'worklogs';
                                    } else {
                                      table = 'issues'; // Default for jira
                                    }
                                  }
                                  
                                  // Smart value column detection
                                  let valueColumn = 'amount';
                                  if (format === 'currency') {
                                    if (mainDataSource === 'salesforce' && table === 'opportunities') {
                                      valueColumn = 'amount';
                                    } else if (mainDataSource === 'salesforce' && table === 'accounts') {
                                      valueColumn = 'annual_revenue';
                                    } else if (mainDataSource === 'hubspot' && table === 'deals') {
                                      valueColumn = 'deal_amount';
                                    } else if (mainDataSource === 'hubspot' && table === 'companies') {
                                      valueColumn = 'annual_revenue';
                                    } else {
                                      valueColumn = 'amount';
                                    }
                                  } else if (format === 'percentage') {
                                    if (name.includes('rate') || name.includes('conversion') || name.includes('success')) {
                                      valueColumn = 'probability';
                                    } else {
                                      valueColumn = 'probability';
                                    }
                                  } else if (format === 'number') {
                                    if (name.includes('count') || description.includes('count') || name.includes('total')) {
                                      if (mainDataSource === 'jira' && table === 'issues') {
                                        valueColumn = 'story_points';
                                      } else if (mainDataSource === 'hubspot' && table === 'companies') {
                                        valueColumn = 'num_employees';
                                      } else {
                                        valueColumn = 'count';
                                      }
                                    } else if (name.includes('time') || description.includes('time')) {
                                      valueColumn = 'time_spent';
                                    } else {
                                      valueColumn = 'count';
                                    }
                                  }
                                  
                                  return {
                                    mainDataSource,
                                    table,
                                    valueColumn
                                  };
                                };
                                
                                const smartConfig = generateSmartConfig();
                                console.log('Smart config generated:', smartConfig);
                                console.log('Form data before update:', { mainDataSource: formData.mainDataSource, table: formData.table, valueColumn: formData.valueColumn });
                                
                                // Update available tables and columns manually
                                const newTables = getAvailableTables(smartConfig.mainDataSource);
                                const newColumns = getAvailableColumns(smartConfig.mainDataSource, smartConfig.table);
                                console.log('New tables:', newTables);
                                console.log('New columns:', newColumns);
                                
                                // Update available options first
                                setAvailableTables(newTables);
                                setAvailableColumns(newColumns);
                                setSelectKey(prev => prev + 1); // Force re-render of Select components
                                
                                // Update form data in sequence to ensure dependencies work
                                setFormData(prevFormData => ({ 
                                  ...prevFormData, 
                                  mainDataSource: smartConfig.mainDataSource
                                }));
                                
                                // Small delay then update table and value column
                                setTimeout(() => {
                                  setFormData(prevFormData => ({ 
                                    ...prevFormData, 
                                    table: smartConfig.table,
                                    valueColumn: smartConfig.valueColumn
                                  }));
                                }, 50);
                                
                                // Add a small delay to ensure DOM updates
                                setTimeout(() => {
                                  toast({
                                    title: "AI Configuration Applied",
                                    description: `Configured ${smartConfig.mainDataSource} → ${smartConfig.table} → ${smartConfig.valueColumn}`,
                                  });
                                }, 100);
                              } else {
                                console.log('❌ Name and description check failed:', { 
                                  name: formData.name, 
                                  description: formData.description,
                                  nameEmpty: !formData.name,
                                  descriptionEmpty: !formData.description
                                });
                              }
                            }}
                            size="lg"
                            className="px-6 py-2 font-semibold"
                            disabled={!formData.name || !formData.description}
                          >
                            <Sparkles className="w-5 h-5 mr-2" />
                            Configure with AI
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Main Data Source</label>
                            <Select 
                              key={`mainDataSource-${selectKey}`}
                              value={formData.mainDataSource || ""} 
                              onValueChange={(value) => setFormData({ ...formData, mainDataSource: value })}
                              disabled={isLoadingDataSources}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={
                                  isLoadingDataSources 
                                    ? "Loading data sources..." 
                                    : companyDataSources.length === 0 
                                      ? "No data sources available" 
                                      : "Select main data source"
                                } />
                              </SelectTrigger>
                              <SelectContent>
                                {companyDataSources.length > 0 ? (
                                  companyDataSources.map((source) => (
                                    <SelectItem key={source.sourceType} value={source.sourceType}>
                                      {source.displayName} ({source.tables.length} tables)
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem value="no-sources" disabled>
                                    No data sources available
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Table</label>
                            <Select 
                              key={`table-${selectKey}`}
                              value={formData.table || ""} 
                              onValueChange={(value) => setFormData({ ...formData, table: value })}
                              disabled={!formData.mainDataSource}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={formData.mainDataSource ? "Select table" : "Select data source first"} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableTables.map((table) => (
                                  <SelectItem key={table} value={table}>
                                    {table}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Value Column</label>
                            <Select
                              key={`valueColumn-${selectKey}`}
                              value={formData.valueColumn || ""}
                              onValueChange={(value) => setFormData({ ...formData, valueColumn: value })}
                              disabled={!formData.table}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={formData.table ? "Select column" : "Select table first"} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableColumns.map((column) => (
                                  <SelectItem key={column} value={column}>
                                    {column}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Data Filtering */}
                      <div className="bg-amber-50 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Data Filtering (Optional)</h3>
                        <FilterBuilder
                          initialFilter={formData.filterConfig}
                          onFilterChange={(filter) => setFormData({ ...formData, filterConfig: filter })}
                          onDataSourceChange={(dataSource) => setFormData({ ...formData, mainDataSource: dataSource })}
                          metricName={formData.name}
                          metricDescription={formData.description}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center pt-4 border-t mt-4">
                  <div>
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep(currentStep - 1)}
                      >
                        Back
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    
                    {currentStep < 2 ? (
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          // Basic validation for step 1
                          if (!formData.name || !formData.description) {
                            toast({
                              title: "Missing Information",
                              description: "Please fill in the metric name and description.",
                              variant: "destructive",
                            });
                            return;
                          }
                          if (formData.goalType === "yearly" && !formData.yearlyGoal) {
                            toast({
                              title: "Missing Goal",
                              description: "Please enter a yearly goal.",
                              variant: "destructive",
                            });
                            return;
                          }
                          setCurrentStep(2);
                        }}
                      >
                        Continue
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={createMetricMutation.isPending || updateMetricMutation.isPending}
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingMetric ? 
                          (updateMetricMutation.isPending ? "Updating..." : "Update Metric") :
                          (createMetricMutation.isPending ? "Creating..." : "Save Metric")
                        }
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-12 gap-6">
        {/* Metrics Table */}
        <div className="col-span-7">
          <Card className="h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Business Metrics Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-6">
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
          <div className="h-[calc(100vh-12rem)]">
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
      </main>
    </>
  );
}