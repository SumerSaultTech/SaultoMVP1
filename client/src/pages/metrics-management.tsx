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
import { Plus, Edit, Trash2, Target, TrendingUp, Users, DollarSign, BarChart3, Save, Bot } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { MetricsAssistant } from "@/components/assistant/metrics-assistant";
import type { KpiMetric } from "@/../../shared/schema";

interface MetricFormData {
  name: string;
  description: string;
  yearlyGoal: string;
  category: string;
  format: string;
  isIncreasing: boolean;
  priority: number;
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
  const [formData, setFormData] = useState<MetricFormData>({
    name: "",
    description: "",
    yearlyGoal: "",
    category: "revenue",
    format: "currency",
    isIncreasing: true,
    priority: 1,
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

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      yearlyGoal: "",
      category: "revenue",
      format: "currency",
      isIncreasing: true,
      priority: 1,
    });
    setEditingMetric(null);
  };

  const handleEdit = (metric: KpiMetric) => {
    setEditingMetric(metric);
    setFormData({
      name: metric.name || "",
      description: metric.description || "",
      yearlyGoal: metric.yearlyGoal || "",
      category: metric.category || "revenue",
      format: metric.format || "currency",
      isIncreasing: metric.isIncreasing ?? true,
      priority: metric.priority || 1,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.yearlyGoal) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...formData,
      priority: parseInt(formData.priority.toString()),
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto p-6">
          <Header 
            title="Metrics Management"
            subtitle="Configure your business metrics and yearly goals"
          />
          <Card className="mt-6">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6">
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
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingMetric ? "Edit Metric" : "Add New Metric"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                    <label className="text-sm font-medium">Description</label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this metric"
                      rows={2}
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Yearly Goal *</label>
                      <Input
                        value={formData.yearlyGoal}
                        onChange={(e) => setFormData({ ...formData, yearlyGoal: e.target.value })}
                        placeholder="e.g., $1,000,000"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Priority</label>
                      <Input
                        type="number"
                        min="1"
                        max="12"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                      />
                    </div>
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

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createMetricMutation.isPending || updateMetricMutation.isPending}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {editingMetric ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          }
        />

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mt-6">
          {/* Metrics Table - Takes up 3/5 of the width */}
          <div className="xl:col-span-3">
            <Card className="h-[calc(100vh-200px)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Business Metrics Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)] overflow-auto">
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
                          <TableHead>Priority</TableHead>
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
                          .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
                          .map((metric: any) => {
                            const categoryInfo = getCategoryInfo(metric.category);
                            return (
                              <TableRow key={metric.id}>
                                <TableCell className="font-medium">
                                  {metric.priority || 1}
                                </TableCell>
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
                                  {getFormatLabel(metric.format)}
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

          {/* AI Assistant - Takes up 2/5 of the width */}
          <div className="xl:col-span-2">
            <Card className="h-[calc(100vh-200px)]">
              <CardContent className="p-0 h-full">
                <MetricsAssistant 
                  onMetricCreate={(metric) => {
                    setFormData({
                      name: metric.name,
                      description: metric.description,
                      yearlyGoal: metric.yearlyGoal || "",
                      category: metric.category,
                      format: metric.format,
                      isIncreasing: true,
                      priority: 1
                    });
                    setIsDialogOpen(true);
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}