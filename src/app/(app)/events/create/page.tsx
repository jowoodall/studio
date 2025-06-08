
"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, PlusCircle, Loader2, LinkIcon, Users, Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const eventFormSchema = z.object({
  importSource: z.string().optional(),
  eventName: z.string().min(3, "Event name must be at least 3 characters."),
  eventDate: z.date({ required_error: "Event date is required." }),
  eventTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  eventLocation: z.string().min(5, "Location must be at least 5 characters."),
  description: z.string().max(500, "Description cannot exceed 500 characters.").optional(),
  eventType: z.string().min(1, "Please select an event type."),
  selectedGroups: z.array(z.string()).optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const mockAvailableGroups = [
  { id: "group1", name: "Morning School Run" },
  { id: "group2", name: "Soccer Practice Crew" },
  { id: "group3", name: "Work Commute (Downtown)" },
  { id: "group4", name: "Weekend Study Buddies" },
  { id: "group5", name: "Art Club Carpool" },
  { id: "group6", name: "Debate Team Transport" },
];

export default function CreateEventPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      importSource: "manual",
      eventTime: "10:00",
      eventType: "",
      selectedGroups: [],
    },
  });

  function onSubmit(data: EventFormValues) {
    setIsSubmitting(true);
    console.log("Create Event Data:", data);
    setTimeout(() => {
      toast({
        title: "Event Created!",
        description: `The event "${data.eventName}" has been successfully created. ${data.selectedGroups && data.selectedGroups.length > 0 ? `Associated with ${data.selectedGroups.length} group(s).` : ''}`,
      });
      if (data.importSource && data.importSource !== "manual") {
        toast({
            title: "Import Note",
            description: `Ideally, event details from ${data.importSource} would have been pre-filled. (This is a placeholder).`,
            variant: "default",
            duration: 4000,
        });
      }
      setIsSubmitting(false);
      form.reset({ importSource: "manual", eventTime: "10:00", eventType: "", selectedGroups: [] });
      setSearchTerm("");
    }, 1500);
  }

  const selectedImportSource = form.watch("importSource");

  React.useEffect(() => {
    if (selectedImportSource && selectedImportSource !== "manual") {
        toast({
            title: `Importing from ${selectedImportSource}`,
            description: "If this were fully integrated, event fields might be auto-populated now.",
            duration: 3000,
        });
    }
  }, [selectedImportSource, toast, form]);

  const handleGroupSelection = (groupId: string) => {
    const currentSelectedGroups = form.getValues("selectedGroups") || [];
    const newSelectedGroups = currentSelectedGroups.includes(groupId)
      ? currentSelectedGroups.filter(id => id !== groupId)
      : [...currentSelectedGroups, groupId];
    form.setValue("selectedGroups", newSelectedGroups, { shouldValidate: true });
  };

  const filteredGroups = mockAvailableGroups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentSelectedGroups = form.watch("selectedGroups") || [];


  return (
    <>
      <PageHeader
        title="Create New Event"
        description="Fill in the details below to create a new event for carpooling."
      />
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Event Information</CardTitle>
          <CardDescription>Provide the necessary details for your new event.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="importSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <LinkIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      Import from Calendar/App (Optional)
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a source to import from" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual Entry</SelectItem>
                        <SelectItem value="google">Google Calendar</SelectItem>
                        <SelectItem value="outlook">Outlook Calendar</SelectItem>
                        <SelectItem value="teamsnap">TeamSnap</SelectItem>
                        <SelectItem value="band">BAND App</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Selecting a source would (ideally) pre-fill event details. This is a conceptual feature for now.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., School Science Fair" {...field} />
                    </FormControl>
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
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
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
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                            initialFocus
                          />
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
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="eventLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Northwood High Gymnasium" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an event type" />
                        </SelectTrigger>
                      </FormControl>
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Provide a brief description or any important notes about the event."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="selectedGroups"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-base flex items-center">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      Associate Groups (Optional)
                    </FormLabel>
                    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={popoverOpen}
                          className="w-full justify-between"
                        >
                          {currentSelectedGroups.length > 0
                            ? `${currentSelectedGroups.length} group(s) selected`
                            : "Select groups..."}
                           <Users className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search groups..."
                            value={searchTerm}
                            onValueChange={setSearchTerm}
                          />
                          <CommandList>
                            <CommandEmpty>No groups found.</CommandEmpty>
                            <ScrollArea className="h-48">
                              <CommandGroup>
                                {filteredGroups.map((group) => (
                                  <CommandItem
                                    key={group.id}
                                    value={group.id}
                                    onSelect={() => {
                                      handleGroupSelection(group.id);
                                      // Keep popover open for multi-select
                                      // setPopoverOpen(false); 
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
                      Select carpool groups to associate with this event.
                    </FormDescription>
                    {currentSelectedGroups.length > 0 && (
                        <div className="pt-2 space-x-1 space-y-1">
                            {currentSelectedGroups.map(groupId => {
                                const group = mockAvailableGroups.find(g => g.id === groupId);
                                return group ? (
                                    <Badge
                                        key={groupId}
                                        variant="secondary"
                                        className="mr-1"
                                    >
                                        {group.name}
                                        <button
                                            type="button"
                                            className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            onClick={() => handleGroupSelection(groupId)}
                                        >
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

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Event...</>
                ) : (
                  <><PlusCircle className="mr-2 h-4 w-4" /> Create Event</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}

