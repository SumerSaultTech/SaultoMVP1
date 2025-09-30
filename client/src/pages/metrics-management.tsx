import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, BarChart3, Save, Sparkles } from "lucide-react";
import { apiRequest, apiRequestJson } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MetricsAssistant } from "@/components/assistant/metrics-assistant";
import FilterBuilder, { type FilterTree } from "@/components/metrics/filter-builder";
import type { Metric } from "@/../../shared/schema";

interface MetricFormData {
  // Core Identity
  name: string;
  description: string;
  metricKey?: string;
  
  // Calculation Logic  
  sourceTable: string;
  exprSql?: string;
  filters?: FilterTree | null;
  dateColumn: string;
  
  // Display & Goals
  category: string;
  format: string;
  unit: string;
  yearlyGoal: string;
  goalType: string;
  quarterlyGoals: { [key: string]: string };
  monthlyGoals: { [key: string]: string };
  isIncreasing: boolean;
  isNorthStar: boolean;
  
  // Calculated Fields Configuration
  useCalculatedField: boolean;
  calculationType?: string;
  dateFromColumn?: string;
  dateToColumn?: string;
  timeUnit?: string;
  conditionalField?: string;
  conditionalOperator?: string;
  conditionalValue?: string;
  convertToNumber?: boolean;
  handleNulls?: boolean;
  
  // Legacy fields for backward compatibility with form logic
  mainDataSource?: string;
  table?: string;
  valueColumn?: string;
  aggregationType?: string;
  tags?: string[];
}



const METRIC_FORMATS = [
  { value: "currency", label: "Currency ($)" },
  { value: "percentage", label: "Percentage (%)" },
  { value: "number", label: "Number" },
];

const AGGREGATION_TYPES = [
  { value: "SUM", label: "Sum" },
  { value: "AVG", label: "Average" },
  { value: "COUNT", label: "Count" },
  { value: "MIN", label: "Minimum" },
  { value: "MAX", label: "Maximum" },
];

export default function MetricsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<Metric | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [availableTables, setAvailableTables] = useState<string[]>([]);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [availableDataSources, setAvailableDataSources] = useState<{ sourceType: string; tables: string[]; displayName: string }[]>([]);
  const [selectKey, setSelectKey] = useState(0); // Force re-render of Select components
  const [formData, setFormData] = useState<MetricFormData>({
    // Core Identity
    name: "",
    description: "",
    metricKey: "",
    
    // Calculation Logic  
    sourceTable: "",
    exprSql: "",
    filters: null,
    dateColumn: "created_at",
    
    // Display & Goals
    category: "revenue",
    format: "currency", 
    unit: "count",
    yearlyGoal: "",
    goalType: "yearly",
    quarterlyGoals: { Q1: "", Q2: "", Q3: "", Q4: "" },
    monthlyGoals: { 
      Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "",
      Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""
    },
    isIncreasing: true,
    isNorthStar: false,
    
    // Calculated Fields Configuration
    useCalculatedField: false,
    calculationType: "time_difference",
    dateFromColumn: "",
    dateToColumn: "",
    timeUnit: "days",
    conditionalField: "",
    conditionalOperator: "=",
    conditionalValue: "",
    convertToNumber: false,
    handleNulls: true,
    
    // Legacy fields for backward compatibility
    mainDataSource: "",
    table: "",
    valueColumn: "",
    aggregationType: "SUM",
    tags: [],
  });

  // Sync company selection on component mount (but don't clear all caches)
  React.useEffect(() => {
    console.log('🚀 MetricsManagement component mounted - syncing company...');
    
    // Debug company selection state
    const selectedCompany = localStorage.getItem("selectedCompany");
    console.log('🔍 Selected company from localStorage:', selectedCompany);
    
    // Force sync company selection with backend if available
    if (selectedCompany) {
      try {
        const companyData = JSON.parse(selectedCompany);
        console.log('🔧 Syncing company selection with backend:', companyData);
        fetch("/api/companies/select", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ companyId: companyData.id })
        }).then(response => {
          console.log('✅ Company sync response:', response.status);
          if (response.ok) {
            // Refresh metrics after successful sync
            queryClient.invalidateQueries({ queryKey: ["/api/kpi-metrics"] });
          }
        }).catch(error => {
          console.error('❌ Failed to sync company selection:', error);
        });
      } catch (error) {
        console.error('❌ Failed to parse selected company:', error);
      }
    }
  }, [queryClient]);

  const { data: metrics = [], isLoading, error } = useQuery({
    queryKey: ["/api/kpi-metrics"],
    staleTime: 0, // Always refetch to ensure fresh data with new pipeline fields
    cacheTime: 0, // Don't cache to ensure we get updated schema fields
    retry: (failureCount, error: any) => {
      console.log(`🔄 Query retry attempt ${failureCount}, error:`, error?.message);
      // Don't retry if it's a company selection error
      if (error?.message?.includes('company selected') || error?.message?.includes('No company selected')) {
        console.log('❌ Company selection error detected, not retrying');
        return false;
      }
      return failureCount < 3;
    },
    onSuccess: (data) => {
      console.log('✅ Successfully fetched metrics:', data?.length || 0, 'metrics');
    },
    onError: (error: any) => {
      console.log('❌ Metrics query error:', error?.message);
    },
  });

  // Fetch metric categories for dynamic form options
  const { data: categoriesData = [] } = useQuery({
    queryKey: ["/api/metric-categories"],
    staleTime: 60000, // Cache for 1 minute
  });

  // Convert categories to the format expected by the form (always use dynamic data)
  const METRIC_CATEGORIES = categoriesData.map((cat: any) => ({
    value: cat.value,
    label: cat.name,
    color: cat.color
  }));

  // Fetch dynamic data sources for the current company
  const { data: companyDataSources = [], isLoading: isLoadingDataSources } = useQuery({
    queryKey: ["/api/company/data-sources"],
    select: (response) => response.dataSources || [],
    enabled: true, // Always try to fetch - let backend handle "no company" case
    retry: 2,
    retryDelay: 1000,
    onSuccess: (data) => {
      console.log('✅ Data sources loaded successfully:', data);
    },
    onError: (error) => {
      console.log('❌ Data sources query failed:', error);
    },
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
      // Core Identity
      name: "",
      description: "",
      metricKey: "",
      
      // Calculation Logic  
      sourceTable: "",
      exprSql: "",
      filters: null,
      dateColumn: "created_at",
      
      // Display & Goals
      category: "revenue",
      format: "currency", 
      unit: "count",
      yearlyGoal: "",
      goalType: "yearly",
      quarterlyGoals: { Q1: "", Q2: "", Q3: "", Q4: "" },
      monthlyGoals: { 
        Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "",
        Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""
      },
      isIncreasing: true,
      isNorthStar: false,
      
      // Calculated Fields Configuration
      useCalculatedField: false,
      calculationType: "time_difference",
      dateFromColumn: "",
      dateToColumn: "",
      timeUnit: "days",
      conditionalField: "",
      conditionalOperator: "=",
      conditionalValue: "",
      convertToNumber: false,
      handleNulls: true,
      
      // Legacy fields for backward compatibility
      mainDataSource: "",
      table: "",
      valueColumn: "",
      aggregationType: "SUM",
      tags: [],
    });
    setEditingMetric(null);
    setCurrentStep(1);
  };

  const handleEdit = (metric: Metric) => {
    console.log('🔧 handleEdit called with metric:', metric);
    console.log('🔍 mainDataSource:', metric.mainDataSource);
    console.log('🔍 table:', metric.table);
    console.log('🔍 valueColumn:', metric.valueColumn);
    console.log('🔍 aggregationType:', metric.aggregationType);
    console.log('🔍 dateColumn:', metric.dateColumn);
    console.log('🔍 conditionalField:', metric.conditionalField);
    console.log('🔍 conditionalOperator:', metric.conditionalOperator);
    console.log('🔍 conditionalValue:', metric.conditionalValue);
    
    // AGGRESSIVE FORM POPULATION - FORCE ALL FIELDS TO HAVE VALUES
    
    // STEP 1: Parse table and data source
    let parsedTable = 'core_jira_issues';
    let parsedMainDataSource = 'jira';
    
    if (metric.sourceTable) {
      parsedTable = metric.sourceTable.replace(/^analytics_company_\d+\./, '');
      if (parsedTable.includes('jira')) parsedMainDataSource = 'jira';
      else if (parsedTable.includes('salesforce')) parsedMainDataSource = 'salesforce';  
      else if (parsedTable.includes('hubspot')) parsedMainDataSource = 'hubspot';
    }
    
    // STEP 2: Force parse aggregation and value column from SQL
    let parsedAggregationType = 'COUNT';
    let parsedValueColumn = '';
    
    if (metric.exprSql) {
      // Extract from patterns like "SUM(story_points)", "COUNT(*)", "AVG(cycle_time)"
      const sqlMatch = metric.exprSql.match(/^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*([^)]+)\s*\)/i);
      if (sqlMatch) {
        parsedAggregationType = sqlMatch[1].toUpperCase();
        const columnPart = sqlMatch[2].trim();
        
        if (columnPart !== '*' && !columnPart.includes('CASE') && !columnPart.includes('EXTRACT')) {
          parsedValueColumn = columnPart;
        }
      }
    }
    
    // STEP 3: FORCE DEFAULTS for missing critical fields
    const metricName = metric.name.toLowerCase();
    
    // Force value column based on metric name if still empty
    if (!parsedValueColumn) {
      if (metricName.includes('story points') || metricName.includes('story_points')) {
        parsedValueColumn = 'story_points';
        parsedAggregationType = 'SUM';
      } else if (metricName.includes('cycle time') || metricName.includes('average')) {
        parsedValueColumn = 'cycle_time';
        parsedAggregationType = 'AVG';
      } else if (metricName.includes('amount') || metricName.includes('revenue')) {
        parsedValueColumn = 'amount';
        parsedAggregationType = 'SUM';
      } else if (parsedAggregationType === 'COUNT') {
        // For COUNT operations, value column can be empty
        parsedValueColumn = '';
      }
    }
    
    // STEP 4: Extract all other fields directly
    const dateColumnValue = metric.dateColumn || 'created_at';
    const conditionalField = metric.conditionalField || '';
    const conditionalOp = metric.conditionalOperator || '=';
    const conditionalVal = metric.conditionalValue || '';
    const hasCalculatedField = metric.useCalculatedField || false;
    const calcType = metric.calculationType || 'time_difference';
    const dateFromCol = metric.dateFromColumn || '';
    const dateToCol = metric.dateToColumn || '';
    
    console.log('🔧 PARSING RESULTS:');
    console.log('  sourceTable:', metric.sourceTable);
    console.log('  parsedTable:', parsedTable);
    console.log('  exprSql:', metric.exprSql);
    console.log('  parsedValueColumn:', parsedValueColumn);
    console.log('  parsedAggregationType:', parsedAggregationType);
    console.log('  dateColumn:', metric.dateColumn);
    
    // Force refresh the metrics data to ensure we have the latest schema
    queryClient.invalidateQueries({ queryKey: ["/api/kpi-metrics"] });
    console.log('🚀 ABOUT TO SET FORM DATA WITH:');
    console.log('  parsedTable:', parsedTable);
    console.log('  parsedValueColumn:', parsedValueColumn);
    console.log('  parsedAggregationType:', parsedAggregationType);
    
    setEditingMetric(metric);
    setFormData({
      // Core Identity
      name: metric.name || "",
      description: metric.description || "",
      metricKey: metric.metricKey || "",
      
      // Calculation Logic (from new schema)
      sourceTable: metric.sourceTable || "",
      exprSql: metric.exprSql || "",
      filters: metric.filters || null,
      dateColumn: dateColumnValue,
      
      // Display & Goals
      category: metric.category || "revenue",
      format: metric.format || "currency",
      unit: metric.unit || "count",
      yearlyGoal: metric.yearlyGoal || "",
      goalType: metric.goalType || "yearly",
      quarterlyGoals: metric.quarterlyGoals || { Q1: "", Q2: "", Q3: "", Q4: "" },
      monthlyGoals: metric.monthlyGoals || { 
        Jan: "", Feb: "", Mar: "", Apr: "", May: "", Jun: "",
        Jul: "", Aug: "", Sep: "", Oct: "", Nov: "", Dec: ""
      },
      isIncreasing: metric.isIncreasing ?? true,
      isNorthStar: metric.isNorthStar ?? false,
      
      // Calculated Fields Configuration - FORCE POPULATE ALL VALUES
      useCalculatedField: hasCalculatedField,
      calculationType: calcType,
      dateFromColumn: dateFromCol,
      dateToColumn: dateToCol,
      timeUnit: metric.timeUnit || "days",
      conditionalField: conditionalField,
      conditionalOperator: conditionalOp,
      conditionalValue: conditionalVal,
      convertToNumber: metric.convertToNumber ?? false,
      handleNulls: metric.handleNulls ?? true,
      
      // Parsed legacy fields for form compatibility - AGGRESSIVELY POPULATED
      mainDataSource: parsedMainDataSource,
      table: parsedTable,
      valueColumn: parsedValueColumn,
      aggregationType: parsedAggregationType,
      tags: Array.isArray(metric.tags) ? metric.tags : [],
    });
    
    console.log('✅ Form data populated with parsed fields:', {
      mainDataSource: parsedMainDataSource,
      table: parsedTable,
      valueColumn: parsedValueColumn,
      aggregationType: parsedAggregationType,
      dateColumn: metric.dateColumn || "created_at",
      unit: metric.unit || "count",
      conditionalField: metric.conditionalField || "",
      conditionalOperator: metric.conditionalOperator || "=",
      conditionalValue: metric.conditionalValue || "",
      tags: Array.isArray(metric.tags) ? metric.tags : [],
    });
    
    // Log the actual formData state that will be set
    setTimeout(() => {
      console.log('🎯 FORM STATE AFTER SET:', {
        name: formData.name,
        mainDataSource: formData.mainDataSource,
        table: formData.table,
        valueColumn: formData.valueColumn,
        aggregationType: formData.aggregationType,
        dateColumn: formData.dateColumn,
      });
    }, 100);
    
    // FORCE FETCH COLUMNS for the parsed table to ensure dropdown populates
    console.log('🚀 Force fetching columns for table:', parsedTable);
    if (parsedTable) {
      fetchAvailableColumns(parsedTable).then(columns => {
        console.log('🔥 FORCE fetched columns for editing:', columns);
        setAvailableColumns(columns);
      });
    }
    
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
    
    // Generate SQL expressions based on aggregation type, value column, and calculated fields
    const generateExprSQL = (aggregationType: string, valueColumn: string, format: string, calculatedConfig: any) => {
      // Handle calculated fields
      if (formData.useCalculatedField && calculatedConfig) {
        if (calculatedConfig.calculationType === 'time_difference') {
          const fromCol = calculatedConfig.dateFromColumn;
          const toCol = calculatedConfig.dateToColumn === 'CURRENT_DATE' ? 'CURRENT_DATE' : calculatedConfig.dateToColumn;
          const unit = calculatedConfig.timeUnit || 'days';
          
          let expr;
          if (unit === 'days') {
            expr = `EXTRACT(DAY FROM (${toCol} - ${fromCol}))`;
          } else if (unit === 'hours') {
            expr = `EXTRACT(EPOCH FROM (${toCol} - ${fromCol})) / 3600`;
          } else if (unit === 'weeks') {
            expr = `EXTRACT(DAY FROM (${toCol} - ${fromCol})) / 7`;
          } else {
            expr = `EXTRACT(DAY FROM (${toCol} - ${fromCol}))`;
          }
          
          if (aggregationType === 'AVG') {
            expr = `AVG(${expr})`;
          } else if (aggregationType === 'SUM') {
            expr = `SUM(${expr})`;
          } else if (aggregationType === 'COUNT') {
            expr = `COUNT(${expr})`;
          } else {
            expr = `AVG(${expr})`; // Default to average for time differences
          }
          
          // Handle NULL replacement
          if (calculatedConfig.handleNulls) {
            expr = `COALESCE(${expr}, 0)`;
          }
          
          return expr;
        }
        
        if (calculatedConfig.calculationType === 'conditional_count') {
          const field = calculatedConfig.conditionalField;
          const operator = calculatedConfig.conditionalOperator;
          let value = calculatedConfig.conditionalValue;
          
          // Add quotes for string values (except for numbers)
          if (isNaN(Number(value)) && operator !== 'IS NULL' && operator !== 'IS NOT NULL') {
            value = `'${value}'`;
          }
          
          return `COUNT(CASE WHEN ${field} ${operator} ${value} THEN 1 END)`;
        }
        
        if (calculatedConfig.calculationType === 'conditional_sum') {
          const field = calculatedConfig.conditionalField;
          const operator = calculatedConfig.conditionalOperator;
          let condValue = calculatedConfig.conditionalValue;
          
          // Add quotes for string values
          if (isNaN(Number(condValue)) && operator !== 'IS NULL' && operator !== 'IS NOT NULL') {
            condValue = `'${condValue}'`;
          }
          
          let sumColumn = valueColumn || 'amount';
          if (calculatedConfig.convertToNumber) {
            sumColumn = `CAST(${sumColumn} AS NUMERIC)`;
          }
          
          let expr = `SUM(CASE WHEN ${field} ${operator} ${condValue} THEN ${sumColumn} ELSE 0 END)`;
          
          if (calculatedConfig.handleNulls) {
            expr = `COALESCE(${expr}, 0)`;
          }
          
          return expr;
        }
      }
      
      // Handle regular aggregations (existing logic)
      if (format === 'percentage' && valueColumn && aggregationType === 'PERCENTAGE') {
        return `(count(case when ${valueColumn} > 0 then 1 end) * 100.0) / count(*)`;
      }
      if (aggregationType === 'COUNT') {
        return `count(*)`;
      }
      if (!valueColumn) {
        return `count(*)`;
      }
      
      let expr = `${aggregationType.toLowerCase()}(${valueColumn})`;
      
      // Apply data handling options for regular fields too
      if (formData.convertToNumber && valueColumn) {
        expr = `${aggregationType.toLowerCase()}(CAST(${valueColumn} AS NUMERIC))`;
      }
      
      if (formData.handleNulls) {
        expr = `COALESCE(${expr}, 0)`;
      }
      
      return expr;
    };

    // Generate WHERE SQL from filter config if available
    const generateWhereSQL = (filterConfig: FilterTree | null) => {
      if (!filterConfig || !filterConfig.conditions?.length) {
        return 'true';
      }
      // For now, return a basic where clause - this could be enhanced based on filter structure
      return 'date >= CURRENT_DATE - INTERVAL \'30 days\'';
    };

    // Auto-generate metric key if not provided
    const finalMetricKey = formData.metricKey || metricKey;
    
    // Get company ID from localStorage
    const getCompanyId = () => {
      try {
        const selectedCompanyStr = localStorage.getItem("selectedCompany");
        if (selectedCompanyStr) {
          const companyData = JSON.parse(selectedCompanyStr);
          return companyData.id;
        }
      } catch (e) {
        console.error('Error parsing selectedCompany from localStorage:', e);
      }
      return '1756502314139'; // Fallback to current company
    };
    
    const companyId = getCompanyId();
    
    // Build sourceTable from legacy fields if not set - PRESERVE SCHEMA PREFIX
    const finalSourceTable = formData.sourceTable || (
      formData.table ? 
        // If table doesn't have schema prefix, add it
        (formData.table.includes('analytics_company_') ? formData.table : `analytics_company_${companyId}.${formData.table}`) :
      formData.mainDataSource === 'jira' ? `analytics_company_${companyId}.core_jira_issues` :
      formData.mainDataSource === 'salesforce' ? `analytics_company_${companyId}.core_salesforce_opportunities` :
      formData.mainDataSource === 'hubspot' ? `analytics_company_${companyId}.core_hubspot_deals` :
      `analytics_company_${companyId}.core_data`
    );
    
    // Generate expr_sql if not provided
    const finalExprSql = formData.exprSql || generateExprSQL(
      formData.aggregationType || 'SUM', 
      formData.valueColumn || 'amount', 
      formData.format, 
      {
        calculationType: formData.calculationType,
        dateFromColumn: formData.dateFromColumn,
        dateToColumn: formData.dateToColumn,
        timeUnit: formData.timeUnit,
        conditionalField: formData.conditionalField,
        conditionalOperator: formData.conditionalOperator,
        conditionalValue: formData.conditionalValue,
        convertToNumber: formData.convertToNumber,
        handleNulls: formData.handleNulls
      }
    );

    const submitData = {
      // Core Identity
      name: formData.name,
      description: formData.description,
      metricKey: finalMetricKey,
      
      // Calculation Logic
      sourceTable: finalSourceTable,
      exprSql: finalExprSql,
      filters: formData.filters || formData.filterConfig,
      dateColumn: formData.dateColumn || 'created_at',
      
      // Display & Goals
      category: formData.category,
      format: formData.format,
      unit: formData.unit,
      yearlyGoal: formData.yearlyGoal,
      goalType: formData.goalType,
      quarterlyGoals: formData.quarterlyGoals,
      monthlyGoals: formData.monthlyGoals,
      isIncreasing: formData.isIncreasing,
      isNorthStar: formData.isNorthStar,
      
      // Calculated Fields Configuration
      useCalculatedField: formData.useCalculatedField,
      calculationType: formData.calculationType,
      dateFromColumn: formData.dateFromColumn,
      dateToColumn: formData.dateToColumn,
      timeUnit: formData.timeUnit,
      conditionalField: formData.conditionalField,
      conditionalOperator: formData.conditionalOperator,
      conditionalValue: formData.conditionalValue,
      convertToNumber: formData.convertToNumber,
      handleNulls: formData.handleNulls,
      
      // Metadata
      tags: formData.tags || [],
      priority: 1,
      isActive: true,
      
      // Legacy fields for backward compatibility (if needed by API)
      mainDataSource: formData.mainDataSource,
      table: formData.table,
      valueColumn: formData.valueColumn,
      aggregationType: formData.aggregationType,
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
    if (!table) {
      console.log('🔍 fetchAvailableColumns called with empty table');
      return [];
    }
    
    console.log(`🔍 fetchAvailableColumns called for table: ${table}`);
    
    try {
      const response = await apiRequestJson('GET', `/api/company/table-columns/${table}`);
      console.log(`✅ Columns fetched for ${table}:`, response.columns);
      return response.columns?.map((col: { columnName: string }) => col.columnName) || [];
    } catch (error) {
      console.error(`❌ Failed to fetch columns for table ${table}:`, error);
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
      // Only clear table and value column when data source changes for new metrics, not when editing
      if (!editingMetric) {
        setFormData(prev => ({ ...prev, table: "", valueColumn: "", aggregationType: "SUM" }));
      }
      setAvailableColumns([]);
    } else {
      setAvailableTables([]);
      setAvailableColumns([]);
    }
  }, [formData.mainDataSource, editingMetric]);

  // Update available columns when table changes
  React.useEffect(() => {
    console.log('🔍 Table useEffect triggered:', { 
      mainDataSource: formData.mainDataSource, 
      table: formData.table,
      availableColumnsLength: availableColumns.length
    });
    
    if (formData.mainDataSource && formData.table) {
      console.log('✅ Both mainDataSource and table are set, fetching columns...');
      // Extract just the table name if it's schema-qualified
      const tableNameOnly = formData.table.replace(/^analytics_company_\d+\./, '');
      fetchAvailableColumns(tableNameOnly).then(columns => {
        console.log('✅ Setting available columns from useEffect:', columns);
        setAvailableColumns(columns);
        // Clear value column if it's not in the new columns list (but not when editing existing metrics)
        if (formData.valueColumn && !columns.includes(formData.valueColumn) && !editingMetric) {
          setFormData(prev => ({ ...prev, valueColumn: "", aggregationType: "SUM" }));
        }
      });
    } else {
      console.log('⚠️ Either mainDataSource or table is missing, clearing columns');
      setAvailableColumns([]);
    }
  }, [formData.mainDataSource, formData.table]);
  
  // Fallback effect to re-fetch columns if they're empty but we have a table
  React.useEffect(() => {
    if (formData.table && availableColumns.length === 0 && isDialogOpen) {
      console.log('🔄 FALLBACK: Re-fetching columns because they are empty');
      const tableNameOnly = formData.table.replace(/^analytics_company_\d+\./, '');
      fetchAvailableColumns(tableNameOnly).then(columns => {
        console.log('🔄 FALLBACK columns fetched:', columns);
        setAvailableColumns(columns);
      });
    }
  }, [formData.table, availableColumns.length, isDialogOpen]);

  // Auto-update unit when format changes
  React.useEffect(() => {
    const autoUnit = getUnitFromFormat(formData.format);
    setFormData(prev => ({ ...prev, unit: autoUnit }));
  }, [formData.format]);


  // Debug logging for data sources removed to prevent infinite loop

  // Auto-select first available data source when data sources are loaded (only for new metrics, not when editing)
  React.useEffect(() => {
    if (companyDataSources.length > 0 && !formData.mainDataSource && !editingMetric) {
      const firstSource = companyDataSources[0];
      console.log('🎯 Auto-selecting first data source:', firstSource);
      setFormData(prev => ({ ...prev, mainDataSource: firstSource.sourceType }));
    }
  }, [companyDataSources, formData.mainDataSource, editingMetric]);

  // Auto-select first available table when data source is selected (only for new metrics, not when editing)
  React.useEffect(() => {
    if (formData.mainDataSource && !formData.table && !editingMetric) {
      const availableTables = getAvailableTables(formData.mainDataSource);
      if (availableTables.length > 0) {
        const firstTable = availableTables[0];
        console.log('🎯 Auto-selecting first table:', firstTable);
        setFormData(prev => ({ ...prev, table: firstTable }));
      }
    }
  }, [formData.mainDataSource, formData.table, editingMetric]);

  // Auto-generate tags when relevant fields change (only for new metrics, not when editing)
  React.useEffect(() => {
    if (!editingMetric) {
      const autoTags = generateTags(formData);
      setFormData(prev => ({ ...prev, tags: autoTags }));
    }
  }, [formData.category, formData.mainDataSource, formData.format, formData.isNorthStar, editingMetric]);

  const getFormatLabel = (format: string) => {
    return METRIC_FORMATS.find(fmt => fmt.value === format)?.label || "Currency ($)";
  };

  // Handle company selection error
  if (error && (error.message?.includes('company selected') || error.message?.includes('No company selected'))) {
    return (
      <>
        <Header 
          title="Metrics Management"
          subtitle="Configure your business metrics and yearly goals"
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="p-6">
              <div className="text-center py-12">
                <BarChart3 className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Company Selection Required</h3>
                <p className="text-gray-500 mb-4">
                  Please select a company first to view and manage metrics.
                </p>
                <Button onClick={() => window.location.href = '/companies'}>
                  Select Company
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

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
                <DialogDescription>
                  {editingMetric 
                    ? "Modify the configuration for this business metric and its yearly goals." 
                    : "Create a new business metric to track against yearly goals with data source integration."
                  }
                </DialogDescription>
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
                                  
                                  // Smart date column detection
                                  let dateColumn = 'created_at';
                                  if (mainDataSource === 'jira') {
                                    if (name.includes('resolved') || name.includes('completed') || description.includes('resolved') || description.includes('completed')) {
                                      dateColumn = 'resolved_at';
                                    } else if (name.includes('closed') || description.includes('closed')) {
                                      dateColumn = 'closed_at';
                                    } else if (name.includes('updated') || description.includes('updated')) {
                                      dateColumn = 'updated_at';
                                    } else {
                                      dateColumn = 'created_at';
                                    }
                                  } else if (mainDataSource === 'salesforce') {
                                    if (name.includes('closed') || description.includes('closed') || name.includes('won') || description.includes('won')) {
                                      dateColumn = 'closed_date';
                                    } else if (name.includes('created') || description.includes('created')) {
                                      dateColumn = 'created_date';
                                    } else {
                                      dateColumn = 'created_date';
                                    }
                                  } else if (mainDataSource === 'hubspot') {
                                    if (name.includes('closed') || description.includes('closed')) {
                                      dateColumn = 'close_date';
                                    } else {
                                      dateColumn = 'created_at';
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
                                    valueColumn,
                                    dateColumn
                                  };
                                };
                                
                                const smartConfig = generateSmartConfig();
                                console.log('Smart config generated:', smartConfig);
                                console.log('Form data before update:', { mainDataSource: formData.mainDataSource, table: formData.table, valueColumn: formData.valueColumn });
                                
                                // Update available tables and columns manually
                                const newTables = getAvailableTables(smartConfig.mainDataSource);
                                console.log('New tables:', newTables);
                                
                                // Fetch columns asynchronously
                                const tableNameOnly = smartConfig.table.replace(/^analytics_company_\d+\./, '');
                                fetchAvailableColumns(tableNameOnly).then(newColumns => {
                                  console.log('New columns:', newColumns);
                                  setAvailableColumns(newColumns);
                                });
                                
                                // Update available tables
                                setAvailableTables(newTables);
                                setSelectKey(prev => prev + 1); // Force re-render of Select components
                                
                                // Update form data in sequence to ensure dependencies work
                                setFormData(prevFormData => ({ 
                                  ...prevFormData, 
                                  mainDataSource: smartConfig.mainDataSource
                                }));
                                
                                // Small delay then update table, value column, and date column
                                setTimeout(() => {
                                  setFormData(prevFormData => ({ 
                                    ...prevFormData, 
                                    table: smartConfig.table,
                                    valueColumn: smartConfig.valueColumn,
                                    dateColumn: smartConfig.dateColumn,
                                    aggregationType: "SUM"
                                  }));
                                }, 50);
                                
                                // Add a small delay to ensure DOM updates
                                setTimeout(() => {
                                  toast({
                                    title: "AI Configuration Applied",
                                    description: `Configured ${smartConfig.mainDataSource} → ${smartConfig.table} → ${smartConfig.valueColumn} (${smartConfig.dateColumn})`,
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
                        <div className="grid grid-cols-2 gap-4 mb-4">
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
                        
                        {/* Calculated Field Toggle */}
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                          <div className="flex items-center space-x-3 mb-4">
                            <Checkbox 
                              id="useCalculatedField"
                              checked={formData.useCalculatedField}
                              onCheckedChange={(checked) => {
                                setFormData({ ...formData, useCalculatedField: !!checked });
                                // Reset calculation fields when toggling
                                if (!checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    useCalculatedField: false,
                                    calculationType: "time_difference",
                                    dateFromColumn: "",
                                    dateToColumn: "",
                                    timeUnit: "days"
                                  }));
                                }
                              }}
                            />
                            <Label htmlFor="useCalculatedField" className="text-sm font-medium cursor-pointer">
                              Use Calculated Field
                            </Label>
                          </div>
                          
                          {formData.useCalculatedField && (
                            <div className="space-y-4">
                              {/* Calculation Type */}
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Calculation Type</label>
                                <Select 
                                  value={formData.calculationType} 
                                  onValueChange={(value) => setFormData({ ...formData, calculationType: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="time_difference">Time Difference</SelectItem>
                                    <SelectItem value="conditional_count">Conditional Count</SelectItem>
                                    <SelectItem value="conditional_sum">Conditional Sum</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* Time Difference Configuration */}
                              {formData.calculationType === "time_difference" && (
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">From Date</label>
                                    <Select
                                      value={formData.dateFromColumn || ""}
                                      onValueChange={(value) => setFormData({ ...formData, dateFromColumn: value })}
                                      disabled={!formData.table}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select start date" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableColumns.filter(column => 
                                          column.toLowerCase().includes('date') || 
                                          column.toLowerCase().includes('time') ||
                                          column.toLowerCase().includes('created') ||
                                          column.toLowerCase().includes('updated')
                                        ).map((column) => (
                                          <SelectItem key={column} value={column}>
                                            {column}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">To Date</label>
                                    <Select
                                      value={formData.dateToColumn || ""}
                                      onValueChange={(value) => setFormData({ ...formData, dateToColumn: value })}
                                      disabled={!formData.table}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select end date" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availableColumns.filter(column => 
                                          column.toLowerCase().includes('date') || 
                                          column.toLowerCase().includes('time') ||
                                          column.toLowerCase().includes('resolved') ||
                                          column.toLowerCase().includes('closed')
                                        ).map((column) => (
                                          <SelectItem key={column} value={column}>
                                            {column}
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="CURRENT_DATE">Current Date</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Time Unit</label>
                                    <Select
                                      value={formData.timeUnit}
                                      onValueChange={(value) => setFormData({ ...formData, timeUnit: value })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="days">Days</SelectItem>
                                        <SelectItem value="hours">Hours</SelectItem>
                                        <SelectItem value="weeks">Weeks</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )}
                              
                              {/* Conditional Aggregation Configuration */}
                              {(formData.calculationType === "conditional_count" || formData.calculationType === "conditional_sum") && (
                                <div className="grid grid-cols-3 gap-4">
                                  <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Field</label>
                                    <Select
                                      value={formData.conditionalField || ""}
                                      onValueChange={(value) => setFormData({ ...formData, conditionalField: value })}
                                      disabled={!formData.table}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select field" />
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
                                  <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Condition</label>
                                    <Select
                                      value={formData.conditionalOperator}
                                      onValueChange={(value) => setFormData({ ...formData, conditionalOperator: value })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="=">Equals (=)</SelectItem>
                                        <SelectItem value="!=">Not Equals (!=)</SelectItem>
                                        <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                                        <SelectItem value="<">Less Than (&lt;)</SelectItem>
                                        <SelectItem value=">=">Greater or Equal (&gt;=)</SelectItem>
                                        <SelectItem value="<=">Less or Equal (&lt;=)</SelectItem>
                                        <SelectItem value="LIKE">Contains (LIKE)</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium text-gray-700 mb-1 block">Value</label>
                                    <Input
                                      value={formData.conditionalValue}
                                      onChange={(e) => setFormData({ ...formData, conditionalValue: e.target.value })}
                                      placeholder="Enter value"
                                    />
                                  </div>
                                </div>
                              )}
                              
                              {/* Data Handling Options */}
                              <div className="flex items-center space-x-6">
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    id="convertToNumber"
                                    checked={formData.convertToNumber}
                                    onCheckedChange={(checked) => setFormData({ ...formData, convertToNumber: !!checked })}
                                  />
                                  <Label htmlFor="convertToNumber" className="text-sm cursor-pointer">
                                    Convert to Number
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    id="handleNulls"
                                    checked={formData.handleNulls}
                                    onCheckedChange={(checked) => setFormData({ ...formData, handleNulls: !!checked })}
                                  />
                                  <Label htmlFor="handleNulls" className="text-sm cursor-pointer">
                                    Replace NULL with 0
                                  </Label>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Date Column *</label>
                            <Select
                              key={`dateColumn-${selectKey}`}
                              value={formData.dateColumn || ""}
                              onValueChange={(value) => setFormData({ ...formData, dateColumn: value })}
                              disabled={!formData.table}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={formData.table ? "Select date column" : "Select table first"} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableColumns.filter(column => 
                                  column.toLowerCase().includes('date') || 
                                  column.toLowerCase().includes('time') ||
                                  column.toLowerCase().includes('created') ||
                                  column.toLowerCase().includes('updated') ||
                                  column.toLowerCase().includes('resolved') ||
                                  column.toLowerCase().includes('closed')
                                ).map((column) => (
                                  <SelectItem key={column} value={column}>
                                    {column}
                                  </SelectItem>
                                ))}
                                {availableColumns.filter(column => 
                                  !(column.toLowerCase().includes('date') || 
                                    column.toLowerCase().includes('time') ||
                                    column.toLowerCase().includes('created') ||
                                    column.toLowerCase().includes('updated') ||
                                    column.toLowerCase().includes('resolved') ||
                                    column.toLowerCase().includes('closed'))
                                ).map((column) => (
                                  <SelectItem key={column} value={column}>
                                    {column} (non-date)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500 mt-1">
                              Used for joining to date spine and time period filtering
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">Aggregation Type</label>
                            <Select
                              value={formData.aggregationType || "SUM"}
                              onValueChange={(value) => setFormData({ ...formData, aggregationType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select aggregation" />
                              </SelectTrigger>
                              <SelectContent>
                                {AGGREGATION_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
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
                        .map((metric: Metric) => {
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