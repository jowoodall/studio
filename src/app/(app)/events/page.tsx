
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, CalendarDays, MapPin, Car, Loader2, AlertTriangle, Archive } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { EventData, EventStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { updateStaleEventsAction } from '@/actions/systemActions';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const StatusBadge = ({ status }: { status?: EventStatus }) => {
  const currentStatus = status || EventStatus.ACTIVE;
  const statusText = currentStatus.replace(/_/g, ' ');

  const getStatusClasses = () => {
    switch (currentStatus) {
      case EventStatus.COMPLETED:
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      case EventStatus.CANCELLED:
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      case EventStatus.ACTIVE:
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    }
  };

  return <Badge className={cn('absolute top-2 right-2 border-transparent text-xs font-semibold capitalize', getStatusClasses())}>{statusText}</Badge>;
};


export default function EventsPage() {
  const { toast } = useToast();
  const { user: authUser, userProfile, loading: authLoading } = useAuth();
  
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    setError(null);
    try {
      updateStaleEventsAction().catch(err => console.error("Background stale events check failed:", err.message));

      if (!authUser || !userProfile) {
        if (!authLoading) {
            setIsLoadingEvents(false);
            setEvents([]);
        }
        return;
      }
      
      const userGroupIds = userProfile.joinedGroupIds || [];
      const userId = authUser.uid;

      const eventsMap = new Map<string, EventData>();

      // Query 1: Events for user's groups
      let groupEventsPromise = Promise.resolve<EventData[]>([]);
      if (userGroupIds.length > 0) {
        // Firestore 'in' query has a limit of 30 items
        const groupChunks: string[][] = [];
        for (let i = 0; i < userGroupIds.length; i += 30) {
          groupChunks.push(userGroupIds.slice(i, i + 30));
        }

        const groupPromises = groupChunks.map(chunk => {
          const groupEventsQuery = query(
            collection(db, "events"), 
            where("status", "==", EventStatus.ACTIVE), 
            where("associatedGroupIds", "array-contains-any", chunk)
          );
          return getDocs(groupEventsQuery);
        });

        const groupSnapshots = await Promise.all(groupPromises);
        const groupEvents = groupSnapshots.flatMap(snapshot => 
          snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventData))
        );
        groupEvents.forEach(event => eventsMap.set(event.id, event));
      }

      // Query 2: Events managed by user
      const managedEventsQuery = query(
        collection(db, "events"),
        where("status", "==", EventStatus.ACTIVE),
        where("managerIds", "array-contains", userId)
      );
      const managedEventsSnapshot = await getDocs(managedEventsQuery);
      managedEventsSnapshot.forEach(doc => eventsMap.set(doc.id, { id: doc.id, ...doc.data() } as EventData));
      
      const combinedEvents = Array.from(eventsMap.values());
      
      // Sort by event timestamp on the client
      combinedEvents.sort((a, b) => {
        const getSortableTime = (timestamp: any): number => {
          if (!timestamp) return 0;
          // Check if it's a Firestore Timestamp object with the toMillis method
          if (typeof timestamp.toMillis === 'function') {
            return timestamp.toMillis();
          }
          // Fallback for plain objects from server actions
          if (typeof timestamp.seconds === 'number') {
            return new Date(timestamp.seconds * 1000).getTime();
          }
          // Fallback for ISO strings
          const date = new Date(timestamp);
          return isNaN(date.getTime()) ? 0 : date.getTime();
        };

        const timeA = getSortableTime(a.eventStartTimestamp);
        const timeB = getSortableTime(b.eventStartTimestamp);
        return timeA - timeB;
      });

      setEvents(combinedEvents);

    } catch (e: any) {
      console.error("Error fetching events:", e);
      let detailedError = "Failed to load active events. Please try again.";
      if (e.message && (e.message.toLowerCase().includes("index") || e.message.toLowerCase().includes("missing a composite index"))) {
        detailedError = "A Firestore index is required to load events. Please check the browser's console for a link to create it.";
      }
      setError(detailedError);
      toast({
        title: "Error Loading Events",
        description: detailedError,
        variant: "destructive",
        duration: 9000,
      });
    } finally {
      setIsLoadingEvents(false);
    }
  }, [toast, authUser, userProfile, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      fetchEvents();
    }
  }, [fetchEvents, authLoading]);

  // Combined loading state
  const isLoading = authLoading || isLoadingEvents;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading events for your groups...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Events</h2>
        <p className="text-muted-foreground px-4 whitespace-pre-line">{error}</p>
        <Button onClick={fetchEvents} className="mt-4">Try Again</Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Active Events"
        description="Showing upcoming events for groups you've joined or events you manage."
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" asChild>
              <Link href="/events/archive">
                <Archive className="mr-2 h-4 w-4" /> View Archived Events
              </Link>
            </Button>
            <Button asChild>
              <Link href="/events/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create New Event
              </Link>
            </Button>
          </div>
        }
      />

      {events.length > 0 ? (
         <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const eventDate = event.eventStartTimestamp instanceof Timestamp ? event.eventStartTimestamp.toDate() : new Date();
            return (
            <Card key={event.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
               <CardHeader className="relative h-40">
                 <Image 
                    src={"https://placehold.co/400x200.png?text=Event"}
                    alt={event.name} 
                    fill 
                    className="rounded-t-lg object-cover" 
                    data-ai-hint={"event image"}
                />
                 <StatusBadge status={event.status} />
              </CardHeader>
              <CardContent className="flex-grow pt-4">
                <CardTitle className="font-headline text-xl mb-1">{event.name}</CardTitle>
                <div className="text-sm text-muted-foreground space-y-1 mb-2">
                    <div className="flex items-center">
                        <CalendarDays className="mr-1.5 h-4 w-4" /> 
                        {format(eventDate, "PPP 'at' p")}
                    </div>
                    <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> {event.location}</div>
                </div>
                <Badge variant="outline" className="text-xs capitalize">{event.eventType}</Badge>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="default" className="w-full" asChild>
                  <Link href={`/events/${event.id}/rydz`}>
                    <Car className="mr-2 h-4 w-4" /> View/Request Rydz
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          )})}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
           <CardHeader>
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Active Events Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              There are no active events for your groups, nor any you manage. Try joining more groups or creating a new event.
            </CardDescription>
            <Button asChild>
              <Link href="/events/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create an Event
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
