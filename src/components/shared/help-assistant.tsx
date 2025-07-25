
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HelpCircle, Bot, User, Send, Loader2, MessageSquarePlus } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { askHelpAssistant } from '@/ai/flows/help-assistant';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

export function HelpAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, userProfile } = useAuth();
  const pathname = usePathname();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const addMessage = (role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [...prev, { id: Date.now(), role, content }]);
  };
  
  useEffect(() => {
    if (isOpen && messages.length === 0) {
        addMessage('assistant', `Hi ${userProfile?.fullName?.split(' ')[0] || ''}! I'm the RydzConnect AI assistant. You can ask me a question or provide feedback about the app.`);
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    const newMessages: Message[] = [...messages, { id: Date.now(), role: 'user', content: userMessage }];
    setMessages(newMessages);

    setInput('');
    setIsLoading(true);

    try {
        const result = await askHelpAssistant({
            question: userMessage,
            conversationHistory: newMessages.map(m => ({ role: m.role, content: m.content })),
            userRole: userProfile?.role || 'unknown',
            currentPage: pathname,
            userId: user?.uid
        });
        addMessage('assistant', result.answer);
    } catch (error: any) {
        console.error("Help Assistant Error:", error);
        addMessage('assistant', "I'm sorry, I encountered an error. Please try again in a moment.");
        toast({
            title: "AI Error",
            description: "Could not get a response from the help assistant.",
            variant: "destructive"
        })
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="default"
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 flex items-center justify-center flex-col gap-0.5"
        onClick={() => setIsOpen(true)}
      >
        <MessageSquarePlus className="h-6 w-6" />
        <span className="text-[10px]">Help</span>
        <span className="sr-only">Open Help & Feedback</span>
      </Button>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Help & Feedback</SheetTitle>
            <SheetDescription>
              Ask a question or share your feedback to help us improve.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full" ref={scrollAreaRef as any}>
              <div className="p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex items-start gap-3",
                      message.role === 'user' && 'justify-end'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback><Bot className="h-5 w-5"/></AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "rounded-lg px-3 py-2 max-w-[80%]",
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                     {message.role === 'user' && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={userProfile?.avatarUrl || ''} alt={userProfile?.fullName || 'User'}/>
                        <AvatarFallback><User className="h-5 w-5"/></AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                         <Avatar className="h-8 w-8">
                            <AvatarFallback><Bot className="h-5 w-5"/></AvatarFallback>
                        </Avatar>
                        <div className="bg-muted rounded-lg px-3 py-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    </div>
                )}
              </div>
            </ScrollArea>
          </div>
          <SheetFooter>
            <form onSubmit={handleSubmit} className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question or give feedback..."
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
