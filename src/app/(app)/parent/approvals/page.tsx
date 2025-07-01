
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, ShieldCheck, UserCircle, Car, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { type UserProfileData, type ActiveRyd, UserRole, PassengerManifestStatus } from '@/types';
import { manageDriverApprovalAction, type ManageDriverApprovalInput } from '@/actions/parentActions';

// Interface for the combined data we need to display
interface ApprovalRequest {
  activeRydId: string;
  student: { uid: string; fullName: string; };
  driver: { uid: string; fullName: string; avatarUrl?: string; dataAiHint?: string; };
  rydDetails: { eventName: string; destination: string; };
}

export default function ParentApprovalsPage() {
  const { user: authUser, userProfile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});

  const fetchPendingApprovals = useCallback(async () => {
    if (!authUser || !userProfile || userProfile.role !== UserRole.PARENT || !userProfile.managedStudentIds?.length) {
      setIsLoading(false);
      if (userProfile && userProfile.role !== UserRole.PARENT) {
        setError("This page is for parents only.");
      } else if (userProfile && !userProfile.managedStudentIds?.length) {
         setError("You do not have any students associated with your account.");
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const activeRydzRef = collection(db, "activeRydz");
      const q = query(activeRydzRef, where("uidsPendingParentalApproval", "array-contains-any", userProfile.managedStudentIds));
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setPendingApprovals([]);
        setIsLoading(false);
        return;
      }

      const approvalPromises = querySnapshot.docs.flatMap(docSnap => {
        const rydData = { id: docSnap.id, ...docSnap.data() } as ActiveRyd;
        
        // Find which of the parent's students are on this ryd and pending approval
        const relevantPassengers = rydData.passengerManifest.filter(p => 
          userProfile.managedStudentIds?.includes(p.userId) && p.status === PassengerManifestStatus.PENDING_PARENT_APPROVAL
        );

        return relevantPassengers.map(async (passenger) => {
          try {
            const driverDoc = await getDoc(doc(db, "users", rydData.driverId));
            const studentDoc = await getDoc(doc(db, "users", passenger.userId));

            if (!driverDoc.exists() || !studentDoc.exists()) return null;
            
            const driverData = driverDoc.data() as UserProfileData;
            const studentData = studentDoc.data() as UserProfileData;
            
            return {
              activeRydId: rydData.id,
              student: { uid: studentData.uid, fullName: studentData.fullName },
              driver: { uid: driverData.uid, fullName: driverData.fullName, avatarUrl: driverData.avatarUrl, dataAiHint: driverData.dataAiHint },
              rydDetails: { eventName: rydData.eventName || 'Unnamed Ryd', destination: rydData.finalDestinationAddress || 'N/A' },
            };
          } catch (e) {
            console.error("Error processing an approval request:", e);
            return null;
          }
        });
      });
      
      const resolvedApprovals = (await Promise.all(approvalPromises)).filter(Boolean) as ApprovalRequest[];
      setPendingApprovals(resolvedApprovals);

    } catch (e: any) {
      console.error("Error fetching pending approvals:", e);
      let detailedError = "Failed to load approval requests. This can happen if the required Firestore index has not been created.";
      if (e.message && (e.message.toLowerCase().includes("index") || e.message.toLowerCase().includes("missing a composite index"))) {
        detailedError = "A Firestore index is required to load approvals. Please check the browser's console for a link to create it.";
      }
      setError(detailedError);
      toast({ title: "Error Loading Approvals", description: detailedError, variant: "destructive", duration: 9000 });
    } finally {
      setIsLoading(false);
    }
  }, [authUser, userProfile, toast]);

  useEffect(() => {
    if (!authLoading) {
      fetchPendingApprovals();
    }
  }, [authLoading, fetchPendingApprovals]);
  
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
            fetchPendingApprovals(); // Refresh the list
        } else {
            toast({ title: "Action Failed", description: result.message, variant: "destructive" });
        }
      } catch (e: any) {
          toast({ title: "Error", description: `An unexpected error occurred: ${e.message}`, variant: "destructive" });
      } finally {
          setIsProcessing(prev => ({ ...prev, [key]: false }));
      }
  };


  if (isLoading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading approvals...</p>
      </div>
    );
  }

  if (error) {
     return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p className="text-muted-foreground px-4 whitespace-pre-line">{error}</p>
        <Button onClick={fetchPendingApprovals} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Driver Approvals"
        description="Review and approve drivers for your child's rydz."
      />
      {pendingApprovals.length > 0 ? (
        <div className="space-y-6">
          {pendingApprovals.map((request) => {
            const key = `${request.activeRydId}-${request.student.uid}`;
            const isLoadingAction = isProcessing[key];
            return (
              <Card key={key} className="shadow-lg">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={request.driver.avatarUrl || `https://placehold.co/100x100.png?text=${request.driver.fullName.split(" ").map(n=>n[0]).join("")}`} alt={request.driver.fullName} data-ai-hint={request.driver.dataAiHint || "driver photo"} />
                    <AvatarFallback>{request.driver.fullName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="font-headline text-xl">{request.driver.fullName}</CardTitle>
                    <CardDescription>
                      Request to drive <span className="font-semibold text-foreground">{request.student.fullName}</span>
                    </CardDescription>
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
            <CardDescription>
              There are no new driver approval requests for your students at this time.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </>
  );
}
