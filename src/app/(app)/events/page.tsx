import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, CalendarDays, MapPin, Users, ExternalLink, Car } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Manage Events',
};

const mockEvents = [
  { id: "1", name: "School Annual Day", date: "2024-12-15", time: "10:00 AM", location: "Northwood High Auditorium", attendees: 150, type: "School Event", image: "https://placehold.co/400x200.png?text=School+Event", dataAiHint: "school auditorium" },
  { id: "2", name: "Community Soccer Match", date: "2024-11-30", time: "02:00 PM", location: "City Sports Complex", attendees: 45, type: "Sports", image: "https://placehold.co/400x200.png?text=Soccer+Match", dataAiHint: "soccer field" },
  { id: "3", name: "Tech Conference 2024", date: "2025-01-20", time: "09:00 AM", location: "Downtown Convention Center", attendees: 500, type: "Conference", external: true, image: "https://placehold.co/400x200.png?text=Tech+Conference", dataAiHint: "conference hall" },
];

export default function EventsPage() {
  return (
    <>
      <PageHeader
        title="Events"
        description="View upcoming events or create new ones for carpooling."
        actions={
          <Button asChild>
            <Link href="/events/create">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Event
            </Link>
          </Button>
        }
      />

      {mockEvents.length > 0 ? (
         <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockEvents.map((event) => (
            <Card key={event.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
               <CardHeader className="relative h-40">
                 <Image src={event.image} alt={event.name} layout="fill" objectFit="cover" className="rounded-t-lg" data-ai-hint={event.dataAiHint} />
                 {event.external && (
                    <div className="absolute top-2 right-2 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded-full flex items-center">
                        <ExternalLink className="h-3 w-3 mr-1" /> External
                    </div>
                 )}
              </CardHeader>
              <CardContent className="flex-grow pt-4">
                <CardTitle className="font-headline text-xl mb-1">{event.name}</CardTitle>
                <div className="text-sm text-muted-foreground space-y-1 mb-2">
                    <div className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> {event.date} at {event.time}</div>
                    <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> {event.location}</div>
                    <div className="flex items-center"><Users className="mr-1.5 h-4 w-4" /> {event.attendees} attendees</div>
                </div>
                <CardDescription className="text-xs bg-muted px-2 py-1 rounded-md inline-block">{event.type}</CardDescription>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="default" className="w-full" asChild>
                  <Link href={`/events/${event.id}/rides`}>
                    <Car className="mr-2 h-4 w-4" /> View/Request Rides
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
           <CardHeader>
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Events Found</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              There are no events listed currently. Try creating one!
            </CardDescription>
            <Button asChild>
              <Link href="/events/create">
                <PlusCircle className="mr-2 h-4 w-4" /> Create an Event
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
