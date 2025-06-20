
"use client";

import React, { useState, useEffect, use, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { InteractiveMap } from "@/components/map/interactive-map";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, Car, Clock, Flag, UserCircle, MessageSquare, Loader2, MapPin as MapPinIcon, Users, CalendarDays, CheckCircle2, XCircle, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from '@/lib/firebase';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { type RydData, type UserProfileData, type ActiveRyd, type EventData, PassengerManifestStatus, UserRole, ActiveRydStatus as ARStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { managePassengerJoinRequestAction, cancelPassengerSpotAction } from '@/actions/activeRydActions';
import { Separator } from '@/components/ui/separator';

interface RydDetailsPageParams { rideId: string; }

interface DisplayActiveRydData extends ActiveRyd {
  driverProfile?: UserProfileData;
  passengerProfiles?: UserProfileData[]; // Ensure this holds profiles for manifest items
  eventName?: string; // From associated event
}

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


  const fetchRydDetails = useCallback(async (currentRydId: string) => {
    if (!currentRydId) {
      setRydError("Ryd ID is missing.");
      setIsLoadingRyd(false);
      return;
    }
    setIsLoadingRyd(true);
    setRydError(null);
    try {
      const rydDocRef = doc(db, "activeRydz", currentRydId); 
      const rydDocSnap = await getDoc(rydDocRef);

      if (rydDocSnap.exists()) {
        let data = { id: rydDocSnap.id, ...rydDocSnap.data() } as DisplayActiveRydData;

        if (data.driverId) {
          const driverDocRef = doc(db, "users", data.driverId);
          const driverDocSnap = await getDoc(driverDocRef);
          if (driverDocSnap.exists()) {
            data.driverProfile = driverDocSnap.data() as UserProfileData;
          } else {
            console.warn(`Driver profile not found for ID: ${data.driverId}`);
          }
        }

        if (data.passengerManifest && data.passengerManifest.length > 0) {
          const passengerProfilePromises = data.passengerManifest.map(async (item) => {
            try {
              const userDocRef = doc(db, "users", item.userId);
              const userDocSnap = await getDoc(userDocRef);
              return userDocSnap.exists() ? userDocSnap.data() as UserProfileData : null;
            } catch (passengerError) {
              console.error(`Error fetching passenger profile for ID ${item.userId}:`, passengerError);
              return null;
            }
          });
          data.passengerProfiles = (await Promise.all(passengerProfilePromises)).filter(Boolean) as UserProfileData[];
        }

        if (data.associatedEventId) {
          const eventDocRef = doc(db, "events", data.associatedEventId);
          const eventDocSnap = await getDoc(eventDocRef);
          if (eventDocSnap.exists()) {
            data.eventName = (eventDocSnap.data() as EventData).name;
          }
        }
        
        setRydDetails(data);
      } else {
        setRydError(`Ryd with ID "${currentRydId}" not found.`);
        setRydDetails(null);
      }
    } catch (e) {
      console.error("Error fetching ryd details:", e);
      setRydError("Failed to load ryd details. Please try again.");
      toast({ title: "Error", description: "Could not load ryd information.", variant: "destructive" });
    } finally {
      setIsLoadingRyd(false);
    }
  }, [toast]);

  useEffect(() => {
    if (rideId) {
      fetchRydDetails(rideId);
    }
  }, [rideId, fetchRydDetails]);

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
        fetchRydDetails(rideId); // Refresh details
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
        fetchRydDetails(rideId); // Refresh details
      } else {
        toast({ title: "Cancellation Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `An unexpected error occurred: ${error.message}`, variant: "destructive" });
    } finally {
      setIsCancellingSpot(prev => ({ ...prev, [passengerUserIdToCancel]: false }));
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

  const mapMarkers = [];
  if (rydDetails.startLocationAddress) mapMarkers.push({id: 'origin', position: {lat: 35.0456, lng: -85.3097}, title: `From: ${rydDetails.startLocationAddress}` }); // Using placeholder lat/lng
  if (rydDetails.finalDestinationAddress) mapMarkers.push({id: 'destination', position: {lat: 35.0550, lng: -85.2900}, title: `To: ${rydDetails.finalDestinationAddress}`}); // Using placeholder lat/lng

  const proposedDepartureTime = rydDetails.proposedDepartureTime instanceof Timestamp ? rydDetails.proposedDepartureTime.toDate() : null;
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


  return (
    <>
      <PageHeader
        title={pageTitleElement}
        description={`Follow the progress of this ryd in real-time.`}
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InteractiveMap
            className="h-[400px] lg:h-full"
            markers={mapMarkers}
            defaultCenterLat={mapMarkers[0]?.position.lat || 35.0456}
            defaultCenterLng={mapMarkers[0]?.position.lng || -85.3097}
            defaultZoom={12}
          />
        </div>
        <div className="lg:col-span-1">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Ryd Details</CardTitle>
              <CardDescription>Status: <span className="font-semibold text-primary capitalize">{rydDetails.status.replace(/_/g, ' ')}</span></CardDescription>
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

                          return (
                            <li key={manifestItem.userId} className="p-3 border rounded-md bg-muted/20 flex flex-col">
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
                              
                              {canCancel && isPassengerStatusCancellable && isRydStatusCancellable && (
                                <div className="mt-2 flex justify-end">
                                  <Button
                                    variant="outline"
                                    className="px-2 py-1 h-auto text-xs text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={() => handleCancelSpot(manifestItem.userId)}
                                    disabled={isCancellingSpot[manifestItem.userId]}
                                  >
                                    {isCancellingSpot[manifestItem.userId] ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3 w-3" />}
                                    <span className="ml-1">Cancel Spot</span>
                                  </Button>
                                </div>
                              )}
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

              <Button variant="outline" className="w-full" asChild>
                <Link href={`/messages/new?activeRydId=${rideId}&context=rydParticipants`}>
                  <MessageSquare className="mr-2 h-4 w-4" /> Message Ryd Participants
                </Link>
              </Button>
               <div className="text-xs text-muted-foreground pt-4 border-t">
                Map and ETA are estimates. Live driver location is a future feature.
              </div>
            </CardContent>
          </Card>

          {isCurrentUserDriver && pendingJoinRequests.length > 0 && (
            <Card className="shadow-lg mt-6">
              <CardHeader>
                <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-amber-600" /> Pending Join Requests ({pendingJoinRequests.length})</CardTitle>
                <CardDescription>Review and respond to passengers who want to join this ryd.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
                         <p className="text-xs text-muted-foreground">Requested: {request.requestedAt instanceof Timestamp ? format(request.requestedAt.toDate(), 'MMM d, p') : 'N/A'}</p>
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
              </CardContent>
            </Card>
          )}
           {isCurrentUserDriver && pendingJoinRequests.length === 0 && rydDetails.passengerManifest.length > 0 && (
             <Card className="shadow-lg mt-6">
               <CardHeader>
                <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" /> Join Requests</CardTitle>
               </CardHeader>
               <CardContent>
                <p className="text-sm text-muted-foreground">No pending join requests for this ryd at the moment.</p>
               </CardContent>
             </Card>
           )}

        </div>
      </div>
    </>
  );
}


    