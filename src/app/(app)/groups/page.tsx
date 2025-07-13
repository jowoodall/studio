

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, Edit, Trash2, Archive, Loader2, AlertTriangle, LogIn, CheckCircle, XCircle } from "lucide-react"; // Added XCircle
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'; // Added arrayRemove
import type { GroupData, UserProfileData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

export default function GroupsPage() {
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile, refreshUserProfile } = useAuth();
  const { toast } = useToast();
  
  const [joinedGroupsList, setJoinedGroupsList] = useState<GroupData[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<GroupData[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState<Record<string, boolean>>({});
  const [isDeclining, setIsDeclining] = useState<Record<string, boolean>>({});


  const fetchGroupsAndInvitations = useCallback(async () => {
    if (!authUser || !userProfile) { // Ensure authUser and userProfile are loaded
      if (!authLoading && !isLoadingProfile) { // If auth context is done loading but no user/profile
        setIsLoadingGroups(false);
        setJoinedGroupsList([]);
        setPendingInvitations([]);
        // setError("Please log in to view groups and invitations.");
      }
      return;
    }

    setIsLoadingGroups(true);
    setError(null);
    try {
      // Temporarily removed orderBy("createdAt", "desc") to avoid index error.
      // User should create the index in Firebase console for sorting.
      // The original query was: query(collection(db, "groups"), orderBy("createdAt", "desc"));
      const groupsQuery = query(collection(db, "groups"));
      const querySnapshot = await getDocs(groupsQuery);
      const fetchedGroups: GroupData[] = [];
      querySnapshot.forEach((doc) => {
        fetchedGroups.push({ id: doc.id, ...doc.data() } as GroupData);
      });

      const currentJoinedGroupIds = userProfile?.joinedGroupIds || [];
      const newJoined: GroupData[] = [];
      const newPending: GroupData[] = [];

      fetchedGroups.forEach(group => {
        if (currentJoinedGroupIds.includes(group.id)) {
          newJoined.push(group);
        } else if (group.memberIds.includes(authUser.uid)) {
          newPending.push(group);
        }
      });

      // If the index is created, you can restore sorting here:
      // newJoined.sort((a, b) => (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis());
      // newPending.sort((a, b) => (b.createdAt as Timestamp).toMillis() - (a.createdAt as Timestamp).toMillis());

      setJoinedGroupsList(newJoined);
      setPendingInvitations(newPending);

    } catch (e: any) {
      console.error("Error fetching groups:", e);
      // Check if the error is due to a missing index
      if (e.message && e.message.toLowerCase().includes("index")) {
        setError("Firestore query requires an index. Please check the browser console for a link to create it in your Firebase project. The page will load groups without sorting for now.");
        toast({
          title: "Indexing Required",
          description: "Groups are not sorted. Please create the recommended Firestore index (see console).",
          variant: "default",
          duration: 10000,
        });
         // Attempt to fetch without sorting as a fallback
        try {
            const groupsQueryNoSort = query(collection(db, "groups"));
            const querySnapshotNoSort = await getDocs(groupsQueryNoSort);
            const fetchedGroupsNoSort: GroupData[] = [];
            querySnapshotNoSort.forEach((doc) => {
                fetchedGroupsNoSort.push({ id: doc.id, ...doc.data() } as GroupData);
            });

            const currentJoinedGroupIdsNoSort = userProfile?.joinedGroupIds || [];
            const newJoinedNoSort: GroupData[] = [];
            const newPendingNoSort: GroupData[] = [];

            fetchedGroupsNoSort.forEach(group => {
                if (currentJoinedGroupIdsNoSort.includes(group.id)) {
                newJoinedNoSort.push(group);
                } else if (group.memberIds.includes(authUser.uid)) {
                newPendingNoSort.push(group);
                }
            });
            setJoinedGroupsList(newJoinedNoSort);
            setPendingInvitations(newPendingNoSort);
            setError(null); // Clear the index error as we've fetched without sorting
        } catch (fallbackError) {
             console.error("Error fetching groups without sorting (fallback):", fallbackError);
             setError("Failed to load groups and invitations. Please try again.");
        }

      } else {
        setError("Failed to load groups and invitations. Please try again.");
        toast({
          title: "Error",
          description: "Could not fetch groups information.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoadingGroups(false);
    }
  }, [authUser, userProfile, toast, authLoading, isLoadingProfile]);

  useEffect(() => {
    // Fetch groups only when auth context is fully loaded and user/profile are available
    if (!authLoading && !isLoadingProfile) {
        fetchGroupsAndInvitations();
    }
  }, [authLoading, isLoadingProfile, fetchGroupsAndInvitations, userProfile]); // Added userProfile dependency


  const handleAcceptInvitation = async (groupIdToAccept: string, groupName: string) => {
    if (!authUser || !userProfile) {
      toast({ title: "Error", description: "You must be logged in to accept invitations.", variant: "destructive" });
      return;
    }
    setIsAccepting(prev => ({ ...prev, [groupIdToAccept]: true }));
    try {
      const userDocRef = doc(db, "users", authUser.uid);
      await updateDoc(userDocRef, {
        joinedGroupIds: arrayUnion(groupIdToAccept)
      });

      toast({
        title: "Invitation Accepted!",
        description: `You have successfully joined the group: ${groupName}.`,
      });

      // Refresh the user profile to get the latest joinedGroupIds
      await refreshUserProfile();
      
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast({ title: "Acceptance Failed", description: "Could not join the group. Please try again.", variant: "destructive" });
    } finally {
      setIsAccepting(prev => ({ ...prev, [groupIdToAccept]: false }));
    }
  };
  
  const handleDeclineInvitation = async (groupIdToDecline: string, groupName: string) => {
    if (!authUser) {
      toast({ title: "Error", description: "You must be logged in to decline invitations.", variant: "destructive" });
      return;
    }
    setIsDeclining(prev => ({ ...prev, [groupIdToDecline]: true }));
    try {
      // To decline, we just remove the user's ID from the group's memberIds array.
      // The user doesn't have the groupId in their own joinedGroupIds yet, so we don't need to touch their document.
      const groupDocRef = doc(db, "groups", groupIdToDecline);
      await updateDoc(groupDocRef, {
        memberIds: arrayRemove(authUser.uid)
      });

      toast({
        title: "Invitation Declined",
        description: `You have declined the invitation to join: ${groupName}.`,
        variant: "default",
      });

      // Update UI
      setPendingInvitations(prev => prev.filter(group => group.id !== groupIdToDecline));

    } catch (error) {
      console.error("Error declining invitation:", error);
      toast({ title: "Decline Failed", description: "Could not decline the invitation. Please try again.", variant: "destructive" });
    } finally {
      setIsDeclining(prev => ({ ...prev, [groupIdToDecline]: false }));
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
    // Don't show a full-page error if it's just the index warning and groups were fetched
    const isJustIndexWarning = error.includes("Firestore query requires an index");
    if (isJustIndexWarning && (joinedGroupsList.length > 0 || pendingInvitations.length > 0)) {
        // Groups are loaded, just show the toast (already handled in fetchGroupsAndInvitations)
    } else {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
                <h2 className="text-xl font-semibold mb-2">Error Loading Groups</h2>
                <p className="text-muted-foreground px-4">{error}</p>
                <Button onClick={fetchGroupsAndInvitations} className="mt-4">Try Again</Button>
            </div>
        );
    }
  }
  
  if (!authUser && !authLoading) { // If auth context has loaded and there's no user
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
            {pendingInvitations.map((group) => (
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
                      onClick={() => handleDeclineInvitation(group.id, group.name)}
                      disabled={isDeclining[group.id] || isAccepting[group.id]}
                  >
                      {isDeclining[group.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                      Decline
                  </Button>
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    onClick={() => handleAcceptInvitation(group.id, group.name)}
                    disabled={isAccepting[group.id] || isDeclining[group.id]}
                  >
                    {isAccepting[group.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Accept
                  </Button>
                </CardFooter>
              </Card>
            ))}
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


    
