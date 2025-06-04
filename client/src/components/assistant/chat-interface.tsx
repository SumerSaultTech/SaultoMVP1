import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Lightbulb, Code, Bot, User } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ChatInterface() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chatMessages, isLoading } = useQuery({
    queryKey: ["/api/chat-messages"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) => 
      apiRequest("POST", "/api/chat-messages", { role: "user", content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat-messages"] });
      setMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Message Failed",
        description: error.message || "Failed to send message.",
        variant: "destructive",
      });
    },
  });

  const suggestKpisMutation = useMutation({
    mutationFn: () => 
      apiRequest("POST", "/api/assistant/suggest-kpis", { businessType: "saas" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat-messages"] });
    },
    onError: (error: any) => {
      toast({
        title: "Suggestion Failed",
        description: error.message || "Failed to get KPI suggestions.",
        variant: "destructive",
      });
    },
  });

  const generateSqlMutation = useMutation({
    mutationFn: (kpiDescription: string) => 
      apiRequest("POST", "/api/assistant/generate-sql", { 
        kpiDescription,
        tables: ["core_customer_metrics", "core_revenue_analytics"]
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat-messages"] });
    },
    onError: (error: any) => {
      toast({
        title: "SQL Generation Failed",
        description: error.message || "Failed to generate SQL.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderMessage = (msg: any) => {
    const isUser = msg.role === "user";
    
    return (
      <div key={msg.id} className={`flex items-start space-x-3 ${isUser ? "justify-end" : ""}`}>
        {!isUser && (
          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Bot className="h-4 w-4 text-white" />
          </div>
        )}
        
        <div className={`max-w-xs lg:max-w-md ${isUser ? "order-first" : ""}`}>
          <div className={`rounded-lg p-3 ${
            isUser 
              ? "bg-primary-500 text-white" 
              : "bg-white shadow-sm border"
          }`}>
            <p className="text-sm">{msg.content}</p>
            
            {msg.metadata?.suggestions && (
              <div className="mt-3 space-y-2">
                {msg.metadata.suggestions.map((suggestion: any, index: number) => (
                  <div key={index} className="bg-blue-50 border border-blue-200 rounded p-2">
                    <p className="text-xs font-medium text-blue-800">{suggestion.name}</p>
                    <p className="text-xs text-blue-600">{suggestion.description}</p>
                  </div>
                ))}
                <div className="flex space-x-2 mt-3">
                  <Button 
                    size="sm" 
                    className="text-xs"
                    onClick={() => toast({ title: "Applied", description: "KPIs have been implemented." })}
                  >
                    Apply KPIs
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs"
                    onClick={() => suggestKpisMutation.mutate()}
                  >
                    Suggest More
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {isUser && (
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-gray-600" />
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">KPI Assistant</h3>
            <p className="text-sm text-gray-500">AI-powered metrics suggestions and SQL generation</p>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-y-auto mb-4">
          <div className="space-y-4">
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full" />
                    <div className="flex-1">
                      <div className="h-16 bg-gray-200 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : chatMessages && chatMessages.length > 0 ? (
              chatMessages.map(renderMessage)
            ) : (
              <div className="text-center py-8">
                <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">Start a conversation with the KPI Assistant</p>
                <p className="text-sm text-gray-400">Ask for KPI suggestions, generate SQL queries, or get insights about your data.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat Input */}
        <div className="flex space-x-3">
          <div className="flex-1 relative">
            <Input
              placeholder="Ask for KPI suggestions, generate SQL, or get insights..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sendMessageMutation.isPending}
            />
            <Button 
              variant="ghost" 
              size="sm"
              className="absolute right-2 top-1/2 transform -translate-y-1/2"
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending}
            >
              <Layers className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => suggestKpisMutation.mutate()}
              disabled={suggestKpisMutation.isPending}
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              Suggest KPIs
            </Button>
            <Button 
              className="bg-accent-500 hover:bg-accent-600 text-white"
              size="sm"
              onClick={() => generateSqlMutation.mutate("Customer acquisition cost")}
              disabled={generateSqlMutation.isPending}
            >
              <Code className="mr-2 h-4 w-4" />
              Generate SQL
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
