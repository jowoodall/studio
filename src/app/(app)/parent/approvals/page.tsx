
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, ShieldCheck, UserCircle, Car, Loader2, AlertTriangle, UserCog, Trash2, ShieldBan } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { type UserProfileData, type ActiveRyd, UserRole, PassengerManifestStatus } from '@/types';
import { manageDriverApprovalAction, type ManageDriverApprovalInput, updateDriverListAction } from '@/actions/parentActions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';

interface ApprovalRequest {
  activeRydId: string;
  student: { uid: string; fullName: string; };
  driver: { uid: string; fullName: string; avatarUrl?: string; dataAiHint?: string; };
  rydDetails: { eventName: string; destination: string; };
}

interface UserDisplayInfo {
  uid: string;
  fullName: string;
  avatarUrl?: string;
  dataAiHint?: string;
  email: string;
}

export default function ParentApprovalsPage() {
  const { user: authUser, userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [approvedDrivers, setApprovedDrivers] = useState<UserDisplayInfo[]>([]);
  const [declinedDrivers, setDeclinedDrivers] = useState<UserDisplayInfo[]>([]);
  const [managedStudents, setManagedStudents] = useState<UserDisplayInfo[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

  const fetchAllData = useCallback(async () => {
    if (!authUser || !userProfile || userProfile.role !== UserRole.PARENT) {
      setIsLoading(false);
      if (userProfile && userProfile.role !== UserRole.PARENT) setError("This page is for parents only.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Fetch Pending Approvals
      const studentIds = userProfile.managedStudentIds || [];
      let fetchedApprovals: ApprovalRequest[] = [];
      if (studentIds.length > 0) {
        const activeRydzRef = collection(db, "activeRydz");
        const q = query(activeRydzRef, where("uidsPendingParentalApproval", "array-contains-any", studentIds));
        const querySnapshot = await getDocs(q);
        const approvalPromises = querySnapshot.docs.flatMap(docSnap => {
          const rydData = { id: docSnap.id, ...docSnap.data() } as ActiveRyd;
          const relevantPassengers = rydData.passengerManifest.filter(p => studentIds.includes(p.userId) && p.status === PassengerManifestStatus.PENDING_PARENT_APPROVAL);
          return relevantPassengers.map(async (passenger) => {
            try {
              const [driverDoc, studentDoc] = await Promise.all([
                getDoc(doc(db, "users", rydData.driverId)),
                getDoc(doc(db, "users", passenger.userId))
              ]);
              if (!driverDoc.exists() || !studentDoc.exists()) return null;
              const driverData = driverDoc.data() as UserProfileData;
              const studentData = studentDoc.data() as UserProfileData;
              return {
                activeRydId: rydData.id,
                student: { uid: studentData.uid, fullName: studentData.fullName },
                driver: { uid: driverData.uid, fullName: driverData.fullName, avatarUrl: driverData.avatarUrl, dataAiHint: driverData.dataAiHint },
                rydDetails: { eventName: rydData.eventName || 'Unnamed Ryd', destination: rydData.finalDestinationAddress || 'N/A' },
              };
            } catch (e) { console.error("Error processing an approval request:", e); return null; }
          });
        });
        fetchedApprovals = (await Promise.all(approvalPromises)).filter(Boolean) as ApprovalRequest[];
      }
      setPendingApprovals(fetchedApprovals);

      // Fetch Driver and Student Lists
      const { approvedDriverIds = [], declinedDriverIds = [], managedStudentIds = [] } = userProfile;
      const fetchProfiles = async (ids: string[]): Promise<UserDisplayInfo[]> => {
        if (ids.length === 0) return [];
        const profilePromises = ids.map(async (id) => {
          try {
            const docRef = doc(db, "users", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfileData;
              return { uid: id, fullName: data.fullName, avatarUrl: data.avatarUrl, dataAiHint: data.dataAiHint, email: data.email };
            } return null;
          } catch (e) { console.error(`Failed to fetch profile for ID ${id}`, e); return null; }
        });
        return (await Promise.all(profilePromises)).filter(Boolean) as UserDisplayInfo[];
      };
      const [approvedList, declinedList, studentList] = await Promise.all([
        fetchProfiles(approvedDriverIds), 
        fetchProfiles(declinedDriverIds),
        fetchProfiles(managedStudentIds)
      ]);
      setApprovedDrivers(approvedList);
      setDeclinedDrivers(declinedList);
      setManagedStudents(studentList);

    } catch (e: any) {
      console.error("Error fetching approvals/lists:", e);
      let detailedError = "Failed to load data. This can happen if the required Firestore index has not been created.";
      if (e.message && (e.message.toLowerCase().includes("index") || e.message.toLowerCase().includes("missing a composite index"))) {
        detailedError = "A Firestore index is required. Please check the browser's console for a link to create it.";
      }
      setError(detailedError);
      toast({ title: "Error Loading Data", description: detailedError, variant: "destructive", duration: 9000 });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, userProfile, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchAllData();
    }
  }, [authLoading, fetchAllData]);
  
  const handleApproval = async (request: ApprovalRequest, decision: ManageDriverApprovalInput['decision']) => {
      if (!authUser) return;
      const key = `${request.activeRydId}-${request.student.uid}`;
      setIsProcessing(prev => ({ ...prev, [key]: true }));
      try {
        const result = await manageDriverApprovalAction({
            parentUserId: authUser.uid,
            studentUserId: request.student.uid,
            driverId: request.driver.uid,
            activeRydId: request.activeRydId,
            decision
        });
        if(result.success) {
            toast({ title: "Decision Submitted", description: result.message });
            fetchAllData(); // Refresh all data
        } else {
            toast({ title: "Action Failed", description: result.message, variant: "destructive" });
        }
      } catch (e: any) {
          toast({ title: "Error", description: `An unexpected error occurred: ${e.message}`, variant: "destructive" });
      } finally {
          setIsProcessing(prev => ({ ...prev, [key]: false }));
      }
  };

  const handleRemoveFromList = async (driverId: string, list: 'approved' | 'declined') => {
    if (!authUser) return;
    const key = `${list}-${driverId}`;
    setIsProcessing(prev => ({ ...prev, [key]: true }));
    try {
        const result = await updateDriverListAction({ parentUserId: authUser.uid, driverId, list, action: 'remove' });
        if (result.success) {
            toast({ title: "List Updated", description: result.message });
            fetchAllData(); // Refresh all data
        } else {
            toast({ title: "Update Failed", description: result.message, variant: "destructive" });
        }
    } catch (e: any) {
        toast({ title: "Error", description: `An unexpected error occurred: ${e.message}`, variant: "destructive" });
    } finally {
        setIsProcessing(prev => ({ ...prev, [key]: false }));
    }
  };

  const renderDriverList = (drivers: UserDisplayInfo[], listType: 'approved' | 'declined') => {
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
                  <div key={driver.uid} className="p-3 border rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
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
                      <Button variant="destructive" size="sm" onClick={() => handleRemoveFromList(driver.uid, listType)} disabled={isLoadingAction}>
                          {isLoadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Remove
                      </Button>
                    </div>
                     {listType === 'approved' && managedStudents.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                            <h5 className="text-xs font-semibold text-muted-foreground">Approved for all managed students:</h5>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                {managedStudents.map(student => (
                                    <div key={student.uid} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                        <UserCircle className="h-3 w-3" />
                                        <span>{student.fullName}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                  </div>
              );
          })}
      </div>
    );
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading approvals & driver lists...</p>
      </div>
    );
  }

  if (error) {
     return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground px-4 whitespace-pre-line">{error}</p>
        <Button onClick={fetchAllData} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Driver Approvals & Management"
        description="Review pending requests and manage your permanent lists of approved or declined drivers."
      />
      
      <h2 className="font-headline text-2xl font-semibold text-primary mb-4">Pending Requests</h2>
      {pendingApprovals.length > 0 ? (
        <div className="space-y-6">
          {pendingApprovals.map((request) => {
            const key = `${request.activeRydId}-${request.student.uid}`;
            const isLoadingAction = isProcessing[key];
            return (
              <Card key={key} className="shadow-lg border-2 border-primary/50">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={request.driver.avatarUrl || `https://placehold.co/100x100.png?text=${request.driver.fullName.split(" ").map(n=>n[0]).join("")}`} alt={request.driver.fullName} data-ai-hint={request.driver.dataAiHint || "driver photo"} />
                    <AvatarFallback>{request.driver.fullName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="font-headline text-xl">{request.driver.fullName}</CardTitle>
                    <CardDescription>Request to drive <span className="font-semibold text-foreground">{request.student.fullName}</span></CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/profile/view/${request.driver.uid}`}><UserCircle className="mr-2 h-4 w-4" /> View Profile</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-muted/50 rounded-md border text-sm space-y-1">
                    <p><span className="font-semibold">Ryd To:</span> {request.rydDetails.eventName}</p>
                    <p><span className="font-semibold">At:</span> {request.rydDetails.destination}</p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
                    <div className="flex-1 text-xs text-muted-foreground">Approve this driver just for this ryd, or add them to your permanent list of approved drivers.</div>
                    <div className="flex gap-2 sm:gap-4 flex-wrap">
                        <Button variant="destructive" onClick={() => handleApproval(request, 'reject')} disabled={isLoadingAction}>
                            {isLoadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Reject
                        </Button>
                        <Button variant="outline" onClick={() => handleApproval(request, 'approve_once')} disabled={isLoadingAction}>
                            {isLoadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Car className="mr-2 h-4 w-4" />} Approve for this Ryd
                        </Button>
                        <Button onClick={() => handleApproval(request, 'approve_permanently')} className="bg-green-600 hover:bg-green-700" disabled={isLoadingAction}>
                            {isLoadingAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} Approve & Add to List
                        </Button>
                    </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription>There are no new driver approval requests for your students at this time.</CardDescription>
          </CardContent>
        </Card>
      )}

      <Separator className="my-8" />
      <h2 className="font-headline text-2xl font-semibold text-primary mb-4">My Driver Lists</h2>
      
       <Tabs defaultValue="approved" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="approved"><ShieldCheck className="mr-2 h-4 w-4"/>Approved Drivers ({approvedDrivers.length})</TabsTrigger>
          <TabsTrigger value="declined"><ShieldBan className="mr-2 h-4 w-4"/>Declined Drivers ({declinedDrivers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="approved">
          <Card>
            <CardHeader><CardTitle>Approved Driver List</CardTitle><CardDescription>These drivers are automatically approved for any ryd requests involving your students.</CardDescription></CardHeader>
            <CardContent>{renderDriverList(approvedDrivers, 'approved')}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="declined">
          <Card>
            <CardHeader><CardTitle>Declined Driver List</CardTitle><CardDescription>These drivers are blocked from driving your students. You will not receive approval requests for them unless you remove them from this list.</CardDescription></CardHeader>
            <CardContent>{renderDriverList(declinedDrivers, 'declined')}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
