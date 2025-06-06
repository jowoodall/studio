
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Command } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';

// Mock event details (in a real app, fetch based on eventId)
const mockEventsData: { [key: string]: { name: string; location: string } } = {
  "1": { name: "School Annual Day", location: "Northwood High Auditorium" },
  "2": { name: "Community Soccer Match", location: "City Sports Complex" },
  "3": { name: "Tech Conference 2024", location: "Downtown Convention Center" },
};

export async function generateMetadata({ params }: { params: { eventId: string } }): Promise<Metadata> {
  const eventName = mockEventsData[params.eventId]?.name || `Event ${params.eventId}`;
  return {
    title: `Offer to Drive for ${eventName}`,
  };
}

export default function OfferDrivePage({ params }: { params: { eventId: string } }) {
  const { eventId } = params;
  const eventDetails = mockEventsData[eventId];

  if (!eventDetails) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Event Not Found</h2>
        <p className="text-muted-foreground">The event with ID "{eventId}" could not be found.</p>
        <Button asChild className="mt-4">
          <Link href="/events">Back to Events</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Offer to Drive: ${eventDetails.name}`}
        description={`You are offering to drive for the event at ${eventDetails.location}.`}
      />
      <Card className="w-full max-w-lg mx-auto shadow-lg">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Command className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-center font-headline text-xl">Offer Your Driving Services</CardTitle>
          <CardDescription className="text-center">
            Please fill out the form below to provide your availability and vehicle details.
            (This is a placeholder page - form functionality to be implemented.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-6 border-2 border-dashed border-muted rounded-md text-center text-muted-foreground">
            <p>Driver Information Form Placeholder</p>
            <p className="text-sm">Details like vehicle type, capacity, pickup radius, etc., would go here.</p>
          </div>
          <Button className="w-full mt-6" disabled>Submit Offer (Not Implemented)</Button>
        </CardContent>
      </Card>
       <div className="text-center mt-6">
        <Button variant="link" asChild>
            <Link href={`/events/${eventId}/rides`}>Back to Event Rides</Link>
        </Button>
      </div>
    </>
  );
}
