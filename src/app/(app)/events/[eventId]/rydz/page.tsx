
"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  CalendarDays, Car, PlusCircle, AlertTriangle, Users, Check, X, Info, UserCircle2, Star,
  CheckCircle2, XCircle, UserMinus, HelpCircle, Loader2, Edit3, MapPin as MapPinIcon, User, Clock, MapPinned, Palmtree, ThumbsUp, UserPlus // Added ThumbsUp, UserPlus
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, Timestamp, collection, query, getDocs, setDoc, serverTimestamp, where, orderBy } from "firebase/firestore";
import type { EventData, GroupData, UserProfileData, EventDriverStateData, EventDriverStatus, ActiveRyd, PassengerManifestItem, RydData, RydStatus } from "@/types"; 
import { format } from 'date-fns';
import { useAuth } from "@/context/AuthContext";

interface GroupMember {
  id: string;
  name: string;
  avatarUrl: string;
  dataAiHint: string;
  canDrive: boolean;
  rating?: number;
  rydzCompleted?: number;
}

interface ResolvedPageParams { eventId: string; }

interface DisplayActiveRyd extends ActiveRyd {
  driverProfile?: UserProfileData;
  passengerProfiles?: (UserProfileData & { manifestStatus?: PassengerManifestItem['status'] })[]; 
  eventName?: string;
}

interface DisplayRydRequestData extends RydData {
  id: string; // Ensure RydData has id or add it here
  requesterProfile?: UserProfileData;
  passengerUserProfiles?: UserProfileData[];
  eventName?: string;
}


export default function EventRydzPage({ params: paramsPromise }: { params: Promise<ResolvedPageParams> }) {
  const resolvedParams = use(paramsPromise); 
  const { eventId } = resolvedParams || {}; 
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();

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
  const [potentialDrivers, setPotentialDrivers] = useState<GroupMember[]>([]);
  const [isLoadingPotentialDrivers, setIsLoadingPotentialDrivers] = useState(false);
  const [isUpdatingGroups, setIsUpdatingGroups] = useState(false);

  const [allFetchedGroups, setAllFetchedGroups] = useState<GroupData[]>([]);
  const [isLoadingAllGroups, setIsLoadingAllGroups] = useState(true);

  const [eventDriverStates, setEventDriverStates] = useState<EventDriverStateData[]>([]);
  const [isLoadingDriverStates, setIsLoadingDriverStates] = useState(true);
  const [isUpdatingDriverState, setIsUpdatingDriverState] = useState(false);
  const [editingSeatsForDriver, setEditingSeatsForDriver] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<number | undefined>(undefined);


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
        setEventError(`Event with ID "${eventId}" not found.`);
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

  const fetchEventDriverStates = useCallback(async () => {
    if (!eventId) return;
    setIsLoadingDriverStates(true);
    try {
      const statesQuery = query(collection(db, "eventDriverStates"), where("eventId", "==", eventId));
      const querySnapshot = await getDocs(statesQuery);
      const fetchedStates: EventDriverStateData[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedStates.push({ id: docSnap.id, ...docSnap.data() } as EventDriverStateData);
      });
      setEventDriverStates(fetchedStates);
    } catch (error) {
      console.error("Error fetching event driver states:", error);
      toast({ title: "Error", description: "Could not load driver statuses.", variant: "destructive" });
    } finally {
      setIsLoadingDriverStates(false);
    }
  }, [eventId, toast]);

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
              console.warn(`Failed to fetch driver profile for ${activeRyd.driverId}`, e);
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
                console.warn(`Failed to fetch passenger profile for ${item.userId}`, e);
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
            const rydRequest = { id: docSnap.id, ...docSnap.data() } as RydData & {id: string}; // Ensure id is part of the type

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
                        console.warn(`Failed to fetch requester profile for ${rydRequest.requestedBy}`, e);
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
                            console.warn(`Failed to fetch passenger profile for ${userId}`, e);
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
        console.error("Error fetching ryd requests:", e);
        let detailedError = "Failed to load ryd requests for this event.";
        if (e.message && (e.message.toLowerCase().includes("index") || e.message.toLowerCase().includes("missing a composite index"))) {
            detailedError = "A Firestore index is required to load ryd requests. Please check the browser's console for a link to create it.";
        } else if (e.code === 'permission-denied') {
            detailedError = "Permission denied when fetching ryd requests. Check Firestore security rules.";
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
    fetchEventDriverStates();
  }, [fetchEventDetails, fetchAllGroups, fetchEventDriverStates]);

  useEffect(() => {
    if (eventId && eventDetails) { 
      fetchActiveRydzForEvent(eventId);
      fetchRydRequestsForEvent(eventId); // Fetch ryd requests as well
    } else if (eventId && !eventDetails && !isLoadingEvent && eventError) {
      setIsLoadingActiveRydz(false);
      setActiveRydzList([]);
      setIsLoadingRydRequests(false);
      setRydRequestsList([]);
    }
  }, [eventId, eventDetails, isLoadingEvent, eventError, fetchActiveRydzForEvent, fetchRydRequestsForEvent]);


  useEffect(() => {
    const fetchPotentialDriversFromGroups = async () => {
        if (currentAssociatedGroups.length > 0 && eventId) {
            setIsLoadingPotentialDrivers(true);
            const drivers: GroupMember[] = [];
            const driverIdsProcessed = new Set<string>();

            for (const groupId of currentAssociatedGroups) {
                try {
                    const groupDocRef = doc(db, "groups", groupId);
                    const groupDocSnap = await getDoc(groupDocRef);

                    if (groupDocSnap.exists()) {
                        const groupData = groupDocSnap.data() as GroupData;
                        if (groupData.memberIds && groupData.memberIds.length > 0) {
                            for (const memberId of groupData.memberIds) {
                                if (driverIdsProcessed.has(memberId)) continue;

                                const userDocRef = doc(db, "users", memberId);
                                const userDocSnap = await getDoc(userDocRef);

                                if (userDocSnap.exists()) {
                                    const userData = userDocSnap.data() as UserProfileData;
                                    if (userData.canDrive) {
                                        drivers.push({
                                            id: memberId,
                                            name: userData.fullName || "Unnamed User",
                                            avatarUrl: userData.avatarUrl || `https://placehold.co/100x100.png?text=${(userData.fullName || "U").split(" ").map(n=>n[0]).join("")}`,
                                            dataAiHint: userData.dataAiHint || "driver photo",
                                            canDrive: true,
                                            rating: undefined, 
                                            rydzCompleted: undefined, 
                                        });
                                        driverIdsProcessed.add(memberId);
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching members for group ${groupId}:`, error);
                    toast({
                        title: "Driver Fetch Error",
                        description: `Could not load potential drivers from group ${groupId}.`,
                        variant: "destructive",
                    });
                }
            }
            setPotentialDrivers(drivers);
            setIsLoadingPotentialDrivers(false);
        } else {
            setPotentialDrivers([]);
        }
    };

    fetchPotentialDriversFromGroups();
  }, [currentAssociatedGroups, eventId, toast]);

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
        description: `Event groups have been updated.`,
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

  const getDriverEventStateInfo = (driverId: string): { status: EventDriverStatus, seatsAvailable?: number } => {
    const driverState = eventDriverStates.find(s => s.driverId === driverId);
    if (driverState) {
      return { status: driverState.status, seatsAvailable: driverState.seatsAvailable };
    }
    return { status: "pending_response" };
  };

  const handleDriverStatusUpdate = async (newStatus: EventDriverStatus, seats?: number) => {
    if (!authUser || !eventId) {
      toast({ title: "Error", description: "User not authenticated or event ID missing.", variant: "destructive" });
      return;
    }
    setIsUpdatingDriverState(true);
    const driverId = authUser.uid;
    const stateDocId = `${eventId}_${driverId}`;
    const stateDocRef = doc(db, "eventDriverStates", stateDocId);

    const newStateData: Omit<EventDriverStateData, 'id' | 'updatedAt'> & {updatedAt: any} = {
      eventId,
      driverId,
      status: newStatus,
      seatsAvailable: newStatus === "driving" || newStatus === "full_car" ? seats : undefined,
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(stateDocRef, newStateData, { merge: true }); 
      setEventDriverStates(prevStates => {
        const existingStateIndex = prevStates.findIndex(s => s.id === stateDocId);
        const updatedStateEntry = { ...newStateData, id: stateDocId, updatedAt: Timestamp.now() }; 
        if (existingStateIndex > -1) {
          const newStates = [...prevStates];
          newStates[existingStateIndex] = updatedStateEntry;
          return newStates;
        }
        return [...prevStates, updatedStateEntry];
      });
      toast({ title: "Status Updated", description: "Your driving status for this event has been updated." });
      setEditingSeatsForDriver(null); 
    } catch (error) {
      console.error("Error updating driver status:", error);
      toast({ title: "Update Failed", description: "Could not update your driving status.", variant: "destructive" });
    } finally {
      setIsUpdatingDriverState(false);
    }
  };


  const statusConfig: Record<EventDriverStatus, { icon: React.ElementType, color: string, text: string }> = {
    "driving": { icon: CheckCircle2, color: "text-green-600 bg-green-100 border-green-200", text: "Driving" },
    "full_car": { icon: UserMinus, color: "text-orange-600 bg-orange-100 border-orange-200", text: "Car Full" },
    "not_driving": { icon: XCircle, color: "text-red-600 bg-red-100 border-red-200", text: "Not Driving" },
    "pending_response": { icon: HelpCircle, color: "text-gray-600 bg-gray-100 border-gray-200", text: "No Response" },
  };

  if (authLoading || isLoadingEvent || isLoadingAllGroups || isLoadingDriverStates) {
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
        <p className="text-muted-foreground px-4">{eventError || `The event with ID "${resolvedParams?.eventId || 'unknown'}" could not be found.`}</p>
        <Button asChild className="mt-4">
          <Link href="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }
  
  const eventDate = eventDetails.eventTimestamp instanceof Timestamp ? eventDetails.eventTimestamp.toDate() : new Date();
  const redirectBackUrl = `/events/${eventId}/rydz`;
  
  return (
    <>
      <PageHeader
        title={`Rydz for: ${eventDetails.name}`}
        description={`Event at ${eventDetails.location} on ${format(eventDate, "PPP 'at' p")}. View rydz or manage associated groups.`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild>
              <Link href={`/rydz/request?eventId=${eventId}&redirectUrl=${encodeURIComponent(redirectBackUrl)}`}>
                <span className="flex items-center">
                  <PlusCircle className="mr-2 h-4 w-4" /> Request Ryd
                </span>
              </Link>
            </Button>
            <Button variant="outline" asChild>
                <Link href={`/events/${eventId}/offer-drive`}>
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
                        aria-label={`Remove ${group.name}`}
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

      <Card className="mb-6 shadow-lg">
        <CardHeader>
            <CardTitle className="flex items-center"><Car className="mr-2 h-5 w-5 text-green-500" /> Potential Drivers from Associated Groups</CardTitle>
            <CardDescription>Drivers from the groups above and their status for this event.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoadingPotentialDrivers || isLoadingDriverStates ? (
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="ml-2 text-muted-foreground">Loading potential drivers & statuses...</p>
                </div>
            ) : potentialDrivers.length > 0 ? (
                <ul className="space-y-4">
                    {potentialDrivers.map(driver => {
                        const driverStateInfo = getDriverEventStateInfo(driver.id);
                        const currentStatusConfig = statusConfig[driverStateInfo.status];
                        const StatusIcon = currentStatusConfig.icon;
                        const isCurrentUserDriver = authUser?.uid === driver.id;

                        return (
                            <li key={driver.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow gap-3">
                                <div className="flex items-center gap-3 flex-grow">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={driver.avatarUrl} alt={driver.name} data-ai-hint={driver.dataAiHint} />
                                        <AvatarFallback>{driver.name.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <span className="font-medium">{driver.name} {isCurrentUserDriver && "(You)"}</span>
                                      {driver.rating !== undefined && ( 
                                        <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                                          <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400 mr-1" />
                                          {driver.rating.toFixed(1)}
                                          {driver.rydzCompleted !== undefined && 
                                            <span className="ml-1">({driver.rydzCompleted} rydz)</span>
                                          }
                                        </div>
                                      )}
                                    </div>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
                                    {isCurrentUserDriver && (
                                      <div className="flex flex-col sm:flex-row gap-2 items-stretch w-full sm:w-auto">
                                        <Button 
                                          variant={driverStateInfo.status === 'driving' || driverStateInfo.status === 'full_car' ? "default" : "outline"} 
                                          size="sm" 
                                          onClick={() => {
                                            setEditingSeatsForDriver(driver.id);
                                            setSelectedSeats(driverStateInfo.seatsAvailable !== undefined ? driverStateInfo.seatsAvailable : 1);
                                            if (driverStateInfo.status === 'not_driving' || driverStateInfo.status === 'pending_response') {
                                                handleDriverStatusUpdate("driving", 1);
                                            }
                                          }}
                                          disabled={isUpdatingDriverState}
                                          className="flex-grow sm:flex-grow-0"
                                        >
                                          {driverStateInfo.status === 'driving' || driverStateInfo.status === 'full_car' ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : <Car className="mr-1.5 h-4 w-4" />}
                                          {driverStateInfo.status === 'driving' || driverStateInfo.status === 'full_car' ? "Driving" : "I Can Drive"}
                                        </Button>
                                        <Button 
                                          variant={driverStateInfo.status === 'not_driving' ? "destructive" : "outline"} 
                                          size="sm" 
                                          onClick={() => handleDriverStatusUpdate("not_driving")}
                                          disabled={isUpdatingDriverState}
                                          className="flex-grow sm:flex-grow-0"
                                        >
                                          {driverStateInfo.status === 'not_driving' ? <XCircle className="mr-1.5 h-4 w-4" /> : null}
                                          Cannot Drive
                                        </Button>
                                      </div>
                                    )}

                                    {(isCurrentUserDriver && (driverStateInfo.status === 'driving' || driverStateInfo.status === 'full_car') && editingSeatsForDriver === driver.id) ? (
                                      <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                        <Select
                                          value={String(selectedSeats)}
                                          onValueChange={(value) => setSelectedSeats(Number(value))}
                                          disabled={isUpdatingDriverState}
                                        >
                                          <SelectTrigger className="w-[80px] h-9 text-xs">
                                            <SelectValue placeholder="Seats" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {[0, 1, 2, 3, 4, 5].map(s => (
                                              <SelectItem key={s} value={String(s)}>{s} seat{s !== 1 ? 's' : ''}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Button size="icon_sm" onClick={() => handleDriverStatusUpdate(selectedSeats === 0 ? 'full_car' : 'driving', selectedSeats)} disabled={isUpdatingDriverState} className="h-9 w-9">
                                          {isUpdatingDriverState ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}
                                        </Button>
                                      </div>
                                    ) : (
                                      <Badge variant="outline" className={cn("text-xs py-1 px-2.5 border capitalize whitespace-nowrap", currentStatusConfig.color)}>
                                          <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                                          {currentStatusConfig.text}
                                          {(driverStateInfo.status === "driving" || driverStateInfo.status === "full_car") && driverStateInfo.seatsAvailable !== undefined && (
                                              <span className="ml-1.5">({driverStateInfo.seatsAvailable} open)</span>
                                          )}
                                           {isCurrentUserDriver && (driverStateInfo.status === 'driving' || driverStateInfo.status === 'full_car') && (
                                            <Button variant="ghost" size="icon_sm" className="ml-1 h-5 w-5 p-0" onClick={() => { setEditingSeatsForDriver(driver.id); setSelectedSeats(driverStateInfo.seatsAvailable); }}>
                                                <Edit3 className="h-3 w-3" />
                                            </Button>
                                          )}
                                      </Badge>
                                    )}
                                    
                                    {!isCurrentUserDriver && (
                                        <Button variant="outline" size="sm" asChild className="w-full sm:w-auto mt-2 sm:mt-0">
                                            <Link href={`/profile/view/${driver.id}`}> 
                                                <span className="flex items-center">
                                                    <UserCircle2 className="mr-1.5 h-4 w-4" /> View Profile
                                                </span>
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div className="text-center py-4 text-muted-foreground">
                    <Info className="mx-auto h-8 w-8 mb-2" />
                    <p>No potential drivers found in the currently associated groups, or no groups associated.</p>
                    <p className="text-xs mt-1">Try associating groups with known drivers or ensure members have "Can Drive" enabled in their profiles.</p>
                </div>
            )}
        </CardContent>
      </Card>

      {/* ActiveRydz List Section */}
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
            <Button onClick={() => eventId && fetchActiveRydzForEvent(eventId)} variant="secondary">Try Again</Button>
          </CardContent>
        </Card>
      )}

      {!isLoadingActiveRydz && !activeRydzError && activeRydzList.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activeRydzList.map((activeRyd) => {
            const driverName = activeRyd.driverProfile?.fullName || "Unknown Driver";
            const driverAvatar = activeRyd.driverProfile?.avatarUrl || `https://placehold.co/100x100.png?text=${driverName.split(" ").map(n=>n[0]).join("")}`;
            const driverDataAiHint = activeRyd.driverProfile?.dataAiHint || "driver photo";
            
            const vehicleMake = activeRyd.vehicleDetails?.make || "";
            const vehicleModel = activeRyd.vehicleDetails?.model || "";
            const vehicleColor = activeRyd.vehicleDetails?.color || "";
            const vehicleLicense = activeRyd.vehicleDetails?.licensePlate || "";
            const vehiclePassengerCapacity = activeRyd.vehicleDetails?.passengerCapacity || "N/A";
            let vehicleDisplay = `${vehicleMake} ${vehicleModel}`.trim();
            if (vehicleColor) vehicleDisplay += `, ${vehicleColor}`;
            if (vehicleLicense) vehicleDisplay += ` (Plate: ${vehicleLicense})`;
            if (vehicleDisplay === "") vehicleDisplay = "Vehicle not specified";

            const proposedDeparture = activeRyd.proposedDepartureTime instanceof Timestamp ? activeRyd.proposedDepartureTime.toDate() : null;
            const plannedArrival = activeRyd.plannedArrivalTime instanceof Timestamp ? activeRyd.plannedArrivalTime.toDate() : null;
            const actualDeparture = activeRyd.actualDepartureTime instanceof Timestamp ? activeRyd.actualDepartureTime.toDate() : null;

            const displayDepartureTime = actualDeparture || proposedDeparture;

            return (
            <Card key={activeRyd.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={driverAvatar} alt={driverName} data-ai-hint={driverDataAiHint}/>
                        <AvatarFallback>{driverName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                        <Link href={`/profile/view/${activeRyd.driverId}`} className="font-semibold hover:underline">{driverName}</Link>
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
                    Seats Offered: {vehiclePassengerCapacity}
                  </div>
                </div>

                {activeRyd.passengerProfiles && activeRyd.passengerProfiles.length > 0 && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Passengers ({activeRyd.passengerManifest.filter(p => p.status !== 'cancelled_by_passenger').length} / {vehiclePassengerCapacity}):</h4>
                        <ul className="list-disc list-inside text-xs space-y-0.5 pl-2">
                            {activeRyd.passengerManifest.map(pItem => {
                                const passengerProfile = activeRyd.passengerProfiles?.find(pp => pp.uid === pItem.userId);
                                return (
                                <li key={pItem.userId}>
                                    {passengerProfile?.fullName || `User ${pItem.userId.substring(0,6)}...`}
                                    <span className="text-muted-foreground/80 ml-1">({pItem.status.replace(/_/g, ' ')})</span>
                                </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
                 {(!activeRyd.passengerProfiles || activeRyd.passengerProfiles.length === 0) && (
                     <p className="text-xs text-muted-foreground mt-2">No passengers currently listed for this ryd.</p>
                 )}

                {activeRyd.notes && (
                    <div className="mt-3">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Driver Notes:</h4>
                        <p className="text-xs bg-muted/30 p-2 rounded-md whitespace-pre-wrap">{activeRyd.notes}</p>
                    </div>
                )}
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="default" className="w-full" asChild>
                  <Link href={`/rydz/tracking/${activeRyd.id}`}>
                    View Details / Manage
                  </Link>
                </Button>
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
            <div className="flex justify-center gap-4">
                <Button asChild>
                <Link href={`/rydz/request?eventId=${eventId}&redirectUrl=${encodeURIComponent(redirectBackUrl)}`}>
                    <span className="flex items-center">
                      <PlusCircle className="mr-2 h-4 w-4" /> Request a Ryd
                    </span>
                </Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href={`/events/${eventId}/offer-drive`}>
                        <Car className="mr-2 h-4 w-4" /> Offer Your Ryd
                    </Link>
                </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ryd Requests List Section */}
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
            <Button onClick={() => eventId && fetchRydRequestsForEvent(eventId)} variant="secondary">Try Again</Button>
          </CardContent>
        </Card>
      )}

      {!isLoadingRydRequests && !rydRequestsError && rydRequestsList.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rydRequestsList.map((request) => {
            const requesterName = request.requesterProfile?.fullName || "Unknown User";
            const requesterAvatar = request.requesterProfile?.avatarUrl || `https://placehold.co/100x100.png?text=${requesterName.split(" ").map(n=>n[0]).join("")}`;
            const requesterDataAiHint = request.requesterProfile?.dataAiHint || "user photo";
            const rydDateTime = request.rydTimestamp instanceof Timestamp ? request.rydTimestamp.toDate() : null;
            const earliestPickup = request.earliestPickupTimestamp instanceof Timestamp ? request.earliestPickupTimestamp.toDate() : null;

            return (
            <Card key={request.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                 <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-12 w-12">
                        <AvatarImage src={requesterAvatar} alt={requesterName} data-ai-hint={requesterDataAiHint}/>
                        <AvatarFallback>{requesterName.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                        <Link href={`/profile/view/${request.requestedBy}`} className="font-semibold hover:underline">{requesterName}</Link>
                        <p className="text-xs text-muted-foreground">Requested a Ryd</p>
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
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Passengers:</h4>
                        <ul className="list-disc list-inside text-xs space-y-0.5 pl-2">
                            {request.passengerUserProfiles.map(p => (
                                <li key={p.uid}>
                                    {p.fullName || `User ${p.uid.substring(0,6)}...`}
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
                <Button variant="outline" className="w-full" disabled> {/* Action TBD */}
                  <ThumbsUp className="mr-2 h-4 w-4" /> Offer to Fulfill (Future)
                </Button>
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
               <Link href={`/rydz/request?eventId=${eventId}&redirectUrl=${encodeURIComponent(redirectBackUrl)}`}>
                <PlusCircle className="mr-2 h-4 w-4" /> Be the First to Request
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
        
    

    





    



