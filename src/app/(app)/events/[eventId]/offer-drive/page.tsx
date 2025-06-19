
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
import { AlertTriangle, Car, Loader2, ArrowLeft, Clock, Palette, Shield, CalendarCheck2, Info, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { type EventData, type RydData, type UserProfileData, PassengerManifestStatus } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { format, parse } from 'date-fns';

import { offerDriveFormSchema, type OfferDriveFormValues } from '@/schemas/activeRydSchemas';

interface ResolvedPageParams {
  eventId: string;
}

export default function OfferDrivePage({ params: paramsPromise }: { params: Promise<ResolvedPageParams> }) {
  const params = use(paramsPromise);
  const { eventId } = params || {};
  const searchParams = useSearchParams();
  const router = useRouter();

  const { toast } = useToast();
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();

  const [eventDetails, setEventDetails] = useState<EventData | null>(null);
  const [isLoadingEvent, setIsLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [originalRydRequest, setOriginalRydRequest] = useState<RydData | null>(null);
  const [isLoadingRydRequest, setIsLoadingRydRequest] = useState(false);
  const [rydRequestError, setRydRequestError] = useState<string | null>(null);
  const [passengerNamesToFulfill, setPassengerNamesToFulfill] = useState<string>("");
  const requestId = searchParams.get('requestId');

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
          // Pre-fill times only if not fulfilling a specific request (request times will override)
          if (!requestId && fetchedEvent.eventTimestamp) {
            const eventDateObj = fetchedEvent.eventTimestamp.toDate();
            const currentPlannedArrivalTime = form.getValues("plannedArrivalTime");
            const currentProposedDepartureTime = form.getValues("proposedDepartureTime");

            if (!currentPlannedArrivalTime || currentPlannedArrivalTime === "17:30") {
              const eventStartTimeStr = format(eventDateObj, "HH:mm");
              form.setValue("plannedArrivalTime", eventStartTimeStr);
              const departureDateObj = new Date(eventDateObj.getTime());
              departureDateObj.setHours(departureDateObj.getHours() - 1);
              form.setValue("proposedDepartureTime", format(departureDateObj, "HH:mm"));
            } else {
              if (!currentProposedDepartureTime || currentProposedDepartureTime === "17:00") {
                  const [arrHours, arrMinutes] = currentPlannedArrivalTime.split(':').map(Number);
                  if (!isNaN(arrHours) && !isNaN(arrMinutes)) {
                      const arrivalDateTimeForCalc = new Date(eventDateObj);
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
  }, [eventId, form, requestId]); // Add requestId to dependency array

  useEffect(() => {
    const fetchRydRequestDetails = async () => {
      if (!requestId || !eventDetails) return; // Wait for eventDetails too

      setIsLoadingRydRequest(true);
      setRydRequestError(null);
      try {
        const requestDocRef = doc(db, "rydz", requestId);
        const requestDocSnap = await getDoc(requestDocRef);
        if (requestDocSnap.exists()) {
          const requestData = {id: requestDocSnap.id, ...requestDocSnap.data()} as RydData;
          setOriginalRydRequest(requestData);

          if (requestData.passengerIds && requestData.passengerIds.length > 0) {
            const passengerProfilePromises = requestData.passengerIds.map(async (pId) => {
              const userDocRef = doc(db, "users", pId);
              const userDocSnap = await getDoc(userDocRef);
              return userDocSnap.exists() ? (userDocSnap.data() as UserProfileData).fullName : `User ${pId.substring(0,5)}`;
            });
            const names = (await Promise.all(passengerProfilePromises)).filter(Boolean);
            setPassengerNamesToFulfill(names.join(', '));
          }
          
          // Pre-fill form based on request
          if (requestData.rydTimestamp instanceof Timestamp) {
            const rydDateTime = requestData.rydTimestamp.toDate();
            form.setValue("plannedArrivalTime", format(rydDateTime, "HH:mm"));
             // Calculate proposed departure (e.g., 1 hour before planned arrival at event)
            const departureTime = new Date(rydDateTime.getTime() - (60 * 60 * 1000)); // 1 hour earlier
            form.setValue("proposedDepartureTime", format(departureTime, "HH:mm"));
          }
          if (requestData.notes) {
            form.setValue("notes", `Fulfilling request for ${requestData.passengerIds.length} passenger(s). Original notes: "${requestData.notes}"`);
          } else {
            form.setValue("notes", `Fulfilling request for ${requestData.passengerIds.length} passenger(s).`);
          }
          if (requestData.passengerIds && requestData.passengerIds.length > 0) {
            form.setValue("seatsAvailable", Math.max(form.getValues("seatsAvailable"), requestData.passengerIds.length));
          }
          // Destination and event name are tied to the event, usually not from request.
          // Pickup location from request could be complex to auto-fill into 'driverStartLocation', so driver inputs their start.

        } else {
          setRydRequestError(`Ryd request with ID "${requestId}" not found.`);
          setOriginalRydRequest(null);
        }
      } catch (e: any) {
        console.error("Error fetching ryd request details:", e);
        setRydRequestError(`Failed to load ryd request: ${e.message}`);
        setOriginalRydRequest(null);
      } finally {
        setIsLoadingRydRequest(false);
      }
    };

    if (requestId && eventDetails) {
      fetchRydRequestDetails();
    }
  }, [requestId, eventDetails, form]);


  async function onSubmit(data: OfferDriveFormValues) {
    console.log("[OfferDrivePage] onSubmit triggered. Client form data:", data);

    if (!authUser || !userProfile) {
      toast({ title: "Authentication Error", description: "You must be logged in and profile loaded.", variant: "destructive" });
      return;
    }
    if (!eventDetails || !eventId) {
      toast({ title: "Event Error", description: "Event details are not loaded or event ID is missing.", variant: "destructive" });
      return;
    }
    if (originalRydRequest && originalRydRequest.passengerIds && data.seatsAvailable < originalRydRequest.passengerIds.length) {
        toast({ title: "Capacity Error", description: `You must offer at least ${originalRydRequest.passengerIds.length} seat(s) to fulfill this request.`, variant: "destructive" });
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

    const payload: any = { ...data };
    if (originalRydRequest) {
      payload.fulfillingRequestId = originalRydRequest.id;
      payload.passengersToFulfill = originalRydRequest.passengerIds;
    }

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

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const result = await response.json();
          console.log("[OfferDrivePage] API route response:", result);

          if (result.success) {
            toast({
              title: originalRydRequest ? "Ryd Fulfillment Offer Submitted!" : "Offer Submitted!",
              description: result.message,
            });
            router.push(`/events/${eventId}/rydz`);
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
        } else {
          const errorText = await response.text();
          console.error("[OfferDrivePage] API route did not return JSON. Response text:", errorText);
          toast({
            title: "Submission Error",
            description: "The server returned an unexpected response. This might be due to a timeout or server-side issue. Please try again later.",
            variant: "destructive",
            duration: 9000,
          });
        }
      } else {
        const errorText = await response.text();
        let errorMessage = `Server error: ${response.status} ${response.statusText}.`;
        try {
            const errorJson = JSON.parse(errorText); // Try to parse as JSON first
            errorMessage = errorJson.message || errorJson.errorDetails || errorMessage;
        } catch (e) {
            // If not JSON, it could be HTML or plain text error
            console.error("[OfferDrivePage] Non-OK response was not JSON:", errorText.substring(0, 500)); // Log first 500 chars
        }
        toast({
            title: "Submission Failed (Server)",
            description: errorMessage + " (Check console for more details if response was not JSON)",
            variant: "destructive",
            duration: 9000,
        });
      }
    } catch (error: any) {
      console.error("[OfferDrivePage] Error calling API route (fetch error):", error);
      toast({
        title: "Client-Side Error",
        description: `Failed to communicate with the server: ${error.message || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isLoadingPage = authLoading || isLoadingProfile || isLoadingEvent || isLoadingRydRequest;

  if (isLoadingPage && !eventDetails && !originalRydRequest) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Loading page data...</p>
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
          <Link href={`/login?redirect=/events/${eventId}/offer-drive${requestId ? `?requestId=${requestId}`: ''}`}>Log In</Link>
        </Button>
      </div>
    );
  }
   if ((!isLoadingEvent && eventError) || (!isLoadingRydRequest && rydRequestError)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">{eventError ? "Error Loading Event" : "Error Loading Request"}</h2>
        <p className="text-muted-foreground px-4">{eventError || rydRequestError}</p>
        <Button asChild className="mt-4">
          <Link href={`/events/${eventId}/rydz`}>Back to Event Rydz</Link>
        </Button>
      </div>
    );
  }
  if (!eventDetails && !isLoadingEvent) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Event Not Found</h2>
        <p className="text-muted-foreground px-4">Event with ID "{eventId}" not found.</p>
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
        description={`Event at ${eventDetails.location} on ${format(eventDate, "PPP")}. Specify your ryd details.`}
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
          <CardTitle className="text-center font-headline text-xl">
            {originalRydRequest ? "Fulfill Ryd Request" : "Your Ryd Offer Details"}
          </CardTitle>
          <CardDescription className="text-center">
            {originalRydRequest ? `You are offering to drive for ${passengerNamesToFulfill || 'a student'}.` : "Provide comprehensive details about your ryd."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingRydRequest && requestId && (
             <div className="flex items-center justify-center py-6">
                <Loader2 className="w-8 h-8 text-primary animate-spin mr-3" />
                <p className="text-muted-foreground">Loading ryd request details...</p>
            </div>
          )}

          {originalRydRequest && !isLoadingRydRequest && (
            <Card className="mb-6 bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-700 text-base flex items-center">
                  <Info className="mr-2 h-5 w-5" /> Fulfilling Request
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-600 space-y-1">
                <p>
                  For: <span className="font-semibold">{passengerNamesToFulfill || `${originalRydRequest.passengerIds.length} passenger(s)`}</span>
                </p>
                <p>
                  Needs to be at {eventDetails.name} by: <span className="font-semibold">{format(originalRydRequest.rydTimestamp.toDate(), "p")}</span> on <span className="font-semibold">{format(originalRydRequest.rydTimestamp.toDate(), "MMM d")}</span>.
                </p>
                {originalRydRequest.pickupLocation && <p>Requested Pickup: <span className="font-semibold">{originalRydRequest.pickupLocation}</span></p>}
                {originalRydRequest.notes && <p>Their Notes: <span className="font-semibold">"{originalRydRequest.notes}"</span></p>}
                 <p className="pt-1">
                    Please ensure your <span className="font-semibold">'Available Seats'</span> can accommodate at least {originalRydRequest.passengerIds.length} passenger(s).
                 </p>
              </CardContent>
            </Card>
          )}


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
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={String(field.value)}
                      value={String(field.value)} // Ensure select is controlled
                    >
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
                    {originalRydRequest && originalRydRequest.passengerIds && field.value < originalRydRequest.passengerIds.length && (
                        <FormMessage className="text-destructive">
                            You need at least {originalRydRequest.passengerIds.length} seat(s) for this request.
                        </FormMessage>
                    )}
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
                        <FormLabel className="flex items-center"><CalendarCheck2 className="mr-2 h-4 w-4 text-muted-foreground"/>Planned Arrival Time at Event</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} className={requestId ? "bg-muted/50" : ""} readOnly={!!requestId} />
                        </FormControl>
                        <FormDescription>{requestId ? "Arrival time set by request." : "When you aim to arrive at the event."}</FormDescription>
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
                <p><span className="font-semibold">Location:</span> {eventDetails.location}</p>
                 {originalRydRequest && <p><span className="font-semibold">Event Time from Request:</span> {format(originalRydRequest.rydTimestamp.toDate(), "p")}</p>}
                 {!originalRydRequest && <p><span className="font-semibold">Event Time from Event Details:</span> {format(eventDate, "p")}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || authLoading || isLoadingProfile || isLoadingEvent || isLoadingRydRequest}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting Offer...</>
                ) : (
                  <><Car className="mr-2 h-4 w-4" /> {originalRydRequest ? "Submit Fulfillment Offer" : "Submit Ryd Offer"}</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}

