

"use client";

import React, { useState, useEffect, use, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Car, Loader2, ArrowLeft, Clock, Palette, Shield, CalendarCheck2, Info, Users, ArrowRight, ArrowLeftRight } from "lucide-react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { type EventData, type RydData, type UserProfileData, PassengerManifestStatus, RydDirection } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { format, parse, isValid, addHours } from 'date-fns';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { offerDriveFormSchema, type OfferDriveFormValues } from '@/schemas/activeRydSchemas';

export const dynamic = 'force-dynamic';

interface ResolvedPageParams {
  eventId: string;
}

const formatAddress = (address: string) => address || "No address provided";

const getValidDate = (timestamp: any): Date | null => {
    if (!timestamp) return null;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') { // Firebase Timestamp object
        return timestamp.toDate();
    }
    if (typeof timestamp.seconds === 'number') { // Serialized Firestore Timestamp
        return new Date(timestamp.seconds * 1000);
    }
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date;
    }
    return null;
  };


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

  const sortedSavedLocations = useMemo(() => {
    const locations = userProfile?.savedLocations || [];
    const defaultId = userProfile?.defaultLocationId;
    if (!defaultId) return locations;
    const defaultLocation = locations.find(loc => loc.id === defaultId);
    if (!defaultLocation) return locations;
    return [defaultLocation, ...locations.filter(loc => loc.id !== defaultId)];
  }, [userProfile?.savedLocations, userProfile?.defaultLocationId]);

  const form = useForm<OfferDriveFormValues>({
    resolver: zodResolver(offerDriveFormSchema),
    defaultValues: {
      direction: RydDirection.TO_EVENT,
      eventId: eventId || "",
      seatsAvailable: 2,
      notes: "",
      proposedDepartureTime: "17:00",
      plannedArrivalTime: "17:30",
      vehicleMakeModel: userProfile?.driverDetails?.primaryVehicle || "",
      vehicleColor: "",
      licensePlate: "",
      driverStartLocation: "",
      driverEndLocation: "",
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
      const defaultLocation = sortedSavedLocations.length > 0 && sortedSavedLocations[0].id === userProfile.defaultLocationId ? sortedSavedLocations[0] : null;
      
      const direction = form.getValues("direction");
      if (direction === RydDirection.TO_EVENT && defaultLocation && !form.getValues("driverStartLocation")) {
         form.setValue("driverStartLocation", defaultLocation.address);
      } else if (direction === RydDirection.FROM_EVENT && defaultLocation && !form.getValues("driverEndLocation")) {
         form.setValue("driverEndLocation", defaultLocation.address);
      }
    }
  }, [userProfile, form, sortedSavedLocations]);

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
          if (!requestId && fetchedEvent.eventStartTimestamp) {
            const eventDateObj = getValidDate(fetchedEvent.eventStartTimestamp);
            
            if (eventDateObj && isValid(eventDateObj)) {
                form.setValue("plannedArrivalTime", format(eventDateObj, "HH:mm"));
                const departureDateObj = new Date(eventDateObj.getTime());
                departureDateObj.setHours(departureDateObj.getHours() - 1);
                form.setValue("proposedDepartureTime", format(departureDateObj, "HH:mm"));
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
  }, [eventId, form, requestId]);

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
          
          if (requestData.rydTimestamp instanceof Timestamp) {
            const rydDateTime = requestData.rydTimestamp.toDate();
            form.setValue("plannedArrivalTime", format(rydDateTime, "HH:mm"));
            const departureTime = new Date(rydDateTime.getTime() - (60 * 60 * 1000));
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


  const direction = form.watch("direction");
  useEffect(() => {
    if(eventDetails) {
      if(direction === RydDirection.TO_EVENT) {
        form.setValue("driverEndLocation", eventDetails.location || "");
        form.setValue("driverStartLocation", "");
        
        // When switching TO event, set times relative to event start
        const eventStartDate = getValidDate(eventDetails.eventStartTimestamp);
        if (eventStartDate && isValid(eventStartDate)) {
            form.setValue("plannedArrivalTime", format(eventStartDate, "HH:mm"));
            const departureDateObj = new Date(eventStartDate.getTime());
            departureDateObj.setHours(departureDateObj.getHours() - 1);
            form.setValue("proposedDepartureTime", format(departureDateObj, "HH:mm"));
        }

      } else if (direction === RydDirection.FROM_EVENT) {
        form.setValue("driverStartLocation", eventDetails.location || "");
        form.setValue("driverEndLocation", "");
        
        // When switching FROM event, set times relative to event end
        const eventEndDate = getValidDate(eventDetails.eventEndTimestamp);
        if (eventEndDate && isValid(eventEndDate)) {
            form.setValue("proposedDepartureTime", format(eventEndDate, "HH:mm"));
            const arrivalDateObj = new Date(eventEndDate.getTime());
            arrivalDateObj.setHours(arrivalDateObj.getHours() + 1);
            form.setValue("plannedArrivalTime", format(arrivalDateObj, "HH:mm"));
        }
      }
    }
  }, [direction, eventDetails, form]);


  async function onSubmit(data: OfferDriveFormValues) {
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
      toast({ title: "Authentication Error", description: "Could not get user ID token. Please try logging in again.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    const payload: any = { ...data };
    if (originalRydRequest) {
      payload.fulfillingRequestId = originalRydRequest.id;
      payload.passengersToFulfill = originalRydRequest.passengerIds;
    }

    try {
      const response = await fetch('/api/offer-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Authorization-Id-Token': idToken,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          const result = await response.json();
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
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.message || errorJson.errorDetails || errorMessage;
        } catch (e) {
            console.error("[OfferDrivePage] Non-OK response was not JSON:", errorText.substring(0, 500));
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

  const isDestinationDisabled = direction === RydDirection.TO_EVENT;
  const isStartLocationDisabled = direction === RydDirection.FROM_EVENT;
  const startLocationLabel = direction === RydDirection.TO_EVENT ? "Your Starting Location" : "Pickup Location (Event)";
  const endLocationLabel = direction === RydDirection.TO_EVENT ? "Destination (Event)" : "Your Drop-off Destination";
  
  const eventDate = getValidDate(eventDetails.eventStartTimestamp);
  const isEventDateValid = eventDate && isValid(eventDate);

  const departureLabel = direction === RydDirection.FROM_EVENT ? "Proposed Departure Time from Event" : "Proposed Departure Time";
  const departureDescription = direction === RydDirection.FROM_EVENT ? "When you plan to leave the event." : "When you plan to leave your start location.";
  const arrivalLabel = direction === RydDirection.FROM_EVENT ? "Latest Arrival Time to Destination" : "Planned Arrival Time at Event";
  const arrivalDescription = direction === RydDirection.FROM_EVENT ? "When you aim to arrive at the final destination." : (requestId ? "Arrival time set by request." : "When you aim to arrive at the event.");

  return (
    <>
      <PageHeader
        title={`Offer to Drive: ${eventDetails.name}`}
        description={`Event at ${eventDetails.location} on ${isEventDateValid ? format(eventDate, "PPP") : 'Date TBD'}. Specify your ryd details.`}
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
                name="direction"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Ryd Direction</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col sm:flex-row gap-4"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0 flex-1 border p-4 rounded-md has-[:checked]:border-primary">
                          <FormControl>
                            <RadioGroupItem value={RydDirection.TO_EVENT} />
                          </FormControl>
                          <FormLabel className="font-normal flex items-center gap-2">
                             <ArrowRight className="h-4 w-4"/> To Event
                          </FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 flex-1 border p-4 rounded-md has-[:checked]:border-primary">
                          <FormControl>
                            <RadioGroupItem value={RydDirection.FROM_EVENT} />
                          </FormControl>
                          <FormLabel className="font-normal flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4"/> From Event
                          </FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="driverStartLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{startLocationLabel}</FormLabel>
                        {direction === 'to_event' && !isStartLocationDisabled && sortedSavedLocations.length > 0 && (
                            <Select
                            onValueChange={(value) => {
                                const selectedLoc = sortedSavedLocations.find(loc => loc.id === value);
                                if (selectedLoc) form.setValue("driverStartLocation", formatAddress(selectedLoc.address));
                            }}
                            >
                            <SelectTrigger className="mt-1 mb-2"> <SelectValue placeholder="Or use a saved location..." /> </SelectTrigger>
                            <SelectContent>
                                {sortedSavedLocations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}> {`${loc.name} (${formatAddress(loc.address)})`} </SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        )}
                        <FormControl>
                          <Input placeholder="e.g., My home (123 Main St)" {...field} disabled={isStartLocationDisabled} className={isStartLocationDisabled ? "bg-muted/50" : ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="driverEndLocation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{endLocationLabel}</FormLabel>
                        {direction === 'from_event' && !isDestinationDisabled && sortedSavedLocations.length > 0 && (
                            <Select
                            onValueChange={(value) => {
                                const selectedLoc = sortedSavedLocations.find(loc => loc.id === value);
                                if (selectedLoc) form.setValue("driverEndLocation", formatAddress(selectedLoc.address));
                            }}
                            >
                            <SelectTrigger className="mt-1 mb-2"> <SelectValue placeholder="Or use a saved location..." /> </SelectTrigger>
                            <SelectContent>
                                {sortedSavedLocations.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}> {`${loc.name} (${formatAddress(loc.address)})`} </SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                        )}
                        <FormControl>
                          <Input placeholder="e.g., 123 Main St, Anytown" {...field} disabled={isDestinationDisabled} className={isDestinationDisabled ? "bg-muted/50" : ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

               <FormField
                control={form.control}
                name="seatsAvailable"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Seats (excluding driver)</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))} 
                      defaultValue={String(field.value)}
                      value={String(field.value)}
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
                        <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground"/>{departureLabel}</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} />
                        </FormControl>
                        <FormDescription>{departureDescription}</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="plannedArrivalTime"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="flex items-center"><CalendarCheck2 className="mr-2 h-4 w-4 text-muted-foreground"/>{arrivalLabel}</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} className={requestId ? "bg-muted/50" : ""} readOnly={!!requestId} />
                        </FormControl>
                        <FormDescription>{arrivalDescription}</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
              </div>

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
