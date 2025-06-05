"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import React, { useState, useTransition } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

import type { CarpoolMatchingInput, CarpoolMatchingOutput } from "@/ai/flows/carpool-matching";
import { findMatchingCarpoolsAction } from "@/actions/carpool";


const findCarpoolFormSchema = z.object({
  eventLocation: z.string().min(5, { message: "Event location must be at least 5 characters." }),
  eventDate: z.date({ required_error: "Event date is required." }),
  eventTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format (HH:MM)."}),
  userLocation: z.string().min(5, { message: "Your location must be at least 5 characters." }),
  trafficConditions: z.string().min(3, { message: "Traffic conditions must be at least 3 characters (e.g., light, moderate, heavy)." }),
  knownCarpools: z.string().optional(),
});

type FindCarpoolFormValues = z.infer<typeof findCarpoolFormSchema>;

export function FindCarpoolForm() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<CarpoolMatchingOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FindCarpoolFormValues>({
    resolver: zodResolver(findCarpoolFormSchema),
    defaultValues: {
      eventLocation: "",
      eventTime: "17:00", // Default to 5 PM
      userLocation: "",
      trafficConditions: "moderate",
      knownCarpools: "none",
    },
  });

  function onSubmit(data: FindCarpoolFormValues) {
    setError(null);
    setResults(null);

    startTransition(async () => {
      const eventDateTime = new Date(data.eventDate);
      const [hours, minutes] = data.eventTime.split(':').map(Number);
      eventDateTime.setHours(hours, minutes);

      const inputForAI: CarpoolMatchingInput = {
        eventLocation: data.eventLocation,
        eventDateTime: eventDateTime.toISOString(),
        userLocation: data.userLocation,
        trafficConditions: data.trafficConditions,
        knownCarpools: data.knownCarpools || "none",
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
        // Type guard to ensure response is CarpoolMatchingOutput
        if ('suggestedCarpools' in response && 'reasoning' in response) {
            setResults(response);
            toast({
              title: "Carpools Found!",
              description: "AI has suggested potential carpools.",
            });
        } else {
            // This case should ideally not be reached if the action handles errors properly
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
        <CardTitle className="font-headline text-2xl">Find a Carpool (AI Powered)</CardTitle>
        <CardDescription>
          Let our AI assistant help you find the best carpool options. Fill in the details below.
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
                  <FormLabel>Event Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 123 Main St, Anytown, USA or School Auditorium" {...field} />
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
                          disabled={(date) => date < new Date(new Date().setHours(0,0,0,0)) } // Disable past dates
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
                    <FormLabel>Event Time (24h format)</FormLabel>
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
              name="knownCarpools"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Known Carpools (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="List any carpools you are aware of, including driver, riders, and route if known. e.g., 'Jane Doe's carpool, usually picks up from North Street.'"
                      {...field}
                    />
                  </FormControl>
                   <FormDescription>If none, you can leave it as 'none' or empty.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isPending}>
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
