
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, User, Car, PlusCircle, AlertTriangle, Command } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';

// Mock data for rydz related to an event
const mockEventRydz = [ // Changed mockEventRides to mockEventRydz
  { id: "rydM", eventId: "1", passengerName: "Alice Wonderland", pickupTime: "09:30 AM", driverName: "Bob The Builder", status: "Confirmed", image: "https://placehold.co/400x200.png?text=Event+Ryd+1", dataAiHint: "group children car" }, // Changed rideA to rydM etc. for uniqueness if old names were specific
  { id: "rydN", eventId: "1", passengerName: "Charlie Brown", pickupTime: "09:45 AM", driverName: "Diana Prince", status: "Pending Driver", image: "https://placehold.co/400x200.png?text=Event+Ryd+2", dataAiHint: "teenager waiting" },
  { id: "rydO", eventId: "2", passengerName: "Edward Scissorhands", pickupTime: "01:30 PM", driverName: "Fiona Gallagher", status: "Confirmed", image: "https://placehold.co/400x200.png?text=Event+Ryd+3", dataAiHint: "sports gear car" },
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
    title: `Rydz for ${eventName}`, // Changed Rides to Rydz
  };
}

export default function EventRydzPage({ params }: { params: { eventId: string } }) { // Changed EventRidesPage to EventRydzPage
  const { eventId } = params;
  const eventDetails = mockEventsData[eventId];
  const rydzForThisEvent = mockEventRydz.filter(ryd => ryd.eventId === eventId); // Changed ridesForThisEvent, mockEventRides, ride

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
        title={`Rydz for: ${eventDetails.name}`} // Changed Rides to Rydz
        description={`View available rydz, request a new one, or offer to drive for this event at ${eventDetails.location}.`} // Changed rides to rydz
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Button asChild>
              <Link href={`/rydz/request?eventId=${eventId}`}> {/* Changed rides to rydz */}
                <>
                  <PlusCircle className="mr-2 h-4 w-4" /> Request Ryd {/* Changed Ride to Ryd */}
                </>
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/events/${eventId}/offer-drive`}>
                <>
                  <Command className="mr-2 h-4 w-4" /> I can drive
                </>
              </Link>
            </Button>
          </div>
        }
      />

      {rydzForThisEvent.length > 0 ? ( // Changed ridesForThisEvent
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rydzForThisEvent.map((ryd) => ( // Changed ride
            <Card key={ryd.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="relative h-40">
                <Image 
                  src={ryd.image} 
                  alt={`Ryd for ${ryd.passengerName}`} // Changed Ride to Ryd
                  fill 
                  style={{objectFit: 'cover'}}
                  className="rounded-t-lg"
                  data-ai-hint={ryd.dataAiHint}
                />
                 <div className="absolute top-2 right-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                    {ryd.status}
                 </div>
              </CardHeader>
              <CardContent className="flex-grow pt-4">
                <CardTitle className="font-headline text-lg mb-1">Ryd for: {ryd.passengerName}</CardTitle> {/* Changed Ride to Ryd */}
                <div className="text-sm text-muted-foreground space-y-1 mb-2">
                  <div className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> Pickup: {ryd.pickupTime}</div>
                  <div className="flex items-center">
                    <Car className="mr-1.5 h-4 w-4" /> 
                    Driver: {ryd.driverName !== "Pending" ? (
                      <Link href={`/drivers/${ryd.driverName.toLowerCase().replace(' ','-')}/profile`} className="ml-1 text-primary hover:underline">{ryd.driverName}</Link>
                    ) : (
                      <span className="ml-1">{ryd.driverName}</span>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/rydz/tracking/${ryd.id}`}> {/* Assuming a generic ryd details/tracking page, changed rides to rydz */}
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
            <CardTitle className="font-headline text-2xl">No Rydz Available Yet</CardTitle> {/* Changed Rides to Rydz */}
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              There are currently no rydz listed for {eventDetails.name}. Be the first to request one or offer to drive! {/* Changed rides to rydz */}
            </CardDescription>
            <div className="flex justify-center gap-4">
                <Button asChild>
                <Link href={`/rydz/request?eventId=${eventId}`}> {/* Changed rides to rydz */}
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" /> Request Ryd {/* Changed Ride to Ryd */}
                    </>
                </Link>
                </Button>
                <Button variant="outline" asChild>
                <Link href={`/events/${eventId}/offer-drive`}>
                    <>
                      <Command className="mr-2 h-4 w-4" /> I can drive
                    </>
                </Link>
                </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

