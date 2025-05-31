import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bot, Send, Sparkles, TrendingUp, Calculator, Lightbulb } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
      toast({
        title: "Chat Error",
        description: "Failed to get response from AI assistant. Please try again.",
        variant: "destructive"
      });
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
        content: `Here are some key metrics I recommend for your ${suggestions.length > 0 ? 'business' : 'SaaS business'}:\n\n${suggestions.map((s, i) => 
          `**${i + 1}. ${s.name}**\n${s.description}\n*Category: ${s.category} | Format: ${s.format}*\n`
        ).join('\n')}Click on any metric below to learn more or create it!`,
        timestamp: new Date()
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
    <Card className="h-[600px] flex flex-col">
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
      
      <CardContent className="flex-1 flex flex-col gap-4 p-4">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
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

        <Separator />

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
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