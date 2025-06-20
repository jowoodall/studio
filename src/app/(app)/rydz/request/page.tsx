
"use client"; 

import React, { useState, useEffect, useCallback } from "react"; 
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
import { format, parse } from "date-fns";
import { CalendarIcon, Car, Loader2, Users, Check, X, Info, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, addDoc, serverTimestamp, doc, getDoc as getFirestoreDoc } from "firebase/firestore";
import { UserRole, type EventData, type RydData, type RydStatus, type UserProfileData, type ActiveRyd, PassengerManifestStatus } from "@/types";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter, useSearchParams } from "next/navigation"; 
import Link from "next/link";
import { submitPassengerDetailsForActiveRydAction } from "@/actions/activeRydActions";


interface ManagedStudentSelectItem {
  id: string;
  fullName: string;
}

const createRydRequestFormSchema = (userRole?: UserRole, isJoinOfferContext?: boolean) => z.object({ 
  eventId: z.string().optional(), 
  eventName: z.string().optional(),
  destination: z.string().min(1, "Destination address is required."), 
  pickupLocation: z.string().min(3, "Pickup location must be at least 3 characters."),
  date: z.date({ required_error: "Date of ryd is required." }).optional().nullable(),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  earliestPickupTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  passengerUids: z.array(z.string()).optional(), 
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (!isJoinOfferContext) { 
      if (data.eventId === "custom" && (!data.eventName || data.eventName.trim().length < 3)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Event name must be at least 3 characters when 'Other' event is selected.",
          path: ["eventName"],
        });
      }
      if (userRole === UserRole.PARENT && (!data.passengerUids || data.passengerUids.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please select at least one passenger (student or yourself).",
          path: ["passengerUids"],
        });
      }
      if (!data.date) {
          ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Date of ryd is required.",
              path: ["date"],
          });
      }
       if (data.destination.trim().length < 5 && !isJoinOfferContext) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Destination address must be at least 5 characters.",
            path: ["destination"],
        });
      }
    }
});

type RydRequestFormValues = z.infer<ReturnType<typeof createRydRequestFormSchema>>;


export default function RydRequestPage() { 
  const { toast } = useToast();
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  const router = useRouter(); 
  const searchParams = useSearchParams(); 

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [availableEvents, setAvailableEvents] = useState<EventData[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const [managedStudentsList, setManagedStudentsList] = useState<ManagedStudentSelectItem[]>([]);
  const [isLoadingManagedStudents, setIsLoadingManagedStudents] = useState(true); 
  const [studentPopoverOpen, setStudentPopoverOpen] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");

  const [isJoinOfferContext, setIsJoinOfferContext] = useState(false);
  const [activeRydIdForUpdate, setActiveRydIdForUpdate] = useState<string | null>(null);
  const [passengerIdForUpdate, setPassengerIdForUpdate] = useState<string | null>(null);
  const [activeRydBeingUpdated, setActiveRydBeingUpdated] = useState<ActiveRyd | null>(null);
  const [eventForActiveRyd, setEventForActiveRyd] = useState<EventData | null>(null);
  const [isLoadingJoinOfferDetails, setIsLoadingJoinOfferDetails] = useState(false);
  const [joinOfferError, setJoinOfferError] = useState<string | null>(null);


  const form = useForm<RydRequestFormValues>({ 
    resolver: zodResolver(createRydRequestFormSchema(userProfile?.role, isJoinOfferContext)), 
    defaultValues: {
      eventId: undefined,
      eventName: "",
      destination: "",
      pickupLocation: "",
      date: undefined, 
      time: "09:00", 
      earliestPickupTime: "08:00",
      passengerUids: [],
      notes: "", 
    }
  });
  
  useEffect(() => {
    const eventIdQuery = searchParams.get('eventId');
    const activeRydIdQuery = searchParams.get('activeRydId');
    const passengerIdQuery = searchParams.get('passengerId');
    const contextQuery = searchParams.get('context');

    const fetchJoinOfferDetails = async (arId: string, pId: string) => {
      setIsLoadingJoinOfferDetails(true);
      setJoinOfferError(null);
      try {
        const activeRydDocRef = doc(db, "activeRydz", arId);
        const activeRydSnap = await getFirestoreDoc(activeRydDocRef);
        if (!activeRydSnap.exists()) throw new Error("Active Ryd not found.");
        const fetchedActiveRyd = { id: activeRydSnap.id, ...activeRydSnap.data() } as ActiveRyd;
        setActiveRydBeingUpdated(fetchedActiveRyd);

        let fetchedEvent: EventData | null = null;
        if (fetchedActiveRyd.associatedEventId) {
          const eventDocRef = doc(db, "events", fetchedActiveRyd.associatedEventId);
          const eventSnap = await getFirestoreDoc(eventDocRef);
          if (eventSnap.exists()) fetchedEvent = { id: eventSnap.id, ...eventSnap.data() } as EventData;
          else console.warn("Associated event not found for ActiveRyd");
        }
        setEventForActiveRyd(fetchedEvent);

        form.setValue("destination", fetchedActiveRyd.finalDestinationAddress || fetchedEvent?.location || "Event Location");
        form.setValue("eventName", fetchedEvent?.name || fetchedActiveRyd.eventName || "Event");
        
        let rydEventDate: Date;
        if (fetchedEvent?.eventTimestamp) {
            rydEventDate = fetchedEvent.eventTimestamp.toDate();
        } else if (fetchedActiveRyd.plannedArrivalTime) {
            rydEventDate = fetchedActiveRyd.plannedArrivalTime.toDate(); 
        } else {
            rydEventDate = new Date(); 
            console.warn("Could not determine event date for prefill from ActiveRyd or Event.");
        }
        form.setValue("date", rydEventDate);
        form.setValue("time", format(rydEventDate, "HH:mm"));
        
        if (userProfile?.address?.street && !form.getValues("pickupLocation")) {
             form.setValue("pickupLocation", `${userProfile.address.street}, ${userProfile.address.city || ''}`.trim().replace(/,$/, ''));
        }
        if (userProfile?.role === UserRole.PARENT) {
            form.setValue("passengerUids", [pId]);
        }


      } catch (error: any) {
        console.error("Error fetching details for joinOffer context:", error);
        setJoinOfferError(error.message || "Failed to load ryd details for submission.");
        toast({ title: "Error", description: error.message || "Failed to load ryd details.", variant: "destructive" });
      } finally {
        setIsLoadingJoinOfferDetails(false);
      }
    };

    if (contextQuery === 'joinOffer' && activeRydIdQuery && passengerIdQuery) {
      setIsJoinOfferContext(true);
      setActiveRydIdForUpdate(activeRydIdQuery);
      setPassengerIdForUpdate(passengerIdQuery);
      fetchJoinOfferDetails(activeRydIdQuery, passengerIdQuery);
    } else {
      setIsJoinOfferContext(false);
      if (eventIdQuery && availableEvents.length > 0) {
        const eventExists = availableEvents.some(event => event.id === eventIdQuery);
        if (eventExists) form.setValue('eventId', eventIdQuery);
        else if (eventIdQuery === "custom") form.setValue('eventId', "custom");
      }
      if (userProfile?.address?.street && !form.getValues("pickupLocation")) {
        form.setValue("pickupLocation", `${userProfile.address.street}, ${userProfile.address.city || ''}`.trim().replace(/,$/, ''));
      }
    }
  }, [searchParams, form, userProfile, availableEvents]); 

  useEffect(() => {
    const fetchEvents = async () => {
      if (isJoinOfferContext) { 
        setIsLoadingEvents(false);
        return;
      }
      setIsLoadingEvents(true);
      try {
        const eventsQuery = query(collection(db, "events"), orderBy("eventTimestamp", "asc"));
        const querySnapshot = await getDocs(eventsQuery);
        const fetchedEvents: EventData[] = [];
        querySnapshot.forEach((eventDoc) => { 
          const eventData = eventDoc.data() as EventData;
          const eventDate = eventData.eventTimestamp instanceof Timestamp ? eventData.eventTimestamp.toDate() : new Date(0);
          if (eventDate >= new Date()) {
            fetchedEvents.push({ id: eventDoc.id, ...eventData });
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
  }, [toast, isJoinOfferContext]); 

  useEffect(() => {
    const fetchManagedStudents = async () => {
      if (authLoading || isLoadingProfile) {
        setIsLoadingManagedStudents(true);
        return;
      }
      if (!userProfile || userProfile.role !== UserRole.PARENT) {
        setManagedStudentsList([]);
        setIsLoadingManagedStudents(false);
        return;
      }
      
      setIsLoadingManagedStudents(true);
      try {
        const validStudentIds = (userProfile.managedStudentIds || []).filter(id => typeof id === 'string' && id.trim() !== '');
        
        if (validStudentIds.length === 0) {
          setManagedStudentsList([]);
          setIsLoadingManagedStudents(false);
          return;
        }
        
        const studentPromises = validStudentIds.map(async (studentId) => {
          try {
            const studentDocRef = doc(db, "users", studentId); 
            const studentDocSnap = await getFirestoreDoc(studentDocRef); 
            if (studentDocSnap.exists()) {
              const studentData = studentDocSnap.data() as UserProfileData;
              return { id: studentDocSnap.id, fullName: studentData.fullName };
            } else {
              return null;
            }
          } catch (studentError) {
            return null; 
          }
        });
        const studentsData = (await Promise.all(studentPromises));
        const validStudents = studentsData.filter(Boolean) as ManagedStudentSelectItem[];
        setManagedStudentsList(validStudents);

      } catch (error: any) {
        toast({ title: "Error", description: "Could not load your managed students. Check console for details.", variant: "destructive" });
        setManagedStudentsList([]);
      } finally {
        setIsLoadingManagedStudents(false);
      }
    };
  
    if (!authLoading && !isLoadingProfile) {
      fetchManagedStudents();
    }
  }, [userProfile, authLoading, isLoadingProfile, toast]);


  async function onSubmit(data: RydRequestFormValues) { 
    if (!authUser || !userProfile) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!data.date && !isJoinOfferContext) { 
        toast({ title: "Validation Error", description: "Date of ryd is required.", variant: "destructive" });
        form.setError("date", { type: "manual", message: "Date of ryd is required." });
        return;
    }
    setIsSubmitting(true);

    if (isJoinOfferContext && activeRydIdForUpdate && passengerIdForUpdate) {
        if (!activeRydBeingUpdated) {
            toast({title: "Error", description: "Active Ryd details not loaded for update.", variant: "destructive"});
            setIsSubmitting(false);
            return;
        }
        let eventDateForAction: Date;
        if (eventForActiveRyd?.eventTimestamp) {
            eventDateForAction = eventForActiveRyd.eventTimestamp.toDate();
        } else if (activeRydBeingUpdated.plannedArrivalTime) {
            eventDateForAction = activeRydBeingUpdated.plannedArrivalTime.toDate();
        } else {
             toast({title: "Error", description: "Cannot determine event date for pickup time.", variant: "destructive"});
             setIsSubmitting(false);
             return;
        }

        try {
            const result = await submitPassengerDetailsForActiveRydAction({
                activeRydId: activeRydIdForUpdate,
                passengerUserId: passengerIdForUpdate,
                pickupLocation: data.pickupLocation.trim(),
                earliestPickupTimeStr: data.earliestPickupTime,
                eventDate: eventDateForAction,
                notes: data.notes ? data.notes.trim() : "",
            });
            if (result.success) {
                toast({ title: "Details Submitted!", description: result.message });
                router.push(`/rydz/tracking/${activeRydIdForUpdate}`);
            } else {
                toast({ title: "Submission Failed", description: result.message, variant: "destructive"});
            }
        } catch (error: any) {
            toast({ title: "Error", description: `Failed to submit details: ${error.message}`, variant: "destructive"});
        }

    } else {
        if (!data.date) { 
            toast({ title: "Validation Error", description: "Date of ryd is required for new request.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        let finalPassengerUids: string[] = [];
        if (userProfile.role === UserRole.PARENT) finalPassengerUids = data.passengerUids || [];
        else if (userProfile.role === UserRole.STUDENT) finalPassengerUids = [authUser.uid];
        else {
          toast({ title: "Role Error", description: "Your user role does not permit ryd requests.", variant: "destructive" });
          setIsSubmitting(false); return;
        }

        const [eventHours, eventMinutes] = data.time.split(':').map(Number);
        const eventStartDateTime = new Date(data.date);
        eventStartDateTime.setHours(eventHours, eventMinutes, 0, 0);
        
        const [pickupHours, pickupMinutes] = data.earliestPickupTime.split(':').map(Number);
        const earliestPickupDateTime = new Date(data.date);
        earliestPickupDateTime.setHours(pickupHours, pickupMinutes, 0, 0);
        
        if (isNaN(eventStartDateTime.getTime()) || isNaN(earliestPickupDateTime.getTime())) {
            toast({title: "Date/Time Error", description: "Invalid date or time provided.", variant: "destructive"});
            setIsSubmitting(false); return;
        }

        const eventStartFirestoreTimestamp = Timestamp.fromDate(eventStartDateTime);
        const earliestPickupFirestoreTimestamp = Timestamp.fromDate(earliestPickupDateTime);

        const rydRequestPayload: Partial<RydData> = { 
          requestedBy: authUser.uid,
          destination: data.destination.trim(),
          pickupLocation: data.pickupLocation.trim(),
          rydTimestamp: eventStartFirestoreTimestamp,
          earliestPickupTimestamp: earliestPickupFirestoreTimestamp,
          notes: data.notes ? data.notes.trim() : "",
          status: 'requested' as RydStatus,
          passengerIds: finalPassengerUids,
          createdAt: serverTimestamp() as Timestamp,
        };

        if (data.eventId && data.eventId !== "custom") {
          rydRequestPayload.eventId = data.eventId;
          const selectedEvent = availableEvents.find(e => e.id === data.eventId);
          if (selectedEvent?.name) rydRequestPayload.eventName = selectedEvent.name.trim();
        } else if (data.eventName?.trim()) {
          rydRequestPayload.eventName = data.eventName.trim();
        }
        
        try {
          const docRef = await addDoc(collection(db, "rydz"), rydRequestPayload as Omit<RydData, 'id' | 'updatedAt'>);
          toast({
            title: "Ryd Requested!", 
            description: `Your request (ID: ${docRef.id}) to ${rydRequestPayload.eventName || rydRequestPayload.destination} submitted.`, 
          });
          const redirectUrl = searchParams.get('redirectUrl');
          router.push(redirectUrl || '/rydz/upcoming'); 
        } catch (error: any) {
            toast({ title: "Request Failed", description: error.message || "Could not submit ryd request.", variant: "destructive" });
        }
    }
    setIsSubmitting(false);
  }

  const selectedEventId = form.watch("eventId");

  useEffect(() => {
    if (isJoinOfferContext) return; 

    if (selectedEventId && selectedEventId !== "custom") {
      const event = availableEvents.find(e => e.id === selectedEventId);
      if (event) {
        form.setValue("destination", event.location ? event.location.trim() : "");
        form.setValue("eventName", ""); 
        if (event.eventTimestamp) {
            const eventDate = event.eventTimestamp.toDate();
            form.setValue("date", eventDate);
            form.setValue("time", format(eventDate, "HH:mm"));
        }
      }
    } else if (selectedEventId === "custom") {
      form.setValue("eventName", form.getValues("eventName") || ""); 
      form.setValue("destination", form.getValues("destination") || ""); 
    }
  }, [selectedEventId, form, availableEvents, isJoinOfferContext]);
  
  const handleStudentSelection = (studentId: string) => {
    const currentSelectedStudents = form.getValues("passengerUids") || [];
    const newSelectedStudents = currentSelectedStudents.includes(studentId)
      ? currentSelectedStudents.filter(id => id !== studentId)
      : [...currentSelectedStudents, studentId];
    form.setValue("passengerUids", newSelectedStudents, { shouldValidate: true });
  };

  const getFilteredStudentsForPopover = () => {
    let baseList = [...managedStudentsList];
    if (userProfile?.role === UserRole.PARENT && authUser) {
        const parentSelfEntry = { id: authUser.uid, fullName: `${userProfile.fullName} (Me)` };
        // Add parent self to list if not already there (e.g. if managedStudentsList is empty)
        if (!baseList.some(s => s.id === authUser.uid)) {
             baseList.unshift(parentSelfEntry);
        } else { // Ensure parent's name is updated with "(Me)"
            baseList = baseList.map(s => s.id === authUser.uid ? parentSelfEntry : s);
        }
    }
    return baseList.filter(student =>
        student.fullName.toLowerCase().includes(studentSearchTerm.toLowerCase())
    );
  };
  const filteredStudentsForPopover = getFilteredStudentsForPopover();

  const currentSelectedStudentUids = form.watch("passengerUids") || [];

  const pageTitle = isJoinOfferContext ? "Provide Pickup Details" : "Request a Ryd";
  const pageDescription = isJoinOfferContext 
    ? `Confirm your pickup information for the ryd to ${activeRydBeingUpdated?.eventName || activeRydBeingUpdated?.finalDestinationAddress || "the event"}.`
    : "Fill out the details below to request a ryd to an event or destination.";
  const submitButtonText = isJoinOfferContext ? "Submit Pickup Details" : "Submit Ryd Request";

  if (authLoading || isLoadingProfile || (isJoinOfferContext && isLoadingJoinOfferDetails)) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Loading details...</p>
        </div>
    );
  }
  if (isJoinOfferContext && joinOfferError) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Error Loading Ryd Information</h2>
            <p className="text-muted-foreground px-4">{joinOfferError}</p>
            <Button asChild className="mt-4" variant="outline">
                <Link href={activeRydBeingUpdated?.associatedEventId ? `/events/${activeRydBeingUpdated.associatedEventId}/rydz` : "/dashboard"}>
                   <ArrowLeft className="mr-2 h-4 w-4"/> Back
                </Link>
            </Button>
        </div>
    );
  }
  
  return (
    <>
      <PageHeader title={pageTitle} description={pageDescription} />
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">{isJoinOfferContext ? "Confirm Your Pickup" : "Ryd Details"}</CardTitle> 
          <CardDescription>{isJoinOfferContext ? "Please provide your pickup location and earliest time." : "Please provide accurate information for your ryd request."}</CardDescription> 
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {!isJoinOfferContext && (
                <FormField
                  control={form.control}
                  name="eventId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select Event (Optional)</FormLabel>
                      <Select 
                          onValueChange={(value) => field.onChange(value)} 
                          defaultValue={field.value}
                          value={field.value || undefined}
                          disabled={isLoadingEvents}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingEvents ? "Loading events..." : "Choose an existing event or 'Other'"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {!isLoadingEvents && availableEvents.map(event => (
                            <SelectItem key={event.id} value={event.id}>{event.name} ({event.eventTimestamp instanceof Timestamp ? format(event.eventTimestamp.toDate(), "MMM d, p") : 'Invalid Date'})</SelectItem>
                          ))}
                           <SelectItem value="custom">Other (Specify Below)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>If your event is not listed, choose "Other".</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {((!isJoinOfferContext && selectedEventId === "custom") || (!selectedEventId && form.getValues("eventName")) || (isJoinOfferContext && activeRydBeingUpdated?.eventName)) && ( 
                 <FormField
                    control={form.control}
                    name="eventName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Birthday Party, Study Group" {...field} disabled={isJoinOfferContext} className={isJoinOfferContext ? "bg-muted/50" : ""} />
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
                      <Input placeholder="e.g., 123 Main St, Anytown" {...field} disabled={isJoinOfferContext || (!!selectedEventId && selectedEventId !== "custom")} className={(isJoinOfferContext || (!!selectedEventId && selectedEventId !== "custom")) ? "bg-muted/50" : ""} />
                    </FormControl>
                     {!isJoinOfferContext && selectedEventId && selectedEventId !== "custom" && <FormDescription>Destination auto-filled from selected event.</FormDescription>}
                     {isJoinOfferContext && <FormDescription>Destination set by ryd offer.</FormDescription>}
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

              {(authLoading || isLoadingProfile) && !isJoinOfferContext && (
                <div className="space-y-2"> <Skeleton className="h-4 w-1/4" /> <Skeleton className="h-10 w-full" /> </div>
              )}

              {!isJoinOfferContext && !authLoading && !isLoadingProfile && userProfile && (
                <FormField
                  control={form.control}
                  name="passengerUids"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-base flex items-center"> <Users className="mr-2 h-4 w-4 text-muted-foreground" /> This ryd is for </FormLabel>
                      {userProfile.role === UserRole.STUDENT && ( <p className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/30">Me</p> )}
                      {userProfile.role === UserRole.PARENT && (
                        <>
                          <Popover open={studentPopoverOpen} onOpenChange={setStudentPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" role="combobox" aria-expanded={studentPopoverOpen} className="w-full justify-between" disabled={isLoadingManagedStudents} >
                                {isLoadingManagedStudents ? "Loading students..." : (currentSelectedStudentUids.length > 0 ? `${currentSelectedStudentUids.length} passenger(s) selected` : "Select passenger(s)...")}
                                <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command>
                                <CommandInput placeholder="Search students or 'Me'..." value={studentSearchTerm} onValueChange={setStudentSearchTerm} disabled={isLoadingManagedStudents}/>
                                <CommandList>
                                  <ScrollArea className="h-48">
                                    {isLoadingManagedStudents && <CommandEmpty><Loader2 className="h-4 w-4 animate-spin my-4 mx-auto" /></CommandEmpty>}
                                    {!isLoadingManagedStudents && filteredStudentsForPopover.length === 0 && <CommandEmpty>No students found.</CommandEmpty>}
                                    <CommandGroup>
                                      {!isLoadingManagedStudents && filteredStudentsForPopover.map((student) => (
                                        <CommandItem key={student.id} value={student.id} onSelect={() => handleStudentSelection(student.id)}>
                                          <Check className={cn("mr-2 h-4 w-4", currentSelectedStudentUids.includes(student.id) ? "opacity-100" : "opacity-0")} />
                                          {student.fullName}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </ScrollArea>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          {currentSelectedStudentUids.length > 0 && (
                            <div className="pt-2 space-x-1 space-y-1">
                              {currentSelectedStudentUids.map(passengerId => {
                                let passengerName = "";
                                if (passengerId === authUser?.uid && userProfile?.role === UserRole.PARENT) {
                                    passengerName = `${userProfile.fullName} (Me)`;
                                } else {
                                    const student = managedStudentsList.find(s => s.id === passengerId);
                                    passengerName = student ? student.fullName : `User ${passengerId.substring(0,5)}`;
                                }
                                return (
                                  <Badge key={passengerId} variant="secondary" className="mr-1"> {passengerName}
                                    <button type="button" className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={() => handleStudentSelection(passengerId)}> <X className="h-3 w-3 text-muted-foreground hover:text-foreground" /> </button>
                                  </Badge>
                                );
                              })}
                            </div>
                          )}
                          <FormMessage /> 
                        </>
                      )}
                    </FormItem>
                  )}
                />
              )}
              {isJoinOfferContext && passengerIdForUpdate && (
                <FormItem>
                    <FormLabel className="text-base flex items-center"> <Users className="mr-2 h-4 w-4 text-muted-foreground" /> This ryd is for </FormLabel>
                    <p className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/30">
                        {managedStudentsList.find(s => s.id === passengerIdForUpdate)?.fullName || (userProfile?.uid === passengerIdForUpdate ? userProfile.fullName : `User ${passengerIdForUpdate.substring(0,6)}...`) }
                    </p>
                </FormItem>
              )}

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
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground", (isJoinOfferContext || (!!selectedEventId && selectedEventId !== "custom")) && "bg-muted/50" )} disabled={isJoinOfferContext || (!!selectedEventId && selectedEventId !== "custom")} >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value || undefined} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) || isJoinOfferContext || (!!selectedEventId && selectedEventId !== "custom")} initialFocus />
                        </PopoverContent>
                      </Popover>
                      {(isJoinOfferContext || (!!selectedEventId && selectedEventId !== "custom")) && <FormDescription className="text-xs">Date auto-filled from event/offer.</FormDescription>}
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
                        <Input type="time" {...field} disabled={isJoinOfferContext || (!!selectedEventId && selectedEventId !== "custom")} className={ (isJoinOfferContext || (!!selectedEventId && selectedEventId !== "custom")) ? "bg-muted/50" : ""}/>
                      </FormControl>
                      {(isJoinOfferContext || (!!selectedEventId && selectedEventId !== "custom")) && <FormDescription className="text-xs">Event start time auto-filled.</FormDescription>}
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
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || authLoading || isLoadingProfile || (!isJoinOfferContext && (isLoadingEvents || isLoadingManagedStudents)) || (isJoinOfferContext && isLoadingJoinOfferDetails)}
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Car className="mr-2 h-4 w-4" /> {submitButtonText}</> 
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}

