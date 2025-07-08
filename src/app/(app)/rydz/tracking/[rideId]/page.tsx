
"use client";

import React, { useState, useEffect, use, useCallback, useRef } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, Car, Clock, Flag, UserCircle, MessageSquare, Loader2, MapPin as MapPinIcon, Users, CalendarDays, CheckCircle2, XCircle, UserX, ShieldCheck, PlayCircle, Check, Map, Undo2, Ban, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp, onSnapshot } from 'firebase/firestore';
import { type RydData, type UserProfileData, type ActiveRyd, type EventData, PassengerManifestStatus, UserRole, ActiveRydStatus as ARStatus, type RydMessage } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, subHours } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { managePassengerJoinRequestAction, cancelPassengerSpotAction, updatePassengerPickupStatusAction, revertPassengerPickupAction, sendRydMessageAction } from '@/actions/activeRydActions';
import { confirmRydPlanAction, cancelRydByDriverAction, startRydAction, completeRydAction, revertToPlanningAction, revertToRydPlannedAction } from '@/actions/driverActions';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

interface RydDetailsPageParams { rideId: string; }

interface DisplayActiveRydData extends ActiveRyd {
  driverProfile?: UserProfileData;
  passengerProfiles?: UserProfileData[];
  eventName?: string;
}

const StatusBadge = ({ status }: { status: ARStatus }) => {
  const statusText = status.replace(/_/g, ' ');

  const getStatusClasses = () => {
    switch (status) {
      case ARStatus.COMPLETED:
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      case ARStatus.IN_PROGRESS_PICKUP:
      case ARStatus.IN_PROGRESS_ROUTE:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 animate-pulse';
      case ARStatus.CANCELLED_BY_DRIVER:
      case ARStatus.CANCELLED_BY_SYSTEM:
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      case ARStatus.RYD_PLANNED:
         return 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
      case ARStatus.PLANNING:
      case ARStatus.AWAITING_PASSENGERS:
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    }
  };

  return <Badge className={cn('border-transparent text-xs font-semibold capitalize', getStatusClasses())}>{statusText}</Badge>;
};


export default function LiveRydTrackingPage({ params: paramsPromise }: { params: Promise<RydDetailsPageParams> }) {
  const params = use(paramsPromise);
  const { rideId } = params || {};
  const { toast } = useToast();
  const { user: authUser, loading: authLoading, userProfile: authUserProfile } = useAuth();

  const [rydDetails, setRydDetails] = useState<DisplayActiveRydData | null>(null);
  const [isLoadingRyd, setIsLoadingRyd] = useState(true);
  const [rydError, setRydError] = useState<string | null>(null);
  const [isManagingRequest, setIsManagingRequest] = useState<Record<string, boolean>>({});
  const [isCancellingSpot, setIsCancellingSpot] = useState<Record<string, boolean>>({});
  const [isConfirmingRyd, setIsConfirmingRyd] = useState(false);
  const [isCancellingRydByDriver, setIsCancellingRydByDriver] = useState(false);
  const [isStartingRyd, setIsStartingRyd] = useState(false);
  const [isCompletingRyd, setIsCompletingRyd] = useState(false);
  const [isMarkingPickup, setIsMarkingPickup] = useState<Record<string, boolean>>({});
  const [isRevertingToPlanning, setIsRevertingToPlanning] = useState(false);
  const [isRevertingToRydPlanned, setIsRevertingToRydPlanned] = useState(false);
  const [isRevertingPickup, setIsRevertingPickup] = useState<Record<string, boolean>>({});
  
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rideId) {
      setRydError("Ryd ID is missing.");
      setIsLoadingRyd(false);
      return;
    }

    setIsLoadingRyd(true);
    setRydError(null);

    const rydDocRef = doc(db, "activeRydz", rideId);
    
    const unsubscribe = onSnapshot(rydDocRef, async (rydDocSnap) => {
      if (rydDocSnap.exists()) {
        let data = { id: rydDocSnap.id, ...rydDocSnap.data() } as DisplayActiveRydData;

        // Fetch related data
        if (data.driverId) {
          try {
            const driverDocRef = doc(db, "users", data.driverId);
            const driverDocSnap = await getDoc(driverDocRef);
            if (driverDocSnap.exists()) data.driverProfile = driverDocSnap.data() as UserProfileData;
          } catch (e) { console.warn(`Driver profile not found for ID: ${data.driverId}`); }
        }

        if (data.passengerManifest && data.passengerManifest.length > 0) {
          const passengerProfilePromises = data.passengerManifest.map(async (item) => {
            try {
              const userDocRef = doc(db, "users", item.userId);
              const userDocSnap = await getDoc(userDocRef);
              return userDocSnap.exists() ? userDocSnap.data() as UserProfileData : null;
            } catch (e) { return null; }
          });
          data.passengerProfiles = (await Promise.all(passengerProfilePromises)).filter(Boolean) as UserProfileData[];
        }

        if (data.associatedEventId) {
          try {
            const eventDocRef = doc(db, "events", data.associatedEventId);
            const eventDocSnap = await getDoc(eventDocRef);
            if (eventDocSnap.exists()) data.eventName = (eventDocSnap.data() as EventData).name;
          } catch (e) { console.warn(`Event not found for ID: ${data.associatedEventId}`); }
        }
        
        setRydDetails(data);
      } else {
        setRydError(`Ryd with ID "${rideId}" not found.`);
        setRydDetails(null);
      }
      setIsLoadingRyd(false);
    }, (error) => {
      console.error("Error listening to ryd details:", error);
      setRydError("Failed to listen for ryd updates. Please try again.");
      setIsLoadingRyd(false);
      toast({ title: "Error", description: "Could not get live ryd updates.", variant: "destructive" });
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [rideId, toast]);


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rydDetails?.messages]);


  useEffect(() => {
    if (rydDetails) {
      document.title = `Track Ryd: ${rydDetails.eventName || rydDetails.finalDestinationAddress || rideId} | MyRydz`;
    } else if (rydError) {
      document.title = `Error Loading Ryd | MyRydz`;
    } else if (rideId) {
       document.title = `Track Ryd: ${rideId} | MyRydz`;
    } else {
       document.title = `Track Ryd | MyRydz`;
    }
  }, [rydDetails, rydError, rideId]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser || !rideId || !newMessage.trim()) return;

    setIsSendingMessage(true);
    try {
        const result = await sendRydMessageAction({
            activeRydId: rideId,
            text: newMessage.trim(),
            senderUserId: authUser.uid,
        });

        if (result.success) {
            setNewMessage(""); // Clear input on success
        } else {
            toast({
                title: "Failed to Send",
                description: result.message,
                variant: "destructive",
            });
        }
    } catch (error: any) {
        toast({ title: "Error", description: `Client error: ${error.message}`, variant: "destructive" });
    } finally {
        setIsSendingMessage(false);
    }
  };

  const handleUpdatePassengerPickup = async (passengerUserId: string) => {
    if (!authUser || !rideId) return;
    setIsMarkingPickup(prev => ({ ...prev, [passengerUserId]: true }));
    try {
      const result = await updatePassengerPickupStatusAction({
        activeRydId: rideId,
        passengerUserId,
        actingUserId: authUser.uid
      });
      if (result.success) {
        toast({ title: "Status Updated", description: result.message });
      } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsMarkingPickup(prev => ({ ...prev, [passengerUserId]: false }));
    }
  };


  const handleManageRequest = async (passengerUserId: string, newStatus: PassengerManifestStatus.CONFIRMED_BY_DRIVER | PassengerManifestStatus.REJECTED_BY_DRIVER) => {
    if (!authUser || !rideId) {
      toast({ title: "Error", description: "Authentication or Ryd ID missing.", variant: "destructive" });
      return;
    }
    setIsManagingRequest(prev => ({ ...prev, [passengerUserId]: true }));
    try {
      const result = await managePassengerJoinRequestAction({
        activeRydId: rideId,
        passengerUserId,
        newStatus,
        actingUserId: authUser.uid,
      });

      if (result.success) {
        toast({ title: "Request Updated", description: result.message });
      } else {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsManagingRequest(prev => ({ ...prev, [passengerUserId]: false }));
    }
  };

  const handleCancelSpot = async (passengerUserIdToCancel: string) => {
    if (!authUser || !rideId) {
      toast({ title: "Error", description: "Authentication or Ryd ID missing.", variant: "destructive" });
      return;
    }
    setIsCancellingSpot(prev => ({ ...prev, [passengerUserIdToCancel]: true }));
    try {
      const result = await cancelPassengerSpotAction({
        activeRydId: rideId,
        passengerUserIdToCancel,
        cancellingUserId: authUser.uid,
      });

      if (result.success) {
        toast({ title: "Spot Cancelled", description: result.message });
      } else {
        toast({ title: "Cancellation Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsCancellingSpot(prev => ({ ...prev, [passengerUserIdToCancel]: false }));
    }
  };

  const handleConfirmRyd = async () => {
    if (!authUser || !rideId) return;
    setIsConfirmingRyd(true);
    try {
      const result = await confirmRydPlanAction({ activeRydId: rideId, driverUserId: authUser.uid });
      if (result.success) {
        toast({ title: "Ryd Confirmed!", description: result.message });
      } else {
        toast({ title: "Confirmation Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsConfirmingRyd(false);
    }
  };

  const handleCancelRydByDriver = async () => {
    if (!authUser || !rideId) return;
    setIsCancellingRydByDriver(true);
    try {
      const result = await cancelRydByDriverAction({ activeRydId: rideId, driverUserId: authUser.uid });
      if (result.success) {
        toast({ title: "Ryd Cancelled", description: result.message });
      } else {
        toast({ title: "Cancellation Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsCancellingRydByDriver(false);
    }
  };
  
  const handleStartRyd = async () => {
    if (!authUser || !rideId) return;
    setIsStartingRyd(true);
    try {
        const result = await startRydAction({ activeRydId: rideId, driverUserId: authUser.uid });
        if (result.success) {
            toast({ title: "Ryd Started!", description: result.message });
        } else {
            toast({ title: "Start Failed", description: result.message, variant: "destructive" });
        }
    } catch (e) {
        toast({ title: "Error", description: "An unexpected client error occurred.", variant: "destructive" });
    } finally {
        setIsStartingRyd(false);
    }
  };

  const handleCompleteRyd = async () => {
    if (!authUser || !rideId) return;
    setIsCompletingRyd(true);
    try {
        const result = await completeRydAction({ activeRydId: rideId, driverUserId: authUser.uid });
        if (result.success) {
            toast({ title: "Ryd Completed!", description: result.message });
        } else {
            toast({ title: "Completion Failed", description: result.message, variant: "destructive" });
        }
    } catch (e) {
        toast({ title: "Error", description: "An unexpected client error occurred.", variant: "destructive" });
    } finally {
        setIsCompletingRyd(false);
    }
  };

  const handleRevertToPlanning = async () => {
    if (!authUser || !rideId) return;
    setIsRevertingToPlanning(true);
    try {
      const result = await revertToPlanningAction({ activeRydId: rideId, driverUserId: authUser.uid });
      if (result.success) {
        toast({ title: "Status Reverted", description: result.message });
      } else {
        toast({ title: "Revert Failed", description: result.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
      setIsRevertingToPlanning(false);
    }
  };

  const handleRevertToRydPlanned = async () => {
    if (!authUser || !rideId) return;
    setIsRevertingToRydPlanned(true);
    try {
      const result = await revertToRydPlannedAction({ activeRydId: rideId, driverUserId: authUser.uid });
      if (result.success) {
        toast({ title: "Status Reverted", description: result.message });
      } else {
        toast({ title: "Revert Failed", description: result.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
      setIsRevertingToRydPlanned(false);
    }
  };
  
  const handleRevertPassengerPickup = async (passengerUserId: string) => {
    if (!authUser || !rideId) return;
    setIsRevertingPickup(prev => ({ ...prev, [passengerUserId]: true }));
    try {
      const result = await revertPassengerPickupAction({ activeRydId: rideId, passengerUserId, actingUserId: authUser.uid });
      if (result.success) {
        toast({ title: "Pickup Undone", description: result.message });
      } else {
        toast({ title: "Undo Failed", description: result.message, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "An unknown error occurred.", variant: "destructive" });
    } finally {
      setIsRevertingPickup(prev => ({ ...prev, [passengerUserId]: false }));
    }
  };

  if (isLoadingRyd || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading ryd details...</p>
      </div>
    );
  }

  if (rydError) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Ryd</h2>
        <p className="text-muted-foreground mb-4 px-4">{rydError}</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    );
  }
  
  if (!rydDetails) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-muted-foreground">Ryd details could not be loaded or found.</p>
            <Button asChild className="mt-4" variant="outline"><Link href="/dashboard">Go to Dashboard</Link></Button>
        </div>
    );
  }

  const proposedDepartureTime = rydDetails.proposedDepartureTime instanceof Timestamp ? rydDetails.proposedDepartureTime.toDate() : null;
  const twoHoursBeforeDeparture = proposedDepartureTime ? subHours(proposedDepartureTime, 2) : null;
  const canStartRyd = twoHoursBeforeDeparture && isAfter(new Date(), twoHoursBeforeDeparture);
  
  const plannedArrivalTime = rydDetails.plannedArrivalTime instanceof Timestamp ? rydDetails.plannedArrivalTime.toDate() : null;
  
  const driverName = rydDetails.driverProfile?.fullName || "Driver details pending";
  const driverAvatar = rydDetails.driverProfile?.avatarUrl || `https://placehold.co/100x100.png?text=${driverName.split(" ").map(n=>n[0]).join("")}`;
  const driverDataAiHint = rydDetails.driverProfile?.dataAiHint || "driver photo";
  
  const vehicleMake = rydDetails.vehicleDetails?.make || "";
  const vehicleModel = rydDetails.vehicleDetails?.model || "";
  const vehicleColor = rydDetails.vehicleDetails?.color || "";
  const vehicleLicense = rydDetails.vehicleDetails?.licensePlate || "";
  const vehiclePassengerCapacity = parseInt(rydDetails.vehicleDetails?.passengerCapacity || "0", 10);
  
  let vehicleDisplay = `${vehicleMake} ${vehicleModel}`.trim();
  if (vehicleColor) vehicleDisplay += `, ${vehicleColor}`;
  if (vehicleLicense) vehicleDisplay += ` (Plate: ${vehicleLicense})`;
  if (vehicleDisplay === "") vehicleDisplay = "Vehicle not specified";

  const isCurrentUserDriver = authUser?.uid === rydDetails.driverId;
  const pendingJoinRequests = rydDetails.passengerManifest.filter(
    p => p.status === PassengerManifestStatus.PENDING_DRIVER_APPROVAL
  );
  
  const activePassengerCount = rydDetails.passengerManifest.filter(p => 
    p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && 
    p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
    p.status !== PassengerManifestStatus.MISSED_PICKUP
  ).length;

  const displayedPassengers = rydDetails.passengerManifest.filter(item =>
    item.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
    item.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
    item.status !== PassengerManifestStatus.MISSED_PICKUP
  );
  
  let pageTitleElement: React.ReactNode;
  if (rydDetails.eventName && rydDetails.associatedEventId) {
    pageTitleElement = (
      <>
        Tracking Ryd to:{" "}
        <Link href={`/events/${rydDetails.associatedEventId}/rydz`} className="hover:underline">
          {rydDetails.eventName}
        </Link>
        {rydDetails.finalDestinationAddress && ` (at ${rydDetails.finalDestinationAddress})`}
      </>
    );
  } else if (rydDetails.eventName) {
    pageTitleElement = `Tracking Ryd to: ${rydDetails.eventName}${rydDetails.finalDestinationAddress ? ` (${rydDetails.finalDestinationAddress})` : ''}`;
  } else if (rydDetails.finalDestinationAddress) {
    pageTitleElement = `Tracking Ryd to: ${rydDetails.finalDestinationAddress}`;
  } else {
    pageTitleElement = `Tracking Ryd ID: ${rideId}`;
  }

  const isRydCancellableByDriver = ![ARStatus.COMPLETED, ARStatus.CANCELLED_BY_DRIVER, ARStatus.CANCELLED_BY_SYSTEM].includes(rydDetails.status);


  return (
    <>
      <PageHeader
        title={pageTitleElement}
        description={`Follow the progress of this ryd in real-time.`}
      />
      <div className="w-full max-w-2xl mx-auto space-y-6">
        {isCurrentUserDriver && (
          <Card className="shadow-lg">
              <CardHeader>
                  <CardTitle className="flex items-center"><Car className="mr-2 h-5 w-5" /> Driver Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                  {(rydDetails.status === ARStatus.PLANNING || rydDetails.status === ARStatus.AWAITING_PASSENGERS) && (
                      <div>
                          <Button onClick={handleConfirmRyd} disabled={isConfirmingRyd} className="w-full">
                              {isConfirmingRyd ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                              Confirm Ryd Plan
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1.5">This will lock the passenger list and prevent new requests.</p>
                      </div>
                  )}
                  {rydDetails.status === ARStatus.RYD_PLANNED && (
                    <div className="flex flex-col gap-2">
                      <Button onClick={handleStartRyd} disabled={isStartingRyd || !canStartRyd} className="w-full bg-blue-600 hover:bg-blue-700" title={!canStartRyd ? "Can be started up to 2 hours before departure" : "Start Ryd"}>
                          {isStartingRyd ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                          Start Ryd & Begin Pickups
                      </Button>
                      <Button onClick={handleRevertToPlanning} disabled={isRevertingToPlanning} variant="outline">
                          {isRevertingToPlanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
                          Return to Planning
                      </Button>
                    </div>
                  )}
                  {rydDetails.status === ARStatus.IN_PROGRESS_PICKUP && (
                    <Button onClick={handleRevertToRydPlanned} disabled={isRevertingToRydPlanned} variant="outline" className="w-full">
                        {isRevertingToRydPlanned ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                        Pause Ryd & Return to Plan
                    </Button>
                  )}
                  {rydDetails.status === ARStatus.IN_PROGRESS_ROUTE && (
                      <div>
                          <Button onClick={handleCompleteRyd} disabled={isCompletingRyd} className="w-full bg-green-600 hover:bg-green-700">
                              {isCompletingRyd ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                              Complete Ryd
                          </Button>
                      </div>
                  )}
                  {isRydCancellableByDriver && (
                    <div className="pt-4 border-t">
                      <Button
                        variant="destructive"
                        onClick={handleCancelRydByDriver}
                        disabled={isCancellingRydByDriver}
                        className="w-full"
                      >
                        {isCancellingRydByDriver ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                        Cancel This Entire Ryd
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1.5">This will cancel the ryd for all passengers.</p>
                    </div>
                  )}
                  {pendingJoinRequests.length > 0 && (
                     <div>
                          <h4 className="text-sm font-medium mb-2">Pending Join Requests ({pendingJoinRequests.length})</h4>
                          <div className="space-y-3">
                              {pendingJoinRequests.map(request => {
                                  const passengerProfile = rydDetails.passengerProfiles?.find(p => p.uid === request.userId);
                                  const passengerName = passengerProfile?.fullName || `User ${request.userId.substring(0,6)}...`;
                                  const passengerAvatar = passengerProfile?.avatarUrl || `https://placehold.co/40x40.png?text=${passengerName.split(" ").map(n=>n[0]).join("")}`;
                                  const passengerDataAiHint = passengerProfile?.dataAiHint || "person avatar";
                                  const isLoadingAction = isManagingRequest[request.userId];
                                  const earliestPickupTimestamp = request.earliestPickupTimestamp instanceof Timestamp ? request.earliestPickupTimestamp.toDate() : null;

                                  return (
                                      <div key={request.userId} className="p-3 border rounded-md">
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-2">
                                              <Avatar className="h-8 w-8">
                                                  <AvatarImage src={passengerAvatar} alt={passengerName} data-ai-hint={passengerDataAiHint} />
                                                  <AvatarFallback>{passengerName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                                              </Avatar>
                                              <Link href={`/profile/view/${request.userId}`} className="font-medium text-sm hover:underline">{passengerName}</Link>
                                              </div>
                                              <p className="text-xs text-muted-foreground">{request.requestedAt instanceof Timestamp ? format(request.requestedAt.toDate(), 'MMM d, p') : 'N/A'}</p>
                                          </div>
                                          {request.pickupAddress && <p className="text-xs text-muted-foreground mt-1 pl-10">Pickup: {request.pickupAddress}</p>}
                                          {earliestPickupTimestamp && <p className="text-xs text-muted-foreground mt-0.5 pl-10">Earliest Pickup: {format(earliestPickupTimestamp, 'p')}</p>}
                                          {request.notes && <p className="text-xs text-muted-foreground mt-0.5 pl-10">Notes: "{request.notes}"</p>}
                                          <div className="flex gap-2 mt-2 justify-end">
                                              <Button 
                                              size="sm" 
                                              variant="outline" 
                                              className="text-red-600 hover:bg-red-500/10 hover:text-red-700"
                                              onClick={() => handleManageRequest(request.userId, PassengerManifestStatus.REJECTED_BY_DRIVER)}
                                              disabled={isLoadingAction}
                                              >
                                              {isLoadingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1.5" />} Reject
                                              </Button>
                                              <Button 
                                              size="sm" 
                                              className="bg-green-600 hover:bg-green-700"
                                              onClick={() => handleManageRequest(request.userId, PassengerManifestStatus.CONFIRMED_BY_DRIVER)}
                                              disabled={isLoadingAction}
                                              >
                                              {isLoadingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />} Approve
                                              </Button>
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                     </div>
                  )}
              </CardContent>
          </Card>
        )}

        <Card className="shadow-lg">
          <CardHeader>
              <div className="flex items-center justify-between">
                  <CardTitle>Ryd Details</CardTitle>
                  <StatusBadge status={rydDetails.status} />
              </div>
              <CardDescription>Live and pending details for this carpool.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {rydDetails.driverId && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1">Driver</h4>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={driverAvatar} alt={driverName} data-ai-hint={driverDataAiHint} />
                    <AvatarFallback>{driverName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <div>
                    <Link href={`/profile/view/${rydDetails.driverId}`} className="font-semibold hover:underline">{driverName}</Link>
                    <p className="text-xs text-muted-foreground">{vehicleDisplay}</p>
                    <p className="text-xs text-muted-foreground">Capacity: {vehiclePassengerCapacity} seats</p>
                  </div>
                </div>
              </div>
            )}
            {proposedDepartureTime && (
               <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Clock className="h-4 w-4 mr-1.5" /> Proposed Departure</h4>
                <p className="font-semibold">{format(proposedDepartureTime, "PPP 'at' p")}</p>
              </div>
            )}
            {plannedArrivalTime && (
               <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><CalendarDays className="h-4 w-4 mr-1.5" /> Planned Arrival</h4>
                <p className="font-semibold">{format(plannedArrivalTime, "PPP 'at' p")}</p>
              </div>
            )}
            {rydDetails.startLocationAddress && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><MapPinIcon className="h-4 w-4 mr-1.5" /> From (Approx. Origin)</h4>
                <p>{rydDetails.startLocationAddress}</p>
              </div>
            )}
            {rydDetails.finalDestinationAddress && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Flag className="h-4 w-4 mr-1.5" /> To (Final Destination)</h4>
                <p>
                  {rydDetails.eventName && rydDetails.associatedEventId ? (
                    <>
                      <Link href={`/events/${rydDetails.associatedEventId}/rydz`} className="text-primary hover:underline">
                        {rydDetails.eventName}
                      </Link>
                      {rydDetails.finalDestinationAddress ? ` (at ${rydDetails.finalDestinationAddress})` : ''}
                    </>
                  ) : (
                    rydDetails.eventName || rydDetails.finalDestinationAddress
                  )}
                </p>
              </div>
            )}
            {rydDetails.notes && (
               <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Driver's Notes for this Ryd</h4>
                  <p className="text-sm bg-muted/50 p-2 rounded-md whitespace-pre-wrap">{rydDetails.notes}</p>
              </div>
            )}
            {rydDetails.passengerManifest && rydDetails.passengerManifest.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center"><Users className="h-4 w-4 mr-1.5" /> Passengers on this Ryd ({activePassengerCount} / {vehiclePassengerCapacity})</h4>
                {displayedPassengers.length > 0 ? (
                  <ul className="space-y-2">
                    {displayedPassengers.map((manifestItem) => {
                        const passengerProfile = rydDetails.passengerProfiles?.find(p => p.uid === manifestItem.userId);
                        const passengerName = passengerProfile?.fullName || `User ${manifestItem.userId.substring(0,6)}...`;
                        const isCurrentUserThisPassenger = authUser?.uid === manifestItem.userId;
                        const canCurrentUserManageThisPassenger = authUser && authUserProfile && authUserProfile.role === UserRole.PARENT && authUserProfile.managedStudentIds?.includes(manifestItem.userId);
                        const canCancel = (isCurrentUserThisPassenger || canCurrentUserManageThisPassenger);
                        
                        const cancellablePassengerStatuses: PassengerManifestStatus[] = [
                          PassengerManifestStatus.PENDING_DRIVER_APPROVAL,
                          PassengerManifestStatus.CONFIRMED_BY_DRIVER,
                          PassengerManifestStatus.AWAITING_PICKUP,
                        ];
                        const isPassengerStatusCancellable = cancellablePassengerStatuses.includes(manifestItem.status);

                        const nonCancellableRydStatuses: ARStatus[] = [
                          ARStatus.COMPLETED, ARStatus.CANCELLED_BY_DRIVER, ARStatus.CANCELLED_BY_SYSTEM,
                          ARStatus.IN_PROGRESS_ROUTE, ARStatus.IN_PROGRESS_PICKUP 
                        ];
                        const isRydStatusCancellable = !nonCancellableRydStatuses.includes(rydDetails.status);
                        
                        const isLoadingPickupAction = isMarkingPickup[manifestItem.userId];
                        const isLoadingUndoPickupAction = isRevertingPickup[manifestItem.userId];

                        return (
                          <li key={manifestItem.userId} className="p-3 border rounded-md bg-muted/20 flex flex-col gap-2">
                            <div className="space-y-0.5"> 
                              <div>
                                <Link href={`/profile/view/${manifestItem.userId}`} className="hover:underline text-sm font-medium">
                                    {passengerName}
                                </Link>
                                <span className="text-xs text-muted-foreground/80 ml-1 capitalize">({manifestItem.status.replace(/_/g, ' ')})</span>
                              </div>
                              {manifestItem.pickupAddress && <p className="text-xs text-muted-foreground">Pickup: {manifestItem.pickupAddress}</p>}
                              {manifestItem.notes && <p className="text-xs text-muted-foreground">Notes: "{manifestItem.notes}"</p>}
                            </div>
                            
                            <div className="flex justify-end items-center gap-2">
                              {isCurrentUserDriver && manifestItem.status === PassengerManifestStatus.ON_BOARD && rydDetails.status !== ARStatus.COMPLETED && (
                                  <Button size="sm" variant="outline" onClick={() => handleRevertPassengerPickup(manifestItem.userId)} disabled={isLoadingUndoPickupAction}>
                                    {isLoadingUndoPickupAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Undo2 className="mr-2 h-4 w-4" />} Undo Pickup
                                  </Button>
                              )}
                              {isCurrentUserDriver && rydDetails.status === ARStatus.IN_PROGRESS_PICKUP && manifestItem.status === PassengerManifestStatus.CONFIRMED_BY_DRIVER && (
                                <Button size="sm" onClick={() => handleUpdatePassengerPickup(manifestItem.userId)} disabled={isLoadingPickupAction}>
                                  {isLoadingPickupAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />} Mark Picked Up
                                </Button>
                              )}
                              {isCurrentUserThisPassenger && rydDetails.status === ARStatus.IN_PROGRESS_PICKUP && manifestItem.status === PassengerManifestStatus.CONFIRMED_BY_DRIVER && (
                                <Button size="sm" onClick={() => handleUpdatePassengerPickup(manifestItem.userId)} disabled={isLoadingPickupAction}>
                                  {isLoadingPickupAction ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />} I've Been Picked Up
                                </Button>
                              )}
                              {canCancel && isPassengerStatusCancellable && isRydStatusCancellable && (
                                <Button
                                  variant="outline"
                                  className="px-2 py-1 h-auto text-xs text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => handleCancelSpot(manifestItem.userId)}
                                  disabled={isCancellingSpot[manifestItem.userId]}
                                >
                                  {isCancellingSpot[manifestItem.userId] ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                                  <span className="ml-1">Cancel Spot</span>
                                </Button>
                              )}
                            </div>
                          </li>
                        );
                    })}
                  </ul>
                ) : (
                   <p className="text-xs text-muted-foreground">No active passengers currently listed.</p>
                )}
              </div>
            )}
            {(!rydDetails.passengerManifest || rydDetails.passengerManifest.length === 0) && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1 flex items-center"><Users className="h-4 w-4 mr-1.5" /> Passengers</h4>
                  <p className="text-sm text-muted-foreground">No passengers currently listed for this ryd.</p>
                </div>
            )}

            <Separator />
             <div className="text-xs text-muted-foreground pt-1">
              Live driver location is a future feature.
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg">
          <CardHeader>
              <CardTitle className="flex items-center"><MessageSquare className="mr-2 h-5 w-5" /> Ryd Chat</CardTitle>
          </CardHeader>
          <CardContent>
              <ScrollArea className="h-64 pr-4 border rounded-md p-2 flex flex-col">
                  {(rydDetails.messages && rydDetails.messages.length > 0) ? (
                      rydDetails.messages.map(msg => {
                          const isMyMessage = msg.senderId === authUser?.uid;
                          const senderAvatar = msg.senderAvatar || `https://placehold.co/40x40.png?text=${msg.senderName.split(" ").map(n=>n[0]).join("")}`;
                          return (
                              <div key={msg.id} className={cn("flex items-end gap-2 mb-3", isMyMessage && "justify-end")}>
                                  {!isMyMessage && (
                                      <Avatar className="h-8 w-8">
                                          <AvatarImage src={senderAvatar} alt={msg.senderName} />
                                          <AvatarFallback>{msg.senderName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                                      </Avatar>
                                  )}
                                  <div className={cn("max-w-xs rounded-lg px-3 py-2", isMyMessage ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                      {!isMyMessage && <p className="text-xs font-semibold mb-0.5">{msg.senderName}</p>}
                                      <p className="text-sm">{msg.text}</p>
                                      <p className="text-xs text-right mt-1 opacity-70">{format(msg.timestamp.toDate(), 'p')}</p>
                                  </div>
                                  {isMyMessage && (
                                      <Avatar className="h-8 w-8">
                                          <AvatarImage src={authUserProfile?.avatarUrl || ''} alt={msg.senderName} />
                                          <AvatarFallback>{msg.senderName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                                      </Avatar>
                                  )}
                              </div>
                          );
                      })
                  ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          No messages yet. Start the conversation!
                      </div>
                  )}
                  <div ref={chatEndRef} />
              </ScrollArea>
          </CardContent>
          <CardFooter>
              <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
                  <Input 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      disabled={isSendingMessage}
                  />
                  <Button type="submit" size="icon" disabled={isSendingMessage || !newMessage.trim()}>
                      {isSendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
              </form>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
