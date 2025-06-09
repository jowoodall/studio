
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Star, Car, User, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ryd History', // Changed Ride to Ryd
};

// Mock data for past rydz
const mockPastRydz = [ // Changed mockPastRides to mockPastRydz
  { 
    id: "pastryd1", // Changed pastride1 to pastryd1
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
    id: "pastryd2", // Changed pastride2 to pastryd2
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
    id: "pastryd3", // Changed pastride3 to pastryd3
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

export default function RydHistoryPage() { // Changed RideHistoryPage to RydHistoryPage
  return (
    <>
      <PageHeader
        title="Ryd History" // Changed Ride to Ryd
        description="Review your past rydz and ratings." // Changed rides to rydz
      />

      {mockPastRydz.length > 0 ? ( // Changed mockPastRides
        <div className="space-y-6">
          {mockPastRydz.map((ryd) => ( // Changed ride to ryd
            <Card key={ryd.id} className="shadow-lg">
              <CardHeader className="flex flex-row items-start gap-4">
                <Image 
                  src={ryd.image} 
                  alt={ryd.eventName} 
                  width={150} 
                  height={84} 
                  className="rounded-md object-cover aspect-video"
                  data-ai-hint={ryd.dataAiHint}
                />
                <div className="flex-1">
                  <CardTitle className="font-headline text-lg mb-1">{ryd.eventName}</CardTitle>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <div className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> {ryd.date} at {ryd.time}</div>
                    <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> {ryd.destination}</div>
                    <div className="flex items-center">
                      <User className="mr-1.5 h-4 w-4" /> 
                      Driver: <Link href={`/drivers/${ryd.driver.id}/profile`} className="ml-1 text-primary hover:underline">{ryd.driver.name}</Link>
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-semibold px-3 py-1 rounded-full
                  ${ryd.status === "Completed" ? "bg-green-100 text-green-700" : 
                    ryd.status === "Cancelled" ? "bg-red-100 text-red-700" :
                    "bg-muted text-muted-foreground"}`}>
                  {ryd.status}
                </div>
              </CardHeader>
              <CardFooter className="border-t pt-4 flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {ryd.status === "Completed" && (
                    ryd.ratingGiven ? (
                      <div className="flex items-center">
                        Your Rating: {Array(ryd.ratingGiven).fill(0).map((_, i) => <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400 ml-1" />)}
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/drivers/${ryd.driver.id}/rate?rideId=${ryd.id}`}> {/* rideId query param kept */}
                          <Star className="mr-2 h-4 w-4" /> Rate Driver
                        </Link>
                      </Button>
                    )
                  )}
                </div>
                <Button variant="ghost" size="sm" asChild>
                    <Link href={`/rydz/tracking/${ryd.id}`}> {/* Changed link from /details to /tracking */}
                        View Ryd Details {/* Changed Ride to Ryd */}
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
            <CardTitle className="font-headline text-2xl">No Ryd History</CardTitle> {/* Changed Ride to Ryd */}
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              You have no past rydz recorded. {/* Changed rides to rydz */}
            </CardDescription>
            <Button asChild>
              <Link href="/rydz/request"> {/* Changed rides to rydz */}
                Request a Ryd {/* Changed Ride to Ryd */}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
