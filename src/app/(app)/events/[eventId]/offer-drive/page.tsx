
"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Car, Loader2, ArrowLeft, Info } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { type EventData, UserRole } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { createActiveRydForEventAction } from "@/actions/activeRydActions"; 
import { offerDriveFormServerSchema } from '@/schemas/activeRydSchemas'; // Import schema from new location
import { format } from "date-fns";

// Client-side schema for the form
const offerDriveClientFormSchema = z.object({
  seatsAvailable: z.coerce.number().min(1, "Must offer at least 1 seat.").max(8, "Cannot offer more than 8 seats."),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  pickupInstructions: z.string().max(300, "Instructions cannot exceed 300 characters.").optional(),
});

type OfferDriveClientFormValues = z.infer<typeof offerDriveClientFormSchema>;

// Mock events data - keep for fallback if needed, but we'll fetch real event data
const mockEventsData: { [key: string]: { name: string; location: string, date: Timestamp } } = {
  "1": { name: "School Annual Day", location: "Northwood High Auditorium", date: Timestamp.fromDate(new Date(Date.now() + 86400000 * 5)) }, // 5 days from now
  "2": { name: "Community Soccer Match", location: "City Sports Complex", date: Timestamp.fromDate(new Date(Date.now() + 86400000 * 10)) },
  "3": { name: "Tech Conference 2024", location: "Downtown Convention Center", date: Timestamp.fromDate(new Date(Date.now() + 86400000 * 15)) },
};


export default function OfferDrivePage({ params }: { params: { eventId: string } }) {
  const { eventId } = params;
  const { toast } = useToast();
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  
  const [eventDetails, setEventDetails] = useState<EventData | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OfferDriveClientFormValues>({
    resolver: zodResolver(offerDriveClientFormSchema),
    defaultValues: {
      seatsAvailable: 2,
      departureTime: "09:00",
      pickupInstructions: "",
    },
  });

  useEffect(() => {
    const fetchEventDetails = async () => {
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
          setEventDetails({ id: eventDocSnap.id, ...eventDocSnap.data() } as EventData);
        } else {
          setEventError(`Event with ID "${eventId}" not found.`);
          setEventDetails(null); 
        }
      } catch (e) {
        console.error("Error fetching event details:", e);
        setEventError("Failed to load event details. Using mock data as fallback.");
        setEventDetails(mockEventsData[eventId] ? {id: eventId, ...mockEventsData[eventId]} as EventData : null);
      } finally {
        setIsLoadingEvent(false);
      }
    };
    fetchEventDetails();
  }, [eventId]);

  async function onSubmit(data: OfferDriveClientFormValues) {
    if (!authUser || !userProfile) {
      toast({ title: "Authentication Error", description: "You must be logged in to offer a drive.", variant: "destructive" });
      return;
    }
    if (!userProfile.canDrive) {
      toast({ title: "Not a Driver", description: "Your profile indicates you are not registered as a driver.", variant: "destructive" });
      return;
    }
    if (!eventDetails) {
      toast({ title: "Event Error", description: "Event details are not loaded.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    
    const actionPayload = {
      eventId: eventDetails.id,
      seatsAvailable: data.seatsAvailable,
      departureTime: data.departureTime,
      pickupInstructions: data.pickupInstructions || "",
    };

    // Validate with server schema before sending
    const validationResult = offerDriveFormServerSchema.safeParse(actionPayload);
    if (!validationResult.success) {
        toast({ title: "Validation Error", description: "Form data is invalid. Please check your inputs.", variant: "destructive" });
        console.error("Client-side validation failed for server schema:", validationResult.error.flatten().fieldErrors);
        setIsSubmitting(false);
        return;
    }

    const result = await createActiveRydForEventAction(validationResult.data);

    if (result.success && result.activeRydId) {
      toast({
        title: "Ryd Offer Submitted!",
        description: `Your offer to drive for "${eventDetails.name}" has been posted. Ryd ID: ${result.activeRydId}`,
      });
      form.reset();
      // Potentially redirect: router.push(`/rydz/tracking/${result.activeRydId}`);
    } else {
      toast({
        title: "Submission Failed",
        description: result.error || "An unknown error occurred.",
        variant: "destructive",
      });
      if (result.issues) {
         console.error("Server Action Validation Issues:", result.issues);
         result.issues.forEach(issue => {
            form.setError(issue.path[0] as keyof OfferDriveClientFormValues, { message: issue.message });
         });
      }
    }
    setIsSubmitting(false);
  }
  
  const isLoadingPage = authLoading || isLoadingProfile || isLoadingEvent;

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading event and profile data...</p>
      </div>
    );
  }
  
  if (!authUser || !userProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground">You must be logged in to offer a drive.</p>
        <Button asChild className="mt-4">
          <Link href={`/login?redirect=/events/${eventId}/offer-drive`}>Log In</Link>
        </Button>
      </div>
    );
  }

  if (!userProfile.canDrive) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Info className="w-16 h-16 text-blue-500 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Driver Profile Required</h2>
        <p className="text-muted-foreground px-4">To offer a drive, please update your profile to indicate you can drive and provide necessary driver details.</p>
        <Button asChild className="mt-4">
          <Link href="/profile/edit">Update Profile</Link>
        </Button>
      </div>
    );
  }

  if (eventError || !eventDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">{eventError ? "Error Loading Event" : "Event Not Found"}</h2>
        <p className="text-muted-foreground px-4">{eventError || `The event with ID "${eventId}" could not be found.`}</p>
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
        title={`Offer to Drive: ${eventDetails.name}`}
        description={`Event at ${eventDetails.location} on ${format(eventDate, "PPP")}.`}
        actions={
            <Button variant="outline" asChild>
                <Link href={`/events/${eventId}/rydz`}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Event Rydz
                </Link>
            </Button>
        }
      />
      <Card className="w-full max-w-lg mx-auto shadow-lg">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Car className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center font-headline text-xl">Your Ryd Offer Details</CardTitle>
          <CardDescription className="text-center">
            Confirm your availability and vehicle capacity for this event.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="seatsAvailable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Seats (excluding driver)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={String(field.value)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select number of seats" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                          <SelectItem key={num} value={String(num)}>{num} seat{num > 1 ? 's' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>How many passengers can you take?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="departureTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Proposed Departure Time (for event date: {format(eventDate, "MMM d")})</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormDescription>What time will you be departing for the event?</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pickupInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pickup Instructions/Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'I can pick up within a 5-mile radius of downtown.' or 'Text me when you're ready.'"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="p-3 bg-muted/50 rounded-md text-sm">
                <p><span className="font-semibold">Event:</span> {eventDetails.name}</p>
                <p><span className="font-semibold">Date:</span> {format(eventDate, "PPP")}</p>
                <p><span className="font-semibold">Location:</span> {eventDetails.location}</p>
                {userProfile.driverDetails?.primaryVehicle && (
                    <p><span className="font-semibold">Your Vehicle:</span> {userProfile.driverDetails.primaryVehicle}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Offer...</>
                ) : (
                  <><Car className="mr-2 h-4 w-4" /> Submit Drive Offer</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
