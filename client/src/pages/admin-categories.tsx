import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Settings
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MetricCategory {
  id: number;
  companyId: number;
  name: string;
  value: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}


const AVAILABLE_COLORS = [
  { value: "bg-green-100 text-green-800", label: "Green", preview: "bg-green-100" },
  { value: "bg-blue-100 text-blue-800", label: "Blue", preview: "bg-blue-100" },
  { value: "bg-purple-100 text-purple-800", label: "Purple", preview: "bg-purple-100" },
  { value: "bg-orange-100 text-orange-800", label: "Orange", preview: "bg-orange-100" },
  { value: "bg-red-100 text-red-800", label: "Red", preview: "bg-red-100" },
  { value: "bg-yellow-100 text-yellow-800", label: "Yellow", preview: "bg-yellow-100" },
  { value: "bg-pink-100 text-pink-800", label: "Pink", preview: "bg-pink-100" },
  { value: "bg-indigo-100 text-indigo-800", label: "Indigo", preview: "bg-indigo-100" },
  { value: "bg-gray-100 text-gray-800", label: "Gray", preview: "bg-gray-100" },
];

export default function AdminCategories() {
  const { toast } = useToast();
  const [editingCategory, setEditingCategory] = useState<MetricCategory | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    value: "",
    color: "bg-blue-100 text-blue-800",
  });

  const { data: categories, isLoading } = useQuery<MetricCategory[]>({
    queryKey: ["/api/admin/metric-categories"],
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData: typeof formData) => {
      return await apiRequest("/api/admin/metric-categories", "POST", categoryData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/metric-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metric-categories"] });
      setShowCreateForm(false);
      resetForm();
      toast({
        title: "Category Created",
        description: "New metric category has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      return await apiRequest(`/api/admin/metric-categories/${id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/metric-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metric-categories"] });
      setEditingCategory(null);
      resetForm();
      toast({
        title: "Category Updated",
        description: "Metric category has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log("🗑️ DELETE mutation starting for ID:", id);
      try {
        // Force cache-busting by adding timestamp
        const url = `/api/admin/metric-categories/${id}?t=${Date.now()}`;
        const result = await fetch(url, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        console.log("🗑️ Raw fetch response:", result);

        if (!result.ok) {
          throw new Error(`HTTP ${result.status}: ${result.statusText}`);
        }

        const data = await result.json();
        console.log("🗑️ DELETE mutation result:", data);
        return data;
      } catch (error) {
        console.error("🗑️ DELETE mutation error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("🗑️ DELETE mutation onSuccess triggered");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/metric-categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metric-categories"] });
      toast({
        title: "Category Deleted",
        description: "Metric category has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      console.error("🗑️ DELETE mutation onError triggered:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      value: "",
      color: "bg-blue-100 text-blue-800",
    });
  };

  const handleEdit = (category: MetricCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      value: category.value,
      color: category.color,
    });
  };

  const handleSave = () => {
    if (!formData.name || !formData.value) {
      toast({
        title: "Error",
        description: "Name and value are required",
        variant: "destructive",
      });
      return;
    }

    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createCategoryMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    console.log("🗑️ handleDelete called with ID:", id);
    if (confirm("Are you sure you want to delete this category? This action cannot be undone.")) {
      console.log("🗑️ User confirmed deletion, calling mutate");
      deleteCategoryMutation.mutate(id);
    } else {
      console.log("🗑️ User cancelled deletion");
    }
  };

  const generateValueFromName = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  };


  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading metric categories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 pb-20">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Metric Categories
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Customize metric categories for your organization. Categories help organize and group your business metrics.
          </p>
        </div>
        {!showCreateForm && !editingCategory && (
          <Button
            onClick={() => {
              resetForm();
              setShowCreateForm(true);
            }}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingCategory) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-primary" />
              <span>{editingCategory ? "Edit Category" : "Create New Category"}</span>
            </CardTitle>
            <CardDescription>
              {editingCategory ? "Update the category details below" : "Add a new metric category for your organization"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Category Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      name,
                      value: generateValueFromName(name)
                    }));
                  }}
                  placeholder="e.g., Marketing, Finance, Operations"
                />
              </div>
              <div>
                <Label htmlFor="value">Value (slug) *</Label>
                <Input
                  id="value"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="e.g., marketing, finance, operations"
                />
              </div>
            </div>


            <div>
              <div>
                <Label htmlFor="color">Color Theme</Label>
                <Select value={formData.color} onValueChange={(value) => setFormData(prev => ({ ...prev, color: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.preview}`}></div>
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div>
              <Label>Preview</Label>
              <div className="flex items-center gap-2 mt-2">
                <Badge className={formData.color}>
                  {formData.name || "Category Name"}
                </Badge>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {editingCategory ? "Update Category" : "Create Category"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingCategory(null);
                  resetForm();
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories?.map((category) => {
          return (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {category.name}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(category)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(category.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Badge className={category.color}>
                      {category.value}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Value: {category.value}</span>
                    {category.isDefault && (
                      <Badge variant="secondary" className="text-xs">
                        Default
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {(!categories || categories.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="text-center py-8">
              <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first metric category.</p>
              <Button onClick={() => {
                resetForm();
                setShowCreateForm(true);
              }}>
                Create Category
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}