
"use client";

import React, { useEffect, useState, use } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Edit, Loader2, Save, CalendarIcon, ArrowLeft, Users, UserPlus, XCircle, X, Check } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, Timestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { EventStatus, type EventData, type UserProfileData, type GroupData } from "@/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, parse } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { updateEventAction } from "@/actions/eventActions";


const eventEditFormSchema = z.object({
  eventName: z.string().min(3, "Event name must be at least 3 characters."),
  eventDate: z.date({ required_error: "Event date is required." }),
  eventTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  eventLocation: z.string().min(5, "Location must be at least 5 characters."),
  description: z.string().max(500, "Description cannot exceed 500 characters.").optional(),
  eventType: z.string().min(1, "Please select an event type."),
  status: z.nativeEnum(EventStatus, { errorMap: () => ({ message: "Please select a status."})}),
  selectedGroups: z.array(z.string()).optional(),
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
  const [managers, setManagers] = useState<UserProfileData[]>([]);
  const [newManagerEmail, setNewManagerEmail] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingManager, setIsAddingManager] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const [availableGroups, setAvailableGroups] = useState<GroupData[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");


  const form = useForm<EventEditFormValues>({
    resolver: zodResolver(eventEditFormSchema),
    defaultValues: { selectedGroups: [] },
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
            selectedGroups: data.associatedGroupIds || [],
          });

          if (data.managerIds && data.managerIds.length > 0) {
            const managerPromises = data.managerIds.map(id => getDoc(doc(db, "users", id)));
            const managerDocs = await Promise.all(managerPromises);
            const managerProfiles = managerDocs
              .filter(doc => doc.exists())
              .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfileData));
            setManagers(managerProfiles);
          }

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
    
    if (!authLoading) {
      fetchEventData();
    }

  }, [eventId, form, toast, authLoading, authUser]);
  
  useEffect(() => {
    if (authLoading || !userProfile) return;

    const fetchUserGroups = async () => {
        setIsLoadingGroups(true);
        try {
            const userJoinedGroupIds = userProfile.joinedGroupIds || [];
            if (userJoinedGroupIds.length > 0) {
                // Firestore 'in' query is limited to 30 elements
                const groupsQuery = query(collection(db, "groups"), where("__name__", "in", userJoinedGroupIds.slice(0, 30)));
                const querySnapshot = await getDocs(groupsQuery);
                const userGroups = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GroupData));
                setAvailableGroups(userGroups);
            } else {
                setAvailableGroups([]);
            }
        } catch (e) {
            console.error("Failed to fetch user groups:", e);
            toast({ title: "Error", description: "Could not load your groups for selection.", variant: "destructive" });
        } finally {
            setIsLoadingGroups(false);
        }
    };
    fetchUserGroups();
  }, [authLoading, userProfile, toast]);


  const handleAddManager = async () => {
    if (!newManagerEmail.trim()) {
      toast({ title: "Email required", description: "Please enter an email to add a manager.", variant: "destructive" });
      return;
    }
    setIsAddingManager(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", newManagerEmail.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: "User Not Found", description: `No user found with email: ${newManagerEmail}.`, variant: "destructive" });
        return;
      }

      const newManagerDoc = querySnapshot.docs[0];
      const newManagerData = { uid: newManagerDoc.id, ...newManagerDoc.data() } as UserProfileData;

      if (managers.some(m => m.uid === newManagerData.uid)) {
        toast({ title: "Already a Manager", description: `${newManagerData.fullName} is already a manager for this event.` });
        return;
      }
      
      setManagers(prev => [...prev, newManagerData]);
      setNewManagerEmail("");
      toast({ title: "Manager Added", description: `${newManagerData.fullName} added. Save changes to confirm.` });

    } catch (error: any) {
      toast({ title: "Error Adding Manager", description: error.message, variant: "destructive" });
    } finally {
      setIsAddingManager(false);
    }
  };

  const handleRemoveManager = (uidToRemove: string) => {
    if (managers.length <= 1) {
      toast({ title: "Cannot Remove", description: "An event must have at least one manager.", variant: "destructive" });
      return;
    }
    setManagers(prev => prev.filter(m => m.uid !== uidToRemove));
  };


  async function onSubmit(data: EventEditFormValues) {
    if (!eventId || !eventDetails || !isAuthorized || !authUser) {
      toast({ title: "Error", description: "Not authorized or event data not loaded.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const [hours, minutes] = data.eventTime.split(':').map(Number);
      const combinedDateTime = new Date(data.eventDate);
      combinedDateTime.setHours(hours, minutes, 0, 0);
      const eventFirestoreTimestamp = Timestamp.fromDate(combinedDateTime);
      
      const managerIds = managers.map(m => m.uid);

      const updateData: Partial<EventData> = {
        name: data.eventName,
        location: data.eventLocation,
        description: data.description || "",
        eventType: data.eventType,
        status: data.status,
        eventTimestamp: eventFirestoreTimestamp,
        managerIds: managerIds,
        associatedGroupIds: data.selectedGroups || [],
      };
      
      const result = await updateEventAction(eventId, updateData, authUser.uid);

      if (result.success) {
        toast({
          title: "Event Updated!",
          description: `The event "${data.eventName}" has been successfully updated.`,
        });
        router.push(`/events/${eventId}/rydz`);
      } else {
        throw new Error(result.message);
      }
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

  const handleGroupSelection = (groupId: string) => {
    // Use form.getValues() instead of form.getFieldState()
    const currentSelection = form.getValues("selectedGroups") || [];
    
    const newSelection = currentSelection.includes(groupId)
      ? currentSelection.filter((id: string) => id !== groupId)
      : [...currentSelection, groupId];
      
    form.setValue("selectedGroups", newSelection, { shouldValidate: true });
  };
  
  const filteredGroupsForPopover = availableGroups.filter(group => group.name.toLowerCase().includes(groupSearchTerm.toLowerCase()));
  const currentSelectedGroups = form.watch("selectedGroups") || [];

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
              
              <Separator />

              {/* Manage Managers Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Event Managers</h3>
                </div>
                <FormDescription>Add or remove users who can manage this event.</FormDescription>
                
                <div className="space-y-2">
                    {managers.map(manager => (
                        <div key={manager.uid} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={manager.avatarUrl} alt={manager.fullName} />
                                    <AvatarFallback>{manager.fullName.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-medium">{manager.fullName}</p>
                                    <p className="text-xs text-muted-foreground">{manager.email}</p>
                                </div>
                            </div>
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleRemoveManager(manager.uid)}
                                disabled={managers.length <= 1}
                                title={managers.length <= 1 ? "Cannot remove the last manager" : "Remove manager"}
                            >
                                <XCircle className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2 items-end">
                    <div className="flex-grow">
                        <Label htmlFor="new-manager-email">Add Manager by Email</Label>
                        <Input
                            id="new-manager-email"
                            type="email"
                            placeholder="manager@example.com"
                            value={newManagerEmail}
                            onChange={e => setNewManagerEmail(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <Button type="button" variant="outline" onClick={handleAddManager} disabled={isAddingManager}>
                        {isAddingManager ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <UserPlus className="mr-2 h-4 w-4" />}
                        Add
                    </Button>
                </div>
              </div>
              
              <Separator />

              {/* Associated Groups Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold">Associated Groups</h3>
                </div>
                <FormDescription>Link groups to this event. Only groups you are a member of are shown.</FormDescription>
                
                <FormField
                    control={form.control}
                    name="selectedGroups"
                    render={({ field }) => (
                    <FormItem>
                        <Popover open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                                disabled={isLoadingGroups}
                            >
                            {isLoadingGroups ? "Loading your groups..." : (currentSelectedGroups.length > 0 ? `${currentSelectedGroups.length} group(s) selected` : "Select groups to associate...")}
                            <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                            <CommandInput placeholder="Search your groups..." value={groupSearchTerm} onValueChange={setGroupSearchTerm} />
                            <CommandList>
                                <ScrollArea className="h-48">
                                <CommandEmpty>No groups found.</CommandEmpty>
                                <CommandGroup>
                                    {filteredGroupsForPopover.map(group => (
                                    <CommandItem
                                        key={group.id}
                                        value={group.name}
                                        onSelect={() => handleGroupSelection(group.id)}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", currentSelectedGroups.includes(group.id) ? "opacity-100" : "opacity-0")} />
                                        {group.name}
                                    </CommandItem>
                                    ))}
                                </CommandGroup>
                                </ScrollArea>
                            </CommandList>
                            </Command>
                        </PopoverContent>
                        </Popover>
                        {currentSelectedGroups.length > 0 && (
                            <div className="pt-2 space-x-1 space-y-1">
                            {currentSelectedGroups.map(groupId => {
                                const group = availableGroups.find(g => g.id === groupId);
                                return group ? (
                                <Badge key={groupId} variant="secondary">
                                    {group.name}
                                    <button type="button" className="ml-1.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2" onClick={() => handleGroupSelection(groupId)}>
                                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </button>
                                </Badge>
                                ) : null;
                            })}
                            </div>
                        )}
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>

              <Button type="submit" className="w-full !mt-8" disabled={isSubmitting || isLoading}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving All Changes...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Save All Changes</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
