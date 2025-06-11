
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import React, { useState, useTransition, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, AlertTriangle, Users, Check, X, MapPin } from "lucide-react"; // Added MapPin
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

import type { CarpoolMatchingInput, CarpoolMatchingOutput } from "@/ai/flows/carpool-matching";
import { findMatchingCarpoolsAction } from "@/actions/carpool";
import { db } from "@/lib/firebase";
import { collection, query, getDocs } from "firebase/firestore";
import type { GroupData } from "@/types";
import { useAuth } from "@/context/AuthContext";

const findCarpoolFormSchema = z.object({
  eventLocation: z.string().min(5, { message: "Event location must be at least 5 characters." }),
  eventStreet: z.string().optional(),
  eventCity: z.string().optional(),
  eventState: z.string().optional(),
  eventZip: z.string().optional(),
  eventDate: z.date({ required_error: "Event date is required." }),
  eventTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)."}),
  userLocation: z.string().min(5, { message: "Your location must be at least 5 characters." }),
  trafficConditions: z.string().min(3, { message: "Traffic conditions must be at least 3 characters (e.g., light, moderate, heavy)." }),
  associatedGroupIds: z.array(z.string()).optional(),
});

type FindCarpoolFormValues = z.infer<typeof findCarpoolFormSchema>;

interface FindCarpoolFormProps {
  initialEventLocation?: string;
  initialEventDate?: Date;
  initialEventTime?: string;
  initialAssociatedGroupIds?: string[];
}

const defaultFormValues = {
  eventLocation: "",
  eventStreet: "",
  eventCity: "",
  eventState: "",
  eventZip: "",
  eventTime: "17:00",
  userLocation: "",
  trafficConditions: "moderate",
  associatedGroupIds: [],
};

interface GroupSelectItem {
  id: string;
  name: string;
}

export function FindCarpoolForm({
  initialEventLocation,
  initialEventDate,
  initialEventTime,
  initialAssociatedGroupIds,
}: FindCarpoolFormProps) {
  const { toast } = useToast();
  const { user: authUser, userProfile, loading: authLoading, isLoadingProfile } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<CarpoolMatchingOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [availableGroups, setAvailableGroups] = useState<GroupSelectItem[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  const form = useForm<FindCarpoolFormValues>({
    resolver: zodResolver(findCarpoolFormSchema),
    defaultValues: {
      ...defaultFormValues,
      eventLocation: initialEventLocation || defaultFormValues.eventLocation,
      eventDate: initialEventDate,
      eventTime: initialEventTime || defaultFormValues.eventTime,
      associatedGroupIds: initialAssociatedGroupIds || defaultFormValues.associatedGroupIds,
    },
  });

  const isEventPreFilled = !!initialEventLocation;

  useEffect(() => {
    const fetchUserGroups = async () => {
      if (authLoading || isLoadingProfile || !userProfile || !authUser) {
        if (!authLoading && !isLoadingProfile && !userProfile && authUser) {
            setIsLoadingGroups(false);
            setAvailableGroups([]);
        }
        return;
      }

      setIsLoadingGroups(true);
      try {
        const userJoinedGroupIds = userProfile.joinedGroupIds || [];
        if (userJoinedGroupIds.length === 0 && !isEventPreFilled) {
          setAvailableGroups([]);
          setIsLoadingGroups(false);
          return;
        }

        const groupsQuery = query(collection(db, "groups"));
        const querySnapshot = await getDocs(groupsQuery);
        const fetchedGroups: GroupSelectItem[] = [];
        const allFetchedGroupsForPreFillCheck: GroupSelectItem[] = [];

        querySnapshot.forEach((doc) => {
          const groupData = doc.data() as GroupData;
          const groupItem = { id: doc.id, name: groupData.name };
          allFetchedGroupsForPreFillCheck.push(groupItem);
          if (userJoinedGroupIds.includes(doc.id)) {
            fetchedGroups.push(groupItem);
          }
        });
        setAvailableGroups(fetchedGroups);

      } catch (err) {
        console.error("Error fetching user's groups:", err);
        toast({
          title: "Error",
          description: "Could not fetch your groups for selection.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingGroups(false);
      }
    };
    fetchUserGroups();
  }, [toast, authUser, userProfile, authLoading, isLoadingProfile, isEventPreFilled, initialAssociatedGroupIds]);

  useEffect(() => {
    const currentUserLocation = form.getValues("userLocation");
    const currentTrafficConditions = form.getValues("trafficConditions");
    form.reset({
      ...defaultFormValues,
      userLocation: currentUserLocation || defaultFormValues.userLocation,
      trafficConditions: currentTrafficConditions || defaultFormValues.trafficConditions,
      eventLocation: initialEventLocation || defaultFormValues.eventLocation,
      // Clear detailed address fields if the main location changes due to prop update
      eventStreet: initialEventLocation ? "" : (form.getValues("eventStreet") || ""),
      eventCity: initialEventLocation ? "" : (form.getValues("eventCity") || ""),
      eventState: initialEventLocation ? "" : (form.getValues("eventState") || ""),
      eventZip: initialEventLocation ? "" : (form.getValues("eventZip") || ""),
      eventDate: initialEventDate,
      eventTime: initialEventTime || defaultFormValues.eventTime,
      associatedGroupIds: initialAssociatedGroupIds || [],
    });
  }, [initialEventLocation, initialEventDate, initialEventTime, initialAssociatedGroupIds, form]);


  const handleGroupSelection = (groupId: string) => {
    const currentSelectedGroups = form.getValues("associatedGroupIds") || [];
    const newSelectedGroups = currentSelectedGroups.includes(groupId)
      ? currentSelectedGroups.filter(id => id !== groupId)
      : [...currentSelectedGroups, groupId];
    form.setValue("associatedGroupIds", newSelectedGroups, { shouldValidate: true });
  };

  const filteredGroupsForPopover = availableGroups.filter(group =>
    group.name.toLowerCase().includes(groupSearchTerm.toLowerCase())
  );
  const currentSelectedGroups = form.watch("associatedGroupIds") || [];


  function onSubmit(data: FindCarpoolFormValues) {
    setError(null);
    setResults(null);

    startTransition(async () => {
      const eventDateTime = new Date(data.eventDate);
      const [hours, minutes] = data.eventTime.split(':').map(Number);
      eventDateTime.setHours(hours, minutes);

      let finalEventLocationForAI = data.eventLocation; // Fallback to the general location field
      const addressParts = [data.eventStreet, data.eventCity, data.eventState, data.eventZip].filter(Boolean);
      if (addressParts.length > 1) { // Require at least two parts for a "detailed" address
        finalEventLocationForAI = `${data.eventStreet || ''}${data.eventStreet && (data.eventCity || data.eventState || data.eventZip) ? ', ' : ''}${data.eventCity || ''}${data.eventCity && (data.eventState || data.eventZip) ? ', ' : ''}${data.eventState || ''}${data.eventState && data.eventZip ? ' ' : ''}${data.eventZip || ''}`;
        if (data.eventLocation && data.eventLocation !== initialEventLocation) { // If general location was also manually entered and different from prefill
            finalEventLocationForAI = `${data.eventLocation} (${finalEventLocationForAI})`; // Prepend name/general location
        }
      }


      const allGroupsSnapshot = await getDocs(query(collection(db, "groups")));
      const allGroupDetails: GroupSelectItem[] = [];
      allGroupsSnapshot.forEach(doc => allGroupDetails.push({id: doc.id, name: (doc.data() as GroupData).name}));

      const groupIdsToConsiderForAI = data.associatedGroupIds || [];
      const groupNamesForAI = groupIdsToConsiderForAI
        .map(id => allGroupDetails.find(g => g.id === id)?.name || id)
        .filter(Boolean);


      const inputForAI: CarpoolMatchingInput = {
        eventLocation: finalEventLocationForAI.trim(),
        eventDateTime: eventDateTime.toISOString(),
        userLocation: data.userLocation,
        trafficConditions: data.trafficConditions,
        associatedGroups: groupNamesForAI,
      };

      const response = await findMatchingCarpoolsAction(inputForAI);

      if (response.error) {
        setError(response.error);
        toast({
          title: "Error",
          description: response.error,
          variant: "destructive",
        });
        if (response.issues) {
            console.error("Validation issues:", response.issues);
        }
      } else {
        if ('suggestedCarpools' in response && 'reasoning' in response) {
            setResults(response);
            toast({
              title: "Carpools Found!",
              description: "AI has suggested potential carpools.",
            });
        } else {
            setError("Received an unexpected response format from the AI service.");
            toast({
              title: "Error",
              description: "Received an unexpected response format.",
              variant: "destructive",
            });
        }
      }
    });
  }


  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Carpool Details</CardTitle>
        <CardDescription>
          {isEventPreFilled
            ? "Event details are pre-filled. Confirm your location and preferences."
            : "Fill in the details to find carpool options."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="eventLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Name / General Location</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., School Auditorium, City Park Soccer Fields"
                      {...field}
                      disabled={isEventPreFilled}
                      className={isEventPreFilled ? "bg-muted/50" : ""}
                    />
                  </FormControl>
                  {isEventPreFilled && <FormDescription className="text-xs">Pre-filled from selected event. Add specific address below if needed.</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                <FormLabel className="text-sm font-medium flex items-center">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    Detailed Event Address (Optional, but recommended for accuracy)
                </FormLabel>
                <FormField
                    control={form.control}
                    name="eventStreet"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-xs">Street Address</FormLabel>
                        <FormControl>
                            <Input placeholder="123 Main St" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="eventCity"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">City</FormLabel>
                            <FormControl>
                            <Input placeholder="Anytown" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="eventState"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">State / Province</FormLabel>
                            <FormControl>
                            <Input placeholder="CA" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="eventZip"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs">Zip / Postal Code</FormLabel>
                            <FormControl>
                            <Input placeholder="90210" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
            </div>


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
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground",
                              isEventPreFilled && "bg-muted/50"
                            )}
                            disabled={isEventPreFilled}
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
                          disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) || isEventPreFilled }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {isEventPreFilled && <FormDescription className="text-xs">Pre-filled from selected event.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Time (24h format)</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        disabled={isEventPreFilled}
                        className={isEventPreFilled ? "bg-muted/50" : ""}
                      />
                    </FormControl>
                    {isEventPreFilled && <FormDescription className="text-xs">Pre-filled from selected event.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="userLocation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Starting Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 456 Oak Ave, Anytown, USA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="trafficConditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Traffic Conditions</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., light, moderate, heavy" {...field} />
                  </FormControl>
                  <FormDescription>This helps the AI estimate travel times.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="associatedGroupIds"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-base flex items-center">
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    Associate Your Groups (AI will prioritize these)
                  </FormLabel>
                  {isEventPreFilled && initialAssociatedGroupIds && initialAssociatedGroupIds.length > 0 && (
                     <>
                        <div className="pt-2 space-x-1 space-y-1">
                           {initialAssociatedGroupIds.map(groupId => {
                              const group = availableGroups.find(g => g.id === groupId) || {id: groupId, name: `Group (ID: ${groupId.substring(0,6)}... )`};
                              return (
                                 <Badge key={groupId} variant="secondary" className="mr-1">
                                    {group.name}
                                 </Badge>
                              );
                           })}
                        </div>
                        <FormDescription>Groups pre-filled from event. Add more of your groups below if needed.</FormDescription>
                     </>
                  ) }
                 
                  <Popover open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={groupPopoverOpen}
                        className="w-full justify-between"
                        disabled={isLoadingGroups || authLoading || isLoadingProfile}
                      >
                        {isLoadingGroups ? "Loading your groups..." : (
                          currentSelectedGroups.filter(id => availableGroups.some(g => g.id === id)).length > 0
                          ? `${currentSelectedGroups.filter(id => availableGroups.some(g => g.id === id)).length} of your group(s) selected`
                          : "Select from your groups..."
                        )}
                        <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search your groups..."
                          value={groupSearchTerm}
                          onValueChange={setGroupSearchTerm}
                          disabled={isLoadingGroups}
                        />
                        <CommandList>
                          <ScrollArea className="h-48">
                            {isLoadingGroups && <CommandEmpty><Loader2 className="h-4 w-4 animate-spin my-4 mx-auto" /></CommandEmpty>}
                            {!isLoadingGroups && filteredGroupsForPopover.length === 0 && <CommandEmpty>No groups found or you are not a member of any.</CommandEmpty>}
                            <CommandGroup>
                              {!isLoadingGroups && filteredGroupsForPopover.map((group) => (
                                <CommandItem
                                  key={group.id}
                                  value={group.id}
                                  onSelect={() => {
                                    handleGroupSelection(group.id);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      currentSelectedGroups.includes(group.id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {group.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </ScrollArea>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormDescription>
                    Select carpool groups you are a member of. The AI will consider these, plus any pre-filled from an event.
                  </FormDescription>
                  {currentSelectedGroups.length > 0 && (
                      <div className="pt-2 space-x-1 space-y-1">
                          {currentSelectedGroups.map(groupId => {
                              const group = availableGroups.find(g => g.id === groupId) || (isEventPreFilled && initialAssociatedGroupIds?.includes(groupId) ? { id: groupId, name: `Pre-selected Group (ID: ${groupId.substring(0,6)}... )`} : null);
                              if (!group) return null;
                              return (
                                  <Badge
                                      key={groupId}
                                      variant="secondary"
                                      className="mr-1"
                                  >
                                      {group.name}
                                      {availableGroups.some(g => g.id === groupId) && (
                                        <button
                                            type="button"
                                            className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            onClick={() => handleGroupSelection(groupId)}
                                        >
                                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                        </button>
                                      )}
                                  </Badge>
                              );
                          })}
                      </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isPending || isLoadingGroups || authLoading || isLoadingProfile}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finding Carpools...
                </>
              ) : (
                "Find Carpools with AI"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>

      {error && (
        <CardFooter className="flex flex-col items-start gap-2 mt-6 border-t pt-6">
            <div className="flex items-center text-destructive">
                <AlertTriangle className="h-5 w-5 mr-2"/>
                <h3 className="text-lg font-semibold">Error Finding Carpools</h3>
            </div>
            <p className="text-sm text-destructive-foreground bg-destructive/10 p-3 rounded-md">{error}</p>
        </CardFooter>
      )}

      {results && !error && (
        <CardFooter className="flex flex-col items-start gap-4 mt-6 border-t pt-6">
          <div>
            <h3 className="text-xl font-semibold text-primary mb-2">AI Suggested Carpools</h3>
            {results.suggestedCarpools.length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {results.suggestedCarpools.map((carpool, index) => (
                  <li key={index}>{carpool}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No specific carpools suggested based on the current information.</p>
            )}
          </div>
          <div>
            <h4 className="text-md font-semibold mt-3 mb-1">AI Reasoning:</h4>
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md whitespace-pre-wrap">{results.reasoning}</p>
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
