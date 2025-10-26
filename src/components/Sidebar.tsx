import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2, Sparkles, Edit2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onClearAll: () => void;
}

export const Sidebar = ({ 
  conversations, 
  currentConversationId, 
  onSelectConversation, 
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onClearAll
}: SidebarProps) => {
  const { toast } = useToast();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onDeleteConversation(id);
    toast({
      title: "Deleted",
      description: "Conversation deleted successfully",
    });
  };

  const handleRename = (id: string, currentTitle: string) => {
    setRenamingId(id);
    setNewTitle(currentTitle);
    setRenameDialogOpen(true);
  };

  const confirmRename = () => {
    if (renamingId && newTitle.trim()) {
      onRenameConversation(renamingId, newTitle.trim());
      toast({
        title: "Renamed",
        description: "Conversation renamed successfully",
      });
    }
    setRenameDialogOpen(false);
    setRenamingId(null);
    setNewTitle("");
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(conversations, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `koziky-conversations-${new Date().toISOString()}.json`;
    link.click();
    toast({
      title: "Exported",
      description: "All conversations exported successfully",
    });
  };

  return (
    <div className="w-64 border-r bg-muted/30 flex flex-col h-screen">
      <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Koziky AI
          </h1>
        </div>
        <Button 
          onClick={onNewChat} 
          className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.map((conv) => (
            <ContextMenu key={conv.id}>
              <ContextMenuTrigger>
                <div
                  className={cn(
                    "group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent/50",
                    currentConversationId === conv.id && "bg-accent/70"
                  )}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate text-sm">{conv.title}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDelete(conv.id, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleRename(conv.id, conv.title)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Rename
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleDelete(conv.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      </ScrollArea>

      <div className="p-2 border-t space-y-1">
        <Button 
          onClick={handleExport} 
          variant="ghost"
          className="w-full justify-start"
        >
          <Download className="mr-2 h-4 w-4" />
          Export All
        </Button>
        <Button 
          onClick={onClearAll} 
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Clear All
        </Button>
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
            <DialogDescription>
              Enter a new name for this conversation
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
              placeholder="Conversation title"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRename}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};