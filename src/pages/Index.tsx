import { useEffect, useState, useRef } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { Sidebar } from "@/components/Sidebar";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={loadConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        onClearAll={handleClearAll}
      />
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-accent">
                <svg className="w-16 h-16 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Welcome to Koziky AI
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Start a conversation by typing a message below. You can also upload images for visual understanding.
                </p>
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
          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-3">
                <p className="text-sm text-muted-foreground">Thinking...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <ChatInput onSendMessage={handleSendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
};

export default Index;