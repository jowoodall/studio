
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Star, Car, User, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ride History',
};

// Mock data for past rides
const mockPastRides = [
  { 
    id: "pastride1", 
    eventName: "School Annual Day", 
    date: "2024-05-15", 
    time: "10:00 AM", 
    destination: "Northwood High Auditorium", 
    driver: { name: "Alex Johnson", id: "driver123" }, 
    status: "Completed", 
    ratingGiven: 5,
    image: "https://placehold.co/400x200.png?text=Past+School+Event", 
    dataAiHint: "school stage event" 
  },
  { 
    id: "pastride2", 
    eventName: "Weekend Soccer Game", 
    date: "2024-05-18", 
    time: "02:00 PM", 
    destination: "City Sports Complex", 
    driver: { name: "Maria Garcia", id: "driver456" }, 
    status: "Completed", 
    ratingGiven: null,
    image: "https://placehold.co/400x200.png?text=Past+Soccer+Game",
    dataAiHint: "soccer game action" 
  },
  { 
    id: "pastride3", 
    eventName: "Library Study Session", 
    date: "2024-04-20", 
    time: "06:00 PM", 
    destination: "Community Library", 
    driver: { name: "John Smith", id: "driver789" }, 
    status: "Cancelled", 
    image: "https://placehold.co/400x200.png?text=Past+Study+Session",
    dataAiHint: "library books"
  },
];

export default function RideHistoryPage() {
  return (
    <>
      <PageHeader
        title="Ride History"
        description="Review your past rides and ratings."
      />

      {mockPastRides.length > 0 ? (
        <div className="space-y-6">
          {mockPastRides.map((ride) => (
            <Card key={ride.id} className="shadow-lg">
              <CardHeader className="flex flex-row items-start gap-4">
                <Image 
                  src={ride.image} 
                  alt={ride.eventName} 
                  width={150} 
                  height={84} 
                  className="rounded-md object-cover aspect-video"
                  data-ai-hint={ride.dataAiHint}
                />
                <div className="flex-1">
                  <CardTitle className="font-headline text-lg mb-1">{ride.eventName}</CardTitle>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <div className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> {ride.date} at {ride.time}</div>
                    <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> {ride.destination}</div>
                    <div className="flex items-center">
                      <User className="mr-1.5 h-4 w-4" /> 
                      Driver: <Link href={`/drivers/${ride.driver.id}/profile`} className="ml-1 text-primary hover:underline">{ride.driver.name}</Link>
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-semibold px-3 py-1 rounded-full
                  ${ride.status === "Completed" ? "bg-green-100 text-green-700" : 
                    ride.status === "Cancelled" ? "bg-red-100 text-red-700" :
                    "bg-muted text-muted-foreground"}`}>
                  {ride.status}
                </div>
              </CardHeader>
              <CardFooter className="border-t pt-4 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {ride.status === "Completed" && (
                    ride.ratingGiven ? (
                      <div className="flex items-center">
                        Your Rating: {Array(ride.ratingGiven).fill(0).map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400 ml-1" />)}
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/drivers/${ride.driver.id}/rate?rideId=${ride.id}`}>
                          <Star className="mr-2 h-4 w-4" /> Rate Driver
                        </Link>
                      </Button>
                    )
                  )}
                </div>
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/rides/${ride.id}/details`}> {/* Assuming a generic ride details page */}
                        View Ride Details
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
            <CardTitle className="font-headline text-2xl">No Ride History</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              You have no past rides recorded.
            </CardDescription>
            <Button asChild>
              <Link href="/rides/request">
                Request a Ride
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
