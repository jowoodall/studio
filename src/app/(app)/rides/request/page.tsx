"use client"; // This form will need client-side interaction

import React from "react"; // Added React import
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
import { CalendarIcon, Car, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import type { Metadata } from 'next';

// No direct metadata export from client component files. Define in a parent server component or layout if needed.
// export const metadata: Metadata = { 
//   title: 'Request a Ride',
// };

const rideRequestFormSchema = z.object({
  eventId: z.string().optional(), // If selecting from existing events
  eventName: z.string().min(3, "Event name is too short").optional(),
  destination: z.string().min(5, "Destination address is required."),
  pickupLocation: z.string().min(5, "Pickup location is required."),
  date: z.date({ required_error: "Date of ride is required." }),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:MM)."),
  notes: z.string().optional(),
});

type RideRequestFormValues = z.infer<typeof rideRequestFormSchema>;

// Mock events for dropdown
const mockEvents = [
  { id: "event1", name: "School Annual Day", location: "Northwood High Auditorium" },
  { id: "event2", name: "Community Soccer Match", location: "City Sports Complex" },
  { id: "event3", name: "Tech Conference 2024", location: "Downtown Convention Center" },
];


export default function RideRequestPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<RideRequestFormValues>({
    resolver: zodResolver(rideRequestFormSchema),
    defaultValues: {
      time: "09:00", // Default time
    }
  });

  function onSubmit(data: RideRequestFormValues) {
    setIsSubmitting(true);
    console.log("Ride Request Data:", data);
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Ride Requested!",
        description: `Your request for a ride to ${data.eventId ? mockEvents.find(e=>e.id===data.eventId)?.name : data.eventName || data.destination} has been submitted.`,
      });
      setIsSubmitting(false);
      form.reset();
    }, 1500);
  }

  const selectedEventId = form.watch("eventId");
  React.useEffect(() => {
    if (selectedEventId) {
      const event = mockEvents.find(e => e.id === selectedEventId);
      if (event) {
        form.setValue("destination", event.location);
        form.setValue("eventName", event.name); // Auto-fill event name
      }
    }
  }, [selectedEventId, form]);


  return (
    <>
      <PageHeader
        title="Request a Ride"
        description="Fill out the details below to request a ride to an event or destination."
      />
      <Card className="w-full max-w-2xl mx-auto shadow-xl">
        <CardHeader>
          <CardTitle className="font-headline text-xl">Ride Details</CardTitle>
          <CardDescription>Please provide accurate information for your ride request.</CardDescription>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an existing event" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mockEvents.map(event => (
                          <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
                        ))}
                         <SelectItem value="custom">Other (Specify Below)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>If your event is not listed, choose "Other".</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedEventId === "custom" && (
                 <FormField
                    control={form.control}
                    name="eventName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Name (if "Other")</FormLabel>
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
                      <Input placeholder="e.g., 123 Main St, Anytown" {...field} disabled={!!selectedEventId && selectedEventId !== "custom"} />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date of Ride</FormLabel>
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
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) }
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
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time (24h format)</FormLabel>
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
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Car className="mr-2 h-4 w-4" /> Submit Ride Request</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
