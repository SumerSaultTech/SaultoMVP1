import { AzureOpenAI } from "openai";

export class AzureOpenAIService {
  private client: AzureOpenAI | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient() {
    try {
      const apiKey = process.env.AZURE_OPENAI_KEY;
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-12-01-preview";

      if (!apiKey || !endpoint) {
        console.warn("Azure OpenAI credentials not found. Chatbot will use fallback responses.");
        return;
      }

      this.client = new AzureOpenAI({
        apiKey,
        apiVersion,
        endpoint
      });

      console.log("✅ Azure OpenAI client initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing Azure OpenAI client:", error);
      this.client = null;
    }
  }

  async getChatResponse(message: string, conversationHistory: any[] = []): Promise<{
    content: string;
    metadata: any;
  }> {
    try {
      if (!this.client) {
        return {
          content: "Hello! This is SaultoChat integrated into your MVP. Azure OpenAI needs to be configured for full functionality. Please set AZURE_OPENAI_KEY and AZURE_OPENAI_ENDPOINT environment variables.",
          metadata: { source: "fallback", timestamp: new Date().toISOString() }
        };
      }

      // Format conversation history for OpenAI
      const messages: any[] = [];

      // Add system message
      const systemMessage = "You are SaultoChat, a helpful AI assistant integrated into the Saulto MVP application. You provide accurate, professional, and concise information to help users with business questions, data analysis, and general assistance. You are branded with green colors and represent the Saulto platform.";
      
      messages.push({
        role: "system",
        content: systemMessage
      });

      // Add conversation history
      for (const msg of conversationHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }

      // Add the current user message
      messages.push({
        role: "user",
        content: message
      });

      console.log("🚀 Sending request to Azure OpenAI...");
      console.log(`📝 Message: ${message.substring(0, 100)}...`);

      // Call Azure OpenAI
      const response = await this.client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4",
        messages,
        max_tokens: 1000,
        temperature: 0.7
      });

      const aiResponse = response.choices[0]?.message?.content || "I apologize, but I couldn't generate a response. Please try again.";

      console.log("✅ Azure OpenAI response received");
      console.log(`💭 Response length: ${aiResponse.length} characters`);

      return {
        content: aiResponse,
        metadata: {
          source: "azure_openai",
          timestamp: new Date().toISOString(),
          model: response.model,
          usage: response.usage
        }
      };

    } catch (error: any) {
      console.error("❌ Azure OpenAI error:", error);
      
      return {
        content: `I apologize, but I encountered an error while processing your request. Please try again later. Error: ${error.message}`,
        metadata: {
          source: "error",
          timestamp: new Date().toISOString(),
          error: error.message
        }
      };
    }
  }

  async getChatResponseStreaming(message: string, conversationHistory: any[] = []) {
    try {
      if (!this.client) {
        throw new Error("Azure OpenAI client not initialized");
      }

      // Format messages similar to getChatResponse
      const messages: any[] = [];
      
      const systemMessage = "You are SaultoChat, a helpful AI assistant integrated into the Saulto MVP application. You provide accurate, professional, and concise information to help users with business questions, data analysis, and general assistance.";
      
      messages.push({ role: "system", content: systemMessage });
      
      for (const msg of conversationHistory) {
        if (msg.role === "user" || msg.role === "assistant") {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      
      messages.push({ role: "user", content: message });

      // Return streaming response
      return this.client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4",
        messages,
        stream: true,
        max_tokens: 1000,
        temperature: 0.7
      });

    } catch (error) {
      console.error("Azure OpenAI streaming error:", error);
      throw error;
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }
}

export const azureOpenAIService = new AzureOpenAIService();