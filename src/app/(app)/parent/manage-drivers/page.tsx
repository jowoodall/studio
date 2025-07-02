
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, AlertTriangle, UserCog, Trash2, UserX, UserCheck, ShieldCheck, ShieldBan } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { type UserProfileData, UserRole } from '@/types';
import { updateDriverListAction } from '@/actions/parentActions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DriverInfo {
  uid: string;
  fullName: string;
  avatarUrl?: string;
  dataAiHint?: string;
  email: string;
}

export default function ManageDriversPage() {
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  const { toast } = useToast();

  const [approvedDrivers, setApprovedDrivers] = useState<DriverInfo[]>([]);
  const [declinedDrivers, setDeclinedDrivers] = useState<DriverInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

  const fetchDriverLists = useCallback(async () => {
    if (!authUser || !userProfile) {
        if (!authLoading && !isLoadingProfile) setIsLoading(false);
        return;
    }
    if (userProfile.role !== UserRole.PARENT) {
      setError("This page is for parents only.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { approvedDriverIds = [], declinedDriverIds = [] } = userProfile;
      
      const fetchProfiles = async (ids: string[]): Promise<DriverInfo[]> => {
        if (ids.length === 0) return [];
        const profilePromises = ids.map(async (id) => {
          try {
            const docRef = doc(db, "users", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfileData;
              return { uid: id, fullName: data.fullName, avatarUrl: data.avatarUrl, dataAiHint: data.dataAiHint, email: data.email };
            }
            return null;
          } catch (e) {
            console.error(`Failed to fetch profile for ID ${id}`, e);
            return null;
          }
        });
        return (await Promise.all(profilePromises)).filter(Boolean) as DriverInfo[];
      };

      const [approvedList, declinedList] = await Promise.all([
        fetchProfiles(approvedDriverIds),
        fetchProfiles(declinedDriverIds),
      ]);

      setApprovedDrivers(approvedList);
      setDeclinedDrivers(declinedList);

    } catch (e: any) {
      setError("Failed to load driver lists.");
      toast({ title: "Error", description: "Could not load your driver lists.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, userProfile, toast, authLoading, isLoadingProfile]);

  useEffect(() => {
    fetchDriverLists();
  }, [fetchDriverLists]);

  const handleRemoveFromList = async (driverId: string, list: 'approved' | 'declined') => {
    if (!authUser) return;

    const key = `${list}-${driverId}`;
    setIsProcessing(prev => ({...prev, [key]: true}));

    try {
        const result = await updateDriverListAction({
            parentUserId: authUser.uid,
            driverId,
            list,
            action: 'remove'
        });

        if (result.success) {
            toast({ title: "List Updated", description: result.message });
            fetchDriverLists(); // Refresh lists after successful removal
        } else {
            toast({ title: "Update Failed", description: result.message, variant: "destructive" });
        }
    } catch (e: any) {
         toast({ title: "Error", description: `An unexpected error occurred: ${e.message}`, variant: "destructive" });
    } finally {
        setIsProcessing(prev => ({...prev, [key]: false}));
    }
  };


  if (isLoading || authLoading || isLoadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your driver lists...</p>
      </div>
    );
  }

  if (error) {
     return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground px-4">{error}</p>
        <Button onClick={fetchDriverLists} className="mt-4">Try Again</Button>
      </div>
    );
  }

  const renderDriverList = (drivers: DriverInfo[], listType: 'approved' | 'declined') => {
      const EmptyStateIcon = listType === 'approved' ? ShieldCheck : ShieldBan;
      const emptyTitle = listType === 'approved' ? "No Approved Drivers" : "No Declined Drivers";
      const emptyDescription = listType === 'approved' 
        ? "You have not added any drivers to your permanent approved list yet."
        : "You have not declined any drivers yet.";

      if (drivers.length === 0) {
          return (
             <div className="text-center py-10">
                <EmptyStateIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-headline text-xl">{emptyTitle}</h3>
                <p className="text-sm text-muted-foreground mt-2">{emptyDescription}</p>
            </div>
          )
      }

      return (
        <div className="space-y-4">
            {drivers.map(driver => {
                const key = `${listType}-${driver.uid}`;
                const isLoadingAction = isProcessing[key];
                return (
                    <div key={driver.uid} className="flex items-center justify-between p-3 border rounded-lg shadow-sm">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12">
                                <AvatarImage src={driver.avatarUrl} alt={driver.fullName} data-ai-hint={driver.dataAiHint} />
                                <AvatarFallback>{driver.fullName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                            </Avatar>
                            <div>
                                <Link href={`/profile/view/${driver.uid}`} className="font-medium hover:underline">{driver.fullName}</Link>
                                <p className="text-xs text-muted-foreground">{driver.email}</p>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveFromList(driver.uid, listType)}
                            disabled={isLoadingAction}
                        >
                            {isLoadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                             Remove
                        </Button>
                    </div>
                );
            })}
        </div>
      );
  }


  return (
    <>
      <PageHeader
        title="Manage My Drivers"
        description="View and manage your lists of permanently approved and declined drivers."
      />

      <Tabs defaultValue="approved" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="approved"><ShieldCheck className="mr-2 h-4 w-4"/>Approved Drivers ({approvedDrivers.length})</TabsTrigger>
          <TabsTrigger value="declined"><ShieldBan className="mr-2 h-4 w-4"/>Declined Drivers ({declinedDrivers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Approved Driver List</CardTitle>
              <CardDescription>
                These drivers are automatically approved for any ryd requests involving your students.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderDriverList(approvedDrivers, 'approved')}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="declined">
          <Card>
            <CardHeader>
              <CardTitle>Declined Driver List</CardTitle>
              <CardDescription>
                These drivers are blocked from driving your students. You will not receive approval requests for them unless you remove them from this list.
              </CardDescription>
            </CardHeader>
            <CardContent>
                {renderDriverList(declinedDrivers, 'declined')}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
