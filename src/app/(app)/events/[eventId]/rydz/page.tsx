
"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarDays, Car, PlusCircle, AlertTriangle, Users, Check, X, Info, UserCircle2, Star,
  CheckCircle2, Loader2, MapPin as MapPinIcon, Clock, MapPinned, ThumbsUp, UserPlus, Flag, UserCheck
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
import type { EventData, GroupData, UserProfileData, RydData, RydStatus, ActiveRyd, PassengerManifestItem } from "@/types";
import { PassengerManifestStatus, UserRole, ActiveRydStatus } from "@/types";
import { format } from 'date-fns';
import { useAuth } from "@/context/AuthContext";
import { requestToJoinActiveRydAction, fulfillRequestWithExistingRydAction } from "@/actions/activeRydActions";
import { useRouter } from "next/navigation";

interface ResolvedPageParams { eventId: string; }

interface DisplayActiveRyd extends ActiveRyd {
  driverProfile?: UserProfileData;
  passengerProfiles?: (UserProfileData & { manifestStatus?: PassengerManifestItem['status'] })[];
  eventName?: string;
}

interface DisplayRydRequestData extends RydData {
  id: string;
  requesterProfile?: UserProfileData;
  passengerUserProfiles?: UserProfileData[];
  eventName?: string;
}

export default function EventRydzPage({ params: paramsPromise }: { params: Promise<ResolvedPageParams> }) {
  const resolvedParams = use(paramsPromise);
  const { eventId } = resolvedParams || {};
  const { toast } = useToast();
  const { user: authUser, userProfile: authUserProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [eventDetails, setEventDetails] = useState<EventData | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  const [activeRydzList, setActiveRydzList] = useState<DisplayActiveRyd[]>([]);
  const [isLoadingActiveRydz, setIsLoadingActiveRydz] = useState<boolean>(true);
  const [activeRydzError, setActiveRydzError] = useState<string | null>(null);

  const [rydRequestsList, setRydRequestsList] = useState<DisplayRydRequestData[]>([]);
  const [isLoadingRydRequests, setIsLoadingRydRequests] = useState<boolean>(true);
  const [rydRequestsError, setRydRequestsError] = useState<string | null>(null);

  const [currentAssociatedGroups, setCurrentAssociatedGroups] = useState<string[]>([]);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [isUpdatingGroups, setIsUpdatingGroups] = useState(false);

  const [allFetchedGroups, setAllFetchedGroups] = useState<GroupData[]>([]);
  const [isLoadingAllGroups, setIsLoadingAllGroups] = useState(true);

  const [isJoiningRyd, setIsJoiningRyd] = useState<Record<string, boolean>>({});
  const [isFulfillingWithExisting, setIsFulfillingWithExisting] = useState<Record<string, boolean>>({});

  const fetchEventDetails = useCallback(async () => {
    if (!eventId) {
      setEventError("Event ID is missing.");
      setIsLoadingEvent(false);
      return;
    }
    setIsLoadingEvent(true);
    setEventError(null);
    try {
      const eventDocRef = doc(db, "events", eventId);
      const eventDocSnap = await getDoc(eventDocRef);
      if (eventDocSnap.exists()) {
        const data = { id: eventDocSnap.id, ...eventDocSnap.data() } as EventData;
        setEventDetails(data);
        setCurrentAssociatedGroups(data.associatedGroupIds || []);
      } else {
        setEventError('Event with ID "' + eventId + '" not found.');
        setEventDetails(null);
      }
    } catch (e) {
      console.error("Error fetching event details:", e);
      setEventError("Failed to load event details.");
      toast({ title: "Error", description: "Could not load event information.", variant: "destructive" });
    } finally {
      setIsLoadingEvent(false);
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

  const fetchActiveRydzForEvent = useCallback(async (currentEventId: string) => {
    if (!currentEventId) {
      setActiveRydzError("Event ID is missing for ActiveRydz fetch.");
      setIsLoadingActiveRydz(false);
      setActiveRydzList([]);
      return;
    }
    setIsLoadingActiveRydz(true);
    setActiveRydzError(null);
    try {
      const activeRydzCollectionRef = collection(db, "activeRydz");
      const q = query(
        activeRydzCollectionRef,
        where("associatedEventId", "==", currentEventId),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedActiveRydzPromises: Promise<DisplayActiveRyd | null>[] = [];

      querySnapshot.forEach((docSnap) => {
        const activeRyd = { id: docSnap.id, ...docSnap.data() } as ActiveRyd;

        const promise = async (): Promise<DisplayActiveRyd | null> => {
          let driverProfile: UserProfileData | undefined = undefined;
          if (activeRyd.driverId) {
            try {
              const driverDocRef = doc(db, "users", activeRyd.driverId);
              const driverDocSnap = await getDoc(driverDocRef);
              if (driverDocSnap.exists()) {
                driverProfile = driverDocSnap.data() as UserProfileData;
              }
            } catch (e) {
              console.warn('Failed to fetch driver profile for ' + activeRyd.driverId, e);
            }
          }

          let passengerProfiles: (UserProfileData & { manifestStatus?: PassengerManifestItem['status'] })[] = [];
          if (activeRyd.passengerManifest && activeRyd.passengerManifest.length > 0) {
            const profilesPromises = activeRyd.passengerManifest.map(async (item) => {
              try {
                const userDocRef = doc(db, "users", item.userId);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                  return { ...(userDocSnap.data() as UserProfileData), manifestStatus: item.status };
                }
                return null;
              } catch (e) {
                console.warn('Failed to fetch passenger profile for ' + item.userId, e);
                return null;
              }
            });
            passengerProfiles = (await Promise.all(profilesPromises)).filter(Boolean) as (UserProfileData & { manifestStatus?: PassengerManifestItem['status'] })[];
          }

          return { ...activeRyd, id: docSnap.id, driverProfile, passengerProfiles, eventName: eventDetails?.name };
        };
        fetchedActiveRydzPromises.push(promise());
      });

      const resolvedActiveRydz = (await Promise.all(fetchedActiveRydzPromises)).filter(Boolean) as DisplayActiveRyd[];
      setActiveRydzList(resolvedActiveRydz);

    } catch (e: any) {
      console.error("Error fetching active rydz:", e);
      let detailedError = "Failed to load offered rydz for this event.";
      if (e.message && (e.message.toLowerCase().includes("index") || e.message.toLowerCase().includes("missing a composite index"))) {
        detailedError = "A Firestore index is required to load offered rydz. Please check the browser's console for a link to create it.";
      } else if (e.code === 'permission-denied') {
        detailedError = "Permission denied when fetching offered rydz. Check Firestore security rules.";
      }
      setActiveRydzError(detailedError);
      setActiveRydzList([]);
      toast({ title: "Error Loading Rydz", description: detailedError, variant: "destructive", duration: 10000 });
    } finally {
      setIsLoadingActiveRydz(false);
    }
  }, [toast, eventDetails?.name]);

  const fetchRydRequestsForEvent = useCallback(async (currentEventId: string) => {
    if (!currentEventId) {
        setRydRequestsError("Event ID is missing for RydRequests fetch.");
        setIsLoadingRydRequests(false);
        setRydRequestsList([]);
        return;
    }
    setIsLoadingRydRequests(true);
    setRydRequestsError(null);
    try {
        const rydRequestsCollectionRef = collection(db, "rydz");
        const q = query(
            rydRequestsCollectionRef,
            where("eventId", "==", currentEventId),
            where("status", "in", ["requested", "searching_driver"]),
            orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetchedRydRequestsPromises: Promise<DisplayRydRequestData | null>[] = [];

        querySnapshot.forEach((docSnap) => {
            const rydRequest = { id: docSnap.id, ...docSnap.data() } as RydData & {id: string};

            const promise = async (): Promise<DisplayRydRequestData | null> => {
                let requesterProfile: UserProfileData | undefined = undefined;
                if (rydRequest.requestedBy) {
                    try {
                        const userDocRef = doc(db, "users", rydRequest.requestedBy);
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            requesterProfile = userDocSnap.data() as UserProfileData;
                        }
                    } catch (e) {
                        console.warn('Failed to fetch requester profile for ' + rydRequest.requestedBy, e);
                    }
                }

                let passengerUserProfiles: UserProfileData[] = [];
                if (rydRequest.passengerIds && rydRequest.passengerIds.length > 0) {
                    const profilesPromises = rydRequest.passengerIds.map(async (userId) => {
                        try {
                            const userDocRef = doc(db, "users", userId);
                            const userDocSnap = await getDoc(userDocRef);
                            return userDocSnap.exists() ? userDocSnap.data() as UserProfileData : null;
                        } catch (e) {
                            console.warn('Failed to fetch passenger profile for ' + userId, e);
                            return null;
                        }
                    });
                    passengerUserProfiles = (await Promise.all(profilesPromises)).filter(Boolean) as UserProfileData[];
                }

                return { ...rydRequest, requesterProfile, passengerUserProfiles, eventName: eventDetails?.name };
            };
            fetchedRydRequestsPromises.push(promise());
        });

        const resolvedRydRequests = (await Promise.all(fetchedRydRequestsPromises)).filter(Boolean) as DisplayRydRequestData[];
        setRydRequestsList(resolvedRydRequests);

    } catch (e: any) {
        console.error("[EventRydzPage] Error fetching ryd requests:", e);
        console.error("[EventRydzPage] Full error object for ryd requests:", JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
        let detailedError = "Failed to load ryd requests for this event.";
        if (e.message && (e.message.toLowerCase().includes("index") || e.message.toLowerCase().includes("missing a composite index"))) {
            detailedError = "A Firestore index is required to load ryd requests. Please check the browser's developer console for a link to create it in your Firebase project.";
        } else if (e.code === 'permission-denied') {
            detailedError = "Permission denied when fetching ryd requests. Please check your Firestore security rules to ensure reads are allowed for the 'rydz' collection based on your query criteria.";
        } else {
            detailedError = 'An unexpected error occurred: ' + (e.message || "Unknown error") + '. Code: ' + (e.code || "N/A");
        }
        setRydRequestsError(detailedError);
        setRydRequestsList([]);
        toast({ title: "Error Loading Ryd Requests", description: detailedError, variant: "destructive", duration: 10000 });
    } finally {
      setIsLoadingRydRequests(false);
    }
  }, [toast, eventDetails?.name]);


  useEffect(() => {
    fetchEventDetails();
    fetchAllGroups();
  }, [fetchEventDetails, fetchAllGroups]);

  useEffect(() => {
    if (eventId && eventDetails) {
      fetchActiveRydzForEvent(eventId);
      fetchRydRequestsForEvent(eventId);
    } else if (eventId && !eventDetails && !isLoadingEvent && eventError) {
      setIsLoadingActiveRydz(false);
      setActiveRydzList([]);
      setIsLoadingRydRequests(false);
      setRydRequestsList([]);
    }
  }, [eventId, eventDetails, isLoadingEvent, eventError, fetchActiveRydzForEvent, fetchRydRequestsForEvent]);


  const handleGroupSelection = async (groupIdToToggle: string) => {
    if (!eventDetails || !authUser) {
      toast({ title: "Error", description: "Event details not loaded or user not authenticated.", variant: "destructive" });
      return;
    }
    if (eventDetails.createdBy !== authUser.uid) {
        toast({ title: "Permission Denied", description: "Only the event creator can manage associated groups.", variant: "destructive"});
        return;
    }

    setIsUpdatingGroups(true);
    const newSelectedGroups = currentAssociatedGroups.includes(groupIdToToggle)
      ? currentAssociatedGroups.filter(id => id !== groupIdToToggle)
      : [...currentAssociatedGroups, groupIdToToggle];

    try {
      const eventDocRef = doc(db, "events", eventDetails.id);
      await updateDoc(eventDocRef, { associatedGroupIds: newSelectedGroups });
      setCurrentAssociatedGroups(newSelectedGroups);
      setEventDetails(prev => prev ? { ...prev, associatedGroupIds: newSelectedGroups } : null);
      toast({
        title: "Groups Updated",
        description: 'Event groups have been updated.',
      });
    } catch (error) {
      console.error("Error updating associated groups:", error);
      toast({ title: "Update Failed", description: "Could not update associated groups for the event.", variant: "destructive" });
    } finally {
      setIsUpdatingGroups(false);
    }
  };

  const filteredGroupsForPopover = allFetchedGroups.filter(group =>
    group.name.toLowerCase().includes(groupSearchTerm.toLowerCase())
  );

  const handleRequestToJoin = useCallback(async (activeRydId: string) => {
    if (!authUser || !authUserProfile) {
      toast({ title: "Not Logged In", description: "You need to be logged in to request a ryd.", variant: "destructive" });
      return;
    }
    // Parents can request for themselves. The action validates further.
    if (authUserProfile.role !== UserRole.STUDENT && authUserProfile.role !== UserRole.PARENT) {
      toast({ title: "Action Not Available", description: "Only students or parents can request to join rydz.", variant: "destructive" });
      return;
    }


    setIsJoiningRyd(prev => ({ ...prev, [activeRydId]: true }));
    let success = false;
    let message = '';
    let serverRydId: string | undefined = undefined;

    try {
      // For parents joining for themselves, passengerUserId and requestedByUserId are the same.
      // If a parent were to join FOR a student via this button (not current design),
      // passengerUserId would be student's UID, requestedByUserId parent's UID.
      const result = await requestToJoinActiveRydAction({
        activeRydId,
        passengerUserId: authUser.uid, 
        requestedByUserId: authUser.uid, 
      });
      success = result.success;
      message = result.message;
      serverRydId = result.rydId;

    } catch (error: any) {
      success = false;
      message = `An unexpected error occurred: ${error.message || "Unknown client error"}`;
      console.error("[EventRydzPage] Client-side error calling requestToJoinActiveRydAction:", error);
    } finally {
      setIsJoiningRyd(prev => ({ ...prev, [activeRydId]: false }));
      if (success && serverRydId && eventId && authUser) {
        toast({ title: "Request Sent!", description: "Request sent to driver. Please provide your pickup details now." });
        router.push(`/rydz/request?eventId=${eventId}&activeRydId=${serverRydId}&passengerId=${authUser.uid}&context=joinOffer`);
      } else if (success) {
        toast({ title: "Request Sent!", description: message });
        if(eventId) fetchActiveRydzForEvent(eventId); // Refresh to show updated manifest or request status
      } else {
        toast({ title: "Request Failed", description: message, variant: "destructive" });
      }
    }
  }, [authUser, authUserProfile, eventId, fetchActiveRydzForEvent, toast, router]);

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
        if (eventId) {
            fetchRydRequestsForEvent(eventId); 
            fetchActiveRydzForEvent(eventId);  
        }
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


  if (authLoading || isLoadingEvent || isLoadingAllGroups) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading event and group data...</p>
      </div>
    );
  }

  if (eventError || !eventDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">{eventError ? "Error Loading Event" : "Event Not Found"}</h2>
        <p className="text-muted-foreground px-4">{eventError || 'The event with ID "' + (resolvedParams?.eventId || 'unknown') + '" could not be found.'}</p>
        <Button asChild className="mt-4">
          <Link href="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }

  const eventDate = eventDetails.eventTimestamp instanceof Timestamp ? eventDetails.eventTimestamp.toDate() : new Date();
  const redirectBackUrl = '/events/' + eventId + '/rydz';

  return (
    <>
      <PageHeader
        title={'Rydz for: ' + eventDetails.name}
        description={'Event at ' + eventDetails.location + ' on ' + format(eventDate, "PPP 'at' p") + ". View rydz or manage associated groups."}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
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
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> Associated Groups</CardTitle>
          <CardDescription>Groups linked to this event. Rydz might be prioritized for members. (Event creator can manage)</CardDescription>
        </CardHeader>
        <CardContent>
          {currentAssociatedGroups.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {currentAssociatedGroups.map(groupId => {
                const group = allFetchedGroups.find(g => g.id === groupId);
                return group ? (
                  <Badge key={groupId} variant="secondary">
                    {group.name}
                    <button
                        type="button"
                        className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={() => handleGroupSelection(groupId)}
                        aria-label={'Remove ' + group.name}
                        disabled={isUpdatingGroups || (authUser && eventDetails.createdBy !== authUser.uid)}
                    >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                ) : <Badge key={groupId} variant="outline">Loading Group... ({groupId.substring(0,6)}...)</Badge>;
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">No groups are currently associated with this event.</p>
          )}

          <Popover open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={groupPopoverOpen}
                className="w-full sm:w-auto"
                disabled={isUpdatingGroups || isLoadingAllGroups || (authUser && eventDetails.createdBy !== authUser.uid)}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {isLoadingAllGroups ? "Loading Groups..." : (currentAssociatedGroups.length > 0 ? "Manage Associated Groups" : "Associate Groups")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Search groups..."
                  value={groupSearchTerm}
                  onValueChange={setGroupSearchTerm}
                />
                <CommandList>
                  <ScrollArea className="h-48">
                    {isLoadingAllGroups && <CommandEmpty><Loader2 className="h-4 w-4 animate-spin my-4 mx-auto" /></CommandEmpty>}
                    {!isLoadingAllGroups && filteredGroupsForPopover.length === 0 && <CommandEmpty>No groups found.</CommandEmpty>}
                    {!isLoadingAllGroups && <CommandGroup>
                      {filteredGroupsForPopover.map((group) => (
                        <CommandItem
                          key={group.id}
                          value={group.id}
                          onSelect={() => {
                            handleGroupSelection(group.id);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              currentAssociatedGroups.includes(group.id)
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {group.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>}
                  </ScrollArea>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {authUser && eventDetails.createdBy !== authUser.uid && (
            <p className="text-xs text-muted-foreground mt-2">Only the event creator can manage associated groups.</p>
          )}
        </CardContent>
      </Card>

      <h3 className="font-headline text-xl font-semibold text-primary mt-8 mb-4">Offered Rydz for this Event</h3>
      {isLoadingActiveRydz && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading offered rydz...</p>
        </div>
      )}

      {activeRydzError && (
        <Card className="text-center py-10 shadow-md bg-destructive/10 border-destructive">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="font-headline text-2xl text-destructive-foreground">Error Loading Offered Rydz</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6 text-destructive-foreground/90 whitespace-pre-line">
              {activeRydzError}
            </CardDescription>
            <Button onClick={() => eventId && fetchActiveRydzForEvent(eventId)} variant="secondary" type="button">Try Again</Button>
          </CardContent>
        </Card>
      )}

      {!isLoadingActiveRydz && !activeRydzError && activeRydzList.length > 0 && (
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

            const canBePassenger = authUserProfile?.role === UserRole.STUDENT || authUserProfile?.role === UserRole.PARENT;
            const isRydFull = currentActivePassengers >= vehiclePassengerCapacity;
            const joinableStatuses = [ActiveRydStatus.PLANNING, ActiveRydStatus.AWAITING_PASSENGERS];
            const isRydJoinableStatus = joinableStatuses.includes(activeRyd.status);

            const hasAlreadyRequested = authUser ? activeRyd.passengerManifest.some(
              p => p.userId === authUser.uid &&
                   p.status !== PassengerManifestStatus.CANCELLED_BY_PASSENGER &&
                   p.status !== PassengerManifestStatus.REJECTED_BY_DRIVER
            ) : false;

            const canRequestToJoin = canBePassenger && isRydJoinableStatus && !isRydFull && !hasAlreadyRequested;
            const joinButtonLoading = isJoiningRyd[activeRyd.id];

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
                {canRequestToJoin && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full text-green-600 border-green-500 hover:bg-green-500/10 hover:text-green-700"
                    onClick={() => handleRequestToJoin(activeRyd.id)}
                    disabled={joinButtonLoading}
                  >
                    {joinButtonLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                    Request to Join Ryd
                  </Button>
                )}
                {canBePassenger && !canRequestToJoin && isRydJoinableStatus && !isRydFull && hasAlreadyRequested && (
                  <Button type="button" variant="outline" className="w-full" disabled>
                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500"/> Request Sent / On Ryd
                  </Button>
                )}
                {canBePassenger && !canRequestToJoin && isRydJoinableStatus && isRydFull && (
                    <Button type="button" variant="outline" className="w-full" disabled>
                        <Info className="mr-2 h-4 w-4 text-orange-500"/> Ryd is Full
                    </Button>
                )}
                 {canBePassenger && !canRequestToJoin && !isRydJoinableStatus && (
                    <Button type="button" variant="outline" className="w-full" disabled>
                        <Info className="mr-2 h-4 w-4 text-muted-foreground"/> Not Accepting Passengers
                    </Button>
                )}
              </CardFooter>
            </Card>
          )})}
        </div>
      )}

      {!isLoadingActiveRydz && !activeRydzError && activeRydzList.length === 0 && (
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
      {isLoadingRydRequests && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading ryd requests...</p>
        </div>
      )}

      {rydRequestsError && (
        <Card className="text-center py-10 shadow-md bg-destructive/10 border-destructive">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="font-headline text-2xl text-destructive-foreground">Error Loading Ryd Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6 text-destructive-foreground/90 whitespace-pre-line">
              {rydRequestsError}
            </CardDescription>
            <Button onClick={() => eventId && fetchRydRequestsForEvent(eventId)} variant="secondary" type="button">Try Again</Button>
          </CardContent>
        </Card>
      )}

      {!isLoadingRydRequests && !rydRequestsError && rydRequestsList.length > 0 && (
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
                            Add to My Existing Ryd
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
      {!isLoadingRydRequests && !rydRequestsError && rydRequestsList.length === 0 && (
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
    
