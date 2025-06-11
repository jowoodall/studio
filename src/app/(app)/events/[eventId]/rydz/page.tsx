
"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  CalendarDays, Car, PlusCircle, AlertTriangle, Users, Check, X, Info, UserCircle2, Star,
  CheckCircle2, XCircle, UserMinus, HelpCircle, Loader2
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
import { doc, getDoc, updateDoc, Timestamp, collection, query, getDocs } from "firebase/firestore";
import type { EventData, GroupData, UserProfileData } from "@/types";
import { format } from 'date-fns';
import { useAuth } from "@/context/AuthContext";

// Mock data for rydz related to an event (keep for now, will be replaced)
const mockEventRydz = [
  { id: "rydM", eventId: "1", passengerName: "Alice Wonderland", pickupTime: "09:30 AM", driverName: "Bob The Builder", status: "Confirmed", image: "https://placehold.co/400x200.png?text=Event+Ryd+1", dataAiHint: "group children car" },
  { id: "rydN", eventId: "1", passengerName: "Charlie Brown", pickupTime: "09:45 AM", driverName: "Diana Prince", status: "Pending Driver", image: "https://placehold.co/400x200.png?text=Event+Ryd+2", dataAiHint: "teenager waiting" },
];

interface GroupMember {
  id: string;
  name: string;
  avatarUrl: string;
  dataAiHint: string;
  canDrive: boolean;
  rating?: number;
  rydzCompleted?: number;
}

const mockGroupMembersDataForEventPage: { [groupId: string]: GroupMember[] } = {
  "group1": [
    { id: "user1", name: "Alice W.", avatarUrl: "https://placehold.co/100x100.png?text=AW", dataAiHint: "woman smiling", canDrive: true, rating: 4.8, rydzCompleted: 120 },
    { id: "user2", name: "Bob B.", avatarUrl: "https://placehold.co/100x100.png?text=BB", dataAiHint: "man construction", canDrive: true, rating: 4.5, rydzCompleted: 85 },
  ],
  "group2": [
    { id: "user4", name: "Diana P.", avatarUrl: "https://placehold.co/100x100.png?text=DP", dataAiHint: "woman hero", canDrive: true, rating: 4.9, rydzCompleted: 200 },
  ],
};

type DriverEventStatus = "not driving" | "has room" | "full car" | "not responded";
interface EventDriverStatusInfo { status: DriverEventStatus; seatsAvailable?: number; }
const mockEventDriverStatuses: { [eventId: string]: { [driverId: string]: EventDriverStatusInfo } } = {
  "EVENT_ID_PLACEHOLDER_1": { "user1": { status: "has room", seatsAvailable: 2 }, "user2": { status: "full car" } },
};

interface ResolvedPageParams { eventId: string; }

export default function EventRydzPage({ params }: { params: Promise<ResolvedPageParams> }) {
  const resolvedParams = use(params); 
  const { eventId } = resolvedParams || {}; 
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();

  const [eventDetails, setEventDetails] = useState<EventData | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);

  const rydzForThisEvent = eventId ? mockEventRydz.filter(ryd => ryd.eventId === eventId) : []; // Keep mock rydz for now

  const [currentAssociatedGroups, setCurrentAssociatedGroups] = useState<string[]>([]);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [potentialDrivers, setPotentialDrivers] = useState<GroupMember[]>([]);
  const [isUpdatingGroups, setIsUpdatingGroups] = useState(false);

  const [allFetchedGroups, setAllFetchedGroups] = useState<GroupData[]>([]);
  const [isLoadingAllGroups, setIsLoadingAllGroups] = useState(true);


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

  useEffect(() => {
    fetchEventDetails();
    fetchAllGroups();
  }, [fetchEventDetails, fetchAllGroups]);

  useEffect(() => {
    // This effect updates potential drivers based on currently associated groups
    // For now, it uses mockGroupMembersDataForEventPage.
    // In a real app, this would fetch member details for each group ID in currentAssociatedGroups.
    if (currentAssociatedGroups.length > 0 && eventId) { 
      const drivers: GroupMember[] = [];
      const driverIds = new Set<string>();
      currentAssociatedGroups.forEach(groupId => {
        const members = mockGroupMembersDataForEventPage[groupId] || [];
        members.forEach(member => {
          if (member.canDrive && !driverIds.has(member.id)) {
            drivers.push(member);
            driverIds.add(member.id);
          }
        });
      });
      setPotentialDrivers(drivers);
    } else {
      setPotentialDrivers([]);
    }
  }, [currentAssociatedGroups, eventId]); 

  const handleGroupSelection = async (groupIdToToggle: string) => {
    if (!eventDetails || !authUser) {
      toast({ title: "Error", description: "Event details not loaded or user not authenticated.", variant: "destructive" });
      return;
    }
    // For now, allow any authenticated user to manage groups for demo. 
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

  const getDriverEventStatus = (driverId: string): EventDriverStatusInfo => {
    return eventId ? mockEventDriverStatuses[eventId]?.[driverId] || { status: "not responded" } : { status: "not responded" };
  };

  const statusConfig: Record<DriverEventStatus, { icon: React.ElementType, color: string, text: string }> = {
    "has room": { icon: CheckCircle2, color: "text-green-600 bg-green-100 border-green-200", text: "Has Room" },
    "full car": { icon: UserMinus, color: "text-orange-600 bg-orange-100 border-orange-200", text: "Car Full" },
    "not driving": { icon: XCircle, color: "text-red-600 bg-red-100 border-red-200", text: "Not Driving" },
    "not responded": { icon: HelpCircle, color: "text-gray-600 bg-gray-100 border-gray-200", text: "No Response" },
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
        <p className="text-muted-foreground px-4">{eventError || `The event with ID "${resolvedParams?.eventId || 'unknown'}" could not be found.`}</p>
        <Button asChild className="mt-4">
          <Link href="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }
  
  const eventDate = eventDetails.eventTimestamp instanceof Timestamp ? eventDetails.eventTimestamp.toDate() : new Date();

  return (
    <>
      <PageHeader
        title={`Rydz for: ${eventDetails.name}`}
        description={`Event at ${eventDetails.location} on ${format(eventDate, "PPP 'at' p")}. View rydz or manage associated groups.`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild>
              <Link href={`/rydz/request?eventId=${eventId}`}>
                <span className="flex items-center">
                  <PlusCircle className="mr-2 h-4 w-4" /> Request Ryd
                </span>
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
                          value={group.id} // Use group ID
                          onSelect={() => {
                            handleGroupSelection(group.id); // Pass group ID
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
            <CardDescription>Drivers from the groups above and their status for this event. (Mock data for now)</CardDescription>
        </CardHeader>
        <CardContent>
            {potentialDrivers.length > 0 ? (
                <ul className="space-y-3">
                    {potentialDrivers.map(driver => {
                        const driverStatusInfo = getDriverEventStatus(driver.id);
                        const currentStatusConfig = statusConfig[driverStatusInfo.status];
                        const StatusIcon = currentStatusConfig.icon;
                        return (
                            <li key={driver.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 border rounded-lg hover:shadow-sm transition-shadow gap-3 sm:gap-2">
                                <div className="flex items-center gap-3 flex-grow">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src={driver.avatarUrl} alt={driver.name} data-ai-hint={driver.dataAiHint} />
                                        <AvatarFallback>{driver.name.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <span className="font-medium">{driver.name}</span>
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
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
                                    <Badge variant="outline" className={cn("text-xs py-1 px-2.5 border capitalize", currentStatusConfig.color)}>
                                        <StatusIcon className="h-3.5 w-3.5 mr-1.5" />
                                        {currentStatusConfig.text}
                                        {driverStatusInfo.status === "has room" && driverStatusInfo.seatsAvailable !== undefined && (
                                            <span className="ml-1.5">({driverStatusInfo.seatsAvailable} open)</span>
                                        )}
                                    </Badge>
                                    <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                                        <Link href={`/profile/view/${driver.id}`}> 
                                            <span className="flex items-center">
                                                <UserCircle2 className="mr-1.5 h-4 w-4" /> View Profile
                                            </span>
                                        </Link>
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <div className="text-center py-4 text-muted-foreground">
                    <Info className="mx-auto h-8 w-8 mb-2" />
                    <p>No potential drivers found in the currently associated groups, or no groups associated.</p>
                    <p className="text-xs mt-1">Try associating groups with known drivers.</p>
                </div>
            )}
        </CardContent>
      </Card>

      {/* Mock Rydz List - To be replaced with Firestore data later */}
      {rydzForThisEvent.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rydzForThisEvent.map((ryd) => (
            <Card key={ryd.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="relative h-40">
                <Image
                  src={ryd.image}
                  alt={`Ryd for ${ryd.passengerName}`}
                  fill
                  style={{objectFit: 'cover'}}
                  className="rounded-t-lg"
                  data-ai-hint={ryd.dataAiHint}
                />
                 <div className="absolute top-2 right-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                    {ryd.status}
                 </div>
              </CardHeader>
              <CardContent className="flex-grow pt-4">
                <CardTitle className="font-headline text-lg mb-1">Ryd for: {ryd.passengerName}</CardTitle>
                <div className="text-sm text-muted-foreground space-y-1 mb-2">
                  <div className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> Pickup: {ryd.pickupTime}</div>
                  <div className="flex items-center">
                    <Car className="mr-1.5 h-4 w-4" />
                    Driver: {ryd.driverName !== "Pending" ? (
                      <Link href={`/drivers/${ryd.driverName.toLowerCase().replace(' ','-')}/profile`} className="ml-1 text-primary hover:underline">{ryd.driverName}</Link>
                    ) : (
                      <span className="ml-1">{ryd.driverName}</span>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/rydz/tracking/${ryd.id}`}>
                    View Details
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Rydz Available Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              There are currently no rydz listed for {eventDetails.name}. Be the first to request one.
            </CardDescription>
            <div className="flex justify-center gap-4">
                <Button asChild>
                <Link href={`/rydz/request?eventId=${eventId}`}>
                    <span className="flex items-center">
                      <PlusCircle className="mr-2 h-4 w-4" /> Request Ryd
                    </span>
                </Link>
                </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}


    