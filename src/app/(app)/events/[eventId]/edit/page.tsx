
"use client";

import React, { useEffect, useState, use } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Edit, Loader2, Save, CalendarIcon, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { EventData, EventStatus } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parse } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const eventEditFormSchema = z.object({
  eventName: z.string().min(3, "Event name must be at least 3 characters."),
  eventDate: z.date({ required_error: "Event date is required." }),
  eventTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  eventLocation: z.string().min(5, "Location must be at least 5 characters."),
  description: z.string().max(500, "Description cannot exceed 500 characters.").optional(),
  eventType: z.string().min(1, "Please select an event type."),
  status: z.nativeEnum(EventStatus, { errorMap: () => ({ message: "Please select a status."})}),
});

type EventEditFormValues = z.infer<typeof eventEditFormSchema>;

interface EditEventPageParams {
  eventId: string;
}

export default function EditEventPage({ params: paramsPromise }: { params: Promise<EditEventPageParams> }) {
  const params = use(paramsPromise);
  const { eventId } = params || {};
  const router = useRouter();

  const { toast } = useToast();
  const { user: authUser, loading: authLoading, userProfile } = useAuth();
  const [eventDetails, setEventDetails] = useState<EventData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const form = useForm<EventEditFormValues>({
    resolver: zodResolver(eventEditFormSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (!eventId) {
      setError("Event ID is missing from URL.");
      setIsLoading(false);
      return;
    }

    const fetchEventData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const eventDocRef = doc(db, "events", eventId);
        const eventDocSnap = await getDoc(eventDocRef);

        if (eventDocSnap.exists()) {
          const data = eventDocSnap.data() as EventData;
          setEventDetails(data);
          
          if (authUser && data.managerIds?.includes(authUser.uid)) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }

          const eventDate = data.eventTimestamp.toDate();
          form.reset({
            eventName: data.name,
            eventLocation: data.location,
            description: data.description || "",
            eventType: data.eventType,
            status: data.status,
            eventDate: eventDate,
            eventTime: format(eventDate, "HH:mm"),
          });
        } else {
          setError(`Event with ID "${eventId}" not found.`);
          setEventDetails(null);
        }
      } catch (e) {
        console.error("Error fetching event data:", e);
        setError("Failed to load event data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    
    // Fetch only when auth state is resolved to avoid race conditions
    if (!authLoading) {
      fetchEventData();
    }

  }, [eventId, form, toast, authLoading, authUser]);

  async function onSubmit(data: EventEditFormValues) {
    if (!eventId || !eventDetails || !isAuthorized) {
      toast({ title: "Error", description: "Not authorized or event data not loaded.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const eventDocRef = doc(db, "events", eventId);
      
      const [hours, minutes] = data.eventTime.split(':').map(Number);
      const combinedDateTime = new Date(data.eventDate);
      combinedDateTime.setHours(hours, minutes, 0, 0);
      const eventFirestoreTimestamp = Timestamp.fromDate(combinedDateTime);

      const updateData: Partial<EventData> = {
        name: data.eventName,
        location: data.eventLocation,
        description: data.description || "",
        eventType: data.eventType,
        status: data.status,
        eventTimestamp: eventFirestoreTimestamp,
      };

      await updateDoc(eventDocRef, updateData);

      setEventDetails(prev => prev ? { ...prev, ...updateData } : null);
      toast({
        title: "Event Updated!",
        description: `The event "${data.eventName}" has been successfully updated.`,
      });
      router.push(`/events/${eventId}/rydz`);
    } catch (e: any) {
      console.error("Error updating event:", e);
      toast({
        title: "Update Failed",
        description: `Could not update event details: ${e.message}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || authLoading || isAuthorized === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading event editor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Error Loading Event</h2>
        <p className="text-muted-foreground px-4">{error}</p>
        <Button asChild className="mt-4">
          <Link href="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }
  
  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground px-4">You are not authorized to edit this event.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href={`/events/${eventId}/rydz`}>Back to Event Rydz</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Edit Event: ${eventDetails?.name || `Event`}`}
        description={`Modify the details for this event below.`}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/events/${eventId}/rydz`}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Event
            </Link>
          </Button>
        }
      />
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
           <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Edit className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center font-headline text-xl">Event Information</CardTitle>
          <CardDescription className="text-center">
            Make changes to the event and save.
          </CardDescription>
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
                    <FormControl><Input placeholder="e.g., School Science Fair" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Location / Address</FormLabel>
                    <FormControl><Input placeholder="e.g., 123 Main St, Anytown" {...field} /></FormControl>
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
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="eventTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Time (HH:MM)</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
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
                      <FormControl><SelectTrigger><SelectValue placeholder="Select an event type" /></SelectTrigger></FormControl>
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                     <FormDescription>Set the current status of the event.</FormDescription>
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
                      <Textarea placeholder="Provide a brief description..." className="resize-none" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting || isLoading}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Save Changes</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
