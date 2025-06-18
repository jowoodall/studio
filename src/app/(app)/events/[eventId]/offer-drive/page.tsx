
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
import { AlertTriangle, Car, Loader2, ArrowLeft, Clock, Palette, Shield, CalendarCheck2 } from "lucide-react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { type EventData } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { format } from "date-fns";

import { offerDriveFormSchema, type OfferDriveFormValues } from '@/schemas/activeRydSchemas';

interface ResolvedPageParams {
  eventId: string;
}

export default function OfferDrivePage({ params: paramsPromise }: { params: Promise<ResolvedPageParams> }) {
  const params = use(paramsPromise);
  const { eventId } = params || {};

  const { toast } = useToast();
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  
  const [eventDetails, setEventDetails] = useState<EventData | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OfferDriveFormValues>({
    resolver: zodResolver(offerDriveFormSchema),
    defaultValues: {
      eventId: eventId || "",
      seatsAvailable: 2,
      notes: "",
      proposedDepartureTime: "17:00", 
      plannedArrivalTime: "17:30", 
      vehicleMakeModel: userProfile?.driverDetails?.primaryVehicle || "", 
      vehicleColor: "",
      licensePlate: "",
      driverStartLocation: userProfile?.address?.street ? `${userProfile.address.street}, ${userProfile.address.city || ''}`.trim().replace(/,$/, '') : "", 
    },
  });

  useEffect(() => {
    if (eventId && !form.getValues("eventId")) {
      form.setValue("eventId", eventId);
    }
  }, [eventId, form]);
  
  useEffect(() => {
    if (userProfile) {
      if (!form.getValues("vehicleMakeModel") && userProfile.driverDetails?.primaryVehicle) {
        form.setValue("vehicleMakeModel", userProfile.driverDetails.primaryVehicle);
      }
      if (!form.getValues("driverStartLocation") && userProfile.address?.street) {
         form.setValue("driverStartLocation", `${userProfile.address.street}, ${userProfile.address.city || ''}`.trim().replace(/,$/, ''));
      }
    }
  }, [userProfile, form]);


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
          const fetchedEvent = { id: eventDocSnap.id, ...eventDocSnap.data() } as EventData;
          setEventDetails(fetchedEvent);
          if (fetchedEvent.eventTimestamp) {
            const eventDateObj = fetchedEvent.eventTimestamp.toDate(); // This is the actual event date and time
            const currentPlannedArrivalTime = form.getValues("plannedArrivalTime");
            const currentProposedDepartureTime = form.getValues("proposedDepartureTime");

            // Handle Planned Arrival Time
            if (!currentPlannedArrivalTime || currentPlannedArrivalTime === "17:30") { // If it's the initial default
              const eventStartTimeStr = format(eventDateObj, "HH:mm");
              form.setValue("plannedArrivalTime", eventStartTimeStr);
              // Now, also set proposed departure based on this new planned arrival time
              const departureDateObj = new Date(eventDateObj.getTime());
              departureDateObj.setHours(departureDateObj.getHours() - 1);
              form.setValue("proposedDepartureTime", format(departureDateObj, "HH:mm"));
            } else {
              // Planned arrival time was already set (e.g., by user or previous load).
              // Let's still check if proposed departure is default and set it based on current planned arrival.
              if (!currentProposedDepartureTime || currentProposedDepartureTime === "17:00") {
                  const [arrHours, arrMinutes] = currentPlannedArrivalTime.split(':').map(Number);
                  if (!isNaN(arrHours) && !isNaN(arrMinutes)) {
                      const arrivalDateTimeForCalc = new Date(eventDateObj); // Use event's date part for consistency
                      arrivalDateTimeForCalc.setHours(arrHours, arrMinutes, 0, 0);
                      
                      const departureDateObj = new Date(arrivalDateTimeForCalc.getTime());
                      departureDateObj.setHours(departureDateObj.getHours() - 1);
                      form.setValue("proposedDepartureTime", format(departureDateObj, "HH:mm"));
                  }
              }
            }
          }
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
    if (eventId) {
        fetchEventDetails();
    }
  }, [eventId, form]);

  async function onSubmit(data: OfferDriveFormValues) {
    console.log("[OfferDrivePage] onSubmit triggered for API route. Client form data:", data);

    if (!authUser || !userProfile) { 
      toast({ title: "Authentication Error", description: "You must be logged in and profile loaded.", variant: "destructive" });
      return;
    }
    if (!eventDetails) {
      toast({ title: "Event Error", description: "Event details are not loaded.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    
    let idToken;
    try {
      idToken = await authUser.getIdToken();
    } catch (error) {
      console.error("[OfferDrivePage] Error getting ID token:", error);
      toast({ title: "Authentication Error", description: "Could not get user ID token. Please try logging in again.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const payload = { ...data }; 
    
    console.log("[OfferDrivePage] Payload for API route:", JSON.stringify(payload, null, 2));

    try {
      const response = await fetch('/api/offer-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, 
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log("[OfferDrivePage] API route response:", result);

      if (response.ok && result.success) {
        toast({
          title: "Offer Submitted (API)",
          description: result.message,
        });
        
        // Reset form with intelligent defaults for times
        let resetPlannedArrivalTime = "17:30";
        let resetProposedDepartureTime = "17:00";
        
        if (eventDetails?.eventTimestamp) {
            const eventDateForReset = eventDetails.eventTimestamp.toDate();
            resetPlannedArrivalTime = format(eventDateForReset, "HH:mm");
            
            const departureDateForReset = new Date(eventDateForReset.getTime());
            departureDateForReset.setHours(departureDateForReset.getHours() - 1);
            resetProposedDepartureTime = format(departureDateForReset, "HH:mm");
        }

        form.reset({ 
            eventId: eventId || "", 
            seatsAvailable: 2, 
            notes: "",
            proposedDepartureTime: resetProposedDepartureTime,
            plannedArrivalTime: resetPlannedArrivalTime,
            vehicleMakeModel: userProfile?.driverDetails?.primaryVehicle || "",
            vehicleColor: "",
            licensePlate: "",
            driverStartLocation: userProfile?.address?.street ? `${userProfile.address.street}, ${userProfile.address.city || ''}`.trim().replace(/,$/, '') : "",
        });
        // router.push(`/events/${eventId}/rydz`);
      } else {
        toast({
          title: "Submission Failed (API)",
          description: result.message || result.errorDetails || "An unknown error occurred from API.",
          variant: "destructive",
        });
        if (result.issues) {
           result.issues.forEach((issue: { path: (string | number)[]; message: string; }) => {
              form.setError(issue.path.join(".") as keyof OfferDriveFormValues, { message: issue.message });
           });
        }
      }
    } catch (error: any) {
      console.error("[OfferDrivePage] Error calling API route:", error);
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
        <p className="text-muted-foreground px-4">{eventError || 'Event with ID "' + eventId + '" not found.'}</p>
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
        description={`Event at ${eventDetails.location} on ${format(eventDate, "PPP 'at' p")}. Specify your ryd details.`}
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
            Provide comprehensive details about your ryd.
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="proposedDepartureTime"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground"/>Proposed Departure Time</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} />
                        </FormControl>
                        <FormDescription>When you plan to leave your start location.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="plannedArrivalTime"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><CalendarCheck2 className="mr-2 h-4 w-4 text-muted-foreground"/>Planned Arrival Time</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} />
                        </FormControl>
                        <FormDescription>When you aim to arrive at the event.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              </div>

              <FormField
                  control={form.control}
                  name="driverStartLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Starting Location / General Pickup Area</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., My home (123 Main St), or 'Downtown Area'" {...field} />
                      </FormControl>
                      <FormDescription>Where will you be starting your ryd from?</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

              <FormField
                  control={form.control}
                  name="vehicleMakeModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehicle Make & Model</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Toyota Camry, Honda CR-V" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="vehicleColor"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><Palette className="mr-2 h-4 w-4 text-muted-foreground"/>Vehicle Color (Optional)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., Blue, Silver" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="licensePlate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><Shield className="mr-2 h-4 w-4 text-muted-foreground"/>License Plate (Optional)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., ABC-123" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">Helps passengers identify your car.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., 'Flexible with pickup times within 15 mins.', 'Have space for small luggage.'"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="p-3 bg-muted/50 rounded-md text-sm space-y-1">
                <p><span className="font-semibold">Event:</span> {eventDetails.name}</p>
                <p><span className="font-semibold">Date:</span> {format(eventDate, "PPP")}</p>
                <p><span className="font-semibold">Time:</span> {format(eventDate, "p")}</p>
                <p><span className="font-semibold">Location:</span> {eventDetails.location}</p>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || authLoading || isLoadingProfile}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Offer...</>
                ) : (
                  <><Car className="mr-2 h-4 w-4" /> Submit Ryd Offer</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}

