
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, Edit, Trash2, Archive, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import type { GroupData } from '@/types';
import { useToast } from '@/hooks/use-toast';

export default function GroupsPage() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [groupsList, setGroupsList] = useState<GroupData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!authUser) {
      // Wait for authUser to be available, or handle unauthenticated state
      setIsLoading(false); 
      // setError("Please log in to view groups."); // Or simply show no groups
      setGroupsList([]); // Clear list if user logs out
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // For now, fetching all groups. Later, you might filter by memberIds.
      const groupsQuery = query(collection(db, "groups"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(groupsQuery);
      const fetchedGroups: GroupData[] = [];
      querySnapshot.forEach((doc) => {
        // Ensure createdAt is converted from Firestore Timestamp to a serializable format if needed,
        // but for display, it's fine. If passing to other client components, ensure serializability.
        fetchedGroups.push({ id: doc.id, ...doc.data() } as GroupData);
      });
      setGroupsList(fetchedGroups);
    } catch (e) {
      console.error("Error fetching groups:", e);
      setError("Failed to load groups. Please try again.");
      toast({
        title: "Error",
        description: "Could not fetch groups from the database.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, toast]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);


  const handleArchiveAction = (groupId: string, groupName: string) => {
    console.log(`Archiving group: ${groupName} (ID: ${groupId})`);
    toast({
      title: "Archive Action",
      description: `Archive for "${groupName}" is not yet implemented.`,
    });
    // Placeholder: In a real app, update group status in Firestore
  };

  const handleDeleteAction = (groupId: string, groupName: string) => {
    console.log(`Deleting group: ${groupName} (ID: ${groupId})`);
     toast({
      title: "Delete Action",
      description: `Deletion for "${groupName}" is not yet implemented. Requires confirmation and careful handling.`,
      variant: "destructive"
    });
    // Placeholder: In a real app, delete group document and handle related data in Firestore
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading groups...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Groups</h2>
        <p className="text-muted-foreground px-4">{error}</p>
        <Button onClick={fetchGroups} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Carpool Groups"
        description="Manage your carpool groups or create new ones."
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

      {groupsList.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groupsList.map((group) => (
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
            <CardTitle className="font-headline text-2xl">No Groups Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              No carpool groups found. Be the first to create one!
            </CardDescription>
            <Button asChild>
              <Link href="/groups/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Group
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
