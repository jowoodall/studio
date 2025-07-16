

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, Edit, Trash2, Archive, Loader2, AlertTriangle, LogIn, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { getGroupsAndInvitationsAction, respondToGroupInvitationAction } from '@/actions/groupActions';
import type { GroupData } from '@/types';

export default function GroupsPage() {
  const { user: authUser, loading: authLoading, isLoadingProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  
  const [joinedGroupsList, setJoinedGroupsList] = useState<GroupData[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<GroupData[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingInvitation, setIsProcessingInvitation] = useState<Record<string, boolean>>({});

  const fetchGroupsAndInvitations = useCallback(async () => {
    if (!authUser) {
      if (!authLoading && !isLoadingProfile) {
        setIsLoadingGroups(false);
        setJoinedGroupsList([]);
        setPendingInvitations([]);
      }
      return;
    }

    setIsLoadingGroups(true);
    setError(null);
    try {
      const result = await getGroupsAndInvitationsAction(authUser.uid);
      if (result.success && result.data) {
        setJoinedGroupsList(result.data.joinedGroups as any);
        setPendingInvitations(result.data.pendingInvitations as any);
      } else {
        throw new Error(result.message || "Failed to load groups and invitations.");
      }
    } catch (e: any) {
      console.error("Error fetching groups:", e);
      setError(e.message);
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
        duration: 9000
      });
    } finally {
      setIsLoadingGroups(false);
    }
  }, [authUser, toast, authLoading, isLoadingProfile]);

  useEffect(() => {
    if (!authLoading && !isLoadingProfile) {
        fetchGroupsAndInvitations();
    }
  }, [authLoading, isLoadingProfile, fetchGroupsAndInvitations]);

  const handleInvitationResponse = async (groupId: string, groupName: string, action: 'accept' | 'decline') => {
    if (!authUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsProcessingInvitation(prev => ({ ...prev, [groupId]: true }));
    try {
      const result = await respondToGroupInvitationAction(authUser.uid, groupId, action);
      if (result.success) {
        const toastTitle = action === 'accept' ? "Invitation Accepted!" : "Invitation Declined";
        const toastDesc = action === 'accept' 
          ? `You have successfully joined the group: ${groupName}.`
          : `You have declined the invitation to join: ${groupName}.`;
        
        toast({ title: toastTitle, description: toastDesc });
        
        if (action === 'accept') {
          // This ensures the local state reflects the change immediately.
          await refreshUserProfile(); 
        }
        // Refetch both lists to ensure state is accurate
        await fetchGroupsAndInvitations();
        
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ title: "Action Failed", description: error.message || "Could not respond to the invitation.", variant: "destructive" });
    } finally {
      setIsProcessingInvitation(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const handleArchiveAction = (groupId: string, groupName: string) => {
    console.log(`Archiving group: ${groupName} (ID: ${groupId})`);
    toast({
      title: "Archive Action",
      description: `Archive for "${groupName}" is not yet implemented.`,
    });
  };

  const handleDeleteAction = (groupId: string, groupName: string) => {
    console.log(`Deleting group: ${groupName} (ID: ${groupId})`);
     toast({
      title: "Delete Action",
      description: `Deletion for "${groupName}" is not yet implemented. Requires confirmation.`,
      variant: "destructive"
    });
  };

  const isLoading = authLoading || isLoadingProfile || isLoadingGroups;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading groups data...</p>
      </div>
    );
  }

  if (error && !isLoading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Groups</h2>
            <p className="text-muted-foreground px-4">{error}</p>
            <Button onClick={fetchGroupsAndInvitations} className="mt-4">Try Again</Button>
        </div>
    );
  }
  
  if (!authUser && !authLoading) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <LogIn className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Please Log In</h2>
        <p className="text-muted-foreground px-4 mb-4">You need to be logged in to view your groups and invitations.</p>
        <Button asChild><Link href="/login">Log In</Link></Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Carpool Groups"
        description="Manage your carpool groups, accept invitations, or create new ones."
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild>
              <Link href="/groups/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Group
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/groups/archived">
                <Archive className="mr-2 h-4 w-4" /> View Archived Groups
              </Link>
            </Button>
          </div>
        }
      />

      {pendingInvitations.length > 0 && (
        <section className="mb-10">
          <h2 className="font-headline text-2xl font-semibold text-accent mb-2">Pending Invitations</h2>
          <p className="text-sm text-muted-foreground mb-4">You have been invited to join these groups. Accept to become a full member.</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pendingInvitations.map((group) => {
                const isProcessing = isProcessingInvitation[group.id];
                return (
                  <Card key={`pending-${group.id}`} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow border-accent/50">
                    <Link href={`/groups/${group.id}`} className="block hover:opacity-90 transition-opacity">
                      <CardHeader className="relative h-40 p-0">
                        <Image 
                          src={group.imageUrl || "https://placehold.co/400x200.png?text=Group+Invite"} 
                          alt={group.name} 
                          fill 
                          className="rounded-t-lg object-cover" 
                          data-ai-hint={group.dataAiHint || "group image"}
                        />
                      </CardHeader>
                    </Link>
                    <CardContent className="flex-grow pt-4">
                      <Link href={`/groups/${group.id}`} className="hover:underline">
                        <CardTitle className="font-headline text-xl mb-1">{group.name}</CardTitle>
                      </Link>
                      <div className="flex items-center text-sm text-muted-foreground mb-2">
                        <Users className="mr-1.5 h-4 w-4" /> {group.memberIds?.length || 0} members
                      </div>
                      <CardDescription className="text-sm h-10 overflow-hidden text-ellipsis">{group.description}</CardDescription>
                    </CardContent>
                    <CardFooter className="border-t pt-4 flex gap-2">
                      <Button 
                          variant="outline"
                          className="w-full"
                          onClick={() => handleInvitationResponse(group.id, group.name, 'decline')}
                          disabled={isProcessing}
                      >
                          {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                          Decline
                      </Button>
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700" 
                        onClick={() => handleInvitationResponse(group.id, group.name, 'accept')}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Accept
                      </Button>
                    </CardFooter>
                  </Card>
                );
            })}
          </div>
          <Separator className="my-8" />
        </section>
      )}

      <section>
        <h2 className="font-headline text-2xl font-semibold text-primary mb-4">My Joined Groups</h2>
        {joinedGroupsList.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {joinedGroupsList.map((group) => (
              <Card key={group.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
                <Link href={`/groups/${group.id}`} className="block hover:opacity-90 transition-opacity">
                  <CardHeader className="relative h-40 p-0">
                    <Image 
                      src={group.imageUrl || "https://placehold.co/400x200.png?text=Group"} 
                      alt={group.name} 
                      fill 
                      className="rounded-t-lg object-cover" 
                      data-ai-hint={group.dataAiHint || "group image"}
                    />
                  </CardHeader>
                </Link>
                <CardContent className="flex-grow pt-4">
                  <Link href={`/groups/${group.id}`} className="hover:underline">
                      <CardTitle className="font-headline text-xl mb-1">{group.name}</CardTitle>
                  </Link>
                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                    <Users className="mr-1.5 h-4 w-4" /> {group.memberIds?.length || 0} members
                  </div>
                  <CardDescription className="text-sm h-10 overflow-hidden text-ellipsis">{group.description}</CardDescription>
                </CardContent>
                <CardFooter className="border-t pt-4 flex flex-wrap justify-end items-center gap-2">
                  <div className="flex space-x-1">
                      <Link
                          href={`/groups/${group.id}/manage`}
                          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
                          aria-label="Manage group members"
                          title="Manage Members"
                      >
                          <Users className="h-4 w-4" />
                      </Link>
                      <Link
                          href={`/groups/${group.id}/edit`}
                          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
                          aria-label="Edit group"
                          title="Edit Group"
                      >
                          <Edit className="h-4 w-4" />
                      </Link>
                      <Button 
                          variant="outline" 
                          size="icon" 
                          aria-label="Archive group" 
                          title="Archive Group"
                          onClick={() => handleArchiveAction(group.id, group.name)}
                          className="text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
                      >
                          <Archive className="h-4 w-4" />
                      </Button>
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      aria-label="Delete group" 
                      title="Delete Group"
                      onClick={() => handleDeleteAction(group.id, group.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12 shadow-md">
            <CardHeader>
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="font-headline text-2xl">No Groups Joined</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-6">
                You haven't joined or created any carpool groups yet.
              </CardDescription>
              <Button asChild>
                <Link href="/groups/create">
                  <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Group
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}
