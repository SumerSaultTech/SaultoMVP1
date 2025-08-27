import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Plus, FileText, Edit, Trash2, Share2, Calendar, User, Eye, ExternalLink, BarChart3, Mail, Copy, Link } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { MetricReport, KpiMetric } from "@/../../shared/schema";

interface ReportFormData {
  title: string;
  description: string;
  selectedMetrics: number[];
  customGroupings: { [key: string]: number[] };
  isPublic: boolean;
}

export default function MetricReports() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<MetricReport | null>(null);
  const [formData, setFormData] = useState<ReportFormData>({
    title: "",
    description: "",
    selectedMetrics: [],
    customGroupings: {},
    isPublic: false,
  });

  // Fetch metric reports
  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ["/api/metric-reports"],
  });

  // Fetch available metrics for selection
  const { data: metrics = [] } = useQuery({
    queryKey: ["/api/kpi-metrics"],
  });

  const createReportMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/metric-reports", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metric-reports"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Report Created",
        description: "New metric report has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create metric report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/metric-reports/${editingReport?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metric-reports"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Report Updated",
        description: "Metric report has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update metric report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/metric-reports/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metric-reports"] });
      toast({
        title: "Report Deleted",
        description: "Metric report has been removed successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete metric report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      selectedMetrics: [],
      customGroupings: {},
      isPublic: false,
    });
    setEditingReport(null);
  };

  const handleEdit = (report: MetricReport) => {
    setEditingReport(report);
    setFormData({
      title: report.title || "",
      description: report.description || "",
      selectedMetrics: Array.isArray(report.selectedMetrics) ? report.selectedMetrics : [],
      customGroupings: report.customGroupings || {},
      isPublic: report.isPublic || false,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || formData.selectedMetrics.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please provide a title and select at least one metric.",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...formData,
      reportConfig: {
        timePeriod: "monthly",
        includeInsights: true,
      },
    };

    if (editingReport) {
      updateReportMutation.mutate(submitData);
    } else {
      createReportMutation.mutate(submitData);
    }
  };

  const toggleMetricSelection = (metricId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedMetrics: prev.selectedMetrics.includes(metricId)
        ? prev.selectedMetrics.filter(id => id !== metricId)
        : [...prev.selectedMetrics, metricId]
    }));
  };

  const getShareUrl = (report: MetricReport) => {
    return `${window.location.origin}/reports/share/${report.shareToken}`;
  };

  const copyShareLink = (report: MetricReport) => {
    const url = getShareUrl(report);
    navigator.clipboard.writeText(url);
    toast({
      title: "Link Copied",
      description: "Share link has been copied to clipboard.",
    });
  };

  const shareReportViaEmail = (report: MetricReport) => {
    const reportUrl = getShareUrl(report);
    const subject = encodeURIComponent(`Business Metrics Report: ${report.title}`);
    const body = encodeURIComponent(`Hi there,

I wanted to share this business metrics report with you: ${report.title}

${report.description ? `Description: ${report.description}` : ''}

View the report here: ${reportUrl}

This report includes real-time business metrics with AI-powered insights and performance tracking.

Created on: ${new Date(report.createdAt).toLocaleDateString()}

Best regards`);

    const mailtoUrl = `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailtoUrl;
  };

  const copyReportSummary = (report: MetricReport) => {
    const summary = `Business Metrics Report: ${report.title}

${report.description ? `Description: ${report.description}` : ''}
Created: ${new Date(report.createdAt).toLocaleDateString()}
Metrics: ${Array.isArray(report.selectedMetrics) ? report.selectedMetrics.length : 0} selected metrics

View full report: ${getShareUrl(report)}`;

    navigator.clipboard.writeText(summary);
    toast({
      title: "Summary Copied",
      description: "Report summary has been copied to clipboard.",
    });
  };


  const viewReport = (report: MetricReport) => {
    console.log("=== VIEWING REPORT ===");
    console.log("Report to view:", report);
    console.log("Navigating to:", `/metric-reports/${report.id}/view`);
    setLocation(`/metric-reports/${report.id}/view`);
  };

  if (reportsLoading) {
    return (
      <>
        <Header 
          title="Metric Reports"
          subtitle="Create and manage business metric reports for QBRs and presentations"
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
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
        title="Metric Reports"
        subtitle="Create and manage business metric reports for QBRs and presentations"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Create Report
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>
                  {editingReport ? "Edit Report" : "Create New Metric Report"}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6 max-h-[calc(90vh-180px)] overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Report Title *</label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Q4 2024 Business Performance Report"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of what this report covers..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Select Metrics *</label>
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {metrics.map((metric: KpiMetric) => (
                          <label key={metric.id} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.selectedMetrics.includes(metric.id)}
                              onChange={() => toggleMetricSelection(metric.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm">{metric.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {metric.category}
                            </Badge>
                          </label>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formData.selectedMetrics.length} metrics selected
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="isPublic" className="text-sm font-medium cursor-pointer">
                      Make this report publicly shareable
                    </label>
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
                      disabled={createReportMutation.isPending || updateReportMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {editingReport ? 
                        (updateReportMutation.isPending ? "Updating..." : "Update Report") :
                        (createReportMutation.isPending ? "Creating..." : "Create Report")
                      }
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Business Metric Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No reports created yet</h3>
                <p className="text-gray-500 mb-4">
                  Create your first metric report to summarize business performance for stakeholders.
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Report
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Metrics Count</TableHead>
                      <TableHead>Visibility</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report: MetricReport) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{report.title}</div>
                            {report.description && (
                              <div className="text-sm text-gray-500 mt-1">
                                {report.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {Array.isArray(report.selectedMetrics) ? report.selectedMetrics.length : 0} metrics
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {report.isPublic ? (
                            <Badge variant="outline" className="text-green-600">
                              <Eye className="w-3 h-3 mr-1" />
                              Public
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              Private
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-500">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {new Date(report.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => viewReport(report)}
                              className="bg-blue-50 hover:bg-blue-100 border-blue-200"
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(report)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {report.isPublic && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    <Share2 className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => copyShareLink(report)}>
                                    <Link className="h-4 w-4 mr-2" />
                                    Copy Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => shareReportViaEmail(report)}>
                                    <Mail className="h-4 w-4 mr-2" />
                                    Share via Email
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => copyReportSummary(report)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy Summary
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteReportMutation.mutate(report.id)}
                              disabled={deleteReportMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}