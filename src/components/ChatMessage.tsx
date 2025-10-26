import { cn } from "@/lib/utils";
import { Bot, User, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Highlight, themes } from "prism-react-renderer";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
}

export const ChatMessage = ({ role, content, imageUrl }: ChatMessageProps) => {
  const isUser = role === "user";
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCopy = (code: string, language: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(language);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className={cn("flex gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary-foreground" />
        </div>
      )}
      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-3 shadow-sm",
        isUser 
          ? "bg-gradient-to-br from-primary to-accent text-primary-foreground" 
          : "bg-muted text-foreground"
      )}>
        {imageUrl && (
          <img 
            src={imageUrl} 
            alt="Uploaded" 
            className="rounded-lg mb-2 max-w-sm w-full object-cover"
          />
        )}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        ) : (
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-pre:max-w-full prose-pre:overflow-x-auto">
            <ReactMarkdown
              components={{
                code(props) {
                  const { children, className, ...rest } = props;
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  const codeString = String(children).replace(/\n$/, '');
                  const isInline = !className;
                  
                  return !isInline && match ? (
                    <div className="not-prose my-3 rounded-lg overflow-hidden border border-border bg-muted/50">
                      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b border-border">
                        <span className="text-xs font-medium text-muted-foreground">{language}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => handleCopy(codeString, language)}
                        >
                          {copiedCode === language ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                      <div className="max-h-[400px] overflow-auto">
                        <Highlight
                          theme={themes.oneDark}
                          code={codeString}
                          language={language as any}
                        >
                          {({ className: highlightClassName, style, tokens, getLineProps, getTokenProps }) => (
                            <pre
                              className={cn(highlightClassName, "p-4 m-0")}
                              style={style}
                            >
                              {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line })}>
                                  {line.map((token, key) => (
                                    <span key={key} {...getTokenProps({ token })} />
                                  ))}
                                </div>
                              ))}
                            </pre>
                          )}
                        </Highlight>
                      </div>
                    </div>
                  ) : (
                    <code {...rest} className={cn("bg-muted px-1 py-0.5 rounded text-xs", className)}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <User className="w-5 h-5 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
};