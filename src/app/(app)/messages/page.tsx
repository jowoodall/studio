
"use client";

import React, { useState, useEffect } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, PlusCircle, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { getConversationsAction } from '@/actions/messageActions';
import type { ConversationListItem } from '@/types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export default function MessagesPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [conversations, setConversations] = useState<ConversationListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            if (!authLoading) {
                setIsLoading(false);
            }
            return;
        }

        const fetchConversations = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const result = await getConversationsAction(user.uid);
                if (result.success && result.conversations) {
                    setConversations(result.conversations);
                } else {
                    throw new Error(result.message || "Failed to load conversations.");
                }
            } catch (err: any) {
                setError(err.message || "An unknown error occurred.");
                toast({
                    title: "Error Loading Messages",
                    description: err.message,
                    variant: "destructive",
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchConversations();
    }, [user, authLoading, toast]);

    const renderContent = () => {
        if (isLoading || authLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-full py-12">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-muted-foreground">Loading your conversations...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                    <h3 className="text-xl font-semibold">Error Loading Messages</h3>
                    <p className="text-muted-foreground mt-2">{error}</p>
                </div>
            );
        }
        
        if (conversations.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold">No Conversations Yet</h3>
                    <p className="text-muted-foreground mt-2">
                        When you join or drive a ryd with a chat, it will appear here.
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {conversations.map(convo => {
                    const participant = convo.otherParticipants[0];
                    const moreParticipantsCount = convo.otherParticipants.length - 1;
                    const conversationTitle = participant ? `${participant.name}${moreParticipantsCount > 0 ? ` & ${moreParticipantsCount} other(s)` : ''}` : 'Ryd Chat';

                    return (
                        <Link key={convo.rydId} href={`/rydz/tracking/${convo.rydId}`} passHref>
                            <Card className="hover:shadow-md hover:border-primary/50 transition-all cursor-pointer">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={participant?.avatarUrl || ''} alt={conversationTitle} data-ai-hint={participant?.dataAiHint || 'person avatar'} />
                                        <AvatarFallback>{conversationTitle.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold truncate">{convo.rydName}</p>
                                        <p className="text-sm text-muted-foreground truncate">
                                            Chat with: {conversationTitle}
                                        </p>
                                        {convo.lastMessage && (
                                            <p className="text-xs text-muted-foreground truncate mt-1">
                                                <span className="font-medium">{convo.lastMessage.senderName}:</span> {convo.lastMessage.text}
                                            </p>
                                        )}
                                    </div>
                                    {convo.lastMessage && (
                                        <p className="text-xs text-muted-foreground self-start">
                                            {format(new Date(convo.lastMessage.timestamp), 'p')}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        );
    }

    return (
        <>
            <PageHeader
                title="Conversations"
                description="View messages from all your rydz."
                actions={
                    <Button asChild>
                        <Link href="/rydz/request">
                            <PlusCircle className="mr-2 h-4 w-4" /> Request a Ryd
                        </Link>
                    </Button>
                }
            />
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle>Ryd Chats</CardTitle>
                    <CardDescription>Select a conversation to view the full chat history and send messages.</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>
        </>
    );
}
