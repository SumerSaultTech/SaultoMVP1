import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Company {
  id: number;
  name: string;
  slug: string;
  snowflakeDatabase: string;
  isActive: boolean;
}

export default function CompanySelection() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: { name: string; slug: string; snowflakeDatabase: string }) => {
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

  const selectCompany = (company: Company) => {
    // Store the selected company in localStorage for now
    localStorage.setItem("selectedCompany", JSON.stringify(company));
    // Navigate to dashboard
    window.location.href = "/";
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
    const snowflakeDatabase = `${slug}_db`;

    createCompanyMutation.mutate({
      name: newCompanyName,
      slug,
      snowflakeDatabase,
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies?.map((company) => (
            <Card key={company.id} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {company.name}
                </CardTitle>
                <CardDescription>
                  Database: {company.snowflakeDatabase}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => selectCompany(company)}
                  className="w-full"
                  disabled={!company.isActive}
                >
                  {company.isActive ? "Select Company" : "Inactive"}
                </Button>
              </CardContent>
            </Card>
          ))}

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
        </div>
      </div>
    </div>
  );
}