import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bot, Send, Sparkles, TrendingUp, Calculator, Lightbulb, Plus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: MetricSuggestion[];
}

interface MetricSuggestion {
  name: string;
  description: string;
  category: string;
  format: string;
  yearlyGoal?: string;
  rationale: string;
  sqlQuery?: string;
}

interface MetricsAssistantProps {
  onMetricCreate?: (metric: MetricSuggestion) => void;
}

export function MetricsAssistant({ onMetricCreate }: MetricsAssistantProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your AI metrics assistant. I can help you define business metrics, suggest KPIs for your industry, and create SQL queries to calculate them. What would you like to work on?",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch("/api/metrics/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      if (!response.ok) throw new Error("Failed to get AI response");
      return response.json();
    },
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: data.response,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      console.error("Chat error:", error);
      
      // Provide helpful fallback responses when AI is unavailable
      const fallbackMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant", 
        content: "I'm currently unable to connect to my AI service. However, I can still help you with metric guidance:\n\n**Common Business Metrics:**\n• Monthly Recurring Revenue (MRR)\n• Customer Acquisition Cost (CAC)\n• Customer Lifetime Value (CLV)\n• Churn Rate\n• Net Promoter Score (NPS)\n• Gross Revenue Retention\n\nUse the 'Add Metric' button above to create any of these manually. What type of business metric would you like to track?",
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, fallbackMessage]);
      setIsTyping(false);
    }
  });

  const defineMetricMutation = useMutation({
    mutationFn: async ({ metricName, businessContext }: { metricName: string; businessContext?: string }) => {
      const response = await fetch("/api/metrics/ai/define", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricName, businessContext })
      });
      if (!response.ok) throw new Error("Failed to define metric");
      return response.json();
    },
    onSuccess: (data) => {
      const suggestion: MetricSuggestion = data;
      
      // Add a message showing the defined metric
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `I've defined the metric "${suggestion.name}" for you:\n\n**Description:** ${suggestion.description}\n\n**Category:** ${suggestion.category}\n**Format:** ${suggestion.format}\n**Yearly Goal:** ${suggestion.yearlyGoal || 'Not specified'}\n\n**Why this matters:** ${suggestion.rationale}\n\nWould you like me to create this metric for you?`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
      
      // Offer to create the metric
      if (onMetricCreate) {
        toast({
          title: "Metric Defined",
          description: "Click 'Create Metric' to add this to your dashboard.",
          action: (
            <Button
              size="sm"
              onClick={() => onMetricCreate(suggestion)}
            >
              Create Metric
            </Button>
          )
        });
      }
    },
    onError: (error) => {
      console.error("Define metric error:", error);
      toast({
        title: "Definition Error",
        description: "Failed to define metric. Please try again.",
        variant: "destructive"
      });
      setIsTyping(false);
    }
  });

  const suggestMetricsMutation = useMutation({
    mutationFn: async (businessType: string) => {
      const response = await fetch("/api/metrics/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType })
      });
      if (!response.ok) throw new Error("Failed to get suggestions");
      return response.json();
    },
    onSuccess: (suggestions: MetricSuggestion[]) => {
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Here are some key metrics I recommend for your business:`,
        timestamp: new Date(),
        suggestions: suggestions
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    },
    onError: (error) => {
      console.error("Suggest metrics error:", error);
      toast({
        title: "Suggestion Error",
        description: "Failed to get metric suggestions. Please try again.",
        variant: "destructive"
      });
      setIsTyping(false);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // Check for specific commands
    const message = inputMessage.toLowerCase();
    if (message.includes("define") && (message.includes("metric") || message.includes("kpi"))) {
      // Extract metric name from the message
      const metricName = inputMessage.replace(/define|metric|kpi/gi, "").trim();
      if (metricName) {
        defineMetricMutation.mutate({ metricName });
        return;
      }
    }

    if (message.includes("suggest") && (message.includes("metric") || message.includes("kpi"))) {
      // Extract business type if mentioned
      const businessType = message.includes("ecommerce") ? "ecommerce" : 
                          message.includes("saas") ? "saas" :
                          message.includes("retail") ? "retail" : "saas";
      suggestMetricsMutation.mutate(businessType);
      return;
    }

    // Default to general chat
    chatMutation.mutate(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickActions = [
    {
      label: "Suggest Metrics",
      icon: Lightbulb,
      action: () => {
        setInputMessage("Suggest key metrics for my SaaS business");
        setTimeout(handleSendMessage, 100);
      }
    },
    {
      label: "Define Revenue Metric",
      icon: TrendingUp,
      action: () => {
        setInputMessage("Define Monthly Recurring Revenue metric");
        setTimeout(handleSendMessage, 100);
      }
    },
    {
      label: "Calculate Metric",
      icon: Calculator,
      action: () => {
        setInputMessage("How do I calculate customer lifetime value?");
        setTimeout(handleSendMessage, 100);
      }
    }
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          AI Metrics Assistant
          <Badge variant="secondary" className="ml-auto">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-3 p-4 min-h-0">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 flex-shrink-0">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={action.action}
              className="text-xs"
              disabled={isTyping || chatMutation.isPending}
            >
              <action.icon className="w-3 h-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>

        <Separator className="flex-shrink-0" />

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-3 pr-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  
                  {/* Render metric suggestions as clickable buttons */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.suggestions.map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-left h-auto p-3 min-h-0"
                          onClick={() => onMetricCreate?.(suggestion)}
                        >
                          <div className="flex items-start gap-2 w-full min-w-0">
                            <Plus className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{suggestion.name}</div>
                              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">
                                {suggestion.description}
                              </div>
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {suggestion.category}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {suggestion.format}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about metrics, KPIs, or business analytics..."
            disabled={isTyping || chatMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isTyping || chatMutation.isPending}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}