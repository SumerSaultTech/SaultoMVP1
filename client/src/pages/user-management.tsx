import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Building2, UserCheck, Mail } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface User {
  id: number;
  username: string;
  email?: string;
  companyId: number;
  role: string;
  status: string;
  invitedAt?: string;
  companyName?: string;
}

interface Company {
  id: number;
  name: string;
  slug: string;
  snowflakeDatabase: string;
  isActive: boolean;
}

export default function UserManagement() {
  const { toast } = useToast();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    email: "",
    password: "",
    companyId: "",
    role: "user"
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: companies, isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (userData: { 
      username: string; 
      email: string; 
      password: string; 
      companyId: number; 
      role: string; 
    }) => {
      return await apiRequest("/api/users", "POST", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateForm(false);
      setNewUser({ username: "", email: "", password: "", companyId: "", role: "user" });
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const impersonateUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest("/api/admin/impersonate", "POST", { userId });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Now impersonating user. Redirecting...",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to impersonate user",
        variant: "destructive",
      });
    },
  });



  const handleCreateUser = () => {
    if (!newUser.username.trim() || !newUser.email.trim() || !newUser.password.trim() || !newUser.companyId) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate({
      username: newUser.username,
      email: newUser.email,
      password: newUser.password,
      companyId: parseInt(newUser.companyId),
      role: newUser.role,
    });
  };

  if (usersLoading || companiesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading user management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage users and their company assignments
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
            <CardDescription>Add a new user and assign them to a company</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter username"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Enter password"
                />
              </div>
              <div>
                <Label htmlFor="company">Company</Label>
                <Select 
                  value={newUser.companyId} 
                  onValueChange={(value) => setNewUser(prev => ({ ...prev, companyId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id.toString()}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
              <Button 
                onClick={() => {
                  setShowCreateForm(false);
                  setNewUser({ username: "", email: "", password: "", companyId: "", role: "user" });
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users?.map((user) => {
          const userCompany = companies?.find(c => c.id === user.companyId);
          return (
            <Card key={user.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {user.username}
                </CardTitle>
                <CardDescription>
                  Role: {user.role} • ID: {user.id}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Building2 className="h-4 w-4" />
                  <span>{userCompany?.name || "Unknown Company"}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.role === 'admin' ? 'bg-red-100 text-red-800' :
                    user.role === 'user' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {user.role}
                  </span>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => impersonateUserMutation.mutate(user.id)}
                    disabled={impersonateUserMutation.isPending}
                    className="ml-2"
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Impersonate
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {(!users || users.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first user.</p>
              <Button onClick={() => setShowCreateForm(true)}>
                Create User
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}