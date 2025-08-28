import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  ArrowLeft, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle, 
  Share2,
  RefreshCw,
  BarChart3,
  Target,
  DollarSign,
  Brain,
  Sparkles,
  Mail,
  Link,
  Copy,
  Settings,
  ChevronRight,
  ChevronDown,
  Clock,
  Zap,
  Activity,
  Award,
  Database,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReportData {
  report: {
    id: number;
    title: string;
    description: string;
    createdAt: string;
  };
  timePeriod: string;
  generatedAt: string;
  metrics: Array<{
    id: number;
    name: string;
    description: string;
    category: string;
    format: string;
    yearlyGoal: string;
    isIncreasing: boolean;
    currentValue: number | null;
    goalProgress: number | null;
    changePercent: string | null;
    status: 'success' | 'error' | 'pending';
    onPace?: boolean | null;
    expectedProgress?: number | null;
  }>;
  summary: {
    totalMetrics: number;
    calculatedMetrics: number;
    failedMetrics: number;
  };
}

export default function MetricReportViewer() {
  // Add alert to confirm component is being rendered
  console.log("🚀 MetricReportViewer component is loading!");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/metric-reports/:id/view");
  const [location] = useLocation();
  const [timePeriod, setTimePeriod] = useState("monthly");
  const [showInsights, setShowInsights] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [selectedMetricForAI, setSelectedMetricForAI] = useState<string | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [selectedMetricForSQL, setSelectedMetricForSQL] = useState<any>(null);
  const [sqlDialogOpen, setSqlDialogOpen] = useState(false);
  
  // Customizable thresholds for color coding
  const [greenThreshold, setGreenThreshold] = useState(100); // Green = 100%+ by default
  const [yellowThreshold, setYellowThreshold] = useState(70); // Yellow = 70-99% by default
  
  const reportId = params?.id;
  
  console.log("=== METRIC REPORT VIEWER DEBUG ===");
  console.log("match:", match);
  console.log("params:", params);
  console.log("reportId:", reportId);
  console.log("location:", location);
  console.log("window.location.pathname:", window.location.pathname);

  // Fallback route parsing if useRoute fails
  const pathMatch = location.match(/^\/metric-reports\/(\d+)\/view$/);
  const fallbackReportId = pathMatch ? pathMatch[1] : null;
  
  console.log("pathMatch:", pathMatch);
  console.log("fallbackReportId:", fallbackReportId);
  
  const finalReportId = reportId || fallbackReportId;
  
  console.log("reportId:", reportId);
  console.log("fallbackReportId:", fallbackReportId);
  console.log("finalReportId:", finalReportId);
  console.log("match:", match);
  console.log("!match:", !match);
  console.log("!finalReportId:", !finalReportId);
  console.log("shouldShowNotFound:", !match && !finalReportId);

  // Add alert for debugging
  if (!match && !finalReportId) {
    console.error("SHOWING 'REPORT NOT FOUND' - Route matching failed completely");
    console.error("Current location:", location);
    console.error("Window pathname:", window.location.pathname);
  }

  // Fetch report data with real calculations
  const { data: reportData, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/metric-reports", finalReportId, "data", timePeriod],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true, // Always refetch when component mounts
    queryFn: async (): Promise<ReportData> => {
      console.log("Fetching report data for ID:", finalReportId);
      const response = await fetch(`/api/metric-reports/${finalReportId}/data?timePeriod=${timePeriod}`);
      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log("Error response:", errorText);
        throw new Error(`Failed to fetch report data: ${response.status} ${errorText}`);
      }
      
      const responseText = await response.text();
      console.log("Raw response text:", responseText);
      
      try {
        const data = JSON.parse(responseText);
        console.log("Parsed JSON data:", data);
        console.log("🔍 SQL QUERY DEBUG: First metric sqlQuery:", data.metrics?.[0]?.sqlQuery);
        console.log("🔍 SQL QUERY DEBUG: All metrics have sqlQuery?", data.metrics?.every((m: any) => m.sqlQuery));
        return data;
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("Response was not JSON:", responseText.substring(0, 200));
        throw new Error(`Invalid JSON response: ${parseError}`);
      }
    },
    enabled: !!finalReportId,
  });

  // Generate AI insights mutation
  const generateInsightsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/metric-reports/${finalReportId}/insights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timePeriod })
      });
      if (!response.ok) throw new Error('Failed to generate insights');
      return response.json();
    },
    onSuccess: (data) => {
      setShowInsights(true);
      queryClient.setQueryData(["/api/metric-reports", finalReportId, "insights", timePeriod], data);
      toast({
        title: "Insights Generated",
        description: "AI-powered business insights have been generated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Insights Error",
        description: "Failed to generate insights. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Fetch existing insights
  const { data: insightsData } = useQuery({
    queryKey: ["/api/metric-reports", finalReportId, "insights", timePeriod],
    enabled: false // Only fetch when explicitly requested
  });

  // Auto-generate insights when report data loads
  useEffect(() => {
    if (reportData && finalReportId && !insightsData && !generateInsightsMutation.data && !generateInsightsMutation.isPending) {
      console.log("🤖 Auto-generating insights for report:", finalReportId);
      generateInsightsMutation.mutate();
    }
  }, [reportData, finalReportId, insightsData, generateInsightsMutation]);

  // Parse AI insights into structured format
  const parseInsights = (insightsText: string) => {
    if (!insightsText) return [];
    
    const metrics = insightsText.split('## METRIC:').slice(1);
    return metrics.map(metricText => {
      const lines = metricText.trim().split('\n');
      const metricName = lines[0]?.trim() || 'Unknown Metric';
      
      const sections = {
        executiveSummary: '',
        dataSourceExplanation: '',
        outlookWeek: '',
        outlookMonth: '',
        outlookQuarter: '',
        outlookYear: ''
      };
      
      let currentSection = '';
      let sectionContent = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('### Executive Summary')) {
          if (currentSection && sectionContent.length) {
            sections[currentSection as keyof typeof sections] = sectionContent.join(' ').trim();
            sectionContent = [];
          }
          currentSection = 'executiveSummary';
        } else if (line.startsWith('### Data Source Explanation')) {
          if (currentSection && sectionContent.length) {
            sections[currentSection as keyof typeof sections] = sectionContent.join(' ').trim();
            sectionContent = [];
          }
          currentSection = 'dataSourceExplanation';
        } else if (line.startsWith('### Outlook This Week')) {
          if (currentSection && sectionContent.length) {
            sections[currentSection as keyof typeof sections] = sectionContent.join(' ').trim();
            sectionContent = [];
          }
          currentSection = 'outlookWeek';
        } else if (line.startsWith('### Outlook This Month')) {
          if (currentSection && sectionContent.length) {
            sections[currentSection as keyof typeof sections] = sectionContent.join(' ').trim();
            sectionContent = [];
          }
          currentSection = 'outlookMonth';
        } else if (line.startsWith('### Outlook This Quarter')) {
          if (currentSection && sectionContent.length) {
            sections[currentSection as keyof typeof sections] = sectionContent.join(' ').trim();
            sectionContent = [];
          }
          currentSection = 'outlookQuarter';
        } else if (line.startsWith('### Outlook This Year')) {
          if (currentSection && sectionContent.length) {
            sections[currentSection as keyof typeof sections] = sectionContent.join(' ').trim();
            sectionContent = [];
          }
          currentSection = 'outlookYear';
        } else if (line && !line.startsWith('#')) {
          sectionContent.push(line);
        }
      }
      
      // Don't forget the last section
      if (currentSection && sectionContent.length) {
        sections[currentSection as keyof typeof sections] = sectionContent.join(' ').trim();
      }
      
      return {
        name: metricName,
        ...sections
      };
    });
  };

  const toggleInsightExpansion = (metricName: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(metricName)) {
      newExpanded.delete(metricName);
    } else {
      newExpanded.add(metricName);
    }
    setExpandedInsights(newExpanded);
  };

  // Get insights for a specific metric
  const getMetricInsights = (metricName: string) => {
    const allInsights = insightsData?.insights || generateInsightsMutation.data?.insights;
    if (!allInsights) return null;
    
    const parsedInsights = parseInsights(allInsights);
    return parsedInsights.find(insight => insight.name === metricName);
  };

  // Open AI dialog for specific metric
  const openAIInsights = (metricName: string) => {
    setSelectedMetricForAI(metricName);
    setAiDialogOpen(true);
  };

  // Open SQL explanation dialog for specific metric
  const openSQLExplanation = (metric: any) => {
    console.log("DEBUG: Opening SQL explanation for metric:", metric);
    console.log("DEBUG: Metric sqlQuery:", metric.sqlQuery);
    console.log("DEBUG: Metric properties:", Object.keys(metric));
    console.log("DEBUG: Full metric object:", JSON.stringify(metric, null, 2));
    setSelectedMetricForSQL(metric);
    setSqlDialogOpen(true);
  };

  // Generate plain English explanation of SQL
  const generateSQLExplanation = (sqlQuery: string, metricName: string) => {
    console.log("DEBUG: generateSQLExplanation called with:");
    console.log("DEBUG: sqlQuery:", sqlQuery);
    console.log("DEBUG: metricName:", metricName);
    if (!sqlQuery) return "No SQL query available for this metric.";
    
    // Simple heuristic-based translation for common patterns
    let explanation = "";
    const lowerSQL = sqlQuery.toLowerCase();
    
    if (lowerSQL.includes('revenue') || lowerSQL.includes('amount')) {
      explanation += `This metric calculates ${metricName.toLowerCase()} by summing monetary amounts from your data sources. `;
    }
    
    if (lowerSQL.includes('hubspot') && lowerSQL.includes('salesforce')) {
      explanation += "It combines data from both HubSpot and Salesforce systems. ";
    } else if (lowerSQL.includes('hubspot')) {
      explanation += "It uses data from your HubSpot system. ";
    } else if (lowerSQL.includes('salesforce')) {
      explanation += "It uses data from your Salesforce system. ";
    }
    
    if (lowerSQL.includes('closedwon') || lowerSQL.includes('closed won')) {
      explanation += "It only counts deals that are marked as 'Closed Won'. ";
    }
    
    if (lowerSQL.includes('current_date') || lowerSQL.includes('extract(year')) {
      explanation += "It filters data for the current time period. ";
    }
    
    if (lowerSQL.includes('date_trunc')) {
      explanation += "Data is grouped by specific time periods (daily, weekly, monthly, etc.). ";
    }
    
    explanation += "The result gives you a single number representing the total value for this metric.";
    
    return explanation || "This query retrieves and calculates data from your connected business systems to generate this metric value.";
  };

  const formatValue = (value: number | null, format: string) => {
    if (value === null || value === undefined) return "N/A";
    
    switch (format) {
      case "currency":
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(value);
      case "percentage":
        return `${value.toFixed(1)}%`;
      case "number":
        return new Intl.NumberFormat('en-US').format(value);
      default:
        return value.toString();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <RefreshCw className="h-4 w-4 text-gray-400 animate-spin" />;
    }
  };

  const isNorthStarMetric = (metric: any) => {
    // Determine if this is a North Star metric based on various criteria
    const northStarKeywords = ['revenue', 'arr', 'mrr', 'users', 'growth', 'churn'];
    const metricNameLower = metric.name.toLowerCase();
    const hasNorthStarKeyword = northStarKeywords.some(keyword => metricNameLower.includes(keyword));
    
    // You can also check if it's marked as important based on goal size or other factors
    const hasHighGoal = metric.yearlyGoal && parseFloat(metric.yearlyGoal) > 100000;
    
    return hasNorthStarKeyword || hasHighGoal || metric.category === 'revenue';
  };

  const getMetricTypeTag = (metric: any) => {
    if (isNorthStarMetric(metric)) {
      return <Badge variant="default" className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100 font-medium">⭐ North Star</Badge>;
    }
    
    switch (metric.category) {
      case 'revenue':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200 font-medium">💰 Revenue</Badge>;
      case 'growth':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 border-green-200 font-medium">📈 Growth</Badge>;
      case 'efficiency':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-700 border-orange-200 font-medium">⚡ Efficiency</Badge>;
      case 'marketing':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-pink-50 text-pink-700 border-pink-200 font-medium">📢 Marketing</Badge>;
      case 'sales':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">🎯 Sales</Badge>;
      case 'operations':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-700 border-slate-200 font-medium">⚙️ Operations</Badge>;
      case 'finance':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-yellow-50 text-yellow-700 border-yellow-200 font-medium">💼 Finance</Badge>;
      case 'customer':
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-cyan-50 text-cyan-700 border-cyan-200 font-medium">👥 Customer</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-700 border-gray-200 font-medium">📊 Business</Badge>;
    }
  };

  const getProgressColor = (progress: number | null, isIncreasing: boolean) => {
    if (progress === null) return "bg-gray-300";
    
    // Use dynamic thresholds
    if (progress >= greenThreshold) return "bg-green-500";
    if (progress >= yellowThreshold) return "bg-yellow-500";
    return "bg-red-500";
  };
  
  const getProgressSymbol = (progress: number | null) => {
    if (progress === null) return "?";
    if (progress >= greenThreshold) return "✓";
    if (progress >= yellowThreshold) return "~";
    return "!";
  };

  const getProgressText = (progress: number | null) => {
    if (progress === null) return "";
    if (progress >= 100) {
      return `${(progress - 100).toFixed(0)}% over goal`;
    } else {
      return `${(100 - progress).toFixed(0)}% under goal`;
    }
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Report link has been copied to clipboard.",
    });
  };

  const shareViaEmail = () => {
    const reportUrl = window.location.href;
    const subject = encodeURIComponent(`Business Metrics Report: ${reportData?.report.title}`);
    const body = encodeURIComponent(`Hi there,

I wanted to share this business metrics report with you: ${reportData?.report.title}

View the report here: ${reportUrl}

This report includes:
• Real-time business metrics with goal tracking
• AI-powered insights and analysis
• Progress indicators and performance status

Generated on: ${new Date().toLocaleDateString()}

Best regards`);

    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
  };

  const copyReportSummary = () => {
    if (!reportData) return;
    
    const summary = `Business Metrics Report: ${reportData.report.title}

Generated: ${new Date(reportData.generatedAt).toLocaleDateString()}
Metrics Calculated: ${reportData.summary.calculatedMetrics}/${reportData.summary.totalMetrics}

Key Metrics:
${reportData.metrics.slice(0, 5).map((metric: any) => 
  `• ${metric.name}: ${metric.currentValue ? new Intl.NumberFormat().format(metric.currentValue) : 'N/A'} ${metric.goalProgress ? `(${metric.goalProgress.toFixed(1)}% of goal)` : ''}`
).join('\n')}

View full report: ${window.location.href}`;

    navigator.clipboard.writeText(summary);
    toast({
      title: "Summary Copied",
      description: "Report summary has been copied to clipboard.",
    });
  };


  if (!match && !finalReportId) {
    return <div>Report not found</div>;
  }

  console.log("=== LOADING AND DATA STATE ===");
  console.log("isLoading:", isLoading);
  console.log("error:", error);
  console.log("reportData:", reportData);
  console.log("reportData exists:", !!reportData);
  console.log("Query enabled:", !!finalReportId);

  if (isLoading) {
    console.log("🔄 SHOWING LOADING STATE");
    return (
      <>
        <Header 
          title="Loading Report..."
          subtitle="Generating metric calculations"
        />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-24 bg-gray-200 rounded"></div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </>
    );
  }

  if (!reportData) {
    console.error("❌ SHOWING 'REPORT NOT FOUND' - No report data after loading");
    console.log("reportData value:", reportData);
    console.log("isLoading:", isLoading);
    console.log("finalReportId:", finalReportId);
    return (
      <>
        <Header 
          title="Report Not Found"
          subtitle="The requested report could not be loaded"
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Report Not Found</h3>
              <p className="text-gray-500 mb-4">
                The report you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={() => setLocation("/metric-reports")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Reports
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header 
        title={reportData.report.title}
        subtitle={`Business Metrics Report • ${reportData.summary.calculatedMetrics}/${reportData.summary.totalMetrics} metrics calculated`}
        actions={
          <div className="flex items-center space-x-3">
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily View</SelectItem>
                <SelectItem value="weekly">Weekly View</SelectItem>
                <SelectItem value="monthly">Monthly View</SelectItem>
                <SelectItem value="quarterly">Quarterly View</SelectItem>
                <SelectItem value="ytd">Year to Date</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Threshold Settings */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm mb-3">Performance Thresholds</h4>
                    <p className="text-xs text-gray-500 mb-4">
                      Customize when metrics show as green, yellow, or red based on progress percentage.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="green-threshold" className="text-xs font-medium">
                        Green Threshold (Excellent)
                      </Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          id="green-threshold"
                          type="number"
                          min="0"
                          max="200"
                          value={greenThreshold}
                          onChange={(e) => setGreenThreshold(Number(e.target.value))}
                          className="h-8"
                        />
                        <span className="text-xs text-gray-500">%+</span>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="yellow-threshold" className="text-xs font-medium">
                        Yellow Threshold (Good)
                      </Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          id="yellow-threshold"
                          type="number"
                          min="0"
                          max="100"
                          value={yellowThreshold}
                          onChange={(e) => setYellowThreshold(Number(e.target.value))}
                          className="h-8"
                        />
                        <span className="text-xs text-gray-500">%+</span>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t">
                      <div className="text-xs text-gray-600 space-y-1">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span>≥ {greenThreshold}% (Excellent)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <span>{yellowThreshold}% - {greenThreshold-1}% (Good)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span>&lt; {yellowThreshold}% (Needs Attention)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => generateInsightsMutation.mutate()}
              disabled={generateInsightsMutation.isPending}
              className="bg-purple-50 hover:bg-purple-100 border-purple-200"
            >
              {generateInsightsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Share2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={copyShareLink}>
                  <Link className="h-4 w-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareViaEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  Share via Email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={copyReportSummary}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Summary
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setLocation("/metric-reports")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Reports
            </Button>
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto p-3">
        <div className="space-y-3 max-w-full mx-auto">
          
          {/* Compact Report Info */}
          <Card className="border-gray-200">
            <CardContent className="p-2">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    <span>Generated: {new Date(reportData.generatedAt).toLocaleString()}</span>
                    <span>•</span>
                    <span>{reportData.summary.calculatedMetrics}/{reportData.summary.totalMetrics} metrics calculated</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Compact Metrics Grid */}
          <div className="space-y-2 overflow-x-auto">
            {reportData.metrics.map((metric) => {
              console.log("🎯 RENDER DEBUG: Processing metric:", metric.name, "sqlQuery present:", !!metric.sqlQuery);
              
              // Get time frame settings from report config (default to all true for backward compatibility)
              const timeFrameSettings = reportData.report.reportConfig?.timeFrames || {
                week: true,
                month: true,
                quarter: true,
                year: true,
              };
              
              // Calculate dynamic grid columns based on selected time frames
              const selectedTimeFrames = Object.values(timeFrameSettings).filter(Boolean).length;
              const gridCols = selectedTimeFrames === 4 ? "grid-cols-[minmax(200px,2fr),1fr,1fr,1fr,1fr,0.6fr,0.6fr]" :
                              selectedTimeFrames === 3 ? "grid-cols-[minmax(200px,2fr),1fr,1fr,1fr,0.7fr,0.7fr]" :
                              selectedTimeFrames === 2 ? "grid-cols-[minmax(200px,2fr),1fr,1fr,0.8fr,0.8fr]" :
                              selectedTimeFrames === 1 ? "grid-cols-[minmax(200px,2fr),1fr,0.9fr,0.9fr]" :
                              "grid-cols-[minmax(200px,2fr),0.9fr,0.9fr]"; // fallback if no time frames selected
              
              // Calculate time-period progress percentages
              const currentValue = metric.currentValue || 0;
              const yearlyGoal = metric.yearlyGoal ? parseFloat(metric.yearlyGoal) : 1;
              
              // Calculate expected progress for each time period based on current date
              const now = new Date();
              const startOfYear = new Date(now.getFullYear(), 0, 1);
              const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const weekOfYear = Math.ceil(dayOfYear / 7);
              const monthOfYear = now.getMonth() + 1;
              const quarterOfYear = Math.ceil(monthOfYear / 3);
              
              // Calculate expected vs actual progress for each period
              const weekProgress = ((currentValue / yearlyGoal) * 100) / (weekOfYear / 52);
              const monthProgress = ((currentValue / yearlyGoal) * 100) / (monthOfYear / 12);
              const quarterProgress = ((currentValue / yearlyGoal) * 100) / (quarterOfYear / 4);
              const yearProgress = (currentValue / yearlyGoal) * 100;
              
              return (
                <Card key={metric.id} className="overflow-hidden w-full min-w-0">
                  <CardContent className="p-0">
                    {metric.status === 'error' ? (
                      <div className="p-4 text-center text-red-500 bg-red-50">
                        <AlertCircle className="h-6 w-6 mx-auto mb-1" />
                        <div className="text-sm font-medium">Unable to calculate metric</div>
                      </div>
                    ) : (
                      <div className={`grid ${gridCols} divide-x divide-gray-200 min-w-full overflow-x-auto`}>
                        {/* Metric Info */}
                        <div className="p-2 relative bg-gray-50 min-h-[50px] overflow-hidden">
                          <div className="absolute top-1 right-1 z-10">
                            {getMetricTypeTag(metric)}
                          </div>
                          <div className="flex items-center justify-center h-full pr-16">
                            <div className="text-center max-w-full">
                              <div className="font-semibold text-sm mb-1 break-words overflow-hidden" style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}>{metric.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {formatValue(metric.currentValue, metric.format)}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* This Week */}
                        {timeFrameSettings.week && (
                          <div className="p-1 flex flex-col items-center justify-center text-center min-h-[50px] overflow-hidden">
                            <div className="text-xs font-medium text-gray-700 mb-1 truncate w-full">This Week</div>
                            <div 
                              className={`w-7 h-7 rounded-full flex items-center justify-center ${getProgressColor(weekProgress, metric.isIncreasing)} transition-all duration-300`}
                            >
                              <div className="text-white font-bold text-xs">
                                {getProgressSymbol(weekProgress)}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 truncate w-full">
                              {getProgressText(weekProgress)}
                            </div>
                          </div>
                        )}
                        
                        {/* This Month */}
                        {timeFrameSettings.month && (
                          <div className="p-1 flex flex-col items-center justify-center text-center min-h-[50px] overflow-hidden">
                            <div className="text-xs font-medium text-gray-700 mb-1 truncate w-full">This Month</div>
                            <div 
                              className={`w-7 h-7 rounded-full flex items-center justify-center ${getProgressColor(monthProgress, metric.isIncreasing)} transition-all duration-300`}
                            >
                              <div className="text-white font-bold text-xs">
                                {getProgressSymbol(monthProgress)}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 truncate w-full">
                              {getProgressText(monthProgress)}
                            </div>
                          </div>
                        )}
                        
                        {/* This Quarter */}
                        {timeFrameSettings.quarter && (
                          <div className="p-1 flex flex-col items-center justify-center text-center min-h-[50px] overflow-hidden">
                            <div className="text-xs font-medium text-gray-700 mb-1 truncate w-full">This Quarter</div>
                            <div 
                              className={`w-7 h-7 rounded-full flex items-center justify-center ${getProgressColor(quarterProgress, metric.isIncreasing)} transition-all duration-300`}
                            >
                              <div className="text-white font-bold text-xs">
                                {getProgressSymbol(quarterProgress)}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 truncate w-full">
                              {getProgressText(quarterProgress)}
                            </div>
                          </div>
                        )}
                        
                        {/* This Year */}
                        {timeFrameSettings.year && (
                          <div className="p-1 flex flex-col items-center justify-center text-center min-h-[50px] overflow-hidden">
                            <div className="text-xs font-medium text-gray-700 mb-1 truncate w-full">This Year</div>
                            <div 
                              className={`w-7 h-7 rounded-full flex items-center justify-center ${getProgressColor(yearProgress, metric.isIncreasing)} transition-all duration-300`}
                            >
                              <div className="text-white font-bold text-xs">
                                {getProgressSymbol(yearProgress)}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1 truncate w-full">
                              {getProgressText(yearProgress)}
                            </div>
                          </div>
                        )}

                        {/* AI Insights Button */}
                        <div className="px-1 py-1 flex flex-col items-center justify-center text-center min-h-[50px] bg-gradient-to-b from-blue-50 to-indigo-50">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAIInsights(metric.name)}
                            className="h-6 w-6 p-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-sm"
                            disabled={generateInsightsMutation.isPending || !getMetricInsights(metric.name)}
                          >
                            {generateInsightsMutation.isPending ? (
                              <Sparkles className="h-3 w-3 animate-spin" />
                            ) : getMetricInsights(metric.name) ? (
                              <Brain className="h-3 w-3" />
                            ) : (
                              <Brain className="h-3 w-3 opacity-50" />
                            )}
                          </Button>
                          <div className="text-xs text-green-600 font-medium mt-1">
                            AI
                          </div>
                        </div>
                        
                        {/* SQL Info Button */}
                        <div className="px-1 py-1 flex flex-col items-center justify-center text-center min-h-[50px] bg-gradient-to-b from-emerald-50 to-teal-50">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openSQLExplanation(metric)}
                            className="h-6 w-6 p-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-sm"
                          >
                            <Info className="h-3 w-3" />
                          </Button>
                          <div className="text-xs text-emerald-600 font-medium mt-1">
                            Definition
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            
            {/* AI Insights Dialog */}
            <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                      <Brain className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-lg font-bold">AI Insights for {selectedMetricForAI}</span>
                      <p className="text-sm text-gray-600 font-normal">Automated forecasts and performance analysis</p>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                
                <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                  {selectedMetricForAI && (() => {
                    const insight = getMetricInsights(selectedMetricForAI);
                    
                    if (!insight) {
                      return (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Brain className="h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No insights available</h3>
                          <p className="text-gray-500">AI insights are still being generated for this metric.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-6">
                        {/* Executive Summary */}
                        {insight.executiveSummary && (
                          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-l-4 border-green-500">
                            <div className="flex items-start space-x-3">
                              <Zap className="h-6 w-6 text-green-600 mt-1 flex-shrink-0" />
                              <div className="w-full">
                                <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide mb-2">Executive Summary & Root Cause Analysis</h3>
                                <div className="text-gray-700 leading-relaxed space-y-2">
                                  {insight.executiveSummary.split('\n').filter(line => line.trim()).map((line, idx) => {
                                    if (line.includes('**') && line.includes(':**')) {
                                      // Parse bold headings like "**Performance Status:** content"
                                      const parts = line.split(':**');
                                      const heading = parts[0].replace(/\*\*/g, '');
                                      const content = parts[1]?.trim();
                                      return (
                                        <div key={idx} className="mb-2">
                                          <span className="font-semibold text-green-900 text-xs uppercase tracking-wide">{heading}:</span>
                                          <span className="ml-2 text-gray-700">{content}</span>
                                        </div>
                                      );
                                    }
                                    return <p key={idx}>{line}</p>;
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Data Source Explanation */}
                        {insight.dataSourceExplanation && (
                          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border-l-4 border-emerald-500">
                            <div className="flex items-start space-x-3">
                              <Database className="h-6 w-6 text-emerald-600 mt-1 flex-shrink-0" />
                              <div className="w-full">
                                <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide mb-2">How This Metric is Calculated</h3>
                                <div className="text-gray-700 leading-relaxed space-y-2">
                                  {insight.dataSourceExplanation.split('\n').filter(line => line.trim()).map((line, idx) => {
                                    if (line.includes('**') && line.includes(':**')) {
                                      const parts = line.split(':**');
                                      const heading = parts[0].replace(/\*\*/g, '');
                                      const content = parts[1]?.trim();
                                      return (
                                        <div key={idx} className="mb-2">
                                          <span className="font-semibold text-emerald-900 text-xs uppercase tracking-wide">{heading}:</span>
                                          <span className="ml-2 text-gray-700">{content}</span>
                                        </div>
                                      );
                                    }
                                    return <p key={idx} className="text-sm">{line}</p>;
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Forecast Timeline */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {insight.outlookWeek && (
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                              <div className="flex items-center space-x-2 mb-3">
                                <Clock className="h-5 w-5 text-green-600" />
                                <h3 className="text-sm font-semibold text-green-800 uppercase tracking-wide">This Week Outlook</h3>
                              </div>
                              <div className="text-green-700 leading-relaxed space-y-2">
                                {insight.outlookWeek.split('\n').filter(line => line.trim()).map((line, idx) => {
                                  if (line.includes('**') && line.includes(':**')) {
                                    const parts = line.split(':**');
                                    const heading = parts[0].replace(/\*\*/g, '');
                                    const content = parts[1]?.trim();
                                    return (
                                      <div key={idx} className="mb-2">
                                        <span className="font-semibold text-green-900 text-xs uppercase tracking-wide">{heading}:</span>
                                        <span className="ml-2 text-green-700">{content}</span>
                                      </div>
                                    );
                                  }
                                  return <p key={idx} className="text-sm">{line}</p>;
                                })}
                              </div>
                            </div>
                          )}
                          
                          {insight.outlookMonth && (
                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                              <div className="flex items-center space-x-2 mb-3">
                                <Activity className="h-5 w-5 text-yellow-600" />
                                <h3 className="text-sm font-semibold text-yellow-800 uppercase tracking-wide">This Month Outlook</h3>
                              </div>
                              <div className="text-yellow-700 leading-relaxed space-y-2">
                                {insight.outlookMonth.split('\n').filter(line => line.trim()).map((line, idx) => {
                                  if (line.includes('**') && line.includes(':**')) {
                                    const parts = line.split(':**');
                                    const heading = parts[0].replace(/\*\*/g, '');
                                    const content = parts[1]?.trim();
                                    return (
                                      <div key={idx} className="mb-2">
                                        <span className="font-semibold text-yellow-900 text-xs uppercase tracking-wide">{heading}:</span>
                                        <span className="ml-2 text-yellow-700">{content}</span>
                                      </div>
                                    );
                                  }
                                  return <p key={idx} className="text-sm">{line}</p>;
                                })}
                              </div>
                            </div>
                          )}
                          
                          {insight.outlookQuarter && (
                            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                              <div className="flex items-center space-x-2 mb-3">
                                <TrendingUp className="h-5 w-5 text-orange-600" />
                                <h3 className="text-sm font-semibold text-orange-800 uppercase tracking-wide">This Quarter Outlook</h3>
                              </div>
                              <div className="text-orange-700 leading-relaxed space-y-2">
                                {insight.outlookQuarter.split('\n').filter(line => line.trim()).map((line, idx) => {
                                  if (line.includes('**') && line.includes(':**')) {
                                    const parts = line.split(':**');
                                    const heading = parts[0].replace(/\*\*/g, '');
                                    const content = parts[1]?.trim();
                                    return (
                                      <div key={idx} className="mb-2">
                                        <span className="font-semibold text-orange-900 text-xs uppercase tracking-wide">{heading}:</span>
                                        <span className="ml-2 text-orange-700">{content}</span>
                                      </div>
                                    );
                                  }
                                  return <p key={idx} className="text-sm">{line}</p>;
                                })}
                              </div>
                            </div>
                          )}
                          
                          {insight.outlookYear && (
                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <div className="flex items-center space-x-2 mb-3">
                                <Target className="h-5 w-5 text-purple-600" />
                                <h3 className="text-sm font-semibold text-purple-800 uppercase tracking-wide">This Year Outlook</h3>
                              </div>
                              <div className="text-purple-700 leading-relaxed space-y-2">
                                {insight.outlookYear.split('\n').filter(line => line.trim()).map((line, idx) => {
                                  if (line.includes('**') && line.includes(':**')) {
                                    const parts = line.split(':**');
                                    const heading = parts[0].replace(/\*\*/g, '');
                                    const content = parts[1]?.trim();
                                    return (
                                      <div key={idx} className="mb-2">
                                        <span className="font-semibold text-purple-900 text-xs uppercase tracking-wide">{heading}:</span>
                                        <span className="ml-2 text-purple-700">{content}</span>
                                      </div>
                                    );
                                  }
                                  return <p key={idx} className="text-sm">{line}</p>;
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Generated timestamp */}
                        {(insightsData?.generatedAt || generateInsightsMutation.data?.generatedAt) && (
                          <div className="text-center pt-4 border-t border-gray-200">
                            <div className="text-xs text-gray-500 flex items-center justify-center space-x-1">
                              <Sparkles className="h-3 w-3" />
                              <span>Generated: {new Date(insightsData?.generatedAt || generateInsightsMutation.data?.generatedAt).toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </DialogContent>
            </Dialog>

            {/* SQL Explanation Dialog */}
            <Dialog open={sqlDialogOpen} onOpenChange={setSqlDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <div className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex-shrink-0">
                      <Database className="h-5 w-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-lg font-bold block">How This Metric is Calculated</span>
                      <p className="text-sm text-gray-600 font-normal truncate">{selectedMetricForSQL?.name || 'Metric'}</p>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  {/* Plain English Explanation */}
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                    <h3 className="text-sm font-semibold text-emerald-800 mb-2">What This Metric Does</h3>
                    <p className="text-emerald-700 leading-relaxed break-words">
                      {selectedMetricForSQL ? generateSQLExplanation(selectedMetricForSQL.sqlQuery, selectedMetricForSQL.name) : "Loading..."}
                    </p>
                  </div>

                  {/* Data Sources */}
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <h3 className="text-sm font-semibold text-green-800 mb-2">Data Sources</h3>
                    <div className="text-green-700 space-y-1">
                      {selectedMetricForSQL?.sqlQuery?.toLowerCase().includes('hubspot') && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm">HubSpot CRM</span>
                        </div>
                      )}
                      {selectedMetricForSQL?.sqlQuery?.toLowerCase().includes('salesforce') && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm">Salesforce CRM</span>
                        </div>
                      )}
                      {!selectedMetricForSQL?.sqlQuery?.toLowerCase().includes('hubspot') && 
                       !selectedMetricForSQL?.sqlQuery?.toLowerCase().includes('salesforce') && (
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm">Analytics Database</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Technical Details (Collapsible) */}
                  {selectedMetricForSQL?.sqlQuery && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-800 mb-2">SQL Query</h3>
                      <div className="bg-white rounded border overflow-hidden">
                        <pre className="text-xs text-gray-600 p-3 overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
                          {selectedMetricForSQL.sqlQuery}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            
            {/* Compact Legend */}
            <Card className="border-gray-200 mt-3">
              <CardContent className="p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-xs text-gray-600">≥{greenThreshold}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-xs text-gray-600">{yellowThreshold}%-{greenThreshold-1}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-xs text-gray-600">&lt;{yellowThreshold}%</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    <Settings className="h-3 w-3 inline mr-1" />Customize
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}