import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Lock, User, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      if (data.success) {
        // Store authentication state
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("currentUser", credentials.username);
        
        // Store user and company data if available
        if (data.user) {
          localStorage.setItem("userData", JSON.stringify(data.user));
        }
        if (data.company) {
          localStorage.setItem("selectedCompany", JSON.stringify(data.company));
        } else {
          // For admin users or users without auto-assigned company, clear selectedCompany
          localStorage.removeItem("selectedCompany");
        }
        
        // Trigger a storage event to update the app immediately
        window.dispatchEvent(new Event('storage'));
        
        // Redirect to dashboard (App.tsx will handle routing to company selection if needed)
        setLocation("/");
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-saulto-50 to-green-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <img 
            src="/assets/logo.png" 
            alt="Saulto Logo" 
            className="w-64 h-32 object-contain mx-auto"
          />
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>
              Sign in to access Saulto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-100 border border-red-200 rounded-md">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>© 2025 Saulto by Sumersault</p>
        </div>
      </div>
    </div>
  );
}