
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, User, Car, PlusCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';

// Mock data for rides related to an event
const mockEventRides = [
  { id: "rideA", eventId: "1", passengerName: "Alice Wonderland", pickupTime: "09:30 AM", driverName: "Bob The Builder", status: "Confirmed", image: "https://placehold.co/400x200.png?text=Event+Ride+1", dataAiHint: "group children car" },
  { id: "rideB", eventId: "1", passengerName: "Charlie Brown", pickupTime: "09:45 AM", driverName: "Diana Prince", status: "Pending Driver", image: "https://placehold.co/400x200.png?text=Event+Ride+2", dataAiHint: "teenager waiting" },
  { id: "rideC", eventId: "2", passengerName: "Edward Scissorhands", pickupTime: "01:30 PM", driverName: "Fiona Gallagher", status: "Confirmed", image: "https://placehold.co/400x200.png?text=Event+Ride+3", dataAiHint: "sports gear car" },
];

// Mock event details (in a real app, fetch based on eventId)
const mockEventsData: { [key: string]: { name: string; location: string } } = {
  "1": { name: "School Annual Day", location: "Northwood High Auditorium" },
  "2": { name: "Community Soccer Match", location: "City Sports Complex" },
  "3": { name: "Tech Conference 2024", location: "Downtown Convention Center" },
};

export async function generateMetadata({ params }: { params: { eventId: string } }): Promise<Metadata> {
  const eventName = mockEventsData[params.eventId]?.name || `Event ${params.eventId}`;
  return {
    title: `Rides for ${eventName}`,
  };
}

export default function EventRidesPage({ params }: { params: { eventId: string } }) {
  const { eventId } = params;
  const eventDetails = mockEventsData[eventId];
  const ridesForThisEvent = mockEventRides.filter(ride => ride.eventId === eventId);

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
        title={`Rides for: ${eventDetails.name}`}
        description={`View available rides or request a new one for this event at ${eventDetails.location}.`}
        actions={
          <Button asChild>
            <Link href={`/rides/request?eventId=${eventId}`}>
              <PlusCircle className="mr-2 h-4 w-4" /> Request Ride for this Event
            </Link>
          </Button>
        }
      />

      {ridesForThisEvent.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {ridesForThisEvent.map((ride) => (
            <Card key={ride.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="relative h-40">
                <Image 
                  src={ride.image} 
                  alt={`Ride for ${ride.passengerName}`} 
                  layout="fill" 
                  objectFit="cover" 
                  className="rounded-t-lg"
                  data-ai-hint={ride.dataAiHint}
                />
                 <div className="absolute top-2 right-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                    {ride.status}
                 </div>
              </CardHeader>
              <CardContent className="flex-grow pt-4">
                <CardTitle className="font-headline text-lg mb-1">Ride for: {ride.passengerName}</CardTitle>
                <div className="text-sm text-muted-foreground space-y-1 mb-2">
                  <div className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> Pickup: {ride.pickupTime}</div>
                  <div className="flex items-center">
                    <Car className="mr-1.5 h-4 w-4" /> 
                    Driver: {ride.driverName !== "Pending" ? (
                      <Link href={`/drivers/${ride.driverName.toLowerCase().replace(' ','-')}/profile`} className="ml-1 text-primary hover:underline">{ride.driverName}</Link>
                    ) : (
                      <span className="ml-1">{ride.driverName}</span>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/rides/tracking/${ride.id}`}> {/* Assuming a generic ride details/tracking page */}
                    View Details
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Rides Available Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              There are currently no rides listed for {eventDetails.name}. Be the first to request one!
            </CardDescription>
            <Button asChild>
              <Link href={`/rides/request?eventId=${eventId}`}>
                <PlusCircle className="mr-2 h-4 w-4" /> Request Ride
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
