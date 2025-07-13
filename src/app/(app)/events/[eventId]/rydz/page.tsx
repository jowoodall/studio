
"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays, Car, PlusCircle, AlertTriangle, Users, Check, X, Info, UserCircle2, Star,
  CheckCircle2, Loader2, MapPin as MapPinIcon, Clock, MapPinned, ThumbsUp, UserPlus, Flag, UserCheck, Edit, ShieldCheck
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, Timestamp, collection, query, getDocs, setDoc, serverTimestamp, where, orderBy } from "firebase/firestore";
import type { EventData, GroupData, UserProfileData, RydData, RydStatus, ActiveRyd, PassengerManifestItem, DisplayActiveRyd, DisplayRydRequestData } from "@/types";
import { PassengerManifestStatus, UserRole, ActiveRydStatus } from "@/types";
import { format } from 'date-fns';
import { useAuth } from "@/context/AuthContext";
import { requestToJoinActiveRydAction, fulfillRequestWithExistingRydAction } from "@/actions/activeRydActions";
import { getEventRydzPageDataAction } from "@/actions/eventActions";
import { useRouter } from "next/navigation";

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

  const [allFetchedGroups, setAllFetchedGroups] = useState<GroupData[]>([]);
  const [isLoadingAllGroups, setIsLoadingAllGroups] = useState(true);

  const [isFulfillingWithExisting, setIsFulfillingWithExisting] = useState<Record<string, boolean>>({});

  const [managedStudents, setManagedStudents] = useState<UserProfileData[]>([]);
  const [isLoadingManagedStudents, setIsLoadingManagedStudents] = useState(true);
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

  const fetchAllGroups = useCallback(async () => {
    setIsLoadingAllGroups(true);
    try {
      const groupsCollectionQuery = query(collection(db, "groups"));
      const querySnapshot = await getDocs(groupsCollectionQuery);
      const fetchedGroups: GroupData[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedGroups.push({ id: docSnap.id, ...docSnap.data() } as GroupData);
      });
      setAllFetchedGroups(fetchedGroups);
    } catch (error) {
      console.error("Error fetching all groups:", error);
      toast({
        title: "Error",
        description: "Could not fetch list of all groups for selection.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAllGroups(false);
    }
  }, [toast]);

  const fetchManagedStudents = useCallback(async () => {
    if (authUserProfile?.role !== UserRole.PARENT || !authUserProfile.managedStudentIds?.length) {
      setIsLoadingManagedStudents(false);
      setManagedStudents([]);
      return;
    }
    setIsLoadingManagedStudents(true);
    try {
      const studentPromises = authUserProfile.managedStudentIds.map(async (studentId) => {
        const studentDocRef = doc(db, "users", studentId);
        const studentDocSnap = await getDoc(studentDocRef);
        return studentDocSnap.exists() ? (studentDocSnap.data() as UserProfileData) : null;
      });
      const students = (await Promise.all(studentPromises)).filter(Boolean) as UserProfileData[];
      setManagedStudents(students);
    } catch (e) {
      console.error("Error fetching managed students:", e);
      toast({ title: "Error", description: "Could not load managed students.", variant: "destructive" });
    } finally {
      setIsLoadingManagedStudents(false);
    }
  }, [authUserProfile, toast]);

  useEffect(() => {
    fetchPageData();
    fetchAllGroups();
    fetchManagedStudents();
  }, [fetchPageData, fetchAllGroups, fetchManagedStudents]);

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


  const isLoading = authLoading || isLoadingPage || isLoadingAllGroups || isLoadingManagedStudents;

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

  const eventDate = eventDetails.eventTimestamp instanceof Timestamp ? eventDetails.eventTimestamp.toDate() : new Date();
  const redirectBackUrl = '/events/' + eventId + '/rydz';
  const isEventManager = authUser && eventDetails.managerIds?.includes(authUser.uid);

  return (
    <>
      <PageHeader
        title={'Rydz for: ' + eventDetails.name}
        description={'Event at ' + eventDetails.location + ' on ' + format(eventDate, "PPP 'at' p") + ". View rydz or manage associated groups."}
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

      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary" /> Event Managers</CardTitle>
          <CardDescription>Contact these users for questions about the event.</CardDescription>
        </CardHeader>
        <CardContent>
          {eventManagers.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {eventManagers.map(manager => (
                <div key={manager.uid} className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={manager.avatarUrl} alt={manager.fullName} />
                    <AvatarFallback>{manager.fullName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <Link href={`/profile/view/${manager.uid}`} className="font-semibold hover:underline">{manager.fullName}</Link>
                    <p className="text-xs text-muted-foreground">{manager.email}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No managers listed for this event.</p>
          )}
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Associated Groups</CardTitle>
          <CardDescription>Groups linked to this event. Rydz might be prioritized for members.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAllGroups ? (
             <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : eventDetails.associatedGroupIds && eventDetails.associatedGroupIds.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {eventDetails.associatedGroupIds.map(groupId => {
                const group = allFetchedGroups.find(g => g.id === groupId);
                return group ? (
                   <Link key={groupId} href={`/groups/${group.id}`}>
                      <Badge variant="secondary" className="hover:bg-muted/80">{group.name}</Badge>
                  </Link>
                ) : <Badge key={groupId} variant="outline">Loading...</Badge>;
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No groups are currently associated with this event.</p>
          )}
          {isEventManager && (
             <p className="text-xs text-muted-foreground mt-2">
                You can manage associated groups on the{' '}
                <Link href={`/events/${eventId}/edit`} className="underline hover:text-primary">
                    Edit Event
                </Link>
                {' '}page.
            </p>
          )}
        </CardContent>
      </Card>

      <h3 className="font-headline text-xl font-semibold text-primary mt-8 mb-4">Offered Rydz for this Event</h3>
      {activeRydzList.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activeRydzList.map((activeRyd) => {
            const driverName = activeRyd.driverProfile?.fullName || "Unknown Driver";
            const driverAvatar = activeRyd.driverProfile?.avatarUrl || 'https://placehold.co/100x100.png?text=' + driverName.split(" ").map(n=>n[0]).join("");
            const driverDataAiHint = activeRyd.driverProfile?.dataAiHint || "driver photo";

            const vehicleMake = activeRyd.vehicleDetails?.make || "";
            const vehicleModel = activeRyd.vehicleDetails?.model || "";
            const vehicleColor = activeRyd.vehicleDetails?.color || "";
            const vehicleLicense = activeRyd.vehicleDetails?.licensePlate || "";
            const vehiclePassengerCapacity = parseInt(activeRyd.vehicleDetails?.passengerCapacity || "0", 10);
            let vehicleDisplay = (vehicleMake + ' ' + vehicleModel).trim();
            if (vehicleColor) vehicleDisplay += ', ' + vehicleColor;
            if (vehicleLicense) vehicleDisplay += ' (Plate: ' + vehicleLicense + ')';
            if (vehicleDisplay === "") vehicleDisplay = "Vehicle not specified";

            const proposedDeparture = activeRyd.proposedDepartureTime instanceof Timestamp ? activeRyd.proposedDepartureTime.toDate() : null;
            const plannedArrival = activeRyd.plannedArrivalTime instanceof Timestamp ? activeRyd.plannedArrivalTime.toDate() : null;
            const actualDeparture = activeRyd.actualDepartureTime instanceof Timestamp ? activeRyd.actualDepartureTime.toDate() : null;

            const displayDepartureTime = actualDeparture || proposedDeparture;

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

            // Logic for Parent "Join / Add" button
            const studentsNotOnRyd = isCurrentUserParent ? managedStudents.filter(
              student => !activeRyd.passengerManifest.some(p =>
                p.userId === student.uid &&
                p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
                p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER
              )
            ) : [];
            const peopleToAddList: { id: string, fullName: string }[] = isCurrentUserParent ? studentsNotOnRyd.map(s => ({id: s.uid, fullName: s.fullName})) : [];
            if (isCurrentUserParent && !hasCurrentUserRequested && !isCurrentUserTheDriverOfThisRyd) {
                peopleToAddList.unshift({ id: authUser!.uid, fullName: `${authUserProfile.fullName} (Me)` });
            }
            const canParentAddSomeone = isCurrentUserParent && peopleToAddList.length > 0 && isRydJoinableStatus && !isRydFull;
            
            // Logic for Student "Join" button
            const canStudentRequestToJoin = authUserProfile?.role === UserRole.STUDENT && isRydJoinableStatus && !isRydFull && !hasCurrentUserRequested && !isCurrentUserTheDriverOfThisRyd;


            return (
            <Card key={activeRyd.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={driverAvatar} alt={driverName} data-ai-hint={driverDataAiHint}/>
                        <AvatarFallback>{driverName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                        <Link href={'/profile/view/' + activeRyd.driverId} className="font-semibold hover:underline">{driverName}</Link>
                        <p className="text-xs text-muted-foreground">{vehicleDisplay}</p>
                    </div>
                </div>
                <Badge variant="outline" className="w-fit capitalize">{activeRyd.status.replace(/_/g, ' ')}</Badge>
              </CardHeader>
              <CardContent className="flex-grow pt-2 space-y-1.5">
                <div className="text-sm text-muted-foreground space-y-1">
                  {displayDepartureTime && (
                    <div className="flex items-center">
                      <Clock className="mr-1.5 h-4 w-4" />
                      Departs: {format(displayDepartureTime, "MMM d, p")} {actualDeparture ? "(Actual)" : "(Proposed)"}
                    </div>
                  )}
                  {plannedArrival && (
                     <div className="flex items-center">
                      <CalendarDays className="mr-1.5 h-4 w-4" />
                      Arrives by: {format(plannedArrival, "MMM d, p")} (Planned)
                    </div>
                  )}
                  {activeRyd.startLocationAddress && (
                    <div className="flex items-center"><MapPinned className="mr-1.5 h-4 w-4" /> From: {activeRyd.startLocationAddress}</div>
                  )}
                  <div className="flex items-center">
                    <Users className="mr-1.5 h-4 w-4" />
                    Seats Offered: {vehiclePassengerCapacity} ({vehiclePassengerCapacity - currentActivePassengers} available)
                  </div>
                </div>

                {displayedPassengers.length > 0 && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Passengers ({currentActivePassengers} / {vehiclePassengerCapacity}):</h4>
                        <ul className="list-disc list-inside text-xs space-y-0.5 pl-2">
                            {displayedPassengers.map(pItem => {
                                const passengerProfile = activeRyd.passengerProfiles?.find(pp => pp.uid === pItem.userId);
                                return (
                                <li key={pItem.userId}>
                                    {passengerProfile?.fullName || 'User ' + pItem.userId.substring(0,6) + '...'}
                                    <span className="text-muted-foreground/80 ml-1 capitalize">({pItem.status.replace(/_/g, ' ')})</span>
                                </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
                 {displayedPassengers.length === 0 && (
                     <p className="text-xs text-muted-foreground mt-2">No active passengers currently listed for this ryd.</p>
                 )}

                {activeRyd.notes && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Driver Notes:</h4>
                        <p className="text-xs bg-muted/30 p-2 rounded-md whitespace-pre-wrap">{activeRyd.notes}</p>
                    </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4 flex flex-col gap-2">
                <Button type="button" variant="default" className="w-full" asChild>
                  <Link href={'/rydz/tracking/' + activeRyd.id}>
                    View Details / Manage
                  </Link>
                </Button>

                {/* Student Join Button */}
                {canStudentRequestToJoin && (
                   <Button
                    type="button"
                    variant="outline"
                    className="w-full text-green-600 border-green-500 hover:bg-green-500/10 hover:text-green-700"
                    onClick={() => handleRequestSeatForUser(activeRyd.id, authUser!.uid, authUserProfile!.fullName)}
                    disabled={isAddingPassenger[authUser!.uid]}
                  >
                    {isAddingPassenger[authUser!.uid] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                    Request to Join Ryd
                  </Button>
                )}

                {/* Parent Join/Add Button */}
                {canParentAddSomeone && (
                  <Popover open={addPassengerPopoverOpen[activeRyd.id] || false} onOpenChange={(isOpen) => setAddPassengerPopoverOpen(p => ({...p, [activeRyd.id]: isOpen}))}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
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

                {/* Disabled State Buttons */}
                {hasCurrentUserRequested && (
                  <Button type="button" variant="outline" className="w-full" disabled>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500"/> Request Sent / On Ryd
                  </Button>
                )}
                {isRydFull && !hasCurrentUserRequested && !isCurrentUserTheDriverOfThisRyd && (
                  <Button type="button" variant="outline" className="w-full" disabled>
                      <Info className="mr-2 h-4 w-4 text-orange-500"/> Ryd is Full
                  </Button>
                )}
                {!isRydJoinableStatus && !hasCurrentUserRequested && !isCurrentUserTheDriverOfThisRyd && (
                  <Button type="button" variant="outline" className="w-full" disabled>
                      <Info className="mr-2 h-4 w-4 text-muted-foreground"/> Not Accepting Passengers
                  </Button>
                )}
              </CardFooter>
            </Card>
          )})}
        </div>
      )}

      {activeRydzList.length === 0 && (
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

      <h3 className="font-headline text-xl font-semibold text-primary mt-8 mb-4">Requested Rydz for this Event</h3>
      {rydRequestsList.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rydRequestsList.map((request) => {
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
                    cardSubtitle += ' (Requested by ' + request.requesterProfile.fullName + ')';
                }
            } else if (primaryPassenger) {
                cardSubtitle = 'Ryd for ' + primaryPassenger.fullName;
                if (request.requesterProfile && request.requesterProfile.uid !== primaryPassenger.uid) {
                    cardSubtitle += ' (Requested by ' + request.requesterProfile.fullName + ')';
                }
            } else if (request.requesterProfile) {
                cardSubtitle = 'Requested by ' + request.requesterProfile.fullName;
            }


            const rydDateTime = request.rydTimestamp instanceof Timestamp ? request.rydTimestamp.toDate() : null;
            const earliestPickup = request.earliestPickupTimestamp instanceof Timestamp ? request.earliestPickupTimestamp.toDate() : null;
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

            return (
            <Card key={request.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                 <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={displayAvatar} alt={displayNamer} data-ai-hint={displayAvatarHint}/>
                        <AvatarFallback>{displayNamer.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                        <Link href={'/profile/view/' + profileLinkUid} className="font-semibold hover:underline">{displayNamer}</Link>
                        <p className="text-xs text-muted-foreground">{cardSubtitle}</p>
                    </div>
                </div>
                <Badge variant="outline" className="w-fit capitalize">{request.status.replace(/_/g, ' ')}</Badge>
              </CardHeader>
              <CardContent className="flex-grow pt-2 space-y-1.5">
                <div className="text-sm text-muted-foreground space-y-1">
                  {rydDateTime && (
                    <div className="flex items-center">
                      <CalendarDays className="mr-1.5 h-4 w-4" />
                      Needed by: {format(rydDateTime, "MMM d, p")}
                    </div>
                  )}
                   {earliestPickup && (
                    <div className="flex items-center">
                      <Clock className="mr-1.5 h-4 w-4" />
                      Earliest Pickup: {format(earliestPickup, "p")}
                    </div>
                  )}
                  {request.pickupLocation && (
                    <div className="flex items-center"><MapPinIcon className="mr-1.5 h-4 w-4" /> From: {request.pickupLocation}</div>
                  )}
                  {request.destination && (
                    <div className="flex items-center"><Flag className="mr-1.5 h-4 w-4" /> To: {request.eventName || request.destination}</div>
                  )}
                </div>

                {request.passengerUserProfiles && request.passengerUserProfiles.length > 0 && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Passengers ({request.passengerUserProfiles.length}):</h4>
                        <ul className="list-disc list-inside text-xs space-y-0.5 pl-2">
                            {request.passengerUserProfiles.map(p => (
                                <li key={p.uid}>
                                    {p.fullName || 'User ' + p.uid.substring(0,6) + '...'}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {request.notes && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Notes:</h4>
                        <p className="text-xs bg-muted/30 p-2 rounded-md whitespace-pre-wrap">{request.notes}</p>
                    </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4">
                {canCurrentUserOfferToFulfill ? (
                    suitableExistingActiveRydId ? (
                        <Button
                            type="button"
                            variant="default"
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
                            className="w-full"
                            asChild
                        >
                            <Link href={'/events/' + eventId + '/offer-drive?requestId=' + request.id}>
                                <ThumbsUp className="mr-2 h-4 w-4" /> Offer to Fulfill (New Ryd)
                            </Link>
                        </Button>
                    )
                ) : (
                     <Button type="button" variant="outline" className="w-full" disabled>
                        <Car className="mr-2 h-4 w-4 text-muted-foreground"/> (Drivers can offer to fulfill)
                    </Button>
                )}
              </CardFooter>
            </Card>
          )})}
        </div>
      )}
      {rydRequestsList.length === 0 && (
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
    </>
  );
}
