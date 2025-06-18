
"use client";

import React, { useState, useEffect, use } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Car, Loader2, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { type EventData } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { format } from "date-fns";

import { offerDriveFormStep1Schema, type OfferDriveFormStep1Values } from '@/schemas/activeRydSchemas';

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
          setEventError('Event with ID "' + eventId + '" not found.');
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
    console.log("[OfferDrivePage_Step1] onSubmit triggered for API route. Client form data:", data);

    if (!authUser || !userProfile) { 
      toast({ title: "Authentication Error", description: "You must be logged in and profile loaded.", variant: "destructive" });
      return;
    }
    if (!eventDetails) {
      toast({ title: "Event Error", description: "Event details are not loaded.", variant: "destructive" });
      return;
    }
    if (data.eventId !== eventId) {
        console.warn(`[OfferDrivePage_Step1] Form eventId (${data.eventId}) differs from page eventId (${eventId}). Using form's.`);
    }

    setIsSubmitting(true);
    
    let idToken;
    try {
      idToken = await authUser.getIdToken();
    } catch (error) {
      console.error("[OfferDrivePage_Step1] Error getting ID token:", error);
      toast({ title: "Authentication Error", description: "Could not get user ID token. Please try logging in again.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const payload = {
      ...data, 
      // userId is no longer explicitly sent; it will be derived from the ID token on the server
      clientProvidedFullName: userProfile.fullName,
      clientProvidedCanDrive: userProfile.canDrive || false, 
      clientProvidedEventName: eventDetails.name,
    };
    
    console.log("[OfferDrivePage_Step1] Payload for API route:", JSON.stringify(payload, null, 2));

    try {
      const response = await fetch('/api/offer-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Send the ID token
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("[OfferDrivePage_Step1] API route response:", result);

      if (response.ok && result.success) {
        toast({
          title: "Offer Update (API)",
          description: result.message,
        });
        form.reset({ eventId: eventId || "", seatsAvailable: 2, notes: "" });
      } else {
        toast({
          title: "Submission Failed (API)",
          description: result.message || result.errorDetails || "An unknown error occurred from API.",
          variant: "destructive",
        });
        if (result.issues) {
           result.issues.forEach((issue: { path: (string | number)[]; message: string; }) => {
              form.setError(issue.path[0] as keyof OfferDriveFormStep1Values, { message: issue.message });
           });
        }
      }
    } catch (error: any) {
      console.error("[OfferDrivePage_Step1] Error calling API route:", error);
      toast({
        title: "Client-Side Error",
        description: `Failed to call API: ${error.message || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
        <p className="text-muted-foreground">You must be logged in and your profile loaded to offer a drive.</p>
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
        title={`Offer to Drive (API): ${eventDetails.name}`}
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
          <CardTitle className="text-center font-headline text-xl">Your Ryd Offer (Basic - API)</CardTitle>
          <CardDescription className="text-center">
            Confirm seats and add optional notes. Submitted via API route.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
               <FormField
                control={form.control}
                name="eventId"
                render={({ field }) => (
                  <FormItem className="hidden">
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
              
              <div className="p-3 bg-blue-500/10 rounded-md text-xs text-blue-700 border border-blue-500/30">
                 <AlertTriangle className="inline h-4 w-4 mr-1.5" />
                 <span className="font-semibold">Refactor Note:</span> This form now submits to a Next.js API route (/api/offer-drive). The API route will use Firebase Admin SDK for Firestore operations and user verification.
              </div>


              <Button type="submit" className="w-full" disabled={isSubmitting || authLoading || isLoadingProfile}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Offer (API)...</>
                ) : (
                  <><Car className="mr-2 h-4 w-4" /> Submit Offer (API)</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
