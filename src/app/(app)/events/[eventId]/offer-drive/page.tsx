
"use client";

import React, { useState, useEffect, use } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input"; // Keep for potential future use
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Car, Loader2, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { type EventData } from "@/types"; // Keep for event display
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { format } from "date-fns";

// Step 1: Import the simplified schema and action
import { offerDriveFormStep1Schema, type OfferDriveFormStep1Values } from '@/schemas/activeRydSchemas';
import { createActiveRydForEventAction_Step1 } from "@/actions/activeRydActions";

interface ResolvedPageParams {
  eventId: string;
}

export default function OfferDrivePageStep1({ params: paramsPromise }: { params: Promise<ResolvedPageParams> }) {
  const params = use(paramsPromise);
  const { eventId } = params || {};

  const { toast } = useToast();
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  
  const [eventDetails, setEventDetails] = useState<EventData | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OfferDriveFormStep1Values>({
    resolver: zodResolver(offerDriveFormStep1Schema),
    defaultValues: {
      eventId: eventId || "",
      seatsAvailable: 2,
      notes: "",
    },
  });

  // Effect to set eventId in form once it's resolved from params
  useEffect(() => {
    if (eventId && !form.getValues("eventId")) {
      form.setValue("eventId", eventId);
    }
  }, [eventId, form]);

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
        setEventError("Failed to load event details.");
        setEventDetails(null);
      } finally {
        setIsLoadingEvent(false);
      }
    };
    fetchEventDetails();
  }, [eventId]);

  async function onSubmit(data: OfferDriveFormStep1Values) {
    console.log("[OfferDrivePage_Step1] onSubmit triggered. Client form data:", data);

    if (!authUser) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!eventDetails) {
      toast({ title: "Event Error", description: "Event details are not loaded.", variant: "destructive" });
      return;
    }
    // Ensure eventId from form matches current event if critical, or just use data.eventId
     if (data.eventId !== eventId) {
        console.warn(`[OfferDrivePage_Step1] Form eventId (${data.eventId}) differs from page eventId (${eventId}). Using form's.`);
        // This might happen if navigation occurs while form is partially filled.
        // Depending on desired behavior, you might want to prevent submission or re-validate.
    }

    setIsSubmitting(true);
    
    // The data should already match OfferDriveFormStep1Values due to form's resolver
    const result = await createActiveRydForEventAction_Step1(authUser.uid, data); 
    console.log("[OfferDrivePage_Step1] Server action result:", result);

    if (result.success) {
      toast({
        title: "Offer Submitted (Step 1)",
        description: result.message,
      });
      console.log("Received data from server action:", result.receivedData);
      form.reset({ eventId: eventId || "", seatsAvailable: 2, notes: "" });
    } else {
      toast({
        title: "Submission Failed (Step 1)",
        description: result.message || result.error || "An unknown error occurred.",
        variant: "destructive",
      });
      if (result.issues) {
         result.issues.forEach(issue => {
            form.setError(issue.path[0] as keyof OfferDriveFormStep1Values, { message: issue.message });
         });
      }
    }
    setIsSubmitting(false);
  }
  
  const isLoadingPage = authLoading || isLoadingEvent;

  if (isLoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading event data...</p>
      </div>
    );
  }
  
  if (!authUser) {
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
        title={`Offer to Drive (Step 1): ${eventDetails.name}`}
        description={`Event at ${eventDetails.location} on ${format(eventDate, "PPP")}. Basic Offer.`}
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
          <CardTitle className="text-center font-headline text-xl">Your Ryd Offer (Basic)</CardTitle>
          <CardDescription className="text-center">
            Confirm seats and add optional notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
               <FormField
                control={form.control}
                name="eventId"
                render={({ field }) => (
                  <FormItem className="hidden"> {/* Hidden but necessary for submission */}
                    <FormLabel>Event ID</FormLabel>
                    <FormControl>
                      <Input {...field} readOnly />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'Flexible with pickup times.'"
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
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || authLoading || isLoadingProfile}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Offer...</>
                ) : (
                  <><Car className="mr-2 h-4 w-4" /> Submit Basic Offer</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
