
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, AlertTriangle, Archive, Eye } from "lucide-react";
import Link from "next/link";
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { EventData, EventStatus } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const StatusBadge = ({ status }: { status: EventStatus }) => {
  const statusText = status.replace(/_/g, ' ');

  const getStatusClasses = () => {
    switch (status) {
      case EventStatus.COMPLETED:
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      case EventStatus.CANCELLED:
        return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return <Badge className={cn('border-transparent capitalize', getStatusClasses())}>{statusText}</Badge>;
};


export default function ArchivedEventsPage() {
  const { toast } = useToast();
  
  const [events, setEvents] = useState<EventData[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArchivedEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    setError(null);
    try {
      const eventsQuery = query(
        collection(db, "events"), 
        where("status", "in", [EventStatus.COMPLETED, EventStatus.CANCELLED]),
        orderBy("eventStartTimestamp", "desc")
      );
      const querySnapshot = await getDocs(eventsQuery);
      const fetchedEvents: EventData[] = [];
      querySnapshot.forEach((doc) => {
        fetchedEvents.push({ id: doc.id, ...doc.data() } as EventData);
      });
      setEvents(fetchedEvents);
    } catch (e: any)      {
      console.error("Error fetching archived events:", e);
       let detailedError = "Failed to load archived events. Please try again.";
      if (e.code === 5 || (e.message && (e.message.toLowerCase().includes("index") || e.message.toLowerCase().includes("missing a composite index")))) {
        detailedError = "A Firestore index is required to load archived events. Please check the browser's console for a link to create it.";
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
  }, [toast]);

  useEffect(() => {
    fetchArchivedEvents();
  }, [fetchArchivedEvents]);

  if (isLoadingEvents) {
    return (
      <>
        <PageHeader
            title="Archived Events"
            description="View completed and cancelled events."
        />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading archived events...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
     <>
        <PageHeader
            title="Archived Events"
            description="View completed and cancelled events."
        />
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Archive</h2>
            <p className="text-muted-foreground px-4">{error}</p>
            <Button onClick={fetchArchivedEvents} className="mt-4">Try Again</Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Archived Events"
        description="View completed and cancelled events."
        actions={
          <Button variant="outline" asChild>
            <Link href="/events">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Active Events
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {events.length > 0 ? (
            <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Event Name</TableHead>
                    <TableHead>Event Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {events.map((event) => {
                        const eventDate = event.eventStartTimestamp instanceof Timestamp ? event.eventStartTimestamp.toDate() : new Date();
                        return (
                            <TableRow key={event.id}>
                                <TableCell><StatusBadge status={event.status} /></TableCell>
                                <TableCell className="font-medium">{event.name}</TableCell>
                                <TableCell>{format(eventDate, "PPP 'at' p")}</TableCell>
                                <TableCell>{event.location}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" asChild>
                                        <Link href={`/events/${event.id}/rydz`}>
                                            <Eye className="mr-2 h-4 w-4" /> View Rydz
                                        </Link>
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
                <Archive className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-headline text-xl">No Archived Events Found</h3>
                <p className="text-sm text-muted-foreground mt-2">
                    There are no completed or cancelled events yet.
                </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
