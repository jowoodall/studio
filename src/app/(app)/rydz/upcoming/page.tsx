
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, MapPin, Users, Car, Eye, AlertTriangle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upcoming Rydz', // Changed Rides to Rydz
};

// Mock data for upcoming rydz
const mockUpcomingRydz = [ // Changed mockUpcomingRides to mockUpcomingRydz
  { 
    id: "ryd1", // Changed ride1 to ryd1
    eventName: "School Annual Day Rehearsal", 
    date: "2024-12-10", 
    time: "03:00 PM", 
    destination: "Northwood High Auditorium", 
    driver: "John Smith", 
    status: "Confirmed", 
    image: "https://placehold.co/400x200.png?text=School+Event", 
    dataAiHint: "school kids play" 
  },
  { 
    id: "ryd2", // Changed ride2 to ryd2
    eventName: "Weekend Soccer Practice", 
    date: "2024-11-25", 
    time: "09:00 AM", 
    destination: "City Sports Complex", 
    driver: "Maria Garcia", 
    status: "Driver Assigned", 
    image: "https://placehold.co/400x200.png?text=Soccer+Practice",
    dataAiHint: "soccer kids" 
  },
  { 
    id: "ryd3", // Changed ride3 to ryd3
    eventName: "Study Group Session", 
    date: "2024-11-28", 
    time: "06:00 PM", 
    destination: "Community Library", 
    driver: "Pending", 
    status: "Requested", 
    image: "https://placehold.co/400x200.png?text=Study+Group",
    dataAiHint: "students library"
  },
];

export default function UpcomingRydzPage() { // Changed UpcomingRidesPage to UpcomingRydzPage
  return (
    <>
      <PageHeader
        title="Upcoming Rydz" // Changed Rides to Rydz
        description="Here are your scheduled and requested rydz." // Changed rides to rydz
      />

      {mockUpcomingRydz.length > 0 ? ( // Changed mockUpcomingRides
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockUpcomingRydz.map((ryd) => ( // Changed ride to ryd
            <Card key={ryd.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="relative h-40">
                <Image 
                  src={ryd.image} 
                  alt={ryd.eventName} 
                  layout="fill" 
                  objectFit="cover" 
                  className="rounded-t-lg" 
                  data-ai-hint={ryd.dataAiHint}
                />
                 <div className="absolute top-2 right-2 bg-primary/80 text-primary-foreground text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                    {ryd.status}
                 </div>
              </CardHeader>
              <CardContent className="flex-grow pt-4">
                <CardTitle className="font-headline text-lg mb-1">{ryd.eventName}</CardTitle>
                <div className="text-sm text-muted-foreground space-y-1 mb-2">
                  <div className="flex items-center"><CalendarDays className="mr-1.5 h-4 w-4" /> {ryd.date} at {ryd.time}</div>
                  <div className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" /> {ryd.destination}</div>
                  <div className="flex items-center">
                    <Car className="mr-1.5 h-4 w-4" /> 
                    Driver: {ryd.driver !== "Pending" ? (
                      <Link href={`/drivers/${ryd.driver.toLowerCase().replace(' ','-')}/profile`} className="ml-1 text-primary hover:underline">{ryd.driver}</Link>
                    ) : (
                      <span className="ml-1">{ryd.driver}</span>
                    )}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <Button variant="default" className="w-full" asChild>
                  <Link href={`/rydz/tracking/${ryd.id}`}> {/* Changed rides to rydz */}
                    <Eye className="mr-2 h-4 w-4" /> View Details / Track
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12 shadow-md">
          <CardHeader>
            <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="font-headline text-2xl">No Upcoming Rydz</CardTitle> {/* Changed Rides to Rydz */}
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-6">
              You have no rydz scheduled. Request one to get started! {/* Changed rides to rydz */}
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

