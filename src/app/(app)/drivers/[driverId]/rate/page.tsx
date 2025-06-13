
"use client"; // This form will need client-side interaction

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Star, ThumbsUp, Loader2, AlertTriangle } from "lucide-react"; 
import { useForm } from "react-hook-form";
import * as z from "zod";
import React, { use } from "react"; 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils"; 
import Link from "next/link"; 

// No direct metadata export from client component files. Define in a parent server component or layout if needed.

const driverRatingFormSchema = z.object({
  rating: z.string().nonempty("Please select a rating."), 
  comments: z.string().max(500, "Comments cannot exceed 500 characters.").optional(),
});

type DriverRatingFormValues = z.infer<typeof driverRatingFormSchema>;

// Mock driver data (in real app, fetch this based on driverId)
const mockDriverData: { [key: string]: { name: string; avatar: string; dataAiHint: string; rydDetails: string; } } = {
  "driver123": { name: "Alex Johnson", avatar: "https://placehold.co/100x100.png?text=AJ", dataAiHint: "driver smiling", rydDetails: "Ryd to Northwood High on 2024-11-15" },
  "driver456": { name: "Maria Garcia", avatar: "https://placehold.co/100x100.png?text=MG", dataAiHint: "driver portrait", rydDetails: "Ryd to City Sports Complex on 2024-11-18" },
  "driver789": { name: "John Smith", avatar: "https://placehold.co/100x100.png?text=JS", dataAiHint: "man friendly", rydDetails: "Ryd to Community Library on 2024-11-20" },
};


interface ResolvedPageParams {
  driverId: string;
}

export default function DriverRatingPage({ params: paramsPromise }: { params: Promise<ResolvedPageParams> }) {
  const params = use(paramsPromise);
  const { driverId } = params || {};

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const driver = driverId ? mockDriverData[driverId] : null;

  const form = useForm<DriverRatingFormValues>({
    resolver: zodResolver(driverRatingFormSchema),
    defaultValues: {
        rating: "",
        comments: "",
    }
  });

  function onSubmit(data: DriverRatingFormValues) {
    if (!driverId) {
        toast({ title: "Error", description: "Driver ID is missing.", variant: "destructive"});
        return;
    }
    setIsSubmitting(true);
    const submissionData = {
      ...data,
      rating: parseInt(data.rating, 10), 
      driverId: driverId,
    };
    console.log("Driver Rating Data:", submissionData);
    
    // Simulate API call
    setTimeout(() => {
      toast({
        title: "Rating Submitted!",
        description: `Thank you for rating ${driver?.name || 'the driver'}.`,
      });
      setIsSubmitting(false);
      form.reset();
      // Potentially redirect user or update UI
    }, 1500);
  }

  if (!driverId && !params) { // Check if params itself is null or driverId is missing
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-muted-foreground animate-spin mb-4" />
        <p className="text-muted-foreground">Loading driver details...</p>
      </div>
    );
  }

  if (!driver && driverId) { // Only show not found if driverId was present but no driver matched
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Driver Not Found</h2>
        <p className="text-muted-foreground">The driver with ID "{driverId}" could not be found.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }
  
  if (!driver) { // Catch-all for driver not being available for other reasons (e.g. initial load before driverId is resolved)
     return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <Loader2 className="w-16 h-16 text-muted-foreground animate-spin mb-4" />
        <p className="text-muted-foreground">Waiting for driver information...</p>
      </div>
    );
  }


  return (
    <>
      <PageHeader
        title={`Rate Driver: ${driver.name}`}
        description={`Share your feedback for the ryd: ${driver.rydDetails}.`}
      />
      <Card className="w-full max-w-lg mx-auto shadow-xl">
        <CardHeader className="text-center">
          <Avatar className="h-24 w-24 mx-auto mb-4">
            <AvatarImage src={driver.avatar} alt={driver.name} data-ai-hint={driver.dataAiHint}/>
            <AvatarFallback>{driver.name.split(" ").map(n=>n[0]).join("")}</AvatarFallback>
          </Avatar>
          <CardTitle className="font-headline text-xl">How was your ryd with {driver.name}?</CardTitle>
          <CardDescription>Your feedback helps improve our community.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="text-base">Overall Rating</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex justify-center space-x-2 md:space-x-4 pt-2"
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <FormItem key={value} className="flex flex-col items-center space-y-1">
                            <FormControl>
                              <RadioGroupItem value={String(value)} id={`rating-${value}`} className="sr-only" />
                            </FormControl>
                            <Label htmlFor={`rating-${value}`} className="cursor-pointer">
                              <Star 
                                className={cn(
                                  "h-8 w-8 md:h-10 md:w-10 text-muted hover:text-yellow-400 transition-colors",
                                  (field.value && parseInt(field.value) >= value) ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                                )}
                              />
                            </Label>
                             <span className="text-xs text-muted-foreground">{value}</span>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage className="text-center pt-2" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Comments (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us more about your experience..."
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  <><ThumbsUp className="mr-2 h-4 w-4" /> Submit Rating</>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}
