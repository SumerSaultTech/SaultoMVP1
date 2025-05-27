import { useState, useRef, useEffect } from "react";
import { X, Send, User, Bot, Copy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface KPIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: number;
  content: string;
  role: "user" | "assistant";
  sqlGenerated?: string;
  createdAt: string;
}

export default function KPIAssistant({ isOpen, onClose }: KPIAssistantProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
    enabled: isOpen,
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/ai/chat", { message });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      setIsTyping(false);
    },
    onError: (error) => {
      console.error("Chat error:", error);
      setIsTyping(false);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const generateSQLMutation = useMutation({
    mutationFn: async (request: string) => {
      const response = await apiRequest("POST", "/api/ai/generate-sql", { request });
      return response.json();
    },
    onSuccess: (data) => {
      // Create a message with the generated SQL
      const sqlMessage = `Here's the SQL for your request:\n\n\`\`\`sql\n${data.sql}\n\`\`\`\n\n${data.explanation}`;
      chatMutation.mutate(sqlMessage);
    },
    onError: (error) => {
      console.error("SQL generation error:", error);
      toast({
        title: "Error",
        description: "Failed to generate SQL. Please try again.",
        variant: "destructive",
      });
    },
  });

  const executeSQL = async (sql: string) => {
    try {
      const response = await apiRequest("POST", "/api/sql/execute", { sql });
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Success",
          description: "SQL executed successfully!",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to execute SQL",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to execute SQL",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "SQL copied to clipboard",
    });
  };

  const handleSend = () => {
    if (!message.trim()) return;

    setIsTyping(true);
    chatMutation.mutate(message);
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    "Create a customer acquisition cost (CAC) metric",
    "Show me monthly recurring revenue by customer segment",
    "Calculate Net Promoter Score from survey data",
    "Generate a churn rate analysis query",
    "Create a customer lifetime value calculation",
  ];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const extractSQLFromMessage = (content: string): string | null => {
    const sqlMatch = content.match(/```sql\n([\s\S]*?)\n```/);
    return sqlMatch ? sqlMatch[1].trim() : null;
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 flex flex-col z-50">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">KPI Assistant</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Ask me to suggest KPIs or generate SQL metrics
        </p>
      </div>

      {/* Chat Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <>
              {/* Welcome Message */}
              <div className="flex space-x-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-sm text-slate-800">
                      Hi! I can help you create custom KPIs for your business. Based on your data sources, 
                      I can suggest metrics and generate SQL queries. What would you like to measure?
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">AI Assistant • Just now</div>
                </div>
              </div>

              {/* Suggested Prompts */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Suggested prompts:
                </p>
                {suggestedPrompts.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => setMessage(prompt)}
                    className="w-full text-left p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm text-slate-800">{prompt}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex space-x-3", msg.role === "user" && "justify-end")}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
              )}
              
              <div className={cn("flex-1", msg.role === "user" && "text-right")}>
                <div
                  className={cn(
                    "chat-message rounded-lg p-3",
                    msg.role === "user" 
                      ? "chat-message-user inline-block" 
                      : "chat-message-assistant"
                  )}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {msg.content.split(/```sql\n([\s\S]*?)\n```/).map((part, index) => {
                      if (index % 2 === 1) {
                        // This is SQL code
                        return (
                          <div key={index} className="my-2">
                            <div className="code-block">
                              <code>{part}</code>
                            </div>
                            <div className="flex items-center space-x-2 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => executeSQL(part)}
                                className="text-xs"
                              >
                                <Play className="w-3 h-3 mr-1" />
                                Apply to Snowflake
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyToClipboard(part)}
                                className="text-xs"
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                Copy SQL
                              </Button>
                            </div>
                          </div>
                        );
                      }
                      return <span key={index}>{part}</span>;
                    })}
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {msg.role === "user" ? "You" : "AI Assistant"} • {new Date(msg.createdAt).toLocaleTimeString()}
                </div>
              </div>

              {msg.role === "user" && (
                <div className="w-8 h-8 bg-slate-300 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>
                </div>
                <div className="text-xs text-slate-500 mt-1">AI Assistant is typing...</div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Chat Input */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center space-x-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about KPIs or metrics..."
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!message.trim() || chatMutation.isPending}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
