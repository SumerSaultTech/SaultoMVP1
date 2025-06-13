import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: number;
  companyId: number;
  userId: number;
  message: string;
  response?: string;
  timestamp: string;
}

export default function SaultoChat() {
  const [message, setMessage] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chatMessages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat-messages"],
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const response = await fetch("/api/ai-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat-messages"] });
      setMessage("");
      toast({
        title: "Message sent",
        description: "AI assistant is processing your request",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="flex-1 flex flex-col p-4 bg-gray-50 h-screen">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="w-8 h-8 text-blue-600" />
          SaultoChat
        </h1>
        <p className="text-gray-600 mt-1">
          Chat with your AI assistant for business insights, data analysis, and KPI recommendations
        </p>
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        <Card className="flex-1 flex flex-col h-[calc(100vh-140px)]">
          <CardHeader className="border-b flex-shrink-0">
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              Internal AI Chat
            </CardTitle>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <ScrollArea className="flex-1 p-4 h-full">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Loading chat history...</div>
                </div>
              ) : chatMessages && chatMessages.length > 0 ? (
                <div className="space-y-4">
                  {chatMessages.map((chat) => (
                    <div key={chat.id} className="space-y-3">
                      {/* User Message */}
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-100 rounded-lg p-3">
                            <p className="text-gray-900">{chat.message}</p>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTimestamp(chat.timestamp)}
                          </p>
                        </div>
                      </div>

                      {/* AI Response */}
                      {chat.response && (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                              <p className="text-gray-900 whitespace-pre-wrap">{chat.response}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bot className="w-12 h-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Start a conversation
                  </h3>
                  <p className="text-gray-500 max-w-md">
                    Chat with our AI assistant about anything - from business questions to general topics, 
                    coding help, creative writing, or casual conversation.
                  </p>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
                    <div className="bg-gray-50 rounded-lg p-3 text-left">
                      <p className="text-sm font-medium text-gray-900">Business & Analytics:</p>
                      <ul className="text-sm text-gray-600 mt-1 space-y-1">
                        <li>• "Analyze our quarterly performance"</li>
                        <li>• "What are the key market trends?"</li>
                        <li>• "Help create a financial forecast"</li>
                      </ul>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-left">
                      <p className="text-sm font-medium text-gray-900">General Topics:</p>
                      <ul className="text-sm text-gray-600 mt-1 space-y-1">
                        <li>• "Explain a technical concept"</li>
                        <li>• "Help with creative writing"</li>
                        <li>• "Answer general questions"</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t p-4 flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask me anything - business questions, general topics, coding help, or just chat..."
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                />
                <Button 
                  type="submit" 
                  disabled={!message.trim() || sendMessageMutation.isPending}
                  className="px-4"
                >
                  {sendMessageMutation.isPending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}