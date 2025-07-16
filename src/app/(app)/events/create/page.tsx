
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, PlusCircle, Loader2, Users, Check, X, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query } from "firebase/firestore";
import { useRouter } from "next/navigation";
import type { EventData, GroupData, SavedLocation, EventStatus } from "@/types";
import { createEventAction } from "@/actions/eventActions";

const eventFormSchema = z.object({
  eventName: z.string().min(3, "Event name must be at least 3 characters."),
  eventDate: z.date({ required_error: "Event date is required." }),
  eventStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  eventEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM).").optional(),
  eventLocation: z.string().min(5, "Location must be at least 5 characters."),
  description: z.string().max(500, "Description cannot exceed 500 characters.").optional(),
  eventType: z.string().min(1, "Please select an event type."),
  selectedGroups: z.array(z.string()).optional(),
}).refine(data => {
    // If an end time is provided, it must be after the start time on the same day.
    if (data.eventEndTime) {
        return data.eventEndTime > data.eventStartTime;
    }
    return true;
}, {
    message: "End time must be after start time.",
    path: ["eventEndTime"],
});

type EventFormValues = z.infer<typeof eventFormSchema>;

interface GroupSelectItem {
  id: string;
  name: string;
}

const formatAddress = (address: string) => address || "No address provided";

export default function CreateEventPage() {
  const { toast } = useToast();
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [availableGroups, setAvailableGroups] = useState<GroupSelectItem[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  const sortedLocations = useMemo(() => {
    const locations = userProfile?.savedLocations || [];
    const defaultId = userProfile?.defaultLocationId;
    if (!defaultId) return locations;
    const defaultLocation = locations.find(loc => loc.id === defaultId);
    if (!defaultLocation) return locations;
    return [defaultLocation, ...locations.filter(loc => loc.id !== defaultId)];
  }, [userProfile?.savedLocations, userProfile?.defaultLocationId]);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      eventName: "",
      eventStartTime: "10:00",
      eventEndTime: "",
      eventType: "",
      selectedGroups: [],
      eventLocation: "",
    },
  });

  useEffect(() => {
    // Pre-fill location with default location if available
    if (sortedLocations.length > 0 && userProfile?.defaultLocationId === sortedLocations[0].id) {
      if (!form.getValues("eventLocation")) {
        form.setValue("eventLocation", formatAddress(sortedLocations[0].address));
      }
    }
  }, [sortedLocations, userProfile, form]);

  useEffect(() => {
    const fetchUserGroups = async () => {
      if (authLoading || isLoadingProfile || !userProfile || !authUser) {
        if (!authLoading && !isLoadingProfile && !userProfile && authUser) {
            setIsLoadingGroups(false);
            setAvailableGroups([]);
        }
        return;
      }

      setIsLoadingGroups(true);
      try {
        const userJoinedGroupIds = userProfile.joinedGroupIds || [];
        if (userJoinedGroupIds.length === 0) {
          setAvailableGroups([]);
          setIsLoadingGroups(false);
          return;
        }

        const groupsCollectionQuery = query(collection(db, "groups"));
        const querySnapshot = await getDocs(groupsCollectionQuery);
        const fetchedGroups: GroupSelectItem[] = [];
        querySnapshot.forEach((doc) => {
          if (userJoinedGroupIds.includes(doc.id)) {
            const groupData = doc.data() as GroupData;
            fetchedGroups.push({ id: doc.id, name: groupData.name });
          }
        });
        setAvailableGroups(fetchedGroups);
      } catch (error) {
        console.error("Error fetching user's groups:", error);
        toast({
          title: "Error",
          description: "Could not fetch your groups. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingGroups(false);
      }
    };
    fetchUserGroups();
  }, [toast, authUser, userProfile, authLoading, isLoadingProfile]);

  async function onSubmit(data: EventFormValues) {
    if (!authUser) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create an event.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const [startHours, startMinutes] = data.eventStartTime.split(':').map(Number);
      const startDateTime = new Date(data.eventDate);
      startDateTime.setHours(startHours, startMinutes, 0, 0);
      const eventStartTimestamp = Timestamp.fromDate(startDateTime);
      
      let eventEndTimestamp: Timestamp | undefined;
      if (data.eventEndTime) {
          const [endHours, endMinutes] = data.eventEndTime.split(':').map(Number);
          const endDateTime = new Date(data.eventDate);
          endDateTime.setHours(endHours, endMinutes, 0, 0);
          eventEndTimestamp = Timestamp.fromDate(endDateTime);
      }

      const finalLocation = data.eventLocation;
      if (finalLocation.trim() === "") {
        toast({ title: "Location Missing", description: "Please provide an event location/address.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const newEventData: Omit<EventData, 'id' | 'createdAt' | 'updatedAt' | 'status'> = {
        name: data.eventName,
        eventStartTimestamp: eventStartTimestamp,
        eventEndTimestamp: eventEndTimestamp,
        location: finalLocation,
        description: data.description || "",
        eventType: data.eventType,
        managerIds: [authUser.uid],
        associatedGroupIds: data.selectedGroups || [],
        createdBy: authUser.uid,
      };
      
      const result = await createEventAction(newEventData, authUser.uid);

      if (result.success && result.eventId) {
        toast({
            title: "Event Created!",
            description: `The event "${data.eventName}" has been successfully created.`,
        });
        router.push(`/events/${result.eventId}/rydz`);
      } else {
        throw new Error(result.message || "Failed to create event.");
      }

    } catch (error: any) {
      console.error("Error creating event:", error);
      toast({
        title: "Failed to Create Event",
        description: error.message || "An error occurred while saving the event.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleGroupSelection = (groupId: string) => {
    const currentSelectedGroups = form.getValues("selectedGroups") || [];
    const newSelectedGroups = currentSelectedGroups.includes(groupId)
      ? currentSelectedGroups.filter(id => id !== groupId)
      : [...currentSelectedGroups, groupId];
    form.setValue("selectedGroups", newSelectedGroups, { shouldValidate: true });
  };

  const filteredGroups = availableGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentSelectedGroups = form.watch("selectedGroups") || [];


  return (
    <>
      <PageHeader
        title="Create New Event"
        description="Fill in the details below to create a new event for carpooling."
      />
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Event Information</CardTitle>
          <CardDescription>Provide the necessary details for your new event.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              <FormField
                control={form.control}
                name="eventName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., School Science Fair, Northwood High" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {sortedLocations.length > 0 && (
                <FormItem>
                  <FormLabel>Use a Saved Location</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      const selectedLoc = sortedLocations.find(loc => loc.id === value);
                      if (selectedLoc) {
                        form.setValue("eventLocation", formatAddress(selectedLoc.address));
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a saved location to pre-fill..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sortedLocations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {`${loc.name} (${formatAddress(loc.address)})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Selecting a saved location will populate the event location/address field below.</FormDescription>
                </FormItem>
              )}
              
              <FormField
                control={form.control}
                name="eventLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Location / Address</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 123 Main St, Anytown, CA or Northwood High Gymnasium" {...field} />
                    </FormControl>
                    <FormDescription>Enter the full address or venue name for the event.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="eventDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Event Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eventStartTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Start Time (HH:MM)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1">
                 <FormField
                  control={form.control}
                  name="eventEndTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event End Time (Optional)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormDescription>If the event has a specific end time.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an event type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="school">School Event</SelectItem>
                        <SelectItem value="sports">Sports</SelectItem>
                        <SelectItem value="conference">Conference</SelectItem>
                        <SelectItem value="community">Community</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide a brief description or any important notes about the event."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="selectedGroups"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-base flex items-center">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      Associate Your Groups (Optional)
                    </FormLabel>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={popoverOpen}
                          className="w-full justify-between"
                          disabled={isLoadingGroups || (authLoading || isLoadingProfile)}
                        >
                          {isLoadingGroups ? "Loading your groups..." : (currentSelectedGroups.length > 0
                            ? `${currentSelectedGroups.length} group(s) selected`
                            : "Select from your groups...")}
                           <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search your groups..."
                            value={searchTerm}
                            onValueChange={setSearchTerm}
                            disabled={isLoadingGroups}
                          />
                          <CommandList>
                            <ScrollArea className="h-48">
                              {isLoadingGroups && <CommandEmpty><Loader2 className="h-4 w-4 animate-spin my-4 mx-auto" /></CommandEmpty>}
                              {!isLoadingGroups && filteredGroups.length === 0 && <CommandEmpty>No groups found or you are not a member of any.</CommandEmpty>}
                              <CommandGroup>
                                {!isLoadingGroups && filteredGroups.map((group) => (
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
                                        currentSelectedGroups.includes(group.id)
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
                    <FormDescription>
                      Select carpool groups you are a member of to associate with this event.
                    </FormDescription>
                    {currentSelectedGroups.length > 0 && (
                        <div className="pt-2 space-x-1 space-y-1">
                            {currentSelectedGroups.map(groupId => {
                                const group = availableGroups.find(g => g.id === groupId);
                                return group ? (
                                    <Badge
                                        key={groupId}
                                        variant="secondary"
                                        className="mr-1"
                                    >
                                        {group.name}
                                        <button
                                            type="button"
                                            className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            onClick={() => handleGroupSelection(groupId)}
                                        >
                                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                        </button>
                                    </Badge>
                                ) : null;
                            })}
                        </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting || !authUser || isLoadingGroups || authLoading || isLoadingProfile}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Event...</>
                ) : (
                  <><PlusCircle className="mr-2 h-4 w-4" /> Create Event</>
                )}
              </Button>
               {!authUser && (
                <p className="text-sm text-destructive text-center">You must be logged in to create an event.</p>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
