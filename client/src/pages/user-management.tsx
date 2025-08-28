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
  firstName?: string;
  lastName?: string;
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
    firstName: "",
    lastName: "",
    email: "",
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
      firstName: string;
      lastName: string;
      email: string; 
      companyId: number; 
      role: string;
      sendInvitation?: boolean;
    }) => {
      return await apiRequest("/api/users/invite", "POST", userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateForm(false);
      setNewUser({ firstName: "", lastName: "", email: "", companyId: "", role: "user" });
      toast({
        title: "Invitation Sent",
        description: "User invitation has been sent successfully. They will receive an email to set up their account.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send user invitation",
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
    if (!newUser.firstName.trim() || !newUser.lastName.trim() || !newUser.email.trim() || !newUser.companyId) {
      toast({
        title: "Error",
        description: "First name, last name, email, and company are required",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate({
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      email: newUser.email,
      companyId: parseInt(newUser.companyId),
      role: newUser.role,
      sendInvitation: true,
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
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-green-600" />
              <span>Invite New User</span>
            </CardTitle>
            <CardDescription>Send an invitation email to a new user with account setup instructions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Enter last name"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
                <p className="text-xs text-gray-500 mt-1">
                  An invitation email will be sent to this address with account setup instructions.
                </p>
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
              <div className="md:col-span-2">
                <Label htmlFor="role">User Role</Label>
                <Select 
                  value={newUser.role} 
                  onValueChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex flex-col items-start py-1">
                        <div className="font-medium">Admin</div>
                        <div className="text-xs text-gray-500">Full access: manage users, create reports, configure data sources</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="user">
                      <div className="flex flex-col items-start py-1">
                        <div className="font-medium">User</div>
                        <div className="text-xs text-gray-500">Standard access: create reports, view metrics, use AI assistant</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="viewer">
                      <div className="flex flex-col items-start py-1">
                        <div className="font-medium">Viewer</div>
                        <div className="text-xs text-gray-500">Read-only access: view existing reports and dashboards only</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Role Explanation */}
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border">
                  <div className="text-sm font-medium text-gray-700 mb-2">Role Permissions:</div>
                  {newUser.role === "admin" && (
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Manage users and company settings</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Configure data sources and connectors</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Create and manage metric definitions</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Full access to all reports and dashboards</span>
                      </div>
                    </div>
                  )}
                  {newUser.role === "user" && (
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Create and share metric reports</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Use AI assistant for metric insights</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>View and analyze business metrics</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span>Cannot manage users or system settings</span>
                      </div>
                    </div>
                  )}
                  {newUser.role === "viewer" && (
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        <span>View existing reports and dashboards</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                        <span>Access shared metric reports</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span>Cannot create or edit reports</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                        <span>Cannot access admin or user management features</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
              >
                <Mail className="h-4 w-4 mr-2" />
                {createUserMutation.isPending ? "Sending Invitation..." : "Send Invitation"}
              </Button>
              <Button 
                onClick={() => {
                  setShowCreateForm(false);
                  setNewUser({ firstName: "", lastName: "", email: "", companyId: "", role: "user" });
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
                  {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username}
                </CardTitle>
                <CardDescription>
                  {user.email && (
                    <div className="flex items-center gap-1 text-sm">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </div>
                  )}
                  <div className="text-xs mt-1">
                    Role: {user.role} • ID: {user.id}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="h-4 w-4" />
                    <span>{userCompany?.name || "Unknown Company"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'admin' ? 'bg-red-100 text-red-800' :
                        user.role === 'user' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.status === 'active' ? 'bg-green-100 text-green-800' :
                        user.status === 'invited' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.status || 'active'}
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => impersonateUserMutation.mutate(user.id)}
                      disabled={impersonateUserMutation.isPending}
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Impersonate
                    </Button>
                  </div>
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