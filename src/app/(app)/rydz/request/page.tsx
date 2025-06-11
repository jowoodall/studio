
"use client"; 

import React, { useState, useEffect } from "react"; 
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Car, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, addDoc, serverTimestamp } from "firebase/firestore";
import type { EventData, RydData, RydStatus } from "@/types";


const rydRequestFormSchema = z.object({ 
  eventId: z.string().optional(), 
  eventName: z.string().min(3, "Event name is too short").optional(),
  destination: z.string().min(5, "Destination address is required."),
  pickupLocation: z.string().min(5, "Pickup location is required."),
  date: z.date({ required_error: "Date of ryd is required." }), 
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."), // This is Event Start Time
  earliestPickupTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."), // New field
  notes: z.string().optional(),
}).refine(data => data.eventId || data.eventName, {
    message: "Either select an event or provide an event name if 'Other'.",
    path: ["eventName"], 
});

type RydRequestFormValues = z.infer<typeof rydRequestFormSchema>; 


export default function RydRequestPage() { 
  const { toast } = useToast();
  const { user: authUser, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [availableEvents, setAvailableEvents] = useState<EventData[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const form = useForm<RydRequestFormValues>({ 
    resolver: zodResolver(rydRequestFormSchema), 
    defaultValues: {
      time: "09:00", 
      earliestPickupTime: "08:00", // Default earliest pickup time
      destination: "",
      eventName: "",
      pickupLocation: "",
    }
  });

  useEffect(() => {
    const fetchEvents = async () => {
      setIsLoadingEvents(true);
      try {
        const eventsQuery = query(collection(db, "events"), orderBy("eventTimestamp", "asc"));
        const querySnapshot = await getDocs(eventsQuery);
        const fetchedEvents: EventData[] = [];
        querySnapshot.forEach((doc) => {
          const eventData = doc.data() as EventData;
          if (eventData.eventTimestamp.toDate() >= new Date()) {
            fetchedEvents.push({ id: doc.id, ...eventData });
          }
        });
        setAvailableEvents(fetchedEvents);
      } catch (error) {
        console.error("Error fetching events:", error);
        toast({ title: "Error", description: "Could not load available events.", variant: "destructive" });
      } finally {
        setIsLoadingEvents(false);
      }
    };
    fetchEvents();
  }, [toast]);

  async function onSubmit(data: RydRequestFormValues) { 
    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in to request a ryd.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const [eventHours, eventMinutes] = data.time.split(':').map(Number);
    const eventStartDateTime = new Date(data.date);
    eventStartDateTime.setHours(eventHours, eventMinutes, 0, 0);
    const eventStartFirestoreTimestamp = Timestamp.fromDate(eventStartDateTime);

    const [pickupHours, pickupMinutes] = data.earliestPickupTime.split(':').map(Number);
    const earliestPickupDateTime = new Date(data.date); // Assume pickup on the same day
    earliestPickupDateTime.setHours(pickupHours, pickupMinutes, 0, 0);
    const earliestPickupFirestoreTimestamp = Timestamp.fromDate(earliestPickupDateTime);


    const rydRequestPayload: Omit<RydData, 'id'> = { 
      requestedBy: authUser.uid,
      eventId: data.eventId === "custom" ? undefined : data.eventId,
      eventName: data.eventId === "custom" ? data.eventName : undefined,
      destination: data.destination,
      pickupLocation: data.pickupLocation,
      rydTimestamp: eventStartFirestoreTimestamp, // This is the event start time
      earliestPickupTimestamp: earliestPickupFirestoreTimestamp, // New field for earliest pickup
      notes: data.notes || "",
      status: 'requested' as RydStatus,
      passengerIds: [authUser.uid],
      createdAt: serverTimestamp() as Timestamp, 
    };

    try {
      const docRef = await addDoc(collection(db, "rydz"), rydRequestPayload);
      toast({
        title: "Ryd Requested!", 
        description: `Your request (ID: ${docRef.id}) for a ryd to ${data.eventId && data.eventId !== "custom" ? availableEvents.find(e=>e.id===data.eventId)?.name : data.eventName || data.destination} has been submitted.`, 
      });
      form.reset();
    } catch (error) {
        console.error("Error submitting ryd request:", error);
        toast({
            title: "Request Failed",
            description: "Could not submit your ryd request. Please try again.",
            variant: "destructive",
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  const selectedEventId = form.watch("eventId");

  useEffect(() => {
    if (selectedEventId && selectedEventId !== "custom") {
      const event = availableEvents.find(e => e.id === selectedEventId);
      if (event) {
        form.setValue("destination", event.location);
        form.setValue("eventName", ""); 
        if (event.eventTimestamp) {
            const eventDate = event.eventTimestamp.toDate();
            form.setValue("date", eventDate);
            form.setValue("time", format(eventDate, "HH:mm")); // Sets Event Start Time
        }
      }
    } else if (selectedEventId === "custom") {
      form.setValue("destination", ""); 
      form.setValue("time", "09:00"); // Reset event start time if custom
    }
  }, [selectedEventId, form, availableEvents]);


  return (
    <>
      <PageHeader
        title="Request a Ryd" 
        description="Fill out the details below to request a ryd to an event or destination." 
      />
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Ryd Details</CardTitle> 
          <CardDescription>Please provide accurate information for your ryd request.</CardDescription> 
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="eventId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Event (Optional)</FormLabel>
                    <Select 
                        onValueChange={(value) => {
                            field.onChange(value);
                            if (value !== "custom") {
                                const event = availableEvents.find(e => e.id === value);
                                if (event) {
                                  form.setValue("destination", event.location);
                                  if (event.eventTimestamp) {
                                    const eventDate = event.eventTimestamp.toDate();
                                    form.setValue("date", eventDate);
                                    form.setValue("time", format(eventDate, "HH:mm"));
                                  }
                                }
                            } else {
                                form.setValue("destination", ""); 
                                form.setValue("time", "09:00"); // Reset time if custom
                                form.setValue("eventName", ""); // Clear eventName if switching to custom
                            }
                        }} 
                        defaultValue={field.value}
                        disabled={isLoadingEvents}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingEvents ? "Loading events..." : "Choose an existing event or 'Other'"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {!isLoadingEvents && availableEvents.map(event => (
                          <SelectItem key={event.id} value={event.id}>{event.name} ({format(event.eventTimestamp.toDate(), "MMM d, p")})</SelectItem>
                        ))}
                         <SelectItem value="custom">Other (Specify Below)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>If your event is not listed, choose "Other".</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {(selectedEventId === "custom" || !selectedEventId) && ( 
                 <FormField
                    control={form.control}
                    name="eventName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name (if "Other")</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Birthday Party, Study Group" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              )}

              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination Address</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 123 Main St, Anytown" {...field} disabled={!!selectedEventId && selectedEventId !== "custom"} className={(!!selectedEventId && selectedEventId !== "custom") ? "bg-muted/50" : ""} />
                    </FormControl>
                     {selectedEventId && selectedEventId !== "custom" && <FormDescription>Destination auto-filled from selected event.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pickupLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Pickup Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 456 Oak Ave, Anytown" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date of Ryd</FormLabel> 
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground",
                                (!!selectedEventId && selectedEventId !== "custom") && "bg-muted/50"
                              )}
                              disabled={(!!selectedEventId && selectedEventId !== "custom")}
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
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) || (!!selectedEventId && selectedEventId !== "custom") }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      {(!!selectedEventId && selectedEventId !== "custom") && <FormDescription className="text-xs">Date auto-filled from selected event.</FormDescription>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Start Time (24h format)</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} disabled={(!!selectedEventId && selectedEventId !== "custom")} className={ (!!selectedEventId && selectedEventId !== "custom") ? "bg-muted/50" : ""}/>
                      </FormControl>
                      {(!!selectedEventId && selectedEventId !== "custom") && <FormDescription className="text-xs">Event start time auto-filled from selected event.</FormDescription>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="earliestPickupTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Earliest Pickup Time (24h format)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription>The earliest you'd like to be picked up on the event date.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Number of passengers, specific instructions for driver." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting || authLoading || isLoadingEvents}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Car className="mr-2 h-4 w-4" /> Submit Ryd Request</> 
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
