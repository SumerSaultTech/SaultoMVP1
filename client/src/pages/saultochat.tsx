import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
// Card components removed - using full page layout
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileUpload } from "@/components/ui/file-upload";
import { FileDisplay } from "@/components/ui/file-display";
import { Send, Bot, User, MessageCircle, Plus, Clock, Loader2, ChevronLeft, ChevronRight, History, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import 'highlight.js/styles/github.css';

interface ChatMessage {
  id: number;
  companyId: number;
  userId: number;
  message: string;
  response?: string;
  timestamp: string;
  streaming?: boolean;
  files?: string[];
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
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  // Store messages for each session separately
  const [sessionMessages, setSessionMessages] = useState<Record<string, ChatMessage[]>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chatMessages, isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat-messages"],
    refetchInterval: currentSessionId === "current" ? 5000 : false, // Only refetch for original session
    enabled: currentSessionId === "current", // Only enable query for original session
  });

  // Get messages for current session only
  const currentSessionMessages = currentSessionId === "current" 
    ? (chatMessages || [])  // Use database messages for original session
    : (sessionMessages[currentSessionId] || []); // Use stored messages for new sessions
  
  // Simple combination: show session messages + any active streaming message
  const allMessages = [...currentSessionMessages, ...localMessages];

  // File handling functions
  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const uploadedFiles: string[] = [];
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (response.ok) {
          const result = await response.json();
          uploadedFiles.push(result.filename);
        } else {
          throw new Error(`Failed to upload ${file.name}`);
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        toast({
          title: "Upload Error",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }
    
    return uploadedFiles;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && selectedFiles.length === 0) || isStreaming) return;

    const messageText = message.trim();
    const filesToUpload = [...selectedFiles];
    setMessage("");
    setSelectedFiles([]);
    setIsStreaming(true);

    // Upload files first if any
    let uploadedFileNames: string[] = [];
    if (filesToUpload.length > 0) {
      uploadedFileNames = await uploadFiles(filesToUpload);
      if (uploadedFileNames.length !== filesToUpload.length) {
        setIsStreaming(false);
        return; // Stop if not all files uploaded successfully
      }
    }

    // Create a temporary streaming message for visual effect only
    const tempStreamingMessage: ChatMessage = {
      id: Date.now(),
      companyId: 1748544793859,
      userId: 1,
      message: messageText,
      response: "",
      timestamp: new Date().toISOString(),
      streaming: true,
      files: filesToUpload.map(f => f.name) // Show original filenames during streaming
    };

    setLocalMessages([tempStreamingMessage]);
    let aiResponseText = ""; // Move this to higher scope

    try {
      // Try streaming first for visual effect
      const streamResponse = await fetch("/api/ai-assistant/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: messageText,
          files: uploadedFileNames 
        }),
      });

      if (streamResponse.ok) {
        const reader = streamResponse.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim().startsWith('data: ')) {
                try {
                  const jsonData = JSON.parse(line.slice(5));
                  
                  if (jsonData.content !== undefined) {
                    aiResponseText += jsonData.content;
                    
                    // Update streaming message
                    setLocalMessages([{
                      ...tempStreamingMessage,
                      response: aiResponseText
                    }]);
                  } else if (jsonData.done) {
                    // Streaming completed
                    setLocalMessages([{
                      ...tempStreamingMessage,
                      response: aiResponseText,
                      streaming: false
                    }]);
                  }
                } catch (parseError) {
                  console.warn("Failed to parse streaming data:", line);
                }
              }
            }
          }
        }

        // Now save to database using the original endpoint
        await fetch("/api/ai-assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message: messageText,
            files: uploadedFileNames 
          }),
        });
      }

      // Clear temp message and add the final message to current session
      setTimeout(() => {
        setLocalMessages([]);
        
        // For new sessions, we need to manually add the message since database won't have it
        if (currentSessionId !== "current") {
          const finalMessage: ChatMessage = {
            ...tempStreamingMessage,
            response: aiResponseText,
            streaming: false,
            files: uploadedFileNames // Use uploaded filenames for storage
          };
          
          setSessionMessages(prev => ({
            ...prev,
            [currentSessionId]: [...(prev[currentSessionId] || []), finalMessage]
          }));
          
          queryClient.setQueryData(["/api/chat-messages"], [...(sessionMessages[currentSessionId] || []), finalMessage]);
        } else {
          // For original session, refresh from database
          queryClient.invalidateQueries({ queryKey: ["/api/chat-messages"] });
        }
        
        // Auto-scroll after new message is added
        setTimeout(() => scrollToBottom(), 100);
      }, 500);

    } catch (error: any) {
      console.error("Error:", error);
      
      // Fallback to regular chat without streaming
      try {
        await fetch("/api/ai-assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message: messageText,
            files: uploadedFileNames 
          }),
        });
        
        setLocalMessages([]);
        
        // Handle session-specific message storage for fallback too
        if (currentSessionId !== "current") {
          queryClient.invalidateQueries({ queryKey: ["/api/chat-messages"] });
        } else {
          queryClient.invalidateQueries({ queryKey: ["/api/chat-messages"] });
        }
        
        setTimeout(() => scrollToBottom(), 100);
      } catch (fallbackError) {
        toast({
          title: "Error",
          description: "Failed to send message. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsStreaming(false);
    }
  };

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Only auto-scroll for database messages, not streaming messages
  useEffect(() => {
    if (!isStreaming && localMessages.length === 0) {
      scrollToBottom();
    }
  }, [chatMessages, isStreaming, localMessages.length]);

  // Initialize with a default session if no sessions exist
  useEffect(() => {
    if (chatSessions.length === 0 && (currentSessionId === "current" ? !isLoading : true)) {
      const defaultSession: ChatSession = {
        id: currentSessionId,
        title: "Chat Session",
        lastMessage: "Start typing to begin conversation...",
        timestamp: new Date().toISOString(),
        messageCount: 0
      };
      setChatSessions([defaultSession]);
    }
  }, [chatSessions.length, currentSessionId, isLoading]);

  // Update session messages when database messages change - but only for the original session
  useEffect(() => {
    if (chatMessages && chatMessages.length > 0 && currentSessionId === "current") {
      setSessionMessages(prev => ({
        ...prev,
        [currentSessionId]: chatMessages
      }));
    }
  }, [chatMessages, currentSessionId]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Generate chat sessions from messages
  useEffect(() => {
    if (allMessages && allMessages.length > 0) {
      const currentSession: ChatSession = {
        id: currentSessionId,
        title: allMessages.length === 1 ? 
          allMessages[0].message.slice(0, 30) + (allMessages[0].message.length > 30 ? "..." : "") : 
          "Chat Session",
        lastMessage: allMessages[allMessages.length - 1]?.message || "New conversation",
        timestamp: allMessages[allMessages.length - 1]?.timestamp || new Date().toISOString(),
        messageCount: allMessages.length
      };
      
      // Update existing session or add new one
      setChatSessions(prevSessions => {
        const existingIndex = prevSessions.findIndex(session => session.id === currentSessionId);
        if (existingIndex >= 0) {
          // Update existing session
          const updated = [...prevSessions];
          updated[existingIndex] = currentSession;
          return updated;
        } else {
          // Add new session to the beginning of the list
          return [currentSession, ...prevSessions];
        }
      });
    }
  }, [allMessages, currentSessionId]);

  const createNewChat = () => {
    const newSessionId = `chat-${Date.now()}`;
    
    // Create a new empty session and add it to the chat sessions
    const newSession: ChatSession = {
      id: newSessionId,
      title: "New Chat",
      lastMessage: "Start typing to begin conversation...",
      timestamp: new Date().toISOString(),
      messageCount: 0
    };
    
    setChatSessions(prevSessions => [newSession, ...prevSessions]);
    setCurrentSessionId(newSessionId);
    setLocalMessages([]);
    
    // Initialize empty messages for the new session
    setSessionMessages(prev => ({
      ...prev,
      [newSessionId]: []
    }));
    
    // Clear the database query cache so new messages start fresh
    queryClient.setQueryData(["/api/chat-messages"], []);
    
    toast({
      title: "New chat started",
      description: "You can now start a new conversation",
    });
  };

  const switchToSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setLocalMessages([]); // Clear any streaming messages
    
    // If switching to the original session, refresh from database
    if (sessionId === "current") {
      queryClient.invalidateQueries({ queryKey: ["/api/chat-messages"] });
    } else {
      // For new sessions, use the stored session messages
      const sessionMsgs = sessionMessages[sessionId] || [];
      queryClient.setQueryData(["/api/chat-messages"], sessionMsgs);
    }
  };

  const handleCopyMessage = async (messageId: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
      });
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy message to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex-1 flex bg-gray-50 min-h-0 max-h-screen overflow-hidden">
      {/* Chat History Sidebar */}
      <div 
        className={`border-r border-gray-200 bg-white flex flex-col transition-all duration-300 ${
          sidebarExpanded ? "w-80" : "w-16"
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {sidebarExpanded ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
              <Button
                onClick={() => setSidebarExpanded(false)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center w-full">
              <Button
                onClick={() => setSidebarExpanded(true)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 mb-2"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setSidebarExpanded(true)}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Chat History"
              >
                <History className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {sidebarExpanded && (
          <>
            {/* New Chat Button */}
            <div className="p-4 border-b border-gray-200">
              <Button 
                onClick={createNewChat}
                className="w-full flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </Button>
            </div>
            
            {/* Chat Sessions */}
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
          </>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-4 min-h-0 max-h-screen overflow-hidden">
        <div className="mb-3">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-blue-600" />
            SaultoChat
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Chat with your AI assistant for business insights, data analysis, and KPI recommendations
          </p>
        </div>

        <div className="flex-1 flex flex-col w-full min-h-0 max-h-full overflow-hidden">
          {/* Chat Header */}
          <div className="border-b border-gray-200 bg-white px-6 py-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Internal AI Chat</h2>
            </div>
          </div>
          
          {/* Chat Messages Area */}
          <div className="flex-1 overflow-hidden bg-white min-h-0">
            <ScrollArea ref={scrollAreaRef} className="h-full p-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Loading messages...</span>
                  </div>
                ) : allMessages && allMessages.length > 0 ? (
                  allMessages.map((chat) => (
                    <div key={chat.id} className="space-y-4 mb-6">
                      {/* User Message - Right Side */}
                      <div className="flex items-start gap-3 justify-end">
                        <div className="flex-1 max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl">
                          <div className="bg-blue-600 text-white rounded-lg p-3 ml-auto relative group">
                            <p className="text-white">{chat.message}</p>
                            {chat.files && chat.files.length > 0 && (
                              <FileDisplay filenames={chat.files} variant="user" />
                            )}
                            <button
                              onClick={() => handleCopyMessage(chat.id, chat.message)}
                              className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100"
                              title="Copy message"
                            >
                              {copiedMessageId === chat.id ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-600" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 text-right">
                            {formatTimestamp(chat.timestamp)}
                          </p>
                        </div>
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      {/* AI Response - Left Side */}
                      {chat.response !== undefined && (
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-gray-600" />
                          </div>
                          <div className="flex-1 max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl">
                            <div className="bg-gray-100 rounded-lg p-4 relative group">
                              <div className="prose prose-sm max-w-none prose-gray">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  rehypePlugins={[rehypeHighlight, rehypeRaw]}
                                  components={{
                                    // Custom styling for code blocks
                                    pre: ({ children, ...props }) => (
                                      <pre 
                                        {...props} 
                                        className="bg-gray-900 text-white p-3 rounded-md overflow-x-auto text-sm border"
                                      >
                                        {children}
                                      </pre>
                                    ),
                                    // Custom styling for inline code
                                    code: ({ children, ...props }: any) => (
                                      !props.className ? (
                                        <code 
                                          {...props} 
                                          className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
                                        >
                                          {children}
                                        </code>
                                      ) : (
                                        <code {...props}>{children}</code>
                                      )
                                    ),
                                    // Custom styling for headings
                                    h1: ({ children, ...props }) => (
                                      <h1 {...props} className="text-lg font-bold text-gray-900 mb-2 mt-4 first:mt-0">
                                        {children}
                                      </h1>
                                    ),
                                    h2: ({ children, ...props }) => (
                                      <h2 {...props} className="text-base font-bold text-gray-900 mb-2 mt-3 first:mt-0">
                                        {children}
                                      </h2>
                                    ),
                                    h3: ({ children, ...props }) => (
                                      <h3 {...props} className="text-sm font-bold text-gray-900 mb-1 mt-2 first:mt-0">
                                        {children}
                                      </h3>
                                    ),
                                    // Custom styling for paragraphs
                                    p: ({ children, ...props }) => (
                                      <p {...props} className="text-gray-900 mb-2 last:mb-0 leading-relaxed">
                                        {children}
                                      </p>
                                    ),
                                    // Custom styling for lists
                                    ul: ({ children, ...props }) => (
                                      <ul {...props} className="list-disc list-inside mb-2 text-gray-900 space-y-1">
                                        {children}
                                      </ul>
                                    ),
                                    ol: ({ children, ...props }) => (
                                      <ol {...props} className="list-decimal list-inside mb-2 text-gray-900 space-y-1">
                                        {children}
                                      </ol>
                                    ),
                                    // Custom styling for blockquotes
                                    blockquote: ({ children, ...props }) => (
                                      <blockquote {...props} className="border-l-4 border-blue-500 pl-4 italic text-gray-700 mb-2">
                                        {children}
                                      </blockquote>
                                    ),
                                    // Custom styling for tables
                                    table: ({ children, ...props }) => (
                                      <div className="overflow-x-auto mb-2">
                                        <table {...props} className="min-w-full divide-y divide-gray-200 border border-gray-300 text-sm">
                                          {children}
                                        </table>
                                      </div>
                                    ),
                                    th: ({ children, ...props }) => (
                                      <th {...props} className="px-3 py-2 bg-gray-50 text-left font-medium text-gray-900 border-b border-gray-300">
                                        {children}
                                      </th>
                                    ),
                                    td: ({ children, ...props }) => (
                                      <td {...props} className="px-3 py-2 text-gray-900 border-b border-gray-200">
                                        {children}
                                      </td>
                                    ),
                                  }}
                                >
                                  {chat.response}
                                </ReactMarkdown>
                                {chat.streaming && (
                                  <span className="inline-block ml-1 w-2 h-5 bg-blue-600 animate-pulse"></span>
                                )}
                              </div>
                              <button
                                onClick={() => handleCopyMessage(chat.id + 1000, chat.response!)}
                                className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-1.5 shadow-md hover:bg-gray-100"
                                title="Copy response"
                              >
                                {copiedMessageId === chat.id + 1000 ? (
                                  <Check className="w-3 h-3 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3 text-gray-600" />
                                )}
                              </button>
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
            </div>

            {/* Message Input */}
            <div className="border-t border-gray-200 bg-white p-6 flex-shrink-0">
              {/* File Upload Component - Constrained height */}
              <div className="max-h-28 overflow-hidden mb-3">
                <FileUpload
                  onFilesSelect={handleFilesSelect}
                  selectedFiles={selectedFiles}
                  onRemoveFile={handleRemoveFile}
                  disabled={isStreaming}
                />
              </div>
              
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask me anything - business questions, general topics, coding help, or just chat..."
                  className="flex-1"
                  disabled={isStreaming}
                />
                <Button 
                  type="submit" 
                  disabled={(!message.trim() && selectedFiles.length === 0) || isStreaming}
                  className="px-4"
                >
                  {isStreaming ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            </div>
          </div>
      </div>
    </div>
  );
}