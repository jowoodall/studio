
"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Car, PlusCircle, AlertTriangle, Users, Check, X, Info } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

// Mock data for rydz related to an event
const mockEventRydz = [
  { id: "rydM", eventId: "1", passengerName: "Alice Wonderland", pickupTime: "09:30 AM", driverName: "Bob The Builder", status: "Confirmed", image: "https://placehold.co/400x200.png?text=Event+Ryd+1", dataAiHint: "group children car" },
  { id: "rydN", eventId: "1", passengerName: "Charlie Brown", pickupTime: "09:45 AM", driverName: "Diana Prince", status: "Pending Driver", image: "https://placehold.co/400x200.png?text=Event+Ryd+2", dataAiHint: "teenager waiting" },
  { id: "rydO", eventId: "2", passengerName: "Edward Scissorhands", pickupTime: "01:30 PM", driverName: "Fiona Gallagher", status: "Confirmed", image: "https://placehold.co/400x200.png?text=Event+Ryd+3", dataAiHint: "sports gear car" },
];

// Mock event details (in a real app, fetch based on eventId)
// Added associatedGroupIds to mock data
const mockEventsData: { [key: string]: { name: string; location: string; associatedGroupIds: string[] } } = {
  "1": { name: "School Annual Day", location: "Northwood High Auditorium", associatedGroupIds: ["group1"] },
  "2": { name: "Community Soccer Match", location: "City Sports Complex", associatedGroupIds: ["group2", "group3"] },
  "3": { name: "Tech Conference 2024", location: "Downtown Convention Center", associatedGroupIds: [] },
};

const mockAvailableGroups = [
  { id: "group1", name: "Morning School Run" },
  { id: "group2", name: "Soccer Practice Crew" },
  { id: "group3", name: "Work Commute (Downtown)" },
  { id: "group4", name: "Weekend Study Buddies" },
  { id: "group5", name: "Art Club Carpool" },
  { id: "group6", name: "Debate Team Transport" },
];


export default function EventRydzPage({ params }: { params: { eventId: string } }) {
  const { toast } = useToast();
  const { eventId } = params;
  const eventDetails = mockEventsData[eventId];
  const rydzForThisEvent = mockEventRydz.filter(ryd => ryd.eventId === eventId);

  const [currentAssociatedGroups, setCurrentAssociatedGroups] = useState<string[]>([]);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");

  useEffect(() => {
    if (eventDetails) {
      setCurrentAssociatedGroups(eventDetails.associatedGroupIds || []);
    }
  }, [eventDetails]);

  const handleGroupSelection = (groupId: string) => {
    const newSelectedGroups = currentAssociatedGroups.includes(groupId)
      ? currentAssociatedGroups.filter(id => id !== groupId)
      : [...currentAssociatedGroups, groupId];
    setCurrentAssociatedGroups(newSelectedGroups);
    // In a real app, you'd call an action here to update the backend
    mockEventsData[eventId].associatedGroupIds = newSelectedGroups; // Update mock data for persistence in session
     toast({
      title: "Groups Updated",
      description: `Event groups have been updated. (Mock update)`,
    });
  };

  const filteredGroupsForPopover = mockAvailableGroups.filter(group =>
    group.name.toLowerCase().includes(groupSearchTerm.toLowerCase())
  );

  if (!eventDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Event Not Found</h2>
        <p className="text-muted-foreground">The event with ID "{eventId}" could not be found.</p>
        <Button asChild className="mt-4">
          <Link href="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Rydz for: ${eventDetails.name}`}
        description={`View available rydz, request a new one, or offer to drive for this event at ${eventDetails.location}.`}
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
          <CardDescription>Groups currently linked to this event. Rydz might be prioritized for members of these groups.</CardDescription>
        </CardHeader>
        <CardContent>
          {currentAssociatedGroups.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {currentAssociatedGroups.map(groupId => {
                const group = mockAvailableGroups.find(g => g.id === groupId);
                return group ? (
                  <Badge key={groupId} variant="secondary">
                    {group.name}
                    <button
                        type="button"
                        className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        onClick={() => handleGroupSelection(groupId)}
                        aria-label={`Remove ${group.name}`}
                    >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </Badge>
                ) : null;
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
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                {currentAssociatedGroups.length > 0 ? "Manage Associated Groups" : "Associate Groups"}
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
                    <CommandEmpty>No groups found.</CommandEmpty>
                    <CommandGroup>
                      {filteredGroupsForPopover.map((group) => (
                        <CommandItem
                          key={group.id}
                          value={group.id}
                          onSelect={() => {
                            handleGroupSelection(group.id);
                            // Keep popover open for multi-select, or close if preferred:
                            // setGroupPopoverOpen(false); 
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
                    </CommandGroup>
                  </ScrollArea>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>


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
              There are currently no rydz listed for {eventDetails.name}. Be the first to request one or offer to drive!
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
