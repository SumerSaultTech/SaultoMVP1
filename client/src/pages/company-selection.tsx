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
import { Building2, Plus, Trash2, UserPlus, Shield, Eye, EyeOff } from "lucide-react";
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

  // System Admin creation state
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    email: "",
    temporaryPassword: false
  });

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

  const createAdminMutation = useMutation({
    mutationFn: async (adminData: typeof newAdmin) => {
      return await apiRequest("/api/admin/users/create-admin", "POST", adminData);
    },
    onSuccess: () => {
      setShowAdminForm(false);
      setNewAdmin({
        username: "",
        password: "",
        firstName: "",
        lastName: "",
        email: "",
        temporaryPassword: false
      });
      toast({
        title: "Success",
        description: "System administrator created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create system administrator",
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

  const validateAdminForm = () => {
    if (!newAdmin.username.trim()) {
      toast({
        title: "Error",
        description: "Username is required",
        variant: "destructive",
      });
      return false;
    }

    if (!newAdmin.password.trim()) {
      toast({
        title: "Error",
        description: "Password is required",
        variant: "destructive",
      });
      return false;
    }

    if (newAdmin.password.length < 12) {
      toast({
        title: "Error",
        description: "Password must be at least 12 characters long",
        variant: "destructive",
      });
      return false;
    }

    if (!newAdmin.firstName.trim() || !newAdmin.lastName.trim()) {
      toast({
        title: "Error",
        description: "First name and last name are required",
        variant: "destructive",
      });
      return false;
    }

    if (!newAdmin.email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleCreateAdmin = () => {
    if (!validateAdminForm()) {
      return;
    }

    createAdminMutation.mutate(newAdmin);
  };

  const resetAdminForm = () => {
    setNewAdmin({
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
      temporaryPassword: false
    });
    setShowAdminPassword(false);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 overflow-y-auto">
      <div className="max-w-4xl mx-auto pb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Select Your Company
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a company to access your metrics dashboard
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg mb-6">
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

        {/* Create New Company */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-dashed">
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

        {/* Create New System Administrator */}
        <Card className="mt-4 cursor-pointer hover:shadow-lg transition-shadow border-dashed border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-orange-600 text-lg">
              <Shield className="h-5 w-5" />
              Create System Administrator
            </CardTitle>
            <CardDescription className="text-sm">
              Create a new system-wide administrator with full access to all companies
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showAdminForm ? (
              <Button
                onClick={() => setShowAdminForm(true)}
                variant="outline"
                className="w-full border-orange-200 text-orange-600 hover:bg-orange-50"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add System Admin
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="adminUsername">Username</Label>
                    <Input
                      id="adminUsername"
                      value={newAdmin.username}
                      onChange={(e) => setNewAdmin(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adminPassword">Password</Label>
                    <div className="relative">
                      <Input
                        id="adminPassword"
                        type={showAdminPassword ? "text" : "password"}
                        value={newAdmin.password}
                        onChange={(e) => setNewAdmin(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Min 12 characters"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword(!showAdminPassword)}
                        className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600 focus:outline-none"
                        aria-label={showAdminPassword ? "Hide password" : "Show password"}
                      >
                        {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="adminFirstName">First Name</Label>
                    <Input
                      id="adminFirstName"
                      value={newAdmin.firstName}
                      onChange={(e) => setNewAdmin(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="adminLastName">Last Name</Label>
                    <Input
                      id="adminLastName"
                      value={newAdmin.lastName}
                      onChange={(e) => setNewAdmin(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Enter last name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="adminEmail">Email</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={newAdmin.email}
                      onChange={(e) => setNewAdmin(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Enter email address"
                    />
                  </div>
                </div>

                <div className="p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="text-xs font-medium text-orange-800 mb-1">System Admin Privileges:</div>
                  <div className="grid grid-cols-2 gap-1 text-xs text-orange-700">
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                      <span>All companies access</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                      <span>Manage administrators</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                      <span>System configuration</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                      <span>User impersonation</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateAdmin}
                    disabled={createAdminMutation.isPending}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowAdminForm(false);
                      resetAdminForm();
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