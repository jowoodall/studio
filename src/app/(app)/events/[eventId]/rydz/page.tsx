

"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays, Car, PlusCircle, AlertTriangle, Users, Check, X, Info, UserCircle2, Star,
  CheckCircle2, Loader2, MapPin as MapPinIcon, Clock, MapPinned, ThumbsUp, UserPlus, Flag, UserCheck, Edit, ShieldCheck, ArrowRight, ArrowLeft
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { EventData, UserProfileData, RydData, RydStatus, ActiveRyd, PassengerManifestItem, DisplayActiveRyd, DisplayRydRequestData } from "@/types";
import { PassengerManifestStatus, UserRole, ActiveRydStatus, RydDirection } from "@/types";
import { format } from 'date-fns';
import { useAuth } from "@/context/AuthContext";
import { requestToJoinActiveRydAction, fulfillRequestWithExistingRydAction } from "@/actions/activeRydActions";
import { getEventRydzPageDataAction } from "@/actions/eventActions";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";

interface ResolvedPageParams { eventId: string; }

export default function EventRydzPage({ params: paramsPromise }: { params: Promise<ResolvedPageParams> }) {
  const resolvedParams = use(paramsPromise);
  const { eventId } = resolvedParams || {};
  const { toast } = useToast();
  const { user: authUser, userProfile: authUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [eventDetails, setEventDetails] = useState<EventData | null>(null);
  const [eventManagers, setEventManagers] = useState<UserProfileData[]>([]);
  const [activeRydzList, setActiveRydzList] = useState<DisplayActiveRyd[]>([]);
  const [rydRequestsList, setRydRequestsList] = useState<DisplayRydRequestData[]>([]);
  
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  
  const [isFulfillingWithExisting, setIsFulfillingWithExisting] = useState<Record<string, boolean>>({});

  const [addPassengerPopoverOpen, setAddPassengerPopoverOpen] = useState<Record<string, boolean>>({});
  const [isAddingPassenger, setIsAddingPassenger] = useState<Record<string, boolean>>({});


  const fetchPageData = useCallback(async () => {
    if (!eventId) {
      setPageError("Event ID is missing.");
      setIsLoadingPage(false);
      return;
    }
    setIsLoadingPage(true);
    setPageError(null);
    try {
      const result = await getEventRydzPageDataAction(eventId);
      if (result.success && result.data) {
        setEventDetails(result.data.eventDetails);
        setEventManagers(result.data.eventManagers);
        setActiveRydzList(result.data.activeRydzList);
        setRydRequestsList(result.data.rydRequestsList);

      } else {
        throw new Error(result.message || "Failed to load event page data.");
      }
    } catch (e: any) {
      console.error("Error fetching event page data:", e);
      setPageError("Failed to load event data. " + (e.message || ""));
      toast({ title: "Error", description: "Could not load event information.", variant: "destructive" });
    } finally {
      setIsLoadingPage(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if(!authLoading) {
      fetchPageData();
    }
  }, [fetchPageData, authLoading]);

  const handleRequestSeatForUser = useCallback(async (activeRydId: string, userId: string, userName: string) => {
    if (!authUser) {
      toast({ title: "Not Logged In", description: "You need to be logged in to request a ryd.", variant: "destructive" });
      return;
    }

    setIsAddingPassenger(prev => ({ ...prev, [userId]: true }));
    let success = false;
    let message = '';
    let serverRydId: string | undefined = undefined;

    try {
      const result = await requestToJoinActiveRydAction({
        activeRydId,
        passengerUserId: userId,
        requestedByUserId: authUser.uid,
      });
      success = result.success;
      message = result.message;
      serverRydId = result.rydId;

      if (success) {
        toast({ title: "Request Sent!", description: `Request for ${userName} to join has been sent.` });
        if (eventId) fetchPageData();
        setAddPassengerPopoverOpen(prev => ({ ...prev, [activeRydId]: false }));

        if (serverRydId && eventId) {
          router.push(`/rydz/request?eventId=${eventId}&activeRydId=${serverRydId}&passengerId=${userId}&context=joinOffer`);
        }
      } else {
        toast({ title: "Request Failed", description: message, variant: "destructive" });
      }
    } catch (error: any) {
      message = `An unexpected error occurred: ${error.message || "Unknown client error"}`;
      console.error("[EventRydzPage] Client-side error calling requestToJoinActiveRydAction:", error);
      toast({ title: "Request Failed", description: message, variant: "destructive" });
    } finally {
      setIsAddingPassenger(prev => ({ ...prev, [userId]: false }));
    }
  }, [authUser, eventId, fetchPageData, toast, router]);

  const handleFulfillWithExistingRyd = async (rydRequestId: string, existingActiveRydId: string) => {
    if (!authUser) {
      toast({ title: "Error", description: "Authentication missing.", variant: "destructive" });
      return;
    }
    setIsFulfillingWithExisting(prev => ({ ...prev, [rydRequestId]: true }));
    try {
      const result = await fulfillRequestWithExistingRydAction({
        rydRequestId,
        existingActiveRydId,
        driverUserId: authUser.uid,
      });
      if (result.success && result.activeRydId) {
        toast({ title: "Request Fulfilled!", description: result.message });
        fetchPageData();
        router.push('/rydz/tracking/' + result.activeRydId);
      } else {
        toast({ title: "Fulfillment Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: 'An unexpected error occurred: ' + error.message, variant: "destructive" });
    } finally {
      setIsFulfillingWithExisting(prev => ({ ...prev, [rydRequestId]: false }));
    }
  };


  const isLoading = authLoading || isLoadingPage;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading event data...</p>
      </div>
    );
  }

  if (pageError || !eventDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">{pageError ? "Error Loading Event" : "Event Not Found"}</h2>
        <p className="text-muted-foreground px-4">{pageError || 'The event with ID "' + (resolvedParams?.eventId || 'unknown') + '" could not be found.'}</p>
        <Button asChild className="mt-4">
          <Link href="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }

  // --- Robust Date Handling ---
  const eventDate = eventDetails.eventStartTimestamp ? new Date(eventDetails.eventStartTimestamp as any) : null;
  const eventEndDate = eventDetails.eventEndTimestamp ? new Date(eventDetails.eventEndTimestamp as any) : null;
  const isEventDateValid = eventDate && !isNaN(eventDate.getTime());
  const isEventEndDateValid = eventEndDate && !isNaN(eventEndDate.getTime());
  // --- End Robust Date Handling ---
  
  const redirectBackUrl = '/events/' + eventId + '/rydz';
  const isEventManager = authUser && eventDetails.managerIds?.includes(authUser.uid);

  return (
    <>
      <PageHeader
        title={'Rydz for: ' + eventDetails.name}
        description={`Coordinate carpools for this event or request a ryd below.`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            {isEventManager && (
              <Button variant="secondary" asChild>
                <Link href={`/events/${eventId}/edit`}>
                  <Edit className="mr-2 h-4 w-4" /> Edit Event
                </Link>
              </Button>
            )}
            <Button asChild>
              <Link href={'/rydz/request?eventId=' + eventId + '&redirectUrl=' + encodeURIComponent(redirectBackUrl)}>
                <span className="flex items-center">
                  <PlusCircle className="mr-2 h-4 w-4" /> Request Ryd
                </span>
              </Link>
            </Button>
            <Button variant="outline" asChild>
                <Link href={'/events/' + eventId + '/offer-drive'}>
                    <Car className="mr-2 h-4 w-4" /> Offer a Ryd
                </Link>
            </Button>
          </div>
        }
      />

      {eventManagers.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-sm font-medium text-muted-foreground">Managed by:</p>
          <div className="flex flex-wrap gap-4">
            {eventManagers.map(manager => (
              <div key={manager.uid} className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={manager.avatarUrl} alt={manager.fullName} />
                  <AvatarFallback className="text-xs">{manager.fullName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <Link href={`/profile/view/${manager.uid}`} className="text-sm font-semibold hover:underline">{manager.fullName}</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      <Card className="mb-6 shadow-lg">
        <CardHeader className="p-4">
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm p-4 pt-0">
          <div className="flex items-start gap-3">
            <MapPinIcon className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground">Location</p>
              <p className="font-semibold">{eventDetails.location}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CalendarDays className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground">Starts</p>
              <p className="font-semibold">{isEventDateValid ? format(eventDate, "PPP 'at' p") : 'Date TBD'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground">Planned End</p>
              <p className="font-semibold">{isEventEndDateValid ? format(eventEndDate, "PPP 'at' p") : 'Date TBD'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-8"/>

      <h3 className="font-headline text-xl font-semibold text-primary mt-8 mb-4">Offered Rydz ({activeRydzList.length})</h3>
      <div className="space-y-4">
        {activeRydzList.length > 0 ? (
          activeRydzList.map((activeRyd) => {
            const driverName = activeRyd.driverProfile?.fullName || "Unknown Driver";
            const driverAvatar = activeRyd.driverProfile?.avatarUrl || 'https://placehold.co/100x100.png?text=' + driverName.split(" ").map(n=>n[0]).join("");
            const driverDataAiHint = activeRyd.driverProfile?.dataAiHint || "driver photo";

            const vehicleMake = activeRyd.vehicleDetails?.make || "";
            const vehicleModel = activeRyd.vehicleDetails?.model || "";
            let vehicleDisplay = (vehicleMake + ' ' + vehicleModel).trim();
            if (vehicleDisplay === "") vehicleDisplay = "Vehicle not specified";
            const vehiclePassengerCapacity = parseInt(activeRyd.vehicleDetails?.passengerCapacity || "0", 10);
            
            const proposedDeparture = activeRyd.proposedDepartureTime ? new Date(activeRyd.proposedDepartureTime as any) : null;
            const plannedArrival = activeRyd.plannedArrivalTime ? new Date(activeRyd.plannedArrivalTime as any) : null;
            const actualDeparture = activeRyd.actualDepartureTime ? new Date(activeRyd.actualDepartureTime as any) : null;
            const displayDepartureTime = actualDeparture || proposedDeparture;
            const timeRange = displayDepartureTime && plannedArrival 
                              ? `${format(displayDepartureTime, "p")} - ${format(plannedArrival, "p")}` 
                              : 'Time TBD';

            const currentActivePassengers = activeRyd.passengerManifest.filter(
              p => p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
                   p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
                   p.status !== PassengerManifestStatus.MISSED_PICKUP
            ).length;
            
            const displayedPassengers = activeRyd.passengerManifest.filter(item =>
              item.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
              item.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
              item.status !== PassengerManifestStatus.MISSED_PICKUP
            );

            const isRydFull = currentActivePassengers >= vehiclePassengerCapacity;
            const joinableStatuses = [ActiveRydStatus.PLANNING, ActiveRydStatus.AWAITING_PASSENGERS];
            const isRydJoinableStatus = joinableStatuses.includes(activeRyd.status);
            const isCurrentUserTheDriverOfThisRyd = authUser?.uid === activeRyd.driverId;

            const hasCurrentUserRequested = authUser ? activeRyd.passengerManifest.some(
              p => p.userId === authUser.uid &&
                   p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
                   p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER
            ) : false;

            const isCurrentUserParent = authUserProfile?.role === UserRole.PARENT;
            const studentsNotOnRyd = isCurrentUserParent ? (authUserProfile.managedStudentIds || []).filter(
              studentId => !activeRyd.passengerManifest.some(p =>
                p.userId === studentId &&
                p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
                p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER
              )
            ).map(studentId => authUserProfile.passengerProfiles?.find(p => p.uid === studentId)).filter(Boolean) as UserProfileData[] : [];

            const peopleToAddList: { id: string, fullName: string }[] = isCurrentUserParent ? studentsNotOnRyd.map(s => ({id: s.uid, fullName: s.fullName})) : [];
            if (isCurrentUserParent && !hasCurrentUserRequested && !isCurrentUserTheDriverOfThisRyd) {
                peopleToAddList.unshift({ id: authUser!.uid, fullName: `${authUserProfile.fullName} (Me)` });
            }
            const canParentAddSomeone = isCurrentUserParent && peopleToAddList.length > 0 && isRydJoinableStatus && !isRydFull;
            
            const canStudentRequestToJoin = authUserProfile?.role === UserRole.STUDENT && isRydJoinableStatus && !isRydFull && !hasCurrentUserRequested && !isCurrentUserTheDriverOfThisRyd;
            const directionIsToEvent = activeRyd.direction === RydDirection.TO_EVENT;

            return (
            <Card key={activeRyd.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="p-3">
                  <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-8 w-8">
                              <AvatarImage src={driverAvatar} alt={driverName} data-ai-hint={driverDataAiHint}/>
                              <AvatarFallback>{driverName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                              <Link href={'/profile/view/' + activeRyd.driverId} className="font-semibold text-sm hover:underline truncate block">{driverName}</Link>
                              <p className="text-xs text-muted-foreground truncate">{vehicleDisplay}</p>
                          </div>
                      </div>
                      <Badge variant="outline" className="w-fit capitalize flex-shrink-0 text-xs">{activeRyd.status.replace(/_/g, ' ')}</Badge>
                  </div>
              </CardHeader>
              <CardContent className="flex-grow pt-2 pb-3 px-3 space-y-2">
                <div className="flex items-center justify-center text-xs font-semibold p-1.5 bg-muted/50 rounded-md">
                    {directionIsToEvent ? <ArrowRight className="mr-2 h-4 w-4 text-green-600"/> : <ArrowLeft className="mr-2 h-4 w-4 text-blue-600"/>}
                    Ryd {directionIsToEvent ? "to" : "from"} event
                </div>
                <div className="text-xs text-muted-foreground flex flex-col gap-1 border-t pt-2">
                    <div className="flex items-center"> <Clock className="mr-1.5 h-4 w-4 flex-shrink-0" /> <span>{timeRange}</span> </div>
                    <div className="flex items-center"> <Users className="mr-1.5 h-4 w-4 flex-shrink-0" /> <span>{vehiclePassengerCapacity - currentActivePassengers} seat(s) open</span> </div>
                </div>

                {displayedPassengers.length > 0 && (
                    <div className="pt-1">
                        <h4 className="text-xs font-semibold text-muted-foreground">Passengers ({currentActivePassengers}/{vehiclePassengerCapacity}):</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {displayedPassengers.map(pItem => {
                                const passengerProfile = activeRyd.passengerProfiles?.find(pp => pp.uid === pItem.userId);
                                return (
                                <Badge key={pItem.userId} variant="secondary" className="font-normal text-xs gap-1">
                                    <UserCircle2 className="h-3 w-3"/>
                                    {passengerProfile?.fullName || 'User...'}
                                </Badge>
                                );
                            })}
                        </div>
                    </div>
                )}
              </CardContent>
              <CardFooter className="border-t p-3 flex flex-col gap-2">
                <Button type="button" variant="default" size="sm" className="w-full" asChild>
                  <Link href={'/rydz/tracking/' + activeRyd.id}>
                    View Details / Manage
                  </Link>
                </Button>

                {canStudentRequestToJoin && (
                   <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-green-600 border-green-500 hover:bg-green-500/10 hover:text-green-700"
                    onClick={() => handleRequestSeatForUser(activeRyd.id, authUser!.uid, authUserProfile!.fullName)}
                    disabled={isAddingPassenger[authUser!.uid]}
                  >
                    {isAddingPassenger[authUser!.uid] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                    Request to Join Ryd
                  </Button>
                )}

                {canParentAddSomeone && (
                  <Popover open={addPassengerPopoverOpen[activeRyd.id] || false} onOpenChange={(isOpen) => setAddPassengerPopoverOpen(p => ({...p, [activeRyd.id]: isOpen}))}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Join Ryd / Add Passenger
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Select passenger..." />
                        <CommandList>
                          <CommandEmpty>No available passengers.</CommandEmpty>
                          <CommandGroup>
                            {peopleToAddList.map((person) => {
                              const passengerIsBeingAdded = isAddingPassenger[person.id];
                              return (
                                <CommandItem
                                  key={person.id}
                                  value={person.fullName}
                                  onSelect={() => handleRequestSeatForUser(activeRyd.id, person.id, person.fullName)}
                                  disabled={passengerIsBeingAdded}
                                  className="flex justify-between items-center"
                                >
                                  {person.fullName}
                                  {passengerIsBeingAdded && <Loader2 className="h-4 w-4 animate-spin" />}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}

                {hasCurrentUserRequested && (
                  <Button type="button" variant="outline" size="sm" className="w-full" disabled>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500"/> Request Sent / On Ryd
                  </Button>
                )}
                {isRydFull && !hasCurrentUserRequested && !isCurrentUserTheDriverOfThisRyd && (
                  <Button type="button" variant="outline" size="sm" className="w-full" disabled>
                      <Info className="mr-2 h-4 w-4 text-orange-500"/> Ryd is Full
                  </Button>
                )}
                {!isRydJoinableStatus && !hasCurrentUserRequested && !isCurrentUserTheDriverOfThisRyd && (
                  <Button type="button" variant="outline" size="sm" className="w-full" disabled>
                      <Info className="mr-2 h-4 w-4 text-muted-foreground"/> Not Accepting Passengers
                  </Button>
                )}
              </CardFooter>
            </Card>
          )})
        ) : (
          <Card className="text-center py-12 shadow-md">
            <CardHeader>
              <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="font-headline text-2xl">No Rydz Offered Yet</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-6">
                There are currently no specific rydz offered by drivers for {eventDetails.name}.
              </CardDescription>
              <Button variant="outline" asChild>
                  <Link href={'/events/' + eventId + '/offer-drive'}>
                      <Car className="mr-2 h-4 w-4" /> Offer Your Ryd
                  </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <h3 className="font-headline text-xl font-semibold text-primary mt-8 mb-4">Requested Rydz ({rydRequestsList.length})</h3>
       <div className="space-y-4">
        {rydRequestsList.length > 0 ? (
          rydRequestsList.map((request) => {
            const primaryPassenger = request.passengerUserProfiles && request.passengerUserProfiles.length > 0 
                                     ? request.passengerUserProfiles[0] 
                                     : null;
            const displayNamer = primaryPassenger 
                                 ? primaryPassenger.fullName 
                                 : request.requesterProfile?.fullName || "A User";
            const displayAvatar = primaryPassenger 
                                  ? primaryPassenger.avatarUrl 
                                  : request.requesterProfile?.avatarUrl || 'https://placehold.co/100x100.png?text=' + displayNamer.split(" ").map(n=>n[0]).join("");
            const displayAvatarHint = primaryPassenger 
                                      ? primaryPassenger.dataAiHint 
                                      : request.requesterProfile?.dataAiHint || "user photo";
            const profileLinkUid = primaryPassenger ? primaryPassenger.uid : request.requestedBy;

            let cardSubtitle = "Requested a Ryd";
            if (primaryPassenger && request.passengerUserProfiles!.length > 1) {
                const otherPassengersCount = request.passengerUserProfiles!.length - 1;
                cardSubtitle = 'Ryd for ' + primaryPassenger.fullName + ' & ' + otherPassengersCount + ' other' + (otherPassengersCount > 1 ? 's' : '');
                 if (request.requesterProfile && request.requesterProfile.uid !== primaryPassenger.uid) {
                    cardSubtitle += ' (By ' + request.requesterProfile.fullName + ')';
                }
            } else if (primaryPassenger) {
                cardSubtitle = 'Ryd for ' + primaryPassenger.fullName;
                if (request.requesterProfile && request.requesterProfile.uid !== primaryPassenger.uid) {
                    cardSubtitle += ' (By ' + request.requesterProfile.fullName + ')';
                }
            } else if (request.requesterProfile) {
                cardSubtitle = 'Requested by ' + request.requesterProfile.fullName;
            }


            const rydDateTime = request.rydTimestamp ? new Date(request.rydTimestamp as any) : null;
            const earliestPickup = request.earliestPickupTimestamp ? new Date(request.earliestPickupTimestamp as any) : null;
            const canCurrentUserOfferToFulfill = authUserProfile?.canDrive;

            let suitableExistingActiveRydId: string | null = null;
            if (authUserProfile?.canDrive && authUser?.uid && request.passengerUserProfiles) {
                const foundRyd = activeRydzList.find(ar => 
                    ar.driverId === authUser.uid &&
                    ar.associatedEventId === eventId &&
                    (ar.status === ActiveRydStatus.PLANNING || ar.status === ActiveRydStatus.AWAITING_PASSENGERS) &&
                    (parseInt(ar.vehicleDetails?.passengerCapacity || "0", 10) - 
                     ar.passengerManifest.filter(p => 
                        p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER && 
                        p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER &&
                        p.status !== PassengerManifestStatus.MISSED_PICKUP
                     ).length) >= request.passengerUserProfiles.length
                );
                if (foundRyd) {
                    suitableExistingActiveRydId = foundRyd.id;
                }
            }
            const fulfillmentLoading = isFulfillingWithExisting[request.id];
             const directionIsToEvent = request.direction === RydDirection.TO_EVENT;

            return (
            <Card key={request.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="p-3">
                 <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={displayAvatar} alt={displayNamer} data-ai-hint={displayAvatarHint}/>
                            <AvatarFallback>{displayNamer.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <Link href={'/profile/view/' + profileLinkUid} className="font-semibold text-sm hover:underline truncate block">{displayNamer}</Link>
                            <p className="text-xs text-muted-foreground truncate">{cardSubtitle}</p>
                        </div>
                    </div>
                     <Badge variant="outline" className="w-fit capitalize flex-shrink-0 text-xs">{request.status.replace(/_/g, ' ')}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-grow pt-2 pb-3 px-3 space-y-2">
                 <div className="flex items-center justify-center text-xs font-semibold p-1.5 bg-muted/50 rounded-md">
                     {directionIsToEvent ? <ArrowRight className="mr-2 h-4 w-4 text-green-600"/> : <ArrowLeft className="mr-2 h-4 w-4 text-blue-600"/>}
                     Ryd {directionIsToEvent ? "to" : "from"} event
                   </div>
                 <div className="text-xs text-muted-foreground flex flex-col gap-1 border-t pt-2">
                    <div className="flex items-center">
                      <CalendarDays className="mr-1.5 h-4 w-4 flex-shrink-0" />
                      <span>{rydDateTime ? format(rydDateTime, "p") : 'TBD'}</span>
                    </div>
                    {request.pickupLocation && (
                        <div className="flex items-center">
                           <MapPinIcon className="mr-1.5 h-4 w-4 flex-shrink-0" /> 
                           <span className="truncate">{request.pickupLocation}</span>
                        </div>
                    )}
                 </div>

                {request.passengerUserProfiles && request.passengerUserProfiles.length > 0 && (
                    <div className="pt-1">
                        <h4 className="text-xs font-semibold text-muted-foreground">Passengers ({request.passengerUserProfiles.length}):</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {request.passengerUserProfiles.map(p => (
                                <Badge key={p.uid} variant="secondary" className="font-normal text-xs gap-1">
                                    <UserCircle2 className="h-3 w-3"/>
                                    {p.fullName || 'User...'}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
              </CardContent>
              <CardFooter className="border-t p-3">
                {canCurrentUserOfferToFulfill ? (
                    suitableExistingActiveRydId ? (
                        <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="w-full"
                            onClick={() => handleFulfillWithExistingRyd(request.id, suitableExistingActiveRydId!)}
                            disabled={fulfillmentLoading}
                        >
                            {fulfillmentLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                            Add to My Ryd
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full"
                            asChild
                        >
                            <Link href={'/events/' + eventId + '/offer-drive?requestId=' + request.id}>
                                <ThumbsUp className="mr-2 h-4 w-4" /> Offer to Fulfill (New Ryd)
                            </Link>
                        </Button>
                    )
                ) : (
                     <Button type="button" variant="outline" size="sm" className="w-full" disabled>
                        <Car className="mr-2 h-4 w-4 text-muted-foreground"/> (Drivers can offer to fulfill)
                    </Button>
                )}
              </CardFooter>
            </Card>
          )})
        ) : (
          <Card className="text-center py-12 shadow-md">
            <CardHeader>
              <UserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="font-headline text-2xl">No Ryd Requests Yet</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-6">
                There are currently no ryd requests for {eventDetails.name}.
              </CardDescription>
              <Button asChild>
                 <Link href={'/rydz/request?eventId=' + eventId + '&redirectUrl=' + encodeURIComponent(redirectBackUrl)}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Be the First to Request
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
