import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building2, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Company {
  id: number;
  name: string;
  slug: string;
  schemaName: string;
  isActive: boolean;
}

export default function CompanySelection() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      return await apiRequest("/api/companies", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setShowCreateForm(false);
      setNewCompanyName("");
      toast({
        title: "Success",
        description: "Company created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create company",
        variant: "destructive",
      });
    },
  });

  const selectCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest("/api/companies/select", "POST", { companyId });
    },
    onSuccess: (data, companyId) => {
      // Store the selected company in localStorage for persistence
      const company = companies?.find(c => c.id === companyId);
      if (company) {
        localStorage.setItem("selectedCompany", JSON.stringify(company));
      }
      
      toast({
        title: "Success",
        description: data.message || "Company selected successfully",
      });
      
      // Navigate to company-specific dashboard URL using unique company ID
      window.location.href = `/company/${companyId}`;
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to select company",
        variant: "destructive",
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest(`/api/companies/${companyId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      setDeleteConfirmation("");
      setCompanyToDelete(null);
      toast({
        title: "Success",
        description: "Company deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete company",
        variant: "destructive",
      });
    },
  });

  const selectCompany = (company: Company) => {
    selectCompanyMutation.mutate(company.id);
  };

  const handleDeleteClick = (company: Company) => {
    setCompanyToDelete(company);
    setDeleteConfirmation("");
  };

  const confirmDelete = () => {
    if (companyToDelete && deleteConfirmation === "DELETE") {
      deleteCompanyMutation.mutate(companyToDelete.id);
    }
  };

  const cancelDelete = () => {
    setCompanyToDelete(null);
    setDeleteConfirmation("");
  };

  const handleCreateCompany = () => {
    if (!newCompanyName.trim()) {
      toast({
        title: "Error",
        description: "Company name is required",
        variant: "destructive",
      });
      return;
    }

    const slug = newCompanyName.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

    createCompanyMutation.mutate({
      name: newCompanyName,
      slug,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Select Your Company
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a company to access your metrics dashboard
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="space-y-2 p-4">
            {companies?.map((company) => (
              <Card key={company.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {company.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Schema: {company.schemaName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={() => selectCompany(company)}
                        size="sm"
                        disabled={!company.isActive}
                      >
                        {company.isActive ? "Select" : "Inactive"}
                      </Button>
                      <AlertDialog open={companyToDelete?.id === company.id} onOpenChange={(open) => !open && cancelDelete()}>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteClick(company)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Company</AlertDialogTitle>
                            <AlertDialogDescription asChild>
                              <div className="space-y-3">
                                <div>
                                  Are you sure you want to delete "{company.name}"? This action cannot be undone and will permanently remove:
                                </div>
                                <ul className="list-disc list-inside text-sm space-y-1 text-gray-600">
                                  <li>All company data and metrics</li>
                                  <li>Analytics schemas and historical data</li>
                                  <li>User access and configurations</li>
                                  <li>Connected data sources</li>
                                </ul>
                                <div className="mt-4">
                                  <Label htmlFor="deleteConfirm" className="text-sm font-medium">
                                    Type "DELETE" to confirm:
                                  </Label>
                                  <Input
                                    id="deleteConfirm"
                                    value={deleteConfirmation}
                                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                                    placeholder="DELETE"
                                    className="mt-2"
                                  />
                                </div>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={confirmDelete}
                              disabled={deleteConfirmation !== "DELETE" || deleteCompanyMutation.isPending}
                              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300"
                            >
                              {deleteCompanyMutation.isPending ? "Deleting..." : "Delete Company"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="mt-6 cursor-pointer hover:shadow-lg transition-shadow border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-500">
              <Plus className="h-5 w-5" />
              Create New Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showCreateForm ? (
              <Button 
                onClick={() => setShowCreateForm(true)}
                variant="outline"
                className="w-full"
              >
                Add Company
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCreateCompany}
                    disabled={createCompanyMutation.isPending}
                    size="sm"
                  >
                    {createCompanyMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewCompanyName("");
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}