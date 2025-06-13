
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
import { CalendarIcon, Car, Loader2, Users, Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, Timestamp, addDoc, serverTimestamp, doc, getDoc as getFirestoreDoc } from "firebase/firestore";
import { UserRole, type EventData, type RydData, type RydStatus, type UserProfileData } from "@/types";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";


interface ManagedStudentSelectItem {
  id: string;
  fullName: string;
}

const createRydRequestFormSchema = (userRole?: UserRole) => z.object({ 
  eventId: z.string().optional(), 
  eventName: z.string().optional(),
  destination: z.string().min(5, "Destination address is required."),
  pickupLocation: z.string().min(3, "Pickup location must be at least 3 characters."),
  date: z.date({ required_error: "Date of ryd is required." }), 
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  earliestPickupTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  passengerUids: z.array(z.string()).optional(), 
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
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
        message: "Please select at least one student for this ryd.",
        path: ["passengerUids"],
      });
    }
});

type RydRequestFormValues = z.infer<ReturnType<typeof createRydRequestFormSchema>>;


export default function RydRequestPage() { 
  const { toast } = useToast();
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [availableEvents, setAvailableEvents] = useState<EventData[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const [managedStudentsList, setManagedStudentsList] = useState<ManagedStudentSelectItem[]>([]);
  const [isLoadingManagedStudents, setIsLoadingManagedStudents] = useState(true); // Changed initial to true
  const [studentPopoverOpen, setStudentPopoverOpen] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState("");

  const form = useForm<RydRequestFormValues>({ 
    resolver: zodResolver(createRydRequestFormSchema(userProfile?.role)), 
    defaultValues: {
      time: "09:00", 
      earliestPickupTime: "08:00",
      destination: "",
      eventName: "",
      pickupLocation: "",
      passengerUids: [],
    }
  });

  useEffect(() => {
    const fetchEvents = async () => {
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
  }, [toast]);

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
        if (validStudentIds.length !== (userProfile.managedStudentIds || []).length) {
          console.warn("RydRequestPage: Some managedStudentIds were invalid and filtered out:", userProfile.managedStudentIds);
        }

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
              console.warn(`RydRequestPage: Managed student document with ID ${studentId} not found or not readable.`);
              return null;
            }
          } catch (studentError) {
            console.error(`RydRequestPage: Error fetching individual managed student with ID ${studentId}:`, studentError);
            return null; 
          }
        });
        const studentsData = (await Promise.all(studentPromises));
        const validStudents = studentsData.filter(Boolean) as ManagedStudentSelectItem[];
        setManagedStudentsList(validStudents);

      } catch (error) {
        console.error("RydRequestPage: Full error object in fetchManagedStudents catch block:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
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
    console.log("RydRequestPage: onSubmit triggered");
    console.log("RydRequestPage: Form data:", data);
    console.log("RydRequestPage: Form validation errors:", form.formState.errors);

    if (!authUser || !userProfile) {
      console.error("RydRequestPage: Auth user or profile missing in onSubmit.");
      toast({ title: "Authentication Error", description: "You must be logged in to request a ryd.", variant: "destructive" });
      return;
    }

    let finalPassengerUids: string[] = [];
    if (userProfile.role === UserRole.PARENT) {
      finalPassengerUids = data.passengerUids || [];
    } else if (userProfile.role === UserRole.STUDENT) {
      finalPassengerUids = [authUser.uid];
    } else {
      console.error("RydRequestPage: User role not permitted for ryd request in this manner.");
      toast({ title: "Role Error", description: "Your user role does not permit ryd requests in this manner.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    console.log("RydRequestPage: isSubmitting set to true");

    const [eventHours, eventMinutes] = data.time.split(':').map(Number);
    const eventStartDateTime = new Date(data.date);
    eventStartDateTime.setHours(eventHours, eventMinutes, 0, 0);
    

    const [pickupHours, pickupMinutes] = data.earliestPickupTime.split(':').map(Number);
    const earliestPickupDateTime = new Date(data.date);
    earliestPickupDateTime.setHours(pickupHours, pickupMinutes, 0, 0);
    

    console.log("RydRequestPage: Raw form data for dates/times:", {
      rawDate: data.date,
      rawTime: data.time,
      rawEarliestPickupTime: data.earliestPickupTime,
    });
    console.log("RydRequestPage: Calculated eventStartDateTime:", eventStartDateTime.toISOString(), "Is Valid JS Date:", !isNaN(eventStartDateTime.getTime()));
    console.log("RydRequestPage: Calculated earliestPickupDateTime:", earliestPickupDateTime.toISOString(), "Is Valid JS Date:", !isNaN(earliestPickupDateTime.getTime()));

    if (isNaN(eventStartDateTime.getTime()) || isNaN(earliestPickupDateTime.getTime())) {
        console.error("RydRequestPage: Invalid date/time calculation resulting in 'Invalid Date'.");
        toast({title: "Date/Time Error", description: "Invalid date or time provided. Please check your inputs.", variant: "destructive"});
        setIsSubmitting(false);
        return;
    }

    const eventStartFirestoreTimestamp = Timestamp.fromDate(eventStartDateTime);
    const earliestPickupFirestoreTimestamp = Timestamp.fromDate(earliestPickupDateTime);

    console.log("RydRequestPage: Firestore eventStartTimestamp:", eventStartFirestoreTimestamp);
    console.log("RydRequestPage: Firestore earliestPickupTimestamp:", earliestPickupFirestoreTimestamp);
    console.log("RydRequestPage: finalPassengerUids for payload:", finalPassengerUids);


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
      if (selectedEvent && selectedEvent.name) {
        rydRequestPayload.eventName = selectedEvent.name.trim();
      }
    } else if (data.eventId === "custom" && data.eventName && data.eventName.trim() !== "") {
      rydRequestPayload.eventName = data.eventName.trim();
    } else if (!data.eventId && data.eventName && data.eventName.trim() !== "") {
      rydRequestPayload.eventName = data.eventName.trim();
    }
    
    console.log("RydRequestPage: Ryd request payload being sent to Firestore:", rydRequestPayload);

    try {
      console.log("RydRequestPage: Attempting to add document to 'rydz' collection.");
      const docRef = await addDoc(collection(db, "rydz"), rydRequestPayload as Omit<RydData, 'id' | 'updatedAt'>);
      console.log("RydRequestPage: Document added with ID:", docRef.id);
      toast({
        title: "Ryd Requested!", 
        description: `Your request (ID: ${docRef.id}) for a ryd to ${rydRequestPayload.eventName || rydRequestPayload.destination} has been submitted.`, 
      });
      form.reset();
    } catch (error) {
        let errorMessage = "Could not submit your ryd request. Please try again.";
        // Attempt to get more details from Firebase error if available
        const firebaseError = error as any;
        if (firebaseError.message) {
            errorMessage = firebaseError.message;
        }
        if (firebaseError.code) {
            errorMessage += ` (Code: ${firebaseError.code})`;
        }
        console.error("RydRequestPage: Error submitting ryd request to Firestore:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        toast({
            title: "Request Failed",
            description: errorMessage + " Check console for more details.",
            variant: "destructive",
            duration: 9000,
        });
    } finally {
        setIsSubmitting(false);
        console.log("RydRequestPage: isSubmitting set to false");
    }
  }

  const selectedEventId = form.watch("eventId");

  useEffect(() => {
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
      form.setValue("eventName", form.getValues("eventName") || ""); // Keep existing custom name or empty
      form.setValue("destination", form.getValues("destination") || ""); // Keep existing destination or empty
      // Potentially reset date/time or keep them if user was editing
      // form.setValue("date", undefined); // Or keep existing
      // form.setValue("time", "09:00"); // Or keep existing
    }
  }, [selectedEventId, form, availableEvents]);

  const handleStudentSelection = (studentId: string) => {
    const currentSelectedStudents = form.getValues("passengerUids") || [];
    const newSelectedStudents = currentSelectedStudents.includes(studentId)
      ? currentSelectedStudents.filter(id => id !== studentId)
      : [...currentSelectedStudents, studentId];
    form.setValue("passengerUids", newSelectedStudents, { shouldValidate: true });
  };

  const filteredStudentsForPopover = managedStudentsList.filter(student =>
    student.fullName.toLowerCase().includes(studentSearchTerm.toLowerCase())
  );
  const currentSelectedStudentUids = form.watch("passengerUids") || [];
  
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

              {(selectedEventId === "custom" || (!selectedEventId && form.getValues("eventName"))) && ( 
                 <FormField
                    control={form.control}
                    name="eventName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name (if "Other" or no event selected)</FormLabel>
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

              {(authLoading || isLoadingProfile) && (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}

              {!authLoading && !isLoadingProfile && userProfile && (
                <FormField
                  control={form.control}
                  name="passengerUids"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-base flex items-center">
                        <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                        This ryd is for
                      </FormLabel>
                      {userProfile.role === UserRole.STUDENT && (
                        <p className="text-sm text-muted-foreground p-2 border rounded-md bg-muted/30">Me</p>
                      )}
                      {userProfile.role === UserRole.PARENT && (
                        <>
                          <Popover open={studentPopoverOpen} onOpenChange={setStudentPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={studentPopoverOpen}
                                className="w-full justify-between"
                                disabled={isLoadingManagedStudents}
                              >
                                {isLoadingManagedStudents ? "Loading your students..." : (
                                  currentSelectedStudentUids.length > 0
                                    ? `${currentSelectedStudentUids.length} student(s) selected`
                                    : "Select student(s)..."
                                )}
                                <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command>
                                <CommandInput
                                  placeholder="Search students..."
                                  value={studentSearchTerm}
                                  onValueChange={setStudentSearchTerm}
                                  disabled={isLoadingManagedStudents}
                                />
                                <CommandList>
                                  <ScrollArea className="h-48">
                                    {isLoadingManagedStudents && <CommandEmpty><Loader2 className="h-4 w-4 animate-spin my-4 mx-auto" /></CommandEmpty>}
                                    {!isLoadingManagedStudents && filteredStudentsForPopover.length === 0 && <CommandEmpty>No students found or none managed.</CommandEmpty>}
                                    <CommandGroup>
                                      {!isLoadingManagedStudents && filteredStudentsForPopover.map((student) => (
                                        <CommandItem
                                          key={student.id}
                                          value={student.id}
                                          onSelect={() => handleStudentSelection(student.id)}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              currentSelectedStudentUids.includes(student.id)
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                          />
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
                              {currentSelectedStudentUids.map(studentId => {
                                const student = managedStudentsList.find(s => s.id === studentId);
                                return student ? (
                                  <Badge key={studentId} variant="secondary" className="mr-1">
                                    {student.fullName}
                                    <button
                                      type="button"
                                      className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                      onClick={() => handleStudentSelection(studentId)}
                                    >
                                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </button>
                                  </Badge>
                                ) : null;
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
              <pre className="text-xs bg-slate-100 p-2 overflow-auto text-black">
                Button Disabled Flags: {JSON.stringify({isSubmitting, authLoading, isLoadingProfile, isLoadingEvents, isLoadingManagedStudents}, null, 2)}
              </pre>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || authLoading || isLoadingProfile || isLoadingEvents || isLoadingManagedStudents}
              >
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

