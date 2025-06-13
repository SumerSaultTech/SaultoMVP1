import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, MessageCircle, Plus, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
  id: number;
  companyId: number;
  userId: number;
  message: string;
  response?: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messageCount: number;
}

export default function SaultoChat() {
  const [message, setMessage] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string>("current");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
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

  // Generate chat sessions from messages
  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      const currentSession: ChatSession = {
        id: "current",
        title: "Current Chat",
        lastMessage: chatMessages[chatMessages.length - 1]?.message || "New conversation",
        timestamp: chatMessages[chatMessages.length - 1]?.timestamp || new Date().toISOString(),
        messageCount: chatMessages.length
      };
      setChatSessions([currentSession]);
    }
  }, [chatMessages]);

  const createNewChat = () => {
    const newSessionId = `chat-${Date.now()}`;
    setCurrentSessionId(newSessionId);
    queryClient.setQueryData(["/api/chat-messages"], []);
    toast({
      title: "New chat started",
      description: "You can now start a new conversation",
    });
  };

  const switchToSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    // In a real implementation, this would load messages for the specific session
    queryClient.invalidateQueries({ queryKey: ["/api/chat-messages"] });
  };

  return (
    <div className="flex-1 flex bg-gray-50 min-h-0">
      {/* Chat History Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Chat History</h2>
          <Button 
            onClick={createNewChat}
            className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2">
            {chatSessions.length > 0 ? (
              chatSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => switchToSession(session.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors mb-2 ${
                    currentSessionId === session.id
                      ? "bg-blue-50 border border-blue-200"
                      : "hover:bg-gray-50 border border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-sm truncate">
                        {session.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {session.lastMessage}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 ml-2">
                      <Clock className="w-3 h-3" />
                      {session.messageCount}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {new Date(session.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 text-sm py-8">
                No chat history yet
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-4 min-h-0">
        <div className="mb-3">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            SaultoChat
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Chat with your AI assistant for business insights, data analysis, and KPI recommendations
          </p>
        </div>

        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full min-h-0">
          <Card className="flex-1 flex flex-col h-[580px] min-h-[480px] max-h-[700px]">
            <CardHeader className="border-b flex-shrink-0">
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                Internal AI Chat
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea ref={scrollAreaRef} className="h-full p-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Loading messages...</span>
                  </div>
                ) : chatMessages && chatMessages.length > 0 ? (
                  chatMessages.map((chat) => (
                    <div key={chat.id} className="space-y-4 mb-6">
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
                  ))
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
                  </div>
                )}
                <div ref={messagesEndRef} />
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
    </div>
  );
}