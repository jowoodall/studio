// src/app/(app)/groups/[groupId]/page.tsx
'use client';

import React, { useState, useEffect, useCallback, use } from 'react'; 
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, Car, Edit, Users, MapPin, AlertTriangle, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore"; // Added collection, query, where, getDocs, orderBy, Timestamp
import type { GroupData, UserProfileData, UserRole, EventData } from "@/types"; // Added EventData
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns'; // For formatting event dates

interface FetchedGroupMember {
  id: string;
  name: string;
  avatarUrl?: string;
  dataAiHint?: string;
  canDrive: boolean;
  role: UserRole;
  hasAcceptedInvitation: boolean;
}

interface GroupViewPageProps {
  params: Promise<{ groupId: string }>; 
}

export default function GroupViewPage({ params: paramsPromise }: GroupViewPageProps) { 
  const resolvedParams = use(paramsPromise); 
  const { groupId } = resolvedParams; 

  const { user: authUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [group, setGroup] = useState<GroupData | null>(null);
  const [members, setMembers] = useState<FetchedGroupMember[]>([]);
  const [drivers, setDrivers] = useState<FetchedGroupMember[]>([]);
  const [associatedEvents, setAssociatedEvents] = useState<EventData[]>([]); // State for associated events
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true); // Separate loading for events
  const [error, setError] = useState<string | null>(null);

  const fetchGroupAndMembersAndEvents = useCallback(async () => {
    if (!authUser) {
      if (!authLoading) setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setIsLoadingEvents(true);
    setError(null);

    try {
      // Fetch Group Details
      const groupDocRef = doc(db, "groups", groupId);
      const groupDocSnap = await getDoc(groupDocRef);

      if (!groupDocSnap.exists()) {
        setError(`Group with ID "${groupId}" not found.`);
        setGroup(null);
        setMembers([]);
        setDrivers([]);
        setAssociatedEvents([]);
        setIsLoading(false);
        setIsLoadingEvents(false);
        return;
      }

      const groupData = { id: groupDocSnap.id, ...groupDocSnap.data() } as GroupData;
      setGroup(groupData);

      // Fetch Members
      if (groupData.memberIds && groupData.memberIds.length > 0) {
        const memberPromises = groupData.memberIds.map(async (id) => {
          const userDocRef = doc(db, "users", id);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as UserProfileData;
            const hasAccepted = (userData.joinedGroupIds || []).includes(groupId);
            return {
              id: userDocSnap.id,
              name: userData.fullName,
              avatarUrl: userData.avatarUrl,
              dataAiHint: userData.dataAiHint,
              canDrive: userData.canDrive || false,
              role: userData.role,
              hasAcceptedInvitation: hasAccepted,
            };
          }
          return null;
        });
        const fetchedMembers = (await Promise.all(memberPromises)).filter(Boolean) as FetchedGroupMember[];
        setMembers(fetchedMembers);
        setDrivers(fetchedMembers.filter(m => m.canDrive && m.hasAcceptedInvitation));
      } else {
        setMembers([]);
        setDrivers([]);
      }
      setIsLoading(false); // Done loading group and members

      // Fetch Associated Events
      const eventsQuery = query(
        collection(db, "events"), 
        where("associatedGroupIds", "array-contains", groupId),
        orderBy("eventStartTimestamp", "asc") // Show upcoming events first
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const fetchedEvents: EventData[] = [];
      eventsSnapshot.forEach(docSnap => {
        fetchedEvents.push({ id: docSnap.id, ...docSnap.data() } as EventData);
      });
      setAssociatedEvents(fetchedEvents);

    } catch (e: any) {
      console.error("Error fetching group details or events:", e);
      setError("Failed to load group details or events. " + (e.message || ""));
      toast({
        title: "Error",
        description: "Could not load group information or associated events.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false); // Ensure this is set false even if events part errors
      setIsLoadingEvents(false);
    }
  }, [groupId, authUser, authLoading, toast]);

  useEffect(() => {
    if (!authLoading) { 
        fetchGroupAndMembersAndEvents();
    }
  }, [groupId, authLoading, fetchGroupAndMembersAndEvents]);


  if (authLoading || (isLoading && !group && !error)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading group details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Group</h2>
        <p className="text-muted-foreground px-4">{error}</p>
        <Button asChild className="mt-4">
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }
  
  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Group Not Found</h2>
        <p className="text-muted-foreground">The group with ID "{groupId}" could not be found.</p>
        <Button asChild className="mt-4">
          <Link href="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }


  return (
    <>
      <PageHeader
        title={group.name}
        description={group.description}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/groups/${groupId}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit Group
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/groups/${groupId}/manage`}>
                <Users className="mr-2 h-4 w-4" /> Manage Members
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column / Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-xl overflow-hidden">
            <div className="relative aspect-[16/7] bg-muted">
              <Image 
                src={group.imageUrl || "https://placehold.co/600x300.png?text=Group+Image"} 
                alt={group.name} 
                fill 
                className="object-cover" 
                data-ai-hint={group.dataAiHint || "group image"} 
              />
            </div>
            <CardHeader>
              <CardTitle className="font-headline text-2xl">{group.name}</CardTitle>
              <CardDescription>{members.filter(m => m.hasAcceptedInvitation).length || 0} active members ({members.length || 0} total invited)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{group.description}</p>
            </CardContent>
          </Card>

          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><CalendarDays className="mr-2 h-5 w-5 text-primary" /> Upcoming Events</CardTitle>
              <CardDescription>Events this group is associated with.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEvents ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="ml-2 text-muted-foreground">Loading events...</p>
                </div>
              ) : associatedEvents.length > 0 ? (
                <ul className="space-y-4">
                  {associatedEvents.map(event => {
                    const eventDate = event.eventStartTimestamp instanceof Timestamp ? event.eventStartTimestamp.toDate() : null;
                    return (
                    <li key={event.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <h4 className="font-semibold">{event.name}</h4>
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="flex items-center">
                          <CalendarDays className="mr-1.5 h-4 w-4" /> 
                          {eventDate ? format(eventDate, "PPP 'at' p") : 'Date not set'}
                        </span>
                        <span className="flex items-center mt-0.5"><MapPin className="mr-1.5 h-4 w-4" /> {event.location}</span>
                      </div>
                      <Button variant="link" size="sm" className="px-0 h-auto mt-1" asChild>
                        <Link href={`/events/${event.id}/rydz`}>View Event Rydz</Link>
                      </Button>
                    </li>
                  )})}
                </ul>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Info className="mx-auto h-8 w-8 mb-2" />
                  <p>No upcoming events specifically listed for this group at the moment.</p>
                  <p className="text-xs mt-1">Events can be associated with groups on the individual event pages or during event creation.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column / Drivers & Members */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><Car className="mr-2 h-5 w-5 text-primary" /> Group Drivers</CardTitle>
              <CardDescription>Members who can drive and have accepted the group invitation.</CardDescription>
            </CardHeader>
            <CardContent>
              {drivers.length > 0 ? (
                <ul className="space-y-3">
                  {drivers.map(driver => (
                    <li key={driver.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={driver.avatarUrl || `https://placehold.co/100x100.png?text=${driver.name.split(" ").map(n=>n[0]).join("")}`} alt={driver.name} data-ai-hint={driver.dataAiHint || "driver photo"} />
                        <AvatarFallback>{driver.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{driver.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{driver.role}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                 <div className="text-center py-6 text-muted-foreground">
                  <Car className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No designated (and accepted) drivers in this group yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary" /> All Members</CardTitle>
              <CardDescription>All members of this group.</CardDescription>
            </CardHeader>
            <CardContent>
               {members.length > 0 ? (
                <ul className="space-y-3 max-h-80 overflow-y-auto">
                  {members.map(member => (
                    <li key={member.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-md">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatarUrl || `https://placehold.co/100x100.png?text=${member.name.split(" ").map(n=>n[0]).join("")}`} alt={member.name} data-ai-hint={member.dataAiHint || "member photo"} />
                        <AvatarFallback>{member.name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-medium flex items-center">
                          {member.name}
                          {!member.hasAcceptedInvitation && (
                            <Badge variant="outline" className="ml-2 text-xs border-yellow-500 text-yellow-600">
                              Pending
                            </Badge>
                          )}
                        </div>
                         <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                      </div>
                       {member.canDrive && member.hasAcceptedInvitation && <Car className="ml-auto h-4 w-4 text-blue-500" title="Can Drive" />}
                    </li>
                  ))}
                </ul>
              ) : (
                 <div className="text-center py-6 text-muted-foreground">
                  <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>This group has no members yet.</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full" asChild>
                    <Link href={`/groups/${groupId}/manage`}>Manage All Members</Link>
                </Button>
            </CardFooter>
          </Card>

        </div>
      </div>
    </>
  );
}
