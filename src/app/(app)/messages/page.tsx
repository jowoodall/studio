
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Edit3, PlusCircle, Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages',
};

const mockConversations = [
  { id: "convo1", name: "Alex Johnson", lastMessage: "Sounds good, see you then!", timestamp: "10:30 AM", unread: 2, avatar: "https://placehold.co/100x100.png?text=AJ", dataAiHint: "man portrait" },
  { id: "convo2", name: "Maria Garcia", lastMessage: "Can you pick up an extra stop?", timestamp: "Yesterday", unread: 0, avatar: "https://placehold.co/100x100.png?text=MG", dataAiHint: "woman smiling" },
  { id: "convo3", name: "Northwood High Carpool Group", lastMessage: "Reminder: Early dismissal on Friday.", timestamp: "3 days ago", unread: 0, avatar: "https://placehold.co/100x100.png?text=NH", dataAiHint: "school building" },
];

const mockActiveConversationMessages = [
    { id: "msg1", sender: "Alex Johnson", text: "Hey! Are we still on for the game tomorrow?", timestamp: "10:25 AM", isCurrentUser: false },
    { id: "msg2", sender: "You", text: "Yep! I'll be there around 2 PM.", timestamp: "10:28 AM", isCurrentUser: true },
    { id: "msg3", sender: "Alex Johnson", text: "Sounds good, see you then!", timestamp: "10:30 AM", isCurrentUser: false },
];

// In a real app, this would be dynamic based on the selected conversation
const activeConversationName = "Alex Johnson";

export default function MessagesPage() {
  return (
    <>
      <PageHeader
        title="Messages"
        description="View and manage your conversations."
        actions={
            <Button asChild>
                <Link href="/messages/new">
                    <PlusCircle className="mr-2 h-4 w-4" /> New Message
                </Link>
            </Button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]"> {/* Adjust height as needed */}
        {/* Conversation List */}
        <Card className="md:col-span-1 lg:col-span-1 flex flex-col shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold">Chats</CardTitle>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                    <Edit3 className="h-4 w-4" />
                </Button>
            </div>
            <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search conversations..." className="pl-8" />
            </div>
          </CardHeader>
          <ScrollArea className="flex-grow">
            <CardContent className="pt-0">
              <div className="space-y-1">
                {mockConversations.map((convo) => (
                  <Link key={convo.id} href={`/messages/${convo.id}`} passHref>
                    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={convo.avatar} alt={convo.name} data-ai-hint={convo.dataAiHint} />
                        <AvatarFallback>{convo.name.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{convo.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{convo.lastMessage}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{convo.timestamp}</p>
                        {convo.unread > 0 && (
                          <span className="mt-1 inline-block bg-primary text-primary-foreground text-xs font-bold px-1.5 py-0.5 rounded-full">
                            {convo.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Active Conversation View */}
        <Card className="md:col-span-2 lg:col-span-3 flex flex-col shadow-xl">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={mockConversations[0].avatar} alt={activeConversationName} data-ai-hint={mockConversations[0].dataAiHint} />
                    <AvatarFallback>{activeConversationName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-lg font-semibold">{activeConversationName}</CardTitle>
                    <CardDescription className="text-xs">Online</CardDescription> {/* Or last seen */}
                </div>
            </div>
          </CardHeader>
          <ScrollArea className="flex-grow bg-muted/30 p-4">
            <div className="space-y-4">
              {mockActiveConversationMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl ${msg.isCurrentUser ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-card text-card-foreground border rounded-bl-none'}`}>
                    {!msg.isCurrentUser && <p className="text-xs font-medium mb-0.5">{msg.sender}</p>}
                    <p className="text-sm">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground'} text-right`}>{msg.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <CardContent className="border-t p-4">
            <form className="flex items-center gap-2">
              <Input placeholder="Type a message..." className="flex-1" />
              <Button type="submit" size="icon">
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

    