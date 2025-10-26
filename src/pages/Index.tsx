import { useEffect, useState, useRef } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { Sidebar } from "@/components/Sidebar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string | null;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updated_at: string;
}

const Index = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = () => {
    const stored = localStorage.getItem('grok-conversations');
    if (stored) {
      setConversations(JSON.parse(stored));
    }
  };

  const saveConversations = (convs: Conversation[]) => {
    localStorage.setItem('grok-conversations', JSON.stringify(convs));
    setConversations(convs);
  };

  const loadConversation = (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (conv) {
      setMessages(conv.messages);
      setCurrentConversationId(conversationId);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  const handleDeleteConversation = (id: string) => {
    const updated = conversations.filter(c => c.id !== id);
    saveConversations(updated);
    if (currentConversationId === id) {
      handleNewChat();
    }
  };

  const handleRenameConversation = (id: string, newTitle: string) => {
    const updated = conversations.map(c => 
      c.id === id ? { ...c, title: newTitle } : c
    );
    saveConversations(updated);
  };

  const handleClearAll = () => {
    if (confirm('Are you sure you want to delete all conversations?')) {
      saveConversations([]);
      handleNewChat();
      toast({
        title: "Cleared",
        description: "All conversations deleted",
      });
    }
  };

  const handleSendMessage = async (content: string, imageUrl?: string) => {
    if (!content.trim()) return;

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = crypto.randomUUID();
      setCurrentConversationId(conversationId);
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      image_url: imageUrl,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    setIsStreaming(true);

    try {
      const apiMessages = updatedMessages.map((msg) => {
        const message: any = {
          role: msg.role,
          content: msg.content,
        };
        if (msg.image_url) {
          message.content = [
            { type: "text", text: msg.content },
            { type: "image_url", image_url: { url: msg.image_url } },
          ];
        }
        return message;
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grok-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: apiMessages }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get response from AI");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let assistantMessageId = crypto.randomUUID();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantMessage += content;
                  setMessages((prev) => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.role === "assistant") {
                      return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, content: assistantMessage },
                      ];
                    }
                    return [
                      ...prev,
                      {
                        id: assistantMessageId,
                        role: "assistant",
                        content: assistantMessage,
                      },
                    ];
                  });
                }
              } catch (e) {
                console.error("Error parsing SSE:", e);
              }
            }
          }
        }
      }

      // Save conversation to localStorage
      const finalMessages = [
        ...updatedMessages,
        { id: assistantMessageId, role: "assistant" as const, content: assistantMessage }
      ];

      const existingConvIndex = conversations.findIndex(c => c.id === conversationId);
      const title = updatedMessages.length === 1 ? content.slice(0, 50) : 
        (existingConvIndex >= 0 ? conversations[existingConvIndex].title : "New Chat");

      const updatedConv: Conversation = {
        id: conversationId,
        title,
        messages: finalMessages,
        updated_at: new Date().toISOString(),
      };

      const updatedConversations = existingConvIndex >= 0
        ? conversations.map((c, i) => i === existingConvIndex ? updatedConv : c)
        : [updatedConv, ...conversations];

      saveConversations(updatedConversations);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleGenerateImage = async (prompt: string) => {
    if (!prompt.trim()) return;

    setIsGeneratingImage(true);

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = crypto.randomUUID();
      setCurrentConversationId(conversationId);
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: `Generate an image: ${prompt}`,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grok-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            messages: [{ role: "user", content: prompt }],
            generateImage: true 
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

      if (imageUrl) {
        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Here's your generated image:",
          image_url: imageUrl,
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);

        // Save conversation
        const existingConvIndex = conversations.findIndex(c => c.id === conversationId);
        const title = updatedMessages.length === 1 ? `Image: ${prompt.slice(0, 40)}` : 
          (existingConvIndex >= 0 ? conversations[existingConvIndex].title : "New Chat");

        const updatedConv: Conversation = {
          id: conversationId,
          title,
          messages: finalMessages,
          updated_at: new Date().toISOString(),
        };

        const updatedConversations = existingConvIndex >= 0
          ? conversations.map((c, i) => i === existingConvIndex ? updatedConv : c)
          : [updatedConv, ...conversations];

        saveConversations(updatedConversations);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Animated background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-primary/20 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-accent/20 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-primary/10 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
      </div>
      
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={loadConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onClearAll={handleClearAll}
      />
      <div className="flex-1 flex flex-col bg-background">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 max-w-3xl mx-auto">
              <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                <Sparkles className="w-20 h-20 text-primary" />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Welcome to Koziky AI
                </h2>
                <p className="text-muted-foreground max-w-md text-lg">
                  Start a conversation or generate images with AI
                </p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                <Button
                  onClick={() => {
                    const prompt = window.prompt("Enter image description:");
                    if (prompt) handleGenerateImage(prompt);
                  }}
                  variant="outline"
                  className="gap-2"
                  disabled={isGeneratingImage}
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Image
                </Button>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
                imageUrl={message.image_url}
              />
            ))
          )}
          {(isStreaming || isGeneratingImage) && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  {isGeneratingImage ? "Generating image..." : "Thinking..."}
                </p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput 
          onSendMessage={handleSendMessage} 
          disabled={isStreaming || isGeneratingImage}
          onGenerateImage={handleGenerateImage}
        />
      </div>
    </div>
  );
};

export default Index;